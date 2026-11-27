// Turns a (redacted) near-miss report into structured facets.
import { CATEGORIES, LOCATIONS, DEVICES, DRUGS, FACTORS, DEFENCES } from './lexicon.js';
import { redact } from './redact.js';
import { topTokens } from './text.js';
import { translateBangla, normaliseDigits, hasBangla } from './bangla.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Whole-word match that also accepts a simple plural ("wristband" matches "wristbands").
const wordRe = (phrase) => new RegExp(`(?<![a-z0-9])${esc(phrase)}(?:s|es)?(?![a-z0-9])`, 'gi');

/** Expand common clinical shorthand before detection (the stored text is unchanged). */
export function expandShorthand(text) {
  return String(text || '')
    .replace(/\bpts\b/gi, 'patients')
    .replace(/\bpt\b/gi, 'patient')
    .replace(/\bmeds\b/gi, 'medication')
    .replace(/\babx\b/gi, 'antibiotic')
    .replace(/\badmin\b/gi, 'administration')
    .replace(/\bobs\b/gi, 'observations');
}

function count(text, phrase) {
  return (text.match(wordRe(phrase)) || []).length;
}

// When scores tie, the more specific incident type wins. Handover problems are usually
// a contributing factor to another incident, so they rank last.
const CATEGORY_PRIORITY = ['infusion', 'medication', 'specimen', 'identification', 'falls', 'procedure', 'diagnostic', 'equipment', 'handover'];
const PUMP_DEVICES = new Set(['infusion pump', 'syringe driver', 'pca pump', 'pump']);

export function categoryScores(text) {
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  for (const c of CATEGORIES) {
    // Multi-word keywords are more specific, so they count double.
    scores[c.id] = c.keywords.reduce((s, k) => s + count(text, k) * (k.includes(' ') ? 2 : 1), 0);
  }
  const lower = text.toLowerCase();
  // A named drug is strong evidence of a medication incident.
  scores.medication += DRUGS.filter((d) => count(lower, d) > 0).length * 2;
  // A named device points to its category: pumps to infusion, anything else to equipment.
  const device = DEVICES.find((d) => count(lower, d) > 0);
  if (device) scores[PUMP_DEVICES.has(device) ? 'infusion' : 'equipment'] += 2;
  // A drug given to the wrong patient is a medication incident, not only an ID problem.
  if (scores.medication > 0 && scores.identification > 0) scores.medication += 1;
  // A handover problem around a medicine or a test is reported as that incident.
  if (scores.handover > 0 && (scores.medication > 0 || scores.specimen > 0)) scores.handover -= 1;
  return scores;
}

export function detectCategory(text) {
  const scores = categoryScores(text);
  let best = 'other';
  let bestScore = 0;
  for (const id of CATEGORY_PRIORITY) {
    if (scores[id] > bestScore) {
      best = id;
      bestScore = scores[id];
    }
  }
  return best;
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

// Harm means harm to the patient, not a clinical finding ("a CT showing a bleed").
const SEVERE_HARM = /\b(?:severe harm|death|died|cardiac arrest|transferred to icu)\b/i;
const HARM = /\b(?:(?:minor|moderate) harm|harm(?:ed)? (?:to )?the patient|caused harm|injur(?:y|ies|ed)|bruis(?:e|ed|ing)|graze[ds]?|sustained an? (?:\w+ )?fracture|fractured (?:his|her|their) \w+|hypoglyc\w*|(?:minor|major|some) bleed\w*|developed [^.;]{0,25}(?:bleed\w*|rash|reaction|swelling|respiratory depression)|respiratory depression|(?:needing|needed|required|requiring|given) (?:\w+ )?(?:naloxone|flumazenil|an antidote|reversal|treatment for)|anaphyla\w+)\b/i;

// The error reached the patient (as opposed to being caught before it did).
const REACHED = /\b(?:fell|(?:patient|lady|man|woman|he|she|they) (?:was |were )?found on (?:the )?floor|(?:was|were) given (?:to )?the wrong|given (?:to )?the wrong patient|received (?:the )?wrong|administered (?:to )?the wrong|infused at|given \d+ ?(?:hours?|hrs?|mins?|minutes?) (?:late|early)|gave it [^.;]{0,20}(?:late|early))\b/i;

/**
 * Outcome, using the standard patient-safety levels:
 *   near-miss   caught before it reached the patient
 *   no-harm     reached the patient, but no harm resulted
 *   harm        reached the patient and caused harm
 *   severe-harm severe harm or death
 */
export function detectOutcome(text) {
  if (/\b(?:near[- ]miss|did not reach|caught before|before (?:it was )?(?:given|administered|started|sent)|intercepted|prevented)\b/i.test(text)) return 'near-miss';
  // "nearly given" / "almost fell" did not reach the patient.
  const reached = affirmed(REACHED, text, NEARLY_OR_NOT);
  // The reporter saying "no harm" overrides findings such as "a CT showing a bleed".
  if (/\bno harm\b/i.test(text)) return reached ? 'no-harm' : 'near-miss';
  // affirmed() ignores negated mentions such as "no injury".
  if (affirmed(SEVERE_HARM, text)) return 'severe-harm';
  if (affirmed(HARM, text)) return 'harm';
  return reached ? 'no-harm' : 'near-miss';
}

export function detectEventDate(text, fallback) {
  const m = text.match(/\b(?:date of (?:event|incident)|event date|occurred(?: on)?|incident date)[:\s]*(\d{4}-\d{2}-\d{2})\b/i);
  if (m) return m[1];
  return fallback ? String(fallback).slice(0, 10) : new Date().toISOString().slice(0, 10);
}

// A cue like "no", "not" or "without" shortly before a phrase, in the same clause,
// negates it: "staff were not tired" is not fatigue, and "no double check was done"
// is not a defence that held.
const NEGATION = /\b(?:no|not|never|without|denies|denied|nor|wasn'?t|weren'?t|isn'?t|didn'?t|did not|was not|were not)\b(?:\s+\w+){0,3}\s*$/i;
// For "did it reach the patient?" only: "nearly" and "almost" also mean it did not.
const NEARLY_OR_NOT = /\b(?:no|not|never|without|nearly|almost|wasn'?t|weren'?t|didn'?t|did not|was not|were not)\b(?:\s+\w+){0,3}\s*$/i;

/** True if the pattern occurs at least once without a negation cue just before it. */
export function affirmed(re, text, cues = NEGATION) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = g.exec(text))) {
    // Look back to the start of the clause, at most 40 characters.
    const before = text.slice(Math.max(0, m.index - 40), m.index).split(/[.;:!?\n]|,\s*(?:but|and)\b/).pop();
    if (!cues.test(before)) return true;
    if (m[0].length === 0) g.lastIndex++;
  }
  return false;
}

export const detectFactors = (text) => FACTORS.filter((f) => affirmed(f.re, text)).map((f) => f.id);
export const detectDefences = (text) => DEFENCES.filter((d) => affirmed(d.re, text)).map((d) => d.id);

/**
 * Build a stored record from raw issue text. Redaction happens first; nothing
 * unredacted is returned.
 */
export function buildRecord({ key, summary, description, created, projectKey }) {
  // Bangla digits become ASCII first, so redaction catches Bangla phone and record numbers.
  const s = redact(normaliseDigits(summary));
  const d = redact(normaliseDigits(description));
  // Detection runs on an English-normalised copy; the stored text keeps its language.
  const text = expandShorthand(translateBangla(`${s.text}\n${d.text}`));
  const { device, deviceModel } = detectDevice(text);
  // The event date is not an identifier on its own; read it from the raw text.
  const eventDate = detectEventDate(normaliseDigits(`${summary || ''}\n${description || ''}`), created);
  return {
    key,
    projectKey: projectKey || (key ? String(key).split('-')[0] : null),
    language: hasBangla(`${summary || ''}${description || ''}`) ? 'bn' : 'en',
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
