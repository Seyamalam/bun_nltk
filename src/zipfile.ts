// Minimal read-only zipfile support — central-directory parsing only.
// Original contract: zipfile.ZipFile / nltk.data.OpenOnDemandZipFile — namelist(),
// getinfo(), read() for stored (method 0) and deflated (method 8) members.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { pyError } from "./internals";

const EOCD_SIG = 0x06054b50;
const CDIR_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

export interface ZipInfo {
  filename: string;
  compress_type: number;
  file_size: number;
  compress_size: number;
  header_offset: number;
}

export class OpenOnDemandZipFile {
  private entries = new Map<string, ZipInfo>();
  private loaded = false;

  constructor(readonly filename: string) {}

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    const data = readFileSync(this.filename);
    // End of central directory: scan backwards for the signature.
    let eocd = -1;
    for (let i = data.length - 22; i >= 0 && i >= data.length - 22 - 0xffff; i--) {
      if (data.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw pyError("BadZipFile", `${this.filename}: not a zip file`);
    const count = data.readUInt16LE(eocd + 10);
    let pos = data.readUInt32LE(eocd + 16);
    for (let i = 0; i < count; i++) {
      if (data.readUInt32LE(pos) !== CDIR_SIG) throw pyError("BadZipFile", `${this.filename}: corrupt central directory`);
      const compressType = data.readUInt16LE(pos + 10);
      const compressSize = data.readUInt32LE(pos + 20);
      const fileSize = data.readUInt32LE(pos + 24);
      const nameLen = data.readUInt16LE(pos + 28);
      const extraLen = data.readUInt16LE(pos + 30);
      const commentLen = data.readUInt16LE(pos + 32);
      const headerOffset = data.readUInt32LE(pos + 42);
      const filename = data.subarray(pos + 46, pos + 46 + nameLen).toString("utf-8");
      this.entries.set(filename, {
        filename, compress_type: compressType, file_size: fileSize,
        compress_size: compressSize, header_offset: headerOffset,
      });
      pos += 46 + nameLen + extraLen + commentLen;
    }
  }

  namelist(): string[] {
    this.ensureLoaded();
    return [...this.entries.keys()];
  }

  getinfo(name: string): ZipInfo {
    this.ensureLoaded();
    const info = this.entries.get(name);
    if (!info) throw pyError("KeyError", `There is no item named '${name}' in the archive`);
    return info;
  }

  infolist(): ZipInfo[] {
    this.ensureLoaded();
    return [...this.entries.values()];
  }

  /** Read and decompress a member. Mirrors OpenOnDemandZipFile.read(). */
  read(name: string): Uint8Array {
    const info = this.getinfo(name);
    const data = readFileSync(this.filename);
    if (data.readUInt32LE(info.header_offset) !== LFH_SIG) {
      throw pyError("BadZipFile", `${this.filename}: bad local file header for ${name}`);
    }
    const nameLen = data.readUInt16LE(info.header_offset + 26);
    const extraLen = data.readUInt16LE(info.header_offset + 28);
    const start = info.header_offset + 30 + nameLen + extraLen;
    const payload = data.subarray(start, start + info.compress_size);
    if (info.compress_type === 0) return new Uint8Array(payload);
    if (info.compress_type === 8) {
      return new Uint8Array(inflateRawSync(payload));
    }
    throw pyError("NotImplementedError", `compression type ${info.compress_type} for ${name}`);
  }

  open(name: string): Uint8Array {
    return this.read(name);
  }
}
