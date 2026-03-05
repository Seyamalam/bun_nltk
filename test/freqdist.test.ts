import { expect, test } from "bun:test";
import { ConditionalFreqDist, FreqDist } from "../index";

test("FreqDist matches core NLTK frequency semantics", () => {
  const dist = new FreqDist("abbbc");

  expect(dist.N()).toBe(5);
  expect(dist.B()).toBe(3);
  expect(dist.get("a")).toBe(1);
  expect(dist.count("b")).toBe(3);
  expect(dist.freq("b")).toBe(3 / 5);
  expect(dist.max()).toBe("b");
  expect(dist.hapaxes()).toEqual(["a", "c"]);
  expect(dist.Nr(1)).toBe(2);
  expect(dist.Nr(3)).toBe(1);
  expect(dist.Nr(0, 5)).toBe(2);
  expect([...dist]).toEqual(["b", "a", "c"]);
  expect(dist.pformat()).toBe('FreqDist({"b": 3, "a": 1, "c": 1})');
  expect(dist.toString()).toBe("<FreqDist with 3 samples and 5 outcomes>");
});

test("FreqDist uses structural keys for tuple-like samples", () => {
  const dist = new FreqDist<Array<string>>([
    ["new", "york"],
    ["new", "york"],
    ["san", "francisco"],
  ]);

  expect(dist.get(["new", "york"])).toBe(2);
  expect(dist.get(["san", "francisco"])).toBe(1);
  expect(dist.max()).toEqual(["new", "york"]);
});

test("FreqDist arithmetic matches NLTK Counter-style behavior", () => {
  const left = new FreqDist("abbb");
  const right = new FreqDist("bcc");

  expect(left.add(right).mostCommon()).toEqual([
    ["b", 4],
    ["c", 2],
    ["a", 1],
  ]);
  expect(new FreqDist("abbbc").subtract(new FreqDist("bccd")).mostCommon()).toEqual([
    ["b", 2],
    ["a", 1],
  ]);
  expect(left.union(right).mostCommon()).toEqual([
    ["b", 3],
    ["c", 2],
    ["a", 1],
  ]);
  expect(left.intersection(right).mostCommon()).toEqual([["b", 1]]);
  expect(new FreqDist("abc").isSubsetOf(new FreqDist("aabc"))).toBeTrue();
  expect(new FreqDist("aabc").isSupersetOf(new FreqDist("abc"))).toBeTrue();
});

test("FreqDist native-backed ASCII builder matches tokenizer expectations", () => {
  const dist = FreqDist.fromTextAscii("Apple apple APPLE banana BANANA");
  expect(dist.mostCommon()).toEqual([
    ["apple", 3],
    ["banana", 2],
  ]);
});

test("ConditionalFreqDist groups samples by condition and auto-vivifies", () => {
  const cfd = new ConditionalFreqDist<number, string>([
    [3, "the"],
    [3, "the"],
    [3, "dog"],
    [4, "runs"],
  ]);

  expect(cfd.conditions()).toEqual([3, 4]);
  expect(cfd.N()).toBe(4);
  expect(cfd.get(3).mostCommon()).toEqual([
    ["the", 2],
    ["dog", 1],
  ]);
  expect(cfd.get(5).N()).toBe(0);
  expect(cfd.conditions()).toEqual([3, 4, 5]);
  expect(cfd.toString()).toBe("<ConditionalFreqDist with 3 conditions>");
});

test("ConditionalFreqDist arithmetic matches NLTK-style set operations", () => {
  const left = new ConditionalFreqDist<number, string>([
    [1, "a"],
    [1, "b"],
    [1, "b"],
    [2, "x"],
    [2, "x"],
    [2, "y"],
  ]);
  const right = new ConditionalFreqDist<number, string>([
    [1, "b"],
    [1, "c"],
    [1, "c"],
    [2, "x"],
    [3, "z"],
  ]);

  expect(left.add(right).get(1).mostCommon()).toEqual([
    ["b", 3],
    ["c", 2],
    ["a", 1],
  ]);
  expect(left.subtract(right).get(1).mostCommon()).toEqual([
    ["a", 1],
    ["b", 1],
  ]);
  expect(left.union(right).get(1).mostCommon()).toEqual([
    ["b", 2],
    ["c", 2],
    ["a", 1],
  ]);
  expect(left.intersection(right).get(1).mostCommon()).toEqual([["b", 1]]);
  expect(left.isSubsetOf(left.add(right))).toBeTrue();
});

test("ConditionalFreqDist can build POS-conditioned token counts from ASCII text", () => {
  const cfd = ConditionalFreqDist.fromTaggedTextAscii("dogs bark loudly dogs");
  expect(cfd.get("NN").get("dogs")).toBe(2);
  expect(cfd.get("NN").get("bark")).toBe(1);
  expect(cfd.get("RB").get("loudly")).toBe(1);
});
