// In-browser stand-in for server.js. Same routes, no HTTP. State stays in the module singletons
// and, when enablePersistence() has run, in localStorage. Reset demo clears that key.
import { apiHandle, claimDetail, getStore, importStore, resetStore } from './api.js';
import { runSkill, decide, getAudit, getEvents, handleAppEvent, askKnowledge, listActions, resetHarness, getRun, exportHarness, importHarness, PROMPTS, SKILL_LABELS, ENGINE_VERSION } from './harness.js';
import { runEvals } from './evals.js';
import { KPIS, BUSINESS_CASE } from './business.js';
import { POLICY, SOPS } from './data.js';
import { notify, onChange } from './persist.js';

const KEY = 'claimagent-demo-state-v1';
let evalHistory = [];
let storageRef = null;

function snapshot() {
  return { v: 1, store: getStore(), harness: exportHarness(), evalHistory };
}

export function enablePersistence(storage) {
  storageRef = storage || null;
  if (!storageRef) return;
  try {
    const raw = storageRef.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.store) importStore(s.store);
      if (s && s.harness) importHarness(s.harness);
      if (s && Array.isArray(s.evalHistory)) evalHistory = s.evalHistory;
    }
  } catch { /* keep the seeded demo */ }
  onChange(() => {
    try { storageRef.setItem(KEY, JSON.stringify(snapshot())); } catch { /* quota or private mode */ }
  });
}

export function resetAll() {
  evalHistory = [];
  resetStore();
  resetHarness();
  try { storageRef && storageRef.removeItem(KEY); } catch { /* ignore */ }
  notify();
}

function send(status, body) { return { status, body }; }

export async function handle(method, path, body) {
  try {
    const url = new URL(path, 'http://localhost'); const p = url.pathname; const m = method;
    if (p.startsWith('/claim/v1')) { const r = apiHandle(m, p + url.search, m === 'POST' ? body : null); return send(r.status, r.body); }
    if (p.startsWith('/api/')) {
      const b = body || {};
      let mm;
      if (p === '/api/health') return send(200, { ok: true, engine: ENGINE_VERSION, llmAvailable: false, llmModel: null });
      if (p === '/api/config') return send(200, { prompts: PROMPTS, skills: SKILL_LABELS, engine: ENGINE_VERSION, llm: { available: false, model: null } });
      if (p === '/api/claims' && m === 'GET') return send(200, getStore().claims.map(c => { const d = claimDetail(c.id); return { id: c.id, claimNumber: c.claimNumber, insured: c.insured.name, address: c.insured.address, lossDate: c.lossDate, reportedDate: c.reportedDate, status: c.status, lossType: c.lossType, reserve: c.reserve, pending: listActions(c.id).filter(a => a.status === 'PENDING_REVIEW').length, notes: d.notes.length }; }));
      if ((mm = p.match(/^\/api\/claims\/([^/]+)$/)) && m === 'GET') { const d = claimDetail(decodeURIComponent(mm[1])); return d ? send(200, { ...d, actions: listActions(d.id) }) : send(404, { error: 'not found' }); }
      if ((mm = p.match(/^\/api\/claims\/([^/]+)\/ai\/([a-z]+)$/)) && m === 'POST') return send(200, await runSkill(decodeURIComponent(mm[1]), mm[2], b));
      if ((mm = p.match(/^\/api\/runs\/([^/]+)$/)) && m === 'GET') { const r = getRun(mm[1]); return r ? send(200, r) : send(404, { error: 'not found' }); }
      if ((mm = p.match(/^\/api\/actions\/([^/]+)\/decision$/)) && m === 'POST') return send(200, decide(mm[1], b));
      if (p === '/api/knowledge/ask' && m === 'POST') return send(200, askKnowledge(String(b.question || ''), b.claimId));
      if (p === '/api/knowledge' && m === 'GET') return send(200, { policy: POLICY, sops: SOPS });
      if (p === '/api/events/app-event' && m === 'POST') return send(200, await handleAppEvent(b));
      if (p === '/api/events' && m === 'GET') return send(200, getEvents());
      if (p === '/api/audit' && m === 'GET') return send(200, getAudit());
      if (p === '/api/evals/run' && m === 'POST') { const r = runEvals({ injectionGuardrail: b.injectionGuardrail !== false }); evalHistory.push({ runAt: r.runAt, gate: r.summary.gate, passed: r.summary.passed, total: r.summary.total, config: r.config }); notify(); return send(200, { ...r, history: evalHistory.slice(-10).reverse() }); }
      if (p === '/api/business' && m === 'GET') return send(200, { kpis: KPIS, businessCase: BUSINESS_CASE });
      if (p === '/api/reset' && m === 'POST') { resetAll(); return send(200, { ok: true }); }
      return send(404, { error: 'Unknown API route' });
    }
    return send(404, { error: 'Unknown route' });
  } catch (e) { return send(e.status || 500, { error: e.message }); }
}
