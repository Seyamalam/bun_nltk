/**
 * Recompress the exported NE chunker models with deterministic Brotli.
 *
 * `scripts/export-nltk-models.py` writes gzip because it must run on a stock
 * Python install. This step produces the smaller `.json.br` assets that the
 * package actually ships; Node's `brotliDecompressSync` reads them lazily.
 * Run it after the exporter and commit the generated files and manifest.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { constants, brotliCompressSync, gunzipSync } from "node:zlib";
import { compactNeModel, type NeModel } from "../src/ne_model_storage.ts";

const root = resolve(import.meta.dir, "..");
const manifestPath = resolve(root, "models/nltk-models.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  files: Record<string, { bytes: number; sha256: string }>;
};

for (const mode of ["multiclass", "binary"] as const) {
  const source = resolve(root, `models/ne-chunker-${mode}.json.gz`);
  const target = `models/ne-chunker-${mode}.json.br`;
  // The exporter retains its safe interchange JSON. The shipped storage only
  // deduplicates mapping strings and implicit dense weight indices; no rounding.
  const model = JSON.parse(gunzipSync(readFileSync(source)).toString()) as NeModel;
  const raw = Buffer.from(JSON.stringify(compactNeModel(model)));
  const compressed = brotliCompressSync(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  writeFileSync(resolve(root, target), compressed);
  manifest.files[target] = {
    bytes: compressed.length,
    sha256: createHash("sha256").update(compressed).digest("hex"),
  };
  delete manifest.files[`models/ne-chunker-${mode}.json.gz`];
  console.log(target, compressed.length);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
