// Small text utilities shared by the engine. Pure functions, no Forge imports.

const STOP = new Set(
  (
    'the and for was were with that this from have has had not but are been into onto ' +
    'then than when what which who whom while about after before during under over ' +
    'patient patients staff nurse nurses noticed reported report found also there their ' +
    'they them she her his him its our out off one two all any some very more most ' +
    'could would should will can did does done being just only same other each per via'
  ).split(' ')
);

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text) {
  return normalize(text)
    .split(/[\s/-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));
}

/** Top-N most frequent tokens; keeps stored records small. */
export function topTokens(text, n = 60) {
  const tf = new Map();
  for (const t of tokenize(text)) tf.set(t, (tf.get(t) || 0) + 1);
  return [...tf.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t);
}

export function jaccard(a = [], b = []) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Cosine similarity over binary token sets (tokens are already de-duplicated). */
export function cosine(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  let inter = 0;
  for (const x of new Set(a)) if (B.has(x)) inter++;
  return inter / Math.sqrt(new Set(a).size * B.size);
}

/** Flatten Atlassian Document Format (or a plain string) into text. */
export function adfToText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  let out = '';
  if (node.type === 'text' && node.text) out += node.text;
  if (node.type === 'hardBreak') out += '\n';
  if (node.content) out += adfToText(node.content);
  if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type)) out += '\n';
  return out;
}

/** Strip HTML / Confluence storage format to text. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(br|\/p|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}
