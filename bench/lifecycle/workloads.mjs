// Versioned, resource-free workloads. Do not change v1 in place: hash pins live in pins.json.
export function workloads() {
  const block = "Alpha beta42 can't café 😀 e\u0301 中\u200d!\n";
  return [
    { id: "unicode-wordpunct-v1", kind: "wordpunct", text: block.repeat(128) },
    { id: "ascii-metrics-v1", kind: "ascii", text: "One two TWO can't 123!\n".repeat(4096), order: 3 },
    { id: "unicode-distance-v1", kind: "distance", pairs: [["kitten", "sitting"], ["😀aé", "a😀e\u0301"], ["", "中"], ["ab".repeat(64), "ba".repeat(64)]] },
  ];
}

export function run(runtime, task) {
  if (task.kind === "wordpunct") return runtime.tokenize(task.text, "wordpunct");
  if (task.kind === "ascii") {
    const m = runtime.computeAsciiMetrics(task.text, task.order);
    return [m.tokens, m.uniqueTokens, m.ngrams, m.uniqueNgrams];
  }
  return task.pairs.map(([a, b]) => runtime.editDistance(a, b));
}

export async function hash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export async function measure(load, rounds, repetitions, snapshot, coldReady) {
  const start = performance.now(), before = snapshot();
  const { WasmNltk, bytes, importSeconds, fetchSeconds } = await load();
  const initStart = performance.now();
  const runtime = await WasmNltk.init({ wasmBytes: bytes });
  const initSeconds = (performance.now() - initStart) / 1000;
  const tasks = workloads(), results = [];
  try {
    const firstStart = performance.now();
    const first = run(runtime, tasks[0]);
    const firstCallSeconds = (performance.now() - firstStart) / 1000;
    const coldSeconds = (performance.now() - start) / 1000;
    coldReady(); // Parent records process-launch-to-first-output separately.
    const afterFirst = snapshot();
    for (const task of tasks) {
      const expected = task === tasks[0] ? first : run(runtime, task);
      const outputSha256 = await hash(expected);
      run(runtime, task); // Explicit untimed warmup, same as Python.
      const samplesSeconds = [];
      for (let round = 0; round < rounds; round++) {
        let output;
        const started = performance.now();
        for (let i = 0; i < repetitions; i++) output = run(runtime, task);
        samplesSeconds.push((performance.now() - started) / 1000);
        if (await hash(output) !== outputSha256) throw new Error(`unstable output: ${task.id}`);
      }
      results.push({ id: task.id, inputSha256: await hash(task), outputSha256, samplesSeconds, repetitions });
    }
    const afterSteady = snapshot(), wasmLinearMemoryBytes = runtime.memoryBytes;
    runtime.dispose();
    return { importSeconds, fetchSeconds, initSeconds, firstCallSeconds, coldSeconds,
      memory: { before, afterFirst, afterSteady, afterDispose: snapshot(), wasmLinearMemoryBytes }, results };
  } finally { runtime.dispose(); }
}
