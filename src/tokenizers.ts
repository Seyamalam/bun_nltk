export function wordTokenizeSubset(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|[^\s]/g) ?? [];
  const out: string[] = [];

  for (const token of raw) {
    const nt = token.match(/^(.*)n't$/i);
    if (nt && nt[1]) {
      out.push(nt[1]);
      out.push("n't");
      continue;
    }

    const clitic = token.match(/^(.*)'(s|m|d|re|ve|ll)$/i);
    if (clitic && clitic[1]) {
      out.push(clitic[1]);
      out.push(`'${clitic[2]!.toLowerCase()}`);
      continue;
    }

    out.push(token);
  }

  return out;
}

export class TreebankWordTokenizer {
  tokenize(text: string): string[] {
    const raw =
      text.match(/\.{3}|--+|[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:[.,]\d+)*|``|''|[^\s]/g) ?? [];
    const out: string[] = [];

    for (const token of raw) {
      const nt = token.match(/^(.*)n't$/i);
      if (nt && nt[1]) {
        out.push(nt[1]);
        out.push("n't");
        continue;
      }

      const clitic = token.match(/^(.*)('s|'m|'d|'re|'ve|'ll)$/i);
      if (clitic && clitic[1]) {
        out.push(clitic[1]);
        out.push(clitic[2]!.toLowerCase());
        continue;
      }

      out.push(token);
    }

    return out;
  }
}

export class WordPunctTokenizer {
  tokenize(text: string): string[] {
    return text.match(/[A-Za-z0-9_]+|[^\w\s]+/g) ?? [];
  }
}

export class ToktokTokenizer {
  tokenize(text: string): string[] {
    return text.match(/\.\.\.|--+|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:[.,]\d+)*|[^\s]/g) ?? [];
  }
}

type MweKey = string;

function mweKey(tokens: string[], separator: string): MweKey {
  return tokens.join(separator);
}

export class MWETokenizer {
  private readonly separator: string;
  private readonly phrases = new Map<number, Set<MweKey>>();
  private longest = 1;

  constructor(mwes: string[][] = [], separator = "_") {
    this.separator = separator;
    for (const mwe of mwes) this.addMwe(mwe);
  }

  addMwe(tokens: string[]): void {
    const clean = tokens.map((row) => row.trim()).filter(Boolean);
    if (clean.length < 2) return;
    const bucket = this.phrases.get(clean.length) ?? new Set<MweKey>();
    bucket.add(mweKey(clean, this.separator));
    this.phrases.set(clean.length, bucket);
    if (clean.length > this.longest) this.longest = clean.length;
  }

  tokenize(tokens: string[]): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      let matched = false;
      const maxLen = Math.min(this.longest, tokens.length - i);
      for (let len = maxLen; len >= 2; len -= 1) {
        const bucket = this.phrases.get(len);
        if (!bucket) continue;
        const window = tokens.slice(i, i + len);
        const key = mweKey(window, this.separator);
        if (!bucket.has(key)) continue;
        out.push(key);
        i += len;
        matched = true;
        break;
      }
      if (!matched) {
        out.push(tokens[i]!);
        i += 1;
      }
    }
    return out;
  }
}

export type TweetTokenizerOptions = {
  preserveCase?: boolean;
  stripHandles?: boolean;
  reduceLen?: boolean;
  matchPhoneNumbers?: boolean;
};

function reduceLength(token: string): string {
  return token.replace(/([A-Za-z])\1{2,}/g, "$1$1$1");
}

function buildTweetRegex(matchPhoneNumbers: boolean): RegExp {
  const phone = String.raw`(?:\(\d{3}\)\s*\d+\s*-\d+|\d{2}-\d{8}|\d{3}-\d{3}-\d{4}|\d+\s*-\s*\d+)`;
  const emoticon = String.raw`(?::|;|=|8)(?:-)?(?:\)|\(|D|P|p|O|o|/|\\)`;
  const emojiSeq = String.raw`\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?)*`;
  const core = String.raw`https?:\/\/\S+|#[\w_]+|@[\w_]+|${emoticon}|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|${emojiSeq}|[^\s]`;
  const source = matchPhoneNumbers ? `${phone}|${core}` : core;
  return new RegExp(source, "gu");
}

function isEmoticon(token: string): boolean {
  return /^(?::|;|=|8)(?:-)?(?:\)|\(|D|P|p|O|o|\/|\\)$/.test(token);
}

export function tweetTokenizeSubset(text: string, opts: TweetTokenizerOptions = {}): string[] {
  const tokenizer = new TweetTokenizer({
    preserveCase: true,
    stripHandles: opts.stripHandles ?? false,
    reduceLen: opts.reduceLen ?? false,
    matchPhoneNumbers: opts.matchPhoneNumbers ?? true,
  });
  return tokenizer.tokenize(text);
}

export class TweetTokenizer {
  private readonly options: Required<TweetTokenizerOptions>;

  constructor(opts: TweetTokenizerOptions = {}) {
    this.options = {
      preserveCase: opts.preserveCase ?? true,
      stripHandles: opts.stripHandles ?? false,
      reduceLen: opts.reduceLen ?? false,
      matchPhoneNumbers: opts.matchPhoneNumbers ?? true,
    };
  }

  tokenize(text: string): string[] {
    const regex = buildTweetRegex(this.options.matchPhoneNumbers);
    const matches = text.match(regex) ?? [];
    const out: string[] = [];

    for (const token of matches) {
      if (this.options.stripHandles && token.startsWith("@")) {
        continue;
      }

      let next = token;
      if (this.options.reduceLen && /^[A-Za-z]+$/.test(next)) {
        next = reduceLength(next);
      }
      if (!this.options.preserveCase && !isEmoticon(next)) {
        next = next.toLowerCase();
      }

      out.push(next);
    }

    return out;
  }
}

export function treebankWordTokenize(text: string): string[] {
  return new TreebankWordTokenizer().tokenize(text);
}

export function wordPunctTokenize(text: string): string[] {
  return new WordPunctTokenizer().tokenize(text);
}

export function toktokTokenize(text: string): string[] {
  return new ToktokTokenizer().tokenize(text);
}

export function mweTokenize(tokens: string[], mwes: string[][], separator = "_"): string[] {
  return new MWETokenizer(mwes, separator).tokenize(tokens);
}

export function tweetTokenize(text: string, opts: TweetTokenizerOptions = {}): string[] {
  const options: Required<TweetTokenizerOptions> = {
    preserveCase: opts.preserveCase ?? true,
    stripHandles: opts.stripHandles ?? false,
    reduceLen: opts.reduceLen ?? false,
    matchPhoneNumbers: opts.matchPhoneNumbers ?? true,
  };
  return new TweetTokenizer(options).tokenize(text);
}
