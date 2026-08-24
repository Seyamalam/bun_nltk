/** NLTK app.chunkparser_app — Tkinter GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.chunkparser_app requires Tkinter GUI — not available in JS runtime (use programmatic RegexpChunkParser API)",
  );
}
export class RegexpChunkApp {
  constructor(..._a: unknown[]) { err(); }
}
export function app(..._a: unknown[]): never { return err(); }
