# ─────────────────────────────────────────────────────────────────────────────
# start.ps1  –  One-shot setup & launch for CrowdSource FAQ Monorepo (Windows)
#
# Safe to run after a fresh `git clone`. Idempotent: re-running skips steps
# that are already done (venv exists, node_modules exists, .env already set).
#
# Usage:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser  # first time only
#   .\start.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RAG_DIR = Join-Path $SCRIPT_DIR "rag-service\RAG_pipeline"
$WEB_DIR = Join-Path $SCRIPT_DIR "faq-web"

function Write-Info { Write-Host $args[0] -ForegroundColor Green }
function Write-Warn { Write-Host $args[0] -ForegroundColor Yellow }
function Write-ErrorMsg { Write-Host $args[0] -ForegroundColor Red }

Write-Info "`nChecking required tools..."
$tools = @("python", "node", "npm")
foreach ($cmd in $tools) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-ErrorMsg "'$cmd' is not installed. Please install it and re-run."
        exit 1
    }
}
Write-Info "   python, node, npm found."

Write-Info "`nSetting up RAG service..."
Push-Location $RAG_DIR
if (-not (Test-Path "venv")) {
    Write-Info "   Creating Python virtual environment..."
    python -m venv venv
}
Write-Info "   Installing/updating Python dependencies..."
$venvPip = ".\venv\Scripts\pip.exe"
if (Test-Path $venvPip) {
    try {
        & $venvPip install --quiet --upgrade pip
        & $venvPip install --quiet -r requirements.txt
        Write-Info "   Python dependencies ready."
    } catch {
        Write-Warn "   Warning: Python dependency install failed. Continuing with execution."
    }
} else {
    Write-Warn "   Warning: venv pip executable not found at $venvPip. Skipping dependency install."
}
if (-not (Test-Path ".env")) {
    Write-Warn "`nNo .env found in rag-service\RAG_pipeline."
    if (Test-Path ".env.example") {
        Write-Warn "Copying from .env.example. Please fill in your GEMINI_API_KEY."
        Copy-Item ".env.example" ".env"
    } else {
        Write-Warn "No .env.example found. Skipping copy. Create rag-service\RAG_pipeline\.env manually with GEMINI_API_KEY if needed."
    }
}
Pop-Location

Write-Info "`nSetting up Next.js web app..."
Push-Location $WEB_DIR
if (-not (Test-Path "node_modules")) {
    Write-Info "   Running npm install..."
    npm install --silent
    Write-Info "   Node modules installed."
} else {
    Write-Info "   node_modules already present, skipping install."
}
if (-not (Test-Path ".env.local")) {
    Write-Warn "`nNo .env.local found in faq-web."
    if (Test-Path ".env.example") {
        Write-Warn "Copying from .env.example. Please fill in MONGODB_URI and GEMINI_API_KEY."
        Copy-Item ".env.example" ".env.local"
    } else {
        Write-Warn "No .env.example found. Skipping copy. Create faq-web\.env.local manually with MONGODB_URI and GEMINI_API_KEY if needed."
    }
}
Pop-Location

Write-Info "`nStarting both servers..."
$pythonExe = Join-Path $RAG_DIR "venv\Scripts\python.exe"
$ragJob = $null
if (Test-Path $pythonExe) {
    $ragJob = Start-Job -ScriptBlock {
        param($argRagDir, $argPythonExe)
        Set-Location $argRagDir
        & $argPythonExe -m uvicorn rag_api:app --host 0.0.0.0 --port 8000
    } -ArgumentList $RAG_DIR, $pythonExe
    Start-Sleep -Seconds 3
    Write-Info "   RAG service start requested."
} else {
    Write-Warn "   Warning: Python executable not found at $pythonExe. Skipping RAG service startup."
}
Write-Info "   Starting FAQ Web on http://localhost:3000..."
Push-Location $WEB_DIR
npm run dev
if ($ragJob -ne $null) {
    Stop-Job -Job $ragJob
    Remove-Job -Job $ragJob
}
Pop-Location
