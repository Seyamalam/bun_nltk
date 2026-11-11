// nltk.pathsec — path sandbox for corpus/data access (ENFORCE mode).
// Original: nltk/pathsec.py (NLTK 3.10.3, GHSA-p4rw follow-up).

import { existsSync, statSync, openSync, readSync, closeSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve as pathResolve, dirname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { pyError } from "./internals";
import { ipAddress, IpAddress } from "./ipaddr";
import { OpenOnDemandZipFile } from "./zipfile";

export const ENFORCE = true;

// nltk.pathsec.ALLOW_PROXIED_FETCH — operator opt-in for proxied egress.
export let ALLOW_PROXIED_FETCH = false;
export function setAllowProxiedFetch(v: boolean): void { ALLOW_PROXIED_FETCH = v; }

let allowedRootsCache: Set<string> | null = null;
let lastDataPaths: string | null = null;

/** nltk.pathsec.is_private_dir — dir is safe to trust as a data root. */
export function is_private_dir(path: string): boolean {
  let st;
  try { st = statSync(path); } catch { return false; }
  if (!st.isDirectory()) return false;
  if (process.platform === "win32") return true;
  // Must be owned by us (or root); reject group/world-writable.
  const uid = process.getuid ? process.getuid() : 0;
  if (st.uid !== uid && st.uid !== 0) return false;
  if (st.mode & 0o022) return false;
  return true;
}

export function _get_allowed_roots(): Set<string> {
  const currentPaths = getDataPaths().join("");
  const envPaths = process.env["NLTK_DATA"] ?? "";
  const state = currentPaths + "" + envPaths;
  if (allowedRootsCache !== null && lastDataPaths === state) return allowedRootsCache;
  const roots = new Set<string>();
  for (const p of [...getDataPaths(), ...envPaths.split(":")]) {
    if (!p) continue;
    try { roots.add(pathResolve(expandUser(String(p)))); } catch { /* skip */ }
  }
  for (const loc of ["~/nltk_data", "/usr/share/nltk_data"]) {
    try {
      const p = pathResolve(expandUser(loc));
      if (existsSync(p)) roots.add(p);
    } catch { /* skip */ }
  }
  try {
    const tmp = pathResolve(tmpdir());
    if (is_private_dir(tmp)) roots.add(tmp);
  } catch { /* skip */ }
  allowedRootsCache = roots;
  lastDataPaths = state;
  return roots;
}

function expandUser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return homedir() + p.slice(1);
  return p;
}

import { dataPath } from "./data";
function getDataPaths(): string[] {
  return dataPath;
}

function isRelativeTo(target: string, root: string): boolean {
  return target === root || target.startsWith(root.endsWith("/") ? root : root + "/");
}

/**
 * nltk.pathsec.validate_path — ensure file access is restricted to allowed
 * data directories.  Throws PermissionError in ENFORCE mode.
 */
export function validate_path(pathInput: string | number | { path: string } | null | undefined, context = "NLTK", requiredRoot: string | null = null): void {
  if (typeof pathInput === "number" || !pathInput || !String(pathInput).trim()) return;
  let raw: string;
  if (typeof pathInput === "object" && "path" in pathInput) raw = String(pathInput.path);
  else raw = String(pathInput);

  if (raw.includes("://")) {
    const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(raw);
    const scheme = m ? m[1]!.toLowerCase() : "";
    if (["http", "https", "ftp"].includes(scheme)) return;
    if (scheme === "file") raw = decodeURIComponent(raw.slice(7));
  }

  let target: string;
  try {
    target = pathResolve(raw);
  } catch {
    const lower = raw.toLowerCase();
    if (lower.includes(".zip")) return; // virtual path inside a zip
    throw pyError("PermissionError", `Security Violation [${context}]: Cannot resolve path ${raw}`);
  }

  // LAYER 1 (required_root scope)
  if (requiredRoot !== null) {
    const req = pathResolve(requiredRoot);
    if (!isRelativeTo(target, req)) {
      throw pyError("PermissionError", `Security Violation [${context}]: Path ${target} escapes required root ${req}`);
    }
    return;
  }

  // LAYER 2: NLTK_DATA sandbox roots.
  const roots = _get_allowed_roots();
  for (const root of roots) {
    if (isRelativeTo(target, root)) return;
  }

  // CWD fallback — under ENFORCE this is refused (matches NLTK).
  const cwd = pathResolve(process.cwd());
  if (isRelativeTo(target, cwd)) {
    const msg = `Security Violation [${context}]: CWD access restricted in ENFORCE mode. Authorize via: nltk.data.path.append('.')`;
    throw pyError("PermissionError", msg);
  }

  throw pyError("PermissionError", `Security Violation [${context}]: Unauthorized path ${target}`);
}

/** nltk.pathsec.open — secure wrapper for file opens. Returns raw bytes. */
export function pathsec_open(file: string | { path: string }, mode = "rb", context = "pathsec.open", requiredRoot: string | null = null): Uint8Array {
  const raw = typeof file === "object" && "path" in file ? file.path : (file as string);
  validate_path(raw, context, requiredRoot);
  const fd = openSync(raw, mode === "rb" || mode === "r" ? "r" : mode as never);
  try {
    const size = statSync(raw).size;
    const buf = new Uint8Array(size);
    let off = 0;
    while (off < size) off += readSync(fd, buf, off, size - off, off);
    return buf;
  } finally {
    closeSync(fd);
  }
}

/** nltk.pathsec.validate_zip_archive — reject unsafe zip members. */
export function validate_zip_archive(names: string[], context = "pathsec.ZipFile"): void {
  for (const name of names) {
    const normalized = name.replace(/\\/g, "/");
    if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.split("/").includes("..")) {
      throw pyError("PermissionError", `Security Violation [${context}]: Unsafe zip member ${name}`);
    }
  }
}

export const zip_member_is_unsafe = (name: string): boolean => {
  const normalized = name.replace(/\\/g, "/");
  return normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.split("/").includes("..");
};

// ---- network half (nltk.pathsec.validate_network_url / urlopen / ZipFile) ----

// IPv6->IPv4 transition prefixes with no dedicated stdlib accessor.
const NAT64_WELL_KNOWN = { base: ipAddress("64:ff9b::").ip, plen: 96 };
const IPV4_COMPATIBLE = { base: 0n, plen: 96 };

/** _embedded_ipv4 — the IPv4 an IPv6 wrapper *is*, else null. */
function _embedded_ipv4(ip: IpAddress): IpAddress | null {
  if (ip.version !== 6) return null;
  const mapped = ip.ipv4Mapped;
  if (mapped) return mapped;
  const inNet = (base: bigint, plen: number) => (ip.ip >> BigInt(128 - plen)) === (base >> BigInt(128 - plen));
  if (inNet(NAT64_WELL_KNOWN.base, NAT64_WELL_KNOWN.plen) || inNet(IPV4_COMPATIBLE.base, IPV4_COMPATIBLE.plen)) {
    return new IpAddress(4, ip.ip & 0xffffffffn);
  }
  return null;
}

/** _tunneled_ipv4s — IPv4s carried by routable IPv6 wrappers (6to4 / Teredo). */
function* _tunneled_ipv4s(ip: IpAddress): Generator<IpAddress> {
  if (ip.version !== 6) return;
  const stf = ip.sixtofour;
  if (stf) yield stf;
  const ter = ip.teredo;
  if (ter) yield* ter;
}

/** _ip_is_forbidden — only globally routable addresses may be connected to. */
export function _ip_is_forbidden(ip: IpAddress): boolean {
  const embedded = _embedded_ipv4(ip);
  if (embedded) ip = embedded;
  for (const t of _tunneled_ipv4s(ip)) {
    if (t.isMulticast || !t.isGlobal) return true;
  }
  return ip.isMulticast || !ip.isGlobal;
}

type UrlParts = { scheme: string; hostname: string; netloc: string; path: string };

function _urlparse(urlStr: string): UrlParts {
  // urlparse-style split: scheme is optional; the rest is best-effort.
  const sm = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(urlStr);
  const scheme = sm ? sm[1]!.toLowerCase() : "";
  try {
    const u = new URL(urlStr);
    return { scheme: u.protocol.replace(/:$/, ""), hostname: u.hostname, netloc: u.host, path: u.pathname };
  } catch {
    if (scheme) {
      const rest = urlStr.slice(scheme.length + 1);
      const m = /^\/\/([^/]*)(\/.*)?$/.exec(rest);
      const netloc = m ? m[1]! : "";
      let hostname = netloc;
      const hm = /^\[([^\]]*)\]|^([^:@/]*)/.exec(netloc);
      if (hm) hostname = (hm[1] ?? hm[2] ?? "").toLowerCase();
      return { scheme, hostname, netloc, path: m?.[2] ?? "" };
    }
    return { scheme, hostname: "", netloc: "", path: urlStr };
  }
}

/** Hostname -> IP strings; literal IPs resolve offline, others via node:dns (or [] on failure/browser). */
async function _resolve_hostname(hostname: string): Promise<string[]> {
  if (!hostname) return [];
  const bare = hostname.replace(/^\[|\]$/g, "");
  try { return [ipAddress(bare).toString()]; } catch { /* not a literal */ }
  try {
    if (typeof process === "undefined" || !process.versions?.node && !(globalThis as { Bun?: unknown }).Bun) return [];
    const { lookup } = await import("node:dns");
    const out = await new Promise<{ address: string }[]>((res) => {
      lookup(bare, { all: true }, (err, addrs) => res(err ? [] : addrs));
    });
    return out.map((a) => a.address);
  } catch {
    return [];
  }
}

/** Sync literal-IP resolution — hostnames needing DNS yield [] (oracle's failure path). */
function _resolve_hostname_sync(hostname: string): string[] {
  const bare = hostname.replace(/^\[|\]$/g, "");
  try { return [ipAddress(bare).toString()]; } catch { return []; }
}

function _validate_network_url_inner(
  urlInput: string | { href?: string } | null | undefined,
  context: string,
  resolveHost: (h: string) => string[] | Promise<string[]>,
): void | Promise<void> {
  const raw = urlInput == null ? "" : (typeof urlInput === "object" ? (urlInput.href ?? String(urlInput)) : String(urlInput));
  if (!raw || !raw.trim()) return;
  const parsed = _urlparse(raw);

  if (parsed.scheme === "file") {
    const filePath = decodeURIComponent(parsed.path);
    if (parsed.netloc !== "" && parsed.netloc !== "localhost") {
      throw pyError("OSError", `Security Violation [${context}.file_scheme]: Non-local file URI authority not allowed: '${parsed.netloc}'`);
    }
    validate_path(filePath, `${context}.file_scheme`);
    return;
  }

  if (parsed.scheme !== "http" && parsed.scheme !== "https") {
    throw pyError("PermissionError", `Security Violation [${context}]: Unsupported scheme '${parsed.scheme}'.`);
  }

  const check = (ips: string[]) => {
    for (const ipStr of ips) {
      const ip = ipAddress(ipStr);
      if (_ip_is_forbidden(ip)) {
        throw pyError("PermissionError", `Security Violation [${context}]: SSRF attempt to restricted IP ${ip}`);
      }
    }
  };
  const resolved = resolveHost(parsed.hostname);
  if (resolved instanceof Promise) return resolved.then(check);
  check(resolved);
}

/** nltk.pathsec.validate_network_url — hardened URL validation with SSRF protection.
 *  Literal-IP hosts are checked exactly; hostnames needing DNS resolve to []
 *  (the oracle's resolution-failure path) — use the async form for DNS checks. */
export function validate_network_url(urlInput: string | { href?: string } | null | undefined, context = "NetworkIO"): void {
  _validate_network_url_inner(urlInput, context, _resolve_hostname_sync);
}

/** Async variant performing real DNS resolution before the SSRF check. */
export async function validate_network_url_async(urlInput: string | { href?: string } | null | undefined, context = "NetworkIO"): Promise<void> {
  await _validate_network_url_inner(urlInput, context, _resolve_hostname);
}

const _PROXIED_FETCH_ALLOWED_ENV = () =>
  ["1", "true", "yes", "on"].includes((typeof process !== "undefined" ? process.env?.["NLTK_ALLOW_PROXIED_URLOPEN"] ?? "" : "").trim().toLowerCase());

function _proxied_fetch_allowed(): boolean {
  return ALLOW_PROXIED_FETCH || _PROXIED_FETCH_ALLOWED_ENV();
}

function _env_proxies(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const e = process.env;
  return !!(e["http_proxy"] || e["https_proxy"] || e["HTTP_PROXY"] || e["HTTPS_PROXY"] || e["all_proxy"] || e["ALL_PROXY"]);
}

function _reject_unpinnable_proxied_fetch(urlStr: string): void {
  if (_proxied_fetch_allowed()) return;
  throw pyError(
    "PermissionError",
    `Security Violation [pathsec.urlopen]: refusing a proxied fetch of '${urlStr}'. ` +
    "A configured proxy performs the egress, so NLTK cannot pin the validated IP " +
    "and SSRF protection cannot be enforced (CWE-918). If and only if the proxy " +
    "is trusted to be SSRF-safe, opt in via NLTK_ALLOW_PROXIED_URLOPEN=1 or " +
    "nltk.pathsec.ALLOW_PROXIED_FETCH=True.",
  );
}

/** nltk.pathsec.urlopen — secure fetch with per-hop redirect re-validation.
 *  Returns a WHATWG Response (the JS analogue of urllib's response object). */
export async function urlopen(url: string | { href?: string }, opts: { maxRedirects?: number } = {}): Promise<Response> {
  const urlStr = typeof url === "object" ? (url.href ?? String(url)) : String(url);
  await validate_network_url_async(urlStr, "pathsec.urlopen");

  const parsed = _urlparse(urlStr);
  if (parsed.scheme === "file") {
    const data = pathsec_open(decodeURIComponent(parsed.path), "rb", "pathsec.urlopen.file_scheme");
    return new Response(data.buffer as ArrayBuffer, { status: 200, statusText: "OK" });
  }

  if (_env_proxies()) _reject_unpinnable_proxied_fetch(urlStr);

  let current = urlStr;
  for (let hops = 0; ; hops++) {
    const res = await fetch(current, { redirect: "manual" });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      if (hops >= (opts.maxRedirects ?? 10)) {
        throw pyError("HTTPError", `redirect limit exceeded for '${urlStr}'`);
      }
      current = new URL(loc, current).href;
      await validate_network_url_async(current, "pathsec.urlopen");
      if (_env_proxies()) _reject_unpinnable_proxied_fetch(current);
      continue;
    }
    return res;
  }
}

/** nltk.pathsec.ZipFile — secure wrapper: path validated on open, members
 *  re-audited (name + resolved target) on extract/extractall. */
export class ZipFile {
  private readonly _zf: OpenOnDemandZipFile;
  constructor(readonly file: string) {
    validate_path(file, "pathsec.ZipFile");
    this._zf = new OpenOnDemandZipFile(file);
  }

  get filename(): string { return this._zf.filename; }
  namelist(): string[] { return this._zf.namelist(); }
  read(name: string): Uint8Array { return this._zf.read(name); }
  open(name: string): Uint8Array { return this._zf.open(name); }

  private _auditMember(nameStr: string, target: string): string {
    if (nameStr.includes("\0")) {
      throw pyError("ValueError", `Null byte in ZIP member: ${nameStr}`);
    }
    const memberPath = pathResolve(target, nameStr);
    if (zip_member_is_unsafe(nameStr) || !(memberPath === target || memberPath.startsWith(target + "/"))) {
      throw pyError("PermissionError", `Security Violation [pathsec.ZipFile]: Traversal member '${nameStr}' detected.`);
    }
    return memberPath;
  }

  extract(member: string, path?: string): string {
    const target = pathResolve(path ?? process.cwd());
    const memberPath = this._auditMember(String(member), target);
    const data = this.read(member);
    mkdirSync(dirname(memberPath), { recursive: true });
    writeFileSync(memberPath, data);
    return memberPath;
  }

  extractall(path?: string, members?: string[]): void {
    const target = pathResolve(path ?? process.cwd());
    for (const m of members ?? this.namelist()) this.extract(m, target);
  }
}

