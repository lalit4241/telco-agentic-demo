"""Agentic working model for telecoms - reference prototype.

A deterministic, key-free multi-agent simulation: an orchestrator ("superagent")
routes customer/employee requests to specialist agents which act on mock
TM Forum Open API stubs through a governed tool gateway (MCP / MuleSoft
Agent Fabric stand-in), with guardrails and human-in-the-loop escalation.
"""
__version__ = "0.1.0"
