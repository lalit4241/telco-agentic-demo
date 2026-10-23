#!/usr/bin/env python3
"""Run end-to-end telco scenarios through the orchestrator and print the trace."""
from telco_agentic.humans import HumanQueue
from telco_agentic.scenarios import SCENARIOS
from telco_agentic.orchestrator import Orchestrator



def main() -> int:
    # Demo: a simulated billing supervisor approves credits under £300; all other tasks stay open
    # in their queues for a human (as they would in Omni-Channel / Slack approvals).
    humans = HumanQueue(auto_decider=lambda t: (float(t.context["amount"]) < 300)
                        if t.queue == "billing-supervisors" else None)
    orch = Orchestrator(humans=humans)
    for title, req in SCENARIOS:
        print("=" * 100)
        print(f"{title}\n  customer={req.customer_id} channel={req.channel}")
        print(f"  says: {req.text!r}")
        print("-" * 100)
        res = orch.handle(req)
        print(res.trace.render())
        for o in res.outcomes:
            print(f"  => {o.agent}: {o.status.upper()} - {o.summary}")
    print("=" * 100)
    print("Human-in-the-loop tasks raised:")
    for t in humans.tasks:
        print(f"  {t.id} [{t.queue}] {t.reason} | proposed: {t.proposed_action} | decision: {t.status}")
    print(f"Gateway audit: {len(orch.gw.audit)} tool calls, "
          f"{sum(1 for a in orch.gw.audit if a.get('write'))} writes, "
          f"{sum(1 for a in orch.gw.audit if not a['allowed'])} denied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
