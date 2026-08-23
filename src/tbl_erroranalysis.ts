/**
 * TBL error analysis (port of nltk.tbl.erroranalysis).
 *
 * Returns a human-readable list of tagging errors comparing a gold corpus
 * to a tagger's output.
 */

export type TaggedToken = [word: string, tag: string];
export type TaggedSentence = TaggedToken[];

/**
 * Returns lines describing every tagging mismatch, plus a header line.
 * Port of nltk.tbl.erroranalysis.error_list.
 */
export function errorList(
  trainSents: TaggedSentence[],
  testSents: TaggedSentence[]
): string[] {
  const header =
    `${"left context".padStart(25)} | ${"word/test->gold".padStart(11).padEnd(22)} | ${"right context"}
` +
    "-".repeat(26) + "+" + "-".repeat(24) + "+" + "-".repeat(26);
  const errors: string[] = [header];
  for (let si = 0; si < trainSents.length; si++) {
    const trainSent = trainSents[si]!;
    const testSent = testSents[si]!;
    for (let wi = 0; wi < trainSent.length; wi++) {
      const [word, goldTag] = trainSent[wi]!;
      const testTag = testSent[wi]?.[1] ?? "UNK";
      if (goldTag !== testTag) {
        const left = trainSent.slice(0, wi).map(([w, t]) => `${w}/${t}`).join(" ");
        const right = trainSent.slice(wi + 1).map(([w, t]) => `${w}/${t}`).join(" ");
        const mid = `${word}/${testTag}->${goldTag}`;
        // center mid in 22 chars
        const pad = 22 - mid.length;
        const lp = Math.floor(pad / 2), rp = pad - lp;
        const midCentered = " ".repeat(Math.max(0, lp)) + mid + " ".repeat(Math.max(0, rp));
        errors.push(`${left.slice(-25).padStart(25)} | ${midCentered} | ${right.slice(0, 25)}`);
      }
    }
  }
  return errors;
}
