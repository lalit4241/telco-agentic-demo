// Deterministic "offline model" skills. Each skill reads ONLY the guarded context (safe documents + Cloud API claim
// attributes) and returns structured output with citations back to source documents / policy clauses.
import { POLICY, SOPS } from './data.js';
import { KB_INDEX, search } from './retrieval.js';

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DATE_RE = /\b(\d{1,2})(?:st|nd|rd|th)? (?:of )?(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/i;
// Evidence quote for a guardrail hit: first sentence only, so bank details in the attack are never echoed.
export const gQuote = m => (String(m || '').match(/^[\s\S]*?[.!?](?=\s|$)/) || [String(m || '').slice(0, 80)])[0];
export const parseDate = s => { const m = s && s.match(DATE_RE); if (!m) return null; return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const fmtDate = iso => { const [y, m, dd] = iso.split('-'); return `${+dd} ${MONTHS[+m - 1][0].toUpperCase() + MONTHS[+m - 1].slice(1)} ${y}`; };
export const money = n => `£${Number(n).toLocaleString('en-GB')}`;
const parseMoney = s => +s.replace(/[£,]/g, '');

export function sentences(doc) {
  return doc.text.split('\n').flatMap(l => l.split(/(?<=[.!?])\s+(?=[A-Z])/)).map(s => s.trim()).filter(Boolean);
}
// Find the first sentence (in doc-type priority order) matching a regex. Returns a citation.
export function findQuote(docs, re, types = null, exclude = null) {
  const ordered = types ? types.flatMap(t => docs.filter(d => d.type === t)) : docs;
  for (const doc of ordered) for (const s of sentences(doc)) {
    if (re.test(s) && !(exclude && exclude.test(s))) return { docId: doc.id, docTitle: doc.title, quote: s };
  }
  return null;
}
const policyCite = id => { const c = POLICY.clauses.find(x => x.id === id); return { docId: POLICY.id, clauseId: id, docTitle: `${POLICY.title} – ${id} ${c.title}`, quote: c.text }; };

const ROOM_WORDS = ['kitchen', 'bathroom', 'en-suite', 'living room', 'dining room', 'bedroom', 'hallway', 'landing'];
const CAUSES = [
  ['Escape from neighbouring property', /flat above|upstairs neighbour|neighbouring property|from flat \d/i],
  ['Failed sealant / grout', /sealant|seal around|grout/i],
  ['Domestic appliance (washing machine / dishwasher)', /washing machine|dishwasher|inlet hose/i],
  ['Water tank failure', /water tank/i],
  ['Heating system / radiator', /radiator|central heating/i],
  ['Burst pipe', /burst|split copper pipe|failure of a .*pipe/i],
];

// ---------- Document intake / extraction ----------
export function extract(ctx) {
  const docs = ctx.docs; const fnol = docs.filter(d => d.type === 'FNOL transcript');
  const fields = {}; const cites = {};
  const pn = findQuote(docs, /\bHO-\d{7}\b/, ['FNOL transcript']);
  fields.policyNumber = pn ? pn.quote.match(/\bHO-\d{7}\b/)[0] : null; cites.policyNumber = pn;
  let dq = null;
  for (const re of [/date of loss/i, /happened|started|when did it happen|found it|fell on/i]) { dq = findQuote(fnol, { test: s => re.test(s) && DATE_RE.test(s) }); if (dq) break; }
  fields.dateOfLoss = dq ? parseDate(dq.quote) : null; cites.dateOfLoss = dq;
  const causeText = docs.filter(d => ['FNOL transcript', 'Loss adjuster report'].includes(d.type));
  fields.causeOfLoss = null;
  for (const [label, re] of CAUSES) { const q = findQuote(causeText, re, ['Loss adjuster report', 'FNOL transcript'], /no evidence/i); if (q) { fields.causeOfLoss = label; cites.causeOfLoss = q; break; } }
  // rooms: answer to the "rooms affected" question
  let roomsLine = null;
  for (const doc of fnol) { const lines = doc.text.split('\n'); const i = lines.findIndex(l => /rooms? (are )?affected/i.test(l));
    if (i >= 0) { const after = lines[i].split(/affected\??:?/i)[1]; roomsLine = { docId: doc.id, docTitle: doc.title, quote: after && after.trim() ? lines[i].trim() : (lines[i + 1] || '').trim() }; break; } }
  fields.roomsAffected = roomsLine ? ROOM_WORDS.filter(r => roomsLine.quote.toLowerCase().includes(r)) : [];
  cites.roomsAffected = roomsLine;
  let cost = null;
  const la = findQuote(docs, /Estimated (reinstatement )?cost: £[\d,]+/i, ['Loss adjuster report']);
  if (la) { cost = parseMoney(la.quote.match(/£[\d,]+/)[0]); cites.estimatedCost = la; }
  else { let best = null; for (const d of docs) for (const s of sentences(d)) { const m = s.match(/Total including VAT: (£[\d,]+)/i); if (m && (!best || parseMoney(m[1]) > best.v)) best = { v: parseMoney(m[1]), c: { docId: d.id, docTitle: d.title, quote: s } }; }
    if (best) { cost = best.v; cites.estimatedCost = best.c; } }
  fields.estimatedCost = cost;
  const un = findQuote(docs, /(empty|unoccupied) since/i, ['Loss adjuster report', 'FNOL transcript', 'Email']);
  fields.propertyOccupied = !un; cites.propertyOccupied = un;
  fields.unoccupiedDays = un && fields.dateOfLoss && parseDate(un.quote) ? daysBetween(parseDate(un.quote), fields.dateOfLoss) : 0;
  const hab = findQuote(docs, /not (reasonably )?habitable|cannot be lived|can't afford a hotel|somewhere to stay|kitchen unusable/i);
  fields.alternativeAccommodationNeeded = !!hab; cites.alternativeAccommodationNeeded = hab;
  const tp = findQuote(docs, CAUSES[0][1]); fields.thirdPartyInvolved = !!tp; cites.thirdPartyInvolved = tp;
  return { fields, citations: cites };
}

// ---------- Vulnerability (FCA FG21/1 drivers) ----------
const VUL = {
  Health: /hard of hearing|dementia|disabilit|mobility|wheelchair|oxygen|dialysis|depression|anxiety disorder|pregnant|chemotherapy/i,
  'Life events': /passed away|bereave|\bdied\b|widow|made redundant|redundancy|divorce|new baby|pregnant|caring for/i,
  Resilience: /can't afford|cannot afford|struggling (financially|to pay)|in debt|no savings|made redundant/i,
  Capability: /don't use email|do not use email|not online|english is not|help reading|large print|gets confused|confused by/i,
};
const ADJUST = {
  Health: 'Offer phone contact at a slower pace and confirm key points in writing; check any accessibility needs.',
  'Life events': 'Acknowledge the circumstances, assign a single point of contact and allow extra time for responses.',
  Resilience: 'Prioritise alternative accommodation / emergency payments; avoid asking the customer to fund costs up front.',
  Capability: 'Use large print letters and/or a nominated contact; avoid digital-only journeys.',
};
export function vulnerability(ctx) {
  const docs = ctx.docs.filter(d => d.type !== 'Invoice');
  const drivers = [];
  for (const [driver, re] of Object.entries(VUL)) { const q = findQuote(docs, re, ['FNOL transcript', 'Email', 'Loss adjuster report', 'Note']); if (q) drivers.push({ driver, evidence: q, adjustment: ADJUST[driver] }); }
  const age = ctx.claim.insuredAge;
  const supporting = age >= 75 ? [`Customer age ${age} (supporting context only – age alone is not a vulnerability)`] : [];
  return { vulnerable: drivers.length > 0, drivers, supporting, consentNote: 'Confirm and record the need with the customer\'s consent (SOP-VUL-02). This flag must never be used in coverage or fraud decisions.', sop: 'SOP-VUL-02' };
}

// ---------- Fraud indicators (deliberately excludes any vulnerability / protected-characteristic inputs) ----------
export function fraud(ctx, ex = extract(ctx)) {
  const f = ex.fields; const ind = [];
  const inc = ctx.claim.policy.inception; const loss = f.dateOfLoss || ctx.claim.lossDate;
  const dInc = daysBetween(inc, loss);
  if (dInc >= 0 && dInc <= 30) ind.push({ id: 'FI-INCEPT', weight: 1, text: `Loss ${dInc} days after policy inception (${fmtDate(inc)})`, evidence: ex.citations.dateOfLoss });
  const priors = (ctx.claim.policy.priorClaims || []).filter(p => /water/i.test(p.type) && daysBetween(p.date, loss) <= 5 * 365);
  if (priors.length >= 2) ind.push({ id: 'FI-PRIOR', weight: 1, text: `${priors.length} prior escape of water claims in 5 years (CUE match)`, evidence: null });
  const invoices = ctx.docs.filter(d => d.type === 'Invoice');
  for (const d of invoices) { const q = findQuote([d], /dated \d{1,2} \w+ \d{4}/i); const dt = q && parseDate(q.quote);
    if (dt && daysBetween(dt, loss) > 0) ind.push({ id: 'FI-INVDATE', weight: 1, text: `${d.title} dated ${fmtDate(dt)} – before the reported date of loss (${fmtDate(loss)})`, evidence: q }); }
  const totals = []; for (const d of ctx.docs) for (const s of sentences(d)) { const m = s.match(/Total including VAT: (£[\d,]+)/i); if (m) totals.push({ v: parseMoney(m[1]), c: { docId: d.id, docTitle: d.title, quote: s } }); }
  if (totals.length >= 2) { const mx = Math.max(...totals.map(t => t.v)), mn = Math.min(...totals.map(t => t.v)); if ((mx - mn) / mn > 0.25) ind.push({ id: 'FI-AMOUNT', weight: 1, text: `Quote and invoice differ by ${Math.round((mx - mn) / mn * 100)}% (${money(mn)} vs ${money(mx)})`, evidence: totals.find(t => t.v === mx).c }); }
  const insp = findQuote(ctx.docs, /no point|stripped everything out|don't see why you need to inspect|skip has been taken/i, ['FNOL transcript', 'Email']);
  if (insp) ind.push({ id: 'FI-INSPECT', weight: 1, text: 'Strip-out before inspection / inspection resisted (GC6)', evidence: insp });
  const rep = daysBetween(loss, ctx.claim.reportedDate); if (rep > 30) ind.push({ id: 'FI-LATE', weight: 1, text: `Reported ${rep} days after loss`, evidence: null });
  for (const g of ctx.guardrailEvents || []) if (g.type === 'injection') ind.push({ id: 'FI-MANIP', weight: 2, text: `Attempt to manipulate automated processing found in ${g.docTitle}`, evidence: { docId: g.docId, docTitle: g.docTitle, quote: gQuote(g.match) } });
  const score = ind.reduce((a, i) => a + i.weight, 0);
  return { score, refer: score >= 2, indicators: ind, note: 'Indicators are prompts for review, not proof of fraud. Keep customer communications neutral (SOP-FRD-03).', sop: 'SOP-FRD-03' };
}

// ---------- Coverage check ----------
export function coverage(ctx, ex = extract(ctx)) {
  const f = ex.fields; const findings = []; const retrieved = search(KB_INDEX, `escape of water ${f.causeOfLoss || ''} ${f.propertyOccupied ? '' : 'unoccupied'} exclusion`, 5);
  const contentsOnly = !ctx.claim.policy.buildingsSumInsured;
  findings.push({ clause: contentsOnly ? 'S2.4' : 'S1.4', result: 'applies', reason: `Insured peril: escape of water – cause identified as "${f.causeOfLoss}".`, evidence: ex.citations.causeOfLoss, policy: policyCite(contentsOnly ? 'S2.4' : 'S1.4') });
  let excluded = false, refer = false;
  const sealQ = findQuote(ctx.docs.filter(d => d.type !== 'Email'), /sealant|grout/i, ['Loss adjuster report', 'FNOL transcript'], /no evidence/i);
  if (sealQ) { excluded = true; findings.push({ clause: 'S1.4a', result: 'exclusion likely', reason: 'Evidence that damage was caused by failed sealant or grout.', evidence: sealQ, policy: policyCite('S1.4a') }); }
  const gradQ = findQuote(ctx.docs.filter(d => d.type !== 'Email'), /gradual|over an extended period|over several months|for a few months|seep/i, ['Loss adjuster report', 'FNOL transcript'], /no evidence/i);
  if (gradQ) { excluded = true; findings.push({ clause: 'S1.4c', result: 'exclusion likely', reason: 'Evidence the damage happened gradually over time.', evidence: gradQ, policy: policyCite('S1.4c') }); }
  if (!f.propertyOccupied && f.unoccupiedDays > 60) { excluded = true; findings.push({ clause: 'S1.4b', result: 'exclusion likely', reason: `Home unoccupied for ${f.unoccupiedDays} days (limit 60 consecutive days, GC7).`, evidence: ex.citations.propertyOccupied, policy: policyCite('S1.4b') }); }
  if (excluded && (sealQ || gradQ)) { const ta = findQuote(ctx.docs, /trace and access/i); findings.push({ clause: 'S1.5', result: 'may still apply', reason: 'Trace and access is payable even where the leak damage itself is excluded (up to £5,000).', evidence: ta, policy: policyCite('S1.5') }); }
  const insp = findQuote(ctx.docs, /stripped everything out|skip has been taken|don't see why you need to inspect/i);
  if (insp) { refer = true; findings.push({ clause: 'GC6', result: 'condition concern', reason: 'Repairs/strip-out before inspection may breach the claims condition. Handler to assess impact fairly.', evidence: insp, policy: policyCite('GC6') }); }
  if (f.alternativeAccommodationNeeded && !excluded) findings.push({ clause: 'S1.9', result: 'applies', reason: 'Home not reasonably habitable – alternative accommodation cover applies.', evidence: ex.citations.alternativeAccommodationNeeded, policy: policyCite('S1.9') });
  findings.push({ clause: 'S1.4d', result: 'applies', reason: `Escape of water excess ${money(ctx.claim.policy.eowExcess)}.`, evidence: null, policy: policyCite('S1.4d') });
  const decision = excluded ? 'excluded' : refer ? 'refer' : 'covered';
  const label = { covered: 'Likely covered', excluded: 'Likely excluded – handler review required', refer: 'Cover on face – refer: policy condition concern' }[decision];
  return { decision, label, findings, retrieved, disclaimer: 'Decision support only. The claims handler makes and owns the coverage decision.' };
}

// ---------- Triage (SOP-TRI-01) ----------
const BANDS = ['Low', 'Medium', 'High', 'Complex'];
const ROUTES = { Low: 'Fast-track desk settlement (5 working days)', Medium: 'Desk handler', High: 'Field adjuster with daily contact', Complex: 'Complex claims team – technical review' };
export function triage(ctx, ex = extract(ctx), cov = coverage(ctx, ex), vul = vulnerability(ctx), fr = fraud(ctx, ex)) {
  const f = ex.fields; const factors = []; let band = 0;
  const c = f.estimatedCost || 0;
  const cb = c > 20000 ? 3 : c > 10000 ? 2 : c >= 3000 ? 1 : 0; band = cb;
  factors.push({ factor: `Estimated cost ${f.estimatedCost ? money(c) : 'unknown'}`, effect: `→ ${BANDS[cb]}`, evidence: ex.citations.estimatedCost });
  if (f.alternativeAccommodationNeeded) { band = Math.max(band, 2); factors.push({ factor: 'Home not reasonably habitable', effect: '→ at least High', evidence: ex.citations.alternativeAccommodationNeeded }); }
  if (vul.vulnerable) { band = Math.max(band, 2); factors.push({ factor: `Customer may need extra support (${vul.drivers.map(d => d.driver).join(', ')})`, effect: '→ at least High (more support, never less cover)', evidence: vul.drivers[0].evidence }); }
  if (cov.decision !== 'covered') { if (cov.decision === 'excluded' && c > 10000) { band = 3; factors.push({ factor: 'Likely declinature / condition issue on a large loss', effect: '→ Complex', evidence: null }); } else { band = Math.max(band, 1); factors.push({ factor: 'Coverage question', effect: '→ at least Medium', evidence: null }); } }
  const severity = BANDS[band];
  const flags = []; if (fr.refer) flags.push('SIU review before settlement'); if (f.thirdPartyInvolved) flags.push('Recovery opportunity – notify recovery team (SOP-REC-05)');
  return { severity, route: ROUTES[severity], factors, flags, sop: 'SOP-TRI-01' };
}

// ---------- Claim summary with citations ----------
export function summary(ctx) {
  const ex = extract(ctx); const f = ex.fields; const c = ex.citations; const st = [];
  const add = (text, ...cites) => st.push({ text, citations: cites.filter(Boolean) });
  if (f.causeOfLoss && f.dateOfLoss) add(`Escape of water reported – cause: ${f.causeOfLoss.toLowerCase()}, date of loss ${fmtDate(f.dateOfLoss)}.`, c.dateOfLoss, c.causeOfLoss);
  if (f.roomsAffected.length) add(`Areas affected: ${f.roomsAffected.join(', ')}.`, c.roomsAffected);
  if (f.estimatedCost) add(`Current estimate ${money(f.estimatedCost)}.`, c.estimatedCost);
  if (!f.propertyOccupied) { const since = parseDate(c.propertyOccupied.quote); add(`Property unoccupied since ${since ? fmtDate(since) : 'an unknown date'} – ${f.unoccupiedDays} days before the date of loss (calculated).`, c.propertyOccupied); }
  for (const g of ctx.guardrailEvents || []) add(`Guardrail: a hidden instruction aimed at the AI was found in "${g.docTitle}" and ${g.action === 'sanitised' ? 'removed' : 'quarantined'}. It has not been acted on.`, { docId: g.docId, docTitle: g.docTitle + ' (original)', quote: gQuote(g.match) });
  if (f.alternativeAccommodationNeeded) add('Home is not reasonably habitable – alternative accommodation is needed.', c.alternativeAccommodationNeeded);
  if (f.thirdPartyInvolved) add('Water came from a neighbouring property – potential recovery.', c.thirdPartyInvolved);
  const vul = vulnerability(ctx); if (vul.vulnerable) add(`Customer has shared circumstances that may need extra support (${vul.drivers.map(d => d.driver.toLowerCase()).join(', ')}).`, ...vul.drivers.map(d => d.evidence));
  const fr = fraud(ctx, ex); const frNonManip = fr.indicators.filter(i => i.id !== 'FI-MANIP'); if (frNonManip.length) add(`${frNonManip.length} fraud indicator(s) present – review before settlement.`, ...frNonManip.map(i => i.evidence).filter(Boolean).slice(0, 2));
  const rec = findQuote(ctx.docs, /^Recommendation:/, ['Loss adjuster report']); if (rec) add(`Adjuster: ${rec.quote.replace(/^Recommendation:\s*/, '')}`, rec);
  const contact = ctx.claim.preferredContact; 
  return { statements: st, headline: `${ctx.claim.claimNumber} · ${f.causeOfLoss || 'Escape of water'} · ${f.estimatedCost ? money(f.estimatedCost) : 'estimate pending'}`, preferredContact: contact };
}

// ---------- Customer update draft (Consumer Duty) ----------
export function customerUpdate(ctx) {
  const ex = extract(ctx); const cov = coverage(ctx, ex); const vul = vulnerability(ctx); const fr = fraud(ctx, ex); const tri = triage(ctx, ex, cov, vul, fr);
  const first = ctx.claim.insuredName.split(' ')[0]; const L = [];
  L.push(`Dear ${ctx.claim.insuredTitle} ${ctx.claim.insuredName.split(' ').slice(-1)[0]},`);
  L.push(`Thank you for telling us about the water damage at your home. We are sorry this has happened. Your claim number is ${ctx.claim.claimNumber}.`);
  L.push('What happens next:');
  if (fr.refer) L.push('- We need to look at the damage and the paperwork in more detail before we can go further. A member of our team will call you within 2 working days to arrange this.');
  else if (cov.decision === 'excluded') L.push('- Your claim handler is checking what your policy covers for this type of damage. We will write to you within 5 working days to explain the outcome and the reasons for it.');
  else if (cov.decision === 'refer') L.push('- We need to check a few details about the repairs. Your claim handler will call you within 2 working days.');
  else L.push(tri.severity === 'Low' ? '- We will review your quote and aim to contact you with the next step within 5 working days.' : '- Your claim handler will contact you within 2 working days to agree the next steps for the repairs.');
  if (ex.fields.alternativeAccommodationNeeded && cov.decision === 'covered') L.push('- We know your home is hard to live in right now. We will help you find somewhere suitable to stay, and we aim to have this in place within 24 hours.');
  if (vul.vulnerable) L.push(vul.drivers.some(d => d.driver === 'Capability') ? '- We will send our letters in large print and call your nominated contact first, as you asked. If you need any other extra support, just tell us.' : '- If you need any extra support, or would like us to call you instead of writing, just tell us and we will make it a priority.');
  L.push('- Please keep any damaged items, photos and receipts until we have seen them.');
  L.push('If you have any questions, please contact your claim handler on 0300 000 0000 (synthetic number), Monday to Friday, 8am to 6pm. If you are unhappy with our service, you can complain at any time and we will help you.');
  L.push(`Kind regards,\n${ctx.handler}`);
  const text = L.join('\n\n');
  return { text, channel: vul.drivers.some(d => d.driver === 'Capability') ? 'Large-print letter + call to nominated contact' : ctx.claim.preferredContact, coverageConfirmed: false, vulnerable: vul.vulnerable, firstName: first };
}

// ---------- Knowledge Q&A (RAG over policy + SOPs) ----------
export const QA_MIN_SCORE = 3.0;
export function knowledgeQA(question) {
  const hits = search(KB_INDEX, question, 3);
  if (!hits.length || hits[0].score < QA_MIN_SCORE) return { answer: 'I cannot find this in the approved policy wording or claims procedures. Please refer the question to Technical Claims.', abstained: true, citations: [], hits };
  const top = hits[0];
  const answer = `${top.text}`;
  const cites = [{ docId: top.id, docTitle: `${top.source} – ${top.title}`, quote: top.text }];
  return { answer, abstained: false, citations: cites, hits, confidence: +(Math.min(1, top.score / 10)).toFixed(2) };
}
export const SOP_IDS = SOPS.map(s => s.id);
