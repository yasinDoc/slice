// Integration test for the Forge layer: trigger, Rovo actions and panel resolver,
// against an in-memory KVS and a fake Jira/Confluence. Run with:
//   node --experimental-test-module-mocks --test tests/forge.test.js
import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/demo-data.js';

const adf = (t) => ({ type: 'doc', version: 1, content: t.split('\n').map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })) });
const issues = new Map(
  seed.reports.map((r, i) => [
    `SAFE-${i + 1}`,
    {
      key: `SAFE-${i + 1}`,
      fields: { summary: r.summary, description: adf(`Date of event: ${r.date}\n${r.description}`), created: `${r.date}T10:00:00.000Z`, project: { key: 'SAFE' } },
    },
  ])
);
const comments = [];
const labels = [];
const created = [];
const hidden = new Set(['SAFE-2']); // pretend the user cannot see this one

let isAdmin = true;
const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

function fakeProduct(user) {
  return {
    async requestJira(path, init = {}) {
      const p = String(path);
      let m;
      if ((m = p.match(/^\/rest\/api\/3\/issue\/([A-Z]+-\d+)\?/))) {
        if (user && hidden.has(m[1])) return json({ errorMessages: ['not found'] }, 404);
        return issues.has(m[1]) ? json(issues.get(m[1])) : json({}, 404);
      }
      if (p.startsWith('/rest/api/3/mypermissions')) {
        return json({ permissions: { ADMINISTER: { havePermission: isAdmin } } });
      }
      if (p === '/rest/api/3/search/jql') {
        const { jql } = JSON.parse(init.body);
        const keyList = jql.match(/key in \(([^)]+)\)/);
        let list = [...issues.values()];
        if (keyList) {
          // Like real Jira: a missing key makes the whole query fail.
          const missing = keyList[1].split(',').find((k) => !issues.has(k));
          if (missing) return json({ errorMessages: [`An issue with key '${missing}' does not exist`] }, 400);
          list = list.filter((i) => keyList[1].split(',').includes(i.key));
        }
        if (user) list = list.filter((i) => !hidden.has(i.key));
        return json({ issues: list });
      }
      if ((m = p.match(/^\/rest\/api\/3\/issue\/([A-Z]+-\d+)\/comment$/))) {
        comments.push({ key: m[1], body: JSON.parse(init.body).body });
        return json({ id: '1' }, 201);
      }
      if ((m = p.match(/^\/rest\/api\/3\/issue\/([A-Z]+-\d+)$/)) && init.method === 'PUT') {
        labels.push({ key: m[1], body: JSON.parse(init.body) });
        return { ok: true, status: 204, json: async () => null, text: async () => '' };
      }
      if (p === '/rest/api/3/issue' && init.method === 'POST') {
        const key = `SAFE-${100 + created.length}`;
        created.push({ key, fields: JSON.parse(init.body).fields });
        return json({ key }, 201);
      }
      if (p === '/rest/api/3/issueLink') return json({}, 201);
      throw new Error(`unexpected Jira call ${p}`);
    },
    async requestConfluence() {
      return json({
        _links: { base: 'https://example.atlassian.net/wiki' },
        results: seed.protocols.slice(0, 1).map((p, i) => ({ id: String(i), title: p.title, body: { storage: { value: p.body } }, version: { when: '2026-01-01' }, _links: { webui: `/pages/${i}` } })),
      });
    },
  };
}

const store = new Map();
// Same key rule as real Forge KVS, so invalid keys fail here too.
const KEY_RE = /^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/;
const checkKey = (k) => {
  if (!KEY_RE.test(k)) throw new Error(`INVALID_KEY: ${k}`);
  return k;
};
mock.module('@forge/api', {
  namedExports: {
    asApp: () => fakeProduct(false),
    asUser: () => fakeProduct(true),
    route: (strings, ...vals) => strings.reduce((s, str, i) => s + str + (i < vals.length ? vals[i] : ''), ''),
  },
});
mock.module('@forge/kvs', {
  namedExports: {
    WhereConditions: { beginsWith: (v) => ({ beginsWith: v }) },
    kvs: {
      get: async (k) => store.get(checkKey(k)),
      set: async (k, v) => void store.set(checkKey(k), v),
      delete: async (k) => void store.delete(checkKey(k)),
      query() {
        let prefix = '';
        const q = {
          where: (_f, c) => ((prefix = c.beginsWith), q),
          limit: () => q,
          cursor: () => q,
          getMany: async () => ({ results: [...store].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })) }),
        };
        return q;
      },
    },
  },
});

let app;
before(async () => {
  app = await import('../src/index.js');
});

test('trigger indexes reports, and comments once when a signal appears', async () => {
  for (let i = 1; i <= 5; i++) await app.onIssueEvent({ issue: { key: `SAFE-${i}`, fields: { project: { key: 'SAFE' } } } });
  assert.ok(store.has('report:SAFE-5'));
  assert.ok(!JSON.stringify(store.get('report:SAFE-1')).includes('Rahman'), 'stored record must be redacted');
  // Each report that joins (or grows) the signal gets one comment: SAFE-3, SAFE-4, SAFE-5.
  const pumpComments = comments.filter((c) => JSON.stringify(c.body).includes('VitaFlow 300'));
  assert.deepEqual(pumpComments.map((c) => c.key), ['SAFE-3', 'SAFE-4', 'SAFE-5']);
  assert.ok(labels.some((l) => JSON.stringify(l.body).includes('slice-signal')));
  // Re-processing the same report does not repeat the comment.
  await app.onIssueEvent({ issue: { key: 'SAFE-5', fields: { project: { key: 'SAFE' } } } });
  assert.equal(comments.filter((c) => JSON.stringify(c.body).includes('VitaFlow 300')).length, pumpComments.length);
});

test('a signal that shrank after deletions still alerts new reports', async () => {
  // Simulate a stale alert recorded when duplicates made the signal bigger.
  const alertKey = [...store.keys()].find((k) => k.startsWith('alert:') && k.includes('ward-6'));
  store.set(alertKey, { count: 10, at: '2026-11-23T00:00:00Z' });
  const before = comments.length;
  await app.onIssueEvent({ issue: { key: 'SAFE-4', fields: { project: { key: 'SAFE' } } } });
  assert.equal(comments.length, before + 1, 'old count-only alert must not block a new report');
  await app.onIssueEvent({ issue: { key: 'SAFE-4', fields: { project: { key: 'SAFE' } } } });
  assert.equal(comments.length, before + 1, 'same report is not alerted twice');
});

test('deleted issues are removed from the index', async () => {
  await app.onIssueEvent({ issue: { key: 'SAFE-30', fields: { project: { key: 'SAFE' } } } });
  assert.ok(store.has('report:SAFE-30'));
  await app.onIssueEvent({ eventType: 'avi:jira:deleted:issue', issue: { key: 'SAFE-30' } });
  assert.ok(!store.has('report:SAFE-30'));
});

test('trigger ignores issues outside the safety project', async () => {
  const before = store.size;
  await app.onIssueEvent({ issue: { key: 'DEV-1', fields: { project: { key: 'DEV' } } } });
  assert.equal(store.size, before);
});

test('find-similar-reports respects user permissions', async () => {
  const res = await app.findSimilarReports({ context: { jira: { issueKey: 'SAFE-5' } } });
  assert.ok(!res.error, res.error);
  const keys = res.similar.map((s) => s.key);
  assert.ok(keys.includes('SAFE-1') && keys.includes('SAFE-3'), keys.join());
  assert.ok(!keys.includes('SAFE-2'), 'hidden issue must not be returned');
});

test('a report deleted in Jira but still indexed does not break results', async () => {
  // Index SAFE-3, then delete it from "Jira" without telling Slice.
  await app.onIssueEvent({ issue: { key: 'SAFE-3', fields: { project: { key: 'SAFE' } } } });
  const saved = issues.get('SAFE-3');
  issues.delete('SAFE-3');
  try {
    const res = await app.findSimilarReports({ issueKey: 'SAFE-5' });
    assert.ok(!res.error, res.error);
    assert.ok(!res.similar.some((s) => s.key === 'SAFE-3'));
    const panel = await app.panelResolver({ call: { functionKey: 'getPanel', payload: { issueKey: 'SAFE-5' } }, context: {} });
    assert.ok((panel?.body ?? panel).slices);
  } finally {
    issues.set('SAFE-3', saved);
  }
});

test('get-safety-signals lists the pump signal', async () => {
  const res = await app.getSafetySignals({ location: 'ward 6' });
  assert.ok(res.signals.some((s) => /VitaFlow 300/.test(s.title)), JSON.stringify(res.signals.map((s) => s.title)));
});

test('draft-rca returns ranked fixes and a stale protocol', async () => {
  const res = await app.draftRca({ issueKey: 'safe-5' });
  assert.ok(!res.error, res.error);
  assert.equal(res.recommendations[0].strength, 'strong');
  assert.equal(res.staleProtocols.length, 1);
});

test('create-safety-action creates a linked, labelled task', async () => {
  const res = await app.createSafetyAction({ issueKey: 'SAFE-5', summary: 'Hard limits for heparin on VitaFlow 300', strength: 'strong' });
  assert.equal(res.linkedTo, 'SAFE-5');
  assert.deepEqual(created.at(-1).fields.labels, ['slice-action']);
});

test('actions return a readable error without an issue key', async () => {
  const res = await app.explainSlices({});
  assert.match(res.error, /No issue key/);
});

test('dashboard resolver summarises the safety project', async () => {
  const res = await app.panelResolver({ call: { functionKey: 'getDashboard', payload: { projectKey: 'SAFE' } }, context: {} });
  const data = res?.body ?? res;
  assert.equal(data.configured, true);
  assert.ok(data.signals.some((s) => /VitaFlow 300/.test(s.title)), JSON.stringify(data.signals.map((s) => s.title)));
  assert.ok(!data.latest.some((r) => r.key === 'SAFE-2'), 'hidden report must not appear');
  const other = await app.panelResolver({ call: { functionKey: 'getDashboard', payload: { projectKey: 'DEV' } }, context: {} });
  assert.equal((other?.body ?? other).configured, false);
});

test('only admins can save settings, and input is validated', async () => {
  const call = (payload) => app.panelResolver({ call: { functionKey: 'saveSettings', payload }, context: {} });
  isAdmin = false;
  await assert.rejects(call({ minSignalCount: 2 }), /administrators/);
  isAdmin = true;
  const res = await call({ projectKeys: 'safe, icu_2', minSignalCount: 4 });
  const saved = (res?.body ?? res).settings;
  assert.deepEqual(saved.projectKeys, ['SAFE', 'ICU_2']);
  assert.equal(saved.minSignalCount, 4);
  await assert.rejects(call({ windowDays: 9999 }), /Look-back window/);
  await assert.rejects(call({ projectKeys: 'bad key!' }), /Project keys/);
  // restore defaults for later tests
  await app.panelResolver({ call: { functionKey: 'saveSettings', payload: { projectKeys: 'SAFE', minSignalCount: 3 } }, context: {} });
});

test('panel resolver returns signal, slices and protocols', async () => {
  const res = await app.panelResolver({ call: { functionKey: 'getPanel', payload: { issueKey: 'SAFE-5' } }, context: {} });
  const data = res?.body ?? res;
  assert.ok(data.signal, JSON.stringify(data).slice(0, 300));
  assert.equal(data.slices.length, 4);
  assert.ok(data.protocols[0].stale);
  assert.equal(data.recommendations[0].strength, 'strong');
  const made = await app.panelResolver({
    call: { functionKey: 'createAction', payload: { issueKey: 'SAFE-5', text: data.recommendations[0].text, strength: 'strong', addresses: 'x' } },
    context: {},
  });
  assert.equal((made?.body ?? made).linkedTo, 'SAFE-5');
});
