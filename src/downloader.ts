// nltk.downloader — value layer: Package/Collection index entries, progress
// messages, checksum helpers and unzip. The network-facing Downloader data
// server client, DownloaderGUI/DownloaderShell and the download()/update()
// entry points are unsupported (network + interactive bound).

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join as pathJoin, extname } from "node:path";
import { pyError } from "./internals";
import { OpenOnDemandZipFile } from "./zipfile";

/** nltk.downloader.Package — index.xml package entry. */
export class Package {
  id: string;
  name: string;
  subdir: string;
  url: string;
  size: number;
  unzipped_size: number;
  checksum: string | null;
  svn_revision: string | number | null;
  copyright: string;
  contact: string;
  license: string;
  author: string;
  unzip: boolean;
  filename: string;
  [key: string]: unknown;

  constructor(kw: Record<string, unknown> & { id: string; url: string; children?: unknown }) {
    const { id, url } = kw as { id: string; url: string };
    this.id = id;
    this.name = (kw["name"] as string | undefined) ?? id;
    const subdir = (kw["subdir"] as string | undefined) ?? "";
    if (subdir.startsWith("/") || /^[A-Za-z]:/.test(subdir) || subdir.replace(/\\/g, "/").split("/").includes("..")) {
      throw pyError("ValueError", `Invalid package subdir ${JSON.stringify(subdir)}: must be a relative path without parent directory references`);
    }
    if (id.includes("/") || id.includes("\\") || id.includes("..")) {
      throw pyError("ValueError", `Invalid package id ${JSON.stringify(id)}: must not contain path separators`);
    }
    this.subdir = subdir;
    this.url = url;
    this.size = parseInt(String(kw["size"]), 10);
    this.unzipped_size = parseInt(String(kw["unzipped_size"]), 10);
    this.checksum = (kw["checksum"] as string | undefined) ?? null;
    this.svn_revision = (kw["svn_revision"] as string | number | undefined) ?? null;
    this.copyright = (kw["copyright"] as string | undefined) ?? "Unknown";
    this.contact = (kw["contact"] as string | undefined) ?? "Unknown";
    this.license = (kw["license"] as string | undefined) ?? "Unknown";
    this.author = (kw["author"] as string | undefined) ?? "Unknown";
    this.unzip = Boolean(parseInt(String(kw["unzip"] ?? "1"), 10));
    const { id: _i, url: _u, name: _n, subdir: _s, size: _z, unzipped_size: _uz, checksum: _c, svn_revision: _sr, copyright: _cr, contact: _co, license: _l, author: _a, unzip: _un, ...rest } = kw;
    Object.assign(this, rest);
    const ext = extname(url.split("/").pop()!);
    this.filename = pathJoin(this.subdir, this.id + ext);
  }

  static fromxml(xml: string | { attrib: Record<string, string> }): Package {
    const attrib = typeof xml === "string" ? parseXmlAttrs(xml, "package") : xml.attrib;
    return new Package(attrib as never);
  }

  toString(): string { return `<Package ${this.id}>`; }
}

/** nltk.downloader.Collection — index.xml collection entry. */
export class Collection {
  id: string;
  name: string;
  children: string[];
  packages: Package[] | null = null;
  [key: string]: unknown;

  constructor(kw: Record<string, unknown> & { id: string; children: string[] }) {
    this.id = kw.id;
    this.name = (kw["name"] as string | undefined) ?? this.id;
    this.children = kw.children;
    const { id: _i, name: _n, children: _c, ...rest } = kw;
    Object.assign(this, rest);
  }

  static fromxml(xml: string | { attrib: Record<string, string>; itemRefs: string[] }): Collection {
    if (typeof xml === "string") {
      const attrib = parseXmlAttrs(xml, "collection");
      const itemRefs = [...xml.matchAll(/<item\s+ref\s*=\s*"([^"]+)"\s*\/>/g)].map((m) => m[1]!);
      return new Collection({ children: itemRefs, ...attrib } as never);
    }
    return new Collection({ children: xml.itemRefs, ...xml.attrib } as never);
  }

  toString(): string { return `<Collection ${this.id}>`; }
}

/** Extract the attributes of the first `<tag ...>` element. */
function parseXmlAttrs(xml: string, tag: string): Record<string, string> {
  const m = xml.match(new RegExp(`<${tag}\\b([^>]*)>`));
  if (!m) throw pyError("ValueError", `no <${tag}> element in xml`);
  const out: Record<string, string> = {};
  for (const a of m[1]!.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[a[1]!] = a[2]!;
  return out;
}

/** nltk.downloader message-passing objects. */
export class DownloaderMessage {}
export class StartCollectionMessage extends DownloaderMessage { constructor(public collection: Collection) { super(); } }
export class FinishCollectionMessage extends DownloaderMessage { constructor(public collection: Collection) { super(); } }
abstract class PackageMessage extends DownloaderMessage {
  declare package: Package;
  constructor(pkg: Package) { super(); this.package = pkg; }
}
export class StartPackageMessage extends PackageMessage {}
export class FinishPackageMessage extends PackageMessage {}
export class StartDownloadMessage extends PackageMessage {}
export class FinishDownloadMessage extends PackageMessage {}
export class StartUnzipMessage extends PackageMessage {}
export class FinishUnzipMessage extends PackageMessage {}
export class UpToDateMessage extends PackageMessage {}
export class StaleMessage extends PackageMessage {}
export class ErrorMessage extends DownloaderMessage {
  declare package: Package;
  message: string;
  constructor(pkg: Package, message: unknown) { super(); this.package = pkg; this.message = message instanceof Error ? String(message) : String(message); }
}
export class ProgressMessage extends DownloaderMessage { constructor(public progress: number) { super(); } }
export class SelectDownloadDirMessage extends DownloaderMessage { constructor(public download_dir: string) { super(); } }

/** nltk.downloader.md5_hexdigest / sha256_hexdigest. */
export function md5_hexdigest(file: string | { path: string } | Uint8Array): string {
  return createHash("md5").update(readAll(file)).digest("hex");
}
export function sha256_hexdigest(file: string | { path: string } | Uint8Array): string {
  return createHash("sha256").update(readAll(file)).digest("hex");
}
function readAll(file: string | { path: string } | Uint8Array): Uint8Array {
  if (file instanceof Uint8Array) return file;
  const raw = typeof file === "object" && "path" in file ? file.path : (file as string);
  return new Uint8Array(readFileSync(raw).buffer as ArrayBuffer);
}

/** nltk.downloader.unzip — extract a package zip into a directory. */
export function unzip(filename: string, root: string, verbose = false): void {
  const zip = new OpenOnDemandZipFile(filename);
  for (const name of zip.namelist()) {
    if (name.endsWith("/")) continue;
    const target = pathJoin(root, name);
    mkdirSync(pathJoin(target, ".."), { recursive: true });
    writeFileSync(target, zip.read(name));
    if (verbose) console.log(`  [zipped] ${name}`);
  }
}

function unsupportedDownloader(name: string): never {
  throw pyError("NotImplementedError", `nltk.downloader.${name} requires network access to the NLTK data server / an interactive UI, which is out of scope for this runtime`);
}

/** nltk.downloader.Downloader — network data-server client (unsupported). */
export class Downloader {
  constructor(_server_index_url?: string | null, _download_dir?: string | null) { unsupportedDownloader("Downloader"); }
}
export class DownloaderGUI { constructor() { unsupportedDownloader("DownloaderGUI"); } }
export class DownloaderShell { constructor() { unsupportedDownloader("DownloaderShell"); } }
export function download(..._a: unknown[]): never { return unsupportedDownloader("download"); }
export function download_gui(..._a: unknown[]): never { return unsupportedDownloader("download_gui"); }
export function download_shell(..._a: unknown[]): never { return unsupportedDownloader("download_shell"); }
export function update(..._a: unknown[]): never { return unsupportedDownloader("update"); }
export function build_index(..._a: unknown[]): never { return unsupportedDownloader("build_index"); }