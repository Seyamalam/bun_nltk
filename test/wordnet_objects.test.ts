import { describe, expect, test } from "bun:test";
import { loadWordNet } from "../src/wordnet";
import { WordNetReader } from "../src/wordnet_objects";

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

  test.skipIf(!ok)("ic-based similarities require an IC mapping", () => {
    expect(() => dog.res_similarity(cat, {})).toThrow(/information content/);
    expect(() => dog.jcn_similarity(cat, {})).toThrow(/information content/);
    expect(() => dog.lin_similarity(cat, {})).toThrow(/information content/);
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
