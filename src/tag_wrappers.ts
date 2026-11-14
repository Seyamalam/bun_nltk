/**
 * External POS tagger wrappers (ports of nltk.tag.stanford/hunpos/senna).
 * Real optional-dependency adapters in ext_subprocess.ts: they resolve the
 * binary/jar via env vars + config and spawn it; when the tool is absent
 * they raise the same LookupError/OSError Python does.
 */

export {
  StanfordTagger,
  StanfordPOSTagger,
  StanfordNERTagger,
  HunposTagger,
  Senna,
  SennaTagger,
  SennaChunkTagger,
  SennaNERTagger,
} from "./ext_subprocess";

import { HunposTagger } from "./ext_subprocess";
/** Backwards-compatible alias kept for the pre-rename export name. */
export const HunPosTagger = HunposTagger;
