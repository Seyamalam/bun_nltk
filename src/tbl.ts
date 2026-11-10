/** tbl — package barrel (NLTK tbl/__init__.py parity shim). Submodules hold the implementation. */
export const TBL_PACKAGE = "tbl";
export const tbl_package = "tbl";

// nltk.tbl parity names: Feature/Rule/TagRule/BrillTemplateI are the abstract
// bases and concrete classes from nltk.tbl.{feature,rule,template}; the
// implementation lives in brill_tagger.ts which the fast trainer shares.
export {
  TblFeature as Feature,
  TblRule as Rule,
  TagRule,
  BrillTemplateI,
  Template,
} from "./brill_tagger";
export { corpusSize, corpus_size, postag } from "./tbl_demo";
