// Thin wrappers over the Jira and Confluence REST APIs.
import { asApp, asUser as asUserApi, route } from '@forge/api';

const as = (asUser) => (asUser ? asUserApi() : asApp());

async function ok(res, what) {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${what} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

const ISSUE_FIELDS = 'summary,description,created,project,labels,status,issuetype';

export async function getIssue(key, { asUser = false } = {}) {
  const res = await as(asUser).requestJira(route`/rest/api/3/issue/${key}?fields=${ISSUE_FIELDS}`);
  return ok(res, `get issue ${key}`);
}

/** JQL search using the paginated /search/jql endpoint. */
export async function searchIssues(jql, { asUser = false, max = 500, fields = ISSUE_FIELDS.split(',') } = {}) {
  const issues = [];
  let nextPageToken;
  do {
    const res = await as(asUser).requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields, maxResults: Math.min(100, max - issues.length), nextPageToken }),
    });
    const page = await ok(res, 'jql search');
    issues.push(...(page.issues || []));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && issues.length < max);
  return issues;
}

/** Of the given keys, return the ones the current user is allowed to see. */
export async function visibleKeys(keys) {
  if (!keys.length) return new Set();
  // Search by project, not "key in (...)": Jira rejects the whole query if any key
  // no longer exists (e.g. a deleted report still in Slice's index).
  const projects = [...new Set(keys.map((k) => String(k).split('-')[0]))].filter((p) => /^[A-Z][A-Z0-9_]*$/.test(p));
  if (!projects.length) return new Set();
  const issues = await searchIssues(`project in (${projects.join(',')})`, { asUser: true, fields: ['summary'], max: 5000 });
  const wanted = new Set(keys);
  return new Set(issues.map((i) => i.key).filter((k) => wanted.has(k)));
}

/** True if the current user is a Jira administrator. */
export async function isJiraAdmin() {
  const res = await asUserApi().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.permissions?.ADMINISTER?.havePermission);
}

const adfParagraphs = (text) => ({
  type: 'doc',
  version: 1,
  content: String(text)
    .split('\n')
    .map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })),
});

export async function addComment(key, text) {
  const res = await asApp().requestJira(route`/rest/api/3/issue/${key}/comment`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: adfParagraphs(text) }),
  });
  return ok(res, `comment on ${key}`);
}

export async function addLabel(key, label) {
  const res = await asApp().requestJira(route`/rest/api/3/issue/${key}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update: { labels: [{ add: label }] } }),
  });
  return ok(res, `label ${key}`);
}

/** Create an action item as the requesting user, so it respects their permissions. */
export async function createIssue({ projectKey, summary, description, issueType = 'Task', labels = [] }) {
  const res = await asUserApi().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary: summary.slice(0, 250),
        description: adfParagraphs(description || ''),
        labels,
      },
    }),
  });
  return ok(res, 'create issue');
}

export async function linkIssues(inwardKey, outwardKey, type = 'Relates') {
  const res = await asUserApi().requestJira(route`/rest/api/3/issueLink`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: { name: type }, inwardIssue: { key: inwardKey }, outwardIssue: { key: outwardKey } }),
  });
  return ok(res, 'link issues');
}

/** Confluence pages labelled "protocol" that mention any of the terms. */
export async function searchProtocols(terms, { limit = 5 } = {}) {
  const text = terms.map((t) => `text ~ "${String(t).replace(/"/g, '')}"`).join(' OR ');
  const cql = `type = page AND label = "protocol"${text ? ` AND (${text})` : ''}`;
  const res = await asUserApi()
    .requestConfluence(route`/wiki/rest/api/content/search?cql=${cql}&limit=${limit}&expand=body.storage,version`);
  const data = await ok(res, 'confluence search');
  return (data.results || []).map((p) => ({
    id: p.id,
    title: p.title,
    url: data._links?.base ? `${data._links.base}${p._links?.webui || ''}` : p._links?.webui,
    body: p.body?.storage?.value || '',
    lastModified: p.version?.when,
  }));
}
