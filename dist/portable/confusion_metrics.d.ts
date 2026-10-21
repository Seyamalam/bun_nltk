/** NLTK accuracy: unequal lengths and an empty test are errors. */
declare function accuracy<T>(reference: ReadonlyArray<T>, test: ReadonlyArray<T>): number;
/** Sparse Rust counts, preserving JS label identities. Formatting is not implemented. */
declare class ConfusionMatrix<T = string> {
    readonly labels: T[];
    readonly correct: number;
    readonly total: number;
    /** Convenience score with the existing JS empty convention (zero). */
    readonly accuracy: number;
    private readonly ids;
    private readonly cells;
    private readonly lookup;
    constructor(reference: ReadonlyArray<T>, test: ReadonlyArray<T>);
    private id;
    get(reference: T, test: T): number;
    precision(label: T): number;
    recall(label: T): number;
    fMeasure(label: T, alpha?: number): number;
    f_measure(label: T, alpha?: number): number;
    /** Legacy dense output; capped explicitly rather than risking quadratic OOM. */
    toMatrix(): number[][];
}

export { ConfusionMatrix, accuracy };
