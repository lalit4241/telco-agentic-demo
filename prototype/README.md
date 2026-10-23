# Agentic working model for telecoms — reference prototype

A small, deterministic, key-free Python simulation of the agent topology described in
the *Agentic Working Model for Telecoms (post-Dreamforce 2026)* Page. It shows how an
orchestrator ("superagent", cf. Agentforce multi-agent orchestration) routes telco
requests to specialist agents which act on BSS/OSS **only** through a governed tool
gateway that exposes mock **TM Forum Open APIs** (as MuleSoft Agent Fabric / MCP would),
with guardrails and human-in-the-loop (HITL) escalation.

> This is an architecture illustration, not Salesforce code. Names in the
> `sf_mapping` field indicate which Salesforce product would implement each role.

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python demo.py          # 8 end-to-end scenarios with a full trace
.venv/bin/python -m pytest -q     # 48 tests (engine, API, offline build, JS/Python parity)
```

Python 3.10+. The engine has no third-party dependencies; the web UI uses FastAPI + uvicorn.
No API keys, no external calls, fictional data only.

## Web UI (live demo)

```bash
LOCAL_ONLY=1 ./run_hosted.sh      # server only: open http://127.0.0.1:8765
./run_hosted.sh                   # server + Cloudflare quick tunnel; prints the public https URL
./run_hosted.sh stop              # stop both
```

What the UI shows:

* **Scenario picker** for the 8 scripted scenarios, or a **free-text request** against any of the
  four fictional customer profiles (channel, order reference and OTP status selectable).
* **Agent timeline**: orchestrator routing (primary and secondary intent), each specialist step,
  every **TMF Open API call** with READ/WRITE badge and expandable request/response, guardrail
  checks, decisions, customer comms and human hand-offs.
* **Supervisor queue**: escalated items can be **approved or rejected live**. Approving an
  over-authority billing credit makes the SupervisorConsole post the TMF678 adjustment through the
  same governed gateway; rejecting a fraud hold patches TMF629; approving an order fallout hands it
  to the wholesale desk via TMF641.
* **Architecture legend**, session activity counters and a **Reset demo** button.

Each browser tab-set gets its own **isolated session** (seeded BSS/OSS, orchestrator, queues),
keyed by a random `X-Demo-Session` id held in `localStorage`; sessions expire after 4 hours
(max 500 in memory). Concurrent viewers never see each other's data.

API: `GET /api/meta`, `POST /api/run`, `GET /api/queue`, `POST /api/queue/{id}/decision`,
`POST /api/reset`, `GET /healthz`; OpenAPI docs at `/api/docs`.

### Hosting notes

`run_hosted.sh` runs uvicorn and `cloudflared tunnel --url` in their own process groups
(`setsid nohup`) inside auto-restart loops, waits for a *registered* edge connection and writes
the URL to `.run/url.txt` (logs in `.run/`). A quick-tunnel URL is random, **changes every time
the tunnel restarts**, carries no SLA and lives only as long as the host machine. Cloudflare's
edge needs **outbound port 7844 (TCP or UDP)**; on networks that only allow 80/443 the script
exits with code 2 and leaves the local server running. On the original build box only
TLS on 443 was allowed outbound, so Cloudflare (QUIC/HTTP2 on 7844), Pinggy, localhost.run and
serveo (SSH), localtunnel (random TCP data port) and tunnelmole (8083) all failed. For a stable URL use a named Cloudflare
tunnel, or deploy the app (it is a single FastAPI process) to any container host.

### Offline single-file build (no server, no network)

```bash
.venv/bin/python build_static.py  # -> dist/telco-agentic-demo.html (~60 KB)
```

One HTML file with the engine compiled in as JavaScript (`webapp/static/engine.js`, a port of the
Python package; seed data, scenarios, keywords and thresholds are exported from Python at build time).
`tests/test_js_engine.py` runs ~35 API steps through both engines with Node and requires identical
JSON. No CDN, no fetches: it works offline, from `file://`, on any static host, and inside a
sandboxed iframe that allows scripts. If a viewer blocks scripts entirely (chat, email and
file-preview panes usually do), the page says so instead of showing empty panels. Download it and
open it in Chrome, Edge, Safari or Firefox.

## Layout

| File | Role | Salesforce analogue |
|---|---|---|
| `telco_agentic/orchestrator.py` | Front door: input guardrails, intent reasoning, routing, fallback to human | Agentforce superagent / multi-agent orchestration |
| `telco_agentic/agents.py` | Specialist agents: Billing Resolution, Order Fallout, Network Fault, Retention, SIM-swap Fraud | Agentforce for Communications agents + custom Agentforce agents |
| `telco_agentic/gateway.py` | Tool registry, per-agent allow-lists, audit log | MuleSoft Agent Fabric (AI Gateway, Trusted Agent Identity), MCP tools |
| `telco_agentic/tmf_stubs.py` | In-memory TMF629/637/678/621/641/642/620 + seed data for a fictional UK CSP | BSS/OSS behind MuleSoft |
| `telco_agentic/guardrails.py` | Injection screen, PII masking, credit authority, retention ceiling, SIM-swap risk, vulnerability rule | Einstein Trust Layer, Agent Script deterministic rules |
| `telco_agentic/reasoner.py` | Rule-based intent classifier; pluggable `LLMReasoner(fn)` with closed-set validation and fallback | Atlas/Agentforce reasoning engine, model choice |
| `telco_agentic/humans.py` | HITL queues with optional simulated decider | Omni-Channel routing / Slack approvals |
| `telco_agentic/trace.py` | Session trace of every route, tool call (with TMF request/response), guardrail and decision | Agentforce Observability / session tracing |
| `telco_agentic/scenarios.py` | The 8 demo scenarios (shared by CLI and UI) | Agentforce Testing Center test sets |
| `webapp/core.py`, `webapp/session.py` | Framework-free API logic; per-viewer sessions; live supervisor decisions | Omni-Channel supervisor / Slack approval actions |
| `webapp/app.py`, `webapp/static/index.html` | FastAPI server and single-page UI | Agentforce console / Coworker surface |
| `build_static.py` | Builds the serverless Pyodide single-file demo | n/a |
| `run_hosted.sh` | Detached server + quick tunnel with auto-restart | n/a |

## Scenarios in `demo.py`

1. Consumer roaming overcharge (£39.40) — auto-credit within £50 authority, then churn signal handed to Retention agent (offer needs acceptance).
2. B2B FTTP order held on UPRN mismatch — auto-remediated via TMF641 PATCH and resubmitted.
3. SIP-trunk order with retry budget exhausted — escalated to order management.
4. Broadband fault in an area with an active TMF642 alarm — child ticket linked to parent incident, proactive ETR comms, truck roll suppressed.
5. SIM-swap with fraud signals (risk 85) — blocked, hold placed, fraud-ops task raised.
6. Roaming overcharge of £72.50 (above authority) — supervisor approval (simulated) then credit applied.
7. Prompt-injection attempt — blocked before any tool call.
8. B2B early termination charge dispute — routed to B2B billing specialists.

## Plugging in an LLM

```python
from telco_agentic.reasoner import LLMReasoner
from telco_agentic.orchestrator import Orchestrator

def my_llm(prompt: str) -> str:   # call any model; must return a JSON list of intents
    ...

orch = Orchestrator(reasoner=LLMReasoner(my_llm))
```

PII is masked before the reasoner sees the text, the output is validated against the
closed intent set, and any failure falls back to the deterministic rules — the model can
choose a route but can never invent one or touch a tool directly.

## Extending

- Add a TMF API: add a stub class in `tmf_stubs.py`, register a `Tool` in `gateway.py`.
- Add an agent: subclass `BaseAgent`, declare its tool allow-list, register it in `Orchestrator.agents` and add keywords to `reasoner.py`.
- Policy values (credit limit, retry budget, risk threshold) live at the top of `guardrails.py`.
