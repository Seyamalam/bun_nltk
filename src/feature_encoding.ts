import type { FeatureSet, FeatureValue } from "./feature_types";

// Python hashes bool and equal numbers together; None represents missing values.
function valueKey(value: FeatureValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `string:${value}`;
  if (typeof value === "boolean") return `number:${Number(value)}`;
  if (typeof value === "number" && !Number.isNaN(value)) return `number:${value}`;
  throw new TypeError("feature values must be strings, numbers other than NaN, booleans, null or undefined");
}

function entries(features: FeatureSet): [string, FeatureValue][] {
  if (!features || typeof features !== "object" || Array.isArray(features)) throw new TypeError("features must be a dictionary");
  return Object.entries(features);
}

export function intern(map: Map<string, number>, key: string): number {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  if (map.size >= 0xffffffff) throw new RangeError("too many classifier symbols");
  const id = map.size;
  map.set(key, id);
  return id;
}

/** Lossless typed marshaling only; the Rust model owns all statistics. */
export class FeatureEncoding {
  readonly names = new Map<string, number>();
  private readonly values = new Map<string, number>([["null", 0]]);

  trainingPairs(features: FeatureSet): number[] {
    return entries(features).flatMap(([name, value]) => [intern(this.names, name), intern(this.values, valueKey(value))]);
  }

  trainingGroup(features: Iterable<FeatureSet>): { pairs: Uint32Array; offsets: Uint32Array } {
    const pairs: number[] = [], offsets = [0];
    for (const row of features) {
      for (const value of this.trainingPairs(row)) pairs.push(value);
      if (pairs.length > 0xffffffff) throw new RangeError("too many classifier feature pairs");
      offsets.push(pairs.length / 2);
    }
    return { pairs: Uint32Array.from(pairs), offsets: Uint32Array.from(offsets) };
  }

  predictionPairs(features: FeatureSet): Uint32Array {
    const pairs: number[] = [];
    for (const [name, value] of entries(features)) {
      const key = valueKey(value);
      const id = this.names.get(name);
      if (id !== undefined) pairs.push(id, this.values.get(key) ?? 0xffffffff);
    }
    return Uint32Array.from(pairs);
  }
}
