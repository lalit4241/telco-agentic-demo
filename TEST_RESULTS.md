# Live demo check

- **Date:** 2026-10-24
- **URL:** https://lalit4241.github.io/telco-agentic-demo/
- **HTTP status:** 200 (`content-length: 57856`, body byte-for-byte the same as root `index.html`)
- **Deployed commit:** `6576468d229a5d4df79b986f3543c2cf10052d28`
- **Workflow:** [Deploy GitHub Pages #40076741352](https://github.com/lalit4241/telco-agentic-demo/actions/runs/40076741352) — success
- **Browser:** headless Google Chrome via Playwright 1.56.1. Console errors: none. Page errors: none.
- **Screenshot:** [docs/live-demo.png](docs/live-demo.png) (scenario 8 on screen, billing-supervisor credit already approved)

![Live demo after supervisor approval](docs/live-demo.png)

## Scenarios

Each scenario was clicked in order on the live page. Status labels are the ones shown in the agent timeline.

| # | Scenario | Result |
|---|---|---|
| 1 | Billing dispute (consumer, within agent authority) + churn signal | Pass. BillingResolutionAgent **RESOLVED** (credited £39.40, adjustment ADJ-00001). RetentionAgent **AWAITING CUSTOMER** (loyalty offer PO-RET-1). |
| 2 | B2B order-to-activate fallout (FTTP held on UPRN mismatch) | Pass. OrderFalloutAgent **RESOLVED**. SO-77001 remediated and resubmitted. |
| 3 | Order fallout with exhausted retries → human | Pass. OrderFalloutAgent **WITH A HUMAN**. Handed to order-management (retry budget exhausted). |
| 4 | Network fault during a known area outage → proactive comms, no truck roll | Pass. NetworkFaultAgent **RESOLVED**. Child ticket TT-00002 linked to TT-00001; truck roll suppressed. |
| 5 | SIM-swap request with fraud signals → blocked + fraud ops | Pass. SimSwapFraudAgent **BLOCKED**. Remote SIM swap refused; fraud ops notified. |
| 6 | Billing dispute above agent authority → supervisor approval | Pass. BillingResolutionAgent **WITH A HUMAN**. Credit £72.50 exceeds the £50 agent authority. Task HT-0003 left open for a person. |
| 7 | Prompt-injection attempt → blocked at the front door | Pass. Orchestrator **BLOCKED** before any tool call. |
| 8 | B2B early termination charge dispute → B2B billing specialist queue | Pass. BillingResolutionAgent **WITH A HUMAN**. Handed to b2b-billing-specialists. |

## Supervisor approval

Approved the open **billing-supervisors** task **HT-0003** (scenario 6, credit £72.50).

The timeline then showed SupervisorConsole: decision **APPROVED**, a TMF678 `POST bill.adjust` write, and the customer message “credit of £72.50 applied (ADJ-00002)”. The queue status for HT-0003 changed from open to approved. No console errors.

## Prototype tests

```text
cd prototype && python3 -m pytest -q
48 passed in 0.52s
```

Python 3.12.3, dependencies from `prototype/requirements-dev.txt`. The run covers the engine, the FastAPI app, the offline build, and JavaScript/Python parity.
