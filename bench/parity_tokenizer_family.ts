import { resolve } from "node:path";
import {
  mweTokenize,
  toktokTokenize,
  treebankWordTokenize,
  tweetTokenize,
  wordPunctTokenize,
} from "../index";

function main() {
  const textTreebank = "Can't stop .";
  const textWordpunct = "Can't stop.";
  const textToktok = "hello world .";
  const textTweet = "@Bot says HELLO #NLP :)";
  const tweetOptions = {
    preserveCase: false,
    stripHandles: true,
    reduceLen: true,
    matchPhoneNumbers: true,
  };

  const payload = JSON.stringify({
    text_treebank: textTreebank,
    text_wordpunct: textWordpunct,
    text_toktok: textToktok,
    text_tweet: textTweet,
    tweet_options: tweetOptions,
    mwe_tokens: ["in", "spite", "of", "that"],
    mwes: [["in", "spite", "of"]],
    separator: "_",
  });

  const proc = Bun.spawnSync(["python", "bench/python_tokenizer_family_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python tokenizer family baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    treebank: string[];
    wordpunct: string[];
    toktok: string[];
    tweet: string[];
    mwe: string[];
  };

  const js = {
    treebank: treebankWordTokenize(textTreebank),
    wordpunct: wordPunctTokenize(textWordpunct),
    toktok: toktokTokenize(textToktok),
    tweet: tweetTokenize(textTweet, tweetOptions),
    mwe: mweTokenize(["in", "spite", "of", "that"], [["in", "spite", "of"]], "_"),
  };

  const parity = JSON.stringify(js) === JSON.stringify(py);
  if (!parity) {
    throw new Error(
      `tokenizer family parity failed:\njs=${JSON.stringify(js)}\npy=${JSON.stringify(py)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        treebank_tokens: js.treebank.length,
        wordpunct_tokens: js.wordpunct.length,
        toktok_tokens: js.toktok.length,
        tweet_tokens: js.tweet.length,
      },
      null,
      2,
    ),
  );
}

main();
