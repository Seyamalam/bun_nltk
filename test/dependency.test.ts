import { expect, test } from "bun:test";
import { dependencyParse, dependencyParseText } from "../index";

test("dependency parser sets verb root and subject/object arcs", () => {
  const parsed = dependencyParse(["alice", "likes", "music"], ["NN", "VBZ", "NN"]);
  expect(parsed.root).toBe(1);
  expect(parsed.arcs).toContainEqual({ head: 1, dep: 0, relation: "nsubj" });
  expect(parsed.arcs).toContainEqual({ head: 1, dep: 2, relation: "obj" });
});

test("dependencyParseText tokenizes and produces connected arcs", () => {
  const parsed = dependencyParseText("Alice quickly likes jazz.");
  expect(parsed.tokens.length).toBeGreaterThan(0);
  expect(parsed.root).toBeGreaterThanOrEqual(0);
  expect(parsed.arcs.length).toBe(parsed.tokens.length - 1);
});
