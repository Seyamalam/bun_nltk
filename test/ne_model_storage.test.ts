import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { compactNeModel, expandNeModel, type NeModel } from "../src/ne_model_storage.ts";

for (const mode of ["binary", "multiclass"]) {
  test(`compact ${mode} NE storage preserves every mapping and double weight`, () => {
    const original = JSON.parse(gunzipSync(readFileSync(new URL(`../models/ne-chunker-${mode}.json.gz`, import.meta.url))).toString()) as NeModel;
    const compact = compactNeModel(original);
    const expanded = expandNeModel(JSON.parse(JSON.stringify(compact)));
    expect(expanded.mapping).toEqual(original.mapping.toSorted((a, b) => a[3] - b[3]));
    for (const key of ["labels", "weights", "alwaysOn", "wordlist"] as const) {
      expect(expanded[key]).toEqual(original[key]);
    }
    expect(expanded.weights.every((weight, i) => Object.is(weight, original.weights[i]))).toBe(true);
    const shipped = expandNeModel(JSON.parse(brotliDecompressSync(readFileSync(new URL(`../models/ne-chunker-${mode}.json.br`, import.meta.url))).toString()));
    expect(shipped).toEqual(expanded);
  });
}

test("NE storage keeps legacy models and rejects invalid dense/dictionary indices", () => {
  const model: NeModel = { labels: ["O"], mapping: [["bias", true, "O", 0]], weights: [1], alwaysOn: {}, wordlist: [] };
  expect(expandNeModel(model)).toBe(model);
  expect(expandNeModel(compactNeModel(model))).toEqual(model);
  expect(() => compactNeModel({ ...model, mapping: [["bias", true, "O", 1]] })).toThrow(/dense/);
  expect(() => expandNeModel({ ...compactNeModel(model), mapping: [[99, true, 0]] })).toThrow(/dictionary/);
});
