import { porterNltk } from "./nltk_compat_runtime.ts";

export type PorterMode = "NLTK_EXTENSIONS" | "MARTIN_EXTENSIONS" | "ORIGINAL_ALGORITHM";

/** NLTK-compatible PorterStemmer facade backed by Rust. */
export class PorterStemmer {
  static readonly NLTK_EXTENSIONS = "NLTK_EXTENSIONS";
  static readonly MARTIN_EXTENSIONS = "MARTIN_EXTENSIONS";
  static readonly ORIGINAL_ALGORITHM = "ORIGINAL_ALGORITHM";
  readonly mode: PorterMode;
  readonly algorithm: string;
  private readonly modeId: number;

  constructor(mode = "NLTK_EXTENSIONS", algorithm = "PORTER") {
    if (mode !== "NLTK_EXTENSIONS" && mode !== "MARTIN_EXTENSIONS" && mode !== "ORIGINAL_ALGORITHM") {
      throw new Error(`unsupported PorterStemmer mode: ${mode}`);
    }
    if (algorithm !== "PORTER") {
      throw new Error(`unsupported PorterStemmer algorithm: ${algorithm}`);
    }
    this.mode = mode;
    this.modeId = mode === "ORIGINAL_ALGORITHM" ? 0 : mode === "MARTIN_EXTENSIONS" ? 1 : 2;
    this.algorithm = algorithm;
  }

  stem(token: string, to_lowercase = true): string {
    return porterNltk(token, this.modeId, to_lowercase);
  }
}
