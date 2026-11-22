// Drafts a root cause analysis skeleton that Rovo turns into prose.
// The structure is deterministic so every statement can be traced to evidence.
import { FIXES, FACTORS, DEFENCES, CATEGORIES } from './lexicon.js';
import { sliceProfile } from './signals.js';
import { htmlToText } from './text.js';

const STRENGTH_ORDER = { strong: 0, intermediate: 1, weak: 2 };
export const STALE_MONTHS = 24;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Find a "Last reviewed: March 2022" / "Review date: 2022-03-01" line in a protocol. */
export function parseReviewDate(text) {
  const t = htmlToText(text);
  const m = t.match(/\b(?:last reviewed|review(?:ed)? date|date reviewed|reviewed(?: on)?)\s*[:\-]?\s*([^\n]{3,30})/i);
  if (!m) return null;
  const v = m[1].trim();
  let r = v.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (r) return `${r[1]}-${r[2]}-${r[3] || '01'}`;
  r = v.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (r) {
    const idx = MONTHS.indexOf(r[1].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${r[2]}-${String(idx + 1).padStart(2, '0')}-01`;
  }
  r = v.match(/(\d{1,2})\/(\d{4})/);
  if (r) return `${r[2]}-${r[1].padStart(2, '0')}-01`;
  return null;
}

export function monthsSince(date, asOf = new Date()) {
  const d = new Date(date);
  const now = new Date(asOf);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

/** Annotate protocol search results with staleness. */
export function assessProtocols(pages, asOf = new Date()) {
  return pages.map((p) => {
    const reviewed = parseReviewDate(p.body || '') || (p.lastModified ? String(p.lastModified).slice(0, 10) : null);
    const age = reviewed ? monthsSince(reviewed, asOf) : null;
    return {
      title: p.title,
      url: p.url,
      reviewed,
      ageMonths: age,
      stale: age == null ? null : age > STALE_MONTHS,
    };
  });
}

/** Protocol search terms for a record. */
export function protocolTerms(record) {
  const terms = [];
  if (record.device) terms.push(record.device);
  if (record.drug) terms.push(record.drug);
  const cat = CATEGORIES.find((c) => c.id === record.category);
  if (cat) terms.push(cat.keywords[0]);
  return [...new Set(terms)].slice(0, 3);
}

/** Ranked system-level recommendations for the factors in a cluster. */
export function recommend(profile) {
  const seen = new Set();
  const recs = [];
  for (const layer of profile) {
    for (const f of layer.factors) {
      for (const fix of FIXES[f.id] || []) {
        if (seen.has(fix.text)) continue;
        seen.add(fix.text);
        recs.push({ ...fix, addresses: f.label, layer: layer.short, frequency: f.count });
      }
    }
  }
  return recs.sort(
    (a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.frequency - a.frequency
  );
}

/**
 * @param {object} record     the report under investigation
 * @param {Array}  similar    output of findSimilar()
 * @param {Array}  protocols  output of assessProtocols()
 */
export function buildRcaDraft(record, similar = [], protocols = []) {
  const cluster = [record, ...similar.map((s) => s.record)];
  const profile = sliceProfile(cluster);
  const defenceCounts = {};
  for (const r of cluster) for (const d of r.defences || []) defenceCounts[d] = (defenceCounts[d] || 0) + 1;

  const timeline = cluster
    .map((r) => ({ key: r.key, date: r.eventDate, summary: r.summary, outcome: r.outcome, shift: r.shift }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const layersWithHoles = profile.filter((p) => p.holes > 0);
  return {
    issueKey: record.key,
    headline:
      similar.length > 0
        ? `${record.key} is one of ${cluster.length} similar reports. Holes lined up in ${layersWithHoles.length} of 4 layers.`
        : `${record.key} has no close matches yet. Treat it as a first report and watch for recurrence.`,
    category: CATEGORIES.find((c) => c.id === record.category)?.label || 'Other',
    timeline,
    slices: profile,
    defencesThatHeld: Object.entries(defenceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({ label: DEFENCES.find((d) => d.id === id)?.label || id, count: n })),
    recommendations: recommend(profile).slice(0, 6),
    protocols,
    staleProtocols: protocols.filter((p) => p.stale),
    reminders: [
      'Look for system causes. Do not attribute blame to individuals.',
      'This is a draft for a human safety lead to review and approve.',
      'Not clinical advice; it supports quality improvement only.',
    ],
  };
}

export { FACTORS };
