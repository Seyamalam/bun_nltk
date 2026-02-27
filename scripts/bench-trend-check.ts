import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BenchHistory = {
  version: string;
  generated_at: string;
  speedups: Record<string, number>;
};

function semverTuple(v: string): [number, number, number] {
  const clean = v.replace(/^v/, "").split("-")[0]!;
  const [a, b, c] = clean.split(".").map((x) => Number(x));
  return [a || 0, b || 0, c || 0];
}

function semverLt(a: string, b: string): boolean {
  const aa = semverTuple(a);
  const bb = semverTuple(b);
  if (aa[0] !== bb[0]) return aa[0] < bb[0];
  if (aa[1] !== bb[1]) return aa[1] < bb[1];
  return aa[2] < bb[2];
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const dashboard = JSON.parse(readFileSync(resolve(root, "artifacts", "bench-dashboard.json"), "utf8")) as {
    speedups: Record<string, number>;
  };
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
  const currentVersion = `v${pkg.version}`;
  const historyDir = resolve(root, "bench", "history");
  const entries = JSON.parse(readFileSync(resolve(historyDir, "index.json"), "utf8")) as string[];
  const previous = [...entries].filter((v) => semverLt(v, currentVersion)).sort((a, b) => (semverLt(a, b) ? -1 : 1)).pop();
  if (!previous) {
    const report = { ok: true, skipped: true, reason: "no previous benchmark history entry" };
    writeFileSync(resolve(artifacts, "bench-trend-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const baseline = JSON.parse(readFileSync(resolve(historyDir, `${previous}.json`), "utf8")) as BenchHistory;
  const tolerance = Number(process.env.BENCH_TREND_MAX_REGRESSION_PCT ?? "55");
  const maxDrop = Math.max(0, tolerance) / 100;
  const failures: string[] = [];

  for (const [metric, baselineValue] of Object.entries(baseline.speedups)) {
    const currentValue = dashboard.speedups[metric];
    if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) continue;
    const floor = baselineValue * (1 - maxDrop);
    if (currentValue < floor) {
      failures.push(`${metric}: current=${currentValue.toFixed(4)} baseline=${baselineValue.toFixed(4)} floor=${floor.toFixed(4)}`);
    }
  }

  if (failures.length > 0) {
    const report = {
      ok: false,
      previous,
      tolerance_percent: tolerance,
      failures,
    };
    writeFileSync(resolve(artifacts, "bench-trend-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    throw new Error(`bench trend regression vs ${previous}:\n${failures.join("\n")}`);
  }

  const report = {
    ok: true,
    previous,
    tolerance_percent: tolerance,
  };
  writeFileSync(resolve(artifacts, "bench-trend-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
