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
    if (p.startsWith('/wiki/api/v2/spaces/42/pages')) return json({ results: pages.map((x) => ({ title: x.title })) });
    if (p === '/wiki/api/v2/pages' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.spaceId, '42');
      pages.push(body);
      return json({ id: String(pages.length) });
    }
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
