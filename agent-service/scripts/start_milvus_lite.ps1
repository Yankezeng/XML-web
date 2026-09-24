$ErrorActionPreference = "Stop"

$milvus = "D:\xml-agent-venv\Scripts\milvus-lite.exe"
$projectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataDir = Join-Path $projectDir "milvus-data"
$hostName = "127.0.0.1"
$port = 19531

if (-not (Test-Path -LiteralPath $milvus)) {
    throw "milvus-lite.exe not found: $milvus"
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$listening = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if ($listening) {
    Write-Output "Milvus Lite is already listening on ${hostName}:${port}."
    exit 0
}

Start-Process -FilePath $milvus `
    -ArgumentList "server", "--data-dir", $dataDir, "--host", $hostName, "--port", $port `
    -WorkingDirectory (Split-Path -Parent $milvus)
Write-Output "Started Milvus Lite on ${hostName}:${port}. Data: $dataDir"
