import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type CmdResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function run(command: string[], cwd: string): CmdResult {
  const proc = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
}

async function installWithRetry(spec: string, cwd: string, attempts = 12, delayMs = 10000): Promise<void> {
  for (let i = 1; i <= attempts; i += 1) {
    const result = run(["bun", "add", spec], cwd);
    if (result.exitCode === 0) return;

    if (i === attempts) {
      throw new Error(
        `failed to install ${spec} after ${attempts} attempts\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
    await Bun.sleep(delayMs);
  }
}

async function main() {
  const spec = process.argv[2] ?? "bun_nltk@latest";
  const tempDir = mkdtempSync(join(tmpdir(), "bun-nltk-smoke-"));

  try {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "bun-nltk-smoke",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
      "utf8",
    );

    await installWithRetry(spec, tempDir);

    const pkgDir = join(tempDir, "node_modules", "bun_nltk");
    const installedPkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare"].filter(
      (name) => Boolean(installedPkg.scripts?.[name]),
    );
    if (lifecycleScripts.length > 0) {
      throw new Error(`unexpected lifecycle scripts in published package: ${lifecycleScripts.join(", ")}`);
    }

    const linuxPrebuilt = join(pkgDir, "native", "prebuilt", "linux-x64", "bun_nltk.so");
    const windowsPrebuilt = join(pkgDir, "native", "prebuilt", "win32-x64", "bun_nltk.dll");
    const wasmBinary = join(pkgDir, "native", "bun_nltk.wasm");
    if (!existsSync(linuxPrebuilt) || !existsSync(windowsPrebuilt) || !existsSync(wasmBinary)) {
      throw new Error(
        `missing packaged binaries:\nlinux=${existsSync(linuxPrebuilt)}\nwindows=${existsSync(windowsPrebuilt)}\nwasm=${existsSync(
          wasmBinary,
        )}`,
      );
    }

    const smokeScript = `
import {
  countTokensAscii,
  countTokensAsciiJs,
  sentenceTokenizeSubset,
  loadPerceptronTaggerModel,
  posTagPerceptronAscii,
  WasmNltk
} from "bun_nltk";

const text = "Dr. Smith built 3 models. They were running quickly.";
const nativeCount = countTokensAscii(text);
const jsCount = countTokensAsciiJs(text);
if (nativeCount !== jsCount) {
  throw new Error(\`token count mismatch: native=\${nativeCount} js=\${jsCount}\`);
}

const sentences = sentenceTokenizeSubset(text);
if (sentences.length !== 2) {
  throw new Error(\`sentence split mismatch: \${JSON.stringify(sentences)}\`);
}

const model = loadPerceptronTaggerModel();
const tagged = posTagPerceptronAscii(text, { model });
if (tagged.length !== jsCount) {
  throw new Error(\`tagger output mismatch: tagged=\${tagged.length} tokens=\${jsCount}\`);
}

const wasm = await WasmNltk.init();
try {
  const metrics = wasm.computeAsciiMetrics(text, 2);
  if (metrics.tokens !== jsCount) {
    throw new Error(\`wasm metrics mismatch: \${JSON.stringify(metrics)}\`);
  }
} finally {
  wasm.dispose();
}

console.log(JSON.stringify({ ok: true, spec: "${spec}", tokens: jsCount }, null, 2));
`;
    writeFileSync(join(tempDir, "smoke.ts"), smokeScript, "utf8");

    const result = run(["bun", "run", "smoke.ts"], tempDir);
    if (result.exitCode !== 0) {
      throw new Error(`smoke script failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    }

    console.log(result.stdout.trim());
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
