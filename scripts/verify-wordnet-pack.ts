import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPayload, packPayload, type WordNetPackManifest } from "./pack-wordnet";

const MAGIC = "BNWN1";

function sha256Hex(data: Uint8Array): string {
  const h = createHash("sha256");
  h.update(data);
  return h.digest("hex");
}

function parseArgs(): {
  packed: string;
  manifest: string;
  dictDir?: string;
  inJson?: string;
} {
  const args = process.argv.slice(2);
  let packed = "artifacts/wordnet_official.bin";
  let manifest = "artifacts/wordnet_official.sha256.json";
  let dictDir: string | undefined;
  let inJson: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--packed") packed = args[++i] ?? packed;
    else if (arg === "--manifest") manifest = args[++i] ?? manifest;
    else if (arg === "--dict-dir") dictDir = args[++i];
    else if (arg === "--in-json") inJson = args[++i];
  }
  return { packed, manifest, dictDir, inJson };
}

function verifyHeader(bytes: Uint8Array): void {
  const header = new TextDecoder().decode(bytes.slice(0, MAGIC.length));
  if (header !== MAGIC) throw new Error(`invalid packed magic: expected ${MAGIC} got ${header}`);
  const payloadLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(MAGIC.length, true);
  if (payloadLen !== bytes.length - (MAGIC.length + 4)) {
    throw new Error(`invalid packed payload length: expected ${payloadLen}, bytes=${bytes.length - (MAGIC.length + 4)}`);
  }
}

function main() {
  const args = parseArgs();
  const packedPath = resolve(args.packed);
  const manifestPath = resolve(args.manifest);
  if (!existsSync(packedPath)) throw new Error(`packed file does not exist: ${packedPath}`);
  if (!existsSync(manifestPath)) throw new Error(`manifest file does not exist: ${manifestPath}`);

  const bytes = readFileSync(packedPath);
  verifyHeader(bytes);
  const sha256 = sha256Hex(bytes);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as WordNetPackManifest;

  if (manifest.algorithm !== "sha256") throw new Error(`unsupported manifest algorithm: ${manifest.algorithm}`);
  if (manifest.sha256 !== sha256) throw new Error(`sha256 mismatch: expected ${manifest.sha256}, got ${sha256}`);
  if (manifest.bytes !== bytes.length) throw new Error(`byte length mismatch: expected ${manifest.bytes}, got ${bytes.length}`);

  const sourceDir = args.dictDir ?? (manifest.source && existsSync(manifest.source) ? manifest.source : undefined);
  const sourceJson = args.inJson;
  if (sourceDir || sourceJson) {
    const payload = loadPayload(sourceDir, sourceJson);
    const repacked = packPayload(payload);
    if (repacked.length !== bytes.length) {
      throw new Error(`determinism mismatch length: repacked=${repacked.length} packed=${bytes.length}`);
    }
    for (let i = 0; i < repacked.length; i += 1) {
      if (repacked[i] !== bytes[i]) {
        throw new Error(`determinism mismatch at byte ${i}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        packed: packedPath,
        manifest: manifestPath,
        sha256,
      },
      null,
      2,
    ),
  );
}

main();

