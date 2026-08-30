[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\AmazonAgent',
    [string]$TaskName = 'AmazonAgent-Codex-TaskRunner'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runner = Join-Path $RepoRoot '.codex-runner\run-task.ps1'
if (-not (Test-Path -LiteralPath $runner)) { throw 'Codex task runner is missing.' }

# Task Scheduler permits this standard user to create interval tasks but denies
# ONLOGON triggers. A current-user Run entry starts the same one-shot runner at
# logon; the runner mutex prevents overlap with the one-minute scheduled task.
$action = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`" -RepoRoot `"$RepoRoot`""

& schtasks.exe /Create /TN $TaskName /TR $action /SC MINUTE /MO 1 /RU $env:USERNAME /IT /RL LIMITED /F
if ($LASTEXITCODE -ne 0) { throw 'SCHTASKS_MINUTE_CREATE_FAILED' }

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $runKey -Force | Out-Null
Set-ItemProperty -Path $runKey -Name 'AmazonAgent-Codex-TaskRunner-AtLogon' -Value $action -Type String

Write-Output "WINDOWS_TASK_REGISTERED=$TaskName"
Write-Output 'WINDOWS_TASK_LOGON_HELPER=HKCU_Run'
