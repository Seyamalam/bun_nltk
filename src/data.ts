// NLTK data — shim (requires NLTK data paths / file I/O)
// Original: nltk/data.py

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
export function splitResourceUrl(..._a: unknown[]): never { return unavailable("data.split_resource_url"); }
export function normalizeResourceUrl(..._a: unknown[]): never { return unavailable("data.normalize_resource_url"); }
export function normalizeResourceName(..._a: unknown[]): never { return unavailable("data.normalize_resource_name"); }
export function gzipOpenUnicode(..._a: unknown[]): never { return unavailable("data.gzip_open_unicode"); }
