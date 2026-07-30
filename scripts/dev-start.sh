#!/usr/bin/env bash
# Start all dev services in parallel.
# Kills any stale processes on the expected ports first so restarts are clean.
set -e

kill_port() {
  local port=$1
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Freeing port $port (pid $pid)"
    kill -9 "$pid" 2>/dev/null || true
  fi
}

kill_port 3000
kill_port 8080

echo "Starting API server..."
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting Orblitz dev server..."
pnpm --filter @workspace/orblitz run dev &
FRONTEND_PID=$!

# Forward signals so Ctrl-C / SIGTERM cleans up both children
trap "kill $API_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

wait
