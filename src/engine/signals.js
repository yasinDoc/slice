// Finds similar reports and recurring patterns ("signals").
import { compareRecords, SIMILAR_THRESHOLD } from './similarity.js';
import { CATEGORIES, FACTORS, LAYERS } from './lexicon.js';
import { daysBetween } from './text.js';

export const DEFAULTS = { windowDays: 90, minSignalCount: 3, threshold: SIMILAR_THRESHOLD };

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

/** Similar past reports for one record, best first. */
export function findSimilar(record, records, opts = {}) {
  const { windowDays = 365, threshold = DEFAULTS.threshold, limit = 10, exclude = [] } = opts;
  return records
    .filter((r) => r.key !== record.key && !exclude.includes(r.key))
    .filter((r) => daysBetween(r.eventDate, record.eventDate) <= windowDays)
    .map((r) => ({ record: r, ...compareRecords(record, r) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score || String(b.record.eventDate).localeCompare(a.record.eventDate))
    .slice(0, limit);
}

/** Facet combinations that define a signal: what the holes have in common. */
function signalKeys(r) {
  const keys = [];
  if (r.category === 'other') return keys;
  if (r.location) keys.push({ id: `${r.category}|loc:${r.location}`, facets: { category: r.category, location: r.location } });
  if (r.deviceModel) keys.push({ id: `${r.category}|dev:${r.deviceModel}`, facets: { category: r.category, deviceModel: r.deviceModel } });
  if (r.drug) keys.push({ id: `drug:${r.drug}`, facets: { drug: r.drug } });
  return keys;
}

export function describeSignal(facets, count, days) {
  const parts = [];
  if (facets.category) parts.push(catLabel(facets.category).toLowerCase());
  parts.push(facets.drug ? `reports involving ${facets.drug}` : 'reports');
  if (facets.deviceModel) parts.push(`${facets.drug ? 'on' : 'involving'} ${facets.deviceModel}`);
  if (facets.location) parts.push(`in ${facets.location.replace('ward-', 'Ward ').replace(/^icu$/, 'ICU').replace(/^ed$/, 'ED')}`);
  return `${count} ${parts.join(' ')} in ${Math.max(1, Math.round(days))} days`;
}

/** Swiss cheese profile across a set of records: how often each layer had a hole. */
export function sliceProfile(records) {
  return LAYERS.map((layer) => {
    const factorCounts = {};
    let holes = 0;
    for (const r of records) {
      const fs = (r.factors || []).filter((id) => FACTORS.find((f) => f.id === id)?.layer === layer.id);
      if (fs.length) holes++;
      for (const id of fs) factorCounts[id] = (factorCounts[id] || 0) + 1;
    }
    return {
      layer: layer.id,
      label: layer.label,
      short: layer.short,
      holes,
      of: records.length,
      factors: Object.entries(factorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ id, label: FACTORS.find((f) => f.id === id).label, count: n })),
    };
  });
}

/** All current signals across records. */
export function detectSignals(records, opts = {}) {
  const { windowDays = DEFAULTS.windowDays, minSignalCount = DEFAULTS.minSignalCount, asOf } = opts;
  const now = asOf || records.reduce((m, r) => (r.eventDate > m ? r.eventDate : m), '0000-00-00');
  const recent = records.filter((r) => daysBetween(r.eventDate, now) <= windowDays);
  const groups = new Map();
  for (const r of recent) {
    for (const k of signalKeys(r)) {
      if (!groups.has(k.id)) groups.set(k.id, { id: k.id, facets: k.facets, members: [] });
      groups.get(k.id).members.push(r);
    }
  }
  const signals = [...groups.values()]
    .filter((g) => g.members.length >= minSignalCount)
    .map((g) => {
      const dates = g.members.map((m) => m.eventDate).sort();
      const span = daysBetween(dates[0], dates[dates.length - 1]) || 1;
      // Mention a drug or device model when every member shares it.
      const facets = { ...g.facets };
      for (const f of ['drug', 'deviceModel']) {
        const v = g.members[0][f];
        if (!facets[f] && v && g.members.every((m) => m[f] === v)) facets[f] = v;
      }
      return {
        id: g.id,
        facets,
        count: g.members.length,
        firstSeen: dates[0],
        lastSeen: dates[dates.length - 1],
        title: describeSignal(facets, g.members.length, span),
        keys: g.members.map((m) => m.key),
        harmCount: g.members.filter((m) => m.outcome !== 'near-miss').length,
        slices: sliceProfile(g.members),
      };
    })
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));

  // Drop signals whose members are a subset of a stronger signal.
  const kept = [];
  for (const s of signals) {
    const covered = kept.some((k) => s.keys.every((x) => k.keys.includes(x)));
    if (!covered) kept.push(s);
  }
  return kept;
}

/** Signals a particular record belongs to. */
export function signalsForRecord(record, records, opts = {}) {
  return detectSignals(records, opts).filter((s) => s.keys.includes(record.key));
}
