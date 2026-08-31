[CmdletBinding()]
param([switch]$KeepLocalData)

$ErrorActionPreference = "Stop"
$TaskName = "AmazonAgent-GPT-Codex-Gateway"
$InstallRoot = Join-Path $env:LOCALAPPDATA "AmazonAgent\GPTCodexGateway"

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
if (-not $KeepLocalData -and (Test-Path -LiteralPath $InstallRoot)) {
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
}
Write-Output "GATEWAY_UNINSTALL=PASS"
