// Guardrails: PII redaction, prompt-injection detection, output checks. Pure functions – unit tested.

const PII_PATTERNS = [
  ['EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['PHONE', /\b(?:\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}\b/g],
  ['SORT_CODE', /\b\d{2}-\d{2}-\d{2}\b/g],
  ['ACCOUNT_NO', /\b(?:account(?:\s+(?:number|no\.?))?)\s*:?\s*(\d{8})\b/gi],
  ['NI_NUMBER', /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g],
  ['POSTCODE', /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g],
  ['DOB', /\b(?:19|20)\d{2}-\d{2}-\d{2}\b(?=.*\bdob\b)/gi],
];

export function redactPII(text) {
  const counts = {}; const map = {};
  let out = text;
  for (const [label, re] of PII_PATTERNS) {
    out = out.replace(re, (m, g1) => {
      counts[label] = (counts[label] || 0) + 1;
      const token = `[${label}_${counts[label]}]`;
      map[token] = m;
      return label === 'ACCOUNT_NO' && g1 ? m.replace(g1, token) : token;
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: out, counts, total, map };
}

// Normalise to defeat simple obfuscation: zero-width chars, homoglyphs, spaced letters, leetspeak.
export function normaliseForScan(text) {
  let t = text.normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
  const homo = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'і': 'i', 'ѕ': 's', 'ӏ': 'l' };
  t = t.replace(/[аеорсіѕӏ]/g, c => homo[c]);
  // collapse "i g n o r e" style spacing
  t = t.replace(/\b(?:[A-Za-z][ .\-_]){3,}[A-Za-z]\b/g, m => m.replace(/[ .\-_]/g, ''));
  t = t.replace(/0/g, 'o').replace(/1(?=[a-z])/g, 'i').replace(/3(?=[a-z])/g, 'e');
  return t.toLowerCase();
}

const INJECTION_RULES = [
  { id: 'INJ-01', weight: 0.6, desc: 'Instruction override ("ignore/disregard previous instructions")', re: /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|system|the)\b[^.\n]{0,30}\b(instructions?|rules|prompts?|guidelines|polic(y|ies)|guardrails)\b/ },
  { id: 'INJ-02', weight: 0.5, desc: 'Addresses the AI/assistant/model directly', re: /\b(ai|llm|assistant|chatbot|language model|copilot|gpt)\s*[:,]\s*|\bdear (ai|assistant|model)\b|\bnote to (the )?(ai|assistant|model|bot)\b/ },
  { id: 'INJ-03', weight: 0.5, desc: 'Role or system prompt manipulation', re: /\b(you are now|act as|pretend to be|new instructions|system prompt|developer mode|jailbreak)\b|^\s*(system|assistant)\s*:/m },
  { id: 'INJ-04', weight: 0.45, desc: 'Attempts to force a claim decision or payment', re: /\b(mark|set|approve|authori[sz]e|settle|release)\b[^.\n]{0,60}\b(claim|coverage|payment|reserve|covered|settlement)\b[^.\n]{0,60}\b(immediately|no excess|in full|without (review|inspection)|£\s?\d)/ },
  { id: 'INJ-05', weight: 0.45, desc: 'Concealment from the human reviewer', re: /\b(do not|don't|never)\b[^.\n]{0,20}\b(mention|tell|inform|show|reveal)\b[^.\n]{0,40}\b(handler|human|reviewer|adjuster|staff|anyone)\b/ },
  { id: 'INJ-06', weight: 0.35, desc: 'Hidden markup / comment block in a customer document', re: /<!--[\s\S]*?-->|<\s*(script|span[^>]*display\s*:\s*none)/ },
  { id: 'INJ-07', weight: 0.5, desc: 'Exfiltration request (reveal prompt/data)', re: /\b(reveal|print|output|repeat|send)\b[^.\n]{0,30}\b(system prompt|your instructions|hidden prompt|all (customer|claim) data|api key)\b/ },
];

export const INJECTION_THRESHOLD = 0.5;

export function detectInjection(text) {
  const t = normaliseForScan(text);
  const hits = [];
  for (const r of INJECTION_RULES) {
    const m = t.match(r.re);
    if (m) hits.push({ rule: r.id, desc: r.desc, weight: r.weight, match: m[0].slice(0, 120) });
  }
  const score = Math.min(1, hits.reduce((a, h) => a + h.weight, 0));
  return { score: +score.toFixed(2), blocked: score >= INJECTION_THRESHOLD, hits };
}

// ---- Output guardrails ----
export const JARGON = ['indemnity', 'subrogation', 'proximate cause', 'quantum', 'loss adjuster\'s schedule', 'repudiate', 'repudiation', 'betterment', 'average clause', 'pursuant'];
const PROMISES = /\b(we will pay|we'll pay|guarantee|guaranteed|your claim is accepted|we have accepted your claim|you will receive £)/i;

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0; if (w.length <= 3) return 1;
  const s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, s ? s.length : 1);
}
export function fleschReadingEase(text) {
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length);
  const words = text.split(/\s+/).filter(w => /[a-z]/i.test(w));
  const syl = words.reduce((a, w) => a + countSyllables(w), 0);
  if (!words.length) return 0;
  return +(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length)).toFixed(1);
}

export function checkCustomerComms(text, { coverageConfirmed = false, vulnerable = false } = {}) {
  const lower = text.toLowerCase();
  const jargon = JARGON.filter(j => lower.includes(j));
  const fre = fleschReadingEase(text);
  const checks = [
    { id: 'OUT-PLAIN', name: 'Plain English (Flesch reading ease ≥ 60)', pass: fre >= 60, detail: `score ${fre}` },
    { id: 'OUT-JARGON', name: 'No insurance jargon', pass: jargon.length === 0, detail: jargon.length ? jargon.join(', ') : 'none found' },
    { id: 'OUT-PROMISE', name: 'No payment promise before liability confirmed', pass: coverageConfirmed || !PROMISES.test(text), detail: PROMISES.test(text) ? 'promise language found' : 'ok' },
    { id: 'OUT-NEXT', name: 'Explains next steps and timescale', pass: /next/i.test(text) && /\b(working days?|days?|hours?|week)\b/i.test(text), detail: '' },
    { id: 'OUT-CONTACT', name: 'Tells customer how to contact us / complain', pass: /contact|call us|ring us/i.test(text) && /complain/i.test(text), detail: '' },
    { id: 'OUT-PII', name: 'No third-party bank details or unrelated PII', pass: !/\b\d{2}-\d{2}-\d{2}\b|\b\d{8}\b/.test(text), detail: '' },
  ];
  if (vulnerable) checks.push({ id: 'OUT-VUL', name: 'Adjustments offered for customer in vulnerable circumstances', pass: /(nominated contact|large print|call you|extra support|priority)/i.test(text), detail: '' });
  return { pass: checks.every(c => c.pass), checks, readingEase: fre };
}

// Groundedness: every citation quote must literally appear in its cited source, and numbers/dates in the claim sentence must appear in the quote.
export function verifyCitations(statements, docsById) {
  const results = statements.map(s => {
    const cites = s.citations || [];
    if (!cites.length) return { ...s, grounded: false, reason: 'no citation' };
    const quotesOk = cites.every(c => docsById[c.docId] && docsById[c.docId].text.includes(c.quote));
    const nums = (s.text.match(/£[\d,]+|\b\d{1,2} [A-Z][a-z]+ \d{4}\b/g) || []);
    const allQuotes = cites.map(c => c.quote).join(' ');
    const numsOk = nums.every(n => allQuotes.includes(n));
    return { ...s, grounded: quotesOk && numsOk, reason: !quotesOk ? 'quote not found in source' : !numsOk ? 'figure not supported by quote' : 'ok' };
  });
  const grounded = results.filter(r => r.grounded).length;
  return { results, groundedness: results.length ? grounded / results.length : 0 };
}
