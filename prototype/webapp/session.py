"""Per-viewer demo sessions: each browser gets its own seeded BSS/OSS, orchestrator and queues."""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any

from telco_agentic.models import Request
from telco_agentic.orchestrator import Orchestrator
from telco_agentic.trace import Trace

MAX_SESSIONS = 500
SESSION_TTL_S = 4 * 3600


def _jsonable(o: Any) -> Any:
    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple, set)):
        return [_jsonable(v) for v in o]
    if isinstance(o, (str, int, float, bool)) or o is None:
        return o
    return str(o)


@dataclass
class DemoSession:
    orch: Orchestrator = field(default_factory=Orchestrator)
    runs: int = 0
    last_seen: float = field(default_factory=time.time)
    task_run: dict[str, int] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self) -> None:
        # The supervisor console acts through the same governed gateway with its own identity.
        self.orch.gw.grant("SupervisorConsole", "bill.adjust", "customer.patch", "serviceOrder.patch")

    # ---- serialisers -------------------------------------------------------------
    def tasks(self) -> list[dict[str, Any]]:
        return [{"id": t.id, "queue": t.queue, "reason": t.reason, "proposed": t.proposed_action,
                 "status": t.status, "context": _jsonable(t.context), "run": self.task_run.get(t.id)}
                for t in self.orch.humans.tasks]

    def stats(self) -> dict[str, int]:
        a = self.orch.gw.audit
        return {"runs": self.runs, "toolCalls": sum(1 for x in a if x["allowed"]),
                "writes": sum(1 for x in a if x.get("write")), "denied": sum(1 for x in a if not x["allowed"]),
                "openTasks": len(self.orch.humans.open_tasks())}

    # ---- actions -----------------------------------------------------------------
    def run(self, req: Request) -> dict[str, Any]:
        with self.lock:
            before = {t.id for t in self.orch.humans.tasks}
            res = self.orch.handle(req)
            self.runs += 1
            for t in self.orch.humans.tasks:
                if t.id not in before:
                    self.task_run[t.id] = self.runs
            return {"run": self.runs, "session": res.trace.session_id, "intents": res.intents,
                    "finalStatus": res.final_status,
                    "outcomes": [{"agent": o.agent, "status": o.status, "summary": o.summary,
                                  "actions": o.actions, "handoff": _jsonable(o.handoff)} for o in res.outcomes],
                    "events": _jsonable(res.trace.to_dicts()),
                    "tasks": self.tasks(), "stats": self.stats()}

    def decide(self, task_id: str, approve: bool, note: str = "") -> dict[str, Any]:
        with self.lock:
            task = next((t for t in self.orch.humans.tasks if t.id == task_id), None)
            if task is None:
                raise KeyError(task_id)
            if task.status != "open":
                raise ValueError(f"{task_id} already {task.status}")
            trace = Trace(f"{task_id}-decision")
            who = "SupervisorConsole"
            task.status = "approved" if approve else "rejected"
            trace.add(who, "decision", f"{task.queue}: {task.id} {task.status.upper()}"
                      + (f" - {note}" if note else ""))
            gw, ctx = self.orch.gw, task.context
            if approve and task.queue in ("billing-supervisors", "b2b-billing-specialists") and "bill" in ctx:
                adj = gw.call(who, "bill.adjust", trace, ctx["bill"], float(ctx["amount"]),
                              f"Approved by {task.queue} ({task.id})")
                trace.add(who, "comms", f"Customer told: credit of £{float(ctx['amount']):.2f} applied ({adj['id']})")
            elif task.queue == "fraud-ops" and "customer" in ctx:
                if approve:
                    trace.add(who, "comms", "Hold confirmed; customer asked to visit a store with photo ID")
                else:
                    gw.call(who, "customer.patch", trace, ctx["customer"], {"simSwapHold": False})
                    trace.add(who, "comms", "Hold released after fraud review; swap may proceed with OTP")
            elif task.queue == "order-management" and "order" in ctx and approve:
                gw.call(who, "serviceOrder.patch", trace, ctx["order"],
                        {"assignedTo": "wholesale-desk", "note": "Manual OLO escalation"})
                trace.add(who, "comms", "B2B customer updated: order with wholesale desk, next update in 24h")
            else:
                trace.add(who, "comms", "Decision recorded; no automated follow-up for this queue")
            return {"task": next(t for t in self.tasks() if t["id"] == task_id),
                    "events": _jsonable(trace.to_dicts()), "tasks": self.tasks(), "stats": self.stats()}


class SessionStore:
    def __init__(self) -> None:
        self._s: OrderedDict[str, DemoSession] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, sid: str) -> DemoSession:
        now = time.time()
        with self._lock:
            for k in [k for k, v in self._s.items() if now - v.last_seen > SESSION_TTL_S]:
                del self._s[k]
            s = self._s.get(sid)
            if s is None:
                s = DemoSession()
                self._s[sid] = s
                while len(self._s) > MAX_SESSIONS:
                    self._s.popitem(last=False)
            self._s.move_to_end(sid)
            s.last_seen = now
            return s

    def reset(self, sid: str) -> DemoSession:
        with self._lock:
            self._s.pop(sid, None)
        return self.get(sid)

    def __len__(self) -> int:
        return len(self._s)
