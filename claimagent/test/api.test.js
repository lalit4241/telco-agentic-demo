import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handle, enablePersistence, resetAll } from '../src/client.js';
import { onChange } from '../src/persist.js';

const get = p => handle('GET', p);
const post = (p, b = {}) => handle('POST', p, b);
test.before(async () => { await post('/api/reset'); });

test('GET /claim/v1/claims returns Cloud API list envelope', async () => {
  const r = await get('/claim/v1/claims'); assert.equal(r.status, 200); assert.equal(r.body.count, 7);
  assert.equal(r.body.data[0].type, 'Claim'); assert.ok(r.body.data[0].attributes.claimNumber); assert.ok(r.body.data[0].links);
});
test('GET claim, policy, documents and document contents', async () => {
  assert.equal((await get('/claim/v1/claims/cc:101')).body.data.attributes.claimNumber, 'HO-26-000101');
  assert.equal((await get('/claim/v1/claims/cc:101/policy')).status, 200);
  const docs = (await get('/claim/v1/claims/cc:106/documents')).body; assert.equal(docs.count, 3);
  assert.equal((await get('/claim/v1/claims/cc:106/documents/DOC-106-EM1')).status, 200);
});
test('unknown claim returns Guidewire-style 404 error', async () => {
  const r = await get('/claim/v1/claims/cc:999'); assert.equal(r.status, 404); assert.match(r.body.errorCode, /NotFoundException/);
});
test('POST note creates a note (201) visible on GET', async () => {
  const r = await post('/claim/v1/claims/cc:102/notes', { data: { attributes: { subject: 'Test', body: 'hello' } } }); assert.equal(r.status, 201);
  assert.ok((await get('/claim/v1/claims/cc:102/notes')).body.data.some(n => n.attributes.body === 'hello'));
});
test('AI run → PENDING_REVIEW → approve writes back note and audit entry', async () => {
  const run = (await post('/api/claims/cc:101/ai/summary')).body; assert.ok(run.actionId);
  const before = (await get('/claim/v1/claims/cc:101/notes')).body.count;
  const d = await post(`/api/actions/${run.actionId}/decision`, { decision: 'APPROVE' }); assert.equal(d.status, 200); assert.equal(d.body.action.status, 'APPROVED');
  assert.equal((await get('/claim/v1/claims/cc:101/notes')).body.count, before + 1);
  assert.ok((await get('/api/audit')).body.some(a => a.actionId === run.actionId && a.kind === 'human-decision'));
  assert.equal((await post(`/api/actions/${run.actionId}/decision`, { decision: 'APPROVE' })).status, 409, 'cannot decide twice');
});
test('reject requires a reason and writes nothing back', async () => {
  const run = (await post('/api/claims/cc:102/ai/triage')).body;
  assert.equal((await post(`/api/actions/${run.actionId}/decision`, { decision: 'REJECT' })).status, 400);
  const r = await post(`/api/actions/${run.actionId}/decision`, { decision: 'REJECT', reason: 'Severity too low' }); assert.equal(r.body.action.status, 'REJECTED'); assert.equal(r.body.action.writeBack.length, 0);
});
test('edited comms approval posts note + activity', async () => {
  const run = (await post('/api/claims/cc:107/ai/comms')).body;
  const r = await post(`/api/actions/${run.actionId}/decision`, { decision: 'EDIT', editedText: run.noteText + '\nEdited.' });
  assert.equal(r.body.action.status, 'APPROVED_WITH_EDITS'); assert.equal(r.body.action.writeBack.length, 2);
});
test('injection attempt on cc:106 blocked through the API', async () => {
  const r = (await post('/api/claims/cc:106/ai/coverage')).body;
  assert.equal(r.guardrailEvents[0].type, 'injection'); assert.notEqual(r.output.decision, undefined);
  assert.ok((await get('/api/audit')).body.some(a => a.kind === 'guardrail' && a.decision === 'BLOCKED'));
});
test('App Event triggers pipeline with outputs queued for review', async () => {
  const r = await post('/api/events/app-event', { eventType: 'DocumentAdded', claimId: 'cc:104' }); assert.equal(r.status, 200);
  assert.equal(r.body.envelope.type, 'gw.cc.DocumentAdded'); assert.equal(r.body.pipeline.length, 3);
  const c = (await get('/api/claims/cc:104')).body; assert.ok(c.actions.filter(a => a.status === 'PENDING_REVIEW').length >= 3);
  assert.equal((await post('/api/events/app-event', { eventType: 'PolicyDeleted', claimId: 'cc:104' })).status, 400);
});
test('evals endpoint, knowledge, business and static UI', async () => {
  const e = await post('/api/evals/run', { injectionGuardrail: true }); assert.equal(e.body.summary.gate, 'PASS');
  assert.equal((await post('/api/knowledge/ask', { question: 'When must I refer a claim to SIU?' })).body.abstained, false);
  assert.ok((await get('/api/business')).body.kpis.length >= 5);
  const html = fs.readFileSync(new URL('../src/app.template.html', import.meta.url), 'utf8');
  assert.match(html, /Synthetic demo data/i);
  assert.match(html, /ClaimAgent/);
  assert.doesNotMatch(html, /Tech Mahindra|TechM/i);
});
test('localStorage keeps decisions and Reset demo restores the seed', async () => {
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  enablePersistence(storage);
  const run = (await post('/api/claims/cc:103/ai/coverage')).body;
  assert.equal(run.output.decision, 'excluded');
  assert.ok(mem.get('claimagent-demo-state-v1').includes(run.actionId));
  resetAll();
  onChange(null);
  const fresh = JSON.parse(mem.get('claimagent-demo-state-v1') || '{"harness":{"actions":[]}}');
  assert.equal((fresh.harness.actions || []).length, 0);
  const mem2 = new Map(mem);
  const storage2 = { getItem: k => (mem2.has(k) ? mem2.get(k) : null), setItem: (k, v) => mem2.set(k, v), removeItem: k => mem2.delete(k) };
  enablePersistence(storage2);
  assert.equal((await get('/api/claims/cc:103')).body.actions.length, 0);
  onChange(null);
});
