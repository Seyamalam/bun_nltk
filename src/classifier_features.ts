/** Text feature contract shared with the NLTK classifier baselines. */
export function textCountFeatures(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/[A-Za-z0-9']+/g)) {
    const token = match[0].toLowerCase();
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}
/** DictionaryProbDist.max breaks equal-probability ties by greatest label. */
export const descendingLabel = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
