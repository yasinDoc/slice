// Removes patient identifiers BEFORE anything is stored or sent to Rovo.
// Deliberately conservative: over-redacting a word is cheaper than leaking an identifier.

const RULES = [
  // Record numbers: "MRN 4471-22", "Hospital no: A12345", "NHS number 943 476 5919"
  {
    tag: '[ID]',
    re: /\b(?:MRN|NHS(?:\s*(?:no|number))?|hospital\s*(?:no|number)|patient\s*id|record\s*(?:no|number)|UHID)\b\.?[:#\s]*[A-Z0-9][A-Z0-9 -]{3,14}\d\b/gi,
  },
  // Dates of birth
  { tag: '[DOB]', re: /\b(?:DOB|D\.O\.B\.?|date of birth)[:\s]*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/gi },
  // Emails
  { tag: '[EMAIL]', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // Phone-like numbers (7+ digits with separators)
  { tag: '[NUMBER]', re: /(?<![\w.])(?!\d{4}-\d{2}-\d{2}(?!\d))(?:\+?\d[\d\s-]{7,}\d)(?![\w.])/g },
  // Honorific + name: "Mrs Rahman", "Mr. John Smith"
  { tag: '[NAME]', re: /\b(?:Mr|Mrs|Ms|Miss|Mx)\.?\s+[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?/g },
  // "patient John Smith", "pt named Ayesha Khan"
  {
    tag: '[NAME]',
    re: /\b(?<lead>(?:patient|pt)\s+(?:named\s+|called\s+)?)[A-Z][a-z'-]+\s+[A-Z][a-z'-]+/g,
    keepGroup: 'lead',
  },
  // Bed / room numbers can identify a patient on a given night
  { tag: 'bed [N]', re: /\bbed\s*(?:no\.?\s*)?\d+[A-Z]?\b/gi },
  { tag: 'room [N]', re: /\broom\s*\d+[A-Z]?\b/gi },
];

/**
 * @param {string} text
 * @returns {{ text: string, redactions: number }}
 */
export function redact(text) {
  let out = String(text || '');
  let redactions = 0;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args) => {
      redactions++;
      if (rule.keepGroup) {
        const groups = args[args.length - 1];
        return `${groups[rule.keepGroup]}${rule.tag}`;
      }
      return rule.tag;
    });
  }
  return { text: out, redactions };
}
