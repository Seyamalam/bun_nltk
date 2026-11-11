import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { find } from "../src/data";
import {
  Deprecated,
  findBinaryIter,
  findFileIter,
  isWritable,
  overridden,
  readInt,
  readNumber,
  readStr,
} from "../src/internals";

const ORACLE = resolve(import.meta.dir, "internals_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

interface OracleCap {
  v?: string | number;
  end?: number;
  err?: string;
  msg?: string;
  expected?: string;
  position?: number;
}

const oracle = (() => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString().trim().split("\n").pop()!) as {
    read_str: OracleCap[];
    read_int: OracleCap[];
    read_number: OracleCap[];
    overridden: { sub_result: string; base_flag: boolean; sub_flag: boolean };
    deprecated: string[];
    find_file_iter: string[];
    find_binary: string[];
    writable: { file: boolean; ro: boolean; missing: boolean };
  };
})();

function cap<T>(fn: () => [T, number]): OracleCap {
  try {
    const [v, end] = fn();
    return { v: v as string | number, end };
  } catch (e) {
    const er = e as Error & { expected?: string; position?: number };
    return {
      err: er.name === "ReadError" ? "ReadError" : er.name,
      msg: er.message,
      expected: er.expected ?? null as unknown as string,
      position: er.position ?? null as unknown as number,
    };
  }
}

test("read_str matches oracle (literals, escapes, errors)", () => {
  const cases: Array<[string, number]> = [
    ['"Hello", World!', 0],
    ["x = 'it\\'s' + 3", 4],
    ['u"abc\\n"', 0],
    ['r"a\\tb"', 0],
    ['"""a\nb""" rest', 0],
    ["'tab\\there'", 0],
    ["noquote", 0],
    ["'unterminated", 0],
  ];
  const got = cases.map(([s, p]) => cap(() => readStr(s, p)));
  expect(got).toEqual(oracle.read_str);
});

test("read_int matches oracle", () => {
  const cases: Array<[string, number]> = [
    ["42 is the answer", 0],
    ["  -17 x", 2],
    ["abc", 0],
  ];
  expect(cases.map(([s, p]) => cap(() => readInt(s, p)))).toEqual(oracle.read_int);
});

test("read_number matches oracle", () => {
  const cases: Array<[string, number]> = [
    ["Pi is 3.14159", 6],
    ["-2.5e", 0],
    [".5", 0],
    ["3.", 0],
    ["-", 0],
    ["12x", 0],
  ];
  expect(cases.map(([s, p]) => cap(() => readNumber(s, p)))).toEqual(oracle.read_number);
});

test("overridden flags base/sub like oracle", () => {
  class EaterI {
    eat(food: string): string {
      if (overridden(this, "batch_eat")) return this.batch_eat([food])[0]!;
      throw new Error("NotImplementedError");
    }
    batch_eat(foods: string[]): string[] {
      return foods.map((f) => this.eat(f));
    }
  }
  class EaterSub extends EaterI {
    override batch_eat(foods: string[]): string[] {
      return foods.map((f) => "sub:" + f);
    }
  }
  expect(overridden(new EaterI(), "batch_eat")).toBe(oracle.overridden.base_flag);
  expect(overridden(new EaterSub(), "batch_eat")).toBe(oracle.overridden.sub_flag);
  expect(new EaterSub().eat("y")).toBe(oracle.overridden.sub_result);
});

test("Deprecated warns with oracle message", () => {
  class NewName {}
  void NewName;
  class OldName extends Deprecated {
    static doc = "Use NewName instead.";
  }
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (m?: unknown) => warnings.push(String(m));
  try {
    new OldName();
  } finally {
    console.warn = orig;
  }
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toBe(oracle.deprecated[0]);
});

test("find_file_iter/find_binary_iter + is_writable match oracle", () => {
  const td = mkdtempSync(join(tmpdir(), "nltk-int-"));
  try {
    const fpath = join(td, "toolx");
    writeFileSync(fpath, "x");
    chmodSync(fpath, 0o755);
    const binDir = join(td, "envroot", "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "toolx"), "x");
    mkdirSync(join(td, "sp"));
    writeFileSync(join(td, "sp", "toolx"), "x");
    chmodSync(join(binDir, "toolx"), 0o755);
    chmodSync(join(td, "sp", "toolx"), 0o755);

    const found = [...findFileIter("toolx", { searchpath: [join(td, "sp")] })].sort();
    const base = oracle.find_file_iter[0]!;
    expect(found.map((p) => p.replace(/^\/tmp\/[^/]+/, ""))).toEqual([base.replace(/^\/tmp\/[^/]+/, "")]);

    const cwd = process.cwd();
    process.chdir(td);
    try {
      const bin = [...findBinaryIter("toolx", { searchpath: [join(td, "sp")] })].sort();
      expect(bin.map((p) => p.replace(/^\/tmp\/[^/]+/, ""))).toEqual([base.replace(/^\/tmp\/[^/]+/, "")]);
    } finally {
      process.chdir(cwd);
    }

    expect(isWritable(fpath)).toBe(oracle.writable.file);
    expect(isWritable("/proc/version")).toBe(oracle.writable.ro);
    expect(isWritable(join(td, "nope"))).toBe(oracle.writable.missing);

    // nltk.data.find on a synthetic resource tree
    const dataRoot = join(td, "data");
    mkdirSync(join(dataRoot, "corpora", "toy"), { recursive: true });
    writeFileSync(join(dataRoot, "corpora", "toy", "a.txt"), "hi");
    const o = oracle.data_find as { hit: string; hit_file: string; miss: string };
    expect(String(find("corpora/toy", [dataRoot]))).toBe(o.hit.replace("<TD>", td));
    expect(String(find("corpora/toy/a.txt", [dataRoot]))).toBe(o.hit_file.replace("<TD>", td));
    expect(() => find("corpora/absent", [dataRoot])).toThrow();
  } finally {
    rmSync(td, { recursive: true, force: true });
  }
});
