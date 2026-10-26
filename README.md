<p><a href="./intentbridge/"><img src="intentbridge/docs/brand/telforce-lockup-light.svg" alt="TelForce - The Agentic Telco" height="56"></a></p>

# Agentic working model for telecoms

A self-contained demo of an **agentic working model for telecoms**, written after Dreamforce 2026. An orchestrator (a front-door superagent) routes each request to specialist agents. Those agents reach BSS/OSS only through a governed tool gateway that exposes **mock TM Forum Open APIs**. Guardrails screen the input, mask personal data, and enforce authority limits. Work that exceeds policy is handed to a person (human-in-the-loop). Every customer, bill, order, and alarm in the demo is **fictional**.

**Live demo:** [https://lalit4241.github.io/telco-agentic-demo/](https://lalit4241.github.io/telco-agentic-demo/)

A check of that page — HTTP status, all eight scenarios, one supervisor approval, and the prototype test run — is in [TEST_RESULTS.md](TEST_RESULTS.md).

**TelForce - The Agentic Telco (demo on the Salesforce ecosystem):** [open `./intentbridge/`](./intentbridge/) ([live](https://lalit4241.github.io/telco-agentic-demo/intentbridge/)) — network-aware proactive care, wholesale partner agent-to-agent with an Agent Fabric kill switch, order fallout repair with the Systems Integration Agent, and a superagent router, all governed by **IntentBridge** (the AIforce × TM Forum ODA layer). One offline HTML file plus a Salesforce SFDX package (8 TelForce invocable actions, 100% Apex coverage). The TelForce page has a light client-side password gate (password shared separately; the app is AES-GCM encrypted in the page). Built on Salesforce Agentforce · aligned to TM Forum ODA; personal concept demo by Lalit Chauhan, not an official Salesforce product. Test record: [intentbridge/TEST_RESULTS.md](intentbridge/TEST_RESULTS.md).

The page at the root (`index.html`) is the offline build: one HTML file, pure JavaScript, no network calls and no API keys. Open that URL, pick one of the eight scenarios (or type a free-text request), and follow the trace — routing, TMF reads and writes, guardrail decisions, customer messages, and supervisor approvals.

## Run the prototype locally

The Python engine, FastAPI app, tests, and architecture notes are in [`prototype/`](prototype/). Python 3.10 or newer. The engine itself has no third-party dependencies; the web UI uses FastAPI and uvicorn.

```bash
cd prototype
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt

.venv/bin/python demo.py        # eight scenarios, full trace
.venv/bin/python -m pytest -q   # engine, API, and offline-build tests

LOCAL_ONLY=1 ./run_hosted.sh    # http://127.0.0.1:8765
```

`./run_hosted.sh stop` stops the local server. More detail — specialist agents, the mock TMF surface, and how a supervisor decision is applied — is in [`prototype/README.md`](prototype/README.md). The reference architecture is in [`prototype/docs/ARCHITECTURE.md`](prototype/docs/ARCHITECTURE.md).

Rebuild the single-file page from the Python source with:

```bash
cd prototype
.venv/bin/python build_static.py   # writes prototype/dist/telco-agentic-demo.html
```

## What is published

GitHub Actions (`.github/workflows/pages.yml`) deploys this repository root to GitHub Pages on every push to `main`. `index.html` is the site. `.nojekyll` keeps Pages from running Jekyll over the tree.
