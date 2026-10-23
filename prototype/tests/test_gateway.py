import pytest

from telco_agentic.gateway import ToolDenied, ToolGateway
from telco_agentic.tmf_stubs import seed
from telco_agentic.trace import Trace


def test_least_privilege_denies_unlisted_tool():
    gw = ToolGateway(seed())
    gw.grant("RetentionAgent", "customer.get")
    t = Trace("x")
    gw.call("RetentionAgent", "customer.get", t, "CUST-1001")
    with pytest.raises(ToolDenied):
        gw.call("RetentionAgent", "bill.adjust", t, "BILL-1001-09", 10, "x")
    assert gw.audit[-1] == {"agent": "RetentionAgent", "tool": "bill.adjust", "allowed": False}
    assert "guardrail" in t.kinds()


def test_every_tool_maps_to_a_tmf_api():
    gw = ToolGateway(seed())
    assert {t.tmf_api for t in gw.tools.values()} >= {"TMF629", "TMF637", "TMF678", "TMF621",
                                                       "TMF641", "TMF642", "TMF620"}
