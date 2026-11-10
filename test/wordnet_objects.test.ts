import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { loadWordNet } from "../src/wordnet";
import {
  WordNetReader,
  WordNetICCorpusReader,
  information_content,
  path_similarity,
  lch_similarity,
  wup_similarity,
  res_similarity,
  jcn_similarity,
  lin_similarity,
} from "../src/wordnet_objects";

// NLTK 3.10.3 oracle pins — nltk.corpus.wordnet Synset/Lemma object model
// (requires the packed wordnet data; skipped when unavailable)

const wn = loadWordNet();
const reader = new WordNetReader(wn);
const dog = reader.synset("dog.n.01")!;
const cat = reader.synset("cat.n.01")!;
const ok = dog !== null && dog.hypernyms().length > 0;

describe("Synset identity", () => {
  test.skipIf(!ok)("name/pos/offset/lexname/lemma_names", () => {
    expect(dog.name()).toBe("dog.n.01");
    expect(dog.pos()).toBe("n");
    expect(dog.offset()).toBe(2084071);
    expect(dog.lexname()).toBe("noun.animal");
    expect(dog.lemma_names()).toEqual(["dog", "domestic_dog", "canis_familiaris"]);
    expect(String(dog)).toBe("Synset('dog.n.01')");
    expect(dog.definition()).toContain("domesticated");
  });
});

describe("Synset relations", () => {
  test.skipIf(!ok)("hypernyms/hyponyms/similar_tos", () => {
    expect(dog.hypernyms().map((s) => s.name())).toEqual(["domestic_animal.n.01", "canine.n.02"]);
    expect(dog.hyponyms().length).toBeGreaterThan(0);
  });
});

describe("hypernym graph", () => {
  test.skipIf(!ok)("hypernym_paths are root-first", () => {
    const paths = dog.hypernym_paths();
    expect(paths.length).toBe(2);
    expect(paths[0]!.map((s) => s.name())).toEqual([
      "entity.n.01", "physical_entity.n.01", "object.n.01", "whole.n.02",
      "living_thing.n.01", "organism.n.01", "animal.n.01",
      "domestic_animal.n.01", "dog.n.01",
    ]);
  });

  test.skipIf(!ok)("lowest_common_hypernyms", () => {
    expect(dog.lowest_common_hypernyms(cat).map((s) => s.name())).toEqual(["carnivore.n.01"]);
  });

  test.skipIf(!ok)("root_hypernyms + max/min depth + hypernym_distances", () => {
    expect(dog.root_hypernyms().map((s) => s.name())).toEqual(["entity.n.01"]);
    expect(dog.max_depth()).toBe(13);
    expect(dog.min_depth()).toBe(8);
    expect(dog.hypernymDistances().map(([, d]) => d).sort((a, b) => a - b).slice(0, 5))
      .toEqual([0, 1, 1, 2, 2]);
  });

  test.skipIf(!ok)("common_hypernyms contains oracle set", () => {
    const names = new Set(dog.common_hypernyms(cat).map((s) => s.name()));
    for (const n of ["placental.n.01", "carnivore.n.01", "vertebrate.n.01", "organism.n.01", "object.n.01", "entity.n.01"]) {
      expect(names.has(n)).toBe(true);
    }
  });
});

describe("similarity", () => {
  test.skipIf(!ok)("path/lch/wup oracle values", () => {
    expect(dog.shortest_path_distance(cat)).toBe(4);
    expect(dog.path_similarity(cat)).toBe(0.2);
    expect(Math.round(dog.wup_similarity(cat)! * 1e6) / 1e6).toBe(0.857143);
    expect(Math.round(dog.lch_similarity(cat)! * 1e6) / 1e6).toBe(2.028148);
  });

  test.skipIf(!ok)("simulate_root fake root paths", () => {
    const bark = reader.synset("bark.v.01")!;
    const hungry = reader.synset("hungry.a.01")!;
    const walk = reader.synset("walk.v.01")!;
    const run = reader.synset("run.v.02")!;
    expect(dog.lowest_common_hypernyms(bark).map((s) => s.name())).toEqual([]);
    expect(dog.lowest_common_hypernyms(bark, true).map((s) => s.name())).toEqual(["*ROOT*"]);
    expect(dog.shortest_path_distance(bark)).toBeNull();
    expect(dog.shortest_path_distance(bark, true)).toBe(14);
    expect([...dog.hypernym_distances(0, true)].filter(([s]) => s.name() === "*ROOT*").map(([, d]) => d)).toEqual([14]);
    expect([...dog.hypernym_distances()].filter(([s]) => s.name() === "entity.n.01").map(([, d]) => d).sort((a, b) => a - b)).toEqual([8, 13]);
    expect(dog.wup_similarity(bark)).toBe(0.125);
    expect(dog.wup_similarity(hungry)).toBeCloseTo(1 / 6, 12);
    expect(Math.round(walk.lch_similarity(run)! * 1e6) / 1e6).toBe(1.648659);
    expect(dog.lch_similarity(dog)).toBeCloseTo(3.6375861597263857, 12);
    expect(() => dog.lch_similarity(bark)).toThrowError(/requires Synset\('dog\.n\.01'\) and Synset\('bark\.v\.01'\) to have the same part of speech/);
  });

  test.skipIf(!ok)("ic-based similarities match ic-brown.dat oracle", () => {
    const icFile = ".cache/nltk-data/corpora/wordnet_ic/ic-brown.dat";
    let ic: ReturnType<WordNetICCorpusReader["ic"]> | null = null;
    try {
      ic = new WordNetICCorpusReader(".cache/nltk-data/corpora/wordnet_ic").ic("ic-brown.dat");
    } catch {
      ic = null;
    }
    if (ic === null || !existsSync(icFile)) return;
    expect(information_content(dog, ic)).toBe(9.006014398918229);
    expect(information_content(cat, ic)).toBe(9.040649895580986);
    expect(dog.res_similarity(cat, ic)).toBe(7.911666509036577);
    expect(dog.jcn_similarity(cat, ic)).toBe(0.4497755285516739);
    expect(dog.lin_similarity(cat, ic)).toBe(0.8768009843733973);
    expect(dog.lin_similarity(dog, ic)).toBe(1);
    expect(dog.jcn_similarity(dog, ic)).toBe(1e300);
    expect(path_similarity(dog, cat)).toBe(0.2);
    expect(lch_similarity(dog, cat)).toBeCloseTo(2.0281482472922856, 12);
    expect(wup_similarity(dog, cat)).toBe(0.8571428571428571);
    expect(res_similarity(dog, cat, ic)).toBe(7.911666509036577);
    expect(jcn_similarity(dog, cat, ic)).toBe(0.4497755285516739);
    expect(lin_similarity(dog, cat, ic)).toBe(0.8768009843733973);
    expect(() => information_content(dog, { v: ic.v })).toThrowError(
      /Information content file has no entries for part-of-speech: n/,
    );
    expect(() => dog.res_similarity(reader.synset("bark.v.01")!, ic)).toThrowError(/least common subsumer/);
  });
});

describe("Lemma", () => {
  test.skipIf(!ok)("name/synset/key/repr/antonyms", () => {
    const dogLemma = dog.lemmas()[0]!;
    expect(dogLemma.name()).toBe("dog");
    expect(dogLemma.key()).toBe("dog%1:05:00::");
    expect(String(dogLemma)).toBe("Lemma('dog.n.01.dog')");
    expect(dogLemma.lang()).toBe("eng");
    const good = reader.lemmas("good", "a")[0]!;
    expect(good.antonyms().map((l) => l.name())).toEqual(["bad"]);
  });
});

describe("reader lookups", () => {
  test.skipIf(!ok)("synsets uses index.<pos> sense order", () => {
    expect(reader.synsets("dog", "n").map((s) => s.name()).slice(0, 5)).toEqual([
      "dog.n.01", "frump.n.01", "dog.n.03", "cad.n.01", "frank.n.02",
    ]);
  });
});
