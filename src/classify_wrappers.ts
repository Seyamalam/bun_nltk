/**
 * External classifier wrappers (ports of nltk.classify.svm/megam/tadm/weka/scikitlearn/senna/rte_classify).
 *
 * These classifiers delegate to external binaries (libsvm, megam, TADM, Weka, scikit-learn, SENNA)
 * which are unavailable in the JS runtime. The API surface is preserved for parity;
 * training/classification throws with a helpful message.
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary not available in the JS runtime (see NLTK docs for ${name}).`);
}

export class SvmClassifier {
  static train(_labeledFeaturesets: unknown[]): SvmClassifier { return externalError("nltk.classify.svm.SvmClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("SvmClassifier.classify"); }
  probClassify(_featureset: unknown): unknown { return externalError("SvmClassifier.probClassify"); }
}

export class MegamMaxentClassifier {
  static train(_labeledFeaturesets: unknown[], _kwargs: unknown): MegamMaxentClassifier { return externalError("nltk.classify.megam.MegamMaxentClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("MegamMaxentClassifier.classify"); }
}

export class TadmMaxentClassifier {
  static train(_labeledFeaturesets: unknown[], _kwargs: unknown): TadmMaxentClassifier { return externalError("nltk.classify.tadm.TadmMaxentClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("TadmMaxentClassifier.classify"); }
}

export class WekaClassifier {
  static train(_labeledFeaturesets: unknown[], _kwargs: unknown): WekaClassifier { return externalError("nltk.classify.weka.WekaClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("WekaClassifier.classify"); }
}

export class SklearnClassifier {
  constructor(_clf: unknown) { void _clf; }
  static train(_labeledFeaturesets: unknown[], _kwargs: unknown): SklearnClassifier { return externalError("nltk.classify.scikitlearn.SklearnClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("SklearnClassifier.classify"); }
}

export class SennaClassifier {
  static train(_labeledFeaturesets: unknown[]): SennaClassifier { return externalError("nltk.classify.senna.SennaClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("SennaClassifier.classify"); }
}

export class RteClassifier {
  static train(_labeledFeaturesets: unknown[]): RteClassifier { return externalError("nltk.classify.rte_classify.RteClassifier") as never; }
  classify(_featureset: unknown): string { return externalError("RteClassifier.classify"); }
}

export function rteClassify(_text: string, _hypothesis: string): string { return externalError("nltk.classify.rte_classify"); }
