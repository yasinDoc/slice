// Product event handlers: index new or edited safety reports and raise signals.
import { indexIssue, isSafetyProject, safetyRecords, isActionItem } from './analysis.js';
import { getSettings, getAlert, saveAlert, deleteRecord, getActionItem, getThanked, saveThanked } from './store.js';
import { signalsForRecord, thankYouMessage, isDone } from './engine/index.js';
import { addComment, addLabel, getIssue } from './atlassian.js';

const appUrl = (key) => key; // Jira auto-links issue keys in comments.

export async function onIssueEvent(event) {
  const issue = event?.issue;
  console.log(`slice trigger: ${event?.eventType} ${issue?.key}`);
  if (event?.eventType === 'avi:jira:deleted:issue') {
    if (issue?.key) await deleteRecord(issue.key);
    return;
  }
  const projectKey = issue?.fields?.project?.key || String(issue?.key || '').split('-')[0];
  if (!issue?.key || !(await isSafetyProject(projectKey))) {
    console.log(`slice trigger: skipped ${issue?.key} (project ${projectKey} not a safety project)`);
    return;
  }

  // Event payloads can omit fields, so fetch the issue fresh.
  const full = await getIssue(issue.key);
  if (isActionItem(full)) {
    await deleteRecord(full.key);
    await thankReportersIfDone(full);
    return;
  }
  const record = await indexIssue(full);
  const settings = await getSettings();
  if (!settings.commentOnSignal) return;

  const records = await safetyRecords();
  const [signal] = signalsForRecord(record, records, {
    windowDays: settings.windowDays,
    minSignalCount: settings.minSignalCount,
    asOf: new Date().toISOString().slice(0, 10),
  });
  if (!signal) {
    console.log(`slice trigger: ${record.key} indexed, no signal`);
    return;
  }

  // One comment per report per signal. Tracking keys (not a count) keeps this right
  // when reports are deleted or events are retried.
  const prev = (await getAlert(signal.id)) || {};
  const alerted = Array.isArray(prev.keys) ? prev.keys : [];
  if (alerted.includes(record.key)) {
    console.log(`slice trigger: ${record.key} already alerted for ${signal.id}`);
    return;
  }
  await saveAlert(signal.id, {
    keys: [...alerted.filter((k) => signal.keys.includes(k)), record.key],
    count: signal.count,
    at: new Date().toISOString(),
  });
  console.log(`slice trigger: alerting ${record.key} for ${signal.id} (${signal.count} reports)`);

  const holes = signal.slices
    .filter((l) => l.holes > 0)
    .map((l) => `• ${l.short}: ${l.factors.slice(0, 3).map((f) => f.label).join(', ')}`)
    .join('\n');
  const others = signal.keys.filter((k) => k !== record.key).map(appUrl).join(', ');
  await addComment(
    record.key,
    [
      `🧀 Slice signal: ${signal.title}.`,
      `Related reports: ${others}`,
      'Where the holes are lining up:',
      holes || '• (no contributing factors recorded yet)',
      '',
      'Open the Slice panel on this report for the layers, similar reports and recommended fixes (or ask the Slice agent in Rovo, where available). This is a pattern alert for the safety team, not a judgement about any individual.',
    ].join('\n')
  );
  await addLabel(record.key, 'slice-signal').catch((e) => console.warn('label failed', e.message));
}

/**
 * When a Slice action item is done, thank every report in the pattern it came from.
 * Runs once per action item, and only if the setting is on.
 */
export async function thankReportersIfDone(action) {
  if (!isDone(action)) return;
  const settings = await getSettings();
  if (!settings.thankReporters) return;
  if (await getThanked(action.key)) return;

  // The source report: Slice's own record, or failing that a linked safety report.
  const item = await getActionItem(action.key);
  const linked = (action.fields?.issuelinks || [])
    .map((l) => (l.inwardIssue || l.outwardIssue)?.key)
    .filter(Boolean);
  const records = await safetyRecords();
  const from = item?.from || linked.find((k) => records.some((r) => r.key === k));
  if (!from) return;

  const source = records.find((r) => r.key === from);
  const [signal] = source
    ? signalsForRecord(source, records, {
        windowDays: settings.windowDays,
        minSignalCount: settings.minSignalCount,
        asOf: new Date().toISOString().slice(0, 10),
      })
    : [];
  const targets = signal ? signal.keys : [from];
  const message = thankYouMessage({
    fixText: item?.text || action.fields?.summary || 'a system fix',
    actionKey: action.key,
    signalTitle: signal?.title,
    reportCount: targets.length,
  });
  // Mark first so a retried event cannot post twice.
  await saveThanked(action.key, { targets, at: new Date().toISOString() });
  for (const key of targets) {
    await addComment(key, message).catch((e) => console.warn(`thank-you on ${key} failed`, e.message));
  }
  console.log(`slice trigger: thanked ${targets.length} reports for ${action.key}`);
}
