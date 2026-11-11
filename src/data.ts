// NLTK data — path pointers, streams, resource lookup and URL helpers.
// Original: nltk/data.py
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { isAbsolute, normalize, resolve as pathResolve, sep } from "node:path";
import { pyError } from "./internals";
import { pathsec_open as pathsecOpen, urlopen as pathsecUrlopen, validate_path as pathsecValidatePath } from "./pathsec";
import { SeekableUnicodeStreamReader as SeekableUnicodeStreamReaderImpl } from "./corpus_stream";
import { OpenOnDemandZipFile as OpenOnDemandZipFileImpl } from "./zipfile";

function unavailable(name: string): never {
  throw new Error(`${name} requires NLTK data package — not available in JS (use bundled corpora or fetch() directly)`);
}

export abstract class PathPointer {
  /** Return a readable stream for this pointer. encoding null -> latin-1 text view. */
  abstract open(encoding?: string | null): SeekableUnicodeStreamReaderImpl;
  /** Size of the pointed-to file in bytes. */
  abstract file_size(): number;
  /** Path pointer to a path relative to this one. */
  abstract join(fileid: string): PathPointer;
  fileSize(): number { return this.file_size(); }
  toString(): string { return ""; }
}

export class FileSystemPathPointer extends PathPointer {
  constructor(readonly path: string) {
    super();
    const abs = pathResolve(path);
    if (!existsSync(abs)) throw pyError("OSError", `No such file or directory: '${abs}'`);
    this.path = abs;
  }

  override open(encoding: string | null = null): SeekableUnicodeStreamReaderImpl {
    return new SeekableUnicodeStreamReaderImpl(new Uint8Array(readFileSync(this.path)), encoding);
  }

  override file_size(): number {
    return statSync(this.path).size;
  }

  override join(fileid: string): FileSystemPathPointer {
    const fid = String(fileid).replace(/\\/g, "/");
    if (fid.split("/").includes("..")) throw pyError("ValueError", `Traversal blocked: ${fid}`);
    const joined = normalize(pathResolve(this.path, fid));
    const root = normalize(this.path);
    if (!(joined === root || joined.startsWith(root + sep))) {
      throw pyError("ValueError", `Escape outside root blocked: ${joined}`);
    }
    return new FileSystemPathPointer(joined);
  }

  repr(): string { return `FileSystemPathPointer('${this.path}')`; }
  override toString(): string { return this.path; }
}

/** nltk.data.BufferedGzipFile — GzipFile subclass for older-release compat.
 *  Adapted: decompresses lazily into a byte buffer with read/line/seek/peek;
 *  write buffers until close() (gzip-compresses to `filename` then). */
export class BufferedGzipFile {
  readonly name: string | null;
  private readonly _fileobj: Uint8Array | null;
  private readonly _mode: string;
  private _pos = 0;
  private _buf: Uint8Array | null = null;
  private _wbuf: Uint8Array[] = [];
  private _closed = false;

  constructor(filename?: string | null, mode = "rb", _compresslevel = 9, fileobj?: Uint8Array | null) {
    // NLTK 3.10.3 warns on every construction (Deprecated mixin).
    process.emitWarning(
      "Function BufferedGzipFile() has been deprecated.  Use gzip.GzipFile instead as it also uses a buffer.",
      "DeprecationWarning",
    );
    const m = (mode ?? "rb").replace(/[tb]/g, "");
    if (!["r", "w", "a"].includes(m)) {
      throw pyError("ValueError", `Invalid mode: '${mode}'`);
    }
    this.name = filename ?? null;
    this._fileobj = fileobj ?? null;
    this._mode = m;
    if (m !== "r" && filename == null && fileobj == null) {
      throw pyError("ValueError", "filename or fileobj required for write mode");
    }
    if (m === "a" && fileobj == null && filename != null && existsSync(filename)) {
      this._wbuf = [new Uint8Array(gunzipSync(readFileSync(filename)))];
    }
  }

  private _ensure(): Uint8Array {
    if (this._mode !== "r") throw pyError("OSError", "file not open for reading");
    if (this._buf === null) {
      const raw = this._fileobj ?? new Uint8Array(readFileSync(this.name!));
      this._buf = new Uint8Array(gunzipSync(Buffer.from(raw)));
    }
    return this._buf;
  }

  get closed(): boolean { return this._closed; }
  tell(): number { return this._pos; }

  seek(offset: number, whence = 0): number {
    const buf = this._ensure();
    const base = whence === 0 ? 0 : whence === 1 ? this._pos : buf.length;
    const next = base + offset;
    if (next < 0) throw pyError("OSError", "Negative seek position");
    this._pos = next;
    return this._pos;
  }

  read(size = -1): Uint8Array {
    const buf = this._ensure();
    const n = this._pos >= buf.length ? 0 : size < 0 ? buf.length - this._pos : Math.min(size, buf.length - this._pos);
    const out = buf.subarray(this._pos, this._pos + n);
    this._pos += n;
    return new Uint8Array(out);
  }

  peek(n = 1): Uint8Array {
    const buf = this._ensure();
    return new Uint8Array(buf.subarray(this._pos, this._pos + Math.max(n, 1)));
  }

  readline(size = -1): Uint8Array {
    const buf = this._ensure();
    if (this._pos >= buf.length) return new Uint8Array(0);
    let end = size < 0 ? buf.length : Math.min(buf.length, this._pos + size);
    const nl = buf.indexOf(0x0a, this._pos);
    if (nl >= 0 && nl < end) end = nl + 1;
    const out = new Uint8Array(buf.subarray(this._pos, end));
    this._pos = end;
    return out;
  }

  readlines(sizehint = -1): Uint8Array[] {
    const out: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const line = this.readline();
      if (!line.length) break;
      out.push(line);
      if (sizehint > 0 && (total += line.length) >= sizehint) break;
    }
    return out;
  }

  *[Symbol.iterator](): Generator<Uint8Array> {
    for (;;) { const l = this.readline(); if (!l.length) return; yield l; }
  }

  /** Oracle swallows the byte count for compat — returns undefined. */
  write(data: Uint8Array | string): void {
    if (this._mode === "r") throw pyError("OSError", "file not open for writing");
    this._wbuf.push(typeof data === "string" ? new TextEncoder().encode(data) : data);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    if (this._mode !== "r" && this.name != null) {
      const len = this._wbuf.reduce((n, b) => n + b.length, 0);
      const raw = new Uint8Array(len);
      let off = 0;
      for (const b of this._wbuf) { raw.set(b, off); off += b.length; }
      writeFileSync(this.name, gzipSync(Buffer.from(raw)));
    }
    this._buf = null;
    this._wbuf = [];
  }
}

export class GzipFileSystemPathPointer extends FileSystemPathPointer {
  override open(encoding: string | null = null): SeekableUnicodeStreamReaderImpl {
    return new SeekableUnicodeStreamReaderImpl(new Uint8Array(gunzipSync(readFileSync(this.path))), encoding);
  }
}

export class ZipFilePathPointer extends PathPointer {
  readonly entry: string;
  readonly zipfile: OpenOnDemandZipFileImpl;

  constructor(zipfile: string | OpenOnDemandZipFileImpl, entry = "") {
    super();
    this.zipfile = typeof zipfile === "string" ? new OpenOnDemandZipFileImpl(pathResolve(zipfile)) : zipfile;
    this.entry = entry ? normalizeResourceName(entry, true, "/").replace(/^\/+/, "") : "";
    if (this.entry) {
      try {
        this.zipfile.getinfo(this.entry);
      } catch {
        if (!(this.entry.endsWith("/") && this.zipfile.namelist().some((n) => n.startsWith(this.entry)))) {
          throw pyError("OSError", `Zipfile '${this.zipfile.filename}' does not contain '${this.entry}'`);
        }
      }
    }
  }

  override open(encoding: string | null = null): SeekableUnicodeStreamReaderImpl {
    let data = this.zipfile.read(this.entry);
    if (this.entry.endsWith(".gz")) data = new Uint8Array(gunzipSync(Buffer.from(data)));
    return new SeekableUnicodeStreamReaderImpl(data, encoding);
  }

  override file_size(): number {
    return this.zipfile.getinfo(this.entry).file_size;
  }

  override join(fileid: string): ZipFilePathPointer {
    return new ZipFilePathPointer(this.zipfile, `${this.entry}/${fileid}`);
  }

  repr(): string { return `ZipFilePathPointer('${this.zipfile.filename}', '${this.entry}')`; }
  override toString(): string { return normalize(`${this.zipfile.filename}/${this.entry}`); }
}

export { OpenOnDemandZipFileImpl as OpenOnDemandZipFile, SeekableUnicodeStreamReaderImpl as SeekableUnicodeStreamReader };

/** nltk.data.LazyLoader — defers a load until first access (adapted: thunk-based). */
export class LazyLoader<T = unknown> {
  private loaded: T | null = null;
  private didLoad = false;
  constructor(private readonly loader: () => T) {}
  load(): T {
    if (!this.didLoad) { this.loaded = this.loader(); this.didLoad = true; }
    return this.loaded as T;
  }
}

/** Default NLTK data search path (mirrors nltk.data.path ordering). */
export const dataPath: string[] = [
  ...(process.env.NLTK_DATA ? [process.env.NLTK_DATA] : []),
  `${process.env.HOME ?? ""}/nltk_data`,
  "/usr/share/nltk_data",
  "/usr/lib/nltk_data",
  "/usr/local/share/nltk_data",
  "/usr/local/lib/nltk_data",
];

/** nltk.data.find — locate a resource under the data path, dir or zip variant. */
export function find(resourceName: string, paths?: string[]): PathPointer {
  const resource = normalizeResourceName(resourceName, true, "/");
  if (UNSAFE_NO_PROTOCOL_RE.test(resource)) {
    throw pyError("ValueError", `Unsafe resource path: '${resource}'`);
  }
  assertNoEncodedBypass(resource);
  const search = paths ?? dataPath;
  const zm = /^(.*?\.zip)\/?(.*)$/.exec(resource);
  const zipfile = zm ? zm[1] : null;
  const zipentry = zm ? zm[2] : null;

  for (const pathItem of search) {
    // Path item itself is a zipfile.
    if (pathItem && pathItem.endsWith(".zip") && existsSync(pathItem) && statSync(pathItem).isFile()) {
      try {
        return new ZipFilePathPointer(pathItem, resource);
      } catch {
        continue;
      }
    }
    if (!pathItem || statSafeIsDir(pathItem)) {
      if (zipfile === null) {
        const p = pathResolve(pathItem, resource);
        if (existsSync(p)) {
          return p.endsWith(".gz") ? new GzipFileSystemPathPointer(p) : new FileSystemPathPointer(p);
        }
      } else {
        const p = pathResolve(pathItem, zipfile as string);
        if (existsSync(p)) {
          try {
            return new ZipFilePathPointer(p, zipentry as string);
          } catch {
            continue;
          }
        }
      }
    }
  }

  // Fallback: retry with each path component replaced by <comp>.zip/<comp>.
  if (zipfile === null) {
    const pieces = resource.split("/");
    for (let i = 0; i < pieces.length; i++) {
      const modified = [...pieces.slice(0, i), `${pieces[i]}.zip`, ...pieces.slice(i)].join("/");
      try {
        return find(modified, search);
      } catch (e) {
        if ((e as Error).name !== "LookupError") throw e;
      }
    }
  }

  const parts = resource.split("/");
  let resourceZipname = (parts.length > 1 ? parts[1] : parts[0])!;
  if (resourceZipname.endsWith(".zip")) resourceZipname = resourceZipname.replace(/\.zip$/, "");
  const sep70 = "*".repeat(70);
  throw pyError("LookupError",
    `\n${sep70}\n  Resource '${resourceZipname}' not found.\n` +
    "  Please use the NLTK Downloader to obtain the resource:\n\n" +
    "  >>> import nltk\n" +
    `  >>> nltk.download('${resourceZipname}')\n\n` +
    "  For more information see: https://www.nltk.org/data.html\n" +
    `  Attempted to load '${resource}'\n` +
    `  Searched in:${search.map((p) => `\n    - '${p}'`).join("")}\n${sep70}\n`);
}

function statSafeIsDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}
export function load(..._a: unknown[]): never { return unavailable("data.load"); }
export function showCfg(..._a: unknown[]): never { return unavailable("data.show_cfg"); }
export function clearCache(): void { /* no-op */ }
export const clear_cache = clearCache;
/** nltk.data.open_datafile — path.join(file_name).open(encoding). */
export function openDatafile(path: PathPointer, fileName = "", encoding: string | null = "utf-8"): SeekableUnicodeStreamReaderImpl {
  const pointer = fileName ? path.join(fileName) : path;
  return pointer.open(encoding);
}
export const open_datafile = openDatafile;
const UNSAFE_NO_PROTOCOL_RE = /(?:\.\.\/|\.\.$|^\/|\\|[A-Za-z]:[/\\])/;

function isWindows(): boolean {
  return process.platform === "win32";
}

function pyUnquote(name: string): string {
  return name.replace(/%([0-9a-fA-F]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function assertNoEncodedBypass(name: string, errorLabel?: string): void {
  const decoded = pyUnquote(name);
  if (decoded !== name && UNSAFE_NO_PROTOCOL_RE.test(decoded)) {
    throw pyError("ValueError", `Unsafe resource path: '${errorLabel ?? name}'`);
  }
}

function rejectUnsafeNoProtocol(resourceUrl: string): void {
  if (UNSAFE_NO_PROTOCOL_RE.test(resourceUrl)) {
    throw pyError("ValueError", `Unsafe resource path: '${resourceUrl}'`);
  }
  assertNoEncodedBypass(resourceUrl);
}

/** nltk.data.split_resource_url — "<protocol>:<path>" splitter. */
export function splitResourceUrl(resourceUrl: string): [string, string] {
  const colon = resourceUrl.indexOf(":");
  if (colon < 0) {
    throw pyError("ValueError", `not enough values to unpack (expected 2, got 1)`);
  }
  const protocol = resourceUrl.slice(0, colon);
  let path = resourceUrl.slice(colon + 1);
  if (protocol.length === 1 && /^[A-Za-z]$/.test(protocol) && (path.startsWith("/") || path.startsWith("\\"))) {
    return ["file", `/${protocol}:${path.replace(/^\/+/, "")}`];
  }
  if (protocol === "file") {
    if (path.startsWith("/")) path = `/${path.replace(/^\/+/, "")}`;
  } else if (protocol !== "nltk") {
    path = path.replace(/^\/{0,2}/, "");
  }
  return [protocol, path];
}

export const split_resource_url = splitResourceUrl;

function normpath(pathname: string): string {
  if (pathname === "") return ".";
  const doubleSlash = pathname.startsWith("//") && !pathname.startsWith("///");
  const absolute = pathname.startsWith("/");
  const parts = pathname.split("/").filter((part) => part !== "" && part !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
    } else {
      out.push(part);
    }
  }
  let result = `${absolute ? "/" : ""}${out.join("/")}`;
  if (result === "") result = absolute ? "/" : ".";
  if (doubleSlash) result = `/${result}`;
  return result;
}

/** nltk.data.normalize_resource_name. */
export function normalizeResourceName(resourceName: string, allowRelative = true, relativePath?: string): string {
  const isDir = /[\\/.]$/.test(resourceName) || resourceName.endsWith("/");
  let name = resourceName;
  if (isWindows()) name = name.replace(/^\/+/, "");
  else name = name.replace(/^\/+/, "/");
  if (allowRelative) {
    name = normpath(name);
  } else {
    name = pathResolve(relativePath ?? ".", name);
  }
  name = name.replace(/\\/g, "/");
  if (isWindows() && /^[A-Za-z]:\//.test(name)) name = `/${name}`;
  if (isDir && !name.endsWith("/")) name += "/";
  return name;
}

export const normalize_resource_name = normalizeResourceName;

/** nltk.data.normalize_resource_url — nltk:/file:/external protocol normalization. */
export function normalizeResourceUrl(resourceUrl: string): string {
  let protocol: string;
  let name: string;
  try {
    [protocol, name] = splitResourceUrl(resourceUrl);
  } catch {
    rejectUnsafeNoProtocol(resourceUrl);
    protocol = "nltk";
    name = resourceUrl;
  }
  if (protocol === "file" && !resourceUrl.toLowerCase().startsWith("file:")) {
    rejectUnsafeNoProtocol(resourceUrl);
  }
  if (protocol === "nltk") {
    assertNoEncodedBypass(name, resourceUrl);
    if (/^[A-Za-z]:[/\\]/.test(name)) {
      throw pyError("ValueError", `Unsafe resource path: '${resourceUrl}'`);
    }
    if (isAbsolute(name)) {
      protocol = "file://";
      name = normalizeResourceName(name, false);
    } else {
      protocol = "nltk:";
      name = normalizeResourceName(name, true);
    }
  } else if (protocol === "file") {
    protocol = "file://";
    name = normalizeResourceName(name, false);
  } else {
    protocol += "://";
  }
  return protocol + name;
}

export const normalize_resource_url = normalizeResourceUrl;

/** nltk.data.gzip_open_unicode — returns the decoded text (JS adaptation of the text stream). */
export function gzipOpenUnicode(
  filename: string,
  _mode = "rb",
  _compresslevel = 9,
  encoding = "utf-8",
  fileobj?: Uint8Array,
  _errors?: string,
  _newline?: string,
): string {
  const bytes = fileobj ?? readFileSync(filename);
  return new TextDecoder(encoding as ConstructorParameters<typeof TextDecoder>[0]).decode(gunzipSync(bytes));
}

export const gzip_open_unicode = gzipOpenUnicode;

/** nltk.data.retrieve — copy a resource to a local file (file/nltk:/http(s)).
 *  Adapted: async because remote fetches go through pathsec.urlopen. */
export async function retrieve(
  resourceUrl: string,
  options: { filename?: string; verbose?: boolean } = {},
): Promise<void> {
  const { verbose = true } = options;
  let { filename } = options;
  const normalized = normalizeResourceUrl(resourceUrl);
  if (filename === undefined) {
    if (normalized.startsWith("file:")) {
      filename = normalized.split("/").pop()!;
    } else {
      filename = normalized.replace(/^(\w+)?:?.*\//, "");
    }
  }
  if (existsSync(filename)) {
    throw pyError("ValueError", `File '${pathResolve(filename)}' already exists!`);
  }
  if (verbose) console.log(`Retrieving '${normalized}', saving to '${filename}'`);

  // Open input stream (file:// / nltk: / remote URL).
  let data: Uint8Array;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    const res = await pathsecUrlopen(normalized);
    data = new Uint8Array(await res.arrayBuffer());
  } else if (normalized.startsWith("nltk:")) {
    const ptr = find(normalized.slice(5));
    const stream = ptr.open(null);
    data = (stream as unknown as { _data?: Uint8Array })._data ?? new Uint8Array(readFileSync((ptr as unknown as { path: string }).path));
  } else if (normalized.startsWith("file:")) {
    data = new Uint8Array(pathsecOpen(normalized.slice(5), "rb", "data.retrieve"));
  } else {
    data = new Uint8Array(readFileSync(normalized));
  }

  // Route the write through pathsec (oracle _secure_open parity).
  pathsecValidatePath(pathResolve(filename), "data.retrieve");
  writeFileSync(filename, data);
}
