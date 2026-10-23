"""FastAPI web front end for the telco agentic prototype. Mock data only; no external calls or API keys."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, Header, Request
from fastapi.responses import FileResponse, JSONResponse

from . import core
from .session import SessionStore

STATIC = Path(__file__).parent / "static"

app = FastAPI(title="Agentic Working Model for Telecoms - demo", docs_url="/api/docs", redoc_url=None)
store = SessionStore()


@app.exception_handler(core.ApiError)
def _api_error(_: Request, exc: core.ApiError) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "sessions": len(store)}


@app.get("/api/meta")
def meta() -> dict[str, Any]:
    return core.meta()


@app.post("/api/run")
def run(body: dict[str, Any] = Body(...), x_demo_session: str | None = Header(default=None)) -> dict[str, Any]:
    return core.run(store, x_demo_session, body)


@app.get("/api/queue")
def queue(x_demo_session: str | None = Header(default=None)) -> dict[str, Any]:
    return core.queue(store, x_demo_session)


@app.post("/api/queue/{task_id}/decision")
def decide(task_id: str, body: dict[str, Any] = Body(...),
           x_demo_session: str | None = Header(default=None)) -> dict[str, Any]:
    return core.decide(store, x_demo_session, task_id, body)


@app.post("/api/reset")
def reset(x_demo_session: str | None = Header(default=None)) -> dict[str, Any]:
    return core.reset(store, x_demo_session)
