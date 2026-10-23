"""Orchestrator ("Superagent"): single front door that routes to specialist agents.

Pipeline per request:
  1. Input guardrails  - prompt-injection screen; PII masked before any LLM call
  2. Intent reasoning  - rule-based (default) or pluggable LLM, closed intent set
  3. Routing           - primary intent -> specialist; churn as secondary intent -> RetentionAgent
  4. Fallback          - unknown intent or agent error -> human with full context (no dead ends)
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field

from . import guardrails as g
from .agents import (BaseAgent, BillingDisputeAgent, FraudSimSwapAgent, NetworkFaultAgent,
                     OrderFalloutAgent, RetentionAgent)
from .gateway import ToolDenied, ToolGateway
from .humans import HumanQueue
from .models import Outcome, Request
from .reasoner import Reasoner, RuleBasedReasoner
from .tmf_stubs import BSSOSS, NotFound, seed
from .trace import Trace



@dataclass
class SessionResult:
    trace: Trace
    intents: list[str]
    outcomes: list[Outcome] = field(default_factory=list)

    @property
    def final_status(self) -> str:
        return self.outcomes[0].status if self.outcomes else "none"


class Orchestrator:
    name = "Orchestrator"

    def __init__(self, backend: BSSOSS | None = None, reasoner: Reasoner | None = None,
                 humans: HumanQueue | None = None):
        self.backend = backend or seed()
        self._sess = itertools.count(1)
        self.gw = ToolGateway(self.backend)
        self.humans = humans or HumanQueue()
        self.reasoner = reasoner or RuleBasedReasoner()
        self.agents: dict[str, BaseAgent] = {
            "billing_dispute": BillingDisputeAgent(self.gw, self.humans),
            "order_fallout": OrderFalloutAgent(self.gw, self.humans),
            "network_fault": NetworkFaultAgent(self.gw, self.humans),
            "churn_risk": RetentionAgent(self.gw, self.humans),
            "sim_swap": FraudSimSwapAgent(self.gw, self.humans),
        }
        for a in self.agents.values():
            a.register()

    def handle(self, req: Request) -> SessionResult:
        trace = Trace(f"S-{next(self._sess):04d}")
        inj = g.detect_prompt_injection(req.text)
        if not inj.ok:
            trace.add(self.name, "guardrail", f"BLOCKED input: {inj.reason}")
            task = self.humans.raise_task("security-review", inj.reason, "Review session", customer=req.customer_id)
            trace.add(self.name, "escalation", f"-> security-review (task {task.id})")
            return SessionResult(trace, [], [Outcome(self.name, "blocked",
                                 "I can't help with that request. A colleague will review it.")])
        masked = g.mask_pii(req.text)
        trace.add(self.name, "guardrail", f"input screened; masked text: '{masked}'")
        intents = self.reasoner.classify(masked)
        trace.add(self.name, "route", f"intents={intents or ['unknown']} channel={req.channel}")
        result = SessionResult(trace, intents)
        if not intents:
            task = self.humans.raise_task("frontline-advisors", "Intent not recognised", "Human takes over",
                                          customer=req.customer_id, text=masked)
            trace.add(self.name, "escalation", f"-> frontline-advisors (task {task.id})")
            result.outcomes.append(Outcome(self.name, "escalated", "Connecting you to an adviser."))
            return result

        primary = intents[0]
        result.outcomes.append(self._dispatch(primary, req, trace))
        # Secondary churn signal: hand to RetentionAgent after the primary issue is dealt with,
        # unless the primary outcome was a security block.
        if "churn_risk" in intents[1:] and result.outcomes[0].status != "blocked":
            trace.add(self.name, "route", "secondary intent churn_risk -> RetentionAgent")
            result.outcomes.append(self._dispatch("churn_risk", req, trace))
        return result

    def _dispatch(self, intent: str, req: Request, trace: Trace) -> Outcome:
        agent = self.agents[intent]
        trace.add(self.name, "route", f"{intent} -> {agent.name} [{agent.sf_mapping}]")
        try:
            out = agent.handle(req, trace)
        except (ToolDenied, NotFound, KeyError) as exc:
            trace.add(agent.name, "error", f"{type(exc).__name__}: {exc}")
            return agent.escalate(trace, "frontline-advisors", f"Agent error: {type(exc).__name__}",
                                  "Human takes over", customer=req.customer_id)
        trace.add(agent.name, "decision", f"OUTCOME {out.status}: {out.summary}")
        return out
