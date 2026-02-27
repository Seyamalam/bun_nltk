import { expect, test } from "bun:test";
import { flattenSparseBatch, TextFeatureVectorizer } from "../index";

test("text feature vectorizer builds vocabulary and transforms rows", () => {
  const vec = new TextFeatureVectorizer({ ngramMin: 1, ngramMax: 2, maxFeatures: 64 });
  vec.fit([
    "fast good service",
    "slow bad support",
    "good support and fast updates",
  ]);

  expect(vec.featureCount).toBeGreaterThan(0);
  const row = vec.transform("good fast service");
  expect(row.indices.length).toBeGreaterThan(0);
  expect(row.indices.length).toBe(row.values.length);
});

test("text feature vectorizer serializes and reloads", () => {
  const base = new TextFeatureVectorizer({ ngramMin: 1, ngramMax: 2, maxFeatures: 32 });
  base.fit(["alpha beta", "beta gamma", "alpha gamma beta"]);
  const payload = base.toJSON();
  const loaded = TextFeatureVectorizer.fromJSON(payload);
  const a = base.transform("alpha beta gamma");
  const b = loaded.transform("alpha beta gamma");
  expect([...a.indices]).toEqual([...b.indices]);
  expect([...a.values]).toEqual([...b.values]);
});

test("flattenSparseBatch packs offsets and feature payloads", () => {
  const vec = new TextFeatureVectorizer({ ngramMin: 1, ngramMax: 1, maxFeatures: 32 });
  vec.fit(["one two", "two three"]);
  const rows = vec.transformMany(["one two", "two", "three two"]);
  const flat = flattenSparseBatch(rows);
  expect(flat.docOffsets.length).toBe(rows.length + 1);
  expect(flat.featureIds.length).toBe(flat.featureValues.length);
  expect(flat.docOffsets[0]).toBe(0);
  expect(flat.docOffsets[flat.docOffsets.length - 1]).toBe(flat.featureIds.length);
});
