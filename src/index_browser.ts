// Browser root: Rust/WASM classifiers plus pure-tokenization fallbacks.
// Native-only Bun APIs are intentionally absent; use bun_nltk/wasm directly for
// the full portable WASM surface.
export { WasmNltk } from "./wasm.ts";
export { RustNaiveBayesClassifier, RustPositiveNaiveBayesClassifier } from "./feature_nb.ts";
export { RustDecisionTreeClassifier } from "./feature_tree.ts";
export { RustMaxentClassifier } from "./feature_maxent.ts";
export * from "./reference.ts";
export * from "./tokenizers.ts";
export * from "./sentence_tokenizer.ts";
export * from "./punkt.ts";
export * from "./nltk_compat.ts";
