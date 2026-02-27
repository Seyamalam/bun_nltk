export type TaggedToken = {
  token: string;
  tag: string;
};

export type ChunkedToken = {
  token: string;
  pos: string;
  chunk: string;
};

export type TaggedSentence = TaggedToken[];
export type ChunkedSentence = ChunkedToken[];

function splitNonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseConllTagged(text: string): TaggedSentence[] {
  const sentences: TaggedSentence[] = [];
  let current: TaggedSentence = [];

  for (const raw of text.split(/\r?\n/g)) {
    const line = raw.trim();
    if (!line) {
      if (current.length > 0) {
        sentences.push(current);
        current = [];
      }
      continue;
    }

    const [token, tag] = line.split(/\t+/);
    if (!token || !tag) continue;
    current.push({ token, tag });
  }

  if (current.length > 0) sentences.push(current);
  return sentences;
}

export function parseBrownTagged(text: string): TaggedSentence[] {
  const sentences: TaggedSentence[] = [];
  for (const line of splitNonEmptyLines(text)) {
    const tokens = line.split(/\s+/g);
    const sentence: TaggedSentence = [];
    for (const item of tokens) {
      const slash = item.lastIndexOf("/");
      if (slash <= 0 || slash >= item.length - 1) continue;
      sentence.push({
        token: item.slice(0, slash),
        tag: item.slice(slash + 1),
      });
    }
    if (sentence.length > 0) sentences.push(sentence);
  }
  return sentences;
}

export function parseConllChunked(text: string): ChunkedSentence[] {
  const sentences: ChunkedSentence[] = [];
  let current: ChunkedSentence = [];

  for (const raw of text.split(/\r?\n/g)) {
    const line = raw.trim();
    if (!line) {
      if (current.length > 0) {
        sentences.push(current);
        current = [];
      }
      continue;
    }

    const [token, pos, chunk] = line.split(/\s+/g);
    if (!token || !pos || !chunk) continue;
    current.push({ token, pos, chunk });
  }

  if (current.length > 0) sentences.push(current);
  return sentences;
}

