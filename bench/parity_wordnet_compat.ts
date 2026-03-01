import { loadWordNet } from "../index";

function main() {
  const wn = loadWordNet();
  const all = wn.allSynsets();
  const first = all[0];
  if (!first) {
    throw new Error("wordnet compatibility check failed: no synsets loaded");
  }

  const lemmaNames = wn.lemmaNames(first);
  const senseKeys = first.lemmas.length > 0 ? wn.senseKeys(first.lemmas[0]!, first.pos) : [];
  const firstSenseResolved = senseKeys.length > 0 ? wn.synsetFromSenseKey(senseKeys[0]!) : null;

  const offsetMatch = first.id.match(/^(\d{8})\.([nvar])$/);
  const offsetResolved =
    offsetMatch && offsetMatch[2] === first.pos
      ? wn.synsetFromPosAndOffset(first.pos, Number(offsetMatch[1]!))
      : null;

  const parity =
    lemmaNames.length > 0 &&
    (senseKeys.length === 0 || firstSenseResolved !== null) &&
    (!offsetMatch || offsetResolved?.id === first.id);

  if (!parity) {
    throw new Error(
      `wordnet compatibility check failed: ${JSON.stringify({
        first_id: first.id,
        lemmaNames,
        senseKeys,
        firstSenseResolved: firstSenseResolved?.id ?? null,
        offsetResolved: offsetResolved?.id ?? null,
      })}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        first_synset: first.id,
        lemma_count: lemmaNames.length,
        sense_key_count: senseKeys.length,
        offset_mode: Boolean(offsetMatch),
      },
      null,
      2,
    ),
  );
}

main();

