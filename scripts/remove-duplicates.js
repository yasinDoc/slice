#!/usr/bin/env node
// Deletes seeded demo reports that are exact duplicates of an earlier seeded report
// (same summary, label "slice-demo"). Keeps the oldest copy of each.
//
//   npm run dedupe            → dry run: lists what would be deleted
//   npm run dedupe -- --yes   → deletes them (permanent; Jira has no trash)
//
// Uses the same JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN / SLICE_PROJECT as seed.js.
const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, SLICE_PROJECT = 'SAFE' } = process.env;
if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN first (same as for npm run seed).');
  process.exit(1);
}
const base = JIRA_BASE_URL.replace(/\/$/, '');
const headers = {
  Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
const confirm = process.argv.includes('--yes');

const issues = [];
let nextPageToken;
do {
  const res = await fetch(`${base}/rest/api/3/search/jql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jql: `project = ${SLICE_PROJECT} AND labels = slice-demo ORDER BY key ASC`,
      fields: ['summary', 'created'],
      maxResults: 100,
      nextPageToken,
    }),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status} ${await res.text()}`);
  const page = await res.json();
  issues.push(...page.issues);
  nextPageToken = page.nextPageToken;
} while (nextPageToken);

// Oldest issue (lowest number) per summary is kept.
const num = (k) => Number(k.split('-')[1]);
issues.sort((a, b) => num(a.key) - num(b.key));
const seen = new Map();
const dupes = [];
for (const i of issues) {
  const s = i.fields.summary.trim();
  if (seen.has(s)) dupes.push({ key: i.key, of: seen.get(s), summary: s });
  else seen.set(s, i.key);
}

console.log(`${issues.length} demo reports, ${dupes.length} duplicates.`);
for (const d of dupes) console.log(`  ${d.key}  duplicate of ${d.of}  ${d.summary}`);
if (!dupes.length) process.exit(0);
if (!confirm) {
  console.log('\nDry run. Re-run with  npm run dedupe -- --yes  to delete these permanently.');
  process.exit(0);
}
for (const d of dupes) {
  const res = await fetch(`${base}/rest/api/3/issue/${d.key}`, { method: 'DELETE', headers });
  console.log(`  ${res.ok ? 'deleted' : `FAILED ${res.status}`}  ${d.key}`);
}
console.log('Done. In the Slice panel, click "Index all past reports" to refresh signals.');
