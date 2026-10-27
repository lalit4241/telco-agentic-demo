# ClaimAgent test record

Run on 26 October 2026 in this workspace (Node.js 22).

| Check | Result |
|---|---|
| `npm test` | **25/25** passed. The original 23 cases (guardrails, golden skills, mock Cloud API, approve/edit/reject, audit, 409 on a second decision, App Event pipeline, eval gate on and off, synthetic-data label) plus a localStorage round-trip with Reset demo, and a check that the published page is AES-GCM encrypted and does not contain claim text or the password in clear. |
| `npm run eval` | **GATE PASS, 18/18** in about 60 ms. Engine `offline-rules-engine 1.4.0`, injection guardrail on. |
| `npm run eval -- --no-guardrail` | **GATE FAIL, 15/18**. Fails on fraud-referral recall, injection detection and end-to-end leakage, which is the release-gate behaviour. |
| Headless Chrome against `http://127.0.0.1:8766/claimagent/` | Gate shown before any claim content. Wrong password stays locked. The ClaimAgent demo password unlocks the claims list. cc:106 shows the blocked prompt-injection email and an SIU flag. Lock returns to the gate. AI quality passes with the guardrail on and fails with it off. Approving the cc:101 letter writes an AI-assisted note; Reset demo removes it. Business case is labelled illustrative. No page errors. |

The live URL after merge is [https://lalit4241.github.io/telco-agentic-demo/claimagent/](https://lalit4241.github.io/telco-agentic-demo/claimagent/). GitHub Pages publishes on push to `main` (`.github/workflows/pages.yml`). This branch does not change that workflow.
