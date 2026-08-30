param(
  [string]$RepoRoot = "C:\AmazonAgent",
  [string]$TaskName = "AmazonAgent-Controlled-Codex-Bridge"
)

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 can misread UTF-8 Chinese path literals. Resolve worker.py
# relative to this script instead of hard-coding the Chinese repository path.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkerSource = Join-Path $ScriptDir "worker.py"
$GatewayRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"
$WorkerTarget = Join-Path $GatewayRoot "controlled_bridge_worker.py"
$Python = Join-Path $GatewayRoot ".venv\Scripts\python.exe"
$GatewayHealth = "http://127.0.0.1:8765/health"
$TokenName = "AMAZON_AGENT_BRIDGE_GITHUB_TOKEN"

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

$Token = [Environment]::GetEnvironmentVariable($TokenName, "User")
if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host "GitHub bridge authorization is required once." -ForegroundColor Yellow
  Write-Host "Use a fine-grained GitHub token limited to repository miaoqi098-sys/- with Contents: Read and write." -ForegroundColor Yellow
  Write-Host "The token will not be printed." -ForegroundColor Yellow
  $SecureToken = Read-Host "Paste GitHub bridge token" -AsSecureString
  $Token = (New-Object System.Net.NetworkCredential("", $SecureToken)).Password
  if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "No token was provided."
  }
  [Environment]::SetEnvironmentVariable($TokenName, $Token, "User")
}

# Validate that the credential can access the dedicated dispatch branch before
# installing the long-running worker. Never print the credential or response headers.
$Headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
try {
  $Probe = Invoke-RestMethod -Uri "https://api.github.com/repos/miaoqi098-sys/-/contents/10_%E5%AF%B9%E5%A4%96%E9%93%BE%E6%8E%A5/01_GPT%E9%93%BE%E6%8E%A5Codex/09_GitHub%E4%BB%BB%E5%8A%A1%E6%A1%A5/inbox/current.json?ref=codex-dispatch" -Headers $Headers -Method Get -TimeoutSec 20
  if (-not $Probe.sha) {
    throw "Dispatch inbox probe did not return a file SHA."
  }
} catch {
  throw "GitHub bridge token validation failed. Confirm repository access and Contents read/write permission."
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

$Token = $null
$SecureToken = $null
$Headers = $null
