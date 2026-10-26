import test from 'node:test';
import assert from 'node:assert/strict';
import { runSkill, askKnowledge, resetHarness } from '../src/harness.js';
import { resetStore } from '../src/api.js';
import { search, KB_INDEX } from '../src/retrieval.js';
import { GOLDEN, runEvals } from '../src/evals.js';

test.beforeEach(() => { resetStore(); resetHarness(); });
const out = async (id, s) => (await runSkill(id, s, {})).output;

test('golden labels: coverage, triage, fraud, vulnerability for all 7 demo claims', async () => {
  for (const [id, g] of Object.entries(GOLDEN)) {
    assert.equal((await out(id, 'coverage')).decision, g.coverage, `${id} coverage`);
    assert.equal((await out(id, 'triage')).severity, g.severity, `${id} triage`);
    assert.equal((await out(id, 'fraud')).refer, g.fraud, `${id} fraud`);
    assert.equal((await out(id, 'vulnerability')).vulnerable, g.vulnerable, `${id} vulnerability`);
  }
});
test('extraction reads policy number, loss date and unoccupied days with citations', async () => {
  const o = await out('cc:105', 'extract');
  assert.equal(o.fields.policyNumber, 'HO-5530862'); assert.equal(o.fields.dateOfLoss, '2026-10-12');
  assert.equal(o.fields.propertyOccupied, false); assert.equal(o.fields.unoccupiedDays, 79);
  assert.ok(o.citations.policyNumber.quote.includes('HO-5530862'));
});
test('coverage findings cite policy clauses verbatim (sealant exclusion S1.4a on cc:103)', async () => {
  const o = await out('cc:103', 'coverage');
  const f = o.findings.find(x => x.clause === 'S1.4a'); assert.ok(f, 'S1.4a finding'); assert.ok(f.policy.quote.length > 20);
});
test('summary is 100% grounded on every claim', async () => {
  for (const id of Object.keys(GOLDEN)) assert.equal((await out(id, 'summary')).groundedness, 1, id);
});
test('injection email on cc:106 is sanitised, never reaches context, and raises FI-MANIP', async () => {
  const r = await runSkill('cc:106', 'summary', {});
  assert.equal(r.guardrailEvents[0].action, 'sanitised');
  assert.ok(!JSON.stringify(r.redactedPreview).includes('ignore all previous'));
  assert.ok(!JSON.stringify(r.output).includes('41234567'), 'bank details must not be echoed');
  assert.ok(r.checks.every(c => c.pass), JSON.stringify(r.checks));
  assert.ok((await out('cc:106', 'fraud')).indicators.some(i => i.id === 'FI-MANIP'));
});
test('vulnerable customer comms adapt channel and pass Consumer Duty checks', async () => {
  const o = await out('cc:101', 'comms');
  assert.ok(o.checks.every(c => c.pass), JSON.stringify(o.checks.filter(c => !c.pass)));
  assert.ok(o.readingEase >= 60); assert.match(o.text, /Dear Mrs Ellis/);
});
test('knowledge assistant answers with citations and abstains when out of scope', () => {
  const a = askKnowledge('What is the escape of water excess?'); assert.equal(a.abstained, false); assert.match(a.answer, /£350/);
  assert.equal(askKnowledge('What is the capital of France?').abstained, true);
  assert.equal(search(KB_INDEX, 'shower sealant grout')[0].id, 'S1.4a');
});
test('eval harness passes with guardrail on and fails the gate with it off', () => {
  assert.equal(runEvals({ injectionGuardrail: true }).summary.gate, 'PASS');
  const off = runEvals({ injectionGuardrail: false });
  assert.equal(off.summary.gate, 'FAIL'); assert.ok(off.metrics.find(m => m.id === 'INJ-E2E').pass === false);
});
