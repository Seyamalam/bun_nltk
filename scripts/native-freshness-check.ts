import { resolve } from "node:path";
import { artifactPath, hostStatus, inspectNativeArtifact, nativeTargets } from "./native-provenance";

export function freshnessMain(args = process.argv.slice(2)): void {
  if (args.some((arg) => arg !== "--strict")) throw new Error("usage: native-freshness-check.ts [--strict]");
  const root = resolve(import.meta.dir, "..");
  const artifacts = nativeTargets.map((target) => ({
    ...inspectNativeArtifact(root, target, artifactPath(root, target)),
    host_validation: hostStatus(target, process.platform, process.arch),
  }));
  const ok = artifacts.every((artifact) => artifact.status === "fresh");
  console.log(JSON.stringify({ schema_version: 1, ok, artifacts }, null, 2));
  // Report-only is intentionally nonfatal on a checkout with historical prebuilts.
  // Release callers can opt into failing on stale/unverified artifacts.
  if (args.includes("--strict") && !ok) process.exitCode = 1;
}

if (import.meta.main) freshnessMain();
