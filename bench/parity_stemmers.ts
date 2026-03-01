import { resolve } from "node:path";
import {
  LancasterStemmer,
  RegexpStemmer,
  SnowballStemmer,
  WordNetLemmatizer,
} from "../index";

function main() {
  const words = ["running", "studies", "cats"];
  const payload = JSON.stringify({
    words,
    regex_pattern: "ing$",
    regex_min: 0,
  });
  const proc = Bun.spawnSync(["python", "bench/python_stemmers_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python stemmers baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    lancaster: string[];
    snowball: string[];
    regexp: string[];
  };

  const lancaster = new LancasterStemmer();
  const snowball = new SnowballStemmer("english");
  const regexp = new RegexpStemmer("ing$", 0);
  const lemmatizer = new WordNetLemmatizer();

  const js = {
    lancaster: words.map((word) => lancaster.stem(word)),
    snowball: words.map((word) => snowball.stem(word)),
    regexp: words.map((word) => regexp.stem(word)),
  };

  const parity = JSON.stringify(js) === JSON.stringify(py);
  if (!parity) {
    throw new Error(`stemmers parity failed:\njs=${JSON.stringify(js)}\npy=${JSON.stringify(py)}`);
  }

  const lemmatizerSanity = {
    dogs_n: lemmatizer.lemmatize("dogs", "n"),
    running_v: lemmatizer.lemmatize("running", "v"),
  };

  console.log(
    JSON.stringify(
      {
        parity,
        words: words.length,
        lemmatizer_sanity: lemmatizerSanity,
      },
      null,
      2,
    ),
  );
}

main();
