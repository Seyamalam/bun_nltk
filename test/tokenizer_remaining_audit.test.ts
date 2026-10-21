import { expect, test } from "bun:test";
import { MWETokenizer, ToktokTokenizer, TweetTokenizer } from "../src/tokenizers.ts";

test("remaining Tweet/Toktok/MWE APIs retain measured subset behavior, not full NLTK parity", () => {
  const script = `
import json, sys, nltk, regex
from nltk.tokenize import TweetTokenizer, ToktokTokenizer, MWETokenizer
assert sys.version_info[:3] == (3,14,4)
assert nltk.__version__ == '3.10.3'
assert regex.__version__ == '2026.9.29'
texts = ['café naïve 你好', 'a &amp; b', 'foo@example.com', 'Hi!!! :D <3']
print(json.dumps({
  'tweet': [TweetTokenizer().tokenize(s) for s in texts],
  'toktok': [ToktokTokenizer().tokenize(s) for s in texts],
  'trim': MWETokenizer([[' a','b ']]).tokenize(['a','b']),
  'collision': MWETokenizer([['a_b','c']]).tokenize(['a','b_c']),
  'longest': MWETokenizer([['a','b'],['a','b','c']]).tokenize(['a','b','c']),
}))
`;
  const proc = Bun.spawnSync(["python3", "-c", script], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const oracle = JSON.parse(new TextDecoder().decode(proc.stdout)) as { tweet: string[][]; toktok: string[][]; trim: string[]; collision: string[]; longest: string[] };
  const texts = ["café naïve 你好", "a &amp; b", "foo@example.com", "Hi!!! :D <3"];
  const tweet = texts.map((s) => new TweetTokenizer().tokenize(s));
  const toktok = texts.map((s) => new ToktokTokenizer().tokenize(s));
  expect(oracle.tweet).toEqual([["café", "naïve", "你好"], ["a", "&", "b"], ["foo@example.com"], ["Hi", "!", "!", "!", ":D", "<3"]]);
  expect(tweet).toEqual([["caf", "é", "na", "ï", "ve", "你", "好"], ["a", "&", "amp", ";", "b"], ["foo", "@example", ".", "com"], ["Hi", "!", "!", "!", ":D", "<", "3"]]);
  expect(toktok).toEqual([["caf", "é", "na", "ï", "ve", "你", "好"], ["a", "&", "amp", ";", "b"], ["foo", "@", "example", ".", "com"], ["Hi", "!", "!", "!", ":", "D", "<", "3"]]);
  expect(tweet).not.toEqual(oracle.tweet);
  expect(toktok).not.toEqual(oracle.toktok);
  expect(new MWETokenizer([[" a", "b "]]).tokenize(["a", "b"])).toEqual(["a_b"]);
  expect(oracle.trim).toEqual(["a", "b"]);
  expect(new MWETokenizer([["a_b", "c"]]).tokenize(["a", "b_c"])).toEqual(["a_b_c"]);
  expect(oracle.collision).toEqual(["a", "b_c"]);
  expect(new MWETokenizer([["a", "b"], ["a", "b", "c"]]).tokenize(["a", "b", "c"])).toEqual(oracle.longest);
});
