export {
  countNgramsAscii,
  countTokensAscii,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  nativeLibraryPath,
  ngramFreqDistHashAscii,
  tokenFreqDistHashAscii,
} from "./src/native";

export {
  countNgramsAscii as countNgramsAsciiJs,
  countTokensAscii as countTokensAsciiJs,
  countUniqueNgramsAscii as countUniqueNgramsAsciiJs,
  countUniqueTokensAscii as countUniqueTokensAsciiJs,
  hashNgram,
  hashTokenAscii,
  ngramFreqDistHashAscii as ngramFreqDistHashAsciiJs,
  tokenFreqDistHashAscii as tokenFreqDistHashAsciiJs,
  tokenizeAscii,
} from "./src/reference";
