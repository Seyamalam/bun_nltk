/**
 * Inference — resolution proof that Socrates is mortal
 * Run: bun run examples/inference_resolution.ts
 */
import { LogicParser } from "../src/sem_logic.ts";
import { ResolutionProverCommand } from "../src/inference_resolution.ts";

const lp = new LogicParser();
const assumptions = [
  lp.parse("all x.(man(x) -> mortal(x))"),
  lp.parse("man(socrates)"),
];
const goal = lp.parse("mortal(socrates)");

console.log("Assumptions:");
for (const a of assumptions) console.log(`  ${a.str()}`);
console.log(`Goal: ${goal.str()}`);

const cmd = new ResolutionProverCommand(goal, assumptions);
const proved = cmd.prove();
console.log(`\nProved: ${proved}`);
console.log("\nProof:");
console.log(cmd.proof());

if (!proved) {
  console.error("Expected proof to succeed");
  process.exit(1);
}
console.log("✓ Resolution proves mortal(socrates)");
