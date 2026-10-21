# Semaphore CI onboarding (Milestone 1)

## Status and boundaries

The four pipelines in `.semaphore/` are **prepared, not activated**. No account,
organization, remote project, agent, secret, GitHub setting or billing change is
made by these files. They do not require GitHub Actions to build or validate.
Existing `.github/workflows/` files remain untouched as a fallback. They are not
used by Semaphore. Nothing here publishes to npm or commits downloaded binaries.

**Former activation blocker (resolved):** the 600-line guard previously failed
on baseline files. Generated data tables (`compat_unicode.rs`,
`tokenizer_unicode.rs`) and `dist/` build output are now excluded as generated
files, and the remaining legacy source files are on the guard's existing
grandfather list pending split. The Static checks block passes locally.

The default `bun_nltk validation` pipeline runs static checks, native and WASM
Rust fmt/Clippy/tests, the complete Bun suite, the strict scoped fidelity gate,
Chromium/Firefox/WebKit and Node checks, installed npm/Bun package runtime/type
checks, size/content gates and the two examples. Rust native builds are required;
there is no `|| true` or JS-only fallback when a compiler fails.

Native Linux, macOS and Windows pipelines are **manual promotions**. An owner
must inspect the source revision and approve hardware use before selecting them.
Manual Semaphore promotions do not inherently wait for a successful parent:
only promote a **passed** validation run on a trusted branch. No automatic
promotion or privileged fork-PR execution is configured.

## Owner activation checklist

1. Create an account at <https://id.semaphoreci.com/signup>, verify the account,
   and create/select a **Semaphore Cloud** organization. Record its URL
   (`<organization>.semaphoreci.com`). This configuration targets Cloud/Hybrid,
   not an assumed Community Edition installation. The operator needs repository
   collaborator access and organization Owner/Admin privileges for agent setup.
2. Install/authorize <https://github.com/apps/semaphore-ci-cd> on the GitHub
   account that owns `Seyamalam/bun_nltk`. Select **only** this repository. Obtain
   any GitHub organization/enterprise installation and SSO approval. If deploy
   keys are prohibited, an administrator must approve/enable them first; see the
   official [connection instructions](https://docs.semaphore.io/using-semaphore/connect-github).
3. In the Semaphore organization, choose **Create new project → GitHub App**,
   select `Seyamalam/bun_nltk`, and use the checked-in
   `.semaphore/semaphore.yml` instead of generating/committing a template. The
   files must be on the remote revision being built; local preparation alone
   cannot activate them. Keep project initialization on hosted **Linux**.
4. Under **Project Settings → Repository**, set the pipeline path to
   `.semaphore/semaphore.yml`, enable the intended branch and pull-request
   triggers, and verify deploy-key/webhook health. Decide whether both branch
   and PR builds are worth the duplicate compute cost. Do not inject privileged
   secrets into the validation pipeline. Restrict self-hosted access and
   promotions to trusted maintainers/revisions in the org/project settings.
5. Confirm that `f1-standard-4`/`ubuntu2404` and
   `a2-standard-4`/`macos-xcode26` are available to this org. Obtain billing/usage
   approval before running. Windows has **no assumed hosted label**: complete
   the next section before promoting its pipeline.
6. Run the default pipeline on a test branch (UI **Run workflow**, or a new push
   after linking). Inspect every job and its evidence. Fix any integration
   regressions; do not treat YAML validation as a remote run. Once green, run
   each native promotion from that same trusted, passed workflow.
7. After observed successful runs, use GitHub **Settings → Branches / Rulesets**
   to require the actual Semaphore status contexts emitted by the linked
   project. Typical context syntax is `ci/semaphoreci/push: bun_nltk validation`;
   copy the observed PR/push contexts rather than guessing. Remove blocked
   GitHub Actions checks from *required-check settings* only with owner approval.
   Workflow files can remain as fallback without being required. If duplicate
   Actions runs are undesirable, disable them in GitHub UI after approval; this
   milestone does not disable/delete fallback YAML or the publishing workflow.

### CLI commands (owner-operated only)

Install the official CLI using the documented installer, reviewing it first:

```sh
curl --fail --location https://storage.googleapis.com/sem-cli-releases/get.sh -o sem-install.sh
bash sem-install.sh
sem version
# Alternative on macOS: brew install semaphoreci/tap/sem
```

Get a token privately from <https://me.semaphoreci.com/account>. On a private
terminal, not in a chat/log/shared shell history:

```sh
read -r -s SEMAPHORE_API_TOKEN
sem connect <organization>.semaphoreci.com "$SEMAPHORE_API_TOKEN"
unset SEMAPHORE_API_TOKEN
sem context
# Run from a checkout of the intended GitHub repository; creates a remote project.
# Do not run if the UI already linked it.
sem init --project-name bun-nltk --repo-url git@github.com:Seyamalam/bun_nltk.git --github-integration github_app
sem get project bun-nltk
sem get pipelines -p bun-nltk
sem get workflows -p bun-nltk
sem logs <job-id>
sem rebuild workflow <workflow-id>
```

`sem init` keeps an existing `.semaphore/semaphore.yml`. For an existing project,
inspect `sem get project bun-nltk`, then `sem edit project bun-nltk` if approved
to change trigger/pipeline settings. Native promotion is through the workflow
UI; there is no invented `sem validate` or `sem promote` command here.

## Windows x64 self-hosted prerequisite

The declared `s1-bun-nltk-windows-x64` is a **user-created agent type**, not a
Semaphore-hosted machine. An offline/missing agent will leave its job queued;
it is not permission to cross-compile a DLL or fabricate a verification report.

1. Provision a genuine Windows x64 host (Windows 11 or Windows Server with
   desktop-compatible Bun/Rust support). Do not use WSL or a Linux container.
   Use a dedicated unprivileged agent service account and a disposable VM or
   reimage between trusted jobs. Self-hosted state can persist; a job-specific
   Cargo directory prevents compilation collisions but is **not** a security
   sandbox. Do not expose credentials/persistent hardware to unreviewed forks.
2. Install Git for Windows/OpenSSH, 64-bit Windows PowerShell (the agent runs
   `powershell -NonInteractive -NoProfile`), Rust's `rustup` MSVC bootstrap, and
   Visual Studio 2022 Build Tools with **Desktop development with C++**, MSVC
   x64 tools and a Windows SDK. Install them into the service account/system
   PATH, not only an interactive user profile. A pinned Bun archive is installed
   job-locally by the script if the required version is absent. No Node/Python
   oracle is required in this native lane; oracle tests run on hosted Linux.
3. As org Owner/Admin, open **Agents → Create new**, name the type exactly
   `s1-bun-nltk-windows-x64`, choose agent-assigned names, register, select
   **Windows**, and follow the platform-specific installation commands shown by
   Semaphore. Reveal the registration token privately. Do not store it in this
   repository or transcript. Use the installation instructions returned for
   your org rather than guessing an installer/agent version or token.
   CLI alternative for type creation (not installation):

   ```sh
   sem create agent_type s1-bun-nltk-windows-x64
   sem get agent_types
   sem get agents s1-bun-nltk-windows-x64
   ```

4. Configure endpoint/registration in the agent's private config. Prefer
   `disconnect-after-job: true` with actual VM teardown/reimage; disconnecting
   alone does not clean the host. Install/verify the Windows toolbox `checkout`
   and `artifact` commands under the service identity. Configure the artifact
   backend and permissions required by your Cloud/Hybrid installation. Confirm
   push/pull works before a release build; owner/provider storage setup may be
   required. No cache bucket or remote storage is created by this milestone.
5. Verify as the service user: `git --version`, `rustup --version`,
   `rustc -vV` (host `x86_64-pc-windows-msvc`), and the toolbox commands. Confirm
   an online x64 agent in Semaphore. Leave **project initialization on Linux**;
   macOS/Windows agents cannot run initialization jobs.
6. Promote **Native Windows x64 (owner-managed agent)** on a passed trusted
   workflow. `native-windows.ps1` performs setup/build/test/host execution/upload
   in **one** PowerShell command: Windows launches a fresh process for each
   command, so separate prologue PATH changes would not survive. The command
    explicitly returns to `$USERPROFILE/$SEMAPHORE_GIT_DIR` after checkout (or
    uses `SEMAPHORE_GIT_DIR` directly when it is absolute).

The Windows script checks every native executable's exit status (PowerShell 5
`$ErrorActionPreference` alone does not catch nonzero native exits). Rust fmt,
both Clippy targets, Rust tests, actual MSVC builds, binary size/signature gates,
focused native correctness and installed tarball execution must all succeed
before a workflow artifact is uploaded. Native lane coverage is **host behavior
and packaging**, not full NLTK differential parity on Windows/macOS.

## macOS and artifact provenance

Current official hosted labels (checked 2026-10-21):

- Linux x64: `f1-standard-4`, `ubuntu2404` (4 vCPU, 16 GB).
- Apple Silicon: `a2-standard-4`, `macos-xcode26` (4 vCPU, 8 GB).
- Windows x64: custom `s1-bun-nltk-windows-x64`, **no hosted OS image**.

Deprecated `macos-xcode16`, GitHub `macos-14` and `windows-latest` are not used.
The macOS setup rejects Rosetta/x64 shells; the build helper checks both Bun's
host and Rust's `aarch64-apple-darwin` host. Existing Xcode supplies the Apple
linker. Rust is installed with the selected version. No signing/notarization or
unverifiable cross-platform binary is performed.

`scripts/ci/native-build.ts` uses `cargo build --locked`, explicit target triples
and job-specific `CARGO_TARGET_DIR`. It writes source revision, Cargo.lock hash,
compiler, Bun version, OS/host, target, binary size and SHA256 to
`artifacts/semaphore-native/<host>/build-{native,wasm}.json`. The separate
`host.json` records native loading/correctness, native-versus-TS output checks,
measurements and installation/execution of the tarball on **that** host.

Upload happens in the **job body**, not only an epilogue: Semaphore does not
fail a job when an epilogue upload fails. Failed fidelity reports are also
best-effort epilogue diagnostics. Stopped/timed-out jobs might have no report.
Never treat a missing report or signature-only check as host verification.

Successful native promotions push to the **workflow** namespace:

```sh
# In a Semaphore job from that same workflow:
artifact pull workflow native/prebuilt/darwin-arm64/bun_nltk.dylib --force
artifact pull workflow native/prebuilt/win32-x64/bun_nltk.dll --force
artifact pull workflow native/prebuilt/linux-x64/bun_nltk.so --force
artifact pull workflow artifacts/semaphore-native/darwin-arm64 --force
artifact pull workflow artifacts/semaphore-native/win32-x64 --force
artifact pull workflow artifacts/semaphore-native/linux-x64 --force
```

Outside a job, download from the workflow **Artifacts** tab. Match the source SHA,
host, path and size in both reports, and verify the downloaded binary's SHA256
against the build report before accepting it into a release. The existing host
report records path/size, not a second checksum. Each host rebuilds **its own**
native library and WASM;
other platforms' committed binaries are only checked for package presence and
signature, not certified by that host. No automatic aggregate release or npm
publish is supplied; the release owner assembles artifacts from the same SHA.

## Pins and reproducible oracle

`scripts/ci/versions.json` selects Bun 1.4.2, Node 24.21.0, Rust 1.97.1 and
Python 3.12.12. Bun Linux/macOS/Windows archives have official SHA256 pins.
Rust components are toolchain-version selected; Linux language versions are
selected through Semaphore `sem-version` (not available on self-hosted agents).
Hosted images and the official Rust bootstrap installer remain provider-managed
bootstrap dependencies; this is not a digest-pinned OS image.

Root/example installs use committed frozen Bun lockfiles, including exact tsrs
and Oxlint versions. The root typecheck includes the js-library consumer, so
setup installs that example before invoking `npx --no-install tsrs`.

`oracle-requirements.txt` pins **all oracle dependencies** and their Linux x64
CPython 3.12 wheel hashes. It deliberately will not work as a generic macOS,
Windows or Python 3.14 requirements file. NLTK remains 3.10.3 for differential
testing, even if a newer release exists; run trusted fixtures only in a disposable
job. The default pipeline unsets inherited `PYTHONPATH`, uses a local `.venv`
and reports the actual imported oracle path/version.

The data lock pins the upstream NLTK data Git revision, index checksum and 11
individual archive SHA256 values. `oracle.py prepare` verifies downloads and
rejects archive traversal/symlinks; `check` checks extracted bytes and resource
availability against only `$NLTK_DATA`, not a developer's home. The existing
fixture importer runs with its **download transport disabled** after checksum
verification, so it cannot silently fetch a mutable index. Corpus-derived
fixtures stay in ignored `test/fixtures/nltk_imported/`; availability/import
tests **are not** behavioral parity. The separate fidelity gate reports exact
agreement only for its scoped cases/tolerances, not complete NLTK equivalence.

Before downloading/using corpus data, obtain owner approval for the upstream
licenses, especially Brown and the Penn Treebank sample's non-commercial/fair
use restrictions. These are test inputs, not blanket permission to redistribute
data in a commercial package. Preserve upstream notices and do not publish
downloaded corpora as release artifacts.

## Costs and approvals

The live [pricing page](https://semaphore.io/pricing) on 2026-10-21 lists Ubuntu
x64 4 vCPU **$0.015/min**, macOS 4 vCPU **$0.09/min**, self-hosted
**$0.0025/min** plus your Windows host/licensing/network costs. It advertises
$15 monthly free credits and 20 concurrent jobs by default; eligibility and
actual org limits must be confirmed, not assumed. A 30-minute macOS job is
approximately $2.70; a 30-minute self-hosted job is $0.075 plus infrastructure.
Compute estimates exclude initialization, retries and storage/traffic.

Artifact allowances advertised are 20 GB/month egress and 100 GB/month storage,
then $0.35/GB egress and $0.07/GB storage. Verify current billing terms, set
spending limits and project artifact retention (e.g. diagnostics 14 days and
approved release evidence 90 days). Cloud job/workflow artifacts have a maximum
400-day retention; project scope can persist indefinitely. This setup avoids
global project artifact writes. Self-hosted storage may use owner-managed cloud
buckets with additional provider charges. No paid service/account is activated
here. Repeated installs in isolated jobs intentionally favor correctness over
unreviewed shared caches.

## Local validation and remaining execution work

From an already provisioned Linux checkout:

```sh
bun install --frozen-lockfile
(cd examples/js-library && bun install --frozen-lockfile)
npx --no-install tsrs -p tsconfig.json --noEmit
npx --no-install oxlint src test bench scripts index.ts
python3 scripts/ci/validate-config.py
python3 -m unittest discover -s scripts/ci -p 'test_*.py'
export CARGO_TARGET_DIR="$PWD/rust/target/semaphore-local"
bash scripts/ci/validate.sh rust
bun run scripts/ci/native-build.ts native
bun run scripts/ci/native-build.ts wasm
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
```

Inside a hosted Linux Semaphore job, `checkout`, then
`source scripts/ci/setup.sh` provisions the pinned oracle and toolchain;
`bash scripts/ci/validate.sh <static|rust|tests|fidelity|portable|examples|native-host>`
runs the selected reusable family. `setup.sh` is sourced, not executed, so PATH
and Cargo isolation survive. Playwright OS dependencies need hosted Ubuntu or
equivalent approved local provisioning.

`validate-config.py` parses all four YAML files, rejects duplicate/unknown keys,
checks our supported runners, dependencies/cycles, nonempty string commands and
manual promotion targets. Its contract is **repository-specific, not a complete
Semaphore schema/Conditions DSL validator**. If the official toolbox `spc` is
installed, it also executes:

```sh
spc compile --input .semaphore/semaphore.yml --output /path/to/output.yml --logs /path/to/logs.jsonl
```

No `sem validate` subcommand is assumed. Account-side initialization/compiler
and all native hosted/self-hosted jobs still need an owner-executed first run.
Linux preparation does not prove Windows PowerShell parsing, MSVC availability,
macOS runner allocation or self-hosted artifact credentials.

### Observed local results (2026-10-21, Linux x64)

- All four pipeline files pass the repository contract and Bash syntax checks;
  13 configuration/archive-security tests pass. They also pass the official
  upstream SPC JSON schema at revision
  `d34ef328b394690755fe4846233a0ae8dbbdcd4e`. The actual `spc` compiler is not
  installed here and has **not** run; schema validation is not compilation or CI.
- `npx --no-install tsrs -p tsconfig.json --noEmit` passes. Oxlint passes with
  existing source warnings and no warnings in the added TypeScript helper.
  The complete static family remains **red** because of the baseline LOC guard
  violations listed above; the other static checks were executed separately.
- Rust native/WASM fmt and Clippy pass; all 62 Rust tests pass with an isolated
  Cargo target directory. Dedicated Linux native/WASM source builds, signature
  and size gates, portable regeneration, native host execution and installed
  npm/Bun package runtime/declaration checks pass.
- The requested parent-oracle command
  `PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test` passes all 498 tests
  (48,673 assertions). The separate provisioned oracle/JUnit run also passes
  498 tests, and its nonempty XML parses with zero failures/skips.
- Pinned data provisioning and offline fixture generation pass; the strict
  fidelity gate passes all 43 required groups with zero failed/skipped groups.
  Three explicitly unsupported groups remain outside that claim.
- All ten CPython 3.12 Linux wheel pins pass a dependency-resolving
  `pip download --require-hashes --only-binary=:all:` check. Local oracle
  execution used Python 3.14 with the pinned package versions; a fresh hash-locked
  install and execution under the selected **Python 3.12.12** remain unexecuted.
- Chromium and Firefox verification pass. Local WebKit cannot start because
  `libevent-2.1.so.7` is missing. The hosted portable family installs Playwright
  OS dependencies, but that hosted run has not occurred. The document example's
  four tests and the direct Vite browser example build pass. The final full
  `examples` family is **not green locally**: repeated Bun `file:../..` installs
  failed with a copy-cache `ENOENT`, and browser example installation timed out
  after 300 seconds. Partial generated installs were quarantined; the direct
  browser build used a local source symlink. The redundant js-library reinstall
  was removed from `validate.sh` because setup already provisions it. A clean
  hosted example installation still needs execution; no lockfile was changed.

Outstanding owner work is account/project linking, approval of costs and corpus
licenses, the real compiler/hosted Linux run, genuine Apple Silicon execution,
and Windows agent/toolbox/artifact provisioning plus PowerShell/MSVC execution.
There is no macOS/Windows build or host-verification evidence from this Linux
preparation. Existing committed foreign-platform binaries are not new evidence.

Integration note: only `.semaphore/`, `scripts/ci/` and this family-specific doc
are added. Shared `index.ts`, `src/wasm.ts`, `rust/src/lib.rs`, existing build
scripts, migration docs and GitHub workflows are untouched. Generated binaries
from local checks are not part of this CI change. Future algorithm integrations
must still pass the complete validation and preserve their own parity scope.

## Official references

- [About Semaphore](https://docs.semaphore.io/getting-started/about-semaphore)
- [Pipeline YAML](https://docs.semaphore.io/reference/pipeline-yaml)
- [Machine types](https://docs.semaphore.io/reference/machine-types)
- [Hosted macOS images](https://docs.semaphore.io/reference/os-apple)
- [Self-hosted / Windows sessions](https://docs.semaphore.io/using-semaphore/self-hosted)
- [Agent installation](https://docs.semaphore.io/using-semaphore/self-hosted-install)
- [Agent configuration](https://docs.semaphore.io/using-semaphore/self-hosted-configure)
- [Artifacts](https://docs.semaphore.io/using-semaphore/artifacts)
- [Toolbox / spc](https://docs.semaphore.io/reference/toolbox)
- [Semaphore CLI](https://docs.semaphore.io/reference/semaphore-cli)
- [GitHub App linking](https://docs.semaphore.io/using-semaphore/connect-github)
- [Pricing](https://semaphore.io/pricing)
