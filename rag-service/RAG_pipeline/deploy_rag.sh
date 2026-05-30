#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy_rag.sh — Run this once on a fresh VPC / EC2 instance
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "════════════════════════════════════════════"
echo "  RAG Service Deployment"
echo "════════════════════════════════════════════"

# ── 1. Install Python dependencies ──────────────────────────────────────────
echo ""
echo "── [1/5] Installing Python packages ─────────"
pip install -r requirements.txt

# ── 2. Create .env from example if it doesn't exist ─────────────────────────
echo ""
echo "── [2/5] Checking .env ───────────────────────"
if [ ! -f .env ]; then
    echo "  .env not found — copying from .env.example"
    cp .env.example .env
    echo "  ⚠️  Edit .env and add your GEMINI_API_KEY before continuing"
    echo "  Exiting now. Run this script again after updating .env"
    exit 1
fi

# ── 3. Verify GEMINI_API_KEY is set ─────────────────────────────────────────
echo ""
echo "── [3/5] Verifying environment variables ─────"
source .env
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your-gemini-api-key-here" ]; then
    echo "  ✗ GEMINI_API_KEY is not set in .env"
    echo "  Get your key at: https://aistudio.google.com/app/apikey"
    exit 1
fi
echo "  ✓ GEMINI_API_KEY is set"

# ── 4. Build the vector DB ───────────────────────────────────────────────────
echo ""
echo "── [4/5] Building ChromaDB vector index ───────"
echo "  Running: python chunk.py"
python chunk.py

echo "  Running: python embed_and_store.py"
python embed_and_store.py

# ── 5. Start the FastAPI server ──────────────────────────────────────────────
echo ""
echo "── [5/5] Starting FastAPI server ──────────────"
echo ""
echo "════════════════════════════════════════════"
echo "  Server running on http://0.0.0.0:8000"
echo "  API docs: http://<EC2-IP>:8000/docs"
echo ""
echo "  To keep running after logout:"
echo "  pm2 start 'uvicorn rag_api:app --host 0.0.0.0 --port 8000' --name rag-service"
echo "  pm2 save && pm2 startup"
echo ""
echo "  To refresh the vector DB later:"
echo "  python chunk.py && python embed_and_store.py"
echo "  (then: pm2 restart rag-service)"
echo "════════════════════════════════════════════"
echo ""

uvicorn rag_api:app --host 0.0.0.0 --port 8000