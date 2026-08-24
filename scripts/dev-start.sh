#!/usr/bin/env bash
# Start the legacy app services in parallel.
# Each service owns its configured port and fails clearly if it is occupied.
set -e

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  kill "$API_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$API_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting API server..."
PORT=8080 pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting Orblitz dev server..."
pnpm --filter @workspace/orblitz run dev &
FRONTEND_PID=$!

# Exit as soon as either service exits, allowing cleanup() to stop its sibling.
wait -n "$API_PID" "$FRONTEND_PID"
exit $?
