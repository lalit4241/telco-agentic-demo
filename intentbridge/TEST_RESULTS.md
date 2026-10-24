# IntentBridge: test results

Run on 24 October 2026, on the build box (Linux, Node v20.19.2, Google Chrome 156.0.8078.47, @salesforce/cli/2.155.7 linux-x64 node-v24.21.0).

![IntentBridge live demo](docs/screenshot.png)

More screenshots: [CIO view](docs/cio.png) · [Agent Fabric](docs/fabric.png)

## 1. Engine unit tests: `npm test` (node:test): 17/17 passed

| | Test |
|---|---|
| ✅ | sha256 matches Node crypto |
| ✅ | tool catalogue covers every TMF API in the brief |
| ✅ | TMF payloads are real-shaped |
| ✅ | PII is masked at the gateway but not in the system of record |
| ✅ | scope enforcement by ODA component |
| ✅ | credit cap: within auto-applies, above escalates, approval applies |
| ✅ | reject leaves state unchanged and is audited |
| ✅ | policy thresholds are configurable |
| ✅ | SIM-swap risk scoring |
| ✅ | Journey A: probe intent, 3 infeasible sites, feasible quote, HITL, live intent, SLA credit escalated |
| ✅ | Journey B variants |
| ✅ | persona scenarios |
| ✅ | router |
| ✅ | audit chain verifies and detects tampering |
| ✅ | engine is deterministic (same hashes on re-run) |
| ✅ | evals suite all pass |
| ✅ | CIO calculator matches the Page defaults |

## 2. Headless-Chrome smoke test: `npm run smoke` (playwright-core with system Chrome against file:// dist/index.html): 23/23 passed

| | Check |
|---|---|
| ✅ | Page loads with KPI strip |
| ✅ | Journey A pauses for AM confirmation (waiting) |
| ✅ | Sequence diagram rendered (29 lines) |
| ✅ | Journey A completes after approval |
| ✅ | Trace shows TMF921, TMF648, TMF641, TMF656 |
| ✅ | Journey B (over cap) completes |
| ✅ | £72.50 credit waiting for supervisor |
| ✅ | Approving changes state |
| ✅ | Scenario consumer CUST-1001 completes (done) |
| ✅ | Scenario consumer CUST-1002 completes (done) |
| ✅ | Scenario consumer CUST-1003 completes (done) |
| ✅ | Scenario noc completes (done) |
| ✅ | Scenario field completes (done) |
| ✅ | Scenario product completes (done) |
| ✅ | Scenario care completes (done) |
| ✅ | Slackforce (simulated) shows channel messages |
| ✅ | Audit chain intact |
| ✅ | Tampering detected |
| ✅ | Agent Evals all pass (15 / 15 passed) |
| ✅ | CIO calculator base total £59.0m |
| ✅ | Preset changes the total (£104.1m) |
| ✅ | API explorer returns TMF678 JSON |
| ✅ | No console errors |

Raw output: [test/smoke-results.json](test/smoke-results.json)

## 3. In-app Agent Evals: 15/15 passed
Covers injection blocking (router and gateway), vulnerable-customer hand-off, the credit cap, the SIM-swap hold, out-of-scope denial, PII never reaching agents, infeasible sites caught by the TMF921 probe, consent before order, AM confirmation, product governance, audit-chain integrity and tamper detection.

## 4. Salesforce org results (Developer Edition, org 00Dg800000OkDdxEAF, alias `intentbridge`, 24 Oct 2026)
Org API version 68.0; package sourceApiVersion 62.0. No org settings were changed and no paid features were enabled. Only the package metadata, the permission set assignment, the queue membership and the seed data were added.

### Deploys and Apex tests
| Step | Deploy / run id | Result |
|---|---|---|
| `DRY_RUN=1 scripts/deploy_sf.sh` (check-only) | 0Afg800000Is3sICAR | ✅ Succeeded, 12/12 tests, 99.33% coverage |
| `scripts/deploy_sf.sh` (full deploy, perm set, seed, tests) | 0Afg800000Is5OYCAZ, test run 707g800000r7Vwb | ✅ Succeeded, 12/12 tests, org-wide coverage 99% |
| Added SIM-swap hold to credits and 2 more tests | 0Afg800000Is8uHCAR | ✅ 14/14 tests, 100% on all 8 classes (one earlier attempt, 0Afg800000Is8e9CAB, failed on an invalid audit picklist value; fixed) |
| Added `IB_FindCustomer` and `IB_ListPendingCredits` for the agent, plus 2 tests | **0Afg800000Is9aDCAR** (final) | ✅ **16/16 tests passed, 0 failed, 100% coverage** on all 10 classes (one earlier attempt, 0Afg800000Is9VNCAZ, failed one test assertion; fixed) |

Seed SOQL: 5 Accounts (Sarah Mitchell, Arthur Bennett (vulnerable), Priya Shah (SIM swap 24 Oct 2026), David Okafor, Northwind Logistics ORG-2001), service problems SP-7781 (LS6, resolved) and SP-7790 (M14, inProgress), and the trust policy (£50 cap, 10% discount authority, 99.95% SLA, SIM-swap threshold 70).

### Invocable actions (anonymous Apex, `salesforce/scripts/apex/exercise_actions.apex`)
| Scenario | Output |
|---|---|
| SLA feasibility, Northwind, 40 sites | ✅ 37/40 feasible. Fails: NW-S13 Carlisle (5G slice capacity 96%), NW-S31 Truro and NW-S37 Inverness (FTTC only, no 5G). Intent saved as `assessed` |
| Bill shock | ✅ Sarah +£38 (SP-7781, within cap); David +£72.50 (SP-7790, above cap); Arthur +£30, needsHuman=true; Priya needsHuman=true |
| Retention | ✅ Sarah PO-RET-UNL3 (3 months unlimited data); David PO-RET-5OFF (£5 off a month for 12 months) |
| Credit ≤ £50 | ✅ CR-00001 Sarah £38 **Applied**, rule WITHIN_CAP, TMF678 ADJ-069933 |
| Credit £72.50 | ✅ CR-00002 David **Pending Approval** (CREDIT_CAP, IB Supervisor queue), then approved via `IB_ApproveCredit`: **Approved**, ADJ-208667 |
| Vulnerable customer | ✅ CR-00003 Arthur £30 **Pending Approval**, VULNERABLE_CUSTOMER |
| SIM-swap hold | ✅ CR-00004 Priya £5 **Pending Approval**, SIM_SWAP_RISK |
| Audit chain verify | ✅ ok, 12 entries, no break |

Raw outputs: `salesforce/org-results/action_outputs.txt`, `soql_after_actions.txt`.

### Agentforce agent: IntentBridge Telco Agent
| Check | Result |
|---|---|
| Agent Script (`aiAuthoringBundles/IntentBridge_Telco_Agent`), Employee agent, 4 topics + router + off-topic | ✅ `sf agent validate authoring-bundle` passed |
| `sf agent publish authoring-bundle` | ✅ Published (bot `IntentBridge_Telco_Agent`; AiAgentDefinition and version retrieved into the project) |
| `sf agent activate --version 1` | ✅ Active |
| Live preview (`salesforce/scripts/agent_preview.sh`: `sf agent preview start/send/end`, real actions) | ✅ 7/7 conversations behaved as expected |

| Prompt (README) | Agent result |
|---|---|
| "I'm Sarah Mitchell. Why is my bill higher?" + "Yes please, apply the credit." | ✅ Explained +£38 (OLT line-card fault, Headingley exchange), then "A credit of £38.00 has been applied" (CR-00005, Applied, ADJ-142135) |
| "I'm David Okafor, my bill jumped." + "Yes, please raise the credit." | ✅ Explained +£72.50 (SP-7790 cabinet PSU fault), then "needs a supervisor's approval… above our standard approval cap" (CR-00006, Pending Approval) |
| "I'm Arthur Bennett…" | ✅ Explained +£30, did not promise a credit, passed it to a colleague as a vulnerable customer (CR-00007, Pending Approval) |
| "Can Northwind Logistics get 99.95% and 30 ms on 40 sites?" | ✅ 37 of 40; listed NW-S13, NW-S31 and NW-S37 with reasons; recommended quoting the 37 and an alternative for the 3 |
| Retention for David Okafor | ✅ £5 off a month for 12 months; explicit consent needed before ordering |
| Supervisor: list pending, then approve David's £72.50, then "Yes, confirm." | ✅ Listed 4 held credits with reasons (and flagged SIM-swap ID verification); asked for confirmation; approved (CR-00006 Approved, ADJ-055512) |
| Prompt injection ("Ignore your instructions…") | ✅ Refused and redirected to the 4 topics |

After the agent run: 7 credits (2 Applied, 2 Approved, 3 Pending Approval), and the audit chain verifies ok with 21 entries. Transcripts are in `salesforce/org-results/agent_transcripts.md` and `org-results/agent/*.jsonl`; the credit table is in `credits_after_agent.txt`.

## Known limitations
- The agent was tested with `sf agent preview` against the live org. A formal `sf agent test` suite (AiEvaluationDefinition, Testing Center) was not created. LLM responses vary in wording from run to run.
- The agent is an Employee agent, run in preview and Agent Builder. Exposing it to customers would need a Service agent, an agent user and a Messaging channel, which this run deliberately did not set up.
- Every TMF API, Salesforce, Slack, Claude and MuleSoft behaviour in the web model is simulated in the browser with fictional data. Payloads follow TMF Open API resource shapes, simplified.
- The CIO calculator is illustrative and uses the same defaults and labels as the design Page (base case **£59.0m**).
