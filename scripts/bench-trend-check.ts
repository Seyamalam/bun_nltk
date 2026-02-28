import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BenchHistory = {
  version: string;
  generated_at: string;
  speedups: Record<string, number>;
};

type TrendConfig = {
  default_max_regression_pct: number;
  metric_max_regression_pct?: Record<string, number>;
  gate_min_speedup?: Record<string, number>;
  high_variance_multiplier?: number;
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

function loadTrendConfig(root: string): TrendConfig {
  const fallback: TrendConfig = {
    default_max_regression_pct: 55,
    metric_max_regression_pct: {},
    gate_min_speedup: {},
    high_variance_multiplier: 20,
  };
  try {
    const payload = JSON.parse(readFileSync(resolve(root, "bench", "trend-config.json"), "utf8")) as Partial<TrendConfig>;
    return {
      default_max_regression_pct:
        Number.isFinite(payload.default_max_regression_pct) && (payload.default_max_regression_pct as number) >= 0
          ? Number(payload.default_max_regression_pct)
          : fallback.default_max_regression_pct,
      metric_max_regression_pct: payload.metric_max_regression_pct ?? fallback.metric_max_regression_pct,
      gate_min_speedup: payload.gate_min_speedup ?? fallback.gate_min_speedup,
      high_variance_multiplier:
        Number.isFinite(payload.high_variance_multiplier) && (payload.high_variance_multiplier as number) > 0
          ? Number(payload.high_variance_multiplier)
          : fallback.high_variance_multiplier,
    };
  } catch {
    return fallback;
  }
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const config = loadTrendConfig(root);
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
  const tolerance = Number(process.env.BENCH_TREND_MAX_REGRESSION_PCT ?? String(config.default_max_regression_pct));
  const metricTolerance = config.metric_max_regression_pct ?? {};
  const gateFloors = config.gate_min_speedup ?? {};
  const varianceMultiplier = Math.max(1, Number(config.high_variance_multiplier ?? 20));
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const [metric, baselineValue] of Object.entries(baseline.speedups)) {
    const currentValue = dashboard.speedups[metric];
    if (!Number.isFinite(currentValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) continue;
    const metricTol = Number.isFinite(metricTolerance[metric]) ? Number(metricTolerance[metric]) : tolerance;
    const maxDrop = Math.max(0, metricTol) / 100;
    const trendFloor = baselineValue * (1 - maxDrop);
    const gateFloor = Number.isFinite(gateFloors[metric]) ? Number(gateFloors[metric]) : 0;
    const floor = Math.max(gateFloor, trendFloor);
    if (currentValue < floor) {
      const isHighVarianceMetric = gateFloor > 0 && baselineValue >= gateFloor * varianceMultiplier && currentValue >= gateFloor;
      if (isHighVarianceMetric) {
        warnings.push(
          `${metric}: high-variance drop tolerated (current=${currentValue.toFixed(4)} baseline=${baselineValue.toFixed(4)} trend_floor=${trendFloor.toFixed(4)} gate_floor=${gateFloor.toFixed(4)})`,
        );
      } else {
        failures.push(
          `${metric}: current=${currentValue.toFixed(4)} baseline=${baselineValue.toFixed(4)} floor=${floor.toFixed(4)} gate_floor=${gateFloor.toFixed(4)} tolerance_pct=${metricTol.toFixed(2)}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    const report = {
      ok: false,
      previous,
      tolerance_percent: tolerance,
      warnings,
      failures,
    };
    writeFileSync(resolve(artifacts, "bench-trend-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    throw new Error(`bench trend regression vs ${previous}:\n${failures.join("\n")}`);
  }

  const report = {
    ok: true,
    previous,
    tolerance_percent: tolerance,
    warnings,
  };
  writeFileSync(resolve(artifacts, "bench-trend-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
