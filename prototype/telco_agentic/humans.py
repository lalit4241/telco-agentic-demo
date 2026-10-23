"""Human-in-the-loop queue (stand-in for Omni-Channel routing to supervisors / Slack approvals)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .models import HumanTask

@dataclass
class HumanQueue:
    tasks: list[HumanTask] = field(default_factory=list)
    # Optional policy simulating a human decision in demos: fn(task) -> True/False, or None to leave open
    auto_decider: Callable[[HumanTask], bool | None] | None = None

    def raise_task(self, queue: str, reason: str, proposed_action: str, **context: Any) -> HumanTask:
        task = HumanTask(f"HT-{len(self.tasks) + 1:04d}", queue, reason, proposed_action, context)
        self.tasks.append(task)
        if self.auto_decider is not None:
            decision = self.auto_decider(task)
            if decision is not None:
                task.status = "approved" if decision else "rejected"
        return task

    def open_tasks(self, queue: str | None = None) -> list[HumanTask]:
        return [t for t in self.tasks if t.status == "open" and (queue is None or t.queue == queue)]
