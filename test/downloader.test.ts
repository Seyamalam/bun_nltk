// Differential test for nltk.downloader vs the pinned NLTK 3.10.3 oracle.
// The oracle builds a private local data-server tree (file:// URLs only — no
// real network) under a shared tmp root, records scenario output to JSON, and
// this test replays the identical scenario sequence against the same files.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  build_index, Collection, defaultDownloader, Downloader,
  download as moduleDownload, type DownloaderMessage, md5_hexdigest, Package,
  sha256_hexdigest, unzip, update as moduleUpdate, xml_tostring,
} from "../src/downloader";
import { dataPath } from "../src/data";
import { parseXmlString } from "../src/xmldocs";

// Fixed short root: the oracle and the JS replay must see byte-identical path
// strings (paths appear inside textwrap'd download output, so differing path
// lengths would change wrapping). Rebuilt fresh below.
const ROOT = "/tmp/nltk_dl_test";
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(ROOT, { recursive: true });
chmodSync(ROOT, 0o700);
const SRV = join(ROOT, "server");
const SRV2 = join(ROOT, "server2");
const DL = join(ROOT, "dl");
const DL2 = join(ROOT, "dl2");
const DL3 = join(ROOT, "dl3");
const DL4 = join(ROOT, "dl4");
const DL5 = join(ROOT, "dl5");
const SLIP = join(ROOT, "slip.zip");
const INDEX_URL = `file://${SRV}/index.xml`;
const BASE_URL = `file://${SRV}/packages`;

function oracle(): Record<string, any> {
  const res = spawnSync("python3", ["test/downloader_oracle.py"], {
    encoding: "utf-8",
    env: { ...process.env, DL_ROOT: ROOT, NLTK_DATA: ROOT },
    input: "",
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}\n${res.stdout.slice(-2000)}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}
const o = oracle();

// Mirror nltk.data.path[0] = $NLTK_DATA for default_download_dir parity.
process.env.NLTK_DATA = ROOT;
dataPath.unshift(ROOT);

// ---- oracle-equivalent helpers ---------------------------------------------

async function errWrap<T>(f: () => Promise<T> | T): Promise<{ err: string | null; val: T | null }> {
  try {
    return { err: null, val: await f() };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    // 0xADDR: object-repr messages embed a per-process memory address.
    return { err: `${name}:${msg.slice(0, 400).replace(/0x[0-9a-fA-F]+/g, "0xADDR")}`, val: null };
  }
}

function patchStream(stream: { write: (s: string) => unknown }): { stop(): string } {
  const orig = stream.write;
  let buf = "";
  stream.write = (s: string) => { buf += String(s); return true; };
  return { stop() { stream.write = orig; return buf; } };
}

async function capStdout(f: () => Promise<unknown> | unknown): Promise<{ rv: unknown; out: string }> {
  const p = patchStream(process.stdout);
  const rv = (await f()) ?? null;
  return { rv, out: p.stop() };
}

async function capFdStderr(f: () => Promise<unknown> | unknown): Promise<{ rv: unknown; stderr: string }> {
  const p = patchStream(process.stderr);
  const rv = (await f()) ?? null;
  return { rv, stderr: p.stop() };
}

async function capWarnings(f: () => Promise<unknown> | unknown): Promise<{ rv: unknown; warnings: string[] }> {
  const orig = (process as any).emitWarning;
  const warnings: string[] = [];
  (process as any).emitWarning = (w: unknown, t?: unknown) => {
    warnings.push(`${typeof t === "string" ? t : "Warning"}:${String(w)}`);
  };
  try {
    return { rv: (await f()) ?? null, warnings };
  } finally {
    (process as any).emitWarning = orig;
  }
}

async function capDl(
  f: (stream: { write(s: string): boolean }) => Promise<unknown>,
): Promise<{ rv: unknown; stdout: string; derr: string; err: string | null }> {
  const out = patchStream(process.stdout);
  const derr: string[] = [];
  const stream = { write: (s: string) => { derr.push(s); return true; } };
  let rv: unknown = null;
  let err: string | null = null;
  try {
    rv = await f(stream);
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    err = `${name}:${msg.slice(0, 400)}`;
  }
  return { rv, stdout: out.stop(), derr: derr.join(""), err };
}

async function msgs(gen: AsyncGenerator<DownloaderMessage>): Promise<{ seq: unknown[]; err: string | null }> {
  const seq: unknown[] = [];
  let err: string | null = null;
  try {
    for await (const m of gen) {
      const a = m as Record<string, any>;
      const pkg = a["package"];
      const col = a["collection"];
      seq.push({
        t: m.constructor.name,
        progress: a["progress"] ?? null,
        pkg: pkg !== null && typeof pkg === "object" ? pkg.id : (pkg ?? null),
        col: col !== null && typeof col === "object" ? col.id : (col ?? null),
        msg: a["message"] ?? null,
        dir: a["download_dir"] ?? null,
      });
    }
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    err = `${name}:${msg.slice(0, 400)}`;
  }
  return { seq, err };
}

function snapshot(base: string): Record<string, string> {
  const entries: Record<string, string> = {};
  if (!existsSync(base)) return entries;
  const visit = (dir: string, rel: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        entries[r] = "<dir>";
        visit(full, r);
      } else {
        entries[r] = createHash("sha256").update(readFileSync(full)).digest("hex");
      }
    }
  };
  visit(base, "");
  return entries;
}

async function statuses(d: Downloader, ids: string[], ddir: string) {
  const r: Record<string, unknown> = {};
  for (const i of ids) {
    r[i] = {
      status: await d.status(i, ddir),
      installed: await d.is_installed(i, ddir),
      stale: await d.is_stale(i, ddir),
    };
  }
  return r;
}

function pkgSer(p: Package) {
  return {
    repr: String(p), str: String(p), id: p.id, name: p.name, subdir: p.subdir,
    size: p.size, unzipped_size: p.unzipped_size, checksum: p.checksum,
    sha256: p["sha256_checksum"] ?? null, url: p.url, license: p.license,
    author: p.author, copyright: p.copyright, contact: p.contact,
    webpage: p["webpage"] ?? null, provides: p["provides"] ?? null,
    svn_revision: p["svn_revision"] ?? null, extra: p["extra"] ?? null,
    unzip: p.unzip, filename: p.filename,
  };
}

const ALL_IDS = ["abc", "big", "rawdata", "tagger", "corrupt", "badmd5", "badsize",
  "md5only", "sneaky", "mini", "all", "all2"];

const d = new Downloader(INDEX_URL);

// ---- replay ---------------------------------------------------------------

describe("nltk.downloader vs 3.10.3 oracle", () => {

  test("build_index output is byte-identical", async () => {
    const w = await capWarnings(() => xml_tostring(build_index(SRV, BASE_URL)));
    expect(w.rv).toBe(o["index_xml"]);
    // oracle built the index before the injected zips existed, so it only saw
    // the orphan warning; our tree additionally warns for each injected zip.
    const expected = [...o["build_index_warnings"],
      ...["corrupt", "badmd5", "badsize", "md5only", "sneaky"].map((n) =>
        `UserWarning:${n}.zip exists, but ${n}.xml cannot be found! ` +
        `This could mean that ${n} can not be downloaded.`)].sort();
    expect([...w.warnings].sort()).toEqual(expected);
    expect(readFileSync(join(SRV, "index.xml"), "utf-8")).toBe(o["final_index_xml"]);
  });

  test("index load + package/collection attrs", async () => {
    const r = await capStdout(async () => { await d.packages(); await d.collections(); });
    expect(r.out).toBe(o["index_load"]["stdout"]);
    expect((await d.packages()).map((p) => p.id).sort()).toEqual(o["pkg_ids"]);
    expect((await d.collections()).map((c) => c.id).sort()).toEqual(o["coll_ids"]);
    expect((await d.corpora()).map((p) => p.id).sort()).toEqual(o["corpora_ids"]);
    expect((await d.models()).map((p) => p.id).sort()).toEqual(o["models_ids"]);
    expect((await d.packages()).map(pkgSer)).toEqual(o["pkgs"]);
    const colls = (await d.collections()).map((c) => ({
      repr: String(c), id: c.id, name: c.name,
      children: c.children.map((ch) =>
        `${typeof ch === "string" ? "str" : ch.constructor.name}:${typeof ch === "string" ? ch : ch.id}`),
      packages: c.packages!.map((p) => p.id),
    }));
    expect(colls).toEqual(o["colls"]);
    expect(pkgSer(await d.info("abc") as Package)).toEqual(o["info_abc"]);
    expect(await errWrap(() => d.info("nope"))).toEqual(o["info_err"]);
    expect(xml_tostring(await d.xmlinfo("abc"))).toBe(o["xmlinfo_abc"]);
    expect(("<?xml version='1.0' encoding='utf8'?>\n" + xml_tostring(await d.index()))
      .replace(/\s+$/, "")).toBe(o["index_str"]);
  });

  test("status() / is_installed / is_stale before", async () => {
    expect(await statuses(d, ALL_IDS, DL)).toEqual(o["statuses_before"]);
    expect(await d.status("abc")).toBe(o["status_abc_default"]);
  });

  test("list() output", async () => {
    const r = await capStdout(() => d.list({ download_dir: DL }));
    expect(r.out).toBe(o["list_out"]);
  });

  test("incr_download messages (fresh package)", async () => {
    expect(await msgs(d.incr_download("abc", DL))).toEqual(o["msgs_fresh"]);
    expect(snapshot(DL)).toEqual(o["snapshot_abc"]);
    expect({
      abc: (await statuses(d, ["abc"], DL))["abc"],
      abc_default: await d.status("abc"),
      mini_dl: await d.status("mini", DL),
      mini_default: await d.status("mini"),
    }).toEqual(o["statuses_after_abc"]);
  });

  test("download: up-to-date / force / quiet", async () => {
    expect(await capDl((s) => d.download("abc", DL, { print_error_to: s }))).toEqual(o["dl_abc_again"]);
    expect(await capDl((s) => d.download("abc", DL, { print_error_to: s, force: true }))).toEqual(o["dl_abc_force"]);
    expect(await capDl((s) => d.download("abc", DL, { print_error_to: s, quiet: true, force: true }))).toEqual(o["dl_abc_quiet"]);
    expect(await msgs(d.incr_download("abc", DL))).toEqual(o["msgs_uptodate"]);
  });

  test("download: collections (nested, %r repr, prefix nesting)", async () => {
    expect(await capDl((s) => d.download("mini", DL, { print_error_to: s }))).toEqual(o["dl_coll_mini"]);
    expect(await capDl((s) => d.download("all", DL, { print_error_to: s }))).toEqual(o["dl_coll_all"]);
    expect(await statuses(d, ALL_IDS, DL)).toEqual(o["statuses_after_colls"]);
  });

  test("download: unknown id + halt/raise flags", async () => {
    expect(await capDl((s) => d.download("nope", DL, { print_error_to: s }))).toEqual(o["dl_nope"]);
    expect(await capDl((s) => d.download("nope", DL, { print_error_to: s, raise_on_error: true }))).toEqual(o["dl_nope_raise"]);
    expect(await capDl((s) => d.download("nope", DL, { print_error_to: s, halt_on_error: false, quiet: true }))).toEqual(o["dl_nope_nohalt_quiet"]);
  });

  test("download: corrupt zip + integrity failures + cross-package", async () => {
    expect(await capDl((s) => d.download("corrupt", DL, { print_error_to: s }))).toEqual(o["dl_corrupt"]);
    expect(await capDl((s) => d.download("badmd5", DL, { print_error_to: s }))).toEqual(o["dl_badmd5"]);
    expect(await capDl((s) => d.download("badsize", DL, { print_error_to: s }))).toEqual(o["dl_badsize"]);
    expect(await capDl((s) => d.download("sneaky", DL, { print_error_to: s }))).toEqual(o["dl_sneaky"]);
    expect(await capDl((s) => d.download("all2", DL, { print_error_to: s }))).toEqual(o["dl_all2"]);
  });

  test("download: list input + incr_download rescaling", async () => {
    expect(await capDl((s) => d.download(["big", "rawdata"], DL, { print_error_to: s }))).toEqual(o["dl_list_input"]);
    expect(await msgs(d.incr_download(["mini", "tagger"], DL))).toEqual(o["msgs_coll_list"]);
    expect(await msgs(d.incr_download("corrupt", DL))).toEqual(o["msgs_corrupt"]);
    expect(await msgs(d.incr_download("nope", DL))).toEqual(o["msgs_nope"]);
  });

  test("SelectDownloadDirMessage + default dir download", async () => {
    const d2 = new Downloader(INDEX_URL);
    expect(await msgs(d2.incr_download("rawdata"))).toEqual(o["msgs_default_dir"]);
    expect(await d2.status("rawdata")).toBe(o["rawdata_default_status"]);
    expect(d2.download_dir).toBe(o["dl_default_dir_prop"]);
  });

  test("default print_error_to route is real stderr", async () => {
    expect(await capFdStderr(() => d.download("big", DL))).toEqual(o["dl_default_stderr"]);
  });

  test("unzipdir gone -> NOT_INSTALLED -> re-unzip without re-download", async () => {
    rmSync(join(DL, "corpora/abc"), { recursive: true });
    expect(await statuses(d, ["abc", "rawdata"], DL)).toEqual(o["status_unzipdir_gone"]);
    expect(await capDl((s) => d.download("abc", DL, { print_error_to: s }))).toEqual(o["dl_abc_reunzip"]);
  });

  test("unzipdir is a file -> STALE -> extraction error", async () => {
    rmSync(join(DL, "corpora/abc"), { recursive: true });
    writeFileSync(join(DL, "corpora/abc"), "i am a file, not a dir");
    expect(await statuses(d, ["abc"], DL)).toEqual(o["status_unzipdir_file"]);
    expect(await capDl((s) => d.download("abc", DL, { print_error_to: s }))).toEqual(o["dl_abc_unzipdir_file"]);
    rmSync(join(DL, "corpora/abc"));
    rmSync(join(DL, "corpora/abc.zip"));
  });

  test("dl2 hand-built statuses + missing-sha256 warning once", async () => {
    mkdirSync(join(DL2, "corpora"), { recursive: true });
    copyFileSync(join(SRV, "packages/corpora/big.zip"), join(DL2, "corpora/big.zip"));
    copyFileSync(join(SRV, "packages/corpora/rawdata.zip"), join(DL2, "corpora/rawdata.zip"));
    writeFileSync(join(DL2, "corpora/badsize.zip"), "tiny");
    // oracle staged the timestamped zip under fixtures/ for byte-identity.
    copyFileSync(join(ROOT, "fixtures/badmd5.zip"), join(DL2, "corpora/badmd5.zip"));
    copyFileSync(join(SRV, "packages/corpora/abc.zip"), join(DL2, "corpora/md5only.zip"));
    copyFileSync(join(SRV, "packages/taggers/tagger.zip"), join(DL2, "corpora/tagger.zip"));
    mkdirSync(join(DL2, "corpora/tagger"), { recursive: true });
    writeFileSync(join(DL2, "corpora/tagger/m.bin"), "wrong");

    const w1 = await capWarnings(() => d.status("md5only", DL2));
    const w2 = await capWarnings(() => d.status("md5only", DL2));
    expect(await statuses(d, ["big", "rawdata", "badsize", "badmd5", "md5only", "tagger"], DL2))
      .toEqual(o["dl2_statuses"]);
    expect(w1).toEqual(o["warn_md5_first"]);
    expect(w2).toEqual(o["warn_md5_second"]);
  });

  test("unzip=0: UpToDate on zip-only, fresh download skips unzip", async () => {
    expect(await capDl((s) => d.download("rawdata", DL2, { print_error_to: s }))).toEqual(o["dl2_rawdata"]);
    expect(await capDl((s) => d.download("rawdata", DL4, { print_error_to: s }))).toEqual(o["dl4_rawdata"]);
    expect(await statuses(d, ["rawdata"], DL4)).toEqual(o["dl4_rawdata_status"]);
  });

  test("update() re-downloads only stale packages", async () => {
    writeFileSync(join(DL, "corpora/abc.zip"), "garbage-not-the-real-zip");
    expect(await statuses(d, ["abc"], DL)).toEqual(o["status_abc_stale"]);
    d.download_dir = DL;
    expect(await capFdStderr(() => d.update())).toEqual(o["update_stderr"]);
    expect(await statuses(d, ["abc"], DL)).toEqual(o["status_abc_post_update"]);
  });

  test("list() variants", async () => {
    expect((await capStdout(() => d.list({ download_dir: DL, skip_installed: true }))).out)
      .toBe(o["list_skip_installed"]);
    expect((await capStdout(() => d.list({ download_dir: DL, show_collections: false }))).out)
      .toBe(o["list_pkgs_only"]);
    expect((await capStdout(() => d.list({ download_dir: DL, show_packages: false }))).out)
      .toBe(o["list_colls_only"]);
  });

  test("unzip() module fn: verbose output, corrupt, zip-slip", async () => {
    expect(await capStdout(() => unzip(join(SRV, "packages/corpora/abc.zip"), DL3, true)))
      .toEqual(o["unzip_verbose"]);
    expect(snapshot(DL3)).toEqual(o["unzip_verbose_files"]);
    expect(await errWrap(() => unzip(join(SRV, "packages/corpora/corrupt.zip"), DL3, false)))
      .toEqual(o["unzip_corrupt"]);
    expect(await errWrap(() => unzip(SLIP, DL3, false))).toEqual(o["unzip_slip"]);
    expect(snapshot(DL3)).toEqual(o["unzip_slip_files"]);
  });

  test("Package/Collection constructors + fromxml + repr", async () => {
    expect(await errWrap(() => new Package({ id: "a/b", url: "u", size: "1", unzipped_size: "1" } as any)))
      .toEqual(o["pkg_ctor_badid"]);
    expect(await errWrap(() => new Package({ id: "x", url: "u", size: "1", unzipped_size: "1", subdir: ".." } as any)))
      .toEqual(o["pkg_ctor_badsubdir"]);
    expect(await errWrap(() => new Package({ id: "x", url: "u" } as any)))
      .toEqual(o["pkg_ctor_nosize"]);
    expect(pkgSer(Package.fromxml(parseXmlString(
      '<package id="px" url="u/px.zip" size="5" unzipped_size="9" checksum="c" unzip="0" extra="E" webpage="w"/>'))))
      .toEqual(o["pkg_fromxml"]);
    const cx = Collection.fromxml(parseXmlString('<collection id="cx"><item ref="a"/><item ref="b"/></collection>'));
    expect({ id: cx.id, children: cx.children, name: cx.name }).toEqual(o["coll_fromxml"]);
    expect(String((d as any)._collections.get("all"))).toBe(o["pkg_repr_coll"]);
  });

  test("checksum helpers", () => {
    expect(md5_hexdigest(join(SRV, "packages/corpora/abc.zip"))).toBe(o["md5_abc"]);
    expect(sha256_hexdigest(join(SRV, "packages/corpora/abc.zip"))).toBe(o["sha256_abc"]);
  });

  test("props: default_download_dir / url / download_dir / url setter", async () => {
    expect(d.default_download_dir()).toBe(o["default_download_dir"]);
    expect(d.url).toBe(o["url_get"]);
    expect(d.download_dir).toBe(o["download_dir_prop"]);
    await d.setUrl(`file://${SRV2}/index.xml`);
    expect({ url: d.url }).toEqual(o["url_set"]);
    expect(await errWrap(() => d.setUrl(`file://${SRV2}/missing_index.xml`))).toEqual(o["url_set_bad"]);
    expect(d.url).toBe(o["url_after_bad_set"]);
    await d.setUrl(INDEX_URL);
  });

  test("_errors persistence quirk", async () => {
    const d3 = new Downloader(INDEX_URL);
    await capDl((s) => d3.download("nope", DL, { print_error_to: s, halt_on_error: false, quiet: true }));
    expect(Boolean(d3._errors)).toBe(o["errors_flag"]);
    expect(await capDl((s) => d3.download("mini", DL, { print_error_to: s }))).toEqual(o["dl_errors_quirk"]);
  });

  test("module-level download()/update()", async () => {
    mkdirSync(DL5, { recursive: true });
    await defaultDownloader().setUrl(INDEX_URL);
    expect(await capDl((s) => moduleDownload("abc", DL5, { print_error_to: s })))
      .toEqual(o["module_download"]);
    expect(await capFdStderr(() => moduleUpdate())).toEqual(o["module_update"]);
  });

  test("retry loop incl. 'y' self-deadlock (subprocess)", { timeout: 30000 }, () => {
    const script = `
      import { Downloader } from ${JSON.stringify(new URL("../src/downloader.ts", import.meta.url).pathname)};
      const d = new Downloader(process.env.INDEX_URL);
      let rv = null, err = null;
      try { rv = await d.download("badmd5", process.env.DL, { halt_on_error: false }); }
      catch (e) { err = e.name + ": " + String(e.message).slice(0, 400); }
      console.log("JSON:" + JSON.stringify({ rv, err }));
    `;
    const cleanResidue = () => {
      for (const n of ["corpora/badmd5.zip.lock", "corpora/badmd5.zip.tmp", "corpora/badmd5.zip"])
        rmSync(join(DL, n), { force: true });
    };
    for (const [key, stdin] of [["retry_e", "e\n"], ["retry_n", "n\n"], ["retry_y_e", "y\ne\n"], ["retry_eof", ""]] as [string, string][]) {
      const res = spawnSync(process.execPath, ["-e", script], {
        encoding: "utf-8",
        input: stdin,
        timeout: 9000,
        env: { ...process.env, INDEX_URL, DL, NLTK_DATA: ROOT },
      });
      const tag = (res.stdout ?? "").split("\n").filter((l) => l.startsWith("JSON:")).pop();
      const inner = tag ? JSON.parse(tag.slice(5)) : { rv: null, err: null };
      const code = res.status === null ? "timeout" : res.status;
      cleanResidue();
      expect({ code, stderr: res.stderr, rv: inner.rv, err: inner.err }).toEqual(o[key]);
    }
  });

  test("build_index error paths", async () => {
    expect(await errWrap(() => build_index(join(ROOT, "bi_err"), "file:///x"))).toEqual(o["bi_err_mismatch"]);
    expect(await errWrap(() => build_index(join(ROOT, "bi_err2"), "file:///x"))).toEqual(o["bi_err_nozip"]);
    expect(await errWrap(() => build_index(join(ROOT, "bi_err3"), "file:///x"))).toEqual(o["bi_err_nosubdir"]);
    expect(await errWrap(() => build_index(join(ROOT, "bi_err4"), "file:///x"))).toEqual(o["bi_err_dupuid"]);
  });

  test("final file-tree snapshots", () => {
    expect(snapshot(DL)).toEqual(o["dl_tree"]);
    expect(snapshot(DL2)).toEqual(o["dl2_tree"]);
    expect(snapshot(DL3)).toEqual(o["dl3_tree"]);
    expect(snapshot(DL4)).toEqual(o["dl4_tree"]);
    expect(snapshot(join(ROOT, "corpora"))).toEqual(o["root_tree_pkgs"]);
  });
});
