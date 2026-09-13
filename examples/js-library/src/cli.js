import { existsSync, readFileSync } from "node:fs";
import { analyzeDocument } from "./analyzer.js";

const args = process.argv.slice(2);
const input = args.join(" ").trim();

if (!input) {
  console.error("Usage: bun run cli -- <text or path-to-text-file>");
  process.exit(1);
}

const text = args.length === 1 && existsSync(args[0]) ? readFileSync(args[0], "utf8") : input;
console.log(JSON.stringify(analyzeDocument({ text, ngramSize: 2, topK: 12 }), null, 2));

