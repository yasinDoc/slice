#!/usr/bin/env node
// Runs the Slice engine on the synthetic seed data, with no Atlassian site needed.
//   npm run demo            → signals and a sample RCA
//   npm run demo -- SAFE-3  → RCA for a specific report
import seed from '../src/demo-data.js';
import { buildRecord, detectSignals, findSimilar, buildRcaDraft, assessProtocols } from '../src/engine/index.js';

const records = seed.reports.map((r, i) =>
  buildRecord({ key: `SAFE-${i + 1}`, summary: r.summary, description: `Date of event: ${r.date}\n${r.description}` })
);
const asOf = '2026-11-20';

console.log(`\n🧀 Slice: ${records.length} synthetic reports, ${records.reduce((n, r) => n + r.redactions, 0)} identifiers redacted\n`);
console.log('SIGNALS');
for (const s of detectSignals(records, { asOf })) {
  console.log(`  ▲ ${s.title}  [${s.keys.join(', ')}]`);
  for (const l of s.slices.filter((x) => x.holes)) {
    console.log(`      ${l.short.padEnd(14)} ${l.holes}/${l.of}  ${l.factors.map((f) => f.label).join(', ')}`);
  }
}

const key = process.argv[2] || 'SAFE-5';
const record = records.find((r) => r.key === key);
const protocols = assessProtocols(
  seed.protocols.filter((p) => /pump|infusion/i.test(p.title + p.body)).map((p) => ({ title: p.title, body: p.body })),
  new Date(asOf)
);
const draft = buildRcaDraft(record, findSimilar(record, records), protocols);
console.log(`\nRCA DRAFT for ${key}\n  ${draft.headline}`);
console.log('  Timeline:');
for (const t of draft.timeline) console.log(`    ${t.date}  ${t.key}  ${t.summary}`);
console.log('  The slice that held:', draft.defencesThatHeld.map((d) => `${d.label} ×${d.count}`).join(', ') || 'none');
console.log('  Stale protocols:', draft.staleProtocols.map((p) => `${p.title} (${p.ageMonths} months)`).join('; ') || 'none');
console.log('  Recommended actions:');
for (const r of draft.recommendations) console.log(`    [${r.strength}] ${r.text}  (addresses: ${r.addresses})`);
console.log();
