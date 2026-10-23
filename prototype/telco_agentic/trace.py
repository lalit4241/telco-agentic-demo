"""Structured trace of every step (stand-in for Agentforce Observability / session tracing)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

@dataclass
class TraceEvent:
    seq: int
    actor: str
    kind: str  # route | tool | guardrail | decision | escalation | comms | error
    detail: str
    data: dict[str, Any] = field(default_factory=dict)

    def render(self) -> str:
        return f"  [{self.seq:03d}] {self.actor:<22} {self.kind:<11} {self.detail}"


@dataclass
class Trace:
    session_id: str
    events: list[TraceEvent] = field(default_factory=list)

    def add(self, actor: str, kind: str, detail: str, **data: Any) -> TraceEvent:
        ev = TraceEvent(len(self.events) + 1, actor, kind, detail, data)
        self.events.append(ev)
        return ev

    def kinds(self) -> list[str]:
        return [e.kind for e in self.events]

    def tools_called(self) -> list[str]:
        return [e.data["tool"] for e in self.events if e.kind == "tool"]

    def to_dicts(self) -> list[dict[str, Any]]:
        return [{"seq": e.seq, "actor": e.actor, "kind": e.kind, "detail": e.detail, "data": e.data}
                for e in self.events]

    def render(self) -> str:
        return "\n".join(e.render() for e in self.events)
