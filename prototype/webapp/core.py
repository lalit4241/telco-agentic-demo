"""Framework-free API logic shared by the FastAPI server and the static in-browser (Pyodide) build."""
from __future__ import annotations

import re
from typing import Any

from telco_agentic.models import Request
from telco_agentic.orchestrator import Orchestrator
from telco_agentic.scenarios import SCENARIOS
from telco_agentic.tmf_stubs import seed

from .session import SessionStore

CHANNELS = ["chat", "voice", "whatsapp", "employee"]
SID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
MAX_TEXT = 500


class ApiError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def check_sid(sid: str | None) -> str:
    if not sid or not SID_RE.match(sid):
        raise ApiError(400, "Missing or invalid X-Demo-Session header")
    return sid


def meta() -> dict[str, Any]:
    b = seed()
    customers = [{k: c[k] for k in ("id", "name", "segment", "postcode", "tenureMonths", "vulnerable", "riskSignals")}
                 for c in b.customer.customers.values()]
    for c in customers:
        c["products"] = [p["name"] for p in b.inventory.list_for_customer(c["id"])]
    orders = [{"id": o["id"], "customer": o["relatedParty"], "spec": o["serviceSpecification"],
               "state": o["state"], "falloutCode": o.get("falloutCode")} for o in b.service_order.orders.values()]
    scenarios = [{"index": i, "title": t, "customer_id": r.customer_id, "text": r.text, "channel": r.channel,
                  "context": r.context} for i, (t, r) in enumerate(SCENARIOS)]
    o = Orchestrator(backend=b)
    agents = [{"intent": i, "name": a.name, "maps_to": a.sf_mapping, "tools": list(a.tools)}
              for i, a in o.agents.items()]
    return {"scenarios": scenarios, "customers": customers, "orders": orders, "agents": agents,
            "channels": CHANNELS}


def run(store: SessionStore, sid: str | None, body: dict[str, Any]) -> dict[str, Any]:
    s = store.get(check_sid(sid))
    scen = body.get("scenario")
    if scen is not None:
        if not isinstance(scen, int) or not 0 <= scen < len(SCENARIOS):
            raise ApiError(422, f"scenario must be 0..{len(SCENARIOS) - 1}")
        title, req = SCENARIOS[scen]
        req = Request(req.customer_id, req.text, req.channel, dict(req.context))
    else:
        cid, text = body.get("customer_id"), (body.get("text") or "").strip()
        channel = body.get("channel") or "chat"
        if not cid or not text:
            raise ApiError(422, "customer_id and text are required for a free-text request")
        if len(text) > MAX_TEXT:
            raise ApiError(422, f"text must be at most {MAX_TEXT} characters")
        if channel not in CHANNELS:
            raise ApiError(422, f"channel must be one of {CHANNELS}")
        ctx: dict[str, Any] = {}
        if body.get("order_id"):
            ctx["order_id"] = str(body["order_id"])
        if body.get("otp_verified"):
            ctx["otp_verified"] = True
        title, req = "Free-text request", Request(str(cid), text, channel, ctx)
    out = s.run(req)
    out["title"] = title
    out["request"] = {"customer_id": req.customer_id, "text": req.text, "channel": req.channel, "context": req.context}
    return out


def queue(store: SessionStore, sid: str | None) -> dict[str, Any]:
    s = store.get(check_sid(sid))
    return {"tasks": s.tasks(), "stats": s.stats()}


def decide(store: SessionStore, sid: str | None, task_id: str, body: dict[str, Any]) -> dict[str, Any]:
    s = store.get(check_sid(sid))
    if not isinstance(body.get("approve"), bool):
        raise ApiError(422, "approve must be true or false")
    note = str(body.get("note") or "")[:200]
    try:
        return s.decide(task_id, body["approve"], note)
    except KeyError:
        raise ApiError(404, "No such task") from None
    except ValueError as e:
        raise ApiError(409, str(e)) from None


def reset(store: SessionStore, sid: str | None) -> dict[str, Any]:
    s = store.reset(check_sid(sid))
    return {"ok": True, "tasks": s.tasks(), "stats": s.stats()}
