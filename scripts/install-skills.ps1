# Install the repository's optional Agent Skills into a DSH skill root.
#
# Default target: $DSH_AGENTS_HOME/skills (normally ~/.agents/skills), the
# user-level root that DSH scans for every session.
# -Project targets <repo>/.agents/skills instead, which DSH scans when a
# session's project root is this repository. That copy is gitignored.
#
# Existing skills are skipped unless -Force is passed.

[CmdletBinding()]
param(
  [string]$AgentsHome = $(if ($env:DSH_AGENTS_HOME) { $env:DSH_AGENTS_HOME } else { Join-Path $HOME '.agents' }),
  [switch]$Project,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'skills'
if (-not (Test-Path -LiteralPath $source)) { throw "Missing skills directory: $source" }

$target = if ($Project) { Join-Path $root '.agents\skills' } else { Join-Path $AgentsHome 'skills' }
New-Item -ItemType Directory -Force -Path $target | Out-Null

$installed = 0
$skipped = 0
Get-ChildItem -LiteralPath $source -Directory | ForEach-Object {
  $dest = Join-Path $target $_.Name
  if (Test-Path -LiteralPath $dest) {
    if (-not $Force) {
      Write-Warning "Skip existing skill: $dest (use -Force to replace)"
      $skipped++
      return
    }
    Remove-Item -LiteralPath $dest -Recurse -Force
  }
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse
  $installed++
}

Write-Host "Installed $installed skill(s) to $target"
if ($skipped -gt 0) { Write-Host "Skipped $skipped existing skill(s); rerun with -Force to replace them." }
