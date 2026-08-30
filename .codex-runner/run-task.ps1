[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\AmazonAgent',
    [ValidateRange(30, 300)]
    [int]$TaskTimeoutSeconds = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repository = 'miaoqi098-sys/-'
$Branch = 'codex-dispatch'
$InboxPath = '.codex-bridge/inbox/current.json'
$ResultDirectory = '.codex-bridge/results'
$StatePath = Join-Path $PSScriptRoot 'state.json'
$PromptPath = Join-Path $PSScriptRoot 'codex-task-prompt.md'
$TerminalStatuses = @('SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'AUTH_REQUIRED', 'BLOCKED', 'PASS')
$AllowedTaskTypes = @('local_readonly_test', 'website_online')
$ForbiddenKeys = @('command', 'shell', 'powershell', 'cmd', 'token', 'secret', 'password', 'credential', 'api_key', 'private_key')

function Write-RunnerEvent {
    param([Parameter(Mandatory)][string]$Event)
    Write-Output ("[{0}] {1}" -f [DateTime]::UtcNow.ToString('o'), $Event)
}

function ConvertTo-QuotedArgument {
    param([Parameter(Mandatory)][string]$Value)
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Invoke-CapturedProcess {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][int]$TimeoutSeconds,
        [string]$StandardInput = ''
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = (($Arguments | ForEach-Object { ConvertTo-QuotedArgument ([string]$_) }) -join ' ')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables['CI'] = 'true'
    $psi.EnvironmentVariables['NO_COLOR'] = '1'
    $psi.EnvironmentVariables['GH_PROMPT_DISABLED'] = '1'
    $psi.EnvironmentVariables['GIT_TERMINAL_PROMPT'] = '0'

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    if ($StandardInput) {
        $process.StandardInput.Write($StandardInput)
    }
    $process.StandardInput.Close()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()

    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        try { $process.Kill() } catch { }
        try { $process.WaitForExit() } catch { }
        return [pscustomobject]@{ TimedOut = $true; ExitCode = -1; Output = '' }
    }

    $output = $stdoutTask.GetAwaiter().GetResult() + "`n" + $stderrTask.GetAwaiter().GetResult()
    return [pscustomobject]@{ TimedOut = $false; ExitCode = $process.ExitCode; Output = $output }
}

function Invoke-GhApi {
    param(
        [Parameter(Mandatory)][string[]]$Arguments,
        [int]$TimeoutSeconds = 45
    )

    $gh = (Get-Command gh.exe -ErrorAction Stop).Source
    $result = Invoke-CapturedProcess -FilePath $gh -Arguments (@('api') + $Arguments) -TimeoutSeconds $TimeoutSeconds
    if ($result.TimedOut) { throw 'GITHUB_API_TIMEOUT' }
    return $result
}

function Test-NonInteractiveAuthentication {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string[]]$Arguments,
        [int]$TimeoutSeconds = 30
    )

    $result = Invoke-CapturedProcess -FilePath $Executable -Arguments $Arguments -TimeoutSeconds $TimeoutSeconds
    return (-not $result.TimedOut -and $result.ExitCode -eq 0)
}

function Get-RemoteJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    $endpoint = "repos/$Repository/contents/${RelativePath}?ref=$Branch"
    $response = Invoke-GhApi -Arguments @('--method', 'GET', $endpoint)
    if ($response.ExitCode -ne 0) {
        if ($response.Output -match '(?i)(404|not found)') { return $null }
        throw 'GITHUB_API_READ_FAILED'
    }
    try {
        $envelope = $response.Output | ConvertFrom-Json
        $base64 = ([string]$envelope.content) -replace '\s', ''
        $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
        return ($text | ConvertFrom-Json)
    }
    catch {
        throw 'GITHUB_TASK_JSON_INVALID'
    }
}

function Put-RemoteJson {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][object]$Value,
        [Parameter(Mandatory)][string]$Message
    )

    $json = $Value | ConvertTo-Json -Depth 8
    $content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json + "`n"))
    $endpoint = "repos/$Repository/contents/$RelativePath"
    $response = Invoke-GhApi -Arguments @('--method', 'PUT', $endpoint, '-f', "message=$Message", '-f', "content=$content", '-f', "branch=$Branch")
    if ($response.ExitCode -ne 0) { throw 'GITHUB_RESULT_WRITE_FAILED' }
}

function Test-TaskId {
    param([object]$TaskId)
    $value = [string]$TaskId
    return (-not [string]::IsNullOrWhiteSpace($value) -and $value -match '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')
}

function Get-TaskPropertyValue {
    param(
        [Parameter(Mandatory)][object]$Task,
        [Parameter(Mandatory)][string]$Name
    )

    $property = $Task.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Write-RunnerResult {
    param(
        [Parameter(Mandatory)][object]$Task,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$StartedAt,
        [Parameter(Mandatory)][string]$Summary,
        [object]$Blocker = $null
    )

    $taskId = Get-TaskPropertyValue -Task $Task -Name 'task_id'
    $taskType = Get-TaskPropertyValue -Task $Task -Name 'task_type'
    if (-not (Test-TaskId $taskId)) { return }
    $resultPath = "$ResultDirectory/$taskId.json"
    if ($null -ne (Get-RemoteJson $resultPath)) { return }
    $result = [ordered]@{
        task_id = [string]$taskId
        task_type = [string]$taskType
        status = $Status
        started_at = $StartedAt
        completed_at = [DateTime]::UtcNow.ToString('o')
        summary = $Summary
        changes = @()
        blocker = $Blocker
    }
    Put-RemoteJson -RelativePath $resultPath -Value $result -Message "codex runner: $($Status.ToLowerInvariant()) $taskId"
}

function Contains-ForbiddenKey {
    param([object]$Value)

    if ($null -eq $Value -or $Value -is [string]) { return $false }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            if ($ForbiddenKeys -contains ([string]$key).ToLowerInvariant()) { return $true }
            if (Contains-ForbiddenKey $Value[$key]) { return $true }
        }
        return $false
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        foreach ($item in $Value) {
            if (Contains-ForbiddenKey $item) { return $true }
        }
        return $false
    }
    foreach ($property in $Value.PSObject.Properties) {
        if ($ForbiddenKeys -contains $property.Name.ToLowerInvariant()) { return $true }
        if (Contains-ForbiddenKey $property.Value) { return $true }
    }
    return $false
}

function Test-TaskEnvelope {
    param([Parameter(Mandatory)][object]$Task)

    $taskId = Get-TaskPropertyValue -Task $Task -Name 'task_id'
    $taskType = Get-TaskPropertyValue -Task $Task -Name 'task_type'
    $createdAt = Get-TaskPropertyValue -Task $Task -Name 'created_at'
    $parameters = Get-TaskPropertyValue -Task $Task -Name 'parameters'
    if (-not (Test-TaskId $taskId)) { return $false }
    if ($AllowedTaskTypes -notcontains [string]$taskType) { return $false }
    if ([string]::IsNullOrWhiteSpace([string]$createdAt)) { return $false }
    if ($null -eq $parameters) { return $false }
    return -not (Contains-ForbiddenKey $Task)
}

function Write-CacheState {
    param([Parameter(Mandatory)][string]$TaskId)
    $state = [ordered]@{
        schema_version = 1
        last_seen_task_id = $TaskId
        observed_at = [DateTime]::UtcNow.ToString('o')
    }
    $state | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

function Write-TimeoutResult {
    param([Parameter(Mandatory)][object]$Task, [Parameter(Mandatory)][string]$StartedAt)
    Write-RunnerResult -Task $Task -Status 'TIMEOUT' -StartedAt $StartedAt -Summary 'Codex task runner exceeded its hard execution limit.' -Blocker 'RUNNER_TIMEOUT'
}

$mutex = New-Object System.Threading.Mutex($false, 'AmazonAgent-Codex-TaskRunner')
if (-not $mutex.WaitOne(0)) {
    Write-RunnerEvent 'RUNNER_SKIPPED_ALREADY_RUNNING'
    exit 0
}

try {
    if (-not (Test-Path -LiteralPath $RepoRoot) -or -not (Test-Path -LiteralPath $PromptPath)) {
        throw 'RUNNER_CONFIGURATION_MISSING'
    }

    $gh = (Get-Command gh.exe -ErrorAction Stop).Source
    if (-not (Test-NonInteractiveAuthentication -Executable $gh -Arguments @('auth', 'status'))) {
        Write-RunnerEvent 'AUTH_REQUIRED_GITHUB'
        exit 0
    }

    Write-RunnerEvent 'INBOX_READ_START'
    $task = Get-RemoteJson $InboxPath
    if ($null -eq $task) {
        Write-RunnerEvent 'NO_TASK'
        exit 0
    }
    if (-not (Test-TaskEnvelope $task)) {
        $startedAt = [DateTime]::UtcNow.ToString('o')
        Write-RunnerResult -Task $task -Status 'BLOCKED' -StartedAt $startedAt -Summary 'Task rejected by the runner schema and safety validation.' -Blocker 'TASK_SCHEMA_INVALID'
        Write-RunnerEvent 'TASK_REJECTED_BY_RUNNER'
        exit 0
    }

    $taskId = [string]$task.task_id
    $resultPath = "$ResultDirectory/$taskId.json"
    Write-RunnerEvent 'RESULT_READ_START'
    $existingResult = Get-RemoteJson $resultPath
    if ($null -ne $existingResult -and $TerminalStatuses -contains ([string]$existingResult.status).ToUpperInvariant()) {
        Write-RunnerEvent 'TASK_ALREADY_TERMINAL'
        exit 0
    }

    Write-CacheState $taskId
    $codex = (Get-Command codex.exe -ErrorAction Stop).Source
    $startedAt = [DateTime]::UtcNow.ToString('o')
    if (-not (Test-NonInteractiveAuthentication -Executable $codex -Arguments @('login', 'status'))) {
        Write-RunnerResult -Task $task -Status 'AUTH_REQUIRED' -StartedAt $startedAt -Summary 'Codex login is not available for non-interactive execution.' -Blocker 'CODEX_AUTH_REQUIRED'
        Write-RunnerEvent 'AUTH_REQUIRED_CODEX'
        exit 0
    }

    $effectiveTimeoutSeconds = if ([string]$task.task_type -eq 'local_readonly_test') { 120 } else { $TaskTimeoutSeconds }
    Write-RunnerEvent 'CODEX_START'
    $prompt = Get-Content -Raw -LiteralPath $PromptPath
    $run = Invoke-CapturedProcess -FilePath $codex -Arguments @('exec', '--ephemeral', '--sandbox', 'workspace-write', '--color', 'never', '--cd', $RepoRoot, '-') -TimeoutSeconds $effectiveTimeoutSeconds -StandardInput $prompt
    if ($run.TimedOut) {
        Write-TimeoutResult -Task $task -StartedAt $startedAt
        Write-RunnerEvent 'CODEX_TIMEOUT'
        exit 0
    }

    if ($run.ExitCode -ne 0) {
        Write-RunnerEvent ('CODEX_EXIT_NONZERO_' + $run.ExitCode)
    }
    $finalResult = Get-RemoteJson $resultPath
    if ($null -ne $finalResult -and $TerminalStatuses -contains ([string]$finalResult.status).ToUpperInvariant()) {
        Write-RunnerEvent 'CODEX_RESULT_TERMINAL'
    }
    else {
        if ($run.ExitCode -ne 0) {
            Write-RunnerResult -Task $task -Status 'FAILED' -StartedAt $startedAt -Summary 'Codex exited without writing a terminal result.' -Blocker 'CODEX_EXIT_NONZERO'
        }
        Write-RunnerEvent 'CODEX_EXITED_WITHOUT_TERMINAL_RESULT'
    }
}
catch {
    Write-RunnerEvent ('RUNNER_ERROR_' + $_.Exception.Message)
}
finally {
    try { $mutex.ReleaseMutex() } catch { }
    $mutex.Dispose()
}
