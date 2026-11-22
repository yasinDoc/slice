import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
} from '../src/engine/index.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed-reports.json', import.meta.url), 'utf8'));
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

test('adfToText flattens Atlassian Document Format', () => {
  const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ward 6' }, { type: 'hardBreak' }, { type: 'text', text: 'pump' }] }] };
  assert.equal(adfToText(adf).trim(), 'Ward 6\npump');
});
