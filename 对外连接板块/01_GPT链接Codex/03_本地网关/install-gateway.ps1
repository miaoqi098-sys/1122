[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ProjectRoot,
    [string]$PythonExe = "python",
    [string]$ProjectId = "amazon-agent",
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"

$RuntimeSource = Join-Path $PSScriptRoot "runtime"
if (-not (Test-Path -LiteralPath (Join-Path $RuntimeSource "pyproject.toml"))) {
    throw "Gateway runtime not found under 03_本地网关/runtime."
}

$RuntimeSource = (Resolve-Path -LiteralPath $RuntimeSource).Path
$ResolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

Get-Command $PythonExe -ErrorAction Stop | Out-Null
& $PythonExe --version
if ($LASTEXITCODE -ne 0) { throw "Python check failed. Python 3.12 or newer is required." }

Get-Command codex -ErrorAction Stop | Out-Null
& codex --version
if ($LASTEXITCODE -ne 0) { throw "Codex CLI check failed." }

$InstallRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"
$Venv = Join-Path $InstallRoot ".venv"
$ConfigPath = Join-Path $InstallRoot "config.json"
$TaskName = "AmazonAgent-GPT-Codex-Gateway"

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
if (Test-Path -LiteralPath $Venv) { Remove-Item -LiteralPath $Venv -Recurse -Force }

& $PythonExe -m venv $Venv
if ($LASTEXITCODE -ne 0) { throw "Failed to create the Gateway virtual environment." }

$VenvPython = Join-Path $Venv "Scripts\python.exe"
& $VenvPython -m pip install --disable-pip-version-check --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Failed to upgrade pip." }

& $VenvPython -m pip install --disable-pip-version-check -e $RuntimeSource
if ($LASTEXITCODE -ne 0) { throw "Failed to install the Gateway runtime." }

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
