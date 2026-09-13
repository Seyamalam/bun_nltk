import fixture from "../test/fixtures/statistical-parity.json";
const proc = Bun.spawnSync(
  [
    "bun",
    "test",
    "test/statistical_parity.test.ts",
    "test/classifier_strict.test.ts",
    "test/lm_strict.test.ts",
  ],
  { cwd: new URL("..", import.meta.url).pathname, stdout: "pipe", stderr: "pipe" },
);
const output = new TextDecoder().decode(proc.stdout) + "\n" + new TextDecoder().decode(proc.stderr);
const passed = Number(output.match(/\n\s*(\d+) pass\b/)?.[1] ?? 0);
const failed = Number(output.match(/\n\s*(\d+) fail\b/)?.[1] ?? -1);
const assertions = Number(output.match(/\n\s*(\d+) expect\(\) calls/)?.[1] ?? 0);
const parity = proc.exitCode === 0 && passed === 11 && failed === 0 && assertions > 34000;
console.log(
  JSON.stringify(
    {
      parity,
      passed,
      failed,
      assertions,
      lm_configurations: fixture.lm.length,
      classifier_scenarios: fixture.classifiers.length,
      nltk_unsupported_configurations: fixture.unsupported.length,
      nltk_unsupported_perplexities: fixture.unsupported_perplexities.length,
    },
    null,
    2,
  ),
);
if (!parity) {
  console.error(output);
  process.exitCode = 1;
}
