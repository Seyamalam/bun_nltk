import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkEvidenceFiles, checkRegression, checkSignatureRegression, checkSnapshot, discoverBun, discoverOracle,
  loadManifest, resolveBunExports, resolveTargets, serializeSnapshot, snapshotPath, sourceHashes, validateDiscovery, validateManifest,
  type Manifest, type Snapshot,
} from "../scripts/compatibility/inventory";

const manifest = loadManifest();
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
const copy = (): Manifest => structuredClone(manifest);

test("compatibility inventory pins schema, NLTK and an explicit module scope", () => {
  expect(manifest.nltkVersion).toBe("3.10.3");
  expect(manifest.schemaVersion).toBe(1);
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
});

test("pinned offline NLTK discovery is reproducible and rejects version/signature drift", () => {
  const first = discoverOracle(manifest);
  const second = discoverOracle(manifest);
  expect(first.nltkVersion).toBe("3.10.3");
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
