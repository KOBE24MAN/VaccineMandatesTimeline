#!/bin/zsh
cd "$(dirname "$0")"

# ── Kill any stale processes from a previous session ──────────────────────────
echo "Clearing stale processes on ports 8000 and 5173..."
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# ── Backend: create venv and install deps if needed ───────────────────────────
if [[ ! -f ".venv/bin/uvicorn" ]]; then
  echo "Setting up Python virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
  echo "Backend dependencies installed."
fi

echo "Starting backend..."
.venv/bin/uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# ── Frontend: install npm deps if needed ──────────────────────────────────────
if [[ ! -d "frontend_client/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd frontend_client && npm install --silent)
  echo "Frontend dependencies installed."
fi

echo "Starting frontend..."
(cd frontend_client && npm run dev) &
FRONTEND_PID=$!

# ── Open prototype HTML ───────────────────────────────────────────────────────
echo "Opening prototype..."

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo "  Prototype: HomePage2.4_client.html (opened in browser)"
echo "  Backend:   http://localhost:8000"
echo "  Frontend:  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
