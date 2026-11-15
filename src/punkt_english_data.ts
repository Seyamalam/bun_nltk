// Browser-bundle fallback registry for the default English Punkt model.
// src/index_browser.ts statically imports scripts/data/punkt-english.json so
// the bundler inlines it into index.browser.js; node/bun paths load the
// shipped models/punkt-english.json.br instead and never touch this.
export let englishJsonFallback: unknown = null;
export function _setEnglishJsonFallback(v: unknown): void { englishJsonFallback = v; }
