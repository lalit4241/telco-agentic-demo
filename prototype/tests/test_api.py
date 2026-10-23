"""API tests for the web front end (FastAPI TestClient; no network)."""
import pytest
from fastapi.testclient import TestClient

from telco_agentic.scenarios import SCENARIOS
from webapp.app import app

H1 = {"X-Demo-Session": "test-session-aaaa"}
H2 = {"X-Demo-Session": "test-session-bbbb"}


@pytest.fixture()
def client():
    c = TestClient(app)
    c.post("/api/reset", headers=H1)
    c.post("/api/reset", headers=H2)
    return c


def _idx(fragment):
    return next(i for i, (t, _) in enumerate(SCENARIOS) if fragment.lower() in t.lower())


def test_homepage_served_with_demo_label(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Demo – mock data only" in r.text


def test_healthz(client):
    assert client.get("/healthz").json()["ok"] is True


def test_meta_lists_scenarios_customers_agents(client):
    m = client.get("/api/meta").json()
    assert len(m["scenarios"]) == len(SCENARIOS) == 8
    assert {c["id"] for c in m["customers"]} >= {"CUST-1001", "CUST-1002", "CUST-2001"}
    assert len(m["agents"]) == 5


def test_session_header_required(client):
    assert client.post("/api/run", json={"scenario": 0}).status_code == 400
    assert client.post("/api/run", json={"scenario": 0}, headers={"X-Demo-Session": "bad id!"}).status_code == 400


@pytest.mark.parametrize("i", range(len(SCENARIOS)))
def test_every_scenario_runs(client, i):
    r = client.post("/api/run", json={"scenario": i}, headers=H1)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["events"] and j["finalStatus"]
    assert j["events"][0]["seq"] == 1


def test_tool_events_carry_request_and_response(client):
    j = client.post("/api/run", json={"scenario": 0}, headers=H1).json()
    tools = [e for e in j["events"] if e["kind"] == "tool"]
    assert tools
    assert all("request" in e["data"] and "response" in e["data"] and e["data"]["tmf"].startswith("TMF")
               for e in tools)


def test_free_text_request(client):
    r = client.post("/api/run", headers=H1, json={"customer_id": "CUST-1001", "text": "My broadband is down",
                                                  "channel": "chat"})
    assert r.status_code == 200
    assert "network_fault" in r.json()["intents"]


def test_free_text_validation(client):
    assert client.post("/api/run", headers=H1, json={"customer_id": "CUST-1001"}).status_code == 422
    assert client.post("/api/run", headers=H1, json={"customer_id": "CUST-1001", "text": "x",
                                                     "channel": "pigeon"}).status_code == 422
    assert client.post("/api/run", headers=H1, json={"scenario": 99}).status_code == 422


def test_live_supervisor_approval_applies_credit(client):
    j = client.post("/api/run", json={"scenario": _idx("above agent authority")}, headers=H1).json()
    task = next(t for t in j["tasks"] if t["queue"] == "billing-supervisors" and t["status"] == "open")
    r = client.post(f"/api/queue/{task['id']}/decision", json={"approve": True}, headers=H1)
    assert r.status_code == 200
    out = r.json()
    assert out["task"]["status"] == "approved"
    adj = [e for e in out["events"] if e["kind"] == "tool" and e["data"]["tool"] == "bill.adjust"]
    assert adj and adj[0]["data"]["write"] is True
    # deciding twice is a conflict
    assert client.post(f"/api/queue/{task['id']}/decision", json={"approve": False}, headers=H1).status_code == 409


def test_reject_records_without_write(client):
    j = client.post("/api/run", json={"scenario": _idx("sim")}, headers=H1).json()
    task = next(t for t in j["tasks"] if t["queue"] == "fraud-ops")
    out = client.post(f"/api/queue/{task['id']}/decision", json={"approve": True}, headers=H1).json()
    assert out["task"]["status"] == "approved"
    assert not [e for e in out["events"] if e["kind"] == "tool"]


def test_unknown_task_404(client):
    assert client.post("/api/queue/HT-9999/decision", json={"approve": True}, headers=H1).status_code == 404


def test_sessions_are_isolated_and_resettable(client):
    client.post("/api/run", json={"scenario": _idx("above agent authority")}, headers=H1)
    assert client.get("/api/queue", headers=H1).json()["stats"]["openTasks"] >= 1
    assert client.get("/api/queue", headers=H2).json()["tasks"] == []
    client.post("/api/reset", headers=H1)
    q = client.get("/api/queue", headers=H1).json()
    assert q["tasks"] == [] and q["stats"]["runs"] == 0
