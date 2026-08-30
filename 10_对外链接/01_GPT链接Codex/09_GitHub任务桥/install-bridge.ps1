param(
  [string]$RepoRoot = "C:\AmazonAgent",
  [string]$TaskName = "AmazonAgent-Controlled-Codex-Bridge"
)

$ErrorActionPreference = "Stop"

$WorkerSource = Join-Path $RepoRoot "10_对外链接\01_GPT链接Codex\09_GitHub任务桥\worker.py"
$GatewayRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"
$WorkerTarget = Join-Path $GatewayRoot "controlled_bridge_worker.py"
$Python = Join-Path $GatewayRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $WorkerSource)) {
  throw "Worker not found: $WorkerSource. Pull the implementation branch/main first."
}
if (-not (Test-Path $Python)) {
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
