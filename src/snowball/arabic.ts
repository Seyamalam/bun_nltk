// Arabic — ported line-for-line from NLTK's nltk/stem/snowball.py
// (The Snowball Arabic light stemmer: Assem Chelli, Abdelkrim Aries,
// Lakhdar Benzahia). NLTK's ArabicStemmer does NOT lowercase its input
// and checks stopwords after pre-normalization.

const VOCALIZATION = /[ًٌٍَُِّْ]/g;
const KASHEEDA = /[ـ]/g;
const ARABIC_PUNCTUATION_MARKS = /[،؛؟]/g;

const LAST_HAMZAT = ["أ", "إ", "آ", "ؤ", "ئ"];
const INITIAL_HAMZAT = /^[آأإ]/;
const WAW_HAMZA = /[ؤ]/g;
const YEH_HAMZA = /[ئ]/g;
const ALEFAT = /[أآإ]/g;

const CHECKS1 = ["كال", "بال", "ال", "لل"];
const CHECKS2 = ["ة", "ات"];

const SUFFIX_NOUN_STEP1A = ["ي", "ك", "ه", "نا", "كم", "ها", "هن", "هم", "كما", "هما"];
const SUFFIX_NOUN_STEP1B = ["ن"];
const SUFFIX_NOUN_STEP2A = ["ا", "ي", "و"];
// NLTK declares this as the string "ات" — iterating it yields each
// character separately, and the strip below removes a fixed 2 chars.
const SUFFIX_NOUN_STEP2B = ["ا", "ت"];
const SUFFIX_NOUN_STEP2C1 = ["ت"];
const SUFFIX_NOUN_STEP2C2 = ["ة"];
const SUFFIX_NOUN_STEP3 = ["ي"];
const SUFFIX_VERB_STEP1 = ["ه", "ك", "ني", "نا", "ها", "هم", "هن", "كم", "كن", "هما", "كما", "كمو"];
const SUFFIX_VERB_STEP2A = ["ت", "ا", "ن", "ي", "نا", "تا", "تن", "ان", "ون", "ين", "تما"];
const SUFFIX_VERB_STEP2B = ["وا", "تم"];
const SUFFIX_VERB_STEP2C = ["و", "تمو"];
const SUFFIX_ALL_ALEF_MAQSURA = ["ى"];

const PREFIX_STEP1 = ["أ", "أأ", "أآ", "أؤ", "أا", "أإ"];
const PREFIX_STEP2A = ["فال", "وال"];
const PREFIX_STEP2B = ["ف", "و"];
const PREFIX_STEP3A_NOUN = ["ال", "لل", "كال", "بال"];
const PREFIX_STEP3B_NOUN = ["ب", "ك", "ل", "بب", "كك"];
const PREFIX_STEP3_VERB = ["سي", "ست", "سن", "سأ"];
const PREFIX_STEP4_VERB = ["يست", "نست", "تست"];

const CONJUGATION_SUFFIX_VERB_1 = ["ه", "ك"];
const CONJUGATION_SUFFIX_VERB_2 = ["ني", "نا", "ها", "هم", "هن", "كم", "كن"];
const CONJUGATION_SUFFIX_VERB_3 = ["هما", "كما", "كمو"];
const CONJUGATION_SUFFIX_VERB_4 = ["ا", "ن", "ي"];
const CONJUGATION_SUFFIX_VERB_PAST = ["نا", "تا", "تن"];
const CONJUGATION_SUFFIX_VERB_PRESENT = ["ان", "ون", "ين"];

const CONJUGATION_SUFFIX_NOUN_1 = ["ي", "ك", "ه"];
const CONJUGATION_SUFFIX_NOUN_2 = ["نا", "كم", "ها", "هن", "هم"];
const CONJUGATION_SUFFIX_NOUN_3 = ["كما", "هما"];

const PREFIXES1 = ["وا", "فا"];
const ARTICLES_3LEN = ["كال", "بال"];
const ARTICLES_2LEN = ["ال", "لل"];
const PREPOSITIONS1 = ["ك", "ل"];
const PREPOSITIONS2 = ["بب", "كك"];

function prefixReplace(original: string, old: string, neu: string): string {
  return neu + original.slice(old.length);
}

interface ArabicState {
  isVerb: boolean;
  isNoun: boolean;
  isDefined: boolean;
  suffixesVerbStep1Success: boolean;
  suffixVerbStep2aSuccess: boolean;
  suffixVerbStep2bSuccess: boolean;
  suffixNounStep2c2Success: boolean;
  suffixNounStep1aSuccess: boolean;
  suffixNounStep2aSuccess: boolean;
  suffixNounStep2bSuccess: boolean;
  suffixeNounStep1bSuccess: boolean;
  prefixStep2aSuccess: boolean;
  prefixStep3aNounSuccess: boolean;
  prefixStep3bNounSuccess: boolean;
}

function normalizePre(token: string): string {
  return token.replace(VOCALIZATION, "").replace(KASHEEDA, "").replace(ARABIC_PUNCTUATION_MARKS, "");
}

function normalizePost(token: string): string {
  for (const hamza of LAST_HAMZAT) {
    if (token.endsWith(hamza)) {
      token = token.slice(0, -hamza.length) + "ء";
      break;
    }
  }
  token = token.replace(INITIAL_HAMZAT, "ا");
  token = token.replace(WAW_HAMZA, "و");
  token = token.replace(YEH_HAMZA, "ي");
  token = token.replace(ALEFAT, "ا");
  return token;
}

function checks1(st: ArabicState, token: string): void {
  for (const prefix of CHECKS1) {
    if (token.startsWith(prefix)) {
      if (ARTICLES_3LEN.includes(prefix) && token.length > 4) {
        st.isNoun = true;
        st.isVerb = false;
        st.isDefined = true;
        break;
      }
      if (ARTICLES_2LEN.includes(prefix) && token.length > 3) {
        st.isNoun = true;
        st.isVerb = false;
        st.isDefined = true;
        break;
      }
    }
  }
}

function checks2(st: ArabicState, token: string): void {
  for (const suffix of CHECKS2) {
    if (token.endsWith(suffix)) {
      if (suffix === "ة" && token.length > 2) {
        st.isNoun = true;
        st.isVerb = false;
        break;
      }
      if (suffix === "ات" && token.length > 3) {
        st.isNoun = true;
        st.isVerb = false;
        break;
      }
    }
  }
}

function suffixVerbStep1(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_VERB_STEP1) {
    if (token.endsWith(suffix)) {
      if (CONJUGATION_SUFFIX_VERB_1.includes(suffix) && token.length >= 4) {
        token = token.slice(0, -1);
        st.suffixesVerbStep1Success = true;
        break;
      }
      if (CONJUGATION_SUFFIX_VERB_2.includes(suffix) && token.length >= 5) {
        token = token.slice(0, -2);
        st.suffixesVerbStep1Success = true;
        break;
      }
      if (CONJUGATION_SUFFIX_VERB_3.includes(suffix) && token.length >= 6) {
        token = token.slice(0, -3);
        st.suffixesVerbStep1Success = true;
        break;
      }
    }
  }
  return token;
}

function suffixVerbStep2a(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_VERB_STEP2A) {
    if (token.endsWith(suffix) && token.length > 3) {
      if (suffix === "ت" && token.length >= 4) {
        token = token.slice(0, -1);
        st.suffixVerbStep2aSuccess = true;
        break;
      }
      if (CONJUGATION_SUFFIX_VERB_4.includes(suffix) && token.length >= 4) {
        token = token.slice(0, -1);
        st.suffixVerbStep2aSuccess = true;
        break;
      }
      if (CONJUGATION_SUFFIX_VERB_PAST.includes(suffix) && token.length >= 5) {
        token = token.slice(0, -2);
        st.suffixVerbStep2aSuccess = true;
        break;
      }
      if (CONJUGATION_SUFFIX_VERB_PRESENT.includes(suffix) && token.length > 5) {
        token = token.slice(0, -2);
        st.suffixVerbStep2aSuccess = true;
        break;
      }
      if (suffix === "تما" && token.length >= 6) {
        token = token.slice(0, -3);
        st.suffixVerbStep2aSuccess = true;
        break;
      }
    }
  }
  return token;
}

function suffixVerbStep2c(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_VERB_STEP2C) {
    if (token.endsWith(suffix)) {
      if (suffix === "تمو" && token.length >= 6) {
        token = token.slice(0, -3);
        break;
      }
      if (suffix === "و" && token.length >= 4) {
        token = token.slice(0, -1);
        break;
      }
    }
  }
  return token;
}

function suffixVerbStep2b(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_VERB_STEP2B) {
    if (token.endsWith(suffix) && token.length >= 5) {
      token = token.slice(0, -2);
      st.suffixVerbStep2bSuccess = true;
      break;
    }
  }
  return token;
}

function suffixNounStep2c2(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP2C2) {
    if (token.endsWith(suffix) && token.length >= 3) {
      token = token.slice(0, -1);
      st.suffixNounStep2c2Success = true;
      break;
    }
  }
  return token;
}

function suffixNounStep1a(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP1A) {
    if (token.endsWith(suffix)) {
      if (CONJUGATION_SUFFIX_NOUN_1.includes(suffix) && token.length >= 4) {
        token = token.slice(0, -1);
        st.suffixNounStep1aSuccess = true;
        break;
      }
      if (CONJUGATION_SUFFIX_NOUN_2.includes(suffix) && token.length >= 5) {
        token = token.slice(0, -2);
        st.suffixNounStep1aSuccess = true;
        break;
      }
      if (CONJUGATION_SUFFIX_NOUN_3.includes(suffix) && token.length >= 6) {
        token = token.slice(0, -3);
        st.suffixNounStep1aSuccess = true;
        break;
      }
    }
  }
  return token;
}

function suffixNounStep2a(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP2A) {
    if (token.endsWith(suffix) && token.length > 4) {
      token = token.slice(0, -1);
      st.suffixNounStep2aSuccess = true;
      break;
    }
  }
  return token;
}

function suffixNounStep2b(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP2B) {
    if (token.endsWith(suffix) && token.length >= 5) {
      token = token.slice(0, -2);
      st.suffixNounStep2bSuccess = true;
      break;
    }
  }
  return token;
}

function suffixNounStep2c1(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP2C1) {
    if (token.endsWith(suffix) && token.length >= 4) {
      token = token.slice(0, -1);
      break;
    }
  }
  return token;
}

function suffixNounStep1b(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP1B) {
    if (token.endsWith(suffix) && token.length > 5) {
      token = token.slice(0, -1);
      st.suffixeNounStep1bSuccess = true;
      break;
    }
  }
  return token;
}

function suffixNounStep3(st: ArabicState, token: string): string {
  for (const suffix of SUFFIX_NOUN_STEP3) {
    if (token.endsWith(suffix) && token.length >= 3) {
      token = token.slice(0, -1);
      break;
    }
  }
  return token;
}

function suffixAllAlefMaqsura(token: string): string {
  for (const suffix of SUFFIX_ALL_ALEF_MAQSURA) {
    if (token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length) + "ي";
    }
  }
  return token;
}

function prefixStep1(token: string): string {
  for (const prefix of PREFIX_STEP1) {
    if (token.startsWith(prefix) && token.length > 3) {
      if (prefix === "أأ") {
        token = prefixReplace(token, prefix, "أ");
        break;
      } else if (prefix === "أآ") {
        token = prefixReplace(token, prefix, "آ");
        break;
      } else if (prefix === "أؤ") {
        token = prefixReplace(token, prefix, "ؤ");
        break;
      } else if (prefix === "أا") {
        token = prefixReplace(token, prefix, "ا");
        break;
      } else if (prefix === "أإ") {
        token = prefixReplace(token, prefix, "إ");
        break;
      }
    }
  }
  return token;
}

function prefixStep2a(st: ArabicState, token: string): string {
  for (const prefix of PREFIX_STEP2A) {
    if (token.startsWith(prefix) && token.length > 5) {
      token = token.slice(prefix.length);
      st.prefixStep2aSuccess = true;
      break;
    }
  }
  return token;
}

function prefixStep2b(token: string): string {
  for (const prefix of PREFIX_STEP2B) {
    if (token.startsWith(prefix) && token.length > 3) {
      if (!PREFIXES1.includes(token.slice(0, 2))) {
        token = token.slice(prefix.length);
        break;
      }
    }
  }
  return token;
}

function prefixStep3aNoun(st: ArabicState, token: string): string {
  for (const prefix of PREFIX_STEP3A_NOUN) {
    if (token.startsWith(prefix)) {
      if (ARTICLES_2LEN.includes(prefix) && token.length > 4) {
        token = token.slice(prefix.length);
        st.prefixStep3aNounSuccess = true;
        break;
      }
      if (ARTICLES_3LEN.includes(prefix) && token.length > 5) {
        token = token.slice(prefix.length);
        break;
      }
    }
  }
  return token;
}

function prefixStep3bNoun(st: ArabicState, token: string): string {
  for (const prefix of PREFIX_STEP3B_NOUN) {
    if (token.startsWith(prefix)) {
      if (token.length > 3) {
        if (prefix === "ب") {
          token = token.slice(prefix.length);
          st.prefixStep3bNounSuccess = true;
          break;
        }
        if (PREPOSITIONS2.includes(prefix)) {
          token = prefixReplace(token, prefix, prefix[1]!);
          st.prefixStep3bNounSuccess = true;
          break;
        }
      }
      if (PREPOSITIONS1.includes(prefix) && token.length > 4) {
        token = token.slice(prefix.length);
        st.prefixStep3bNounSuccess = true;
        break;
      }
    }
  }
  return token;
}

function prefixStep3Verb(token: string): string {
  for (const prefix of PREFIX_STEP3_VERB) {
    if (token.startsWith(prefix) && token.length > 4) {
      token = prefixReplace(token, prefix, prefix[1]!);
      break;
    }
  }
  return token;
}

function prefixStep4Verb(st: ArabicState, token: string): string {
  for (const prefix of PREFIX_STEP4_VERB) {
    if (token.startsWith(prefix) && token.length > 4) {
      token = prefixReplace(token, prefix, "است");
      st.isVerb = true;
      st.isNoun = false;
      break;
    }
  }
  return token;
}

export function stemArabic(word: string, stopwords?: ReadonlySet<string>): string {
  const st: ArabicState = {
    isVerb: true,
    isNoun: true,
    isDefined: false,
    suffixesVerbStep1Success: false,
    suffixVerbStep2aSuccess: false,
    suffixVerbStep2bSuccess: false,
    suffixNounStep2c2Success: false,
    suffixNounStep1aSuccess: false,
    suffixNounStep2aSuccess: false,
    suffixNounStep2bSuccess: false,
    suffixeNounStep1bSuccess: false,
    prefixStep2aSuccess: false,
    prefixStep3aNounSuccess: false,
    prefixStep3bNounSuccess: false,
  };

  let modifiedWord = word;
  checks1(st, modifiedWord);
  checks2(st, modifiedWord);
  modifiedWord = normalizePre(modifiedWord);
  if ((stopwords !== undefined && stopwords.has(modifiedWord)) || modifiedWord.length <= 2) {
    return modifiedWord;
  }
  if (st.isVerb) {
    modifiedWord = suffixVerbStep1(st, modifiedWord);
    if (st.suffixesVerbStep1Success) {
      modifiedWord = suffixVerbStep2a(st, modifiedWord);
      if (!st.suffixVerbStep2aSuccess) {
        modifiedWord = suffixVerbStep2c(st, modifiedWord);
      }
    } else {
      modifiedWord = suffixVerbStep2b(st, modifiedWord);
      if (!st.suffixVerbStep2bSuccess) {
        modifiedWord = suffixVerbStep2a(st, modifiedWord);
      }
    }
  }
  if (st.isNoun) {
    modifiedWord = suffixNounStep2c2(st, modifiedWord);
    if (!st.suffixNounStep2c2Success) {
      if (!st.isDefined) {
        modifiedWord = suffixNounStep1a(st, modifiedWord);
        modifiedWord = suffixNounStep2a(st, modifiedWord);
        if (!st.suffixNounStep2aSuccess) {
          modifiedWord = suffixNounStep2b(st, modifiedWord);
        }
        if (!st.suffixNounStep2bSuccess && !st.suffixNounStep2aSuccess) {
          modifiedWord = suffixNounStep2c1(st, modifiedWord);
        }
      } else {
        modifiedWord = suffixNounStep1b(st, modifiedWord);
        if (st.suffixeNounStep1bSuccess) {
          modifiedWord = suffixNounStep2a(st, modifiedWord);
          if (!st.suffixNounStep2aSuccess) {
            modifiedWord = suffixNounStep2b(st, modifiedWord);
          }
          if (!st.suffixNounStep2bSuccess && !st.suffixNounStep2aSuccess) {
            modifiedWord = suffixNounStep2c1(st, modifiedWord);
          }
        } else {
          if (!st.isDefined) {
            modifiedWord = suffixNounStep2a(st, modifiedWord);
          }
          modifiedWord = suffixNounStep2b(st, modifiedWord);
        }
      }
    }
    modifiedWord = suffixNounStep3(st, modifiedWord);
  }
  if (!st.isNoun && st.isVerb) {
    modifiedWord = suffixAllAlefMaqsura(modifiedWord);
  }
  modifiedWord = prefixStep1(modifiedWord);
  modifiedWord = prefixStep2a(st, modifiedWord);
  if (!st.prefixStep2aSuccess) {
    modifiedWord = prefixStep2b(modifiedWord);
  }
  modifiedWord = prefixStep3aNoun(st, modifiedWord);
  if (!st.prefixStep3aNounSuccess && st.isNoun) {
    modifiedWord = prefixStep3bNoun(st, modifiedWord);
  } else {
    if (!st.prefixStep3bNounSuccess && st.isVerb) {
      modifiedWord = prefixStep3Verb(modifiedWord);
      modifiedWord = prefixStep4Verb(st, modifiedWord);
    }
  }
  modifiedWord = normalizePost(modifiedWord);
  return modifiedWord;
}
