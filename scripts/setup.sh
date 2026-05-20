#!/usr/bin/env bash
# Phantom — one-shot setup. Creates .env from the template, builds the Docker
# images, installs Remotion deps so the worker can use the React render path
# instead of the ffmpeg fallback, and brings the stack up.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — add your API keys before generating videos."
fi

echo "Building Docker images…"
docker compose build

echo "Installing Remotion deps (optional — falls back to ffmpeg if skipped)…"
if command -v npm >/dev/null 2>&1; then
  (cd frontend/remotion && npm install --no-audit --no-fund)
else
  echo "npm not found on host; skipping. The worker will use the ffmpeg fallback path."
fi

echo "Starting the stack…"
docker compose up -d

echo ""
echo "Phantom is up:"
echo "  Frontend  → http://localhost:3000"
echo "  API       → http://localhost:8000"
echo "  Health    → http://localhost:8000/healthz"
