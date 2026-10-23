"""Specialist agents. Each maps to a Salesforce product/agent in the working model.

Each agent: (1) gathers context via governed tools, (2) decides deterministically
against guardrails, (3) acts or hands off to a human with a proposed action.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import guardrails as g
from .gateway import ToolGateway
from .humans import HumanQueue
from .models import Outcome, Request
from .trace import Trace


@dataclass
class BaseAgent:
    name: str
    sf_mapping: str
    tools: tuple[str, ...]
    gw: ToolGateway
    humans: HumanQueue

    def register(self) -> None:
        self.gw.grant(self.name, *self.tools)

    def call(self, trace: Trace, tool: str, *a, **kw):
        return self.gw.call(self.name, tool, trace, *a, **kw)

    def escalate(self, trace: Trace, queue: str, reason: str, proposed: str, **ctx) -> Outcome:
        task = self.humans.raise_task(queue, reason, proposed, **ctx)
        trace.add(self.name, "escalation", f"-> {queue}: {reason} (task {task.id}, {task.status})",
                  task=task.id, queue=queue)
        return Outcome(self.name, "escalated", f"Handed to {queue}: {reason}",
                       handoff={"task": task.id, "queue": queue, "proposed": proposed,
                                "decision": task.status})

    def handle(self, req: Request, trace: Trace) -> Outcome:  # pragma: no cover - abstract
        raise NotImplementedError


class BillingDisputeAgent(BaseAgent):
    def __init__(self, gw, humans):
        super().__init__("BillingResolutionAgent",
                         "Agentforce for Communications - Billing Resolution Agent",
                         ("customer.get", "bill.latest", "bill.adjust"), gw, humans)

    def handle(self, req: Request, trace: Trace) -> Outcome:
        cust = self.call(trace, "customer.get", req.customer_id)
        bill = self.call(trace, "bill.latest", req.customer_id)
        # Deterministic bill analysis: find a line that is disputable on policy grounds.
        disputed = None
        for line in bill["lines"]:
            if line["type"] == "roaming" and line.get("plan_includes_roaming"):
                disputed = (line, "Roaming charged although plan includes EU roaming")
            elif line["type"] == "one-off" and "termination" in line["desc"].lower():
                disputed = (line, "Early termination charge disputed - contract review needed")
        if disputed is None:
            trace.add(self.name, "decision", "No policy-eligible error found; explaining bill")
            return Outcome(self.name, "resolved", "Bill explained line by line; no error found.")
        line, why = disputed
        amount = float(line["amount"])
        trace.add(self.name, "decision", f"Disputed line '{line['desc']}' £{amount:.2f}: {why}")

        if line["type"] == "one-off":
            return self.escalate(trace, "b2b-billing-specialists", why,
                                 f"Review contract; consider waiving £{amount:.2f}",
                                 bill=bill["id"], amount=amount)
        if g.vulnerable_customer_requires_human(cust):
            return self.escalate(trace, "billing-supervisors", "Vulnerable customer - human review",
                                 f"Credit £{amount:.2f}", bill=bill["id"], amount=amount)
        check = g.credit_within_authority(amount)
        trace.add(self.name, "guardrail", f"credit authority check: {'PASS' if check.ok else check.reason}")
        if not check.ok:
            out = self.escalate(trace, "billing-supervisors", check.reason,
                                f"Credit £{amount:.2f}", bill=bill["id"], amount=amount)
            if out.handoff and out.handoff["decision"] == "approved":
                adj = self.call(trace, "bill.adjust", bill["id"], amount, why + " (supervisor approved)")
                out.status, out.actions = "resolved", [f"adjustment {adj['id']}"]
                out.summary = f"Supervisor approved credit of £{amount:.2f}."
            return out
        adj = self.call(trace, "bill.adjust", bill["id"], amount, why)
        return Outcome(self.name, "resolved",
                       f"Credited £{amount:.2f} to next bill ({why}).", [f"adjustment {adj['id']}"])


class OrderFalloutAgent(BaseAgent):
    PLAYBOOK = {
        "ADDR_UPRN_MISMATCH": "Align install UPRN to address master and resubmit",
    }

    def __init__(self, gw, humans):
        super().__init__("OrderFalloutAgent",
                         "Agentforce (custom) on Industries Order Management / Communications Cloud",
                         ("serviceOrder.get", "serviceOrder.patch", "customer.get"), gw, humans)

    def handle(self, req: Request, trace: Trace) -> Outcome:
        order_id = req.context.get("order_id")
        if not order_id:
            return Outcome(self.name, "pending_customer", "Please provide your order reference.")
        so = self.call(trace, "serviceOrder.get", order_id)
        if so["state"] != "held":
            return Outcome(self.name, "resolved", f"Order {order_id} is {so['state']}; no fallout.")
        code = so.get("falloutCode", "UNKNOWN")
        trace.add(self.name, "decision", f"Fallout code {code}, retries={so['retries']}")
        if so["retries"] >= g.MAX_AUTO_RETRIES_FALLOUT:
            return self.escalate(trace, "order-management", "Retry budget exhausted",
                                 "Manual investigation with wholesale/OLO", order=order_id, code=code)
        if code not in self.PLAYBOOK:
            return self.escalate(trace, "order-management", f"No automated playbook for {code}",
                                 "Manual triage", order=order_id, code=code)
        fix = {"installAddress": dict(so["addressMaster"]), "state": "inProgress",
               "falloutCode": None, "retries": so["retries"] + 1}
        self.call(trace, "serviceOrder.patch", order_id, fix)
        return Outcome(self.name, "resolved",
                       f"Order {order_id} remediated ({self.PLAYBOOK[code]}) and resubmitted.",
                       [f"patched {order_id}"])


class NetworkFaultAgent(BaseAgent):
    def __init__(self, gw, humans):
        super().__init__("NetworkFaultAgent",
                         "Agentforce Service + Network/Asset Service agent; Field Service for dispatch",
                         ("customer.get", "inventory.list", "alarm.activeForArea",
                          "ticket.findParent", "ticket.create"), gw, humans)

    def handle(self, req: Request, trace: Trace) -> Outcome:
        cust = self.call(trace, "customer.get", req.customer_id)
        district = cust["postcode"].split()[0]
        services = self.call(trace, "inventory.list", req.customer_id)
        svc = next((s for s in services if "Fibre" in s["name"]), services[0])
        alarms = self.call(trace, "alarm.activeForArea", district)
        if alarms:
            a = alarms[0]
            parent = self.call(trace, "ticket.findParent", district)
            child = self.call(trace, "ticket.create", ticketType="customerFault",
                              relatedParty=req.customer_id, service=svc["serviceId"],
                              parentTicket=parent["id"] if parent else None, area=district)
            msg = (f"Known incident in {district}: {a['probableCause']}. "
                   f"Estimated fix {a['etr']}. We'll text you when it's restored.")
            trace.add(self.name, "comms", f"Proactive update sent: {msg}")
            trace.add(self.name, "decision", "Engineer dispatch suppressed (mass outage)")
            return Outcome(self.name, "resolved", msg, [f"child ticket {child['id']} -> {parent['id'] if parent else '-'}"])
        # No known incident: open ticket and dispatch via Field Service
        line_test = "FAULT_LOCAL_LOOP"  # deterministic mock of a line test result
        trace.add(self.name, "decision", f"No area alarm; line test result {line_test}")
        t = self.call(trace, "ticket.create", ticketType="customerFault", relatedParty=req.customer_id,
                      service=svc["serviceId"], area=district, diagnosis=line_test,
                      dispatch={"product": "Field Service", "slot": "next-available AM"})
        return Outcome(self.name, "resolved",
                       "Fault confirmed on your line; an engineer appointment has been booked.",
                       [f"ticket {t['id']}", "field service work order requested"])


class RetentionAgent(BaseAgent):
    def __init__(self, gw, humans):
        super().__init__("RetentionAgent",
                         "Agentforce Service/Sales + Data 360 churn insight + Communications Cloud EPC offers",
                         ("customer.get", "inventory.list", "catalog.retentionOffers"), gw, humans)

    def handle(self, req: Request, trace: Trace) -> Outcome:
        cust = self.call(trace, "customer.get", req.customer_id)
        offers = self.call(trace, "catalog.retentionOffers", cust["segment"])
        if g.vulnerable_customer_requires_human(cust):
            return self.escalate(trace, "retention-specialists", "Vulnerable customer - human retention",
                                 "Specialist call-back", customer=req.customer_id)
        eligible = [o for o in offers if g.retention_offer_within_policy(o["monthlyDiscountGBP"]).ok]
        if not eligible:
            return self.escalate(trace, "retention-specialists", "No in-policy offer",
                                 "Specialist call-back", customer=req.customer_id)
        best = max(eligible, key=lambda o: (o["monthlyDiscountGBP"], o["id"]))
        trace.add(self.name, "decision", f"Best in-policy offer {best['id']} ({best['name']})")
        return Outcome(self.name, "pending_customer",
                       f"Offer presented: {best['name']} (needs your acceptance; you can still leave - "
                       "we'll give you your switching code if you ask).", [f"offer {best['id']}"])


class FraudSimSwapAgent(BaseAgent):
    def __init__(self, gw, humans):
        super().__init__("SimSwapFraudAgent",
                         "Agentforce Service agent + Data 360 risk signals; Shield/Event Monitoring",
                         ("customer.get", "customer.patch"), gw, humans)

    def handle(self, req: Request, trace: Trace) -> Outcome:
        cust = self.call(trace, "customer.get", req.customer_id)
        score = g.sim_swap_risk(cust["riskSignals"], cust["tenureMonths"])
        trace.add(self.name, "guardrail", f"SIM-swap risk score {score} (block >= {g.SIM_SWAP_RISK_BLOCK_SCORE})")
        if score >= g.SIM_SWAP_RISK_BLOCK_SCORE:
            self.call(trace, "customer.patch", req.customer_id, {"simSwapHold": True})
            out = self.escalate(trace, "fraud-ops", f"High SIM-swap risk ({score})",
                                "Hold swap; in-store ID check", customer=req.customer_id, score=score)
            out.status = "blocked"
            out.summary = ("For your security we can't change your SIM remotely right now. "
                           "Please visit a store with photo ID; our fraud team has been notified.")
            return out
        if not req.context.get("otp_verified"):
            trace.add(self.name, "decision", "Step-up authentication required (OTP to registered device)")
            return Outcome(self.name, "pending_customer", "We've sent a one-time code to verify you.")
        self.call(trace, "customer.patch", req.customer_id, {"simSwapRequested": True})
        return Outcome(self.name, "resolved", "SIM swap scheduled after successful verification.",
                       ["sim swap order"])
