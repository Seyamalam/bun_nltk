import { statSync } from "node:fs";
import { resolve, sep } from "node:path";

const MAX_FILES = 400;
// Includes both full NLTK NE models (~5.5 MB compressed), three native
// prebuilt libraries, the portable bundle and English Punkt/VADER data.
const MAX_UNPACKED_BYTES = 13_000_000;

const forbidden = [
  /^rust\//,
  /^scripts\//,
  /^models\/wordnet_full\./,
  /(^|\/)__pycache__\//,
  /\.pyc$/,
  /(^|\/)target\//,
];

export function packageFiles(output: string, root: string): Array<{ path: string; bytes: number }> {
  const base = resolve(root);
  const files: Array<{ path: string; bytes: number }> = [];
  const seen = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^packed\s+\S+\s+(.+)$/);
    if (!match) continue;
    const path = match[1]!;
    const absolute = resolve(base, path);
    if (!absolute.startsWith(base + sep) || seen.has(path)) {
      throw new Error(`unsafe or duplicate package path: ${path}`);
    }
    seen.add(path);
    // Bun formats MB/KB with rounding. Read the selected files' actual lengths
    // rather than adding rounded display values at a tight unpacked-byte gate.
    const info = statSync(absolute);
    if (!info.isFile()) throw new Error(`package path is not a file: ${path}`);
    files.push({ path, bytes: info.size });
  }
  if (files.length === 0) throw new Error(`no package files found in dry-run output\n${output}`);
  return files;
}

if (import.meta.main) {
  const proc = Bun.spawnSync(["bun", "pm", "pack", "--dry-run", "--ignore-scripts"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = `${new TextDecoder().decode(proc.stdout)}\n${new TextDecoder().decode(proc.stderr)}`;
  if (proc.exitCode !== 0) {
    throw new Error(`bun pm pack --dry-run failed with code ${proc.exitCode}\n${output}`);
  }

  const files = packageFiles(output, process.cwd());

  const leaked = files.filter((file) => forbidden.some((pattern) => pattern.test(file.path)));
  if (leaked.length > 0) {
    throw new Error(`forbidden package files:\n${leaked.map((file) => file.path).join("\n")}`);
  }

  const unpackedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (files.length > MAX_FILES) {
    throw new Error(`package file count exceeded: ${files.length} > ${MAX_FILES}`);
  }
  if (unpackedBytes > MAX_UNPACKED_BYTES) {
    throw new Error(`package unpacked size exceeded: ${unpackedBytes} > ${MAX_UNPACKED_BYTES}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        files: files.length,
        unpacked_bytes: unpackedBytes,
        limits: { files: MAX_FILES, unpacked_bytes: MAX_UNPACKED_BYTES },
      },
      null,
      2,
    ),
  );
}
