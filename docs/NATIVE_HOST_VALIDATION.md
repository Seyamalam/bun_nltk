# Native host validation

Use these checks on real x64 Linux and Windows machines. Each run compares the Rust native path with the TypeScript fallback on the same computer. Do not compare raw milliseconds from one operating system with raw milliseconds from another.

The repository includes the release binaries. Your tester needs Git, Bun, and an internet connection for `bun install`. They do not need Rust, Python, Zig, Docker, Wine, Visual Studio, or administrator access.

## Linux x64

If Bun is already installed:

```bash
git clone https://github.com/Seyamalam/bun_nltk.git
cd bun_nltk
bash scripts/verify-linux.sh
```

If Bun is missing, install it first:

```bash
curl -fsSL https://bun.com/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

The Bun installer needs `unzip` on Linux. Install `unzip` with the distribution's package manager if the installer asks for it.

## Windows x64

Open PowerShell and install Bun if needed:

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
$env:Path += ";$env:USERPROFILE\.bun\bin"
```

Then clone and run the wrapper:

```powershell
git clone https://github.com/Seyamalam/bun_nltk.git
cd bun_nltk
.\scripts\verify-windows.cmd
```

The `.cmd` wrapper uses Windows PowerShell with a one-process execution-policy bypass, so the tester does not need to change the machine's PowerShell policy.

## What the command does

The wrapper runs `bun install --frozen-lockfile`, then:

- loads the checked-in native binary for the current operating system;
- runs the focused native correctness tests;
- compares token counting, logistic and SVM text training, HMM Viterbi decoding, and Euclidean K-means against their TypeScript fallbacks;
- calculates deterministic 95% bootstrap intervals from same-machine samples;
- packs the npm tarball, installs it in a temporary project, and executes the installed native and WASM APIs;
- writes one JSON report under `artifacts/`.

The default is seven measured rounds per implementation. A normal run takes about one to three minutes. Use 15 rounds for a paper-quality report:

```bash
bash scripts/verify-linux.sh 15
```

```powershell
.\scripts\verify-windows.cmd -Rounds 15
```

Send back one of these files:

```text
artifacts/native-host-linux-x64.json
artifacts/native-host-win32-x64.json
```

The script does not upload anything. The report includes the Git commit, operating-system release, CPU model, Bun version, raw samples, medians, and confidence intervals.

## Reading the results

A speedup above `1.0` favors Rust native. The confidence interval matters more than a single median. If the interval crosses `1.0`, report that result as inconclusive.

Keep each operating system as its own experiment. Compare native Rust with TypeScript on the same machine and in the same run.

## Common failures

- `No prebuilt native library is available`: use an x64 Linux or x64 Windows machine. ARM64 hosts are not part of this release.
- `Missing release artifact`: pull the commit that includes `native/prebuilt/` and `native/bun_nltk.wasm`.
- `bun: command not found`: add `$HOME/.bun/bin` on Linux or `%USERPROFILE%\.bun\bin` on Windows to `PATH`, then reopen the terminal.
- `Illegal instruction` from Bun on an older x64 CPU: install Bun's baseline build and rerun the wrapper.
