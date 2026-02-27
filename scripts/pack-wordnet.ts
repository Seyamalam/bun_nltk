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

type WordNetMiniPayload = {
  version: number;
  synsets: SynsetRow[];
};

const MAGIC = "BNWN1";

function normalizeLemma(lemma: string): string {
  return lemma.toLowerCase().replace(/\s+/g, "_");
}

function parseArgs(): { dictDir?: string; inJson?: string; out: string } {
  const args = process.argv.slice(2);
  let dictDir: string | undefined;
  let inJson: string | undefined;
  let out = "models/wordnet_full.bin";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--dict-dir") dictDir = args[++i];
    else if (arg === "--in-json") inJson = args[++i];
    else if (arg === "--out") out = args[++i] ?? out;
  }
  return { dictDir, inJson, out };
}

function mapPos(raw: string): Pos | null {
  if (raw === "n") return "n";
  if (raw === "v") return "v";
  if (raw === "a" || raw === "s") return "a";
  if (raw === "r") return "r";
  return null;
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
      cursor += 1; // lex_id
      if (!lemma) continue;
      lemmas.push(normalizeLemma(lemma.replace(/_/g, " ")));
    }

    const pCnt = Number(parts[cursor++] ?? "0");
    const pointerTargets: Array<{ symbol: string; target: string }> = [];
    for (let i = 0; i < pCnt; i += 1) {
      const symbol = parts[cursor++] ?? "";
      const targetOffset = parts[cursor++] ?? "";
      const targetPosRaw = parts[cursor++] ?? "";
      cursor += 1; // source/target
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
      lemmas: [...new Set(row.lemmas)],
      gloss: row.gloss,
      examples,
      hypernyms: [...new Set(hypernyms)],
      hyponyms: [...new Set(hyponyms)],
      similarTo: [...new Set(similarTo)],
      antonyms: [...new Set(antonyms)],
    };
  });
}

function buildFromDictDir(dictDir: string): WordNetMiniPayload {
  const root = resolve(dictDir);
  const rows = [
    ...parseWordNetDataFile(resolve(root, "data.noun"), "n"),
    ...parseWordNetDataFile(resolve(root, "data.verb"), "v"),
    ...parseWordNetDataFile(resolve(root, "data.adj"), "a"),
    ...parseWordNetDataFile(resolve(root, "data.adv"), "r"),
  ];
  return {
    version: 1,
    synsets: rows,
  };
}

function loadPayload(dictDir?: string, inJson?: string): WordNetMiniPayload {
  if (inJson) {
    return JSON.parse(readFileSync(resolve(inJson), "utf8")) as WordNetMiniPayload;
  }
  if (dictDir) {
    return buildFromDictDir(dictDir);
  }
  throw new Error("provide --dict-dir <path-to-wordnet-dict> or --in-json <path>");
}

function writePacked(payload: WordNetMiniPayload, outPath: string): void {
  const target = resolve(outPath);
  mkdirSync(dirname(target), { recursive: true });
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const header = new Uint8Array(MAGIC.length + 4);
  header.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(header.buffer).setUint32(MAGIC.length, jsonBytes.length, true);
  const out = new Uint8Array(header.length + jsonBytes.length);
  out.set(header, 0);
  out.set(jsonBytes, header.length);
  writeFileSync(target, out);
}

function main() {
  const args = parseArgs();
  const payload = loadPayload(args.dictDir, args.inJson);
  writePacked(payload, args.out);
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: resolve(args.out),
        synset_count: payload.synsets.length,
      },
      null,
      2,
    ),
  );
}

main();

