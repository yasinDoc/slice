import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/demo-data.js';
import {
  redact,
  buildRecord,
  compareRecords,
  findSimilar,
  detectSignals,
  signalsForRecord,
  sliceProfile,
  buildRcaDraft,
  assessProtocols,
  parseReviewDate,
  adfToText,
  detectDevice,
  summarize,
  weekStart,
  buildSignalBrief,
  actionImpact,
  describeImpact,
} from '../src/engine/index.js';

const records = seed.reports.map((r, i) =>
  buildRecord({
    key: `SAFE-${i + 1}`,
    summary: r.summary,
    description: `Date of event: ${r.date}\n${r.description}`,
  })
);
const byKey = Object.fromEntries(records.map((r) => [r.key, r]));

test('redaction removes patient identifiers', () => {
  const { text, redactions } = redact(
    'Patient Mrs Rahman, MRN 4471-2290, bed 12, DOB 03/04/1950, call 01711 234567, email a.b@x.org. patient John Smith fell.'
  );
  assert.ok(!/Rahman|4471|1950|234567|a\.b@x|John Smith/.test(text), text);
  assert.ok(redactions >= 6);
  assert.match(text, /\[NAME\]/);
});

test('records never contain unredacted identifiers', () => {
  const r = byKey['SAFE-1'];
  assert.ok(!/Rahman|4471-2290|bed 12/.test(JSON.stringify(r)));
  assert.ok(r.redactions >= 3);
});

test('extracts facets from a pump report', () => {
  const r = byKey['SAFE-1'];
  assert.equal(r.category, 'infusion');
  assert.equal(r.location, 'ward-6');
  assert.equal(r.deviceModel, 'VitaFlow 300');
  assert.equal(r.drug, 'heparin');
  assert.equal(r.shift, 'night');
  assert.equal(r.outcome, 'near-miss');
  assert.equal(r.eventDate, '2026-09-02');
  assert.ok(r.factors.includes('interruption'));
  assert.ok(r.factors.includes('device-ux'));
  assert.ok(r.defences.includes('double-check'));
});

test('device model detection ignores wards, drugs and units', () => {
  assert.equal(detectDevice('Ward 12 pump issue with potassium 10 mmol').deviceModel, null);
  assert.equal(detectDevice('the CareSense M2 monitor froze').deviceModel, 'CareSense M2');
});

test('falls report detects harm and alarm hole', () => {
  const r = byKey['SAFE-14'];
  assert.equal(r.category, 'falls');
  assert.equal(r.location, 'ward-3');
  assert.equal(r.outcome, 'harm');
  assert.ok(r.factors.includes('alarm-off'));
});

test('pump reports are similar, unrelated reports are not', () => {
  const a = compareRecords(byKey['SAFE-1'], byKey['SAFE-3']);
  assert.ok(a.score >= 0.45, JSON.stringify(a));
  assert.ok(a.reasons.some((x) => x.includes('VitaFlow 300')));
  const b = compareRecords(byKey['SAFE-1'], byKey['SAFE-22']);
  assert.ok(b.score < 0.45, JSON.stringify(b));
});

test('findSimilar returns the pump cluster for the newest pump report', () => {
  const sims = findSimilar(byKey['SAFE-5'], records);
  const keys = sims.map((s) => s.record.key);
  for (const k of ['SAFE-1', 'SAFE-2', 'SAFE-3', 'SAFE-4']) assert.ok(keys.includes(k), `${k} missing: ${keys}`);
  assert.ok(!keys.includes('SAFE-10'));
});

test('detects the four planted clusters as signals', () => {
  const signals = detectSignals(records, { asOf: '2026-11-20' });
  const titles = signals.map((s) => s.title).join('\n');
  const has = (pred, label) => assert.ok(signals.some(pred), `${label} missing:\n${titles}`);
  has((s) => s.facets.deviceModel === 'VitaFlow 300' || (s.facets.category === 'infusion' && s.facets.location === 'ward-6'), 'pump');
  has((s) => /potassium/.test(s.facets.drug || ''), 'potassium');
  has((s) => s.facets.category === 'specimen', 'specimen');
  has((s) => s.facets.category === 'falls' && s.facets.location === 'ward-3', 'falls');
});

test('signalsForRecord links a record to its signal', () => {
  const sigs = signalsForRecord(byKey['SAFE-13'], records, { asOf: '2026-11-20' });
  assert.ok(sigs.length >= 1);
  assert.ok(sigs[0].keys.includes('SAFE-10'));
});

test('slice profile shows holes lining up across layers', () => {
  const pump = ['SAFE-1', 'SAFE-2', 'SAFE-3', 'SAFE-4', 'SAFE-5'].map((k) => byKey[k]);
  const p = sliceProfile(pump);
  const holes = Object.fromEntries(p.map((l) => [l.layer, l.holes]));
  assert.ok(holes.preconditions >= 4, JSON.stringify(holes));
  assert.ok(holes.organisation >= 2, JSON.stringify(holes));
  assert.ok(holes.acts >= 2, JSON.stringify(holes));
});

test('protocol review dates parse and flag stale protocols', () => {
  assert.equal(parseReviewDate('<p>Last reviewed: March 2022</p>'), '2022-03-01');
  assert.equal(parseReviewDate('Review date: 2021-11-01'), '2021-11-01');
  assert.equal(parseReviewDate('reviewed 04/2024'), '2024-04-01');
  const assessed = assessProtocols(seed.protocols.map((p) => ({ title: p.title, body: p.body })), new Date('2026-11-20'));
  assert.equal(assessed[0].stale, true);
  assert.equal(assessed[1].stale, false);
});

test('RCA draft ranks strong fixes first and keeps reminders', () => {
  const sims = findSimilar(byKey['SAFE-5'], records);
  const draft = buildRcaDraft(byKey['SAFE-5'], sims, []);
  assert.match(draft.headline, /similar reports/);
  assert.equal(draft.recommendations[0].strength, 'strong');
  assert.ok(draft.timeline.length >= 5);
  assert.ok(draft.defencesThatHeld.length >= 1);
  assert.ok(draft.reminders.some((r) => /blame/i.test(r)));
});

test('dashboard summary counts signals, layers, factors and weeks', () => {
  const s = summarize(records, { asOf: '2026-11-20', windowDays: 90, weeks: 12 });
  assert.equal(s.totals.reports, records.length);
  assert.equal(s.totals.signals, 4);
  assert.ok(s.totals.reachedPatient >= 2);
  assert.equal(s.layers.length, 4);
  assert.ok(s.layers.find((l) => l.layer === 'Unsafe acts').holes > 10);
  assert.ok(s.topFactors.length > 3 && s.topFactors[0].count >= s.topFactors[1].count);
  assert.equal(s.weekly.length, 24);
  assert.equal(s.weekly.reduce((n, w) => n + w.count, 0), records.length);
  assert.equal(s.latest[0].date, '2026-11-19');
  assert.ok(s.signals[0].layers.length === 4);
});

test('signal brief has every section, escapes text and links reports', () => {
  const [pump] = detectSignals(records, { asOf: '2026-11-20' });
  const protocols = assessProtocols(seed.protocols.slice(0, 1).map((p) => ({ title: p.title, body: p.body, url: 'https://x/wiki/p/1' })), new Date('2026-11-20'));
  const evil = { ...records[0], summary: '<script>alert(1)</script> & co' };
  const brief = buildSignalBrief(pump, [evil, ...records.slice(1)], { asOf: '2026-11-20', protocols, baseUrl: 'https://site.atlassian.net' });
  assert.match(brief.title, /^Safety signal brief: .*VitaFlow 300.*\(2026-11-20\)$/);
  for (const h of ['Where the holes lined up', 'The slices that held', 'Recommended system fixes', 'Related protocols', 'Timeline of reports', 'Decisions for the safety committee']) {
    assert.ok(brief.body.includes(h), h);
  }
  assert.ok(!brief.body.includes('<script>'), 'summary must be escaped');
  assert.ok(brief.body.includes('&lt;script&gt;'));
  assert.ok(brief.body.includes('https://site.atlassian.net/browse/SAFE-1'));
  assert.ok(brief.body.includes('stale · 56 months'));
  assert.equal(brief.reports, 5);
  assert.ok(brief.body.indexOf('>strong<') < brief.body.indexOf('>intermediate<'));
});

test('action impact compares equal windows before and after the first action', () => {
  const pump = ['SAFE-1', 'SAFE-2', 'SAFE-3', 'SAFE-4', 'SAFE-5'].map((k) => byKey[k]); // Sep 2, Sep 27, Oct 14, Nov 3, Nov 19
  const i = actionImpact(pump, '2026-10-15', '2026-11-20');
  assert.equal(i.days, 36);
  assert.equal(i.after, 2); // Nov 3, Nov 19
  assert.equal(i.before, 2); // Sep 27, Oct 14 (window from Sep 9)
  assert.equal(i.verdict, 'same');
  assert.equal(actionImpact(pump, '2026-11-15', '2026-11-20').verdict, 'too-early');
  assert.equal(actionImpact(pump, '2026-10-01', '2026-12-31').verdict, 'more');
  assert.equal(actionImpact(pump, '2026-11-20', '2027-01-30').verdict, 'fewer');
  assert.match(describeImpact(i), /2 similar reports in the 36 days since the first action, vs 2/);
});

test('weekStart returns the Monday of the week', () => {
  assert.equal(weekStart('2026-11-19'), '2026-11-16');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
});

test('adfToText flattens Atlassian Document Format', () => {
  const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ward 6' }, { type: 'hardBreak' }, { type: 'text', text: 'pump' }] }] };
  assert.equal(adfToText(adf).trim(), 'Ward 6\npump');
});
