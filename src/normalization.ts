import { normalizeTokensAsciiNative, porterStemAscii } from "./native";
import { normalizeTokensUnicode } from "./reference";

export type NormalizeOptions = {
  removeStopwords?: boolean;
  preferNativeAscii?: boolean;
  stem?: boolean;
};

function isAscii(text: string): boolean {
  return /^[\x00-\x7F]*$/.test(text);
}

export function normalizeTokens(text: string, options: NormalizeOptions = {}): string[] {
  const removeStopwords = options.removeStopwords ?? true;
  const preferNativeAscii = options.preferNativeAscii ?? true;
  const stem = options.stem ?? false;

  const base =
    preferNativeAscii && isAscii(text)
      ? normalizeTokensAsciiNative(text, removeStopwords)
      : normalizeTokensUnicode(text, removeStopwords);

  if (!stem) return base;
  return base.map((token) => (isAscii(token) ? porterStemAscii(token) : token));
}
