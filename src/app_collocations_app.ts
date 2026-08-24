/** NLTK app.collocations_app — Tkinter GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.collocations_app requires Tkinter GUI — not available in JS runtime (use programmatic BigramCollocationFinder / BigramAssocMeasures API)",
  );
}
export class CollocationsView {
  constructor(..._a: unknown[]) { err(); }
}
export class CollocationsModel {
  constructor(..._a: unknown[]) { err(); }
}
export function app(..._a: unknown[]): never { return err(); }
