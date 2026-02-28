import { resolve } from "node:path";
import { loadPayload, writeManifest, writePacked } from "./pack-wordnet";

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
  const dictDir = findOfficialDictDir(root);
  const payload = loadPayload(dictDir, undefined);
  const packed = writePacked(payload, "models/wordnet_full.bin", dictDir);
  const checksumPath = writeManifest("models/wordnet_full.sha256.json", packed.manifest);

  const verify = Bun.spawnSync(
    [
      "bun",
      "run",
      "scripts/verify-wordnet-pack.ts",
      "--packed",
      "models/wordnet_full.bin",
      "--manifest",
      "models/wordnet_full.sha256.json",
      "--dict-dir",
      dictDir,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (verify.exitCode !== 0) {
    throw new Error(`failed to verify default wordnet pack: ${new TextDecoder().decode(verify.stderr)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dict_dir: dictDir,
        out: packed.outPath,
        checksum_out: checksumPath,
        sha256: packed.manifest.sha256,
        bytes: packed.manifest.bytes,
      },
      null,
      2,
    ),
  );
}

main();
