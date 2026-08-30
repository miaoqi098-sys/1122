[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ProjectRoot,
    [string]$PythonExe = "python",
    [string]$ProjectId = "amazon-agent",
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$RuntimeSource = (Resolve-Path (Join-Path $PSScriptRoot "..\03_本地网关\runtime")).Path
$InstallRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"
$Venv = Join-Path $InstallRoot ".venv"
$ConfigPath = Join-Path $InstallRoot "config.json"
$TaskName = "AmazonAgent-GPT-Codex-Gateway"

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
& $PythonExe -m venv $Venv
$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip
& $VenvPython -m pip install --disable-pip-version-check -e $RuntimeSource

$ResolvedProjectRoot = (Resolve-Path $ProjectRoot).Path
$Config = @{
    host = "127.0.0.1"
    port = $Port
    data_dir = $InstallRoot
    codex_command = @("codex", "app-server")
    approval_policy = "never"
    sandbox = "danger-full-access"
    turn_timeout_seconds = 3600
    projects = @(@{ id = $ProjectId; root = $ResolvedProjectRoot })
}
$Config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

$Action = New-ScheduledTaskAction -Execute $VenvPython -Argument "-m gpt_codex_gateway --config `"$ConfigPath`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Persistent Amazon Agent GPT-Codex Gateway" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Output "GATEWAY_INSTALL=PASS"
Write-Output "GATEWAY_TASK=$TaskName"
Write-Output "GATEWAY_CONFIG=$ConfigPath"
Write-Output "GATEWAY_HEALTH=http://127.0.0.1:$Port/health"
Write-Output "GATEWAY_MCP=http://127.0.0.1:$Port/mcp/"
