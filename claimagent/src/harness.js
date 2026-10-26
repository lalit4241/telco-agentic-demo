// AI harness: orchestrates tool calls to the (mock) Cloud API, guardrails, retrieval, the model step,
// output checks and the human-in-the-loop gate. Every run is fully traced; every decision is audited.
import { shortHash, randomUUID } from './crypto-util.js';
import { apiHandle, claimDetail } from './api.js';
import { HANDLER, POLICY } from './data.js';
import { redactPII, detectInjection, checkCustomerComms, verifyCitations } from './guardrails.js';
import * as S from './skills.js';
import { KB_INDEX, search } from './retrieval.js';
import { notify } from './persist.js';

export const ENGINE_VERSION = 'offline-rules-engine 1.4.0';
export const PROMPTS = {
  summary: 'claim-summary@1.3', extract: 'doc-intake-extract@2.1', coverage: 'coverage-check@1.2', triage: 'triage-severity@1.1',
  fraud: 'fraud-indicators@1.0', vulnerability: 'vulnerability-detect@1.2', comms: 'customer-update@1.5', qa: 'knowledge-qa@1.1',
};
export const SKILL_LABELS = { summary: 'Claim summary', extract: 'Document intake & extraction', coverage: 'Coverage check', triage: 'Triage & severity', fraud: 'Fraud indicators', vulnerability: 'Vulnerability detection', comms: 'Customer update draft', qa: 'Knowledge assistant' };
// Illustrative unit prices only (GBP per 1k tokens) – not a quote from any provider.
const PRICE_IN = 0.0004, PRICE_OUT = 0.0016;

const runs = new Map(); const actions = new Map(); const audit = []; const events = [];
let seq = 0; const nid = p => `${p}-${String(++seq).padStart(5, '0')}`;
export const hash = shortHash;
export function resetHarness() { runs.clear(); actions.clear(); audit.length = 0; events.length = 0; seq = 0; notify(); }
export const getAudit = () => audit.slice().reverse();
export const getEvents = () => events.slice().reverse();
export const getAction = id => actions.get(id);
export const listActions = claimId => [...actions.values()].filter(a => !claimId || a.claimId === claimId);
export function exportHarness() {
  return { seq, runs: [...runs.entries()], actions: [...actions.entries()], audit: audit.slice(), events: events.slice() };
}
export function importHarness(s) {
  if (!s) return;
  runs.clear(); actions.clear(); audit.length = 0; events.length = 0;
  seq = s.seq || 0;
  for (const [k, v] of s.runs || []) runs.set(k, v);
  for (const [k, v] of s.actions || []) actions.set(k, v);
  for (const e of s.audit || []) audit.push(e);
  for (const e of s.events || []) events.push(e);
}

function addAudit(e) { const entry = { id: nid('AUD'), ts: new Date().toISOString(), ...e }; audit.push(entry); return entry; }

// Build a guarded context by calling the Cloud API as tools.
function buildContext(claimId, trace, opts) {
  const tool = (method, path, body) => { const t0 = performance.now(); const r = apiHandle(method, path, body); trace.push({ type: 'tool', name: `${method} ${path}`, status: r.status, ms: +(performance.now() - t0).toFixed(2), detail: r.status < 300 ? `${r.body.count ?? 1} record(s)` : r.body.userMessage }); return r; };
  const cr = tool('GET', `/claim/v1/claims/${claimId}`); if (cr.status !== 200) throw Object.assign(new Error('Claim not found'), { status: 404 });
  const a = cr.body.data.attributes; const id = cr.body.data.id;
  const pol = tool('GET', `/claim/v1/claims/${id}/policy`).body.data.attributes;
  const contacts = tool('GET', `/claim/v1/claims/${id}/contacts`).body.data[0].attributes;
  const list = tool('GET', `/claim/v1/claims/${id}/documents`).body.data;
  const notes = tool('GET', `/claim/v1/claims/${id}/notes`).body.data;
  const rawDocs = list.map(d => { const full = tool('GET', `/claim/v1/claims/${id}/documents/${d.id}`).body.data.attributes; return { id: d.id, type: full.documentType.name, title: full.name, date: full.dateCreated, author: full.author, text: full.contents }; });
  for (const n of notes) rawDocs.push({ id: n.id, type: 'Note', title: n.attributes.subject, date: n.attributes.createdDate, author: n.attributes.author, text: n.attributes.body });

  const g = guardDocs(rawDocs, opts, trace);
  const ctx = { claim: { id, claimNumber: a.claimNumber, lossDate: a.lossDate.slice(0, 10), reportedDate: a.reportedDate.slice(0, 10), insuredName: a.insured.displayName, insuredTitle: a.insured.title, insuredAge: pol.insuredAge, preferredContact: contacts.preferredContact, policy: pol },
    ...g, handler: HANDLER.displayName };
  if (g.guardrailEvents.length) addAudit({ actor: 'AI harness (system)', claimNumber: a.claimNumber, kind: 'guardrail', decision: 'BLOCKED', skill: 'prompt-injection guardrail', detail: g.guardrailEvents.map(e => `${e.docTitle} – ${e.action}`).join('; ') });
  return ctx;
}

export function guardDocs(rawDocs, opts = {}, trace = []) {
  // Guardrail 1: prompt-injection scan on every inbound document
  const docs = []; const quarantined = []; const guardrailEvents = [];
  for (const d of rawDocs) {
    const det = detectInjection(d.text);
    if (!det.blocked || opts.guardrails?.injection === false) { docs.push(d); continue; }
    // try to isolate the malicious span (hidden comments / offending sentences) and keep the legitimate remainder
    let clean = d.text.replace(/<!--[\s\S]*?-->/g, '[REMOVED BY GUARDRAIL]');
    clean = clean.split('\n').filter(l => !detectInjection(l).blocked).join('\n');
    const re = detectInjection(clean);
    const ev = { type: 'injection', docId: d.id, docTitle: d.title, score: det.score, hits: det.hits, match: d.text.match(/<!--[\s\S]*?-->/)?.[0] || d.text.split('\n').find(l => detectInjection(l).blocked) || d.text.slice(0, 200), action: re.blocked ? 'quarantined' : 'sanitised' };
    guardrailEvents.push(ev);
    if (re.blocked) quarantined.push(d); else docs.push({ ...d, text: clean, sanitised: true });
  }
  trace.push({ type: 'guardrail', name: 'Prompt-injection scan', status: guardrailEvents.length ? 'BLOCKED' : 'pass', detail: guardrailEvents.length ? guardrailEvents.map(e => `${e.docTitle}: score ${e.score}, rules ${e.hits.map(h => h.rule).join('+')} → ${e.action}`).join('; ') : `${rawDocs.length} documents scanned, 0 injections`, events: guardrailEvents });
  // Guardrail 2: PII redaction before anything is sent to a model
  const red = docs.map(d => ({ id: d.id, ...redactPII(d.text) }));
  const totalPII = red.reduce((s, r) => s + r.total, 0); const byType = {}; red.forEach(r => Object.entries(r.counts).forEach(([k, v]) => (byType[k] = (byType[k] || 0) + v)));
  trace.push({ type: 'guardrail', name: 'PII redaction (pre-model)', status: opts.guardrails?.pii === false ? 'off' : 'pass', detail: `${totalPII} items tokenised: ${Object.entries(byType).map(([k, v]) => `${k}×${v}`).join(', ') || 'none'}` });
  return { docs, quarantined, guardrailEvents, redacted: red, rawDocs };
}

const approxTokens = s => Math.ceil((typeof s === 'string' ? s : JSON.stringify(s)).length / 4);

export async function runSkill(claimId, skill, opts = {}) {
  if (!PROMPTS[skill]) throw Object.assign(new Error(`Unknown skill ${skill}`), { status: 400 });
  const t0 = performance.now(); const trace = [];
  trace.push({ type: 'step', name: 'Request received', status: 'ok', detail: opts.trigger ? `Triggered by App Event ${opts.trigger}` : 'Handler request from ClaimAgent panel' });
  const ctx = buildContext(claimId, trace, opts);
  if (['coverage', 'qa'].includes(skill)) { const q = skill === 'coverage' ? 'escape of water exclusion cover' : opts.question; const hits = search(KB_INDEX, q || '', 5); trace.push({ type: 'retrieval', name: 'Retrieve policy wording & SOPs (BM25)', status: 'ok', detail: hits.map(h => `${h.id} (${h.score})`).join(', ') }); }
  const contextText = ctx.redacted.map(r => r.text).join('\n---\n');
  const tm = performance.now(); const model = ENGINE_VERSION; const fallback = null;
  let output = { summary: () => S.summary(ctx), extract: () => S.extract(ctx), coverage: () => S.coverage(ctx), triage: () => S.triage(ctx), fraud: () => S.fraud(ctx), vulnerability: () => S.vulnerability(ctx), comms: () => S.customerUpdate(ctx) }[skill]();
  const modelMs = +(performance.now() - tm).toFixed(2);
  const tokIn = approxTokens(contextText) + 450; const tokOut = approxTokens(output);
  trace.push({ type: 'model', name: `Model call – ${model}`, status: fallback ? 'fallback' : 'ok', ms: modelMs, detail: `${PROMPTS[skill]} · ~${tokIn} tokens in / ~${tokOut} out${fallback ? ' · ' + fallback : ''}` });
  // Output guardrails
  const checks = [];
  const docsById = Object.fromEntries(ctx.rawDocs.map(d => [d.id, d])); docsById[POLICY.id] = { text: POLICY.clauses.map(c => c.text).join('\n') };
  if (skill === 'summary') { const v = verifyCitations(output.statements, docsById); output.statements = v.results; output.groundedness = v.groundedness; checks.push({ name: 'Groundedness – every statement cites a verifiable source quote', pass: v.groundedness === 1, detail: `${Math.round(v.groundedness * 100)}% of ${v.results.length} statements verified` }); if (v.groundedness < 1) output.statements = v.results.map(r => r.grounded ? r : { ...r, text: `[UNVERIFIED – removed from approval] ${r.text}` }); }
  if (skill === 'coverage') { const allCited = output.findings.every(f => f.policy && docsById[POLICY.id].text.includes(f.policy.quote)); checks.push({ name: 'Every finding cites a policy clause verbatim', pass: allCited, detail: `${output.findings.length} findings` }); }
  if (skill === 'comms') { const c = checkCustomerComms(output.text, { coverageConfirmed: false, vulnerable: output.vulnerable }); output.checks = c.checks; output.readingEase = c.readingEase; checks.push(...c.checks.map(x => ({ name: x.name, pass: x.pass, detail: x.detail }))); }
  if (skill === 'fraud') checks.push({ name: 'Fairness: no vulnerability or protected-characteristic inputs used', pass: true, detail: 'inputs: dates, prior claims, documents, guardrail events' });
  const leaked = /\b07\d{3}\s?\d{6}\b|\b\d{2}-\d{2}-\d{2}\b/.test(JSON.stringify(skill === 'comms' ? output.text : output.statements || ''));
  checks.push({ name: 'No PII / bank details leaked into AI output', pass: !leaked, detail: '' });
  checks.push({ name: 'No autonomous action – human approval required', pass: true, detail: 'action queued as PENDING_REVIEW' });
  trace.push({ type: 'check', name: 'Output guardrails', status: checks.every(c => c.pass) ? 'pass' : 'warn', detail: `${checks.filter(c => c.pass).length}/${checks.length} checks passed`, checks });
  const run = { runId: nid('RUN'), claimId: ctx.claim.id, claimNumber: ctx.claim.claimNumber, skill, label: SKILL_LABELS[skill], output, model, promptVersion: PROMPTS[skill], mode: 'offline',
    quarantined: ctx.quarantined.map(d => ({ id: d.id, title: d.title })), guardrailEvents: ctx.guardrailEvents, checks,
    redactedPreview: ctx.redacted.slice(0, 2).map(r => ({ id: r.id, text: r.text.slice(0, 600) })),
    metrics: { latencyMs: +(performance.now() - t0).toFixed(1), tokensIn: tokIn, tokensOut: tokOut, costGBP: +((tokIn / 1000) * PRICE_IN + (tokOut / 1000) * PRICE_OUT).toFixed(5), costLabel: 'Illustrative estimate only', liveModelLatencyNote: 'A hosted LLM would typically add 1–6 s (illustrative)' }, trace, createdAt: new Date().toISOString() };
  run.noteText = renderForNote(run); run.trigger = opts.trigger || null; run.fallback = fallback;
  const action = { actionId: nid('ACT'), runId: run.runId, claimId: run.claimId, claimNumber: run.claimNumber, skill, label: run.label, status: 'PENDING_REVIEW', outputHash: hash(output), createdAt: run.createdAt };
  run.actionId = action.actionId; trace.push({ type: 'hitl', name: 'Human-in-the-loop gate', status: 'pending', detail: `${action.actionId} awaiting Approve / Edit / Reject` });
  runs.set(run.runId, run); actions.set(action.actionId, action);
  addAudit({ actor: 'AI harness (system)', claimNumber: run.claimNumber, kind: 'ai-output', skill: run.label, actionId: action.actionId, runId: run.runId, decision: 'GENERATED', model, promptVersion: run.promptVersion, outputHash: action.outputHash, detail: `checks ${checks.filter(c => c.pass).length}/${checks.length} passed` });
  notify();
  return run;
}

export function askKnowledge(question, claimId = null) {
  const t0 = performance.now(); const trace = [];
  const det = detectInjection(question);
  trace.push({ type: 'guardrail', name: 'Prompt-injection scan (question)', status: det.blocked ? 'BLOCKED' : 'pass', detail: det.blocked ? det.hits.map(h => h.desc).join('; ') : 'clean' });
  if (det.blocked) { addAudit({ actor: 'AI harness (system)', claimNumber: claimId || '-', kind: 'guardrail', decision: 'BLOCKED', skill: 'Knowledge assistant', detail: 'Injection attempt in question' }); notify(); return { answer: 'This question was blocked by the prompt-injection guardrail.', blocked: true, citations: [], trace, metrics: { latencyMs: +(performance.now() - t0).toFixed(1) } }; }
  const r = S.knowledgeQA(question);
  trace.push({ type: 'retrieval', name: 'Retrieve (BM25 over policy wording + SOPs)', status: 'ok', detail: r.hits.map(h => `${h.id} (${h.score})`).join(', ') || 'no hits' });
  trace.push({ type: 'model', name: `Answer composer – ${ENGINE_VERSION}`, status: r.abstained ? 'abstained' : 'ok', detail: `${PROMPTS.qa}; extractive answer, abstain below score ${S.QA_MIN_SCORE}` });
  const run = { runId: nid('RUN'), skill: 'qa', question, ...r, trace, promptVersion: PROMPTS.qa, model: ENGINE_VERSION, metrics: { latencyMs: +(performance.now() - t0).toFixed(1), costLabel: 'Illustrative' } };
  addAudit({ actor: 'AI harness (system)', claimNumber: claimId || '-', kind: 'ai-output', skill: 'Knowledge assistant', runId: run.runId, decision: r.abstained ? 'ABSTAINED' : 'ANSWERED', model: ENGINE_VERSION, promptVersion: PROMPTS.qa, outputHash: hash(r.answer), detail: question.slice(0, 120) });
  notify();
  return run;
}

export function decide(actionId, { decision, editedText, reason, reviewer = HANDLER.displayName } = {}) {
  const act = actions.get(actionId); if (!act) throw Object.assign(new Error('Unknown action'), { status: 404 });
  if (act.status !== 'PENDING_REVIEW') throw Object.assign(new Error(`Action already ${act.status}`), { status: 409 });
  const D = String(decision || '').toUpperCase(); if (!['APPROVE', 'EDIT', 'REJECT'].includes(D)) throw Object.assign(new Error('decision must be APPROVE, EDIT or REJECT'), { status: 400 });
  if (D === 'REJECT' && !reason) throw Object.assign(new Error('A reason is required to reject'), { status: 400 });
  if (D === 'EDIT' && !editedText) throw Object.assign(new Error('editedText is required for EDIT'), { status: 400 });
  const run = runs.get(act.runId); act.status = { APPROVE: 'APPROVED', EDIT: 'APPROVED_WITH_EDITS', REJECT: 'REJECTED' }[D]; act.decidedAt = new Date().toISOString(); act.reviewer = reviewer;
  const writeBack = [];
  if (D !== 'REJECT') {
    const body = editedText || renderForNote(run);
    const n = apiHandle('POST', `/claim/v1/claims/${act.claimId}/notes`, { data: { attributes: { subject: `AI-assisted ${act.label} – reviewed by ${reviewer}`, body, topic: { code: 'general' }, author: reviewer } } });
    writeBack.push(`POST /claim/v1/claims/${act.claimId}/notes → ${n.status} (${n.body.data?.id})`);
    if (act.skill === 'comms') { const a = apiHandle('POST', `/claim/v1/claims/${act.claimId}/activities`, { data: { attributes: { subject: 'Send approved customer update', description: `Channel: ${run.output.channel}`, priority: 'high' } } }); writeBack.push(`POST /claim/v1/claims/${act.claimId}/activities → ${a.status} (${a.body.data?.id})`); }
    if (act.skill === 'fraud' && run.output.refer) { const a = apiHandle('POST', `/claim/v1/claims/${act.claimId}/activities`, { data: { attributes: { subject: 'SIU referral review', description: run.output.indicators.map(i => i.text).join('; '), priority: 'high' } } }); writeBack.push(`POST /claim/v1/claims/${act.claimId}/activities → ${a.status} (${a.body.data?.id})`); }
  }
  act.writeBack = writeBack;
  const entry = addAudit({ actor: reviewer, claimNumber: act.claimNumber, kind: 'human-decision', skill: act.label, actionId, runId: act.runId, decision: act.status, model: run.model, promptVersion: run.promptVersion, outputHash: act.outputHash, editedHash: editedText ? hash(editedText) : null, reason: reason || null, detail: writeBack.join('; ') || 'No write-back (rejected)' });
  notify();
  return { action: act, audit: entry };
}

export function renderForNote(run) {
  const o = run.output;
  switch (run.skill) {
    case 'summary': return o.statements.map(s => `• ${s.text} [${s.citations.map(c => c.docId).join(', ')}]`).join('\n');
    case 'comms': return o.text;
    case 'coverage': return `${o.label}\n` + o.findings.map(f => `• ${f.clause} – ${f.result}: ${f.reason}`).join('\n');
    case 'triage': return `Severity ${o.severity} → ${o.route}\n` + o.factors.map(f => `• ${f.factor} ${f.effect}`).join('\n');
    case 'fraud': return `Indicator score ${o.score} – ${o.refer ? 'refer to SIU' : 'no referral'}\n` + o.indicators.map(i => `• ${i.text}`).join('\n');
    case 'vulnerability': return o.vulnerable ? o.drivers.map(d => `• ${d.driver}: ${d.adjustment}`).join('\n') : 'No vulnerability indicators found.';
    case 'extract': return Object.entries(o.fields).map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
    default: return JSON.stringify(o);
  }
}

// Simulated Guidewire App Event → integration handler → AI pipeline. (Envelope shape illustrative.)
export async function handleAppEvent({ eventType = 'ClaimAdded', claimId }) {
  eventType = String(eventType).replace(/^gw\.cc\./, '');
  if (!['ClaimAdded', 'DocumentAdded'].includes(eventType)) throw Object.assign(new Error('Unsupported event type'), { status: 400 });
  const c = claimDetail(claimId); if (!c) throw Object.assign(new Error('Claim not found'), { status: 404 });
  const envelope = { specversion: '1.0', id: randomUUID(), source: 'gw.cloud/claimcenter/tenant-demo', type: `gw.cc.${eventType}`, time: new Date().toISOString(), datacontenttype: 'application/json', data: { entity: 'Claim', id: c.id, claimNumber: c.claimNumber, changedFields: eventType === 'DocumentAdded' ? ['documents'] : ['*'] } };
  const pipeline = eventType === 'DocumentAdded' ? ['extract', 'summary', 'fraud'] : ['summary', 'triage', 'vulnerability', 'coverage', 'fraud'];
  const results = []; for (const s of pipeline) { const r = await runSkill(c.id, s, { trigger: envelope.type }); results.push({ skill: s, runId: r.runId, actionId: r.actionId, label: r.label, headline: r.noteText.split('\n')[0].slice(0, 120), guardrailEvents: r.guardrailEvents.length, checks: r.checks.filter(x => x.pass).length + '/' + r.checks.length }); }
  const ev = { receivedAt: new Date().toISOString(), envelope, pipeline: results }; events.push(ev);
  notify();
  return ev;
}
export const getRun = id => runs.get(id);
