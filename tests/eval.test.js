// Measures extraction accuracy on the held-out evaluation set and fails if it drops
// below agreed thresholds. Prints a short report so regressions are easy to see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cases from './eval-set.js';
import { buildRecord } from '../src/engine/index.js';

const results = cases.map((c, i) => {
  const r = buildRecord({ key: `EVAL-${i + 1}`, summary: '', description: c.text });
  const misses = [];
  if (r.category !== c.category) misses.push(`category ${r.category} ≠ ${c.category}`);
  if (c.location && r.location !== c.location) misses.push(`location ${r.location} ≠ ${c.location}`);
  if (r.outcome !== c.outcome) misses.push(`outcome ${r.outcome} ≠ ${c.outcome}`);
  for (const f of c.factors) if (!r.factors.includes(f)) misses.push(`missing factor ${f}`);
  for (const d of c.defences) if (!r.defences.includes(d)) misses.push(`missing defence ${d}`);
  for (const f of c.notFactors || []) if (r.factors.includes(f)) misses.push(`false factor ${f}`);
  for (const d of c.notDefences || []) if (d && r.defences.includes(d)) misses.push(`false defence ${d}`);
  return { i: i + 1, r, c, misses };
});

const rate = (pred) => results.filter(pred).length / results.length;
const metrics = {
  category: rate((x) => x.r.category === x.c.category),
  location: results.filter((x) => x.c.location).length
    ? results.filter((x) => x.c.location && x.r.location === x.c.location).length / results.filter((x) => x.c.location).length
    : 1,
  outcome: rate((x) => x.r.outcome === x.c.outcome),
  factorsAndDefences: rate((x) => !x.misses.some((m) => /factor|defence/.test(m))),
  fullyCorrect: rate((x) => x.misses.length === 0),
};

test('evaluation report', () => {
  const pct = (v) => `${Math.round(v * 100)}%`;
  console.log(`\n  Held-out evaluation (${cases.length} reports)`);
  for (const [k, v] of Object.entries(metrics)) console.log(`    ${k.padEnd(20)} ${pct(v)}`);
  for (const x of results.filter((y) => y.misses.length)) console.log(`    #${x.i}: ${x.misses.join('; ')}`);
});

test('category accuracy ≥ 90%', () => assert.ok(metrics.category >= 0.9, `category ${metrics.category}`));
test('location accuracy ≥ 90%', () => assert.ok(metrics.location >= 0.9, `location ${metrics.location}`));
test('outcome accuracy ≥ 90%', () => assert.ok(metrics.outcome >= 0.9, `outcome ${metrics.outcome}`));
test('factor and defence recall ≥ 85%', () => assert.ok(metrics.factorsAndDefences >= 0.85, `factors ${metrics.factorsAndDefences}`));
test('no negated factor or defence is ever counted', () => {
  const bad = results.filter((x) => x.misses.some((m) => m.startsWith('false')));
  assert.deepEqual(bad.map((x) => `#${x.i}: ${x.misses.join('; ')}`), []);
});
