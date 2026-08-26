param(
  [ValidateRange(5, 100)]
  [int]$Rounds = 7
)

$ErrorActionPreference = "Stop"

$OsArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
if (-not [Environment]::Is64BitOperatingSystem -or $OsArchitecture -ne "X64") {
  Write-Error "This validator requires an x64 Windows host. Found: $OsArchitecture"
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error 'Bun is required. Install it with: powershell -c "irm bun.sh/install.ps1|iex". Open a new terminal, then run this command again.'
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $RepoRoot
try {
  Write-Host "Installing locked dependencies..."
  & bun install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "bun install failed with exit code $LASTEXITCODE" }

  Write-Host "Running native Windows validation with $Rounds benchmark rounds..."
  & bun run verify:native-host --rounds $Rounds
  if ($LASTEXITCODE -ne 0) { throw "native validation failed with exit code $LASTEXITCODE" }
}
finally {
  Pop-Location
}
