import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Pos = "n" | "v" | "a" | "r";

type SynsetRow = {
  id: string;
  pos: Pos;
  lemmas: string[];
  gloss: string;
  examples: string[];
  hypernyms: string[];
  hyponyms: string[];
  similarTo: string[];
  antonyms: string[];
};

export type WordNetMiniPayload = {
  version: number;
  synsets: SynsetRow[];
};

export type WordNetPackManifest = {
  algorithm: "sha256";
  sha256: string;
  bytes: number;
  synset_count: number;
  source: string;
};

const MAGIC = "BNWN1";

function normalizeLemma(lemma: string): string {
  return lemma.toLowerCase().replace(/\s+/g, "_");
}

function parseArgs(): { dictDir?: string; inJson?: string; out: string; checksumOut?: string } {
  const args = process.argv.slice(2);
  let dictDir: string | undefined;
  let inJson: string | undefined;
  let out = "models/wordnet_full.bin";
  let checksumOut: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--dict-dir") dictDir = args[++i];
    else if (arg === "--in-json") inJson = args[++i];
    else if (arg === "--out") out = args[++i] ?? out;
    else if (arg === "--checksum-out") checksumOut = args[++i];
  }
  return { dictDir, inJson, out, checksumOut };
}

function mapPos(raw: string): Pos | null {
  if (raw === "n") return "n";
  if (raw === "v") return "v";
  if (raw === "a" || raw === "s") return "a";
  if (raw === "r") return "r";
  return null;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function canonicalize(payload: WordNetMiniPayload): WordNetMiniPayload {
  const synsets = payload.synsets
    .map((row) => ({
      ...row,
      lemmas: sortedUnique(row.lemmas),
      examples: sortedUnique(row.examples),
      hypernyms: sortedUnique(row.hypernyms),
      hyponyms: sortedUnique(row.hyponyms),
      similarTo: sortedUnique(row.similarTo),
      antonyms: sortedUnique(row.antonyms),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: payload.version,
    synsets,
  };
}

function parseWordNetDataFile(path: string, posRaw: string): SynsetRow[] {
  const pos = mapPos(posRaw);
  if (!pos) return [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/g);
  const rows: Array<{
    id: string;
    pos: Pos;
    lemmas: string[];
    gloss: string;
    examples: string[];
    pointerTargets: Array<{ symbol: string; target: string }>;
  }> = [];

  for (const line of lines) {
    if (!line || line.startsWith("  ") || line.startsWith(" ")) continue;
    const [left, glossRaw] = line.split("|");
    if (!left) continue;
    const parts = left.trim().split(/\s+/g);
    if (parts.length < 6) continue;

    const offset = parts[0]!;
    const ssType = parts[2]!;
    const rowPos = mapPos(ssType);
    if (!rowPos) continue;
    const id = `${offset}.${rowPos}`;
    const wCntHex = parts[3]!;
    const wCnt = Number.parseInt(wCntHex, 16);
    if (!Number.isFinite(wCnt) || wCnt < 0) continue;

    let cursor = 4;
    const lemmas: string[] = [];
    for (let i = 0; i < wCnt; i += 1) {
      const lemma = parts[cursor++];
      cursor += 1;
      if (!lemma) continue;
      lemmas.push(normalizeLemma(lemma.replace(/_/g, " ")));
    }

    const pCnt = Number(parts[cursor++] ?? "0");
    const pointerTargets: Array<{ symbol: string; target: string }> = [];
    for (let i = 0; i < pCnt; i += 1) {
      const symbol = parts[cursor++] ?? "";
      const targetOffset = parts[cursor++] ?? "";
      const targetPosRaw = parts[cursor++] ?? "";
      cursor += 1;
      const targetPos = mapPos(targetPosRaw);
      if (!symbol || !targetOffset || !targetPos) continue;
      pointerTargets.push({
        symbol,
        target: `${targetOffset}.${targetPos}`,
      });
    }

    const gloss = (glossRaw ?? "").trim();
    const examples = [...gloss.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.trim()).filter(Boolean);
    rows.push({
      id,
      pos: rowPos,
      lemmas,
      gloss,
      examples,
      pointerTargets,
    });
  }

  return rows.map((row) => {
    const hypernyms = row.pointerTargets.filter((p) => p.symbol === "@").map((p) => p.target);
    const hyponyms = row.pointerTargets.filter((p) => p.symbol === "~").map((p) => p.target);
    const similarTo = row.pointerTargets.filter((p) => p.symbol === "&").map((p) => p.target);
    const antonyms = row.pointerTargets.filter((p) => p.symbol === "!").map((p) => p.target);
    return {
      id: row.id,
      pos: row.pos,
      lemmas: sortedUnique(row.lemmas),
      gloss: row.gloss,
      examples: sortedUnique(row.examples),
      hypernyms: sortedUnique(hypernyms),
      hyponyms: sortedUnique(hyponyms),
      similarTo: sortedUnique(similarTo),
      antonyms: sortedUnique(antonyms),
    };
  });
}

export function buildFromDictDir(dictDir: string): WordNetMiniPayload {
  const root = resolve(dictDir);
  const rows = [
    ...parseWordNetDataFile(resolve(root, "data.noun"), "n"),
    ...parseWordNetDataFile(resolve(root, "data.verb"), "v"),
    ...parseWordNetDataFile(resolve(root, "data.adj"), "a"),
    ...parseWordNetDataFile(resolve(root, "data.adv"), "r"),
  ];
  return canonicalize({
    version: 1,
    synsets: rows,
  });
}

export function loadPayload(dictDir?: string, inJson?: string): WordNetMiniPayload {
  if (inJson) {
    return canonicalize(JSON.parse(readFileSync(resolve(inJson), "utf8")) as WordNetMiniPayload);
  }
  if (dictDir) {
    return buildFromDictDir(dictDir);
  }
  throw new Error("provide --dict-dir <path-to-wordnet-dict> or --in-json <path>");
}

export function packPayload(payload: WordNetMiniPayload): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(canonicalize(payload)));
  const header = new Uint8Array(MAGIC.length + 4);
  header.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(header.buffer).setUint32(MAGIC.length, jsonBytes.length, true);
  const out = new Uint8Array(header.length + jsonBytes.length);
  out.set(header, 0);
  out.set(jsonBytes, header.length);
  return out;
}

function sha256Hex(data: Uint8Array): string {
  const h = createHash("sha256");
  h.update(data);
  return h.digest("hex");
}

export function writePacked(
  payload: WordNetMiniPayload,
  outPath: string,
  source: string,
): { outPath: string; manifest: WordNetPackManifest } {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  const packed = packPayload(payload);
  writeFileSync(target, packed);
  const manifest: WordNetPackManifest = {
    algorithm: "sha256",
    sha256: sha256Hex(packed),
    bytes: packed.length,
    synset_count: payload.synsets.length,
    source,
  };
  return { outPath: target, manifest };
}

export function writeManifest(path: string, manifest: WordNetPackManifest): string {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return target;
}

function main() {
  const args = parseArgs();
  const payload = loadPayload(args.dictDir, args.inJson);
  const source = args.dictDir ? resolve(args.dictDir) : resolve(args.inJson!);
  const packed = writePacked(payload, args.out, source);

  let checksumPath: string | undefined;
  if (args.checksumOut) {
    checksumPath = writeManifest(args.checksumOut, packed.manifest);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: packed.outPath,
        checksum_out: checksumPath ?? null,
        ...packed.manifest,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}
