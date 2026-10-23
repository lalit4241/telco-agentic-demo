from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Request:
    customer_id: str
    text: str
    channel: str = "chat"          # chat | voice | whatsapp | employee
    context: dict[str, Any] = field(default_factory=dict)  # e.g. order_id, authenticated


@dataclass
class Outcome:
    agent: str
    status: str                    # resolved | escalated | blocked | pending_customer
    summary: str
    actions: list[str] = field(default_factory=list)
    handoff: dict[str, Any] | None = None


@dataclass
class HumanTask:
    id: str
    queue: str                     # e.g. billing-supervisors, fraud-ops, order-mgmt
    reason: str
    proposed_action: str
    context: dict[str, Any]
    status: str = "open"           # open | approved | rejected
