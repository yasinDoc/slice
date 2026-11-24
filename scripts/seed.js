#!/usr/bin/env node
// Loads synthetic near-miss reports into Jira and protocol pages into Confluence.
//
//   JIRA_BASE_URL=https://your-site.atlassian.net \
//   JIRA_EMAIL=you@example.com JIRA_API_TOKEN=... \
//   SLICE_PROJECT=SAFE SLICE_SPACE=SAFE npm run seed
//
// Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens.
// Use a development site only: this data is fictional.
import seed from '../src/demo-data.js';

const {
  JIRA_BASE_URL,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  SLICE_PROJECT = 'SAFE',
  SLICE_SPACE,
  SLICE_ISSUE_TYPE = 'Task',
} = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN (see the header of scripts/seed.js).');
  process.exit(1);
}

const base = JIRA_BASE_URL.replace(/\/$/, '');
const auth = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`;
const only = process.argv.includes('--protocols-only') ? 'protocols' : process.argv.includes('--reports-only') ? 'reports' : null;

async function call(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// Check the credentials first, so a bad token gives a clear message instead of
// Jira's "project does not exist or you do not have permission".
if (/PASTE|YOUR|xxxx/i.test(JIRA_API_TOKEN)) {
  console.error('JIRA_API_TOKEN still holds a placeholder. Paste your real API token from https://id.atlassian.com/manage-profile/security/api-tokens');
  process.exit(1);
}
const me = await fetch(`${base}/rest/api/3/myself`, { headers: { Authorization: auth, Accept: 'application/json' } });
if (!me.ok) {
  console.error(`Login failed (${me.status}). Check JIRA_EMAIL and JIRA_API_TOKEN.`);
  process.exit(1);
}
console.log(`Signed in as ${(await me.json()).displayName}.`);

const adf = (text) => ({
  type: 'doc',
  version: 1,
  content: text.split('\n').map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })),
});

if (only !== 'protocols') {
  console.log(`Creating ${seed.reports.length} reports in ${SLICE_PROJECT}…`);
  for (const r of seed.reports) {
    const issue = await call('/rest/api/3/issue', {
      fields: {
        project: { key: SLICE_PROJECT },
        issuetype: { name: SLICE_ISSUE_TYPE },
        summary: r.summary,
        description: adf(`Date of event: ${r.date}\n${r.description}`),
        labels: ['near-miss', 'slice-demo'],
      },
    });
    console.log(`  ${issue.key}  ${r.summary}`);
  }
}

if (only !== 'reports' && SLICE_SPACE) {
  console.log(`Creating ${seed.protocols.length} protocol pages in space ${SLICE_SPACE}…`);
  for (const p of seed.protocols) {
    const page = await call('/wiki/rest/api/content', {
      type: 'page',
      title: p.title,
      space: { key: SLICE_SPACE },
      body: { storage: { value: p.body, representation: 'storage' } },
      metadata: { labels: [{ prefix: 'global', name: p.label }] },
    });
    console.log(`  ${page.id}  ${p.title}`);
  }
} else if (only !== 'reports') {
  console.log('Skipping protocol pages (set SLICE_SPACE to create them).');
}

console.log('Done. Open any report and click "Index all past reports" in the Slice panel.');
