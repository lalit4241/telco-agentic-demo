# ClaimAgent: AI claims copilot for Guidewire ClaimCenter

> **Synthetic demo data.** Every customer, policy, claim, document and number here is fictional. No real customer data is used and no live Guidewire tenant is connected. The ClaimCenter Cloud API is mocked in the browser, and the business-case figures are **illustrative**. The AI gives decision support only: a human approves every action.

ClaimAgent is a claims-handler copilot for **home escape-of-water** claims. Guidewire ClaimCenter is the system of record the copilot sits beside. The page is a static GitHub Pages demo, on the same publishing path as the rest of this repository (`.github/workflows/pages.yml` uploads the repo root).

**Open it:** [`index.html`](./index.html) ([live](https://lalit4241.github.io/telco-agentic-demo/claimagent/)). The page asks for a password. ClaimAgent uses its own password, separate from the other demos on this site (shared separately; it is not stored in the repo).

**About the password gate.** Same mechanism as [`intentbridge/build.js`](../intentbridge/build.js). The app markup and JavaScript are encrypted at build time with AES-256-GCM. The key is derived from the password with PBKDF2-SHA-256 (250,000 iterations, random salt) and decrypted with WebCrypto after unlock. The page stores only a salted SHA-256 verifier, never the password. Unlock is remembered for the browser tab (`sessionStorage` key `ca-demo-key`); **Lock** clears it. **Reset demo** restores the synthetic claims, notes, review queue and audit trail (`localStorage` key `claimagent-demo-state-v1`). This keeps casual visitors out. It is not access control for confidential data.

The optional live-LLM mode from the original server demo is not in this static build. Every skill runs on the deterministic offline engine (`offline-rules-engine 1.4.0`), so the demo needs no network and no API key.

## Run the tests

Node.js 18 or newer. The demo itself has no runtime dependencies. `esbuild` is a dev dependency used only to bundle the encrypted page.

```bash
cd claimagent
npm install
npm test          # guardrails, skills, in-browser API, published-page checks
npm run eval      # AI quality gate; exits 1 on FAIL
npm run eval -- --no-guardrail
```

Rebuild the encrypted page (ClaimAgent's own password, from `CLAIMAGENT_DEMO_PASSWORD` or a git-ignored `claimagent/.demo-password`; it does not fall back to the shared TelForce / IntentBridge password; the build refuses to write if that password appears in the output):

```bash
CLAIMAGENT_DEMO_PASSWORD='…' npm run build     # writes index.html and dist/index.html
```

## What you can demo

| Area | Route | Shows |
|---|---|---|
| Claims desktop | `#/claims` | Claim list (7 synthetic EoW claims), the App Event simulator and the event log |
| Claim detail | `#/claim/cc:101/summary` | Summary, loss, parties, policy, documents, notes, activities, financials. The ClaimAgent panel stays on the right |
| AI skills | ClaimAgent panel | Cited summary, document extraction, coverage check, triage, fraud flags, vulnerability (FCA FG21/1), Consumer Duty letter, knowledge Q&A that cites sources and abstains when unsure |
| Human gate | Every AI card | **Approve / Edit / Reject.** Reject needs a reason. Approved items are written back as notes and activities through the mock Cloud API |
| Under the hood | On any card | Agent steps, tool calls, retrieval hits, prompt version, model version, guardrail events, illustrative latency and cost |
| AI quality | `#/quality` | Eval harness. Passes with the injection guardrail on, fails with it off |
| Business case | `#/business` | 12-week KPI tracker and an illustrative value model |
| Architecture | `#/architecture` | Cloud API, App Events, harness, guardrails, human gate, audit. GET routes can be tried in the page |
| Audit trail | `#/audit` | Every AI run and human decision |

| Claim | Story |
|---|---|
| cc:101 Mrs Ellis | Burst pipe, high severity, vulnerable customer. The letter is plain English and names a nominated contact |
| cc:102 | Simple appliance leak, low severity |
| cc:103 | Failed sealant. Coverage cites the gradual-damage exclusion |
| cc:104 | Explainable fraud indicators. Vulnerability is not an input to fraud |
| cc:105 | Unoccupied property, alternative accommodation considered |
| cc:106 | Contractor email hides a prompt injection. It is sanitised and an SIU flag is raised. The AI does not act on it |
| cc:107 | App Event pipeline (`ClaimAdded` / `DocumentAdded`). Results wait for review |

Handy links once the page is unlocked:

- `#/claim/cc:106/documents?doc=DOC-106-EM1&run=fraud,summary&hood=1`
- `#/claim/cc:101/summary?run=comms`
- `#/claim/cc:103/policy?run=coverage`
- `#/quality?guard=off`

## 10-minute talk track

| Min | Screen | Message |
|---|---|---|
| 0–1 | Claims desktop | A ClaimCenter-style desktop on synthetic data. ClaimAgent sits in the handler's workflow and talks to ClaimCenter through the Cloud API and App Events. |
| 1–3 | cc:101, Summarise, then Customer update | A cited summary. Mrs Ellis is flagged as vulnerable, so the letter is plain English and goes via her nominated contact. The handler approves it, and only then is it written back. |
| 3–4 | cc:103, Coverage check | A recommendation with the gradual-damage exclusion cited. The decision stays with the handler. |
| 4–5 | cc:104, Fraud indicators | Explainable flags, each with evidence. Vulnerability is excluded from the fraud logic. |
| 5–6 | cc:106, Under the hood | A contractor email hides an instruction to pay into a bank account. The harness removes it before the model step and raises an SIU flag. The trace shows tool calls, retrieval, guardrails, prompt version, illustrative cost and latency. |
| 6–7 | Claims list, App Event | A new claim or document fires the pipeline. Results wait in the review queue. |
| 7–8 | AI quality | 18 metrics. Switching the injection guardrail off fails the gate. |
| 8–9 | Business case | Illustrative figures only: minutes saved and a leakage reduction, to be replaced with the insurer's own MI. |
| 9–10 | Pilot plan, then Audit | A 12-week pilot with an exit at every gate. Everything is audited and human-approved. |

## Layout

```
src/                 browser modules (engine, mock Cloud API, guardrails, evals, UI)
src/gate.js          decrypts the page; same AES-GCM / PBKDF2 construction as TelForce
build.js             bundles src and writes the encrypted index.html
index.html           published page (GitHub Pages)
test/                the original suite, pointed at the client-side modules
scripts/run-evals.js CLI eval gate
```

## Known gaps

- One indirect injection phrasing gets past the rules layer (INJ-DET stays above its threshold). A second classifier would sit in front of a production model. A human still approves every action.
- One knowledge question retrieves the wrong SOP (QA-RET 90.9%, on the threshold).
- The mock API follows the shape of the Guidewire Cloud API but is not a certified integration.
- State is in this browser only. Reset demo restores the starting claims.
