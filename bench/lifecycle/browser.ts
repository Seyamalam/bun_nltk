import { measure } from "./workloads.mjs";

// Exported benchmark only: not a package surface and no JS NLP implementation.
export async function benchmark(rounds: number, repetitions: number) {
  return measure(async () => {
    const started = performance.now();
    const { WasmNltk } = await import("../../src/wasm.ts");
    const importSeconds = (performance.now() - started) / 1000;
    const fetchStart = performance.now();
    const response = await fetch("/kernel.wasm", { cache: "no-store" });
    if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { WasmNltk, bytes, importSeconds, fetchSeconds: (performance.now() - fetchStart) / 1000 };
  }, rounds, repetitions, () => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return { rss: null, heapUsed: memory?.usedJSHeapSize ?? null, heapTotal: memory?.totalJSHeapSize ?? null };
  }, () => {});
}
