import { tokenizerRuntime } from "./tokenizer_runtime.js";

class RustTokenizer {
  kind;
  runtime;
  constructor(kind, runtime) {
    this.kind = kind;
    this.runtime = runtime;
  }
  blanklines = "discard";
  tokenize(text) {
    return (this.runtime ?? tokenizerRuntime()).tokenize(text, this.kind, { blanklines: this.blanklines });
  }
  spanTokenize(text) {
    return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, this.kind, { blanklines: this.blanklines });
  }
  span_tokenize(text) {
    return this.spanTokenize(text);
  }
  tokenizeSents(texts) {
    return texts.map((text) => this.tokenize(text));
  }
  tokenize_sents(texts) {
    return this.tokenizeSents(texts);
  }
  spanTokenizeSents(texts) {
    return texts.map((text) => this.spanTokenize(text));
  }
  span_tokenize_sents(texts) {
    return this.spanTokenizeSents(texts);
  }
}

export class WhitespaceTokenizer extends RustTokenizer {
  constructor(runtime) {
    super("whitespace", runtime);
  }
}

export class BlanklineTokenizer extends RustTokenizer {
  constructor(runtime) {
    super("blankline", runtime);
  }
}

export class SpaceTokenizer extends RustTokenizer {
  constructor(runtime) {
    super("space", runtime);
  }
}

export class TabTokenizer extends RustTokenizer {
  constructor(runtime) {
    super("tab", runtime);
  }
}

export class LineTokenizer extends RustTokenizer {
  constructor(blanklines = "discard", runtime) {
    super("line", runtime);
    if (!["discard", "keep", "discard-eof"].includes(blanklines))
      throw new RangeError("blanklines must be discard, keep, or discard-eof");
    this.blanklines = blanklines;
  }
}
export function lineTokenize(text, blanklines = "discard") {
  return new LineTokenizer(blanklines).tokenize(text);
}
export function blanklineTokenize(text) {
  return new BlanklineTokenizer().tokenize(text);
}

export { lineTokenize as line_tokenize, blanklineTokenize as blankline_tokenize };
