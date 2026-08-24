/** NLTK app package — GUI apps require Tkinter (not available in JS runtime). */
function guiErr(name: string, alt: string): never {
  throw new Error(
    `nltk.app.${name} requires Tkinter GUI — not available in JS runtime (use ${alt})`,
  );
}
export function chartparser(..._args: unknown[]): never {
  return guiErr("chartparser", "programmatic ChartParser API");
}
export function chunkparser(..._args: unknown[]): never {
  return guiErr("chunkparser", "programmatic RegexpChunkParser API");
}
export function collocations(..._args: unknown[]): never {
  return guiErr("collocations", "programmatic collocation APIs");
}
export function concordance(..._args: unknown[]): never {
  return guiErr("concordance", "programmatic ConcordanceIndex API");
}
export function nemo(..._args: unknown[]): never {
  return guiErr("nemo", "programmatic Regexp API");
}
export function rdparser(..._args: unknown[]): never {
  return guiErr("rdparser", "programmatic RecursiveDescentParser API");
}
export function srparser(..._args: unknown[]): never {
  return guiErr("srparser", "programmatic ShiftReduceParser API");
}
export function wordnet(..._args: unknown[]): never {
  return guiErr("wordnet", "programmatic WordNet API");
}
export function wordfreq(..._args: unknown[]): never {
  return guiErr("wordfreq", "programmatic FreqDist API (requires matplotlib in Python)");
}
