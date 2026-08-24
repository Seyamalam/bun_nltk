/** NLTK chat.util — lightweight Chat shim (full logic requires NLTK corpora patterns). */
export const reflections: Record<string, string> = {
  "i am": "you are",
  "i was": "you were",
  i: "you",
  "i'm": "you are",
  "i'd": "you would",
  "i've": "you have",
  "i'll": "you will",
  my: "your",
  "you are": "I am",
  "you were": "I was",
  "you've": "I have",
  "you'll": "I will",
  your: "my",
  yours: "mine",
  you: "me",
  me: "you",
};

export class Chat {
  private pairs: unknown;
  private reflections: Record<string, string>;
  constructor(pairs: unknown, reflections: Record<string, string> = {}) {
    this.pairs = pairs;
    this.reflections = reflections;
    void this.pairs;
  }
  respond(_input: string): never {
    throw new Error(
      "nltk.chat.util.Chat.respond requires NLTK chat patterns — not fully ported (use custom pattern matching or import pairs from chat_* shims)",
    );
  }
  converse(..._a: unknown[]): never {
    throw new Error(
      "nltk.chat.util.Chat.converse requires interactive terminal I/O — not available in JS runtime",
    );
  }
}
