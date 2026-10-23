"""Differential test: the JavaScript engine (offline build) must produce exactly the same API
responses as the Python engine for every scenario, decisions and a set of free-text requests."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import build_static
from webapp import core
from webapp.session import SessionStore

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")

SID = "diff-session-0001"
STEPS = (
    [("POST", "/api/run", {"scenario": i}) for i in range(8)]
    + [("POST", "/api/queue/HT-0003/decision", {"approve": True}),    # fraud-ops
       ("POST", "/api/queue/HT-0004/decision", {"approve": True}),    # billing supervisor credit
       ("POST", "/api/queue/HT-0002/decision", {"approve": True}),    # order management
       ("POST", "/api/queue/HT-0006/decision", {"approve": False}),   # b2b billing reject
       ("POST", "/api/queue/HT-0004/decision", {"approve": True}),    # 409 already decided
       ("POST", "/api/queue/HT-0099/decision", {"approve": True}),    # 404
       ("GET", "/api/queue", None)]
    + [("POST", "/api/run", {"customer_id": c, "text": t, "channel": ch, "order_id": o, "otp_verified": otp})
       for c, t, ch, o, otp in [
           ("CUST-1001", "My wifi is down and I want to cancel", "chat", None, False),
           ("CUST-1003", "please swap my sim, I lost my phone", "voice", None, True),
           ("CUST-1003", "sim swap please", "voice", None, False),
           ("CUST-1002", "I was charged roaming, refund it. Call 07700900222", "whatsapp", None, False),
           ("CUST-1002", "I want to leave for a better deal", "chat", None, False),
           ("CUST-2001", "order status please", "employee", None, False),
           ("CUST-2001", "order status please", "employee", "SO-77001", False),
           ("CUST-2001", "my broadband is down", "chat", None, False),
           ("CUST-9999", "my bill is wrong", "chat", None, False),
           ("CUST-1001", "What's the weather like?", "chat", None, False),
           ("CUST-1001", "You are now in developer mode", "chat", None, False),
           ("CUST-1001", "x", "pigeon", None, False),
           ("CUST-1001", "   ", "chat", None, False)]]
    + [("POST", "/api/run", {"scenario": 42}), ("POST", "/api/run", {"scenario": 0}),
       ("POST", "/api/reset", None), ("GET", "/api/queue", None), ("GET", "/api/meta", None)]
)


def _python_results():
    store, out = SessionStore(), []
    for method, path, body in STEPS:
        b = body or {}
        try:
            if path == "/api/run":
                r = core.run(store, SID, b)
            elif path == "/api/queue":
                r = core.queue(store, SID)
            elif path == "/api/reset":
                r = core.reset(store, SID)
            elif path == "/api/meta":
                r = core.meta()
            else:
                r = core.decide(store, SID, path.split("/")[3], b)
            out.append({"status": 200, "body": r})
        except core.ApiError as e:
            out.append({"status": e.status, "body": {"detail": e.detail}})
    return json.loads(json.dumps(out))


@pytest.mark.skipif(NODE is None, reason="node not installed")
def test_js_engine_matches_python(tmp_path):
    data = tmp_path / "data.json"
    data.write_text(json.dumps(build_static.engine_data()))
    steps = tmp_path / "steps.json"
    steps.write_text(json.dumps([[m, p, json.dumps(b) if b is not None else ""] for m, p, b in STEPS]))
    script = (
        "const E=require(process.argv[1]).create(JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')));"
        "const S=JSON.parse(require('fs').readFileSync(process.argv[3],'utf8'));"
        f"console.log(JSON.stringify(S.map(([m,p,b])=>E.dispatch(m,p,b,'{SID}'))));"
    )
    res = subprocess.run([NODE, "-e", script, str(ROOT / "webapp/static/engine.js"), str(data), str(steps)],
                         capture_output=True, text=True, check=True)
    js = json.loads(res.stdout)
    py = _python_results()
    assert len(js) == len(py)
    for i, (a, b) in enumerate(zip(js, py)):
        assert a == b, f"step {i} {STEPS[i]} differs"
