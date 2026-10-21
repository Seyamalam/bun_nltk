export function valueKey(value) {
  if (value === null || value === undefined)
    return "null";
  if (typeof value === "string")
    return `string:${value}`;
  if (typeof value === "boolean")
    return `number:${Number(value)}`;
  if (typeof value === "number" && !Number.isNaN(value))
    return `number:${value}`;
  throw new TypeError("feature values must be strings, numbers other than NaN, booleans, null or undefined");
}
function entries(features) {
  if (!features || typeof features !== "object" || Array.isArray(features))
    throw new TypeError("features must be a dictionary");
  return Object.entries(features);
}
export function intern(map, key) {
  const existing = map.get(key);
  if (existing !== undefined)
    return existing;
  if (map.size >= 4294967295)
    throw new RangeError("too many classifier symbols");
  const id = map.size;
  map.set(key, id);
  return id;
}

export class FeatureEncoding {
  names = new Map;
  values = new Map([["null", 0]]);
  static fromMaps(names, values) {
    if (!Array.isArray(names) || !Array.isArray(values) || values[0] !== "null") {
      throw new TypeError("invalid feature encoding maps");
    }
    const encoding = new FeatureEncoding;
    encoding.names.clear();
    encoding.values.clear();
    for (const [id, name] of names.entries())
      encoding.names.set(name, id);
    for (const [id, value] of values.entries())
      encoding.values.set(value, id);
    if (encoding.names.size !== names.length || encoding.values.size !== values.length) {
      throw new TypeError("feature encoding maps contain duplicate entries");
    }
    return encoding;
  }
  trainingPairs(features) {
    return entries(features).flatMap(([name, value]) => [intern(this.names, name), intern(this.values, valueKey(value))]);
  }
  trainingGroup(features) {
    const pairs = [], offsets = [0];
    for (const row of features) {
      for (const value of this.trainingPairs(row))
        pairs.push(value);
      if (pairs.length > 4294967295)
        throw new RangeError("too many classifier feature pairs");
      offsets.push(pairs.length / 2);
    }
    return { pairs: Uint32Array.from(pairs), offsets: Uint32Array.from(offsets) };
  }
  predictionPairs(features) {
    const pairs = [];
    for (const [name, value] of entries(features)) {
      const key = valueKey(value);
      const id = this.names.get(name);
      if (id !== undefined)
        pairs.push(id, this.values.get(key) ?? 4294967295);
    }
    return Uint32Array.from(pairs);
  }
}
