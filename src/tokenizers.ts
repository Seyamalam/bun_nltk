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

export type TweetTokenizerOptions = {
  stripHandles?: boolean;
  reduceLen?: boolean;
  matchPhoneNumbers?: boolean;
};

function reduceLength(token: string): string {
  return token.replace(/([A-Za-z])\1{2,}/g, "$1$1$1");
}

function buildTweetRegex(matchPhoneNumbers: boolean): RegExp {
  const phone = String.raw`(?:\(\d{3}\)\s*\d+\s*-\d+|\d{2}-\d{8}|\d{3}-\d{3}-\d{4}|\d+\s*-\s*\d+)`;
  const emojiSeq = String.raw`\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)?)*`;
  const core = String.raw`https?:\/\/\S+|#[\w_]+|@[\w_]+|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|${emojiSeq}|[^\s]`;
  const source = matchPhoneNumbers ? `${phone}|${core}` : core;
  return new RegExp(source, "gu");
}

export function tweetTokenizeSubset(text: string, opts: TweetTokenizerOptions = {}): string[] {
  const options: Required<TweetTokenizerOptions> = {
    stripHandles: opts.stripHandles ?? false,
    reduceLen: opts.reduceLen ?? false,
    matchPhoneNumbers: opts.matchPhoneNumbers ?? true,
  };

  const regex = buildTweetRegex(options.matchPhoneNumbers);
  const matches = text.match(regex) ?? [];
  const out: string[] = [];

  for (const token of matches) {
    if (options.stripHandles && token.startsWith("@")) {
      continue;
    }

    if (options.reduceLen && /^[A-Za-z]+$/.test(token)) {
      out.push(reduceLength(token));
    } else {
      out.push(token);
    }
  }

  return out;
}
