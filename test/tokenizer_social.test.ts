import { expect, test } from "bun:test";
import { WasmNltk } from "../src/wasm.ts";
import { TweetTokenizer, ToktokTokenizer, MWETokenizer, RustTweetTokenizer } from "../src/tokenizers_social.ts";
import { socialCases } from "./tokenizer_social_cases.ts";

test("Tweet/Toktok/MWE Rust candidate matches pinned NLTK contracts", async () => {
  const cases = socialCases();
  const python = Bun.spawnSync([process.env.BUN_NLTK_PYTHON ?? "python3", "test/tokenizer_social_oracle.py"], {
    stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as (string | string[])[];
  const runtime = await WasmNltk.init({ wasmPath: process.env.BUN_NLTK_TOKENIZER_WASM });
  try {
    for (let i = 0; i < cases.length; i++) expect({ case: cases[i], result: runtime.socialTokenizer(cases[i]!) }).toEqual({ case: cases[i], result: expected[i]! });
    const digits = "1".repeat(40_000);
    const phoneTokens = runtime.socialTokenizer({ kind: "tweet", text: digits }) as string[];
    expect(phoneTokens.slice(0, -1).every((token) => token === "1".repeat(11))).toBe(true);
    expect(phoneTokens.join("")).toBe(digits);
    expect(runtime.socialTokenizer({ kind: "tweet", text: digits, match_phone_numbers: false })).toEqual([digits]);
  } finally { runtime.dispose(); }
});

test("social adapters preserve aliases, mutation and exact phrase removal", async () => {
  const runtime = await WasmNltk.init({ wasmPath: process.env.BUN_NLTK_TOKENIZER_WASM });
  try {
    const tweet = new RustTweetTokenizer({ preserve_case: false }, runtime);
    expect(tweet).toBeInstanceOf(TweetTokenizer);
    expect(tweet.tokenize_sents(["NLP :D", "café &amp; b"])).toEqual([["nlp", ":D"], ["café", "&", "b"]]);
    tweet.preserve_case = true; tweet.reduce_len = true; tweet.strip_handles = true;
    expect(tweet.tokenize("@abc waaaaay!!!")).toEqual(["waaay", "!", "!", "!"]);
    expect(new ToktokTokenizer(runtime).tokenize("café isn't bad.", true)).toBe("café isn ' t bad .");
    const mwe = new MWETokenizer([["a", "b"], ["a", "b", "c"], [" a", "b "]], "_", runtime);
    mwe.add_mwe(["a_b", "c"]); mwe.addMwe(["a_b", "c"]);
    expect(mwe.tokenize(["a", "b_c"])).toEqual(["a", "b_c"]);
    expect(mwe.tokenize([" a", "b "])).toEqual([" a_b "]);
    mwe.remove_mwe(["a", "b", "c"]);
    expect(mwe.tokenize(["a", "b", "c"])).toEqual(["a_b", "c"]);
    mwe.removeMwe(["a_b", "c"]);
    expect(mwe.tokenize(["a_b", "c"])).toEqual(["a_b", "c"]);
    mwe.addMwe(["a", "b", "c"]);
    expect(mwe.tokenize(["a", "b", "c"])).toEqual(["a_b_c"]);
    expect(() => mwe.tokenize([1] as unknown as string[])).toThrow(TypeError);
    expect(() => runtime.socialTokenizer({ kind: "tweet", text: "x", spans: true })).toThrow("does not implement span_tokenize");
    expect(() => tweet.tokenize("&#xD800;")).toThrow("non-scalar surrogate");
    expect(() => tweet.tokenize(5 as unknown as string)).toThrow(TypeError);
    expect(() => tweet.span_tokenize("x")).toThrow("does not implement span_tokenize");
    expect(() => new ToktokTokenizer(runtime).span_tokenize("x")).toThrow("does not implement span_tokenize");
    expect(() => mwe.span_tokenize(["x"])).toThrow("does not implement span_tokenize");
    const longPhrase = Array.from({ length: 4096 }, (_, i) => String(i));
    expect(new MWETokenizer([longPhrase], "_", runtime).tokenize(longPhrase)).toEqual([longPhrase.join("_")]);
  } finally { runtime.dispose(); }
});

test("social candidate retains input bounds and reports errors without poisoning output", async () => {
  const runtime = await WasmNltk.init({ wasmPath: process.env.BUN_NLTK_TOKENIZER_WASM, maxInputBytes: 256 });
  try {
    expect(() => new TweetTokenizer({}, runtime).tokenize("a".repeat(300))).toThrow(RangeError);
    expect(() => new MWETokenizer([["a".repeat(300)]], "_", runtime).tokenize(["a"])).toThrow(RangeError);
    expect(() => new TweetTokenizer({}, runtime).tokenize("&#xD800;")).toThrow("non-scalar surrogate");
    expect(new TweetTokenizer({}, runtime).tokenize("OK")).toEqual(["OK"]);
  } finally { runtime.dispose(); }
});
