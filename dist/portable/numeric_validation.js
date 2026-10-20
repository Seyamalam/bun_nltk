export function assertU32(value, name, minimum = 1, maximum = 4294967295) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}]`);
  }
}
export function assertProduct(left, right, name) {
  const product = left * right;
  if (!Number.isSafeInteger(product) || product < 0 || product > 4294967295) {
    throw new RangeError(`${name} exceeds the supported buffer length`);
  }
  return product;
}
export function assertOffsets(offsets, length, name, allowEmpty = false) {
  if (allowEmpty && offsets.length === 0 && length === 0)
    return;
  if (offsets[0] !== 0 || offsets[offsets.length - 1] !== length) {
    throw new RangeError(`${name} must cover the entire input starting at zero`);
  }
  for (let i = 1;i < offsets.length; i++) {
    if (offsets[i] < offsets[i - 1])
      throw new RangeError(`${name} must be nondecreasing`);
  }
}
export function assertFinite(values, name, length = values.length) {
  for (let i = 0;i < length; i++) {
    if (!Number.isFinite(values[i]))
      throw new RangeError(`${name} must contain only finite values`);
  }
}
export function assertPerceptronBuffers(featureIds, offsets, weights, featureCount, tagCount) {
  assertU32(featureCount, "modelFeatureCount", 0);
  assertU32(tagCount, "tagCount", 1, 65536);
  assertOffsets(offsets, featureIds.length, "tokenOffsets", true);
  if (offsets.length === 0)
    return;
  const weightCount = assertProduct(featureCount, tagCount, "weights");
  if (weights.length < weightCount)
    throw new RangeError("weights length must cover modelFeatureCount * tagCount");
  assertFinite(weights, "weights", weightCount);
}
export function assertLinearTraining(input) {
  assertU32(input.epochs, "epochs");
  if (input.algorithm !== "logistic" && input.algorithm !== "svm")
    throw new TypeError("algorithm must be logistic or svm");
  if (!Number.isFinite(input.learningRate) || input.learningRate <= 0 || !Number.isFinite(input.l2) || input.l2 < 0 || !Number.isFinite(input.margin ?? 1) || (input.margin ?? 1) <= 0) {
    throw new RangeError("learningRate and margin must be finite and positive; l2 must be finite and nonnegative");
  }
}
