import { resolve } from "node:path";
import { lesk, type Synset } from "../src/wsd";
import { loadWordNet } from "../src/wordnet";

type Case = {
  id: string;
  context: string[];
  word: string;
  pos?: string;
};

function main() {
  const wn = loadWordNet();

  const cases: Array<Case & { synsets: Array<{ id: string; pos: string; gloss: string }> }> = [
    {
      id: "run_verb_context",
      context: ["the", "computer", "can", "run", "and", "improve", "its", "speed"],
      word: "run",
    },
    {
      id: "run_noun_context",
      context: ["a", "quick", "run", "in", "the", "park"],
      word: "runs",
    },
    {
      id: "slow_adjective",
      context: ["the", "slow", "computer", "could", "not", "parse", "the", "document"],
      word: "slow",
      pos: "a",
    },
    {
      id: "slow_verb",
      context: ["to", "slow", "the", "speed", "of", "the", "machine"],
      word: "slow",
      pos: "v",
    },
    {
      id: "quick_speedy",
      context: ["a", "speedy", "and", "fast", "algorithm"],
      word: "quick",
    },
    {
      id: "animal_context",
      context: ["the", "dog", "chased", "the", "cat", "around", "the", "yard"],
      word: "dog",
      pos: "n",
    },
    {
      id: "document_context",
      context: ["a", "research", "paper", "is", "a", "written", "document"],
      word: "document",
    },
    {
      id: "no_match_pos",
      context: ["the", "dog", "barked"],
      word: "dog",
      pos: "v",
    },
    {
      id: "unknown_word",
      context: ["totally", "unrelated", "tokens"],
      word: "zzzunknownzzz",
    },
    {
      id: "tie_first_wins",
      context: ["alpha", "beta", "gamma"],
      word: "model",
    },
  ];

  const jsSenses = cases.map((c) => {
    const sense = lesk(c.context, c.word, c.pos);
    return { id: c.id, sense: sense?.id ?? null };
  });

  const payloadCases = cases.map((c) => ({
    id: c.id,
    context: c.context,
    word: c.word,
    pos: c.pos ?? null,
    synsets: wn.synsets(c.word).map((row: Synset) => ({ id: row.id, pos: row.pos, gloss: row.gloss })),
  }));

  const proc = Bun.spawnSync(
    [
      "python3",
      "bench/python_wsd_baseline.py",
      "--payload",
      JSON.stringify({ cases: payloadCases }),
      "--sanity",
    ],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python wsd baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    results: Array<{ id: string; sense: string | null }>;
    real_wordnet_sanity: Record<string, string | null>;
  };

  const parity = JSON.stringify(jsSenses) === JSON.stringify(py.results);
  if (!parity) {
    throw new Error(
      `wsd parity failed:\njs=${JSON.stringify(jsSenses)}\npy=${JSON.stringify(py.results)}`,
    );
  }

  console.log(JSON.stringify({ parity, cases: cases.length, senses: jsSenses, real_wordnet_sanity: py.real_wordnet_sanity }, null, 2));
}

main();
