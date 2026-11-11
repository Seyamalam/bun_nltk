import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { BufferedGzipFile, dataPath, retrieve } from "../src/data";

const ORACLE = resolve(import.meta.dir, "data_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");
const ROOT = resolve(import.meta.dir, "../.cache/nltk-data");
const tmp = join(ROOT, "data_retrieve_test");
mkdirSync(tmp, { recursive: true });
if (!dataPath.includes(ROOT)) dataPath.push(ROOT);

const run = (req: object): any => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    stdin: Buffer.from(JSON.stringify(req)),
    env: { ...process.env, NLTK_DATA: ROOT },
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString());
};

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

const GZ = join(tmp, "fixture.gz");
const CONTENT = "hello\nworld\nthird line\n";
for (const f of ["dst.txt","dst2.txt","derived_check.txt","oracle_w.gz","ours_w.gz","src.txt"]) {
  try { rmSync(join(tmp, f)); } catch {}
}
for (const f of ["src.txt"]) { try { rmSync(join(tmp, "sub", f)); } catch {} }
run({ mode: "make_gz", path: GZ, content: CONTENT });

const oracle = run({ mode: "gzipfile", path: GZ, wpath: join(tmp, "oracle_w.gz") });
mkdirSync(join(tmp, "sub"), { recursive: true });
const oracleRet = (() => {
  const src = join(tmp, "src.txt");
  writeFileSync(src, "copy me é\n");
  return run({ mode: "retrieve", src: `file://${src}`, dst: join(tmp, "dst.txt"), workdir: join(tmp, "sub") });
})();

describe("nltk.data BufferedGzipFile + retrieve parity (oracle: NLTK 3.10.3)", () => {
  test("BufferedGzipFile read/line/tell/peek/seek match oracle", () => {
    const f = new BufferedGzipFile(GZ);
    expect(dec(f.read(5))).toBe(oracle.read5);
    expect(dec(f.readline())).toBe(oracle.readline);
    expect(f.tell()).toBe(oracle.tell);
    expect(dec(f.peek(2))).toBe(oracle.peek);
    expect(f.seek(0)).toBe(oracle.seek0);
    expect(f.readlines().map(dec)).toEqual(oracle.readlines);
    f.close();

    expect(oracle.has_size).toBe(false);
    const f2 = new BufferedGzipFile(GZ);
    f2.seek(10_000);
    expect(dec(f2.read())).toBe(oracle.eof_read);
    f2.close();
  });

  test("BufferedGzipFile write mode + error paths match oracle", () => {
    const wpath = join(tmp, "ours_w.gz");
    const w = new BufferedGzipFile(wpath, "wb");
    expect(oracle.write_ret).toBeNull();
    expect(w.write(new TextEncoder().encode("abc\n"))).toBeUndefined();
    w.write("def\n");
    w.close();
    expect(gunzipSync(readFileSync(wpath)).toString()).toBe("abc\ndef\n");
    expect(gunzipSync(readFileSync(join(tmp, "oracle_w.gz"))).toString()).toBe("abc\ndef\n");
    expect(() => new BufferedGzipFile(GZ, "zz")).toThrow(/Invalid mode/);
    const r = new BufferedGzipFile(GZ);
    let type = "ok";
    try { r.write(new Uint8Array([120])); } catch (e: any) { type = e.name; }
    expect(type).toBe(oracle.write_on_read.type);
    r.close();
  });

  test("BufferedGzipFile emits the oracle DeprecationWarning", () => {
    const dep = run({ mode: "deprecation" });
    expect(dep.warnings[0][0]).toBe("DeprecationWarning");
    const msgs: string[] = [];
    const orig = process.emitWarning.bind(process);
    (process as any).emitWarning = (m: unknown) => msgs.push(String(m));
    try { new BufferedGzipFile(GZ); } finally { (process as any).emitWarning = orig; }
    expect(msgs.some((m) => m.includes("BufferedGzipFile() has been deprecated"))).toBe(true);
  });

  test("retrieve copies file:// resource, errors on existing, derives name", async () => {
    const src = join(tmp, "src.txt");
    const dst = join(tmp, "dst2.txt");
    expect(oracleRet.first.ok).toBe(true);
    expect(oracleRet.stdout).toContain("Retrieving");
    expect(oracleRet.bytes_eq).toBe(true);
    expect(oracleRet.exists_again.type).toBe("ValueError");
    expect(oracleRet.derived).toContain("src.txt");

    await retrieve(`file://${src}`, { filename: dst });
    expect(readFileSync(dst)).toEqual(readFileSync(src));
    const again = await retrieve(`file://${src}`, { filename: dst }).then(() => "ok", (e: any) => e.name);
    expect(again).toBe("ValueError");
    const dst3 = join(tmp, "derived_check.txt");
    await retrieve(`file://${src}`, { filename: dst3, verbose: false });
    expect(existsSync(dst3)).toBe(true);
  });
});
