// NLTK twitter.common — lightweight port (no twython needed)
// Original: nltk/twitter/common.py

export const HIER_SEPARATOR = ".";

function isComposedKey(field: string): boolean {
  return field.includes(HIER_SEPARATOR);
}

function getKeyValueComposed(field: string): [string, string] {
  const idx = field.indexOf(HIER_SEPARATOR);
  return [field.slice(0, idx), field.slice(idx + 1)];
}

function addFieldToOut(obj: Record<string, unknown>, field: string, out: unknown[]): void {
  if (isComposedKey(field)) {
    const [key, rest] = getKeyValueComposed(field);
    addFieldToOut(obj[key] as Record<string, unknown>, rest, out);
  } else {
    out.push(obj[field]);
  }
}

export function extractFields(tweet: Record<string, unknown>, fields: string[]): unknown[] {
  const out: unknown[] = [];
  for (const field of fields) {
    try { addFieldToOut(tweet, field, out); }
    catch (_e) { throw new Error(`Fatal error when extracting fields. Cannot find field ${field}`); }
  }
  return out;
}

export function json2csv(
  _tweets: unknown,
  _fields: string[],
  _options?: unknown,
): never {
  throw new Error("twitter.common.json2csv requires file I/O — not available in JS (use extractFields() + manual CSV)");
}
