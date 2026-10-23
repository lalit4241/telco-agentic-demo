#!/usr/bin/env python3
"""Build dist/telco-agentic-demo.html: ONE self-contained file with no network dependencies.

The engine runs in the browser as JavaScript (webapp/static/engine.js, a line-for-line port of the
Python package that tests/test_js_engine.py checks against the Python outputs). Seed data, scenarios,
keywords and policy thresholds are exported from the Python package here, so there is one source of
truth for data. Open the file in any modern browser (double-click), or put it on any static host.
"""
import json
from pathlib import Path

from telco_agentic import guardrails as g
from telco_agentic import reasoner
from telco_agentic.scenarios import SCENARIOS
from telco_agentic.tmf_stubs import seed
from webapp import core

ROOT = Path(__file__).parent


def engine_data() -> dict:
    b = seed()
    tickets = [{k: v for k, v in t.items() if k not in ("id", "status")} for t in b.ticket.tickets.values()]
    return {
        "seed": {"customers": b.customer.customers, "products": b.inventory.products, "bills": b.bill.bills,
                 "service_orders": b.service_order.orders, "alarms": b.alarm.alarms,
                 "offerings": b.catalog.offerings, "seed_tickets": tickets},
        "policy": {"AUTO_CREDIT_LIMIT_GBP": g.AUTO_CREDIT_LIMIT_GBP,
                   "MAX_RETENTION_DISCOUNT_GBP": g.MAX_RETENTION_DISCOUNT_GBP,
                   "MAX_AUTO_RETRIES_FALLOUT": g.MAX_AUTO_RETRIES_FALLOUT,
                   "SIM_SWAP_RISK_BLOCK_SCORE": g.SIM_SWAP_RISK_BLOCK_SCORE},
        "sim_weights": g.SIM_SWAP_SIGNAL_WEIGHTS,
        "injection_patterns": g._INJECTION_PATTERNS,
        "pii_patterns": [[k, rx.pattern] for k, rx in g._PII_PATTERNS.items()],
        "intents": list(reasoner.INTENTS),
        "keywords": {k: list(v) for k, v in reasoner._KEYWORDS.items()},
        "channels": core.CHANNELS,
        "scenarios": [{"title": t, "customer_id": r.customer_id, "text": r.text, "channel": r.channel,
                       "context": r.context} for t, r in SCENARIOS],
        "meta": core.meta(),
    }


def _safe_json(o) -> str:
    # Safe to embed inside a <script> element.
    return json.dumps(o, ensure_ascii=False).replace("</", "<\\/")


def main() -> Path:
    engine = (ROOT / "webapp/static/engine.js").read_text()
    boot = ("<script>\n" + engine.replace("</script", "<\\/script") + "\n</script>\n<script>\n"
            "(function(){ try { const E = window.TelcoEngine.create(" + _safe_json(engine_data()) + ");\n"
            "  window.LOCAL_API = async (m, p, b, sid) => E.dispatch(m, p, b, sid);\n"
            "} catch (e) { window.ENGINE_ERROR = e; } })();\n</script>")
    html = (ROOT / "webapp/static/index.html").read_text().replace("<!--STATIC-BOOT-->", boot)
    html = html.replace("Each browser gets its own isolated session.",
                        "Offline build: everything runs inside your browser; nothing is sent anywhere.")
    out = ROOT / "dist/telco-agentic-demo.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html)
    return out


if __name__ == "__main__":
    print(main())
