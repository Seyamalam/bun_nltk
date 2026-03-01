const DEFAULT_VADER_LEXICON: Record<string, number> = {
  amazing: 2.7,
  awesome: 3.1,
  brilliant: 2.9,
  clean: 1.2,
  delightful: 2.4,
  excellent: 2.8,
  fantastic: 3.0,
  good: 1.9,
  great: 2.5,
  happy: 2.1,
  incredible: 2.7,
  love: 3.2,
  nice: 1.6,
  perfect: 3.2,
  solid: 1.4,
  strong: 1.6,
  wonderful: 2.9,
  wow: 2.1,
  bad: -2.4,
  boring: -2.3,
  broken: -2.1,
  corrupt: -2.0,
  disappointing: -2.4,
  fail: -2.7,
  fragile: -1.7,
  hate: -3.2,
  horrible: -3.1,
  messy: -1.8,
  poor: -2.0,
  sad: -1.9,
  slow: -1.5,
  terrible: -3.2,
  trash: -2.8,
  ugly: -2.2,
  weak: -1.8,
};

const BOOSTER_DICT: Record<string, number> = {
  absolutely: 0.293,
  amazingly: 0.293,
  awfully: 0.293,
  completely: 0.293,
  especially: 0.293,
  extremely: 0.293,
  fully: 0.293,
  highly: 0.293,
  quite: 0.193,
  really: 0.293,
  so: 0.293,
  too: 0.293,
  very: 0.293,
  almost: -0.293,
  barely: -0.293,
  hardly: -0.293,
  kindof: -0.293,
  kinda: -0.293,
  less: -0.293,
  little: -0.293,
};

const NEGATIONS = new Set([
  "aint",
  "aren't",
  "cannot",
  "cant",
  "didn't",
  "doesn't",
  "dont",
  "hadn't",
  "hardly",
  "isn't",
  "lack",
  "lacking",
  "never",
  "no",
  "none",
  "nope",
  "nor",
  "not",
  "nothing",
  "nowhere",
  "rarely",
  "seldom",
  "without",
  "won't",
]);

export type VaderPolarity = {
  neg: number;
  neu: number;
  pos: number;
  compound: number;
};

export type VaderOptions = {
  lexicon?: Record<string, number>;
};

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^\W+/, "")
    .replace(/\W+$/, "");
}

function scalarNormalize(score: number): number {
  if (score === 0) return 0;
  return score / Math.sqrt(score * score + 15);
}

function punctuationEmphasis(text: string): number {
  const bangs = Math.min((text.match(/!/g) ?? []).length, 4);
  const q = (text.match(/\?/g) ?? []).length;
  let amp = bangs * 0.292;
  if (q > 1) amp += q <= 3 ? q * 0.18 : 0.96;
  return amp;
}

function isAllCaps(token: string): boolean {
  return /[A-Z]/.test(token) && token === token.toUpperCase();
}

export class SentimentIntensityAnalyzer {
  private readonly lexicon: Record<string, number>;

  constructor(options: VaderOptions = {}) {
    this.lexicon = { ...DEFAULT_VADER_LEXICON, ...(options.lexicon ?? {}) };
  }

  polarityScores(text: string): VaderPolarity {
    const tokens = text.match(/\S+/g) ?? [];
    if (tokens.length === 0) {
      return { neg: 0, neu: 1, pos: 0, compound: 0 };
    }

    const hasMixedCase = tokens.some((tok) => /[A-Z]/.test(tok)) && tokens.some((tok) => /[a-z]/.test(tok));
    const sentiments: number[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      const key = normalizeToken(token);
      let valence = this.lexicon[key] ?? 0;

      if (valence !== 0) {
        if (hasMixedCase && isAllCaps(token)) {
          valence += valence > 0 ? 0.733 : -0.733;
        }

        for (let back = 1; back <= 3; back += 1) {
          const prev = tokens[i - back];
          if (!prev) break;
          const prevNorm = normalizeToken(prev).replace(/\s+/g, "");
          const scalar = BOOSTER_DICT[prevNorm] ?? 0;
          if (scalar !== 0) {
            valence += valence > 0 ? scalar : -scalar;
          }
          if (NEGATIONS.has(prevNorm)) {
            valence *= -0.74;
          }
        }
      }

      sentiments.push(valence);
    }

    const sum = sentiments.reduce((acc, row) => acc + row, 0);
    const punctAmp = punctuationEmphasis(text);
    const compoundBase = sum + (sum > 0 ? punctAmp : sum < 0 ? -punctAmp : 0);
    const compound = Number(scalarNormalize(compoundBase).toFixed(4));

    let pos = 0;
    let neg = 0;
    let neu = 0;
    for (const score of sentiments) {
      if (score > 0) pos += score + 1;
      else if (score < 0) neg += Math.abs(score) + 1;
      else neu += 1;
    }

    const total = pos + neg + neu;
    return {
      neg: Number((total > 0 ? neg / total : 0).toFixed(3)),
      neu: Number((total > 0 ? neu / total : 0).toFixed(3)),
      pos: Number((total > 0 ? pos / total : 0).toFixed(3)),
      compound,
    };
  }
}

