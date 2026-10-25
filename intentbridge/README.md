# Telcoforce: agentic telco on the Salesforce ecosystem

**Telcoforce** is a concept by LalitC for the agentic telco of the future, built from what Dreamforce 2026 put on the table: AIforce surfaces (Agentforce, Slackforce, Coworker, Claudeforce), a Superagent, agent-to-agent (A2A) partner agents, long-horizon agents, the Systems Integration Agent and the Agent Fabric kill switch, all over TM Forum ODA Open APIs. **IntentBridge** is its governed headless layer: the TMF tool catalogue, scopes, trust pack and hash-chained audit that every Telcoforce agent goes through.

This repo is a clickable, offline working model (one HTML file, no server, no CDN, no network calls) plus a Salesforce SFDX package that runs the same decisions as Apex invocable actions on real records.

**Open it:** `dist/index.html` (or `index.html` at the repo root, for GitHub Pages). It works from `file://`.

![Telcoforce superagent](docs/telcoforce-superagent.png)

## Telcoforce journeys (new)

| Journey | What happens | Guardrails you can see |
|---|---|---|
| **T1 Network-aware proactive care** | Alarm on OLT-LDS-HDY-03 → assurance agent correlates impact (TMF642/656/637) → one parent ticket, customers told before they call (TMF681) → restore → goodwill credit (TMF678). The **extended** variant runs as a long-horizon agent with daily check-ins. | Vulnerable customer gets a human call, SIM-swap holds the credit, above-cap goodwill goes to a supervisor, no goodwill before restore, duplicate contact refused |
| **T2 Wholesale partner A2A** | A partner's agent (Brightwave, QuickNet, Fibrely) talks to the operator's wholesale agent: qualify addresses (TMF645), place orders (TMF622) under the partner agreement (TMF668). | Suspended partner refused, daily rate limit, contract line limit to the partner desk, **Agent Fabric kill switch** per partner (toggle it live in the Telcoforce tab) |
| **T3 Order fallout repair** | Back-office agent works the overnight fallout queue (TMF622/673/685); the **Systems Integration Agent** replays a recorded playbook on a legacy OSS screen with no API. | Only approved playbooks, price changes always go to a person, unknown errors are passed to the ops lead, never improvised |
| **Superagent router** | Free-text ask → routes to the right journey with confidence, plan, parameters and a "Run this journey" button. | Prompt injection blocked, vulnerable callers human-first, low confidence offers a person, multi-intent flagged |

Agent Evals now run **33 cases** (15 IntentBridge + 18 Telcoforce).

## What you can demo

| Tab | What it shows |
|---|---|
| **Telcoforce** | The superagent ask box with example prompts, the three Telcoforce journey cards and the partner table with live kill-switch toggles. |
| **Live demo** | Nine scenarios with step-by-step control: the three Telcoforce journeys (tagged) and the six IntentBridge ones. Flagship **A**: B2B SD-WAN + 5G SLA. The TMF921 probe flags 3 of 40 sites, gives a feasible quote, then the AM confirms in the queue → TMF622/641 → intent active → SLA breach → £126 credit escalated. Flagship **B**: consumer bill shock, with four customers to choose from (within cap, above cap, vulnerable, SIM-swap). It traces to a network root cause (TMF656/642), applies the trust pack to the credit, then a retention offer with consent (TMF680/679/622). Personas: **NOC** alarm storm (scope guard), **Field** engineer, **Product** launch (governance) and **Care** (prompt-injection blocked). Middle pane: *Slackforce (simulated)*, *Agentforce Coworker*, *Claudeforce (beta)* and the *Customer app*. Right pane: a live SVG sequence diagram, with Agent Fabric decision diamonds and every JSON payload. You can also ask the superagent in free text. |
| **Agent Fabric & audit** | 40 MCP tools across 24 TMF APIs (plus one recorded legacy-screen tool for the Systems Integration Agent), with each tool's `tools/list` descriptor and a scope matrix of agents × ODA components. Policy thresholds are editable. The SHA-256 hash-chained audit log has **Verify** and **Simulate tampering**. |
| **Supervisor queue** | Human-in-the-loop. Approve or reject; approving runs the held action as the named human and resumes the paused journey. |
| **Agent Evals** | 33-case release gate (15 IntentBridge + 18 Telcoforce) run on fresh engines. |
| **CIO view** | Illustrative value calculator (same inputs and defaults as the design Page; Conservative, Base or Stretch) plus live KPI evidence. |
| **TMF API explorer** | Call any mock TMF operation as any agent through the gateway, and see the masked response or the system-of-record view. |

## Build and test

```bash
npm run build   # src/* → dist/index.html and ./index.html (single file, everything inlined)
npm test        # 27 unit tests (17 engine + 10 Telcoforce, node:test)
npm run smoke   # headless Chrome (playwright-core, CHROME=/usr/bin/google-chrome) runs every scenario, approves queue items, saves docs/*.png
```
Results: [TEST_RESULTS.md](TEST_RESULTS.md).

## Layout
```
src/sha256.js        pure-JS SHA-256 (audit chain)
src/data.js          fictional operator "Albion Telecom": customers, bills, catalogue, 40 Northwind sites, network, alarms
src/engine.js        TMF mock APIs, Agent Fabric gateway (scopes, policy, PII, injection, audit), agents, journeys, evals, KPIs, calculator
src/telcoforce.js    Telcoforce extension: agents, TMF ops, partner policy, 3 journeys, superagent router, 18 evals
src/ui.js            vanilla-JS UI;  src/styles.css;  src/index.template.html
build.js             inlines everything into dist/index.html
test/                engine.test.js, telcoforce.test.js (node:test), smoke.js (headless Chrome)
salesforce/          SFDX package (API 62): objects, Apex mock TMF services, Agentforce invocable actions, tests, perm set, seed data
scripts/deploy_sf.sh deploy to the org aliased "intentbridge"
```

## Salesforce package
See [salesforce/README.md](salesforce/README.md). In short:
```bash
sf org login device --instance-url https://orgfarm-959056de3a-dev-ed.develop.my.salesforce.com --alias intentbridge
DRY_RUN=1 scripts/deploy_sf.sh   # check-only deploy + both Apex test classes
EXERCISE=1 scripts/deploy_sf.sh  # deploy, perm set, seed, Apex tests, then run the Telcoforce actions on real records
```
Telcoforce adds 4 objects (`IB_Partner__c`, `IB_Wholesale_Order__c`, `IB_Fallout_Order__c`, `IB_Customer_Notification__c`) and 8 invocable actions in category **Telcoforce**: Detect Outage Impact, Notify Affected, Restore and Credit, Partner Qualify, Partner Order, Set Partner Kill Switch, Repair Fallout Order and Route Request (superagent). Org results: `salesforce/org-results/telcoforce_*.txt`.

## Disclaimer
Telcoforce is a concept name used here by LalitC; it is not a Salesforce product or term. This is a concept demo. All people, companies, sites and figures are fictional. Salesforce, Slack, Claude, MuleSoft and TM Forum capabilities are simulated. Product names belong to their owners. Value figures are illustrative.
