// NLTK twitter package — shim (requires twython + Twitter API)
// Original: nltk/twitter/__init__.py

function unavailable(name: string): never {
  throw new Error(`${name} requires twython/Twitter API — not available in JS (use fetch() with Twitter API v2 directly)`);
}

export class Streamer { constructor(..._a: unknown[]) { unavailable("twitter.Streamer"); } }
export class Query { constructor(..._a: unknown[]) { unavailable("twitter.Query"); } }
export class Twitter { constructor(..._a: unknown[]) { unavailable("twitter.Twitter"); } }
export class TweetViewer { constructor(..._a: unknown[]) { unavailable("twitter.TweetViewer"); } }
export class TweetWriter { constructor(..._a: unknown[]) { unavailable("twitter.TweetWriter"); } }
export class Authenticate { constructor(..._a: unknown[]) { unavailable("twitter.Authenticate"); } }
export function credsfromfile(..._a: unknown[]): never { return unavailable("twitter.credsfromfile"); }
export function json2csv(..._a: unknown[]): never { return unavailable("twitter.json2csv"); }
