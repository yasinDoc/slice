// Product event handlers: index new or edited safety reports and raise signals.
import { indexIssue, isSafetyProject, safetyRecords } from './analysis.js';
import { getSettings, getAlert, saveAlert, deleteRecord } from './store.js';
import { signalsForRecord } from './engine/index.js';
import { addComment, addLabel } from './atlassian.js';

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
  const record = await indexIssue(issue.key);
  if (!record) {
    console.log(`slice trigger: ${issue.key} is a Slice action item; not indexed`);
    return;
  }
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
