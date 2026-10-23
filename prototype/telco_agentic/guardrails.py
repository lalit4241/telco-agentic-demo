"""Guardrails: deterministic policies applied around every agent decision.

These mirror the kinds of controls an Einstein Trust Layer + Agent Script +
topic-level instructions would enforce, implemented as plain Python so they
are testable and auditable.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Policy thresholds (would live in Custom Metadata / Agent Script variables in Salesforce)
AUTO_CREDIT_LIMIT_GBP = 50.00          # agent may auto-credit up to this
MAX_RETENTION_DISCOUNT_GBP = 10.00     # per-month discount ceiling without supervisor
MAX_AUTO_RETRIES_FALLOUT = 2           # order fallout auto-remediation attempts
SIM_SWAP_RISK_BLOCK_SCORE = 60         # block and step-up above this

_INJECTION_PATTERNS = [
    r"ignore (all|any|previous|prior) (instructions|rules)",
    r"you are now", r"system prompt", r"developer mode",
    r"disregard (the )?(policy|guardrails?)",
]
_PII_PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    "uk_mobile": re.compile(r"\b07\d{9}\b"),
    "card": re.compile(r"\b(?:\d[ -]?){13,16}\b"),
}


@dataclass
class GuardrailResult:
    ok: bool
    reason: str = ""


def detect_prompt_injection(text: str) -> GuardrailResult:
    t = text.lower()
    for p in _INJECTION_PATTERNS:
        if re.search(p, t):
            return GuardrailResult(False, f"prompt-injection pattern '{p}'")
    return GuardrailResult(True)


def mask_pii(text: str) -> str:
    """Mask PII before anything is sent to a (pluggable) LLM - Trust Layer style data masking."""
    out = text
    for label, rx in _PII_PATTERNS.items():
        out = rx.sub(f"<{label.upper()}>", out)
    return out


def credit_within_authority(amount: float) -> GuardrailResult:
    if amount <= AUTO_CREDIT_LIMIT_GBP:
        return GuardrailResult(True)
    return GuardrailResult(False, f"credit £{amount:.2f} exceeds agent authority £{AUTO_CREDIT_LIMIT_GBP:.2f}")


def retention_offer_within_policy(monthly_discount: float) -> GuardrailResult:
    if monthly_discount <= MAX_RETENTION_DISCOUNT_GBP:
        return GuardrailResult(True)
    return GuardrailResult(False, "retention discount exceeds policy ceiling")


SIM_SWAP_SIGNAL_WEIGHTS = {
    "password_reset_24h": 30,
    "new_device_login": 20,
    "port_out_query": 25,
    "recent_address_change": 20,
}


def sim_swap_risk(signals: list[str], tenure_months: int) -> int:
    score = sum(SIM_SWAP_SIGNAL_WEIGHTS.get(s, 10) for s in signals)
    if tenure_months < 12:
        score += 10
    return min(score, 100)


def vulnerable_customer_requires_human(customer: dict) -> bool:
    """Ofcom fairness / vulnerability expectations: sensitive outcomes for vulnerable customers go to a human."""
    return bool(customer.get("vulnerable"))
