@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM start.bat  –  One-shot setup & launch for CrowdSource FAQ Monorepo (Windows)
REM
REM Safe to run after a fresh `git clone`. Idempotent: re-running skips steps
REM that are already done (venv exists, node_modules exists, .env already set).
REM
REM Usage:
REM   start.bat
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set RAG_DIR=%SCRIPT_DIR%rag-service\RAG_pipeline
set WEB_DIR=%SCRIPT_DIR%faq-web

REM ── Colour helpers ────────────────────────────────────────────────────────────
REM Windows doesn't support ANSI colors in default CMD, so we'll use simple markers

echo.
echo 🔍  Checking required tools…
for %%X in (python3, node, npm) do (
    where %%X >nul 2>nul
    if errorlevel 1 (
        echo ❌  '%%X' is not installed. Please install it and re-run.
        exit /b 1
    )
)
echo ✅  python3, node, npm found.

REM ── 1. RAG service – Python env setup ────────────────────────────────────────
echo.
echo 🐍  Setting up RAG service…
cd /d "%RAG_DIR%"

if not exist "venv" (
    echo    📦  Creating Python virtual environment…
    python -m venv venv
)

echo    📦  Installing/updating Python dependencies…
call venv\Scripts\pip install --quiet --upgrade pip
call venv\Scripts\pip install --quiet -r requirements.txt
echo    ✅  Python dependencies ready.

REM ── 2. RAG service – .env setup ──────────────────────────────────────────────
if not exist "%RAG_DIR%\.env" (
    echo.
    echo ⚠️   No .env found in rag-service\RAG_pipeline\.
    echo    Copying from .env.example — please fill in your GEMINI_API_KEY.
    copy "%RAG_DIR%\.env.example" "%RAG_DIR%\.env"
)

REM ── 3. Next.js – npm install ──────────────────────────────────────────────────
echo.
echo 🌐  Setting up Next.js web app…
cd /d "%WEB_DIR%"

if not exist "node_modules" (
    echo    📦  Running npm install…
    call npm install --silent
    echo    ✅  Node modules installed.
) else (
    echo    ✅  node_modules already present, skipping install.
)

REM ── 4. Next.js – .env.local setup ────────────────────────────────────────────
if not exist "%WEB_DIR%\.env.local" (
    echo.
    echo ⚠️   No .env.local found in faq-web\.
    echo    Copying from .env.example — please fill in MONGODB_URI and GEMINI_API_KEY.
    copy "%WEB_DIR%\.env.example" "%WEB_DIR%\.env.local"
)

REM ── 5. Start RAG API in background ───────────────────────────────────────────
echo.
echo 🚀  Starting both servers…
cd /d "%RAG_DIR%"
call venv\Scripts\activate
echo    🐍  Starting RAG API on http://localhost:8000…
start "RAG API Server" cmd /k uvicorn rag_api:app --host 0.0.0.0 --port 8000

REM Give RAG a moment to bind its port before Next.js starts
timeout /t 3 /nobreak

REM ── 6. Start Next.js dev server (foreground) ─────────────────────────────────
echo    🌐  Starting FAQ Web on http://localhost:3000…
cd /d "%WEB_DIR%"
call npm run dev

endlocal
