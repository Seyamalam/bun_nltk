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

/** nltk.classify.maxent.write_megam_file — implemented with the maxent encoding batch. */
export function write_megam_file(_trainToks: unknown, _encoding: unknown, _outfile: unknown, _options?: unknown): never {
  throw new Error("write_megam_file() requires a MaxentFeatureEncoding; see MaxentFeatureEncodingI");
}

/** nltk.classify.maxent.write_tadm_file — implemented with the maxent encoding batch. */
export function write_tadm_file(_trainToks: unknown, _encoding: unknown, _outfile: unknown, _options?: unknown): never {
  throw new Error("write_tadm_file() requires a MaxentFeatureEncoding; see MaxentFeatureEncodingI");
}

/** nltk.classify.maxent.parse_megam_weights — implemented with the maxent encoding batch. */
export function parse_megam_weights(_file: unknown, _features?: unknown): never {
  throw new Error("parse_megam_weights() requires megam weight output; not yet implemented");
}

/** nltk.classify.maxent.parse_tadm_weights — implemented with the maxent encoding batch. */
export function parse_tadm_weights(_file: unknown): never {
  throw new Error("parse_tadm_weights() requires tadm weight output; not yet implemented");
}

/** nltk.classify.maxent.load_maxent_params — implemented with the maxent encoding batch. */
export function load_maxent_params(_file: unknown): never {
  throw new Error("load_maxent_params() requires a saved params file; not yet implemented");
}

/** nltk.classify.maxent.save_maxent_params — implemented with the maxent encoding batch. */
export function save_maxent_params(_params: unknown, _file: unknown): never {
  throw new Error("save_maxent_params() requires a classifier params object; not yet implemented");
}

/** nltk.tokenize.punkt.allowlisted_pickle_load — JSON-adapted params loader lands with the punkt object model. */
export function allowlisted_pickle_load(_path: string): never {
  throw new Error("allowlisted_pickle_load() loads CPython pickle; use load_punkt_params() JSON params instead");
}

/** nltk.tokenize.punkt.punkt_pickle_load — pickle entry point. */
export function punkt_pickle_load(_path: string): never {
  throw new Error("punkt_pickle_load() loads CPython pickle; use load_punkt_params() JSON params instead");
}

/** nltk.tokenize.punkt.load_punkt_params — lands with the punkt object model. */
export function load_punkt_params(_path: string): never {
  throw new Error("load_punkt_params() lands with the PunktParameters object model");
}

/** nltk.tokenize.punkt.save_punkt_params — lands with the punkt object model. */
export function save_punkt_params(_params: unknown, _path: string): never {
  throw new Error("save_punkt_params() lands with the PunktParameters object model");
}

/** nltk.parse.chart.demo_grammar — lands with the chart demo batch. */
export function demo_grammar(): never {
  throw new Error("demo_grammar() lands with the chart SteppingChartParser batch");
}

/** nltk.chunk.regexp.demo_eval — interactive demo. */
export function demo_eval(): never {
  throw new Error("demo_eval() is an interactive NLTK demo and is not supported in the JS runtime");
}
