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
} from './engine/index.js';
import { getIssue, searchIssues, searchProtocols, visibleKeys } from './atlassian.js';
import { saveRecord, getRecord, deleteRecord, allRecords, getSettings, getFeedback } from './store.js';

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

/** Index one issue (fetching it if needed). Returns the stored record. */
export async function indexIssue(keyOrIssue) {
  const issue = typeof keyOrIssue === 'string' ? await getIssue(keyOrIssue) : keyOrIssue;
  const record = recordFromIssue(issue);
  await saveRecord(record);
  return record;
}

/** Backfill every issue in the safety projects and drop records for deleted issues. */
export async function reindexAll() {
  const { projectKeys } = await getSettings();
  const issues = await searchIssues(`project in (${projectKeys.join(',')}) ORDER BY created ASC`, { max: 1000 });
  for (const issue of issues) await saveRecord(recordFromIssue(issue));
  const live = new Set(issues.map((i) => i.key));
  const stale = (await allRecords()).filter((r) => projectKeys.includes(r.projectKey) && !live.has(r.key));
  for (const r of stale) await deleteRecord(r.key);
  return issues.length;
}

export async function ensureRecord(key) {
  return (await getRecord(key)) || indexIssue(key);
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
  return {
    configured: true,
    projectKey,
    ...summarize(records, {
      asOf: new Date().toISOString().slice(0, 10),
      windowDays: settings.windowDays,
      minSignalCount: settings.minSignalCount,
    }),
  };
}
