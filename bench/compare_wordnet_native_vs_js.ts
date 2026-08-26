import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadWordNetPacked, WordNet, type WordNetMiniPayload } from "../src/wordnet";
import { bootstrapMedianRatio, median } from "./statistics";

function readPackedPayload(path: string): WordNetMiniPayload {
  const bytes = readFileSync(path);
  const magic = new TextDecoder().decode(bytes.subarray(0, 5));
  if (magic !== "BNWN1") throw new Error(`invalid WordNet pack magic: ${magic}`);
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(5, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(9, 9 + length))) as WordNetMiniPayload;
}

function run(model: WordNet, queries: Array<{ word: string }>, rounds: number) {
  const timings: number[] = [];
  let checksum = 0;
  model.lookupBatch(queries);
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now();
    const rows = model.lookupBatch(queries);
    timings.push(performance.now() - started);
    checksum = rows.reduce((sum, row) => sum + row.root.length + row.synsets.length, 0);
  }
  return { median_ms: median(timings), ms_samples: timings, checksum };
}

const queryCount = Math.max(1, Number(process.argv[2] ?? "400"));
const rounds = Math.max(1, Number(process.argv[3] ?? "5"));
const packedPath = resolve(import.meta.dir, "..", "models", "wordnet_full.bin");
if (!existsSync(packedPath)) {
  throw new Error("models/wordnet_full.bin is required; run bun run wordnet:prepare:default");
}

const payload = readPackedPayload(packedPath);
const jsModel = new WordNet(payload);
const nativeModel = loadWordNetPacked(packedPath);
if (nativeModel.constructor.name !== "NativeBackedWordNet") {
  throw new Error("native WordNet backend did not load");
}

const queries = jsModel
  .lemmas()
  .slice(0, queryCount)
  .map((word) => ({ word }));
const native = run(nativeModel, queries, rounds);
const js = run(jsModel, queries, rounds);
if (native.checksum !== js.checksum) throw new Error("native/TypeScript WordNet checksum mismatch");
const speedup = bootstrapMedianRatio(js.ms_samples, native.ms_samples);

console.log(
  JSON.stringify(
    {
      queries: queries.length,
      rounds,
      native,
      js,
      speedup_native_vs_js: speedup.estimate,
      speedup_ci95: speedup,
    },
    null,
    2,
  ),
);
