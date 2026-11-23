// Product event handlers: index new or edited safety reports and raise signals.
import { indexIssue, isSafetyProject } from './analysis.js';
import { allRecords, getSettings, getAlert, saveAlert, deleteRecord } from './store.js';
import { signalsForRecord } from './engine/index.js';
import { addComment, addLabel } from './atlassian.js';

const appUrl = (key) => key; // Jira auto-links issue keys in comments.

export async function onIssueEvent(event) {
  const issue = event?.issue;
  if (event?.eventType === 'avi:jira:deleted:issue') {
    if (issue?.key) await deleteRecord(issue.key);
    return;
  }
  const projectKey = issue?.fields?.project?.key || String(issue?.key || '').split('-')[0];
  if (!issue?.key || !(await isSafetyProject(projectKey))) return;

  // Event payloads can omit fields, so fetch the issue fresh.
  const record = await indexIssue(issue.key);
  const settings = await getSettings();
  if (!settings.commentOnSignal) return;

  const records = await allRecords();
  const [signal] = signalsForRecord(record, records, {
    windowDays: settings.windowDays,
    minSignalCount: settings.minSignalCount,
    asOf: new Date().toISOString().slice(0, 10),
  });
  if (!signal) return;

  // Comment once per signal, and again only when it grows.
  const prev = await getAlert(signal.id);
  if (prev && prev.count >= signal.count) return;
  await saveAlert(signal.id, { count: signal.count, at: new Date().toISOString() });

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
      'Open the Slice panel or ask the Slice agent in Rovo to "draft an RCA" for this report. This is a pattern alert for the safety team, not a judgement about any individual.',
    ].join('\n')
  );
  await addLabel(record.key, 'slice-signal').catch((e) => console.warn('label failed', e.message));
}
