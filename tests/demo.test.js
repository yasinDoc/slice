// Tests the one-click demo loader against a fake Jira/Confluence that remembers
// what was created, so a second run must not duplicate anything.
import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/demo-data.js';

const issues = [];
const pages = [];
const labels = [];
let spaceExists = false;
let isAdmin = true;
const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

const product = {
  async requestJira(path, init = {}) {
    const p = String(path);
    if (p.startsWith('/rest/api/3/mypermissions')) return json({ permissions: { ADMINISTER: { havePermission: isAdmin } } });
    if (p === '/rest/api/3/serverInfo') return json({ baseUrl: 'https://site.atlassian.net' });
    if (p === '/rest/api/3/project/SAFE') {
      return json({ issueTypes: [{ id: '1', name: 'Sub-task', subtask: true }, { id: '2', name: 'Task', subtask: false }] });
    }
    if (p === '/rest/api/3/search/jql') {
      const { jql } = JSON.parse(init.body);
      const list = /labels = slice-demo/.test(jql) ? issues.filter((i) => i.fields.labels.includes('slice-demo')) : issues;
      return json({ issues: list });
    }
    if (p === '/rest/api/3/issue/bulk') {
      const { issueUpdates } = JSON.parse(init.body);
      assert.ok(issueUpdates.length <= 50);
      const made = issueUpdates.map((u) => {
        assert.equal(u.fields.issuetype.id, '2', 'uses the Task type, not a sub-task');
        const key = `SAFE-${issues.length + 1}`;
        issues.push({ key, fields: { ...u.fields, project: { key: 'SAFE' }, created: '2026-11-24T00:00:00Z' } });
        return { key };
      });
      return json({ issues: made, errors: [] }, 201);
    }
    throw new Error(`unexpected Jira call ${p}`);
  },
  async requestConfluence(path, init = {}) {
    const p = String(path);
    if (p === '/wiki/api/v2/spaces?keys=CLINPROT') return json({ results: spaceExists ? [{ id: '42', key: 'CLINPROT' }] : [] });
    if (p === '/wiki/api/v2/spaces' && init.method === 'POST') {
      assert.equal(JSON.parse(init.body).key, 'CLINPROT');
      spaceExists = true;
      return json({ id: '42', key: 'CLINPROT' });
    }
    if (p.startsWith('/wiki/api/v2/spaces/42/pages')) {
      const title = new URLSearchParams(p.split('?')[1]).get('title');
      const list = pages.filter((x) => !title || x.title === title).map((x) => ({ title: x.title, _links: { webui: `/spaces/CLINPROT/pages/${x.id}` } }));
      return json({ results: list, _links: { base: 'https://site.atlassian.net/wiki' } });
    }
    if (p === '/wiki/api/v2/pages' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.spaceId, '42');
      const id = String(pages.length + 1);
      pages.push({ ...body, id });
      return json({ id, _links: { base: 'https://site.atlassian.net/wiki', webui: `/spaces/CLINPROT/pages/${id}` } });
    }
    if (p.startsWith('/wiki/rest/api/content/search')) return json({ results: [] });
    if (/^\/wiki\/rest\/api\/content\/\d+\/label$/.test(p)) {
      labels.push(JSON.parse(init.body)[0].name);
      return json({ results: [] });
    }
    throw new Error(`unexpected Confluence call ${p}`);
  },
};

const store = new Map();
mock.module('@forge/api', {
  namedExports: {
    asApp: () => product,
    asUser: () => product,
    route: (s, ...v) => s.reduce((a, str, i) => a + str + (i < v.length ? v[i] : ''), ''),
  },
});
mock.module('@forge/kvs', {
  namedExports: {
    WhereConditions: { beginsWith: (v) => ({ beginsWith: v }) },
    kvs: {
      get: async (k) => store.get(k),
      set: async (k, v) => void store.set(k, v),
      delete: async (k) => void store.delete(k),
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
const loadDemo = () => app.panelResolver({ call: { functionKey: 'loadDemo', payload: {} }, context: {} }).then((r) => r?.body ?? r);

test('non-admins cannot load demo data', async () => {
  isAdmin = false;
  await assert.rejects(loadDemo(), /administrators/);
  isAdmin = true;
  assert.equal(issues.length, 0);
});

test('loads reports, protocol space and pages, then indexes them', async () => {
  const res = await loadDemo();
  assert.equal(res.reports.created, seed.reports.length);
  assert.equal(res.protocols.created, seed.protocols.length);
  assert.equal(res.protocols.spaceCreated, true);
  assert.equal(res.indexed, seed.reports.length);
  assert.deepEqual(labels, seed.protocols.map(() => 'protocol'));
  assert.ok(store.has('report:SAFE-1'));
});

test('running it again creates nothing new', async () => {
  const res = await loadDemo();
  assert.equal(res.reports.created, 0);
  assert.equal(res.reports.skipped, seed.reports.length);
  assert.equal(res.protocols.created, 0);
  assert.equal(issues.length, seed.reports.length);
  assert.equal(pages.length, seed.protocols.length);
});

test('publishes a signal brief to Confluence once, then links to it', async () => {
  const call = (functionKey, payload) => app.panelResolver({ call: { functionKey, payload }, context: {} }).then((r) => r?.body ?? r);
  const dash = await call('getDashboard', { projectKey: 'SAFE' });
  const pump = dash.signals.find((s) => /VitaFlow 300/.test(s.title));
  assert.ok(pump, JSON.stringify(dash.signals.map((s) => s.title)));
  const before = pages.length;
  const first = await call('publishBrief', { projectKey: 'SAFE', signalId: pump.id });
  assert.equal(first.created, true);
  assert.match(first.url, /^https:\/\/site\.atlassian\.net\/wiki\/spaces\/CLINPROT\/pages\/\d+$/);
  const page = pages.at(-1);
  assert.match(page.title, /^Safety signal brief: .*VitaFlow 300/);
  assert.ok(page.body.value.includes('https://site.atlassian.net/browse/SAFE-1'));
  const again = await call('publishBrief', { projectKey: 'SAFE', signalId: pump.id });
  assert.equal(again.created, false);
  assert.equal(pages.length, before + 1);
  await assert.rejects(call('publishBrief', { projectKey: 'SAFE', signalId: 'nope' }), /no longer active/);
});

test('Rovo actions: signals include an id the publish action accepts', async () => {
  const res = await app.getSafetySignals({});
  const pump = res.signals.find((s) => /VitaFlow 300/.test(s.title));
  assert.ok(pump.signalId && pump.projectKey === 'SAFE', JSON.stringify(pump));
  const out = await app.publishSignalBriefAction({ signalId: pump.signalId, projectKey: pump.projectKey });
  assert.ok(!out.error, out.error);
  assert.equal(out.alreadyExisted, true, 'brief from the previous test is reused');
  assert.match(out.url, /CLINPROT/);
  const bad = await app.publishSignalBriefAction({});
  assert.match(bad.error, /signalId is required/);
});
