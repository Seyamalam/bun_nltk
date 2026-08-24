// NLTK twitter.api — shim + lightweight timezone helper
// Original: nltk/twitter/api.py

export class LocalTimezoneOffsetWithUTC {
  STDOFFSET = 0;
  DSTOFFSET = 0;
  utcoffset(_dt?: unknown): number { return 0; }
  toString(): string { return "LocalTimezoneOffsetWithUTC"; }
}

export const LOCAL = new LocalTimezoneOffsetWithUTC();

function unavailable(name: string): never {
  throw new Error(`${name} requires Twitter API handler — not available in JS`);
}

export class BasicTweetHandler {
  limit: number;
  counter = 0;
  constructor(limit = 20) { this.limit = limit; }
  handle(_tweet: unknown): void { unavailable("twitter.api.BasicTweetHandler.handle"); }
  onExit(): void { unavailable("twitter.api.BasicTweetHandler.onExit"); }
}

export class TweetHandlerI extends BasicTweetHandler {}
