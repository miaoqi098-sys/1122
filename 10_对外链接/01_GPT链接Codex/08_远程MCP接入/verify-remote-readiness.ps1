[CmdletBinding()]
param(
    [string]$GatewayBase = "http://127.0.0.1:8765"
)

$ErrorActionPreference = "Stop"

function Pass([string]$name, [string]$detail = "") {
    if ($detail) { Write-Host "[PASS] $name - $detail" -ForegroundColor Green }
    else { Write-Host "[PASS] $name" -ForegroundColor Green }
}
function Fail([string]$name, [string]$detail) {
    Write-Host "[FAIL] $name - $detail" -ForegroundColor Red
}

Write-Host "Amazon Agent GPT-Codex Remote MCP Readiness" -ForegroundColor Cyan
Write-Host "Gateway: $GatewayBase"

try {
    $health = Invoke-RestMethod "$GatewayBase/health" -TimeoutSec 10
    if ($health.gateway -eq "ONLINE") {
        Pass "Gateway" "ONLINE"
    } else {
        throw "gateway=$($health.gateway)"
    }
} catch {
    Fail "Gateway" $_.Exception.Message
    exit 2
}

if ($health.app_server_process -eq "RUNNING") {
    Pass "Codex App Server" "RUNNING"
} else {
    Write-Host "[INFO] Codex App Server is $($health.app_server_process); it may lazy-start on first task." -ForegroundColor Yellow
}

$payload = @'
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "remote-readiness-check",
      "version": "1.0"
    }
  }
}
'@

$tmp = Join-Path $env:TEMP "amazon_agent_mcp_initialize.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $payload, $utf8)

$response = & curl.exe -s "$GatewayBase/mcp/" `
    -H "Content-Type: application/json" `
    -H "Accept: application/json, text/event-stream" `
    --data-binary "@$tmp"

if ($LASTEXITCODE -ne 0) {
    Fail "MCP initialize" "curl exit code $LASTEXITCODE"
    exit 3
}

try {
    $obj = $response | ConvertFrom-Json
    if ($obj.result.serverInfo.name) {
        Pass "MCP initialize" $obj.result.serverInfo.name
    } else {
        throw "missing result.serverInfo"
    }
} catch {
    Fail "MCP initialize" "Invalid response: $response"
    exit 4
}

Write-Host ""
Write-Host "LOCAL_REMOTE_READINESS=PASS" -ForegroundColor Green
Write-Host "NEXT_PLATFORM_GATE=ChatGPT Full MCP + remote tunnel/app connection"
Write-Host "NOTE=Do not expose 127.0.0.1:8765 directly to the public Internet."
