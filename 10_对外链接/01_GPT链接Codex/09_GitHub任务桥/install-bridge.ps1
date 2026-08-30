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
  throw "Gateway Python not found: $Python. Install the GPT-Codex Gateway first."
}

$Token = [Environment]::GetEnvironmentVariable("AMAZON_AGENT_BRIDGE_GITHUB_TOKEN", "User")
if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "Missing user environment variable AMAZON_AGENT_BRIDGE_GITHUB_TOKEN. Configure a fine-grained GitHub token limited to repository miaoqi098-sys/- with Contents read/write. Do not paste it into chat or commit it."
}

New-Item -ItemType Directory -Path $GatewayRoot -Force | Out-Null
Copy-Item -LiteralPath $WorkerSource -Destination $WorkerTarget -Force

$Action = New-ScheduledTaskAction -Execute $Python -Argument ('"{0}"' -f $WorkerTarget)
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "BRIDGE_INSTALL=PASS"
Write-Host "TaskName=$TaskName"
Write-Host "LastTaskResult=$($Info.LastTaskResult)"
Write-Host "Worker=$WorkerTarget"
