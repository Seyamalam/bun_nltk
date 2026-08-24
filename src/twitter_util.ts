// NLTK twitter.util — shim (requires twython)
// Original: nltk/twitter/util.py

function unavailable(name: string): never {
  throw new Error(`${name} requires twython — not available in JS`);
}

export function credsfromfile(..._a: unknown[]): never { return unavailable("twitter.util.credsfromfile"); }

export class Authenticate {
  credsFile = "credentials.txt";
  credsFullpath: string | null = null;
  oauth: Record<string, string> = {};
  twitterDir: string | null = null;
  credsSubdir: string | null = null;
  constructor(..._a: unknown[]) { /* shim: no-op */ }
  loadCreds(..._a: unknown[]): never { return unavailable("twitter.util.Authenticate.load_creds"); }
  saveCreds(..._a: unknown[]): never { return unavailable("twitter.util.Authenticate.save_creds"); }
}
