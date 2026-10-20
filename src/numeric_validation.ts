// ABI checks belong in the adapter so invalid dimensions cannot be coerced by FFI.
export function assertU32(value: number, name: string, minimum = 1, maximum = 0xffffffff): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}]`);
  }
}

export function assertProduct(left: number, right: number, name: string): number {
  const product = left * right;
  if (!Number.isSafeInteger(product) || product < 0 || product > 0xffffffff) {
    throw new RangeError(`${name} exceeds the supported buffer length`);
  }
  return product;
}

export function assertOffsets(offsets: Uint32Array, length: number, name: string, allowEmpty = false): void {
  if (allowEmpty && offsets.length === 0 && length === 0) return;
  if (offsets[0] !== 0 || offsets[offsets.length - 1] !== length) {
    throw new RangeError(`${name} must cover the entire input starting at zero`);
  }
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i]! < offsets[i - 1]!) throw new RangeError(`${name} must be nondecreasing`);
  }
}

export function assertFinite(values: Float32Array | Float64Array, name: string, length = values.length): void {
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(values[i])) throw new RangeError(`${name} must contain only finite values`);
  }
}

export function assertPerceptronBuffers(featureIds: Uint32Array, offsets: Uint32Array, weights: Float32Array, featureCount: number, tagCount: number): void {
  assertU32(featureCount, "modelFeatureCount", 0);
  assertU32(tagCount, "tagCount", 1, 65536);
  assertOffsets(offsets, featureIds.length, "tokenOffsets", true);
  if (offsets.length === 0) return;
  const weightCount = assertProduct(featureCount, tagCount, "weights");
  if (weights.length < weightCount) throw new RangeError("weights length must cover modelFeatureCount * tagCount");
  assertFinite(weights, "weights", weightCount);
}

export function assertLinearTraining(input: { algorithm: string; epochs: number; learningRate: number; l2: number; margin?: number }): void {
  assertU32(input.epochs, "epochs");
  if (input.algorithm !== "logistic" && input.algorithm !== "svm") throw new TypeError("algorithm must be logistic or svm");
  if (!Number.isFinite(input.learningRate) || input.learningRate <= 0
    || !Number.isFinite(input.l2) || input.l2 < 0
    || !Number.isFinite(input.margin ?? 1) || (input.margin ?? 1) <= 0) {
    throw new RangeError("learningRate and margin must be finite and positive; l2 must be finite and nonnegative");
  }
}
