import { tokenizerRuntime } from "./tokenizer_runtime.js";

export class TreebankWordTokenizer {
  runtime;
  constructor(runtime) {
    this.runtime = runtime;
  }
  tokenize(text, convertParentheses = false, _returnStr = false) {
    return (this.runtime ?? tokenizerRuntime()).tokenize(text, "treebank", { convertParentheses });
  }
  spanTokenize(text) {
    return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, "treebank");
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

export class WordPunctTokenizer {
  runtime;
  constructor(runtime) {
    this.runtime = runtime;
  }
  tokenize(text) {
    return (this.runtime ?? tokenizerRuntime()).tokenize(text, "wordpunct");
  }
  spanTokenize(text) {
    return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, "wordpunct");
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

export class TreebankWordDetokenizer {
  runtime;
  constructor(runtime) {
    this.runtime = runtime;
  }
  detokenize(tokens, convertParentheses = false) {
    return (this.runtime ?? tokenizerRuntime()).treebankDetokenize(tokens, convertParentheses);
  }
  tokenize(tokens, convertParentheses = false) {
    return this.detokenize(tokens, convertParentheses);
  }
  tokenizeSents(texts) {
    return texts.map((tokens) => this.tokenize(tokens));
  }
  tokenize_sents(texts) {
    return this.tokenizeSents(texts);
  }
}
export function treebankWordTokenize(text) {
  return new TreebankWordTokenizer().tokenize(text);
}
export function wordPunctTokenize(text) {
  return new WordPunctTokenizer().tokenize(text);
}
