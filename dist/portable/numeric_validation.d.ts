export declare function assertU32(value: number, name: string, minimum?: number, maximum?: number): void;
export declare function assertProduct(left: number, right: number, name: string): number;
export declare function assertOffsets(offsets: Uint32Array, length: number, name: string, allowEmpty?: boolean): void;
export declare function assertFinite(values: Float32Array | Float64Array, name: string, length?: number): void;
export declare function assertPerceptronBuffers(featureIds: Uint32Array, offsets: Uint32Array, weights: Float32Array, featureCount: number, tagCount: number): void;
export declare function assertLinearTraining(input: {
    algorithm: string;
    epochs: number;
    learningRate: number;
    l2: number;
    margin?: number;
}): void;
