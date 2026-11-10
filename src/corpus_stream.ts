// nltk.data.SeekableUnicodeStreamReader — a seekable text stream over
// encoded bytes. Positions are opaque cookies: callers may only rely on
// tell()/seek() round-tripping and on positions being monotonic.
// Original: nltk/data.py

import { pyError } from "./internals";

function decodeBytes(bytes: Uint8Array, encoding: string): string {
  const label = encoding.toLowerCase();
  if (label === "utf-8" || label === "utf8") return new TextDecoder("utf-8").decode(bytes);
  if (label === "utf-16le" || label === "utf-16") return new TextDecoder("utf-16le").decode(bytes);
  if (label === "utf-16be") return new TextDecoder("utf-16be").decode(bytes);
  if (label === "latin-1" || label === "latin1" || label === "iso-8859-1" || label === "cp1252") {
    // Map bytes 1:1 to code points — matches Python's latin-1 decode.
    let out = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      out += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return out;
  }
  if (label === "ascii" || label === "us-ascii") return new TextDecoder("ascii").decode(bytes);
  return new TextDecoder(encoding as ConstructorParameters<typeof TextDecoder>[0]).decode(bytes);
}

export class SeekableUnicodeStreamReader {
  private text: string;
  private pos = 0;
  private isClosed = false;
  readonly encoding: string | null;

  constructor(bytes: Uint8Array, encoding: string | null = "utf-8", _errors?: string) {
    this.encoding = encoding;
    this.text = encoding === null ? decodeBytes(bytes, "latin-1") : decodeBytes(bytes, encoding);
  }

  /** Open a text stream directly from a decoded string (e.g. zip entry data). */
  static fromString(text: string, encoding: string | null = "utf-8"): SeekableUnicodeStreamReader {
    const reader = new SeekableUnicodeStreamReader(new Uint8Array(0), encoding);
    reader.text = text;
    return reader;
  }

  private checkOpen(): void {
    if (this.isClosed) throw pyError("ValueError", "I/O operation on closed file.");
  }

  get closed(): boolean {
    return this.isClosed;
  }

  /** Total decoded length — the effective end-of-file position for tell()/seek(). */
  get charLength(): number {
    return this.text.length;
  }

  tell(): number {
    this.checkOpen();
    return this.pos;
  }

  seek(offset: number, whence = 0): number {
    this.checkOpen();
    if (whence === 0) this.pos = offset;
    else if (whence === 1) this.pos += offset;
    else if (whence === 2) this.pos = this.text.length + offset;
    else throw pyError("ValueError", `invalid whence (${whence}, should be 0, 1 or 2)`);
    if (this.pos < 0 || this.pos > this.text.length) {
      throw pyError("ValueError", `tell() target ${this.pos} out of bounds`);
    }
    return this.pos;
  }

  read(size?: number): string {
    this.checkOpen();
    if (size === undefined || size === null || size < 0) {
      const out = this.text.slice(this.pos);
      this.pos = this.text.length;
      return out;
    }
    const out = this.text.slice(this.pos, this.pos + size);
    this.pos += out.length;
    return out;
  }

  readline(size?: number): string {
    this.checkOpen();
    if (this.pos >= this.text.length) return "";
    const limit = size === undefined || size === null || size < 0 ? this.text.length : Math.min(this.pos + size, this.text.length);
    let nl = this.text.indexOf("\n", this.pos);
    let end: number;
    if (nl === -1 || nl + 1 > limit) end = limit;
    else end = nl + 1;
    const out = this.text.slice(this.pos, end);
    this.pos = end;
    return out;
  }

  readlines(sizehint?: number): string[] {
    const lines: string[] = [];
    let total = 0;
    let line = this.readline();
    while (line !== "") {
      lines.push(line);
      total += line.length;
      if (sizehint !== undefined && total >= sizehint) break;
      line = this.readline();
    }
    return lines;
  }

  close(): void {
    this.isClosed = true;
  }

  /** nltk.data.SeekableUnicodeStreamReader.char_seek_forward — advance by chars. */
  char_seek_forward(offset: number): void {
    this.checkOpen();
    const end = Math.min(this.text.length, this.pos + offset);
    this.pos = end;
  }

  discard_line(): void {
    this.readline();
  }

  xreadlines(): string[] {
    return this.readlines();
  }

  /** Iterate remaining lines (for..of support used by reader code). */
  *[Symbol.iterator](): Generator<string> {
    let line = this.readline();
    while (line !== "") {
      yield line;
      line = this.readline();
    }
  }
}
