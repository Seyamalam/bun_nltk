// NLTK twitter.twitterclient — shim (requires twython)
// Original: nltk/twitter/twitterclient.py

function unavailable(name: string): never {
  throw new Error(`${name} requires twython/Twitter API — not available in JS (use fetch() with Twitter API v2)`);
}

export class Streamer { constructor(..._a: unknown[]) { unavailable("twitter.twitterclient.Streamer"); } }
export class Query { constructor(..._a: unknown[]) { unavailable("twitter.twitterclient.Query"); } }
export class Twitter { constructor(..._a: unknown[]) { unavailable("twitter.twitterclient.Twitter"); } }
export class TweetViewer { constructor(..._a: unknown[]) { unavailable("twitter.twitterclient.TweetViewer"); } }
export class TweetWriter { constructor(..._a: unknown[]) { unavailable("twitter.twitterclient.TweetWriter"); } }
