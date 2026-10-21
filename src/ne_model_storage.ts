/** Lossless on-disk mapping layout; inference still uses the original weight IDs. */
export type NeFeatureValue = string | number | boolean | null;
export type NeModel = {
  labels: string[];
  mapping: [string, NeFeatureValue, string, number][];
  weights: number[];
  alwaysOn: Record<string, number>;
  wordlist: string[];
};
export type CompactNeModel = Omit<NeModel, "mapping"> & {
  storageVersion: 2;
  featureNames: string[];
  mapping: [number, NeFeatureValue, number][];
};

export function compactNeModel(model: NeModel): CompactNeModel {
  const featureNames = [...new Set(model.mapping.map(([name]) => name))];
  const names = new Map(featureNames.map((name, index) => [name, index]));
  const labels = new Map(model.labels.map((label, index) => [label, index]));
  const ordered = model.mapping.toSorted((a, b) => a[3] - b[3]);
  const mapping: CompactNeModel["mapping"] = ordered.map(([name, value, label, index], expected) => {
    if (index !== expected || !labels.has(label)) throw new Error("NE mapping must have dense unique weight IDs and known labels");
    return [names.get(name)!, value, labels.get(label)!];
  });
  return { ...model, storageVersion: 2, featureNames, mapping };
}

export function expandNeModel(stored: NeModel | CompactNeModel): NeModel {
  if (!("storageVersion" in stored)) return stored;
  if (stored.storageVersion !== 2) throw new Error("Unsupported NE model storage version");
  const { storageVersion: _version, featureNames, mapping, ...model } = stored;
  return {
    ...model,
    mapping: mapping.map(([nameId, value, labelId], index) => {
      if (!Number.isInteger(nameId) || !Number.isInteger(labelId) ||
        featureNames[nameId] === undefined || model.labels[labelId] === undefined) {
        throw new Error("Invalid NE mapping dictionary index");
      }
      return [featureNames[nameId]!, value, model.labels[labelId]!, index];
    }),
  };
}
