/** Portable, independently loaded parsing ABI. No Bun FFI or JS algorithm fallback. */
declare class ParsingRuntime {
    private readonly exports;
    private disposed;
    private constructor();
    static load(options?: {
        wasmBytes?: Uint8Array;
        wasmPath?: string;
        wasmUrl?: string;
    }): Promise<ParsingRuntime>;
    /** Internal typed marshaling boundary; only dedicated parsing classes issue requests. */
    request<T>(request: object): T;
    dispose(): void;
}

export { ParsingRuntime };
