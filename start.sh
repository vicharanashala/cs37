#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh  –  One-shot setup & launch for CrowdSource FAQ Monorepo
#
# Safe to run after a fresh `git clone`. Idempotent: re-running skips steps
# that are already done (venv exists, node_modules exists, .env already set).
#
# Usage:
#   chmod +x start.sh   # first time only
#   ./start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAG_DIR="$SCRIPT_DIR/rag-service/RAG_pipeline"
WEB_DIR="$SCRIPT_DIR/faq-web"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; RESET="\033[0m"
info()  { echo -e "${GREEN}$*${RESET}"; }
warn()  { echo -e "${YELLOW}$*${RESET}"; }
error() { echo -e "${RED}$*${RESET}" >&2; }

# ── Preflight: required tools ─────────────────────────────────────────────────
info "\n🔍  Checking required tools…"
for cmd in python3 node npm; do
    if ! command -v "$cmd" &>/dev/null; then
        error "❌  '$cmd' is not installed. Please install it and re-run."
        exit 1
    fi
done
info "   ✅  python3, node, npm found."

# ── 1. RAG service – Python env setup ────────────────────────────────────────
info "\n🐍  Setting up RAG service…"
cd "$RAG_DIR"

if [ ! -d "venv" ]; then
    info "   📦  Creating Python virtual environment…"
    python3 -m venv venv
fi

info "   📦  Installing/updating Python dependencies…"
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet -r requirements.txt
info "   ✅  Python dependencies ready."

# ── 2. RAG service – .env setup ──────────────────────────────────────────────
if [ ! -f "$RAG_DIR/.env" ]; then
    warn "\n⚠️   No .env found in rag-service/RAG_pipeline/."
    warn "    Copying from .env.example — please fill in your GEMINI_API_KEY."
    cp "$RAG_DIR/.env.example" "$RAG_DIR/.env"
fi

# ── 3. Next.js – npm install ──────────────────────────────────────────────────
info "\n🌐  Setting up Next.js web app…"
cd "$WEB_DIR"

if [ ! -d "node_modules" ]; then
    info "   📦  Running npm install…"
    npm install --silent
    info "   ✅  Node modules installed."
else
    info "   ✅  node_modules already present, skipping install."
fi

# ── 4. Next.js – .env.local setup ────────────────────────────────────────────
if [ ! -f "$WEB_DIR/.env.local" ]; then
    if [ -f "$WEB_DIR/.env" ]; then
        warn "\n⚠️   No .env.local found — copying from .env (your local credentials)."
        cp "$WEB_DIR/.env" "$WEB_DIR/.env.local"
    else
        warn "\n⚠️   No .env.local found in faq-web/."
        warn "    Copying from .env.example — please fill in MONGODB_URI and GEMINI_API_KEY."
        cp "$WEB_DIR/.env.example" "$WEB_DIR/.env.local"
    fi
fi

# ── 5. Start RAG API in background ───────────────────────────────────────────
info "\n🚀  Starting both servers…"
(
    cd "$RAG_DIR"
    source venv/bin/activate
    uvicorn rag_api:app --host 0.0.0.0 --port 8000 &
    RAG_PID=$!
    info "   🐍  RAG API started on http://localhost:8000 (PID: $RAG_PID)"
    wait $RAG_PID
) &

# Give RAG a moment to bind its port before Next.js starts
sleep 3

# ── 6. Start Next.js dev server (foreground – keeps terminal alive) ───────────
info "   🌐  Starting FAQ Web on http://localhost:3000…"
cd "$WEB_DIR" && npm run dev