/** NLTK app.srparser_app — Tkinter GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.srparser_app requires Tkinter GUI — not available in JS runtime (use programmatic ShiftReduceParser API)",
  );
}
export class ShiftReduceApp {
  constructor(..._a: unknown[]) { err(); }
}
export function app(..._a: unknown[]): never { return err(); }
