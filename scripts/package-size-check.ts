const MAX_FILES = 400;
const MAX_UNPACKED_BYTES = 8_000_000;

const forbidden = [
  /^rust\//,
  /^scripts\//,
  /^models\/wordnet_full\./,
  /(^|\/)__pycache__\//,
  /\.pyc$/,
  /(^|\/)target\//,
];

function parseBytes(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)(B|KB|MB)$/);
  if (!match) throw new Error(`cannot parse packed size: ${value}`);
  const amount = Number(match[1]);
  if (match[2] === "MB") return amount * 1_000_000;
  if (match[2] === "KB") return amount * 1_000;
  return amount;
}

const proc = Bun.spawnSync(["bun", "pm", "pack", "--dry-run", "--ignore-scripts"], {
  stdout: "pipe",
  stderr: "pipe",
});

const output = `${new TextDecoder().decode(proc.stdout)}\n${new TextDecoder().decode(proc.stderr)}`;
if (proc.exitCode !== 0) {
  throw new Error(`bun pm pack --dry-run failed with code ${proc.exitCode}\n${output}`);
}

const files: Array<{ path: string; bytes: number }> = [];
for (const line of output.split(/\r?\n/)) {
  const match = line.match(/^packed\s+(\S+)\s+(.+)$/);
  if (!match) continue;
  files.push({ path: match[2]!, bytes: parseBytes(match[1]!) });
}

if (files.length === 0) throw new Error(`no package files found in dry-run output\n${output}`);

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
      unpacked_bytes: Math.round(unpackedBytes),
      limits: { files: MAX_FILES, unpacked_bytes: MAX_UNPACKED_BYTES },
    },
    null,
    2,
  ),
);
