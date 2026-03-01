import { expect, test } from "bun:test";
import { WordNet, type WordNetMiniPayload } from "../index";

const payload: WordNetMiniPayload = {
  version: 1,
  synsets: [
    {
      id: "00001740.n",
      pos: "n",
      lemmas: ["entity"],
      gloss: "entity gloss",
      examples: [],
      hypernyms: [],
      hyponyms: ["00002137.n"],
      similarTo: [],
      antonyms: [],
    },
    {
      id: "00002137.n",
      pos: "n",
      lemmas: ["physical_entity"],
      gloss: "physical entity gloss",
      examples: [],
      hypernyms: ["00001740.n"],
      hyponyms: [],
      similarTo: [],
      antonyms: [],
    },
  ],
};

test("WordNet compatibility APIs support pos+offset and sense-key lookups", () => {
  const wn = new WordNet(payload);
  const syn = wn.synsetFromPosAndOffset("n", 1740);
  expect(syn?.id).toBe("00001740.n");
  expect(wn.synset_from_pos_and_offset("n", "1740")?.id).toBe("00001740.n");
  expect(wn.lemmaNames("00002137.n")).toEqual(["physical_entity"]);

  const keys = wn.senseKeys("entity", "n");
  expect(keys.length).toBeGreaterThan(0);
  expect(wn.synsetFromSenseKey(keys[0]!)?.id).toBe("00001740.n");
  expect(wn.synset_from_sense_key(keys[0]!)?.id).toBe("00001740.n");
});

