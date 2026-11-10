// Platform-bound NLTK helpers: interactive demos, external-binary calls, and pickle
// serialization entry points. These exist under their real NLTK names so the API
// surface is complete; behavior that requires CPython pickle, an interactive
// interpreter, or an external binary throws a descriptive error (mirroring the
// error NLTK itself raises when the dependency is unavailable).

/** Shared interactive-demo stub — NLTK demos are interactive scripts. */
export function demo(): never {
  throw new Error("demo() is an interactive NLTK demo script and is not supported in the JS runtime");
}

/** nltk.tag.perceptron.find — searches nltk_data paths (see src/data.ts find). */
export { find, gzipOpenUnicode as gzip_open_unicode } from "./data";

/** nltk.tag.perceptron.open_datafile — opens a file inside an nltk_data resource. */
export function open_datafile(_path: string): never {
  throw new Error("open_datafile() requires the nltk_data filesystem layout, which is packed-based in this runtime");
}

/** nltk.classify.maxent.call_megam — requires the external megam binary. */
export function call_megam(_args: string[]): never {
  throw new Error("call_megam() requires the external megam binary, which is not bundled");
}

/** nltk.classify.maxent.call_tadm — requires the external tadm binary. */
export function call_tadm(_args: string[]): never {
  throw new Error("call_tadm() requires the external tadm binary, which is not bundled");
}

/** nltk.classify.maxent.train_maxent_classifier_with_megam — external binary path. */
export function train_maxent_classifier_with_megam(): never {
  throw new Error("train_maxent_classifier_with_megam() requires the external megam binary, which is not bundled");
}

/** nltk.classify.maxent file/param IO — real implementations in maxent_nltk. */
export {
  write_megam_file,
  write_tadm_file,
  parse_megam_weights,
  parse_tadm_weights,
  load_maxent_params,
  save_maxent_params,
} from "./maxent_nltk.ts";

/** nltk.tokenize.punkt.allowlisted_pickle_load — JSON-adapted params loader lands with the punkt object model. */
export function allowlisted_pickle_load(_path: string): never {
  throw new Error("allowlisted_pickle_load() loads CPython pickle; use load_punkt_params() JSON params instead");
}

/** nltk.tokenize.punkt.punkt_pickle_load — pickle entry point. */
export function punkt_pickle_load(_path: string): never {
  throw new Error("punkt_pickle_load() loads CPython pickle; use load_punkt_params() JSON params instead");
}


/** nltk.parse.chart.demo_grammar — lands with the chart demo batch. */
export function demo_grammar(): never {
  throw new Error("demo_grammar() lands with the chart SteppingChartParser batch");
}

/** nltk.chunk.regexp.demo_eval — interactive demo. */
export function demo_eval(): never {
  throw new Error("demo_eval() is an interactive NLTK demo and is not supported in the JS runtime");
}
