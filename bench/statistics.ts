export type BootstrapRatioInterval = {
  estimate: number;
  lower: number;
  upper: number;
  confidence: 0.95;
  iterations: number;
  seed: number;
  method: "percentile bootstrap of median ratio";
};

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one sample");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function quantile(sorted: readonly number[], probability: number): number {
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  const left = sorted[lower]!;
  const right = sorted[Math.min(lower + 1, sorted.length - 1)]!;
  return left + (right - left) * fraction;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function resampledMedian(values: readonly number[], random: () => number): number {
  const sample = Array.from(
    { length: values.length },
    () => values[Math.floor(random() * values.length)]!,
  );
  return median(sample);
}

export function bootstrapMedianRatio(
  baseline: readonly number[],
  candidate: readonly number[],
  options: { iterations?: number; seed?: number } = {},
): BootstrapRatioInterval {
  if (baseline.length < 2 || candidate.length < 2) {
    throw new Error("bootstrap median ratio requires at least two samples per implementation");
  }
  if ([...baseline, ...candidate].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("bootstrap samples must be finite and positive");
  }

  const iterations = options.iterations ?? 10_000;
  const seed = options.seed ?? 0x5eed2026;
  const random = mulberry32(seed);
  const ratios = Array.from({ length: iterations }, () => {
    const candidateMedian = resampledMedian(candidate, random);
    return resampledMedian(baseline, random) / candidateMedian;
  }).sort((left, right) => left - right);

  return {
    estimate: median(baseline) / median(candidate),
    lower: quantile(ratios, 0.025),
    upper: quantile(ratios, 0.975),
    confidence: 0.95,
    iterations,
    seed,
    method: "percentile bootstrap of median ratio",
  };
}
