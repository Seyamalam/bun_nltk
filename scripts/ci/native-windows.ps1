# Semaphore starts each command in a new Windows PowerShell process. Keep
# checkout, setup, PATH changes, builds and artifact upload in this one command.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
$root = (Get-Location).Path
$versions = Get-Content scripts/ci/versions.json -Raw | ConvertFrom-Json
if (-not [Environment]::Is64BitOperatingSystem -or -not [Environment]::Is64BitProcess) {
    throw 'A real Windows x64 agent and 64-bit PowerShell are required'
}
$env:BUN_NLTK_EXPECT_HOST = 'win32-x64'
$env:RUSTUP_TOOLCHAIN = $versions.rust
$job = if ($env:SEMAPHORE_JOB_ID) { $env:SEMAPHORE_JOB_ID } else { 'local' }
$env:CARGO_TARGET_DIR = Join-Path $root "rust/target/semaphore-$job"
$bin = Join-Path $root '.cache/semaphore/bin'
New-Item -ItemType Directory -Force $bin | Out-Null
$env:PATH = "$bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
$archive = $versions.bunArchives.'win32-x64'
$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCommand -or ((& bun --version) -ne $versions.bun)) {
    $zip = Join-Path $root ".cache/semaphore/$($archive.name)"
    Invoke-WebRequest -UseBasicParsing "https://github.com/oven-sh/bun/releases/download/bun-v$($versions.bun)/$($archive.name)" -OutFile $zip
    if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archive.sha256) {
        throw 'Bun archive SHA256 mismatch'
    }
    Expand-Archive $zip -DestinationPath (Join-Path $root '.cache/semaphore') -Force
    Copy-Item (Join-Path $root ".cache/semaphore/$($archive.name.Replace('.zip',''))/bun.exe") (Join-Path $bin 'bun.exe') -Force
}
# rustup and Visual Studio C++ Build Tools/SDK must be provisioned by the owner.
Invoke-Checked rustup @('toolchain', 'install', $versions.rust, '--profile', 'minimal', '--component', 'rustfmt', '--component', 'clippy')
Invoke-Checked rustup @('target', 'add', 'wasm32-unknown-unknown', '--toolchain', $versions.rust)
Invoke-Checked bun @('install', '--frozen-lockfile')
foreach ($manifest in @('rust/Cargo.toml', 'rust/compat/Cargo.toml')) {
    Invoke-Checked cargo @('fmt', '--manifest-path', $manifest, '--check')
    Invoke-Checked cargo @('clippy', '--locked', '--manifest-path', $manifest, '--all-targets', '--', '-D', 'warnings')
    Invoke-Checked cargo @('clippy', '--locked', '--manifest-path', $manifest, '--target', 'wasm32-unknown-unknown', '--all-targets', '--', '-D', 'warnings')
    Invoke-Checked cargo @('test', '--locked', '--manifest-path', $manifest)
}
Invoke-Checked bun @('run', 'scripts/ci/native-build.ts', 'native')
Invoke-Checked bun @('run', 'scripts/ci/native-build.ts', 'wasm')
Invoke-Checked bun @('run', 'scripts/ci/native-build.ts', 'compat')
Invoke-Checked bun @('run', 'scripts/build-nltk-compat.ts', '--check')
Invoke-Checked bun @('run', 'build:portable')
Invoke-Checked bun @('run', 'native:artifacts:check')
Invoke-Checked bun @('run', 'verify:native-host', '--', '--rounds', '7', '--output', 'artifacts/semaphore-native/win32-x64/host.json')
# Publish in the job body: Semaphore does not fail jobs for epilogue errors.
Invoke-Checked artifact @('push', 'workflow', 'native/prebuilt/win32-x64/bun_nltk.dll', '--force')
Invoke-Checked artifact @('push', 'workflow', 'artifacts/semaphore-native/win32-x64', '--force')
