/**
 * POS tagset mapping (port of nltk.tag.mapping).
 *
 * Maps Penn Treebank / Brown / etc. tags to the Universal tagset (Petrov et al. 2011).
 * Unknown tags map to "X" for universal target, "UNK" otherwise — matching NLTK.
 * Built-in maps for the two tagsets NLTK documents most heavily (en-ptb, en-brown);
 * other tagsets fall back to identity + load stub.
 */

const UNIVERSAL_TAGS = new Set(["VERB","NOUN","PRON","ADJ","ADV","ADP","CONJ","DET","NUM","PRT","X","."]);

const RU_RNC_NEW: Record<string,string> = {
  A:"ADJ","A-PRO":"PRON",ADV:"ADV","ADV-PRO":"PRON",ANUM:"ADJ",CONJ:"CONJ",INTJ:"X",NONLEX:".",NUM:"NUM",PARENTH:"PRT",PART:"PRT",PR:"ADP",PRAEDIC:"PRT","PRAEDIC-PRO":"PRON",S:"NOUN","S-PRO":"PRON",V:"VERB",
};

const EN_PTB: Record<string,string> = {
  CC:"CONJ",CD:"NUM",DT:"DET",EX:"PRON",FW:"X",IN:"ADP",JJ:"ADJ",JJR:"ADJ",JJS:"ADJ",LS:"X",MD:"VERB",
  NN:"NOUN",NNS:"NOUN",NNP:"NOUN",NNPS:"NOUN",PDT:"DET",POS:"PRT",PRP:"PRON",PRP$:"PRON",
  RB:"ADV",RBR:"ADV",RBS:"ADV",RP:"PRT",SYM:"X",TO:"PRT",UH:"X",
  VB:"VERB",VBD:"VERB",VBG:"VERB",VBN:"VERB",VBP:"VERB",VBZ:"VERB",
  WDT:"DET",WP:"PRON",WP$:"PRON",WRB:"ADV",
  "``":".", "''":".", ",":".", ".":".", ":":".", "-LRB-":".", "-RRB-":".", HYPH:".", NFP:".", XX:"X", ADD:"X", AFX:"ADJ",
};

const EN_BROWN: Record<string,string> = {
  ...EN_PTB,
  // Brown escapes some tag variants; reuse PTB map as coarse fallback
};

// Registry: source -> target -> map
const REGISTRY: Record<string, Record<string, Record<string,string>>> = {
  "en-ptb": { universal: EN_PTB },
  "ru-rnc-new": { universal: RU_RNC_NEW },
  "en-brown": { universal: EN_BROWN },
  "ru-rnc": { universal: { "!":".", A:"ADJ", C:"CONJ", AD:"ADV", NN:"NOUN", VG:"VERB", COMP:"CONJ", NC:"NUM", VP:"VERB", P:"ADP", IJ:"X", V:"VERB", Z:"X", VI:"VERB", YES_NO_SENT:"X", PTCL:"PRT" } as Record<string,string> },
};

function getMap(source: string, target: string): Record<string,string> {
  const src = REGISTRY[source];
  if (src && src[target]) return src[target]!;
  // Fallback: if we have no map, return identity-like that maps known universal tags through, else X/UNK
  const fallback: Record<string,string> = {};
  return new Proxy(fallback, {
    get(_t, prop: string) { return UNIVERSAL_TAGS.has(prop) ? prop : (target === "universal" ? "X" : "UNK"); },
  }) as Record<string,string>;
}

export function tagsetMapping(source: string, target: string): Record<string,string> {
  // NLTK lazy-loads; we just return registry or fallback
  if (source === "wsj") source = "en-ptb";
  if (source === "brown") source = "en-brown";
  return getMap(source, target);
}

export function mapTag(source: string, target: string, sourceTag: string): string {
  if (target === "universal") {
    if (source === "wsj") source = "en-ptb";
    if (source === "brown") source = "en-brown";
  }
  return tagsetMapping(source, target)[sourceTag] ?? (target === "universal" ? "X" : "UNK");
}
