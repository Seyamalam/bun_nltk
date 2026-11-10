// NLTK data — shim (requires NLTK data paths / file I/O)
// Original: nltk/data.py
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isAbsolute, resolve as pathResolve } from "node:path";
import { pyError } from "./internals";

function unavailable(name: string): never {
  throw new Error(`${name} requires NLTK data package — not available in JS (use bundled corpora or fetch() directly)`);
}

export class PathPointer { toString(): string { return ""; } }
export class FileSystemPathPointer extends PathPointer { constructor(public path: string) { super(); } }
export class BufferedGzipFile { constructor(..._a: unknown[]) { unavailable("data.BufferedGzipFile"); } }
export class GzipFileSystemPathPointer extends FileSystemPathPointer {}
export class ZipFilePathPointer extends PathPointer { constructor(public zipfile: string, public entry: string) { super(); } }
export class LazyLoader { constructor(..._a: unknown[]) { unavailable("data.LazyLoader"); } }
export class OpenOnDemandZipFile { constructor(..._a: unknown[]) { unavailable("data.OpenOnDemandZipFile"); } }
export class SeekableUnicodeStreamReader { constructor(..._a: unknown[]) { unavailable("data.SeekableUnicodeStreamReader"); } }

export function find(..._a: unknown[]): never { return unavailable("data.find"); }
export function retrieve(..._a: unknown[]): never { return unavailable("data.retrieve"); }
export function load(..._a: unknown[]): never { return unavailable("data.load"); }
export function showCfg(..._a: unknown[]): never { return unavailable("data.show_cfg"); }
export function clearCache(): void { /* no-op */ }
export const clear_cache = clearCache;
export function openDatafile(..._a: unknown[]): never { return unavailable("data.open_datafile"); }
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
