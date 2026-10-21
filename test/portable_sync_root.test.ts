import { expect, test } from "bun:test";

test("bundled Node root loads WASM for synchronous compatibility APIs", () => {
  const rootUrl = new URL("../dist/portable/index.node.js", import.meta.url).href;
  const child = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    const api = await import(${JSON.stringify(rootUrl)});
    const rows = [[{x:"a"},"A"],[{x:"b"},"B"]];
    for (const Classifier of [api.NaiveBayesClassifier, api.DecisionTreeClassifier, api.MaxentClassifier]) {
      const model = Classifier.train(rows);
      try { assert.equal(model.classify({x:"a"}), "A"); }
      finally { model.dispose(); }
    }
    assert.equal(api.editDistance("kitten", "sitting"), 3);
    assert.deepEqual(api.editDistanceAlign("😀", "😀x"), [[0,0],[1,1],[1,2]]);
  `], { stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  expect(new TextDecoder().decode(child.stderr)).toBe("");
  expect(child.exitCode).toBe(0);
});
