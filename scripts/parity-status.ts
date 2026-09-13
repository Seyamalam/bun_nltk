import { existsSync } from "node:fs";
export type ParityStatus = "passed" | "failed" | "skipped" | "unsupported";
export type CheckResult = {
  status: ParityStatus;
  required: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};
export function missingFixtureResult(paths: string[]): CheckResult | null {
  const missing = paths.filter((path) => !existsSync(path));
  return missing.length
    ? {
        status: "skipped",
        required: true,
        reason: `Required fixtures missing: ${missing.join(", ")}. Run fixtures:import:nltk.`,
      }
    : null;
}
export function classifyParity(
  exitCode: number,
  evidence: Record<string, unknown>,
  keys = ["parity"],
  required = true,
): CheckResult {
  if (exitCode !== 0)
    return { status: "failed", required, reason: `process exited ${exitCode}`, evidence };
  if (evidence.skipped || evidence.status === "skipped")
    return {
      status: "skipped",
      required,
      reason: String(evidence.reason ?? "check did not run"),
      evidence,
    };
  if (evidence.status === "unsupported")
    return {
      status: "unsupported",
      required,
      reason: String(evidence.reason ?? "unsupported"),
      evidence,
    };
  const value = keys.map((key) => evidence[key]).find((value) => value !== undefined);
  return {
    status: value === true ? "passed" : "failed",
    required,
    evidence,
    ...(value === true ? {} : { reason: `Correctness evidence ${keys.join(" or ")} did not pass` }),
  };
}
export function summarizeParity(results: Record<string, CheckResult>) {
  const counts = { passed: 0, failed: 0, skipped: 0, unsupported: 0 };
  for (const result of Object.values(results)) counts[result.status]++;
  return {
    ok: Object.values(results).every((result) => !result.required || result.status === "passed"),
    counts,
    checks: Object.fromEntries(
      Object.entries(results).map(([name, result]) => [name, result.status === "passed"]),
    ),
    results,
  };
}
