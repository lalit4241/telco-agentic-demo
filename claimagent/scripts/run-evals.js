// CLI eval gate – exits non-zero if any metric misses its threshold (wire into CI before any prompt/model release).
import { runEvals } from '../src/evals.js';
const guard = !process.argv.includes('--no-guardrail');
const r = runEvals({ injectionGuardrail: guard });
console.log(`\nAI evaluation harness – engine ${r.config.engine} – guardrail ${guard ? 'ON' : 'OFF'}`);
console.log(`Dataset: ${JSON.stringify(r.dataset)}\n`);
for (const m of r.metrics) console.log(`${m.pass ? 'PASS' : 'FAIL'}  ${m.id.padEnd(9)} ${m.display.padStart(7)}  (${m.threshold}, n=${m.n})  ${m.name}`);
console.log(`\nGATE: ${r.summary.gate}  ${r.summary.passed}/${r.summary.total} in ${r.durationMs} ms`);
if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
process.exit(r.summary.gate === 'PASS' ? 0 : 1);
