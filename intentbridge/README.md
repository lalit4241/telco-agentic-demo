# IntentBridge: AIforce × TM Forum ODA working model

A clickable, offline working model of **IntentBridge**, a proposed Tech Mahindra accelerator. It puts Salesforce AIforce surfaces (Agentforce, Slack, Coworker and Claude) on top of TM Forum ODA Open APIs for a tier-1 telco, governed by an agent gateway (Agent Fabric). Everything runs in one HTML file with no server, no CDN and no network calls.

**Open it:** `dist/index.html` (or `index.html` at the repo root, for GitHub Pages). It works from `file://`.

![screenshot](docs/screenshot.png)

## What you can demo

| Tab | What it shows |
|---|---|
| **Live demo** | Six scenarios with step-by-step control. Flagship **A**: B2B SD-WAN + 5G SLA. The TMF921 probe flags 3 of 40 sites, gives a feasible quote, then the AM confirms in the queue → TMF622/641 → intent active → SLA breach → £126 credit escalated. Flagship **B**: consumer bill shock, with four customers to choose from (within cap, above cap, vulnerable, SIM-swap). It traces to a network root cause (TMF656/642), applies the trust pack to the credit, then a retention offer with consent (TMF680/679/622). Personas: **NOC** alarm storm (scope guard), **Field** engineer, **Product** launch (governance) and **Care** (prompt-injection blocked). Middle pane: *Slackforce (simulated)*, *Agentforce Coworker*, *Claudeforce (beta)* and the *Customer app*. Right pane: a live SVG sequence diagram, with Agent Fabric decision diamonds and every JSON payload. You can also ask the superagent in free text. |
| **Agent Fabric & audit** | 29 MCP tools across 20 TMF APIs, with each tool's `tools/list` descriptor and a scope matrix of agents × ODA components. Policy thresholds are editable. The SHA-256 hash-chained audit log has **Verify** and **Simulate tampering**. |
| **Supervisor queue** | Human-in-the-loop. Approve or reject; approving runs the held action as the named human and resumes the paused journey. |
| **Agent Evals** | 15-case release gate run on fresh engines. |
| **CIO view** | Illustrative value calculator (same inputs and defaults as the design Page; Conservative, Base or Stretch) plus live KPI evidence. |
| **TMF API explorer** | Call any mock TMF operation as any agent through the gateway, and see the masked response or the system-of-record view. |

## Build and test

```bash
npm run build   # src/* → dist/index.html and ./index.html (single file, everything inlined)
npm test        # 17 engine unit tests (node:test)
npm run smoke   # headless Chrome (playwright-core, CHROME=/usr/bin/google-chrome) runs every scenario, approves queue items, saves docs/*.png
```
Results: [TEST_RESULTS.md](TEST_RESULTS.md).

## Layout
```
src/sha256.js        pure-JS SHA-256 (audit chain)
src/data.js          fictional operator "Albion Telecom": customers, bills, catalogue, 40 Northwind sites, network, alarms
src/engine.js        TMF mock APIs, Agent Fabric gateway (scopes, policy, PII, injection, audit), agents, journeys, evals, KPIs, calculator
src/ui.js            vanilla-JS UI;  src/styles.css;  src/index.template.html
build.js             inlines everything into dist/index.html
test/                engine.test.js (node:test), smoke.js (headless Chrome)
salesforce/          SFDX package (API 62): objects, Apex mock TMF services, Agentforce invocable actions, tests, perm set, seed data
scripts/deploy_sf.sh deploy to the org aliased "intentbridge"
```

## Salesforce package
See [salesforce/README.md](salesforce/README.md). In short:
```bash
sf org login device --instance-url https://orgfarm-959056de3a-dev-ed.develop.my.salesforce.com --alias intentbridge
scripts/deploy_sf.sh          # deploy, assign perm set, seed data, run Apex tests with coverage
```

## Disclaimer
This is a concept demo. All people, companies, sites and figures are fictional. Salesforce, Slack, Claude, MuleSoft and TM Forum capabilities are simulated. Product names belong to their owners. Value figures are illustrative.
