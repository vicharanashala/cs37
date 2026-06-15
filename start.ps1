# start.ps1 — Launch both dev servers on Windows
$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$ragDir    = Join-Path $root "rag-service\RAG_pipeline"
$webDir    = Join-Path $root "faq-web"
$python    = Join-Path $ragDir "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "Missing venv. Run: cd rag-service/RAG_pipeline && python -m venv venv && venv/Scripts/pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "Missing node_modules. Run: cd faq-web && npm install" -ForegroundColor Red
    exit 1
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$ragDir`" && `"$python`" -m uvicorn rag_api:app --host 0.0.0.0 --port 8000" -WindowStyle Normal -WorkingDirectory $ragDir
Start-Sleep -Seconds 4
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$webDir`" && npm run dev" -WindowStyle Normal -WorkingDirectory $webDir

Write-Host "RAG API  → http://localhost:8000" -ForegroundColor Cyan
Write-Host "FAQ Web  → http://localhost:3000" -ForegroundColor Cyan
