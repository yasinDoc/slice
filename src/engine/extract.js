// Turns a (redacted) near-miss report into structured facets.
import { CATEGORIES, LOCATIONS, DEVICES, DRUGS, FACTORS, DEFENCES } from './lexicon.js';
import { redact } from './redact.js';
import { topTokens } from './text.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const wordRe = (phrase) => new RegExp(`(?<![a-z0-9])${esc(phrase)}(?![a-z0-9])`, 'gi');

function count(text, phrase) {
  return (text.match(wordRe(phrase)) || []).length;
}

export function detectCategory(text) {
  let best = null;
  let bestScore = 0;
  for (const c of CATEGORIES) {
    // Multi-word keywords are more specific, so they count double.
    const score = c.keywords.reduce((s, k) => s + count(text, k) * (k.includes(' ') ? 2 : 1), 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best ? best.id : 'other';
}

export function detectLocation(text) {
  const ward = text.match(/\bward\s*([0-9]{1,2}[A-Z]?|[A-Z])\b/i);
  if (ward) return `ward-${ward[1].toLowerCase()}`;
  const bay = text.match(/\b([A-Z][a-z]+) ward\b/);
  if (bay && !/^(the|a|this|same|another|other)$/i.test(bay[1])) return `ward-${bay[1].toLowerCase()}`;
  for (const l of LOCATIONS) if (l.re.test(text)) return l.id;
  return null;
}

const NOT_MODELS = /^(ward|bed|room|bay|level|floor|theatre|or|shift|step|day|week|page|version|mg|ml|units?|mmol|at|on|in|by|of|to|from|since|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|november|december|january|february|march|april|june|july|august|september|october)$/i;

export function detectDevice(text) {
  const lower = text.toLowerCase();
  const device = DEVICES.find((d) => count(lower, d) > 0) || null;
  // Model names like "VitaFlow 300" or "CareSense M2"
  let deviceModel = null;
  const re = /\b([A-Z][A-Za-z]{2,}(?:[A-Z][a-z]+)?)[ -]?([A-Z]?\d{1,4}[A-Z]?)\b/g;
  let m;
  while ((m = re.exec(text))) {
    if (NOT_MODELS.test(m[1]) || DRUGS.includes(m[1].toLowerCase())) continue;
    if (/^(icu|itu|nicu|ed|bay|step|stage|grade|level|band|type|number|no)$/i.test(m[1])) continue;
    if (!/\d/.test(m[2]) || (/^\d$/.test(m[2]) && !/[A-Z]/.test(m[1].slice(1)))) continue;
    // Without a device word nearby, only accept CamelCase product names ("VitaFlow 300").
    if (!device && !/[a-z][A-Z]/.test(m[1])) continue;
    deviceModel = `${m[1]} ${m[2]}`;
    break;
  }
  return { device, deviceModel };
}

export function detectDrug(text) {
  const lower = text.toLowerCase();
  return DRUGS.find((d) => count(lower, d) > 0) || null;
}

export function detectShift(text) {
  if (/\b(?:night shift|nights|overnight|night)\b/i.test(text)) return 'night';
  if (/\b(?:evening|late shift|twilight)\b/i.test(text)) return 'evening';
  const t = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (t) {
    const h = Number(t[1]);
    if (h >= 22 || h < 7) return 'night';
    if (h >= 17) return 'evening';
    return 'day';
  }
  if (/\b(?:morning|day shift|early shift|afternoon)\b/i.test(text)) return 'day';
  return null;
}

export function detectOutcome(text) {
  if (/\b(?:no harm|near[- ]miss|did not reach|caught before|before (?:it was )?(?:given|administered|started|sent)|intercepted|prevented)\b/i.test(text)) return 'near-miss';
  if (/\b(?:severe harm|death|died|cardiac arrest|transferred to icu)\b/i.test(text)) return 'severe-harm';
  if (/\b(?:minor harm|harm|injury|injured|bruise|graze|hypoglyc|bleed)\b/i.test(text)) return 'harm';
  return 'near-miss';
}

export function detectEventDate(text, fallback) {
  const m = text.match(/\b(?:date of (?:event|incident)|event date|occurred(?: on)?|incident date)[:\s]*(\d{4}-\d{2}-\d{2})\b/i);
  if (m) return m[1];
  return fallback ? String(fallback).slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export const detectFactors = (text) => FACTORS.filter((f) => f.re.test(text)).map((f) => f.id);
export const detectDefences = (text) => DEFENCES.filter((d) => d.re.test(text)).map((d) => d.id);

/**
 * Build a stored record from raw issue text. Redaction happens first; nothing
 * unredacted is returned.
 */
export function buildRecord({ key, summary, description, created, projectKey }) {
  const s = redact(summary);
  const d = redact(description);
  const text = `${s.text}\n${d.text}`;
  const { device, deviceModel } = detectDevice(text);
  // The event date is not an identifier on its own; read it from the raw text.
  const eventDate = detectEventDate(`${summary || ''}\n${description || ''}`, created);
  return {
    key,
    projectKey: projectKey || (key ? String(key).split('-')[0] : null),
    summary: s.text.slice(0, 255),
    text: d.text.slice(0, 2000),
    eventDate,
    category: detectCategory(text),
    location: detectLocation(text),
    device,
    deviceModel,
    drug: detectDrug(text),
    shift: detectShift(text),
    outcome: detectOutcome(text),
    factors: detectFactors(text),
    defences: detectDefences(text),
    tokens: topTokens(text),
    redactions: s.redactions + d.redactions,
    indexedAt: new Date().toISOString(),
  };
}
