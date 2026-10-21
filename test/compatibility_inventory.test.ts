import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkEvidenceFiles, checkRegression, checkRouteRegression, checkSignatureRegression, checkSnapshot, discoverBun, discoverOracle,
  loadManifest, resolveBunExports, resolveTargets, serializeSnapshot, snapshotPath, sourceHashes, validateDiscovery, validateManifest,
  hasPinnedNltkAssertion,
  type Manifest, type Snapshot,
} from "../scripts/compatibility/inventory";
import { nextReviewBase, proposedNextReview } from "../scripts/compatibility/next_review";

const manifest = loadManifest();
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
const copy = (): Manifest => structuredClone(manifest);

test("compatibility inventory pins schema, NLTK and an explicit module scope", () => {
  expect(manifest.nltkVersion).toBe("3.10.3");
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.pythonVersion).toBe("3.14.4");
  expect(manifest.modules.length).toBeGreaterThan(30);
  expect(manifest.modules).not.toContain("nltk");
  expect(manifest.excludedModules.some((entry) => entry.prefix === "*")).toBe(true);
  for (const key of ["schemaVersion", "nltkVersion"] as const) {
    const broken = copy();
    if (key === "schemaVersion") broken.schemaVersion = 2;
    else broken.nltkVersion = "3.9.2";
    expect(() => validateManifest(broken)).toThrow(key);
  }
  const broken = copy();
  broken.mappings.push(structuredClone(broken.mappings[0]!));
  expect(() => validateManifest(broken)).toThrow("duplicate mapping");
  broken.mappings.pop();
  broken.mappings[0]!.category = "imaginary" as Manifest["mappings"][number]["category"];
  expect(() => validateManifest(broken)).toThrow("mapping.category");
});

test("imports, wrappers and throwing external facades cannot become pinned behavioral evidence", () => {
  const broken = copy();
  const wrapper = broken.mappings.find((mapping) => mapping.target === "nltk.tokenize.word_tokenize")!;
  wrapper.status = "implemented-subset";
  wrapper.fixtures.status = "pinned-differential";
  expect(() => validateManifest(broken)).toThrow("differential evidence");
  const external = copy();
  external.mappings.find((mapping) => mapping.category === "gap")!.category = "external-integration";
  expect(() => validateManifest(external)).toThrow("real integration evidence");
  const unpinned = copy();
  unpinned.evidence.find((evidence) => evidence.kind === "differential")!.oracleVersion = "3.9.2";
  expect(() => validateManifest(unpinned)).toThrow("pin oracleVersion");
});

test("reviewed implementation and test anchors still refer to real checked-in code", () => {
  expect(() => checkEvidenceFiles(manifest)).not.toThrow();
  expect(sourceHashes(manifest)).toEqual(snapshot.sourceHashes);
  const broken = copy();
  broken.mappings[0]!.source[0]!.anchor = "deleted implementation marker";
  expect(() => checkEvidenceFiles(broken)).toThrow("stale source anchor");
  const rust = copy();
  rust.mappings.find((mapping) => mapping.category === "rust-native")!.source = [{ file: "src/porter_stemmer.ts", anchor: "PorterStemmer" }];
  expect(() => validateManifest(rust)).toThrow("requires Rust source");
});

test("selected names and class members get explicit gaps rather than mechanical aliases", () => {
  validateDiscovery(manifest, snapshot);
  const targets = resolveTargets(manifest, snapshot);
  expect(targets.length).toBeGreaterThan(300);
  const jaro = targets.find((target) => target.target === "nltk.metrics.distance.jaro_similarity")!;
  expect(jaro.category).toBe("gap");
  expect(jaro.fixtureStatus).toBe("missing");
  expect(targets.some((target) => target.target === "nltk.tokenize.wordpunct_tokenize")).toBe(true);
  const treebank = targets.find((target) => target.target === "nltk.tokenize.treebank.TreebankWordTokenizer")!;
  expect(treebank.missingMembers).toContain("span_tokenize");
  expect(treebank.missingSignatureBindings).toContain("nltk.tokenize.treebank.TreebankWordTokenizer.span_tokenize");
  expect(treebank.mapping!.signatures.status).toBe("partial");
  const sklearn = targets.find((target) => target.target === "nltk.classify.scikitlearn.SklearnClassifier")!;
  expect(sklearn.category).toBe("gap");
  expect(sklearn.mapping!.status).toBe("unsupported");
  expect(targets.some((target) => target.mapping && target.mapping.signatures.gaps.length && target.fixtureStatus === "pinned-differential")).toBe(true);
});

test("inventory refresh blocks removed mappings, member contracts and downgraded fixture evidence", () => {
  expect(() => checkRegression(manifest.mappings, snapshot.review)).not.toThrow();
  expect(() => checkRegression(manifest.mappings.slice(1), snapshot.review)).toThrow("removed mapping");
  const broken = copy();
  broken.mappings.find((mapping) => mapping.fixtures.status === "pinned-differential")!.fixtures.status = "missing";
  expect(() => checkRegression(broken.mappings, snapshot.review)).toThrow("pinned evidence lost");
  const members = copy();
  members.mappings.find((mapping) => mapping.signatures.members.length)!.signatures.members = [];
  expect(() => checkRegression(members.mappings, snapshot.review)).toThrow("member lost");
  expect(() => checkSignatureRegression(manifest.signatureBindings.slice(1), snapshot.signatureBindings)).toThrow("signature binding lost");
  expect(() => checkRouteRegression({}, snapshot.reviewedRoutes)).toThrow("reviewed route lost");
});

test("pinned offline NLTK discovery is reproducible and rejects version/signature drift", () => {
  const first = discoverOracle(manifest);
  const second = discoverOracle(manifest);
  expect(first.nltkVersion).toBe("3.10.3");
  expect(first.pythonVersion).toBe(manifest.pythonVersion);
  expect(first.modules).toEqual(second.modules);
  expect(first.modules).toEqual(snapshot.modules);
  const changed = structuredClone(snapshot);
  changed.modules[0]!.targets[0]!.signature = "(changed_signature)";
  expect(() => checkSnapshot(changed, snapshot)).toThrow("inventory drift");
  const sourceChanged = structuredClone(snapshot);
  sourceChanged.sourceHashes["src/tokenizers.ts"] = "changed";
  expect(() => checkSnapshot(sourceChanged, snapshot)).toThrow("inventory drift");
  const wrongVersion = structuredClone(snapshot);
  wrongVersion.nltkVersion = "3.9.2";
  expect(() => checkSnapshot(wrongVersion, snapshot)).toThrow("3.10.3");
  const wrongOracle = Bun.spawnSync(["python3", "-c", `
import runpy,sys,types
sys.modules['nltk']=types.SimpleNamespace(__version__='3.9.2')
runpy.run_path(sys.argv[1],run_name='__main__')
`, resolve(import.meta.dir, "../scripts/compatibility/discover_nltk.py")], { stdout: "pipe", stderr: "pipe" });
  expect(wrongOracle.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(wrongOracle.stderr)).toContain("NLTK 3.10.3 required, found 3.9.2");
  const wrongPython = Bun.spawnSync(["python3", "-c", `
import runpy,sys,types
sys.modules['nltk']=types.SimpleNamespace(__version__='3.10.3')
sys.version_info=(3,12,0)
runpy.run_path(sys.argv[1],run_name='__main__')
`, resolve(import.meta.dir, "../scripts/compatibility/discover_nltk.py")], { stdout: "pipe", stderr: "pipe" });
  expect(wrongPython.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(wrongPython.stderr)).toContain("Python 3.14.4 required for inventory reflection, found 3.12.0");
});

test("reviewed classifications require the exact entrypoint and source route, not a matching name", () => {
  const changed = structuredClone(snapshot);
  changed.bunEntrypoints["./classify"] = { "src/classify.ts": ["NaiveBayesClassifier"] };
  changed.bunEntrypoints["."]!["src/classifier_compat.ts"] = changed.bunEntrypoints["."]!["src/classifier_compat.ts"]!.filter((name) => name !== "NaiveBayesClassifier");
  expect(() => validateDiscovery(manifest, changed)).toThrow("Bun export absent: NaiveBayesClassifier");
  const subpath = resolveBunExports(manifest, changed).find((entry) => entry.entrypoint === "./classify" && entry.name === "NaiveBayesClassifier")!;
  expect(subpath.review).toBe("unreviewed");
  expect(subpath.categories).toEqual(["gap"]);
  const route = structuredClone(snapshot);
  route.bunEntrypoints["."]!["src/other.ts"] = ["NaiveBayesClassifier"];
  route.bunEntrypoints["."]!["src/classifier_compat.ts"] = route.bunEntrypoints["."]!["src/classifier_compat.ts"]!.filter((name) => name !== "NaiveBayesClassifier");
  expect(() => validateDiscovery(manifest, route)).toThrow("reviewed export route drift");
});

test("all package Bun value exports are discovered with provenance; names are not behavior", async () => {
  const actual = await discoverBun();
  expect(actual).toEqual(snapshot.bunEntrypoints);
  expect(Object.keys(actual)).toContain("./classify-features");
  expect(Object.keys(actual)).toContain("./wasm");
  const rootNames = Object.values(actual["."]!).flat();
  expect(rootNames.length).toBeGreaterThan(800);
  expect(rootNames).toContain("word_tokenize");
  expect(actual["."]!["src/classify_wrappers.ts"]).toContain("SklearnClassifier");
  const exports = resolveBunExports(manifest, snapshot);
  expect(exports.find((entry) => entry.name === "SklearnClassifier")!.categories).toEqual(["gap"]);
  expect(exports.find((entry) => entry.name === "porterStemAscii")!.categories).toEqual(["rust-native"]);
  expect(exports.find((entry) => entry.name === "app_ns")!.review).toBe("unreviewed");
  expect(serializeSnapshot(snapshot)).not.toMatch(/ at 0x[0-9a-f]+/);
});

test("NLTK assertion anchors recognize real quote/spacing variants, not mentions or loose version matches", () => {
  for (const source of [
    "assert nltk.__version__ == '3.10.3'", 'assert nltk.__version__ == "3.10.3", nltk.__version__',
    "import nltk\nassert nltk.__version__=='3.10.3'\ndata=json.load(sys.stdin)",
  ]) expect(hasPinnedNltkAssertion(source)).toBe(true);
  for (const source of [
    "# assert nltk.__version__ == '3.10.3'", "NLTK 3.10.3", "assert nltk.__version__ == '3.10.30'",
    "assert nltk.__version__ != '3.10.3'", "assert nltk.__version__ == '3.9.2'",
    "assert nltk.__version__ == '3.10.3' or True", 'assert nltk.__version__ == \'3.10.3"',
  ]) expect(hasPinnedNltkAssertion(source)).toBe(false);
});

test("current-base correction proposals have real source/evidence/signatures without rewriting the shared baseline", () => {
  const before = JSON.stringify(manifest);
  const candidate = proposedNextReview(manifest);
  expect(candidate.reviewBase).toBe(nextReviewBase);
  expect(() => validateManifest(candidate)).not.toThrow();
  expect(() => checkEvidenceFiles(candidate)).not.toThrow();
  expect(() => validateDiscovery(candidate, snapshot)).not.toThrow();
  expect(() => checkSignatureRegression(candidate.signatureBindings, snapshot.signatureBindings)).not.toThrow();
  expect(candidate.mappings).toHaveLength(43);
  expect(candidate.signatureBindings).toHaveLength(43);
  expect(JSON.stringify(manifest)).toBe(before);
  expect(loadManifest()).toEqual(manifest);
  // Correction requires an explicit parent policy decision, not weakened gates:
  // the ASCII export is still present but no longer misbound to a Unicode class.
  expect(() => checkRegression(candidate.mappings, snapshot.review)).toThrow("export binding lost wordpunct_tokenize");
  expect(() => checkRouteRegression(candidate.reviewedRoutes, snapshot.reviewedRoutes)).toThrow("porterStemAscii");
});

test("candidate reviews isolate Unicode Porter and wordpunct helper routes from native/class conveniences", () => {
  const candidate = proposedNextReview(manifest);
  const targets = resolveTargets(candidate, snapshot);
  const porter = targets.find((row) => row.target === "nltk.stem.porter.PorterStemmer")!.mapping!;
  expect(porter.exports).toEqual(["PorterStemmer"]);
  expect(porter.category).toBe("rust-wasm");
  expect(porter.source.map((source) => source.file)).toContain("rust/src/porter_nltk.rs");
  expect(porter.source.map((source) => source.file)).not.toContain("rust/src/porter.rs");
  const helper = targets.find((row) => row.target === "nltk.tokenize.regexp.wordpunct_tokenize")!.mapping!;
  const tokenizer = targets.find((row) => row.target === "nltk.tokenize.regexp.WordPunctTokenizer")!.mapping!;
  expect(helper.exports).toEqual(["wordpunct_tokenize"]);
  expect(tokenizer.exports).not.toContain("wordpunct_tokenize");
  expect(helper.evidence).toEqual(["next-compat-wordpunct"]);
  expect(tokenizer.evidence).toEqual(["next-tokenizers"]);
  const exports = resolveBunExports(candidate, snapshot);
  expect(exports.find((row) => row.entrypoint === "." && row.name === "porterStemAscii")!.review).toBe("unreviewed");
  expect(exports.find((row) => row.entrypoint === "./tokenize" && row.name === "WordPunctTokenizer")!.review).toBe("unreviewed");
});

test("mixed generic object APIs and unreviewed parser/integration names never inherit Rust kernel coverage", () => {
  const candidate = proposedNextReview(manifest);
  const targets = resolveTargets(candidate, snapshot);
  for (const name of ["FreqDist", "MLEProbDist", "LidstoneProbDist"]) {
    expect(targets.find((row) => row.target === `nltk.probability.${name}`)!.category).toBe("ts-algorithm");
  }
  for (const name of ["MLEProbDist", "LidstoneProbDist"]) {
    expect(candidate.mappings.find((mapping) => mapping.target === `nltk.probability.${name}`)!.status).toBe("partial");
  }
  const sentence = candidate.mappings.find((mapping) => mapping.target.endsWith("sentence_chrf"))!;
  expect(sentence.status).toBe("partial");
  expect(candidate.evidence.find((entry) => entry.id === sentence.evidence[0])!.scope).toContain("not independently called");
  expect(targets.find((row) => row.target === "nltk.parse.chart.ChartParser")!.category).toBe("ts-algorithm");
  expect(targets.find((row) => row.target === "nltk.tree.tree.Tree")!.mapping).toBeNull();
  expect(targets.find((row) => row.target === "nltk.tokenize.regexp.RegexpTokenizer")!.mapping).toBeNull();
  expect(targets.find((row) => row.target === "nltk.stem.snowball.PorterStemmer")!.mapping).toBeNull();
  expect(candidate.mappings.filter((mapping) => mapping.category === "external-integration")).toEqual([]);
  expect(candidate.mappings.find((mapping) => mapping.target.endsWith("SklearnClassifier"))!.status).toBe("unsupported");
});

test("built Node/browser export observations do not become package-wide behavioral evidence", () => {
  const proc = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import * as node from './dist/portable/index.node.js';
    import * as browser from './dist/portable/index.browser.js';
    import * as parse from './dist/portable/rust_parse.js';
    const names = ['PorterStemmer','word_tokenize','wordpunct_tokenize','WordPunctTokenizer','FreqDist','MLEProbDist','jaccardDistance','sentenceChrF','CFG','RustCFG','ChartParser','Tree','RustEarleyParser','RegexpTokenizer','ngrams_iter','RustPCFG','RustViterbiParser','ProbabilisticProduction','RustPunktTokenizer','BinaryMaxentFeatureEncoding','TypedMaxentFeatureEncoding'];
    console.log(JSON.stringify({ exports: Object.fromEntries(names.map(name => [name, [name in node, name in browser]])),
      parse: ['RustPCFG','RustViterbiParser','ProbabilisticProduction'].map(name => name in parse),
      pcfgAlias: parse.PCFG === parse.RustPCFG, legacyRoot: node.PCFG !== parse.PCFG }));
  `], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const result = JSON.parse(new TextDecoder().decode(proc.stdout)) as {
    exports: Record<string, boolean[]>; parse: boolean[]; pcfgAlias: boolean; legacyRoot: boolean;
  };
  const observed = result.exports;
  for (const name of ["word_tokenize", "wordpunct_tokenize", "WordPunctTokenizer", "RustCFG", "Tree", "RustEarleyParser", "ngrams_iter"]) {
    expect(observed[name]).toEqual([true, true]);
  }
  for (const name of ["PorterStemmer", "FreqDist", "MLEProbDist", "jaccardDistance", "sentenceChrF", "CFG", "ChartParser", "BinaryMaxentFeatureEncoding", "TypedMaxentFeatureEncoding"]) {
    expect(observed[name]).toEqual([true, false]);
  }
  expect(observed.RegexpTokenizer).toEqual([false, false]);
  for (const name of ["RustPCFG", "RustViterbiParser", "ProbabilisticProduction", "RustPunktTokenizer"]) {
    expect(observed[name]).toEqual([false, false]);
  }
  expect(result.parse).toEqual([true, true, true]);
  expect(result.pcfgAlias).toBe(true);
  expect(result.legacyRoot).toBe(true);
  // Executing a browser-target JS file in Node is not a browser-host check.
  expect(Object.keys(snapshot.bunEntrypoints)).not.toContain("browser");
});
