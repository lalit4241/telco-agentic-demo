// Small BM25 retriever over policy clauses and SOPs (the "knowledge base").
import { POLICY, SOPS } from './data.js';

const STOP = new Set('a an the and or of to in on for is are be by with if it its we you your our this that from at as not any will can do does what how when who which there their under over than more most up out into about'.split(' '));
export const tokenize = s => s.toLowerCase().replace(/[^a-z0-9£ ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(w => w.replace(/(ing|es|s)$/, ''));

export function buildIndex(chunks) {
  const docs = chunks.map(c => ({ ...c, toks: tokenize(`${c.title} ${c.text}`) }));
  const df = {}; docs.forEach(d => new Set(d.toks).forEach(t => (df[t] = (df[t] || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.toks.length, 0) / docs.length;
  return { docs, df, avg, N: docs.length };
}

export function search(index, query, k = 3) {
  const q = tokenize(query); const k1 = 1.4, b = 0.75;
  return index.docs.map(d => {
    let score = 0;
    for (const t of new Set(q)) {
      const f = d.toks.filter(x => x === t).length; if (!f) continue;
      const idf = Math.log(1 + (index.N - index.df[t] + 0.5) / (index.df[t] + 0.5));
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.toks.length / index.avg));
    }
    return { id: d.id, title: d.title, source: d.source, text: d.text, score: +score.toFixed(3) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

export const KB_CHUNKS = [
  ...POLICY.clauses.map(c => ({ id: c.id, title: `${c.id} ${c.title}`, text: c.text, source: POLICY.title })),
  ...SOPS.map(s => ({ id: s.id, title: s.title, text: s.text, source: 'Claims operating procedures (synthetic)' })),
];
export const KB_INDEX = buildIndex(KB_CHUNKS);
