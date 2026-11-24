// One-click demo setup for judges and new installs: creates the synthetic near-miss
// reports in the safety project and a "Clinical Protocols" Confluence space with
// protocol pages. Runs as the requesting admin and is idempotent.
import { asUser, route } from '@forge/api';
import demo from './demo-data.js';

export const DEMO_LABEL = 'slice-demo';
export const PROTOCOL_SPACE = { key: 'CLINPROT', name: 'Clinical Protocols' };

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

async function ok(res, what) {
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

const adf = (text) => ({
  type: 'doc',
  version: 1,
  content: text.split('\n').map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })),
});

/** Pick an issue type that can be created in the project: Task if present. */
async function issueTypeFor(projectKey) {
  const project = await ok(await asUser().requestJira(route`/rest/api/3/project/${projectKey}`), `read project ${projectKey}`);
  const types = (project.issueTypes || []).filter((t) => !t.subtask);
  const pick = types.find((t) => t.name === 'Task') || types.find((t) => /incident|request/i.test(t.name)) || types[0];
  if (!pick) throw new Error(`Project ${projectKey} has no issue types Slice can use.`);
  return pick.id;
}

/** Summaries of demo reports already in the project, so reruns don't duplicate. */
async function existingDemoSummaries(projectKey) {
  const res = await asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ jql: `project = ${projectKey} AND labels = ${DEMO_LABEL}`, fields: ['summary'], maxResults: 100 }),
  });
  const data = await ok(res, 'search demo reports');
  return new Set((data.issues || []).map((i) => i.fields.summary.trim()));
}

export async function loadDemoReports(projectKey) {
  const have = await existingDemoSummaries(projectKey);
  const todo = demo.reports.filter((r) => !have.has(r.summary.trim()));
  if (!todo.length) return { created: 0, skipped: demo.reports.length };
  const issuetype = { id: await issueTypeFor(projectKey) };
  let created = 0;
  // Bulk create in batches (the API accepts up to 50 per call).
  for (let i = 0; i < todo.length; i += 25) {
    const batch = todo.slice(i, i + 25);
    const res = await asUser().requestJira(route`/rest/api/3/issue/bulk`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        issueUpdates: batch.map((r) => ({
          fields: {
            project: { key: projectKey },
            issuetype,
            summary: r.summary,
            description: adf(`Date of event: ${r.date}\n${r.description}`),
            labels: ['near-miss', DEMO_LABEL],
          },
        })),
      }),
    });
    const data = await ok(res, 'create demo reports');
    created += (data.issues || []).length;
    if (data.errors?.length) console.warn('some demo reports failed', JSON.stringify(data.errors).slice(0, 300));
  }
  return { created, skipped: demo.reports.length - todo.length };
}

// Confluence v2 API for spaces and pages (the v1 space endpoints are retired).
export async function ensureProtocolSpace() {
  const found = await ok(
    await asUser().requestConfluence(route`/wiki/api/v2/spaces?keys=${PROTOCOL_SPACE.key}`),
    'read protocol space'
  );
  if (found.results?.length) return { id: found.results[0].id, created: false };
  const made = await ok(
    await asUser().requestConfluence(route`/wiki/api/v2/spaces`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        key: PROTOCOL_SPACE.key,
        name: PROTOCOL_SPACE.name,
        description: { value: 'Demo clinical protocols for Slice (synthetic).', representation: 'plain' },
      }),
    }),
    'create protocol space'
  );
  return { id: made.id, created: true };
}

async function existingTitles(spaceId) {
  const data = await ok(
    await asUser().requestConfluence(route`/wiki/api/v2/spaces/${spaceId}/pages?limit=100`),
    'list protocol pages'
  );
  return new Set((data.results || []).map((p) => p.title));
}

export async function loadDemoProtocols() {
  const space = await ensureProtocolSpace();
  const have = await existingTitles(space.id);
  let created = 0;
  for (const p of demo.protocols) {
    if (have.has(p.title)) continue;
    const page = await ok(
      await asUser().requestConfluence(route`/wiki/api/v2/pages`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          spaceId: space.id,
          status: 'current',
          title: p.title,
          body: { representation: 'storage', value: p.body },
        }),
      }),
      `create protocol "${p.title}"`
    );
    // Labels still live on the v1 content API. Slice also searches the protocol
    // space directly, so a failed label is not fatal.
    await asUser()
      .requestConfluence(route`/wiki/rest/api/content/${page.id}/label`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify([{ prefix: 'global', name: p.label }]),
      })
      .catch((e) => console.warn('label failed', e.message));
    created++;
  }
  return { spaceCreated: space.created, created, space: PROTOCOL_SPACE.key };
}

/**
 * Create a Confluence page in the Clinical Protocols space unless one with the same
 * title exists. Returns { url, created }.
 */
export async function publishPage(title, storageBody) {
  const space = await ensureProtocolSpace();
  const existing = await ok(
    await asUser().requestConfluence(route`/wiki/api/v2/spaces/${space.id}/pages?title=${title}&limit=1`),
    'find existing page'
  );
  const pageUrl = (p, base) => `${base || ''}${p._links?.webui || ''}`;
  if (existing.results?.length) return { url: pageUrl(existing.results[0], existing._links?.base), created: false };
  const page = await ok(
    await asUser().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ spaceId: space.id, status: 'current', title, body: { representation: 'storage', value: storageBody } }),
    }),
    'create page'
  );
  return { url: pageUrl(page, page._links?.base), created: true };
}
