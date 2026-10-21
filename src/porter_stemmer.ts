import { porterStemAscii } from "./native.ts";

/** NLTK-compatible PorterStemmer facade backed by Rust. */
export class PorterStemmer {
  readonly mode: string;
  readonly algorithm: string;

  constructor(mode = "NLTK_EXTENSIONS", algorithm = "PORTER") {
    if (mode !== "NLTK_EXTENSIONS") {
      throw new Error(`unsupported PorterStemmer mode: ${mode}`);
    }
    if (algorithm !== "PORTER") {
      throw new Error(`unsupported PorterStemmer algorithm: ${algorithm}`);
    }
    this.mode = mode;
    this.algorithm = algorithm;
  }

  stem(token: string): string {
    return porterStemAscii(token);
  }
}
