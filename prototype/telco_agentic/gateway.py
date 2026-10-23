"""Governed tool gateway.

Stand-in for MuleSoft Agent Fabric / AI Gateway exposing TMF Open APIs as MCP tools.
Every call is checked against the calling agent's allow-list (least privilege,
cf. "Trusted Agent Identity"), audited, and written to the session trace.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .tmf_stubs import BSSOSS
from .trace import Trace


class ToolDenied(Exception):
    pass


@dataclass
class Tool:
    name: str          # MCP-style tool name
    tmf_api: str       # TMF API it fronts
    method: str        # HTTP verb in the underlying API
    fn: Callable[..., Any]
    write: bool = False


@dataclass
class ToolGateway:
    backend: BSSOSS
    tools: dict[str, Tool] = field(default_factory=dict)
    allow: dict[str, set[str]] = field(default_factory=dict)
    audit: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        b = self.backend
        for t in [
            Tool("customer.get", "TMF629", "GET", b.customer.retrieve),
            Tool("customer.patch", "TMF629", "PATCH", b.customer.patch, write=True),
            Tool("inventory.list", "TMF637", "GET", b.inventory.list_for_customer),
            Tool("bill.latest", "TMF678", "GET", b.bill.latest_for_customer),
            Tool("bill.adjust", "TMF678", "POST", b.bill.create_adjustment, write=True),
            Tool("ticket.create", "TMF621", "POST", b.ticket.create, write=True),
            Tool("ticket.findParent", "TMF621", "GET", b.ticket.find_open_parent),
            Tool("serviceOrder.get", "TMF641", "GET", b.service_order.retrieve),
            Tool("serviceOrder.patch", "TMF641", "PATCH", b.service_order.patch, write=True),
            Tool("alarm.activeForArea", "TMF642", "GET", b.alarm.active_for_area),
            Tool("catalog.retentionOffers", "TMF620", "GET", b.catalog.retention_offers),
        ]:
            self.tools[t.name] = t

    def grant(self, agent: str, *tool_names: str) -> None:
        unknown = set(tool_names) - set(self.tools)
        if unknown:
            raise KeyError(f"unknown tools {unknown}")
        self.allow.setdefault(agent, set()).update(tool_names)

    def call(self, agent: str, tool_name: str, trace: Trace, *args: Any, **kwargs: Any) -> Any:
        tool = self.tools.get(tool_name)
        if tool is None or tool_name not in self.allow.get(agent, set()):
            trace.add(agent, "guardrail", f"DENIED tool {tool_name} (not in allow-list)", tool=tool_name)
            self.audit.append({"agent": agent, "tool": tool_name, "allowed": False})
            raise ToolDenied(f"{agent} may not call {tool_name}")
        result = tool.fn(*args, **kwargs)
        self.audit.append({"agent": agent, "tool": tool_name, "allowed": True, "write": tool.write})
        trace.add(agent, "tool", f"{tool.tmf_api} {tool.method} {tool_name}", tool=tool_name,
                  tmf=tool.tmf_api, method=tool.method, write=tool.write,
                  request={"args": list(args), "body": kwargs}, response=result)
        return result
