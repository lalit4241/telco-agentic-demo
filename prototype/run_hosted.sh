#!/usr/bin/env bash
# (Re)start the demo web server and a Cloudflare quick tunnel, both detached with auto-restart loops,
# then print the public URL.
# Usage: ./run_hosted.sh | ./run_hosted.sh stop | LOCAL_ONLY=1 ./run_hosted.sh | PORT=9000 ./run_hosted.sh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
PORT="${PORT:-8765}"
RUN="$ROOT/.run"
mkdir -p "$RUN"
PY="$ROOT/.venv/bin/python"
CF="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"

stop() {
  for n in server tunnel; do
    if [ -f "$RUN/$n.pid" ]; then
      pid="$(cat "$RUN/$n.pid")"
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
      rm -f "$RUN/$n.pid"
    fi
  done
  pkill -f "uvicorn webapp.app:app --host 127.0.0.1 --port $PORT" 2>/dev/null || true
  pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:$PORT" 2>/dev/null || true
  sleep 1
}

stop
[ "${1:-}" = "stop" ] && { echo "Stopped."; exit 0; }

if [ ! -x "$PY" ]; then
  python3 -m venv .venv && .venv/bin/pip install -q -r requirements-dev.txt
fi
if [ ! -x "$CF" ]; then
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/cloudflared" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$HOME/.local/bin/cloudflared"; CF="$HOME/.local/bin/cloudflared"
fi

# Web server: restart loop, own process group, survives the calling shell.
: > "$RUN/server.log"
setsid nohup bash -c "while true; do \"$PY\" -m uvicorn webapp.app:app --host 127.0.0.1 --port $PORT --workers 1 --log-level warning; echo \"[\$(date -u +%FT%TZ)] server exited (\$?), restarting\"; sleep 2; done" \
  >> "$RUN/server.log" 2>&1 < /dev/null &
echo $! > "$RUN/server.pid"

for _ in $(seq 1 30); do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null && break; sleep 0.5; done
curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null || { echo "Server failed to start; see $RUN/server.log"; exit 1; }

if [ "${LOCAL_ONLY:-0}" = "1" ]; then echo "Local only: http://127.0.0.1:$PORT"; exit 0; fi

# Quick tunnel: restart loop. NB a restart of cloudflared issues a NEW random URL.
: > "$RUN/tunnel.log"
setsid nohup bash -c "while true; do \"$CF\" tunnel --no-autoupdate --url http://127.0.0.1:$PORT; echo \"[\$(date -u +%FT%TZ)] tunnel exited (\$?), restarting\"; sleep 3; done" \
  >> "$RUN/tunnel.log" 2>&1 < /dev/null &
echo $! > "$RUN/tunnel.pid"

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUN/tunnel.log" | tail -1 || true)"
  [ -n "$URL" ] && break; sleep 1
done
[ -n "$URL" ] || { echo "Tunnel URL not found yet; see $RUN/tunnel.log"; exit 1; }
# A URL is issued before the edge connection exists; wait for a registered connection.
for _ in $(seq 1 45); do grep -q "Registered tunnel connection" "$RUN/tunnel.log" && break; sleep 1; done
if ! grep -q "Registered tunnel connection" "$RUN/tunnel.log"; then
  echo "Tunnel could NOT connect to Cloudflare's edge (outbound port 7844 TCP/UDP is probably blocked)."
  grep -E "ERROR: Allow outbound|Failed to dial" "$RUN/tunnel.log" | sort -u | head -4
  echo "Stopping the tunnel loop. The server is still running locally on http://127.0.0.1:$PORT"
  kill -- -"$(cat "$RUN/tunnel.pid")" 2>/dev/null || true; rm -f "$RUN/tunnel.pid"
  pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:$PORT" 2>/dev/null || true
  exit 2
fi
echo "$URL" > "$RUN/url.txt"
echo "Local:  http://127.0.0.1:$PORT"
echo "Public: $URL"
