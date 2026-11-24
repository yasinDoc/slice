// Project-level safety overview: everything the dashboard page shows, computed
// from stored (redacted) records. Pure and unit-tested.
import { CATEGORIES, DEFENCES, LAYERS } from './lexicon.js';
import { detectSignals, sliceProfile } from './signals.js';
import { daysBetween } from './text.js';

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || 'Other';
const defLabel = (id) => DEFENCES.find((d) => d.id === id)?.label || id;

/** Monday (UTC) of the week containing an ISO date, as YYYY-MM-DD. */
export function weekStart(date) {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const countBy = (items, fn) => {
  const m = new Map();
  for (const x of items) {
    const k = fn(x);
    if (k == null) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * @param {Array} records  stored report records for one project
 * @param {{asOf?: string, windowDays?: number, minSignalCount?: number, weeks?: number}} opts
 */
export function summarize(records, opts = {}) {
  const asOf = opts.asOf || new Date().toISOString().slice(0, 10);
  const windowDays = opts.windowDays || 90;
  const weeks = opts.weeks || 12;
  const recent = records.filter((r) => daysBetween(r.eventDate, asOf) <= windowDays);

  const signals = detectSignals(records, { asOf, windowDays, minSignalCount: opts.minSignalCount || 3 });
  const profile = sliceProfile(recent);

  // Weekly reports, split by whether harm reached the patient.
  const firstWeek = weekStart(new Date(new Date(`${asOf}T00:00:00Z`).getTime() - (weeks - 1) * 7 * 86400000).toISOString());
  const weekKeys = [];
  for (let i = 0; i < weeks; i++) {
    weekKeys.push(new Date(new Date(`${firstWeek}T00:00:00Z`).getTime() + i * 7 * 86400000).toISOString().slice(0, 10));
  }
  const weekly = [];
  for (const w of weekKeys) {
    const inWeek = records.filter((r) => weekStart(r.eventDate) === w);
    const label = w.slice(5); // MM-DD
    weekly.push({ week: label, type: 'Near-miss', count: inWeek.filter((r) => r.outcome === 'near-miss').length });
    weekly.push({ week: label, type: 'Reached patient', count: inWeek.filter((r) => r.outcome !== 'near-miss').length });
  }

  const factorTotals = new Map();
  for (const layer of profile) for (const f of layer.factors) factorTotals.set(f.label, (factorTotals.get(f.label) || 0) + f.count);

  return {
    asOf,
    windowDays,
    totals: {
      reports: recent.length,
      allTime: records.length,
      nearMiss: recent.filter((r) => r.outcome === 'near-miss').length,
      reachedPatient: recent.filter((r) => r.outcome !== 'near-miss').length,
      signals: signals.length,
      redactions: records.reduce((n, r) => n + (r.redactions || 0), 0),
    },
    signals: signals.map((s) => ({
      id: s.id,
      title: s.title,
      count: s.count,
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
      harmCount: s.harmCount,
      keys: s.keys,
      layers: s.slices.map((l) => ({ layer: l.short, holes: l.holes, of: l.of, top: l.factors[0]?.label || null })),
    })),
    layers: LAYERS.map((l) => {
      const p = profile.find((x) => x.layer === l.id);
      return { layer: l.short, holes: p.holes, of: p.of, share: p.of ? Math.round((p.holes / p.of) * 100) : 0 };
    }),
    topFactors: [...factorTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([factor, count]) => ({ factor, count })),
    categories: countBy(recent, (r) => catLabel(r.category)).map(([category, count]) => ({ category, count })),
    locations: countBy(recent, (r) => r.location).slice(0, 6).map(([location, count]) => ({ location, count })),
    defences: countBy(recent.flatMap((r) => r.defences || []), (d) => defLabel(d)).map(([defence, count]) => ({ defence, count })),
    weekly,
    latest: [...records]
      .sort((a, b) => String(b.eventDate).localeCompare(a.eventDate) || String(b.key).localeCompare(a.key))
      .slice(0, 8)
      .map((r) => ({ key: r.key, date: r.eventDate, summary: r.summary, category: catLabel(r.category), outcome: r.outcome, location: r.location })),
  };
}
