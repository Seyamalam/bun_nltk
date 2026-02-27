import { resolve } from "node:path";
import { loadPayload, writeManifest, writePacked } from "./pack-wordnet";

function parseArgs(): { out: string; checksumOut: string } {
  const args = process.argv.slice(2);
  let out = "artifacts/wordnet_official.bin";
  let checksumOut = "artifacts/wordnet_official.sha256.json";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--out") out = args[++i] ?? out;
    else if (arg === "--checksum-out") checksumOut = args[++i] ?? checksumOut;
  }
  return { out, checksumOut };
}

function findOfficialDictDir(root: string): string {
  const proc = Bun.spawnSync(["python", "scripts/find_wordnet_dict.py"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`failed to locate official wordnet dict: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const payload = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { dict_dir: string };
  return payload.dict_dir;
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const args = parseArgs();
  const dictDir = findOfficialDictDir(root);
  const payload = loadPayload(dictDir, undefined);
  const packed = writePacked(payload, args.out, dictDir);
  const checksumPath = writeManifest(args.checksumOut, packed.manifest);
  console.log(
    JSON.stringify(
      {
        ok: true,
        dict_dir: dictDir,
        out: packed.outPath,
        checksum_out: checksumPath,
        ...packed.manifest,
      },
      null,
      2,
    ),
  );
}

main();

