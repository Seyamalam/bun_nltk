declare function assertU32(value: number, name: string, minimum?: number, maximum?: number): void;
declare function assertProduct(left: number, right: number, name: string): number;
declare function assertOffsets(offsets: Uint32Array, length: number, name: string, allowEmpty?: boolean): void;
declare function assertFinite(values: Float32Array | Float64Array, name: string, length?: number): void;
declare function assertPerceptronBuffers(featureIds: Uint32Array, offsets: Uint32Array, weights: Float32Array, featureCount: number, tagCount: number): void;
declare function assertLinearTraining(input: {
    algorithm: string;
    epochs: number;
    learningRate: number;
    l2: number;
    margin?: number;
}): void;

export { assertFinite, assertLinearTraining, assertOffsets, assertPerceptronBuffers, assertProduct, assertU32 };
