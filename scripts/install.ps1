param([ValidatePattern('^[A-Za-z0-9_-]+$')][string]$Profile = 'desktop')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$plugins = @('dsh-session-cost', 'dsh-theme-atelier', 'dsh-code-mode-preset')
$paths = @($plugins | ForEach-Object { (Resolve-Path -LiteralPath (Join-Path $repoRoot $_)).Path })
Get-Command dsh -ErrorAction Stop | Out-Null
& dsh plugin --profile $Profile add @paths
if ($LASTEXITCODE -ne 0) { throw "Plugin linking failed: exit $LASTEXITCODE" }
Write-Output 'All three plugins are linked. Restart DeepSeek Harness to load them.'
