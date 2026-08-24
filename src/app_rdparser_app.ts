/** NLTK app.rdparser_app — Tkinter GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.rdparser_app requires Tkinter GUI — not available in JS runtime (use programmatic RecursiveDescentParser API)",
  );
}
export class RecursiveDescentApp {
  constructor(..._a: unknown[]) { err(); }
}
export function app(..._a: unknown[]): never { return err(); }
