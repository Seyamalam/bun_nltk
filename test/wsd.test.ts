import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { lesk, synsetDefinition, type WsdSynset as Synset } from "../index";
import { loadWordNet } from "../src/wordnet";

const wn = loadWordNet();

test("synsetDefinition strips quoted examples like nltk Synset.definition()", () => {
  const row = wn.synsets("run")[0]!;
  expect(synsetDefinition(row)).toBe(row.gloss.replace(/"[^"]*"/g, "").trim().replace(/^[; ]+|[; ]+$/g, ""));
});

test("lesk disambiguates run toward the verb sense in a computing context", () => {
  const sense = lesk(["the", "computer", "can", "run", "and", "improve", "its", "speed"], "run");
  expect(sense).not.toBeNull();
  expect(sense!.id).toBe("run.v.01");
});

test("lesk filters by pos", () => {
  const adj = lesk(["the", "slow", "computer", "could", "not", "parse", "the", "document"], "slow", "a");
  const verb = lesk(["to", "slow", "the", "speed", "of", "the", "machine"], "slow", "v");
  expect(adj?.id).toBe("slow.a.01");
  expect(verb?.id).toBe("slow.v.01");

  const noMatch = lesk(["the", "dog", "barked"], "dog", "v");
  expect(noMatch).toBeNull();
});

test("lesk returns null when no synsets match", () => {
  expect(lesk(["some", "tokens"], "zzzunknownzzz")).toBeNull();
  expect(lesk(["John", "loves", "Mary"], "loves", undefined, [])).toBeNull();
});

test("lesk accepts explicit synsets and breaks ties by first candidate", () => {
  const a: Synset = {
    id: "alpha.n.01",
    pos: "n",
    lemmas: ["alpha"],
    gloss: "unrelated gloss words here",
    examples: [],
    hypernyms: [],
    hyponyms: [],
    similarTo: [],
    antonyms: [],
  };
  const b: Synset = { ...a, id: "beta.n.01", lemmas: ["beta"] };
  expect(lesk(["alpha", "beta", "gamma"], "alpha", undefined, [a, b])?.id).toBe("alpha.n.01");
  expect(lesk(["alpha", "beta", "gamma"], "alpha", undefined, [b, a])?.id).toBe("beta.n.01");
});

test("lesk overlap counts context tokens against whitespace-split definitions", () => {
  const doc = wn.synsets("document")[0]!;
  const paper = wn.synsets("research_paper")[0] ?? null;
  const sense = lesk(
    ["a", "research", "paper", "is", "a", "written", "document"],
    "document",
    undefined,
    paper ? [doc, paper] : undefined,
  );
  expect(sense).not.toBeNull();
});

test("optional python parity for lesk via nltk.wsd baseline", () => {
  const cases = [
    {
      id: "run_verb_context",
      context: ["the", "computer", "can", "run", "and", "improve", "its", "speed"],
      word: "run",
      pos: null as string | null,
    },
    {
      id: "slow_adjective",
      context: ["the", "slow", "computer", "could", "not", "parse", "the", "document"],
      word: "slow",
      pos: "a" as string | null,
    },
  ];
  const jsSenses = cases.map((c) => lesk(c.context, c.word, c.pos ?? undefined)?.id ?? null);

  const payloadCases = cases.map((c) => ({
    id: c.id,
    context: c.context,
    word: c.word,
    pos: c.pos,
    synsets: wn.synsets(c.word).map((row) => ({ id: row.id, pos: row.pos, gloss: row.gloss })),
  }));
  const proc = Bun.spawnSync(
    [
      "python3",
      "bench/python_wsd_baseline.py",
      "--payload",
      JSON.stringify({ cases: payloadCases }),
    ],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    console.warn("skipping python wsd parity:", new TextDecoder().decode(proc.stderr).trim());
    return;
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    results: Array<{ id: string; sense: string | null }>;
  };
  expect(jsSenses).toEqual(py.results.map((r) => r.sense));
});
