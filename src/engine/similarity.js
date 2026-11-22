// Explainable similarity between two near-miss records.
import { jaccard, cosine } from './text.js';
import { CATEGORIES } from './lexicon.js';

export const WEIGHTS = {
  category: 0.3,
  device: 0.2,
  location: 0.15,
  drug: 0.1,
  factors: 0.1,
  shift: 0.05,
  text: 0.1,
};

export const SIMILAR_THRESHOLD = 0.45;

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

/**
 * @returns {{ score: number, reasons: string[] }}
 */
export function compareRecords(a, b) {
  let score = 0;
  const reasons = [];

  if (a.category && a.category !== 'other' && a.category === b.category) {
    score += WEIGHTS.category;
    reasons.push(`same category (${catLabel(a.category)})`);
  }
  if (a.deviceModel && a.deviceModel === b.deviceModel) {
    score += WEIGHTS.device;
    reasons.push(`same device model (${a.deviceModel})`);
  } else if (a.device && a.device === b.device) {
    score += WEIGHTS.device * 0.6;
    reasons.push(`same device type (${a.device})`);
  }
  if (a.location && a.location === b.location) {
    score += WEIGHTS.location;
    reasons.push(`same location (${a.location})`);
  }
  if (a.drug && a.drug === b.drug) {
    score += WEIGHTS.drug;
    reasons.push(`same drug (${a.drug})`);
  }
  const f = jaccard(a.factors, b.factors);
  if (f > 0) {
    score += WEIGHTS.factors * f;
    const shared = a.factors.filter((x) => b.factors.includes(x));
    if (shared.length) reasons.push(`shared factors (${shared.join(', ')})`);
  }
  if (a.shift && a.shift === b.shift) {
    score += WEIGHTS.shift;
    reasons.push(`${a.shift} shift`);
  }
  const t = cosine(a.tokens, b.tokens);
  score += WEIGHTS.text * t;
  if (t > 0.3) reasons.push('similar wording');

  return { score: Math.round(score * 100) / 100, reasons };
}
