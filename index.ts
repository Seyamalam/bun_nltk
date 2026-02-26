export {
  countNgramsAscii,
  countTokensAscii,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  ngramsAsciiNative,
  nativeLibraryPath,
  ngramFreqDistHashAscii,
  topPmiBigramsAscii,
  tokenizeAsciiNative,
  tokenFreqDistHashAscii,
} from "./src/native";

export {
  countNgramsAscii as countNgramsAsciiJs,
  countTokensAscii as countTokensAsciiJs,
  countUniqueNgramsAscii as countUniqueNgramsAsciiJs,
  countUniqueTokensAscii as countUniqueTokensAsciiJs,
  hashNgram,
  hashTokenAscii,
  ngramsAscii,
  ngramFreqDistHashAscii as ngramFreqDistHashAsciiJs,
  topPmiBigramsAscii as topPmiBigramsAsciiJs,
  tokenFreqDistHashAscii as tokenFreqDistHashAsciiJs,
  tokenizeAscii,
} from "./src/reference";
