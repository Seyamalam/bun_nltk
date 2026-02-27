import { resolve } from "node:path";
import { sentenceTokenizePunkt, trainPunktModel } from "../index";

function main() {
  const trainText = [
    "Dr. Adams wrote a paper. Dr. Brown reviewed it.",
    "The U.S. team won. The match ended yesterday.",
    "Mr. Lee met Ms. Kim in Jan. They discussed results.",
  ].join(" ");
  const text = "Dr. Adams arrived yesterday. He presented the paper. Mr. Lee agreed.";

  const model = trainPunktModel(trainText);
  const js = sentenceTokenizePunkt(text, model);
  const proc = Bun.spawnSync(["python", "bench/python_punkt_baseline.py", "--train-text", trainText, "--text", text], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python punkt baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { sentences: string[] };
  const parity = JSON.stringify(js) === JSON.stringify(py.sentences);
  if (!parity) throw new Error("punkt parity failed");
  console.log(JSON.stringify({ parity, sentence_count: js.length }, null, 2));
}

main();

