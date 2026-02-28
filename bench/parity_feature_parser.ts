import { resolve } from "node:path";
import { featureChartParse, parseFeatureCfgGrammar } from "../index";

const grammarText = `
S[num=?n] -> NP[num=?n] VP[num=?n]
NP[num=sg] -> 'dog'
NP[num=pl] -> 'dogs'
VP[num=sg] -> 'runs'
VP[num=pl] -> 'run'
`;

function main() {
  const grammar = parseFeatureCfgGrammar(grammarText);
  const tokens = ["dog", "runs"];
  const jsTrees = featureChartParse(tokens, grammar);
  const bad = featureChartParse(["dog", "run"], grammar);
  const payload = JSON.stringify({ grammar: grammarText, tokens });
  const proc = Bun.spawnSync(["python", "bench/python_feature_parser_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { parse_count: number; trees: string[] };
  const parity = jsTrees.length === py.parse_count && jsTrees.length > 0 && bad.length === 0;
  if (!parity) {
    throw new Error(`feature parser parity failed: js=${jsTrees.length} py=${py.parse_count} bad=${bad.length}`);
  }
  console.log(JSON.stringify({ parity: true, parse_count: jsTrees.length }, null, 2));
}

main();
