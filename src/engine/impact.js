// "Did the fix work?" Compares how often a signal's pattern recurred before and after
// the first linked action item was created, over equal-length windows. Pure.
import { daysBetween } from './text.js';

/**
 * @param {Array}  members   records in the signal (with eventDate)
 * @param {string} since     ISO date of the first action
 * @param {string} asOf      ISO date "today"
 * @returns {{ since, days, before, after, verdict }} verdict: 'too-early' | 'fewer' | 'same' | 'more'
 */
export function actionImpact(members, since, asOf) {
  const sinceDay = String(since).slice(0, 10);
  const today = String(asOf).slice(0, 10);
  const days = Math.max(0, Math.round(daysBetween(sinceDay, today)));
  const windowStart = new Date(new Date(`${sinceDay}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
  const after = members.filter((r) => r.eventDate > sinceDay && r.eventDate <= today).length;
  const before = members.filter((r) => r.eventDate >= windowStart && r.eventDate <= sinceDay).length;
  let verdict = 'same';
  if (days < 14) verdict = 'too-early';
  else if (after < before) verdict = 'fewer';
  else if (after > before) verdict = 'more';
  return { since: sinceDay, days, before, after, verdict };
}

export function describeImpact(i) {
  if (i.verdict === 'too-early') return `First action ${i.days} day${i.days === 1 ? '' : 's'} ago: too early to judge (needs 14 days)`;
  const trend = i.verdict === 'fewer' ? 'fewer' : i.verdict === 'more' ? 'more' : 'the same number of';
  return `${i.after} similar report${i.after === 1 ? '' : 's'} in the ${i.days} days since the first action, vs ${i.before} in the ${i.days} days before (${trend})`;
}
