import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

export const root = resolve(import.meta.dir, "../..");
export const manifestPath = resolve(root, "compatibility/inventory.json");
export const snapshotPath = resolve(root, "compatibility/discovery.json");

export type Category = "rust-native" | "rust-wasm" | "rust-core" | "ts-algorithm" | "external-integration" | "gap";
export type Evidence = {
  id: string;
  kind: "unit" | "wrapper" | "differential" | "integration";
  files: string[];
  anchor: string;
  scope: string;
  oracleVersion?: string;
};
export type Mapping = {
  target: string;
  exports: string[];
  category: Category;
  status: "partial" | "implemented-subset" | "unsupported";
  source: Array<{ file: string; anchor: string }>;
  signatures: { status: "partial" | "adapted" | "unreviewed" | "missing"; members: string[]; gaps: string[] };
  evidence: string[];
  fixtures: { status: "missing" | "unit-only" | "blocked-data" | "pinned-differential"; resources?: string[]; gaps: string[] };
  notes: string;
};
export type Manifest = {
  schemaVersion: number;
  nltkVersion: string;
  reviewBase: string;
  policy: Record<string, string>;
  modules: string[];
  excludedModules: Array<{ prefix: string; reason: string }>;
  dataResources: string[];
  evidence: Evidence[];
  signatureBindings: Array<{ target: string; callable: string; signature: string; file: string; anchor: string }>;
  mappings: Mapping[];
};
export type PythonTarget = {
  name: string;
  origin: string;
  kind: "class" | "function";
  signature: string | null;
  members: Record<string, string | null>;
};
export type ModuleDiscovery = { module: string; targets: PythonTarget[]; excludedAttributes: string[] };
export type OracleDiscovery = { nltkVersion: string; modules: ModuleDiscovery[]; resources: Record<string, "available" | "missing"> };
export type Snapshot = {
  schemaVersion: number;
  nltkVersion: string;
  modules: ModuleDiscovery[];
  bunEntrypoints: Record<string, Record<string, string[]>>;
  review: Mapping[];
  signatureBindings: Manifest["signatureBindings"];
  sourceHashes: Record<string, string>;
};

export function loadManifest(): Manifest {
  const value: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateManifest(value);
  return value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: expected object`);
  return value as Record<string, unknown>;
}
function strings(value: unknown, label: string, nonempty = true): asserts value is string[] {
  if (!Array.isArray(value) || (nonempty && value.length === 0) ||
      value.some((item: unknown) => typeof item !== "string" || !item.trim())) throw new Error(`${label}: expected string array`);
  if (new Set(value).size !== value.length) throw new Error(`${label}: duplicate strings`);
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}: expected nonempty text`);
}
function choice(value: unknown, choices: readonly string[], label: string): void {
  if (typeof value !== "string" || !choices.includes(value)) throw new Error(`${label}: invalid value ${String(value)}`);
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label}: expected nonempty array`);
  return value;
}
function sourcePath(value: unknown, label: string): asserts value is string {
  text(value, label);
  if (value.startsWith("/") || value.split("/").includes("..")) throw new Error(`${label}: must be repository-relative`);
}

/** Validate untrusted JSON without broad any facades or silently accepted enum values. */
export function validateManifest(value: unknown): asserts value is Manifest {
  const manifest = object(value, "inventory");
  if (manifest.schemaVersion !== 1) throw new Error("inventory: schemaVersion must be 1");
  if (manifest.nltkVersion !== "3.10.3") throw new Error("inventory: nltkVersion must be 3.10.3");
  if (typeof manifest.reviewBase !== "string" || !/^[a-f0-9]{7,40}$/.test(manifest.reviewBase)) throw new Error("inventory: reviewBase must be a commit ID");
  for (const key of ["publicNames", "classMembers", "bunExports", "behavior"]) text(object(manifest.policy, "policy")[key], `policy.${key}`);
  strings(manifest.modules, "modules");
  if (manifest.modules.some((name) => !/^nltk\.[a-z_]+(?:\.[a-z_]+)*$/.test(name))) throw new Error("modules: invalid NLTK module");
  strings(manifest.dataResources, "dataResources");
  const exclusions = array(manifest.excludedModules, "excludedModules");
  for (const item of exclusions) {
    const exclusion = object(item, "exclusion");
    text(exclusion.prefix, "exclusion.prefix");
    text(exclusion.reason, "exclusion.reason");
  }
  if (!exclusions.some((item) => object(item, "exclusion").prefix === "*")) throw new Error("exclusions: explicit remaining-module exclusion required");
  const evidenceIds = new Set<string>();
  const evidenceById = new Map<string, Record<string, unknown>>();
  for (const item of array(manifest.evidence, "evidence")) {
    const evidence = object(item, "evidence");
    text(evidence.id, "evidence.id");
    if (evidenceIds.has(evidence.id)) throw new Error(`duplicate evidence: ${evidence.id}`);
    evidenceIds.add(evidence.id);
    evidenceById.set(evidence.id, evidence);
    choice(evidence.kind, ["unit", "wrapper", "differential", "integration"], "evidence.kind");
    strings(evidence.files, "evidence.files");
    for (const file of evidence.files) sourcePath(file, "evidence.file");
    text(evidence.anchor, "evidence.anchor");
    text(evidence.scope, "evidence.scope");
    if (evidence.kind === "differential" && evidence.oracleVersion !== manifest.nltkVersion) throw new Error("differential evidence must pin oracleVersion");
  }
  const targets = new Set<string>();
  for (const item of array(manifest.mappings, "mappings")) {
    const mapping = object(item, "mapping");
    text(mapping.target, "mapping.target");
    if (targets.has(mapping.target)) throw new Error(`duplicate mapping: ${mapping.target}`);
    targets.add(mapping.target);
    if (!manifest.modules.some((module) => mapping.target === `${module}.${(mapping.target as string).split(".").at(-1)}`)) throw new Error(`target outside selected modules: ${mapping.target}`);
    strings(mapping.exports, "mapping.exports");
    choice(mapping.category, ["rust-native", "rust-wasm", "rust-core", "ts-algorithm", "external-integration", "gap"], "mapping.category");
    choice(mapping.status, ["partial", "implemented-subset", "unsupported"], "mapping.status");
    text(mapping.notes, "mapping.notes");
    const sources = array(mapping.source, "mapping.source");
    for (const item of sources) {
      const source = object(item, "source");
      sourcePath(source.file, "source.file");
      text(source.anchor, "source.anchor");
    }
    if (typeof mapping.category === "string" && mapping.category.startsWith("rust-") &&
        !sources.some((item) => String(object(item, "source").file).startsWith("rust/"))) throw new Error("Rust classification requires Rust source");
    const signatures = object(mapping.signatures, "signatures");
    choice(signatures.status, ["partial", "adapted", "unreviewed", "missing"], "signatures.status");
    strings(signatures.members, "signatures.members", false);
    strings(signatures.gaps, "signatures.gaps");
    strings(mapping.evidence, "mapping.evidence", false);
    for (const id of mapping.evidence) if (!evidenceIds.has(id)) throw new Error(`unknown evidence: ${id}`);
    const fixtures = object(mapping.fixtures, "fixtures");
    choice(fixtures.status, ["missing", "unit-only", "blocked-data", "pinned-differential"], "fixtures.status");
    strings(fixtures.gaps, "fixtures.gaps");
    if (fixtures.status === "blocked-data") {
      strings(fixtures.resources, "fixtures.resources");
      for (const resource of fixtures.resources) if (!manifest.dataResources.includes(resource)) throw new Error(`unknown data resource: ${resource}`);
    }
    const pinned = mapping.evidence.some((id) => evidenceById.get(id)?.kind === "differential");
    if ((fixtures.status === "pinned-differential" || mapping.status === "implemented-subset") && !pinned) throw new Error("implemented subset/pinned fixtures require differential evidence, not wrappers/imports");
    if (mapping.category === "gap" && mapping.status !== "unsupported") throw new Error("reviewed gap must be unsupported");
    if (mapping.category === "external-integration" && !mapping.evidence.some((id) => evidenceById.get(id)?.kind === "integration")) throw new Error("external integration needs real integration evidence");
  }
  const signatures = new Set<string>();
  for (const item of array(manifest.signatureBindings, "signatureBindings")) {
    const binding = object(item, "signatureBinding");
    for (const key of ["target", "callable", "signature", "anchor"]) text(binding[key], `signatureBinding.${key}`);
    sourcePath(binding.file, "signatureBinding.file");
    const target = binding.target as string;
    if (!targets.has(target) && !targets.has(target.split(".").slice(0, -1).join("."))) throw new Error(`signature binding outside reviewed mappings: ${target}`);
    if (signatures.has(target)) throw new Error(`duplicate signature binding: ${target}`);
    signatures.add(target);
  }
}

export function checkEvidenceFiles(manifest: Manifest): void {
  for (const binding of manifest.signatureBindings) {
    if (!readFileSync(resolve(root, binding.file), "utf8").includes(binding.anchor)) throw new Error(`stale signature anchor: ${binding.target}`);
  }
  for (const mapping of manifest.mappings) for (const source of mapping.source) {
    if (!readFileSync(resolve(root, source.file), "utf8").includes(source.anchor)) throw new Error(`stale source anchor: ${source.file} ${source.anchor}`);
  }
  for (const evidence of manifest.evidence) {
    const files = evidence.files.map((file) => readFileSync(resolve(root, file), "utf8"));
    if (!files.some((text) => text.includes(evidence.anchor))) throw new Error(`stale test anchor: ${evidence.id}`);
    if (evidence.kind === "differential" && !files.some((text) => text.includes("assert nltk.__version__ == '3.10.3'"))) throw new Error(`test no longer pins NLTK: ${evidence.id}`);
  }
}

export function sourceHashes(manifest: Manifest): Record<string, string> {
  const files = new Set([
    ...manifest.mappings.flatMap((mapping) => mapping.source.map((source) => source.file)),
    ...manifest.signatureBindings.map((binding) => binding.file),
    ...manifest.evidence.flatMap((evidence) => evidence.files),
  ]);
  return Object.fromEntries([...files].sort().map((file) => [file,
    createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")]));
}

export function discoverOracle(manifest: Manifest, python = "python3"): OracleDiscovery {
  const result = Bun.spawnSync([python, resolve(import.meta.dir, "discover_nltk.py")], {
    cwd: root, stdin: new TextEncoder().encode(JSON.stringify(manifest)), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (result.exitCode !== 0) throw new Error(`pinned oracle discovery failed:\n${new TextDecoder().decode(result.stderr)}`);
  return JSON.parse(new TextDecoder().decode(result.stdout)) as OracleDiscovery;
}

function bunTarget(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const conditions = value as Record<string, unknown>;
  return bunTarget(conditions.bun ?? conditions.default);
}

/** Runtime discovery records names/provenance only. It does not call NLP functions. */
export async function discoverBun(): Promise<Snapshot["bunEntrypoints"]> {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { exports: Record<string, unknown> };
  const entries = Object.entries(pkg.exports).flatMap(([name, value]) => {
    const path = bunTarget(value);
    return path?.endsWith(".ts") ? [[name, resolve(root, path)] as const] : [];
  });
  const scanner = new Bun.Transpiler({ loader: "ts" });
  const paths = new Set(entries.map(([, path]) => path));
  // Root reexport modules include the generated aliases. Provenance matching is
  // by value identity, never snake_case spelling or an assumed algorithm route.
  for (const entry of scanner.scan(readFileSync(resolve(root, "index.ts"), "utf8")).imports) {
    if (!entry.path.startsWith(".")) continue;
    const path = resolve(root, entry.path.endsWith(".ts") ? entry.path : `${entry.path}.ts`);
    paths.add(path);
  }
  const loaded = new Map<string, Record<string, unknown>>();
  await Promise.all([...paths].map(async (path) => { loaded.set(path, await import(path) as Record<string, unknown>); }));
  const origins = [...loaded].filter(([path]) => path !== resolve(root, "index.ts") &&
    !path.includes("/entrypoints/") && !path.endsWith("/nltk_aliases.ts"))
    .sort(([a], [b]) => a < b ? -1 : 1);
  const result: Snapshot["bunEntrypoints"] = {};
  for (const [entry, path] of entries.sort(([a], [b]) => a < b ? -1 : 1)) {
    const grouped: Record<string, string[]> = {};
    for (const [name, value] of Object.entries(loaded.get(path)!).sort(([a], [b]) => a < b ? -1 : 1)) {
      const source = (typeof value === "function" || (value && typeof value === "object"))
        ? origins.find(([, api]) => Object.values(api).includes(value))?.[0] : undefined;
      const origin = relative(root, source ?? path);
      (grouped[origin] ??= []).push(name);
    }
    result[entry] = Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => a < b ? -1 : 1));
  }
  return result;
}

export function validateDiscovery(manifest: Manifest, discovery: Snapshot): void {
  if (discovery.schemaVersion !== 1 || discovery.nltkVersion !== "3.10.3") throw new Error("snapshot must pin schema 1 and NLTK 3.10.3");
  if (JSON.stringify(discovery.modules.map((module) => module.module)) !== JSON.stringify(manifest.modules)) throw new Error("snapshot selected module scope drift");
  const targets = new Map<string, PythonTarget>(discovery.modules.flatMap((module) => module.targets.map((target) => [`${module.module}.${target.name}`, target] as const)));
  const exports = new Set(Object.values(discovery.bunEntrypoints).flatMap((groups) => Object.values(groups).flat()));
  for (const mapping of manifest.mappings) {
    const target = targets.get(mapping.target);
    if (!target) throw new Error(`target absent in pinned NLTK: ${mapping.target}`);
    for (const name of mapping.exports) if (!exports.has(name)) throw new Error(`Bun export absent: ${name}`);
    for (const member of mapping.signatures.members) if (!Object.hasOwn(target.members, member)) throw new Error(`NLTK member absent: ${mapping.target}.${member}`);
  }
  for (const binding of manifest.signatureBindings) {
    if (!targets.has(binding.target)) {
      const parts = binding.target.split(".");
      const member = parts.pop()!;
      if (!Object.hasOwn(targets.get(parts.join("."))?.members ?? {}, member)) throw new Error(`signature member absent: ${binding.target}`);
    }
    if (!exports.has(binding.callable.split(".")[0]!)) throw new Error(`signature callable export absent: ${binding.callable}`);
  }
}

export type ResolvedTarget = {
  target: string;
  canonical: string;
  mapping: Mapping | null;
  category: Category;
  signatureGaps: string[];
  missingMembers: string[];
  missingSignatureBindings: string[];
  fixtureStatus: Mapping["fixtures"]["status"];
};

/** Every discovered target gets an explicit classification, including gaps.
 * Imported/reexported NLTK classes share a canonical mapping, not new coverage.
 */
export function resolveTargets(manifest: Manifest, discovery: Snapshot): ResolvedTarget[] {
  const byTarget = new Map(manifest.mappings.map((mapping) => [mapping.target, mapping]));
  return discovery.modules.flatMap((module) => module.targets.map((target) => {
    const qualified = `${module.module}.${target.name}`;
    const canonical = `${target.origin}.${target.name}`;
    const mapping = byTarget.get(qualified) ?? byTarget.get(canonical) ?? null;
    return {
      target: qualified, canonical, mapping, category: mapping?.category ?? "gap",
      signatureGaps: mapping?.signatures.gaps ?? ["No reviewed Bun binding/signature; spelling matches are not implementations."],
      missingMembers: Object.keys(target.members).filter((member) => !mapping?.signatures.members.includes(member)),
      missingSignatureBindings: [qualified, ...Object.keys(target.members).map((member) => `${qualified}.${member}`)]
        .filter((name) => !manifest.signatureBindings.some((binding) => binding.target === name || binding.target === name.replace(qualified, canonical))),
      fixtureStatus: mapping?.fixtures.status ?? "missing",
    };
  }));
}

export function resolveBunExports(manifest: Manifest, discovery: Snapshot): Array<{
  entrypoint: string; name: string; provenance: string; categories: Category[]; targets: string[]; review: "reviewed" | "unreviewed";
}> {
  return Object.entries(discovery.bunEntrypoints).flatMap(([entrypoint, groups]) =>
    Object.entries(groups).flatMap(([provenance, names]) => names.map((name) => {
      const mappings = manifest.mappings.filter((mapping) => mapping.exports.includes(name));
      return { entrypoint, name, provenance,
        categories: mappings.length ? [...new Set(mappings.map((mapping) => mapping.category))] : ["gap" as const],
        targets: mappings.map((mapping) => mapping.target), review: mappings.length ? "reviewed" as const : "unreviewed" as const };
    })));
}

/** A snapshot refresh may add APIs, but cannot silently remove or weaken the
 * reviewed contract. Deliberate scope breaks require changing this gate policy.
 */
export function checkRegression(current: Mapping[], baseline: Mapping[]): void {
  const byTarget = new Map(current.map((mapping) => [mapping.target, mapping]));
  for (const previous of baseline) {
    const next = byTarget.get(previous.target);
    if (!next) throw new Error(`inventory regression: removed mapping ${previous.target}`);
    if (previous.status !== "unsupported" && next.status === "unsupported") throw new Error(`inventory regression: implementation lost ${previous.target}`);
    if (previous.status === "implemented-subset" && next.status !== "implemented-subset") throw new Error(`inventory regression: tested subset lost ${previous.target}`);
    if (previous.fixtures.status === "pinned-differential" && next.fixtures.status !== "pinned-differential") throw new Error(`inventory regression: pinned evidence lost ${previous.target}`);
    for (const member of previous.signatures.members) if (!next.signatures.members.includes(member)) throw new Error(`inventory regression: member lost ${previous.target}.${member}`);
    for (const name of previous.exports) if (!next.exports.includes(name)) throw new Error(`inventory regression: export binding lost ${name}`);
  }
}

export function checkSignatureRegression(current: Manifest["signatureBindings"], baseline: Manifest["signatureBindings"]): void {
  const targets = new Set(current.map((binding) => binding.target));
  for (const binding of baseline) if (!targets.has(binding.target)) throw new Error(`inventory regression: explicit signature binding lost ${binding.target}`);
}

export function summarize(manifest: Manifest, discovery: Snapshot): string {
  const byTarget = new Map(manifest.mappings.map((mapping) => [mapping.target, mapping]));
  const byFamily = new Map<string, { targets: number; reviewed: number; gaps: number; pinned: number; members: number; mappedMembers: number }>();
  for (const module of discovery.modules) for (const target of module.targets) {
    const family = module.module.split(".")[1]!;
    const row = byFamily.get(family) ?? { targets: 0, reviewed: 0, gaps: 0, pinned: 0, members: 0, mappedMembers: 0 };
    const mapping = byTarget.get(`${module.module}.${target.name}`) ?? byTarget.get(`${target.origin}.${target.name}`);
    row.targets++;
    row.members += Object.keys(target.members).length;
    if (mapping) {
      row.reviewed++;
      row.mappedMembers += mapping.signatures.members.length;
      if (mapping.fixtures.status === "pinned-differential") row.pinned++;
    }
    if (!mapping || mapping.category === "gap") row.gaps++;
    byFamily.set(family, row);
  }
  return [...byFamily].sort(([a], [b]) => a < b ? -1 : 1).map(([family, row]) =>
    `${family}: ${row.targets} discovered names, ${row.reviewed} reviewed mappings, ${row.gaps} gaps/unreviewed, ${row.pinned} scoped pinned evidence; ${row.mappedMembers}/${row.members} callable members mapped`).join("\n");
}

// Compact per-module/per-entrypoint lines avoid thousands of autogenerated
// member-signature lines while retaining inspectable, deterministic JSON.
export function serializeSnapshot(snapshot: Snapshot): string {
  const modules = snapshot.modules.map((module) => `    ${JSON.stringify(module)}`).join(",\n");
  const entries = Object.entries(snapshot.bunEntrypoints).map(([entry, groups]) => `    ${JSON.stringify(entry)}: ${JSON.stringify(groups)}`).join(",\n");
  const review = snapshot.review.map((mapping) => `    ${JSON.stringify(mapping)}`).join(",\n");
  return `{\n  "schemaVersion": 1,\n  "nltkVersion": "3.10.3",\n  "modules": [\n${modules}\n  ],\n  "bunEntrypoints": {\n${entries}\n  },\n  "sourceHashes": ${JSON.stringify(snapshot.sourceHashes)},\n  "signatureBindings": ${JSON.stringify(snapshot.signatureBindings)},\n  "review": [\n${review}\n  ]\n}\n`;
}

export function checkSnapshot(current: Snapshot, stored: Snapshot): void {
  for (const snapshot of [current, stored]) {
    if (snapshot.schemaVersion !== 1 || snapshot.nltkVersion !== "3.10.3") throw new Error("snapshot must pin schema 1 and NLTK 3.10.3");
  }
  if (serializeSnapshot(current) !== serializeSnapshot(stored)) throw new Error("compatibility inventory drift: public names, signatures, exports, or review changed; inspect diff then regenerate with --write");
}

export async function main(args: string[]): Promise<void> {
  if (args.some((arg) => !["--check", "--write", "--summary"].includes(arg)) || args.includes("--check") && args.includes("--write")) throw new Error("usage: bun scripts/compatibility/inventory.ts [--check | --write] [--summary]");
  const manifest = loadManifest();
  checkEvidenceFiles(manifest);
  const oracle = discoverOracle(manifest);
  const snapshot: Snapshot = { schemaVersion: 1, nltkVersion: oracle.nltkVersion, modules: oracle.modules, bunEntrypoints: await discoverBun(), review: manifest.mappings, signatureBindings: manifest.signatureBindings, sourceHashes: sourceHashes(manifest) };
  validateDiscovery(manifest, snapshot);
  if (args.includes("--write")) {
    if (existsSync(snapshotPath)) {
      const stored = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
      checkRegression(snapshot.review, stored.review);
      checkSignatureRegression(snapshot.signatureBindings, stored.signatureBindings);
    }
    writeFileSync(snapshotPath, serializeSnapshot(snapshot));
  }
  else {
    if (!existsSync(snapshotPath)) throw new Error("missing discovery snapshot; generate with --write");
    checkSnapshot(snapshot, JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot);
  }
  console.log(summarize(manifest, snapshot));
  console.log(`Oracle data (host observation, not checked-in parity): ${JSON.stringify(oracle.resources)}`);
  console.log("Inventory validated. Names/imports/signatures are not behavioral parity; unreviewed mappings remain gaps.");
}

if (import.meta.main) await main(process.argv.slice(2));
