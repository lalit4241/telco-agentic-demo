// ClaimAgent – vanilla JS SPA. All data is synthetic. Calls the in-browser engine (no server).
import { handle, enablePersistence } from './client.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = n => n == null ? '–' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
const fmtT = d => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
async function api(path, body) {
  const r = await handle(body === undefined ? 'GET' : 'POST', path, body);
  if (r.status >= 400) throw new Error(r.body.error || r.body.userMessage || ('Request failed (' + r.status + ')'));
  return r.body;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); }

const S = { cfg: null, runs: new Map(), highlight: null, guard: {}, evalGuard: true, lastEvent: null, qa: {}, openHood: new Set(), editing: new Set(), rejecting: new Set(), busy: null, roi: null };

function parseHash() {
  const h = location.hash.slice(1) || '/claims'; const [p, q] = h.split('?');
  return { parts: p.split('/').filter(Boolean), q: new URLSearchParams(q || '') };
}
window.addEventListener('hashchange', route);
async function route() {
  const { parts, q } = parseHash(); const page = parts[0] || 'claims';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === (page === 'claim' ? 'claims' : page)));
  try {
    if (page === 'claims') return await pageClaims();
    if (page === 'claim') return await pageClaim(decodeURIComponent(parts[1]), parts[2] || 'summary', q);
    if (page === 'quality') return await pageQuality(q);
    if (page === 'business') return await pageBusiness();
    if (page === 'architecture') return await pageArch();
    if (page === 'audit') return await pageAudit();
    location.hash = '#/claims';
  } catch (e) { $('#view').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; console.error(e); }
}

/* ---------------- Claims desktop ---------------- */
async function pageClaims() {
  const [claims, events] = await Promise.all([api('/api/claims'), api('/api/events')]);
  $('#view').innerHTML = `
  <div class="grid" style="grid-template-columns:minmax(0,1fr) 430px">
    <div class="card">
      <div class="row between mb"><div><h1>My claims</h1><div class="muted">Assigned to Alex Patel · Home – escape-of-water pilot queue · ${claims.length} open</div></div>
      <span class="pill p-ai">ClaimAgent enabled for this queue</span></div>
      <table><thead><tr><th>Claim</th><th>Insured</th><th>Loss location</th><th>Loss date</th><th>Cause</th><th>Reserve</th><th>Status</th><th>AI review queue</th></tr></thead><tbody>
      ${claims.map(c => `<tr class="click" data-id="${esc(c.id)}"><td><b>${esc(c.claimNumber)}</b><div class="muted small">${esc(c.id)}</div></td><td>${esc(c.insured)}</td><td class="small">${esc(c.address)}</td><td>${fmtD(c.lossDate)}</td><td>${esc(c.lossType)}</td><td>${gbp(c.reserve)}</td><td><span class="pill p-teal">${esc(c.status)}</span></td>
      <td>${c.pending ? `<span class="pill p-warn">${c.pending} awaiting approval</span>` : '<span class="muted small">–</span>'}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted small mt">Scenarios: vulnerable bereaved customer · straightforward low-value · excluded (sealant/gradual) · fraud indicators · unoccupied property · <b>prompt-injection email</b> · flat leak with recovery.</p>
    </div>
    <div class="card">
      <h2>Simulate a Guidewire App Event</h2>
      <p class="muted small">In production ClaimCenter publishes App Events (e.g. on claim or document creation) to an integration endpoint. Here the event triggers the AI pipeline; outputs land in the handler's review queue – nothing is written to the claim until a human approves.</p>
      <div class="row wrap"><select id="evClaim">${claims.map(c => `<option value="${esc(c.id)}">${esc(c.claimNumber)} – ${esc(c.insured)}</option>`).join('')}</select>
      <select id="evType"><option>ClaimAdded</option><option>DocumentAdded</option></select><button class="btn ai" id="evFire">Fire event</button></div>
      <div id="evOut" class="mt">${S.lastEvent ? renderEvent(S.lastEvent) : ''}</div>
      <h3 class="mt">Event log</h3>
      ${events.length ? `<table class="small"><tr><th>Received</th><th>Type</th><th>Claim</th><th>Runs</th></tr>${events.slice().reverse().slice(0, 8).map(e => `<tr><td>${fmtT(e.receivedAt)}</td><td class="mono">${esc(e.envelope.type)}</td><td>${esc(e.envelope.data.claimNumber)}</td><td>${e.pipeline.length}</td></tr>`).join('')}</table>` : '<div class="muted small">No events yet.</div>'}
    </div>
  </div>`;
  document.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => location.hash = `#/claim/${tr.dataset.id}/summary`);
  $('#evFire').onclick = async () => {
    $('#evOut').innerHTML = '<span class="spin"></span> Event received – running pipeline…';
    S.lastEvent = await api('/api/events/app-event', { eventType: $('#evType').value, claimId: $('#evClaim').value });
    await pageClaims(); toast(`${S.lastEvent.envelope.type} processed – ${S.lastEvent.pipeline.length} AI outputs queued for review`);
  };
}
function renderEvent(ev) {
  return `<div class="alert ai small"><b>${esc(ev.envelope.type)}</b> for ${esc(ev.envelope.data.claimNumber)} → ${ev.pipeline.length} skills run, all <b>PENDING_REVIEW</b></div>
  <div class="event-env">${esc(JSON.stringify(ev.envelope, null, 2))}</div>
  <table class="small mt"><tr><th>Skill</th><th>Result</th><th>Checks</th></tr>${ev.pipeline.map(p => `<tr><td>${esc(p.label)}${p.guardrailEvents ? ' <span class="pill p-bad">guardrail</span>' : ''}</td><td>${esc(p.headline || '')}</td><td>${esc(p.checks)}</td></tr>`).join('')}</table>
  <a class="btn small mt" style="display:inline-block;text-decoration:none" href="#/claim/${esc(ev.envelope.data.id)}/summary">Open claim review queue →</a>`;
}

/* ---------------- Claim screen ---------------- */
const TABS = [['summary', 'Summary'], ['loss', 'Loss details'], ['parties', 'Parties involved'], ['policy', 'Policy'], ['documents', 'Documents'], ['notes', 'Notes'], ['activities', 'Activities'], ['financials', 'Financials']];
const SKILLS = [['summary', 'Summarise claim', 'cited summary of all docs'], ['extract', 'Document intake', 'extract fields from docs'], ['coverage', 'Coverage check', 'policy clause citations'], ['triage', 'Triage & severity', 'SOP-TRI-01 bands'], ['fraud', 'Fraud indicators', 'explainable flags'], ['vulnerability', 'Vulnerability', 'FCA FG21/1 drivers'], ['comms', 'Customer update', 'Consumer Duty draft']];
let CUR = null;
async function pageClaim(id, tab, q) {
  const d = await api('/api/claims/' + encodeURIComponent(id)); CUR = d;
  for (const a of d.actions) if (!S.runs.has(a.runId)) S.runs.set(a.runId, await api('/api/runs/' + a.runId));
  if (q.get('doc')) S.highlight = { docId: q.get('doc'), quote: q.get('q') || '' };
  const acts = d.actions.slice().sort((a, b) => b.runId.localeCompare(a.runId));
  if (q.get('hood')) acts.forEach(a => S.openHood.add(a.actionId));
  $('#view').innerHTML = `
  <div class="claimbar">
    <div><div class="k">Claim</div><div class="cn">${esc(d.claimNumber)}</div></div>
    <div><div class="k">Insured</div><div class="v">${esc(d.insured.title)} ${esc(d.insured.name)}</div></div>
    <div><div class="k">Loss date</div><div class="v">${fmtD(d.lossDate)}</div></div>
    <div><div class="k">Loss type</div><div class="v">${esc(d.lossType)}</div></div>
    <div><div class="k">Policy</div><div class="v">${esc(d.policy.policyNumber)}</div></div>
    <div><div class="k">Status</div><div class="v">${esc(d.status)}</div></div>
    <div><div class="k">Reserve</div><div class="v">${gbp(d.reserve)}</div></div>
    <div><div class="k">Assigned</div><div class="v">${esc(d.assignedUser)}</div></div>
    <div style="margin-left:auto"><a class="btn ghost small" style="color:#fff;text-decoration:none" href="#/claims">← Claims</a></div>
  </div>
  <div class="claimwrap">
    <div class="sidemenu"><div class="sec">Claim</div>${TABS.map(([k, l]) => `<a href="#/claim/${esc(id)}/${k}" class="${tab === k ? 'active' : ''}">${l}${k === 'documents' ? ` (${d.documents.length})` : k === 'notes' ? ` (${d.notes.length})` : k === 'activities' ? ` (${d.activities.length})` : ''}</a>`).join('')}
      <div class="sec">Pilot</div><a href="#/audit">Audit trail</a><a href="#/quality">AI quality</a></div>
    <div class="content">${renderTab(d, tab)}</div>
    <div class="copilot" id="copilot">${renderCopilot(d, acts)}</div>
  </div>`;
  bindCopilot(d);
  if (S.highlight) { const m = document.querySelector('.content mark'); if (m) m.scrollIntoView({ block: 'center' }); }
  const auto = q.get('run'); if (auto && !S._autoDone?.[location.hash]) { (S._autoDone ||= {})[location.hash] = 1; for (const s of auto.split(',')) await runAI(d.id, s, true); await pageClaim(id, tab, new URLSearchParams(q.get('hood') ? 'hood=1' : '')); }
  const ask = q.get('ask'); if (ask && !S.qa[d.id]) { S.qa[d.id] = await api('/api/knowledge/ask', { question: ask, claimId: d.id }); await pageClaim(id, tab, new URLSearchParams()); }
}
function hl(text, docId) {
  let h = esc(text);
  h = h.replace(/&lt;!--[\s\S]*?--&gt;/g, m => `<mark class="inj" title="Hidden HTML comment – flagged by prompt-injection guardrail">${m}</mark>`);
  if (S.highlight && S.highlight.docId === docId && S.highlight.quote) { const qq = esc(S.highlight.quote); const i = h.indexOf(qq); if (i >= 0) h = h.slice(0, i) + `<mark>${qq}</mark>` + h.slice(i + qq.length); }
  return h;
}
function renderTab(d, tab) {
  const p = d.policy, ins = d.insured;
  if (tab === 'summary') return `<h2>Summary</h2>
    <div class="grid g2"><div class="card"><h4>Claim</h4><div class="kv"><div>Claim number</div><div>${esc(d.claimNumber)}</div><div>Line of business</div><div>${esc(d.lob)}</div><div>Loss type</div><div>${esc(d.lossType)}</div><div>Date of loss</div><div>${fmtD(d.lossDate)}</div><div>Reported</div><div>${fmtD(d.reportedDate)}</div><div>Segment</div><div>${esc(d.segment)}</div></div></div>
    <div class="card"><h4>Financials</h4><div class="kv"><div>Reserve</div><div>${gbp(d.reserve)}</div><div>Paid to date</div><div>${gbp(d.paid)}</div><div>Excess (EoW)</div><div>${gbp(p.eowExcess)}</div><div>Prior claims</div><div>${p.priorClaims.length}</div></div></div></div>
    <h3 class="mt">Photos <span class="muted small">(placeholders)</span></h3><div class="photos">${d.photos.map(ph => `<div class="photo"><div class="ph">📷 ${esc(ph.id)}</div><div class="cap">${esc(ph.caption)}</div></div>`).join('')}</div>
    <h3 class="mt">Latest notes</h3>${d.notes.slice(-3).reverse().map(noteHtml).join('')}`;
  if (tab === 'loss') { const fnol = d.documents.find(x => x.type === 'FNOL transcript') || d.documents[0];
    return `<h2>Loss details</h2><div class="card mb"><div class="kv"><div>Loss location</div><div>${esc(ins.address)}</div><div>Loss cause</div><div>${esc(d.lossType)}</div><div>Date of loss</div><div>${fmtD(d.lossDate)}</div><div>How reported</div><div>${esc(fnol.author)}</div></div></div>
    <h3>FNOL – ${esc(fnol.title)}</h3><div class="docview">${hl(fnol.text, fnol.id)}</div>`; }
  if (tab === 'parties') return `<h2>Parties involved</h2><table><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Preferred contact</th></tr>
    <tr><td>${esc(ins.title)} ${esc(ins.name)}</td><td>Insured / main contact</td><td>${esc(ins.phone)}</td><td>${esc(ins.email)}</td><td>${esc(ins.preferredContact)}</td></tr></table>
    <p class="muted small mt">Phone numbers use the Ofcom drama range (07700 900xxx); emails use example.com.</p>`;
  if (tab === 'policy') return `<h2>Policy</h2><div class="card mb"><div class="kv"><div>Policy number</div><div>${esc(p.policyNumber)}</div><div>Product</div><div>${esc(p.product)}</div><div>Inception</div><div>${fmtD(p.inception)}</div><div>Buildings sum insured</div><div>${gbp(p.buildingsSumInsured)}</div><div>Contents sum insured</div><div>${gbp(p.contentsSumInsured)}</div><div>Escape-of-water excess</div><div>${gbp(p.eowExcess)}</div><div>Prior claims (CUE)</div><div>${p.priorClaims.length ? p.priorClaims.map(c => esc(typeof c === 'string' ? c : `${c.date || ''} ${c.type || ''} ${c.amount ? gbp(c.amount) : ''}`)).join('<br>') : 'None'}</div></div></div>
    <div id="wording" class="muted">Loading policy wording…</div>`;
  if (tab === 'documents') { const sel = d.documents.find(x => x.id === S.highlight?.docId) || d.documents[0]; const flagged = S.guard[d.id] || [];
    return `<h2>Documents</h2><div class="doclist"><div>${d.documents.map(x => `<div class="item ${x.id === sel.id ? 'active' : ''}" data-doc="${esc(x.id)}"><b>${esc(x.title)}</b><div class="small muted">${esc(x.type)} · ${fmtD(x.date)}</div>${flagged.includes(x.id) ? '<span class="pill p-bad">⚠ injection flagged</span>' : ''}</div>`).join('')}</div>
    <div><div class="row between"><h3>${esc(sel.title)}</h3><span class="muted small">${esc(sel.author)} · ${fmtD(sel.date)} · ${esc(sel.id)}</span></div><div class="docview">${hl(sel.text, sel.id)}</div></div></div>`; }
  if (tab === 'notes') return `<h2>Notes</h2>${d.notes.slice().reverse().map(noteHtml).join('') || '<p class="muted">No notes.</p>'}`;
  if (tab === 'activities') return `<h2>Activities</h2>${d.activities.length ? `<table><tr><th>Subject</th><th>Description</th><th>Priority</th><th>Created</th></tr>${d.activities.slice().reverse().map(a => `<tr><td><b>${esc(a.subject)}</b></td><td class="small">${esc(a.description)}</td><td>${esc(a.priority)}</td><td class="small">${fmtT(a.createdDate)}</td></tr>`).join('')}</table>` : '<p class="muted">No activities. Approving a customer update or an SIU referral creates one via POST /claim/v1/claims/{id}/activities.</p>'}`;
  if (tab === 'financials') return `<h2>Financials</h2><table><tr><th>Exposure</th><th>Coverage</th><th>Reserve</th><th>Paid</th></tr><tr><td>${p.buildingsSumInsured ? 'Dwelling – buildings' : 'Contents'}</td><td>${p.buildingsSumInsured ? 'Buildings' : 'Contents'}</td><td>${gbp(d.reserve)}</td><td>${gbp(d.paid)}</td></tr></table><p class="muted small mt">The AI never changes reserves or payments – financial authority stays with the handler (see injection scenario on HO-26-000106).</p>`;
  return '';
}
function noteHtml(n) { const ai = /AI-assisted/.test(n.subject); return `<div class="card mb" style="${ai ? 'border-color:#c9bdf2;background:#fbfaff' : ''}"><div class="row between"><b>${esc(n.subject)}</b><span class="small muted">${esc(n.author)} · ${n.createdDate.length > 10 ? fmtT(n.createdDate) : fmtD(n.createdDate)}</span></div><div style="white-space:pre-wrap" class="small mt">${esc(n.body)}</div>${ai ? '<div class="mt"><span class="pill p-ai">AI-assisted · human approved</span></div>' : ''}</div>`; }

function cite(c) { if (!c) return ''; const pol = !String(c.docId).startsWith('DOC-'); return `<a class="cite" data-doc="${esc(c.docId)}" data-q="${esc(c.quote)}" data-pol="${pol ? 1 : ''}" title="${esc(c.docTitle)}: “${esc(c.quote)}”">${esc(c.clauseId || c.docId)}</a>`; }
function renderCopilot(d, acts) {
  const qa = S.qa[d.id];
  return `<div class="copilot-h"><div class="spark">AI</div><div><b>ClaimAgent</b><div class="small muted">Offline engine · ${esc(S.cfg?.engine)} · human approves every action</div></div></div>
  <div class="skills">${SKILLS.map(([k, l, s]) => `<button data-skill="${k}" ${S.busy ? 'disabled' : ''}><b>${l}</b><span class="muted small">${s}</span></button>`).join('')}<button data-skill="__all" style="border-color:var(--ai)"><b>▶ Run full pipeline</b><span class="muted small">as an App Event would</span></button></div>
  <div class="card mt" style="padding:10px"><b>Knowledge assistant</b> <span class="small muted">policy wording + SOPs, cited, abstains if unsure</span>
   <div class="row mt"><input type="text" id="qaIn" style="flex:1" placeholder="e.g. What is the trace and access limit?" value="${esc(qa?.question || '')}"><button class="btn small" id="qaBtn">Ask</button></div>
   <div class="row wrap small mt">${['Is sealant failure covered?', 'When must I refer to SIU?', 'What alternative accommodation is allowed?'].map(x => `<a class="tag" href="javascript:void 0" data-sq="${esc(x)}">${esc(x)}</a>`).join('')}</div>
   ${qa ? `<div class="mt ${qa.abstained ? 'alert warn' : ''}"><div>${esc(qa.answer)}</div><div class="small mt">${qa.citations.map(c => `<span class="cite" title="${esc(c.quote)}">${esc(c.docId)}</span>`).join(' ')} <span class="muted">confidence ${(qa.confidence * 100).toFixed(0)}% · ${esc(qa.promptVersion)}</span></div></div>` : ''}</div>
  ${S.busy ? `<div class="mt"><span class="spin"></span> Running ${esc(S.busy)}…</div>` : ''}
  ${acts.length ? '' : '<p class="muted small mt">No AI outputs yet for this claim. Run a skill above – each output is queued as PENDING_REVIEW for your decision.</p>'}
  ${acts.map(a => renderCard(a, S.runs.get(a.runId))).join('')}`;
}
const DEC = { covered: 'p-ok', excluded: 'p-bad', refer: 'p-warn' }, SEV = { Low: 'p-ok', Medium: 'p-teal', High: 'p-warn', Complex: 'p-bad' };
function renderOutput(r) {
  const o = r.output;
  switch (r.skill) {
    case 'summary': return `<div class="small muted mb">${esc(o.headline)} · groundedness ${(o.groundedness * 100).toFixed(0)}%</div>${o.statements.map(s => `<p class="stmt">${esc(s.text)} ${s.citations.map(cite).join('')} ${s.grounded ? '<span title="Quote verified verbatim against source" style="color:var(--ok)">✓</span>' : '<span class="pill p-bad">unverified</span>'}</p>`).join('')}`;
    case 'extract': return `<table class="small"><tr><th>Field</th><th>Value</th><th>Source</th></tr>${Object.entries(o.fields).map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(Array.isArray(v) ? v.join(', ') : typeof v === 'number' && /Cost/.test(k) ? gbp(v) : v)}</b></td><td>${cite(o.citations[k]) || '<span class="muted">inferred</span>'}</td></tr>`).join('')}</table>`;
    case 'coverage': return `<div class="decision-big"><span class="pill ${DEC[o.decision]}" style="font-size:13px">${esc(o.label)}</span></div>${o.findings.map(f => `<div class="finding"><div><b>${esc(f.clause)}</b> <span class="pill ${f.result === 'applies' ? 'p-ok' : f.result === 'excluded' || f.result === 'exclusion applies' ? 'p-bad' : 'p-warn'}">${esc(f.result)}</span> ${esc(f.reason)} ${cite(f.evidence)}</div>${f.policy ? `<div class="q"><b>${esc(f.policy.clauseId)}</b> “${esc(f.policy.quote)}”</div>` : ''}</div>`).join('')}<div class="small muted">${esc(o.disclaimer)}</div>`;
    case 'triage': return `<div class="decision-big">Severity <span class="pill ${SEV[o.severity]}" style="font-size:13px">${esc(o.severity)}</span> → ${esc(o.route)}</div>${o.factors.map(f => `<div class="small">• ${esc(f.factor)} <b>${esc(f.effect)}</b> ${cite(f.evidence)}</div>`).join('')}${o.flags.length ? `<div class="mt">${o.flags.map(f => `<span class="pill p-warn">${esc(f)}</span>`).join(' ')}</div>` : ''}<div class="small muted mt">Rules: ${esc(o.sop)}</div>`;
    case 'fraud': return `<div class="decision-big">Indicator score ${o.score} <span class="pill ${o.refer ? 'p-bad' : 'p-ok'}">${o.refer ? 'Refer to SIU for review' : 'No referral'}</span></div>${o.indicators.map(i => `<div class="finding small"><b>${esc(i.id)}</b> <span class="muted">weight ${i.weight}</span> – ${esc(i.text)} ${cite(i.evidence)}</div>`).join('') || '<div class="small muted">No indicators found.</div>'}<div class="small muted">${esc(o.note)}</div>`;
    case 'vulnerability': return `<div class="decision-big">${o.vulnerable ? '<span class="pill p-warn" style="font-size:13px">Potential vulnerability – support needed</span>' : '<span class="pill p-grey" style="font-size:13px">No indicators found</span>'}</div>${o.drivers.map(v => `<div class="finding small"><b>${esc(v.driver)}</b> ${cite(v.evidence)}<div class="q">“${esc(v.evidence.quote)}”</div><div class="mt">➜ ${esc(v.adjustment)}</div></div>`).join('')}${o.supporting.map(s => `<div class="small muted">${esc(s)}</div>`).join('')}<div class="small alert warn mt">${esc(o.consentNote)}</div>`;
    case 'comms': return `<div class="small muted mb">Channel: <b>${esc(o.channel)}</b> · Flesch reading ease ${o.readingEase}${o.vulnerable ? ' · adapted for vulnerability' : ''}</div><div class="letter">${esc(o.text)}</div><div class="mt">${o.checks.map(c => `<span class="pill ${c.pass ? 'p-ok' : 'p-bad'}" title="${esc(c.detail)}" style="margin:2px">${c.pass ? '✓' : '✗'} ${esc(c.id)}</span>`).join('')}</div>`;
  }
  return `<pre>${esc(JSON.stringify(o, null, 2))}</pre>`;
}
function renderCard(a, r) {
  if (!r) return '';
  const st = { PENDING_REVIEW: 'p-warn', APPROVED: 'p-ok', APPROVED_WITH_EDITS: 'p-ok', REJECTED: 'p-bad' }[a.status];
  const passed = r.checks.filter(c => c.pass).length; const open = S.openHood.has(a.actionId);
  const ge = r.guardrailEvents.filter(g => g.type === 'injection');
  return `<div class="aicard" id="card-${a.actionId}">
   <div class="hd"><div><b>${esc(r.label)}</b> <span class="small muted">${esc(a.actionId)}${r.trigger ? ' · trigger ' + esc(r.trigger) : ''}</span></div><span class="pill ${st}">${esc(a.status.replace(/_/g, ' '))}</span></div>
   <div class="bd">
    ${ge.map(g => `<div class="alert bad small"><b>🛡 Prompt-injection blocked</b> in “${esc(g.docTitle)}” (score ${g.score.toFixed(2)}, ${g.hits.length} rules). Content ${esc(g.action)} before reaching the model; FI-MANIP raised for SIU.<div class="mono mt" style="white-space:pre-wrap">${esc(g.match.slice(0, 260))}</div></div>`).join('')}
    ${r.quarantined?.length ? `<div class="alert warn small">Quarantined: ${r.quarantined.map(q => esc(q.title)).join(', ')}</div>` : ''}
    ${r.fallback ? `<div class="alert warn small">Live LLM unavailable – fell back to offline engine (${esc(r.fallback)})</div>` : ''}
    ${renderOutput(r)}
   </div>
   <div class="ft"><span class="pill ${passed === r.checks.length ? 'p-ok' : 'p-warn'}" title="${esc(r.checks.map(c => (c.pass ? '✓ ' : '✗ ') + c.name).join('\n'))}">Checks ${passed}/${r.checks.length}</span>
    <span class="small muted">${esc(r.model)} · ${esc(r.promptVersion)}</span><span style="flex:1"></span>
    <button class="btn light small" data-hood="${a.actionId}">${open ? 'Hide' : 'Under the hood'}</button></div>
   ${open ? renderHood(r) : ''}
   ${a.status === 'PENDING_REVIEW' ? `<div class="ft">
     ${S.editing.has(a.actionId) ? `<div style="width:100%"><textarea id="ed-${a.actionId}">${esc(r.noteText)}</textarea><div class="row mt"><button class="btn ok small" data-dec="EDIT" data-a="${a.actionId}">Save edits & approve</button><button class="btn light small" data-cancel="${a.actionId}">Cancel</button></div></div>`
      : S.rejecting.has(a.actionId) ? `<div style="width:100%"><input type="text" id="rj-${a.actionId}" style="width:100%" placeholder="Reason for rejecting (required – feeds the eval set)"><div class="row mt"><button class="btn bad small" data-dec="REJECT" data-a="${a.actionId}">Confirm reject</button><button class="btn light small" data-cancel="${a.actionId}">Cancel</button></div></div>`
      : `<b class="small">Human decision:</b><button class="btn ok small" data-dec="APPROVE" data-a="${a.actionId}">✓ Approve</button><button class="btn warn small" data-edit="${a.actionId}">✎ Edit</button><button class="btn bad small" data-rej="${a.actionId}">✗ Reject</button><span class="small muted">${a.skill === 'comms' ? 'Approve = note + send activity' : a.skill === 'fraud' && r.output.refer ? 'Approve = note + SIU activity' : 'Approve = write note to claim'}</span>`}</div>`
    : `<div class="ft small"><div>${esc(a.status === 'REJECTED' ? 'Rejected' : 'Approved')} by ${esc(a.reviewer)} · ${fmtT(a.decidedAt)}${a.writeBack?.length ? '<br>' + a.writeBack.map(w => `<span class="mono">${esc(w)}</span>`).join('<br>') : ''}</div></div>`}
  </div>`;
}
function renderHood(r) {
  const m = r.metrics;
  return `<div class="hood"><h4>Agent trace – ${esc(r.runId)}</h4>
  ${r.trace.map(t => `<div class="step"><span class="t t-${esc(t.type)}">${esc(t.type)}</span><div><b>${esc(t.name)}</b> <span class="st-${esc(t.status)}">${esc(t.status)}</span><div style="opacity:.8">${esc(typeof t.detail === 'string' ? t.detail : JSON.stringify(t.detail))}</div></div><span style="text-align:right;opacity:.7">${t.ms != null ? t.ms + ' ms' : ''}</span></div>`).join('')}
  <h4 class="mt">Guardrail hits</h4>${r.guardrailEvents.length ? r.guardrailEvents.map(g => `<div>${esc(g.docTitle)} → <b class="st-BLOCKED">${esc(g.action)}</b><br>${(g.hits || []).map(h => `<span class="mono">${esc(h.rule)} (${h.weight}) ${esc(h.desc)}</span>`).join('<br>')}</div>`).join('') : '<div>None</div>'}
  <h4 class="mt">What the model saw (PII-redacted context, first document)</h4><pre>${esc((r.redactedPreview?.[0]?.text || '').slice(0, 700))}</pre>
  <h4 class="mt">Output checks</h4>${r.checks.map(c => `<div><span class="${c.pass ? 'st-pass' : 'st-BLOCKED'}">${c.pass ? '✓' : '✗'}</span> ${esc(c.name)} <span style="opacity:.7">${esc(c.detail)}</span></div>`).join('')}
  <h4 class="mt">Run metadata</h4><div class="mono">model=${esc(r.model)} · prompt=${esc(r.promptVersion)} · mode=${esc(r.mode)} · latency=${m.latencyMs} ms · tokens in/out≈${m.tokensIn}/${m.tokensOut} · cost≈£${m.costGBP} <b>(${esc(m.costLabel)})</b><br>${esc(m.liveModelLatencyNote)}</div></div>`;
}
async function runAI(claimId, skill, silent) {
  const list = skill === '__all' ? ['summary', 'extract', 'triage', 'vulnerability', 'coverage', 'fraud', 'comms'] : [skill];
  for (const s of list) {
    S.busy = SKILLS.find(x => x[0] === s)?.[1] || s; if (!silent) $('#copilot').innerHTML = renderCopilot(CUR, []);
    const r = await api(`/api/claims/${encodeURIComponent(claimId)}/ai/${s}`, {}); S.runs.set(r.runId, r);
    const flagged = r.guardrailEvents.filter(g => g.type === 'injection').map(g => g.docId); if (flagged.length) S.guard[claimId] = [...new Set([...(S.guard[claimId] || []), ...flagged])];
    if (r.guardrailEvents.length && !silent) toast('Guardrail: prompt-injection content blocked before reaching the model');
  }
  S.busy = null;
}
function bindCopilot(d) {
  const { parts } = parseHash(); const re = () => pageClaim(d.id, parts[2] || 'summary', new URLSearchParams());
  document.querySelectorAll('[data-skill]').forEach(b => b.onclick = async () => { await runAI(d.id, b.dataset.skill); await re(); });
  document.querySelectorAll('[data-hood]').forEach(b => b.onclick = () => { const k = b.dataset.hood; S.openHood.has(k) ? S.openHood.delete(k) : S.openHood.add(k); re(); });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { S.editing.add(b.dataset.edit); re(); });
  document.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => { S.rejecting.add(b.dataset.rej); re(); });
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { S.editing.delete(b.dataset.cancel); S.rejecting.delete(b.dataset.cancel); re(); });
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a, dec = b.dataset.dec;
    try { const r = await api(`/api/actions/${a}/decision`, { decision: dec, editedText: dec === 'EDIT' ? $('#ed-' + a).value : undefined, reason: dec === 'REJECT' ? $('#rj-' + a).value : undefined });
      S.editing.delete(a); S.rejecting.delete(a); toast(`${r.action.status.replace(/_/g, ' ')} · audit ${r.audit.id}${r.action.writeBack.length ? ' · written back to ClaimCenter' : ''}`); re(); } catch (e) { toast('⚠ ' + e.message); }
  });
  document.querySelectorAll('.cite[data-doc]').forEach(c => c.onclick = () => { S.highlight = { docId: c.dataset.doc, quote: c.dataset.q }; location.hash = `#/claim/${d.id}/${c.dataset.pol ? 'policy' : 'documents'}`; });
  document.querySelectorAll('.doclist .item').forEach(it => it.onclick = () => { S.highlight = { docId: it.dataset.doc }; re(); });
  const ask = async q => { S.qa[d.id] = await api('/api/knowledge/ask', { question: q, claimId: d.id }); re(); };
  $('#qaBtn').onclick = () => ask($('#qaIn').value); $('#qaIn').onkeydown = e => { if (e.key === 'Enter') ask($('#qaIn').value); };
  document.querySelectorAll('[data-sq]').forEach(x => x.onclick = () => ask(x.dataset.sq));
  if ($('#wording')) api('/api/knowledge').then(k => { $('#wording').innerHTML = `<h3>${esc(k.policy.title || 'Policy wording')}</h3>${k.policy.clauses.map(c => `<div class="card mb" id="cl-${esc(c.id)}" style="${S.highlight?.docId === c.id ? 'border-color:#e0b400;background:#fffbe6' : ''}"><b>${esc(c.id)} ${esc(c.title)}</b><div class="small mt">${S.highlight?.docId === c.id ? hl(c.text, c.id) : esc(c.text)}</div></div>`).join('')}`; document.getElementById('cl-' + S.highlight?.docId)?.scrollIntoView({ block: 'center' }); });
}

/* ---------------- AI Quality ---------------- */
async function pageQuality(q) {
  if (q.get('guard') === 'off') S.evalGuard = false;
  $('#view').innerHTML = `<div class="card"><span class="spin"></span> Running evaluation harness over golden set…</div>`;
  const r = await api('/api/evals/run', { injectionGuardrail: S.evalGuard });
  const cats = [...new Set(r.metrics.map(m => m.category))];
  $('#view').innerHTML = `
  <div class="row between mb"><div><h1>AI quality – evaluation harness</h1><div class="muted">Real code, real pass/fail: every metric below is recomputed now against labelled golden data. This is the release gate a prompt or model change must pass (CI) and the dashboard Model Risk reviews.</div></div>
   <div class="row"><label class="row small"><input type="checkbox" id="guardTg" ${S.evalGuard ? 'checked' : ''}> Prompt-injection guardrail ON</label><button class="btn" id="rerun">Re-run evals</button></div></div>
  <div class="gate ${r.summary.gate}"><div class="big">${r.summary.gate}</div><div><b>${r.summary.passed}/${r.summary.total} metrics meet threshold</b><div class="small">engine ${esc(r.config.engine)} · guardrail ${r.config.injectionGuardrail ? 'ON' : 'OFF'} · ran ${fmtT(r.runAt)} in ${r.durationMs} ms</div></div>
   <div style="margin-left:auto" class="small">Dataset: ${r.dataset.demoClaims} demo claims + ${r.dataset.generatedCases} generated cases · ${r.dataset.counterfactualPairs} fairness twins · ${r.dataset.attacks} attacks / ${r.dataset.benign} benign messages · ${r.dataset.qa} Q&A</div></div>
  ${!r.config.injectionGuardrail ? '<div class="alert bad mt">Guardrail disabled: injected instructions now reach the model context – watch the Safety metrics and fraud referral recall fail. This is why the gate blocks release.</div>' : ''}
  <div class="grid mt" style="grid-template-columns:minmax(0,1fr) 340px">
   <div class="card" style="padding:0">${cats.map(c => `<div style="padding:10px 10px 0"><h4>${esc(c)}</h4></div>${r.metrics.filter(m => m.category === c).map(m => `<details><summary class="metric"><span class="mono">${esc(m.id)}</span><span>${esc(m.name)}${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ''}</span><span class="val">${esc(m.display)}</span><span class="small muted">${esc(m.threshold)} · n=${m.n}</span><span class="pill ${m.pass ? 'p-ok' : 'p-bad'}">${m.pass ? 'PASS' : 'FAIL'}</span></summary>
     <div class="det"><table class="small">${detailRows(m.details)}</table></div></details>`).join('')}`).join('')}</div>
   <div class="grid" style="align-content:start">
    <div class="card"><h3>Eval run history</h3>${r.history.map(h => `<div class="row between small"><span>${fmtT(h.runAt)} · guard ${h.config.injectionGuardrail ? 'on' : 'off'}</span><span class="pill ${h.gate === 'PASS' ? 'p-ok' : 'p-bad'}">${h.gate} ${h.passed}/${h.total}</span></div>`).join('')}</div>
    <div class="card"><h3>What the harness tests</h3><ul class="small" style="padding-left:18px;margin:0">
     <li><b>Accuracy</b> vs SME golden labels (extraction, coverage, triage, vulnerability, fraud).</li>
     <li><b>Groundedness</b>: every statement's quote must exist verbatim in a source doc; a probe injects fabricated £/dates to prove the verifier catches them.</li>
     <li><b>Fairness</b>: counterfactual twins differ only by a vulnerability cue – coverage & fraud must not change; four-fifths rule on outcome rates; vulnerable twins must get <i>more</i> support.</li>
     <li><b>Safety</b>: injection attack corpus, benign look-alikes (false positives), end-to-end leakage into model context.</li>
     <li><b>Consumer Duty</b>: plain English, no jargon, no premature promises, next steps, complaints route.</li>
     <li><b>Knowledge</b>: retrieval at rank 1 and abstention on out-of-scope questions.</li></ul></div>
    <div class="card"><h3>Known gaps (shown honestly)</h3><div class="small">One indirect attack phrasing (“As the AI reviewing this file…”) evades the rules layer → argues for a second-layer classifier and for keeping humans on every action. One retrieval miss on subrogation wording. This static demo runs the deterministic offline engine only.</div></div>
   </div></div>`;
  $('#rerun').onclick = () => pageQuality(new URLSearchParams()); $('#guardTg').onchange = e => { S.evalGuard = e.target.checked; pageQuality(new URLSearchParams()); };
}
function detailRows(det) {
  if (!det?.length) return ''; const keys = [...new Set(det.flatMap(o => Object.keys(o)))];
  return `<tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr>` + det.slice(0, 30).map(o => `<tr>${keys.map(k => { const v = o[k]; return `<td>${v === true ? '<span class="pill p-ok">yes</span>' : v === false ? '<span class="pill p-grey">no</span>' : esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td>`; }).join('')}</tr>`).join('');
}

/* ---------------- Business case ---------------- */
function spark(vals, target, better) {
  const W = 220, H = 54, all = [...vals, target], mn = Math.min(...all), mx = Math.max(...all), y = v => H - 6 - (v - mn) / ((mx - mn) || 1) * (H - 12), x = i => 4 + i * (W - 8) / (vals.length - 1);
  return `<svg width="${W}" height="${H}"><line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="#1d8a4e" stroke-dasharray="4 3"/><polyline fill="none" stroke="#0e7c86" stroke-width="2.5" points="${vals.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/><circle cx="${x(vals.length - 1)}" cy="${y(vals.at(-1))}" r="3.5" fill="#0e7c86"/></svg>`;
}
async function pageBusiness() {
  const b = await api('/api/business'); S.roi ||= { ...b.businessCase.inputs };
  const I = S.roi;
  const hours = I.claimsPerYear * I.minutesSavedPerClaim / 60, prod = hours * I.loadedCostPerHour, leak = I.claimsPerYear * I.avgClaimCost * I.leakageReductionPts / 100, run = I.claimsPerYear * I.runCostPerClaim, net = prod + leak - run, payback = net > 0 ? I.pilotCost / net * 12 : Infinity;
  const fields = [['claimsPerYear', 'EoW claims per year', ''], ['minutesSavedPerClaim', 'Handler minutes saved per claim', ''], ['loadedCostPerHour', 'Loaded handler cost / hour', '£'], ['avgClaimCost', 'Average claim cost', '£'], ['leakageReductionPts', 'Leakage reduction (pts)', '%'], ['runCostPerClaim', 'AI run cost per claim', '£'], ['pilotCost', 'Pilot + build cost', '£']];
  $('#view').innerHTML = `
  <div class="row between mb"><div><h1>Business case – escape-of-water pilot</h1><div class="muted">12-week pilot tracker and value model. <span class="illus">ILLUSTRATIVE NUMBERS</span> – replace with the insurer's baseline MI before any decision.</div></div></div>
  <div class="grid g4">${b.kpis.map(k => { const last = k.weeks.at(-1), hit = k.better === 'lower' ? last <= k.target : last >= k.target; return `<div class="card kpi"><div class="row between"><b class="small">${esc(k.name)}</b><span class="illus">ILLUSTRATIVE</span></div>
    <div class="row between"><div class="v">${last}<span class="small muted"> ${esc(k.unit)}</span></div><span class="pill ${hit ? 'p-ok' : 'p-warn'}">${hit ? 'on target' : 'tracking'}</span></div>
    ${spark(k.weeks, k.target, k.better)}<div class="small muted">Baseline ${k.baseline ?? 'n/a'} → target ${k.target} (${k.better} is better) · week 12</div></div>`; }).join('')}
    <div class="card"><b class="small">Guardrail KPIs (must not move)</b><ul class="small" style="padding-left:18px"><li>Vulnerable vs other outcome parity ≥ 0.98</li><li>Zero AI actions without human approval</li><li>Complaints mentioning AI/automation: 0</li><li>Eval gate PASS on every release</li></ul></div></div>
  <div class="grid g2 mt">
   <div class="card"><div class="row between"><h2>Annual value model</h2><span class="illus">ILLUSTRATIVE</span></div>
    <div class="grid g2">${fields.map(([k, l, u]) => `<label class="small">${l} ${u ? `(${u})` : ''}<br><input type="number" step="any" data-roi="${k}" value="${I[k]}" style="width:100%"></label>`).join('')}</div>
    <table class="mt"><tr><td>Handler hours released</td><td><b>${Math.round(hours).toLocaleString('en-GB')} h</b> (≈ ${(hours / 1600).toFixed(1)} FTE)</td></tr><tr><td>Productivity value</td><td><b>${gbp(prod)}</b></td></tr><tr><td>Leakage reduction</td><td><b>${gbp(leak)}</b></td></tr><tr><td>AI run cost</td><td>− ${gbp(run)}</td></tr><tr><td><b>Net annual benefit</b></td><td><b style="font-size:17px;color:var(--ok)">${gbp(net)}</b></td></tr><tr><td>Payback on pilot + build</td><td><b>${isFinite(payback) ? payback.toFixed(1) + ' months' : 'n/a'}</b></td></tr></table>
    <p class="small muted">${esc(b.businessCase.note)}</p></div>
   <div class="card"><h2>Pilot plan & decision gates</h2><table class="small">
    <tr><th>Weeks</th><th>Phase</th><th>Exit criteria</th></tr>
    <tr><td>0–2</td><td>Mobilise: data access via Cloud API, DPIA, model risk tiering, baseline MI</td><td>DPIA signed; baseline captured</td></tr>
    <tr><td>3–4</td><td>Shadow mode – AI runs on live claims, handlers don't see it; evals on real data</td><td>Eval gate PASS on pilot data</td></tr>
    <tr><td>5–10</td><td>Assist mode – 10–15 handlers, every output approved/edited/rejected</td><td>Approval rate ≥ 70%, no parity drop</td></tr>
    <tr><td>11–12</td><td>Measure & decide – A/B vs control team, CIO/COO steering</td><td>KPI deltas vs control; scale / iterate / stop</td></tr></table>
    <h3 class="mt">What scales next</h3><div class="small">Motor & other home perils · FNOL voice intake · reserving suggestions · subrogation/recovery detection · supplier invoice validation · complaints root-cause – all through the same harness, guardrails and eval gate.</div></div></div>`;
  document.querySelectorAll('[data-roi]').forEach(i => i.onchange = () => { S.roi[i.dataset.roi] = +i.value; pageBusiness(); });
}

/* ---------------- Architecture ---------------- */
async function pageArch() {
  const [audit, events] = await Promise.all([api('/api/audit'), api('/api/events')]);
  $('#view').innerHTML = `<h1>Architecture – how ClaimAgent plugs into ClaimCenter</h1><p class="muted">Vendor-neutral reference design. In this demo every box runs locally; the Guidewire Cloud API is mocked with the same REST shapes.</p>
  <div class="arch mt">
   <div class="col"><div class="abox gw"><div class="ttl">Guidewire ClaimCenter (Cloud)</div><ul><li>Claim, policy, contacts, exposures</li><li>Documents (DMS) & notes</li><li>Activities / workplans</li></ul></div>
    <div class="abox gw"><div class="ttl">Integration</div><ul><li><b>Cloud API</b> /claim/v1/claims/… (read + write-back)</li><li><b>App Events</b> ClaimAdded / DocumentAdded → integration endpoint</li><li>ClaimCenter UI: ClaimAgent panel (screen extension)</li></ul></div></div>
   <div class="arrow"><span>⇄</span>REST<br>events</div>
   <div class="col"><div class="abox ai"><div class="ttl">AI harness (orchestrator)</div><ul><li>Skill registry with versioned prompts</li><li>Tool calls = Cloud API reads (traced)</li><li>Retrieval (BM25 here; vector + hybrid in prod) over policy wording & SOPs</li><li>Deterministic offline engine (this static demo does not call a live model)</li><li>Citation verifier & output checks</li></ul></div>
    <div class="abox ai"><div class="ttl">Guardrails</div><ul><li>Input: prompt-injection scan → sanitise / quarantine</li><li>PII redaction before any model call</li><li>Output: groundedness, PII leak, Consumer Duty comms checks</li><li>Policy: fraud logic never sees vulnerability data</li></ul></div></div>
   <div class="arrow"><span>⇄</span>review<br>decisions</div>
   <div class="col"><div class="abox h"><div class="ttl">Human-in-the-loop</div><ul><li>Every output PENDING_REVIEW</li><li>Approve / Edit / Reject (+reason)</li><li>Only approved output is written back</li></ul></div>
    <div class="abox"><div class="ttl">Assurance</div><ul><li>Immutable audit (model, prompt, hashes, reviewer)</li><li>Eval harness = CI release gate</li><li>KPI & parity monitoring</li><li>Model risk / DPIA / Consumer Duty evidence</li></ul></div></div>
  </div>
  <div class="grid g2 mt"><div class="card"><h3>Mock Cloud API endpoints (try them)</h3><p class="muted small">GET routes run against the in-browser mock. Nothing leaves this page.</p><table class="small mono">${['GET /claim/v1/claims', 'GET /claim/v1/claims/cc:101', 'GET /claim/v1/claims/cc:101/policy', 'GET /claim/v1/claims/cc:101/contacts', 'GET /claim/v1/claims/cc:101/exposures', 'GET /claim/v1/claims/cc:101/documents', 'GET /claim/v1/claims/cc:101/documents/DOC-101-FNOL', 'GET /claim/v1/claims/cc:101/notes', 'POST /claim/v1/claims/{id}/notes', 'POST /claim/v1/claims/{id}/activities', 'POST /api/events/app-event', 'POST /api/claims/{id}/ai/{skill}', 'POST /api/actions/{id}/decision', 'POST /api/evals/run'].map(e => { const [m, p] = e.split(' '); return `<tr><td>${m}</td><td>${m === 'GET' ? `<a href="#/architecture" data-try="${esc(p)}">${esc(p)}</a>` : esc(p)}</td></tr>`; }).join('')}</table><pre id="tryOut" class="docview mt" style="max-height:240px;overflow:auto">Select a GET route to see the mock response.</pre></div>
  <div class="card"><h3>Live counters</h3><div class="kv"><div>Audit entries</div><div><b>${audit.length}</b></div><div>App Events processed</div><div><b>${events.length}</b></div><div>Engine</div><div>${esc(S.cfg.engine)}</div><div>Model</div><div>Offline deterministic engine</div></div>
   <h3 class="mt">Prompt registry</h3><table class="small">${Object.entries(S.cfg.prompts).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}</table></div></div>`;
  document.querySelectorAll('[data-try]').forEach(a => a.onclick = async (ev) => {
    ev.preventDefault();
    const r = await handle('GET', a.dataset.try);
    const out = document.getElementById('tryOut');
    if (out) out.textContent = JSON.stringify(r.body, null, 2);
  });
}

/* ---------------- Audit ---------------- */
async function pageAudit() {
  const a = await api('/api/audit');
  $('#view').innerHTML = `<div class="card"><div class="row between mb"><div><h1>Audit trail</h1><div class="muted">Every AI output and every human decision – model, prompt version, output hash, reviewer and write-back. Evidence for model risk, Consumer Duty and complaints.</div></div><span class="pill p-grey">${a.length} entries</span></div>
  ${a.length ? `<table class="small"><tr><th>Time</th><th>Actor</th><th>Claim</th><th>Skill</th><th>Event</th><th>Model / prompt</th><th>Hash</th><th>Detail</th></tr>${a.slice().reverse().map(e => `<tr><td>${fmtT(e.ts)}</td><td>${esc(e.actor)}</td><td>${esc(e.claimNumber)}</td><td>${esc(e.skill)}</td><td><span class="pill ${/REJECT/.test(e.decision) ? 'p-bad' : /APPROVED/.test(e.decision) ? 'p-ok' : e.kind === 'guardrail' ? 'p-bad' : 'p-ai'}">${esc(e.decision)}</span></td><td class="mono">${esc(e.model)}<br>${esc(e.promptVersion)}</td><td class="mono">${esc(e.outputHash)}${e.editedHash ? '<br>edit ' + esc(e.editedHash) : ''}</td><td>${esc(e.reason ? 'Reason: ' + e.reason + ' · ' : '')}${esc(e.detail)}</td></tr>`).join('')}</table>` : '<p class="muted">No entries yet – run a ClaimAgent skill on a claim.</p>'}</div>`;
}

/* ---------------- boot ---------------- */
(async () => {
  try { enablePersistence(globalThis.localStorage); } catch { /* private mode: session stays in memory */ }
  S.cfg = await api('/api/config');
  $('#resetBtn').onclick = async () => { await api('/api/reset', {}); Object.assign(S, { runs: new Map(), guard: {}, qa: {}, lastEvent: null, highlight: null, openHood: new Set(), editing: new Set(), rejecting: new Set() }); toast('Demo reset'); route(); };
  route();
})();
