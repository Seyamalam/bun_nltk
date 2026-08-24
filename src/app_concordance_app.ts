/** NLTK app.concordance_app — Tkinter GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.concordance_app requires Tkinter GUI — not available in JS runtime (use programmatic ConcordanceIndex API)",
  );
}
export class ConcordanceSearchView {
  constructor(..._a: unknown[]) { err(); }
}
export class ConcordanceSearchModel {
  constructor(..._a: unknown[]) { err(); }
}
export function app(..._a: unknown[]): never { return err(); }
