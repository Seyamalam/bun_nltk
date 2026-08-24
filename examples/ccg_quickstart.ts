/**
 * CCG chart quickstart — parse "I sleep" → S
 * Run: bun run examples/ccg_quickstart.ts
 */
import { fromString } from "../src/ccg_lexicon.ts";
import { CCGChartParser, DefaultRuleSet } from "../src/ccg_chart.ts";

const lex = fromString(`
:- S, NP, N
NP :: NP
N :: N
Det :: NP/N
I => NP
sleep => S\\NP
`);

const parser = new CCGChartParser(lex, DefaultRuleSet);
const tokens = ["I", "sleep"];
const parses = parser.parse(tokens);

console.log(`Tokens: ${tokens.join(" ")}`);
console.log(`Parses spanning [0,${tokens.length}] ⇒ S: ${parses.length}`);
for (const p of parses) {
  console.log(`  ${p.lhs().toString()}  span=${p.span}`);
}
if (parses.length === 0) {
  console.error("No parse — expected S");
  process.exit(1);
}
console.log("✓ I sleep → S (CCG chart)");
