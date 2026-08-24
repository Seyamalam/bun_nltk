/** NLTK app.wordnet_app — HTTP/Browser GUI not available in JS runtime. */
function err(): never {
  throw new Error(
    "nltk.app.wordnet_app requires HTTP/Browser GUI — not available in JS runtime (use programmatic WordNet API)",
  );
}
export class MyServerHandler {
  constructor(..._a: unknown[]) { err(); }
}
export function wnb(..._a: unknown[]): never { return err(); }
export function startBrowser(..._a: unknown[]): never { return err(); }
export function app(..._a: unknown[]): never { return err(); }
// helpers present in original module
export function get_unique_counter_from_url(..._a: unknown[]): never { return err(); }
