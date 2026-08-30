param(
  [string]$RepoRoot = "C:\AmazonAgent",
  [string]$TaskName = "AmazonAgent-Controlled-Codex-Bridge"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkerSource = Join-Path $ScriptDir "worker.py"
$GatewayRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"
$WorkerTarget = Join-Path $GatewayRoot "controlled_bridge_worker.py"
$Python = Join-Path $GatewayRoot ".venv\Scripts\python.exe"
$GatewayHealth = "http://127.0.0.1:8765/health"

if (-not (Test-Path -LiteralPath $WorkerSource)) {
  $FoundWorker = Get-ChildItem -LiteralPath $RepoRoot -Filter "worker.py" -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*01_GPT*Codex*" } |
    Select-Object -First 1
  if ($FoundWorker) {
    $WorkerSource = $FoundWorker.FullName
  }
}

if (-not (Test-Path -LiteralPath $WorkerSource)) {
  throw "Worker not found under repository root. Run git pull in C:\AmazonAgent and retry."
}
if (-not (Test-Path -LiteralPath $Python)) {
  throw "Gateway Python not found. Install the GPT-Codex Gateway first."
}

try {
  $Health = Invoke-RestMethod -Uri $GatewayHealth -Method Get -TimeoutSec 10
  if ($Health.gateway -ne "ONLINE") {
    throw "Gateway is not ONLINE"
  }
} catch {
  throw "GPT-Codex Gateway health check failed at $GatewayHealth. Start the Gateway first."
}

$Gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $Gh) {
  throw "GitHub CLI (gh) is not installed. Install GitHub CLI, then run 'gh auth login' once and retry this installer."
}

& $Gh.Source auth status 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is installed but not signed in. Run 'gh auth login' once on this PC, then retry this installer."
}

# Verify access to the dedicated dispatch inbox through the existing local gh login.
& $Gh.Source api "repos/miaoqi098-sys/-/contents/10_对外链接/01_GPT链接Codex/09_GitHub任务桥/inbox/current.json" -f "ref=codex-dispatch" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI login cannot access the codex-dispatch inbox. Re-authenticate gh for the GitHub account that owns miaoqi098-sys/-."
}

New-Item -ItemType Directory -Path $GatewayRoot -Force | Out-Null
Copy-Item -LiteralPath $WorkerSource -Destination $WorkerTarget -Force

$Action = New-ScheduledTaskAction -Execute $Python -Argument ('"{0}"' -f $WorkerTarget)
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "BRIDGE_INSTALL=PASS" -ForegroundColor Green
Write-Host "TaskName=$TaskName"
Write-Host "LastTaskResult=$($Info.LastTaskResult)"
Write-Host "Worker=$WorkerTarget"
Write-Host "Gateway=ONLINE"
Write-Host "GitHubAuth=GH_LOCAL_SESSION"
