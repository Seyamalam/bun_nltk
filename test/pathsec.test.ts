import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dataPath as _dp } from "../src/data";
import { join, resolve } from "node:path";
import {
  ZipFile,
  _ip_is_forbidden,
  urlopen,
  validate_network_url,
} from "../src/pathsec";
import { ipAddress } from "../src/ipaddr";

const ORACLE = resolve(import.meta.dir, "pathsec_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

const run = (req: object): any => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    stdin: Buffer.from(JSON.stringify(req)),
    env: { ...process.env, NLTK_DATA: resolve(import.meta.dir, "../.cache/nltk-data") },
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString());
};

const cap = (fn: () => unknown): { ok: boolean; type?: string; msg?: string } => {
  try { fn(); return { ok: true }; }
  catch (e: any) {
    return { ok: false, type: e?.name ?? e?.type ?? "Error", msg: String(e?.message ?? e).slice(0, 200) };
  }
};

const tmp = join(resolve(import.meta.dir, "../.cache/nltk-data"), "pathsec_test");
mkdirSync(tmp, { recursive: true });
if (!_dp.includes(resolve(tmp, ".."))) _dp.push(resolve(tmp, ".."));

const URLS = [
  "",
  "   ",
  "http://8.8.8.8/",
  "https://1.1.1.1:443/x",
  "http://127.0.0.1/",
  "http://10.0.0.1/x",
  "http://172.16.5.5/",
  "http://192.168.0.9/",
  "http://169.254.169.254/latest/meta-data",
  "http://100.64.1.2/",
  "http://0.0.0.0/",
  "http://[::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://[::ffff:8.8.8.8]/",
  "http://[::127.0.0.1]/",
  "http://[64:ff9b::7f00:1]/",
  "http://[2002:7f00:1::]/",
  "http://[2001::5efe:a9fe:a9fe]/",
  "http://[fe80::1]/",
  "http://[2606:4700:4700::1111]/",
  "ftp://host/path",
  "file://remotehost/etc/passwd",
  "file:///etc/passwd",
];

describe("nltk.pathsec network/zip parity (oracle: NLTK 3.10.3)", () => {
  test("validate_network_url outcomes match oracle (literal-IP + file + scheme)", () => {
    const filePath = join(tmp, "allowed.txt");
    writeFileSync(filePath, "nltk-pathsec-fixture");
    const urls = [...URLS, `file://${filePath}`, "file://localhost" + filePath];
    const oracle = run({ mode: "validate", urls }).results;
    const got = urls.map((u) => cap(() => validate_network_url(u)));
    for (let i = 0; i < urls.length; i++) {
      expect({ url: urls[i], ...got[i] }).toEqual({ url: urls[i], ...oracle[i] });
    }
  });

  test("_ip_is_forbidden classification matches Python ipaddress semantics", () => {
    for (const [ip, forbidden] of [
      ["127.0.0.1", true], ["8.8.8.8", false], ["10.255.255.1", true],
      ["169.254.0.1", true], ["100.64.0.1", true], ["192.0.0.9", false],
      ["192.0.0.170", true], ["224.0.0.1", true], ["240.1.2.3", true],
      ["::1", true], ["::ffff:127.0.0.1", true], ["2001:db8::1", true],
      ["2001:1::1", false], ["fc00::1", true], ["ff02::1", true],
    ] as const) {
      expect({ ip, got: _ip_is_forbidden(ipAddress(ip)) }).toEqual({ ip, got: forbidden });
    }
  });

  test("urlopen file:// returns contents like the oracle", async () => {
    const filePath = join(tmp, "data.bin");
    writeFileSync(filePath, "payload-\u00e9-bytes");
    const oracle = run({ mode: "urlopen_file", url: `file://${filePath}`, expect_path: filePath });
    expect(oracle.ok).toBe(true);
    const res = await urlopen(`file://${filePath}`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(readFileSync(filePath)));
    const denied = await urlopen("file:///etc/passwd").then(() => "ok", (e: any) => e?.name ?? "Error");
    expect(denied).toBe("PermissionError");
  });

  test("ZipFile namelist/read/extract match oracle; traversal rejected", () => {
    const safe = join(tmp, "safe.zip");
    const evil = join(tmp, "evil.zip");
    const outdir = join(tmp, "out");
    run({ mode: "make_zip", zip_mode: "safe", zip_path: safe });
    run({ mode: "make_zip", zip_mode: "evil", zip_path: evil });

    const oSafe = run({ mode: "zip", zip_path: safe, member: "hello.txt", extract_dir: outdir });
    const zf = new ZipFile(safe);
    expect(zf.namelist()).toEqual(oSafe.namelist);
    expect(cap(() => zf.read("hello.txt")).ok).toBe(oSafe.read.ok);
    expect(zf.read("hello.txt")).toEqual(new Uint8Array([104, 105, 32, 110, 108, 116, 107]));
    expect(cap(() => zf.extract("hello.txt", outdir)).ok).toBe(oSafe.extract.ok);
    expect(readFileSync(join(outdir, "hello.txt"))).toEqual(zf.read("hello.txt") as never);

    const oEvil = run({ mode: "zip", zip_path: evil, member: "../escape.txt", extract_dir: outdir });
    const zfE = new ZipFile(evil);
    expect(cap(() => zfE.extract("../escape.txt", outdir))).toMatchObject({ ok: false, type: oEvil.extract.type });
    expect(cap(() => zfE.extractall(outdir))).toMatchObject({ ok: false, type: oEvil.extractall.type });
    expect(cap(() => zfE.extract("ok.txt", outdir)).ok).toBe(true);
  });

  test("urlopen refuses proxied fetches like the oracle", async () => {
    const old = process.env["http_proxy"];
    process.env["http_proxy"] = "http://proxy.invalid:3128";
    try {
      const r = await urlopen("http://8.8.8.8/").then(() => "ok", (e: any) => e?.name ?? "Error");
      expect(r).toBe("PermissionError");
    } finally {
      if (old === undefined) delete process.env["http_proxy"]; else process.env["http_proxy"] = old;
    }
  });
});
