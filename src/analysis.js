// Glue between Atlassian data, storage and the pure engine.
import {
  buildRecord,
  adfToText,
  findSimilar,
  detectSignals,
  signalsForRecord,
  sliceProfile,
  assessProtocols,
  protocolTerms,
  buildRcaDraft,
  DEFENCES,
  summarize,
  recommend,
  buildSignalBrief,
  actionImpact,
  describeImpact,
} from './engine/index.js';
import { getIssue, searchIssues, searchProtocols, visibleKeys, siteUrl } from './atlassian.js';
import { publishPage } from './demo.js';
import { saveRecord, getRecord, deleteRecord, allRecords, getSettings, getFeedback, allActionItems } from './store.js';

export function recordFromIssue(issue) {
  return buildRecord({
    key: issue.key,
    summary: issue.fields?.summary,
    description: adfToText(issue.fields?.description),
    created: issue.fields?.created,
    projectKey: issue.fields?.project?.key,
  });
}

export async function isSafetyProject(projectKey) {
  const { projectKeys } = await getSettings();
  return projectKeys.includes(projectKey);
}

/** Slice's own action items live in the same project but are not safety reports. */
export const ACTION_LABEL = 'slice-action';
export const isActionItem = (issue) => (issue?.fields?.labels || []).includes(ACTION_LABEL);

/**
 * Index one issue (fetching it if needed). Returns the stored record, or null for
 * Slice action items, which are never treated as reports.
 */
export async function indexIssue(keyOrIssue) {
  const issue = typeof keyOrIssue === 'string' ? await getIssue(keyOrIssue) : keyOrIssue;
  if (isActionItem(issue)) {
    await deleteRecord(issue.key);
    return null;
  }
  const record = recordFromIssue(issue);
  await saveRecord(record);
  return record;
}

/** Backfill every issue in the safety projects and drop records for deleted issues. */
export async function reindexAll() {
  const { projectKeys } = await getSettings();
  const issues = await searchIssues(`project in (${projectKeys.join(',')}) ORDER BY created ASC`, { max: 1000 });
  const reports = issues.filter((i) => !isActionItem(i));
  for (const issue of reports) await saveRecord(recordFromIssue(issue));
  const live = new Set(reports.map((i) => i.key));
  const stale = (await allRecords()).filter((r) => projectKeys.includes(r.projectKey) && !live.has(r.key));
  for (const r of stale) await deleteRecord(r.key);
  return reports.length;
}

export async function ensureRecord(key) {
  const record = (await getRecord(key)) || (await indexIssue(key));
  if (!record) throw new Error(`${key} is a Slice action item, not a safety report.`);
  return record;
}

/** Records the current user can see. Keeps results permission-aware. */
async function filterVisible(records) {
  if (!records.length) return records;
  const allowed = await visibleKeys(records.map((r) => r.key));
  return records.filter((r) => allowed.has(r.key));
}

const brief = (r) => ({
  key: r.key,
  date: r.eventDate,
  summary: r.summary,
  category: r.category,
  location: r.location,
  device: r.deviceModel || r.device,
  drug: r.drug,
  shift: r.shift,
  outcome: r.outcome,
});

export async function similarFor(key, { limit = 8, checkVisibility = true } = {}) {
  const record = await ensureRecord(key);
  const [records, feedback] = await Promise.all([allRecords(), getFeedback(key)]);
  let matches = findSimilar(record, records, { limit: limit * 2, exclude: feedback.notRelated });
  if (checkVisibility) {
    const visible = new Set((await filterVisible(matches.map((m) => m.record))).map((r) => r.key));
    matches = matches.filter((m) => visible.has(m.record.key));
  }
  return { record, matches: matches.slice(0, limit), records };
}

export async function signals({ location, category, days } = {}) {
  const settings = await getSettings();
  const records = await allRecords();
  const today = new Date().toISOString().slice(0, 10);
  let list = detectSignals(records, {
    windowDays: days || settings.windowDays,
    minSignalCount: settings.minSignalCount,
    asOf: today,
  });
  if (location) list = list.filter((s) => (s.facets.location || '').includes(String(location).toLowerCase().replace(/\s+/g, '-')));
  if (category) list = list.filter((s) => s.facets.category === category);
  return list;
}

export async function protocolsFor(record) {
  try {
    return assessProtocols(await searchProtocols(protocolTerms(record)));
  } catch (e) {
    console.warn('protocol search failed', e.message);
    return [];
  }
}

/** Everything the issue panel needs in one call. */
export async function panelData(key) {
  const { record, matches, records } = await similarFor(key, { limit: 6 });
  const settings = await getSettings();
  const sigs = signalsForRecord(record, records, {
    windowDays: settings.windowDays,
    minSignalCount: settings.minSignalCount,
    asOf: new Date().toISOString().slice(0, 10),
  });
  const protocols = await protocolsFor(record);
  const clusterSlices = sliceProfile([record, ...matches.map((m) => m.record)]);
  return {
    recommendations: recommend(clusterSlices).slice(0, 4),
    // Fixes that already have an action item from this report (text -> issue key),
    // so the panel shows "Created SAFE-70" instead of offering a duplicate.
    existingActions: await existingActionsFor(key, recommend(clusterSlices).slice(0, 4)),
    record: {
      ...brief(record),
      factors: record.factors,
      defences: record.defences.map((id) => DEFENCES.find((d) => d.id === id)?.label || id),
      redactions: record.redactions,
    },
    similar: matches.map((m) => ({ ...brief(m.record), score: m.score, reasons: m.reasons })),
    signal: sigs[0] ? { title: sigs[0].title, count: sigs[0].count, keys: sigs[0].keys, harmCount: sigs[0].harmCount } : null,
    slices: clusterSlices,
    ownSlices: sliceProfile([record]),
    protocols,
  };
}

export async function rcaDraft(key) {
  const { record, matches } = await similarFor(key, { limit: 10 });
  const protocols = await protocolsFor(record);
  return buildRcaDraft(record, matches, protocols);
}

export { brief };

/** Project-level overview for the Slice dashboard page (permission-aware). */
export async function dashboardData(projectKey) {
  const settings = await getSettings();
  const configured = settings.projectKeys.includes(projectKey);
  if (!configured) return { configured: false, projectKey, projectKeys: settings.projectKeys };
  const all = (await allRecords()).filter((r) => r.projectKey === projectKey);
  const allowed = await visibleKeys(all.map((r) => r.key));
  const records = all.filter((r) => allowed.has(r.key));
  const asOf = new Date().toISOString().slice(0, 10);
  const summary = summarize(records, { asOf, windowDays: settings.windowDays, minSignalCount: settings.minSignalCount });
  // Close the loop: action items created from reports in each signal, their status,
  // and whether the pattern recurred less after the first one.
  const items = (await allActionItems()).filter((a) => String(a.from).startsWith(`${projectKey}-`));
  const statuses = await actionStatuses(projectKey, items);
  for (const s of summary.signals) {
    const mine = items.filter((a) => s.keys.includes(a.from) && statuses.has(a.key));
    s.actions = mine.map((a) => ({ ...a, status: statuses.get(a.key).name, done: statuses.get(a.key).done }));
    if (mine.length) {
      const since = mine.map((a) => a.createdAt).sort()[0];
      const impact = actionImpact(records.filter((r) => s.keys.includes(r.key)), since, asOf);
      s.impact = { ...impact, text: describeImpact(impact) };
    }
  }
  return { configured: true, projectKey, ...summary };
}

/** Publish a Confluence brief for one signal in a project. */
export async function publishSignalBrief(projectKey, signalId) {
  const settings = await getSettings();
  const all = (await allRecords()).filter((r) => r.projectKey === projectKey);
  const allowed = await visibleKeys(all.map((r) => r.key));
  const records = all.filter((r) => allowed.has(r.key));
  const asOf = new Date().toISOString().slice(0, 10);
  const signal = detectSignals(records, { asOf, windowDays: settings.windowDays, minSignalCount: settings.minSignalCount }).find(
    (s) => s.id === signalId
  );
  if (!signal) throw new Error('That signal is no longer active. Refresh the dashboard.');
  const members = records.filter((r) => signal.keys.includes(r.key));
  const protocols = await protocolsFor(members[members.length - 1]);
  const baseUrl = await siteUrl();
  const brief = buildSignalBrief(signal, members, { asOf, protocols, baseUrl });
  const page = await publishPage(brief.title, brief.body);
  return { ...page, title: brief.title };
}

/** Current Jira status of Slice-created action items the user can see (key -> {name, done}). */
async function actionStatuses(projectKey, items) {
  const map = new Map();
  if (!items.length) return map;
  const issues = await searchIssues(`project in (${projectKey}) AND labels = slice-action`, {
    asUser: true,
    fields: ['status'],
    max: 500,
  });
  for (const i of issues) {
    map.set(i.key, { name: i.fields?.status?.name || 'Unknown', done: i.fields?.status?.statusCategory?.key === 'done' });
  }
  return map;
}

/**
 * Fixes from this report that already have an action item (fix text -> issue key).
 * Uses Slice's own records, plus linked `slice-action` issues in Jira so the answer
 * survives a storage reset (e.g. reinstalling the app).
 */
async function existingActionsFor(key, recommendations) {
  const out = Object.fromEntries((await allActionItems()).filter((a) => a.from === key).map((a) => [a.text, a.key]));
  try {
    const linked = await searchIssues(`issue in linkedIssues("${key}") AND labels = slice-action`, {
      asUser: true,
      fields: ['summary'],
      max: 50,
    });
    for (const i of linked) {
      const summary = String(i.fields?.summary || '').replace(/…$/, '');
      const fix = recommendations.find((r) => r.text === summary || r.text.startsWith(summary));
      if (fix && !out[fix.text]) out[fix.text] = i.key;
    }
  } catch (e) {
    console.warn('linked action lookup failed', e.message);
  }
  return out;
}
