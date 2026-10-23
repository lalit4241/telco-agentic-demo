"""Intent reasoning. Deterministic by default; an LLM can be plugged in.

`RuleBasedReasoner` needs no keys and is fully deterministic (used by tests).
`LLMReasoner` wraps any callable `fn(prompt) -> str` (e.g. an Agentforce / Models API
call, OpenAI, Bedrock, a local model). Its output is validated against the closed
intent set and it falls back to rules on any error - the LLM never gets to invent
a route.
"""
from __future__ import annotations

import json
from typing import Callable, Protocol

INTENTS = ("billing_dispute", "order_fallout", "network_fault", "churn_risk", "sim_swap")

_KEYWORDS: dict[str, tuple[str, ...]] = {
    "sim_swap": ("sim swap", "new sim", "replace my sim", "lost my phone", "esim transfer", "swap my sim", "sim replacement", "phone was stolen"),
    "order_fallout": ("order stuck", "order held", "fallout", "installation date", "order status",
                      "not been activated", "activation", "order is stuck", "order is held", "engineer appointment"),
    "network_fault": ("broadband down", "no internet", "no service", "outage", "connection dropped",
                      "internet is down", "no signal", "broadband is down", "wifi is down", "wifi down",
                      "not working", "keeps dropping", "no broadband", "line is dead"),
    "billing_dispute": ("bill", "charged", "charge", "refund", "overcharged", "roaming"),
    "churn_risk": ("leave", "cancel", "switch provider", "pac code", "stac code", "porting", "better deal", "end my contract", "move to another"),
}


class Reasoner(Protocol):
    def classify(self, text: str) -> list[str]: ...


class RuleBasedReasoner:
    def classify(self, text: str) -> list[str]:
        t = text.lower()
        found = [i for i in INTENTS if any(k in t for k in _KEYWORDS[i])]
        # primary intent ordering: operational issue first, churn as secondary
        order = ["sim_swap", "network_fault", "order_fallout", "billing_dispute", "churn_risk"]
        return sorted(found, key=order.index)


class LLMReasoner:
    def __init__(self, fn: Callable[[str], str], fallback: Reasoner | None = None):
        self.fn = fn
        self.fallback = fallback or RuleBasedReasoner()

    def classify(self, text: str) -> list[str]:
        prompt = (
            "Classify the telco customer request into zero or more of these intents, "
            f"most important first: {list(INTENTS)}. Reply with a JSON list only.\n\n"
            f"Request: {text}"
        )
        try:
            out = json.loads(self.fn(prompt))
            if isinstance(out, list) and all(i in INTENTS for i in out):
                return out
        except Exception:  # noqa: BLE001 - any LLM failure falls back to rules
            pass
        return self.fallback.classify(text)
