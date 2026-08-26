import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

type Artifact = {
  path: string;
  maxBytes: number;
  validate(bytes: Uint8Array): void;
};

const root = resolve(import.meta.dir, "..");

function requireBytes(bytes: Uint8Array, expected: readonly number[], label: string): void {
  if (expected.some((value, index) => bytes[index] !== value)) {
    throw new Error(`${label} has an invalid file signature`);
  }
}

const artifacts: Artifact[] = [
  {
    path: "native/prebuilt/darwin-arm64/bun_nltk.dylib",
    maxBytes: 1_500_000,
    validate(bytes) {
      requireBytes(bytes, [0xcf, 0xfa, 0xed, 0xfe], "darwin-arm64 dylib");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint32(4, true) !== 0x0100000c) throw new Error("darwin dylib is not arm64");
    },
  },
  {
    path: "native/prebuilt/linux-x64/bun_nltk.so",
    maxBytes: 2_000_000,
    validate(bytes) {
      requireBytes(bytes, [0x7f, 0x45, 0x4c, 0x46], "linux-x64 shared library");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (bytes[4] !== 2 || view.getUint16(18, true) !== 0x3e) throw new Error("linux library is not ELF x64");
    },
  },
  {
    path: "native/prebuilt/win32-x64/bun_nltk.dll",
    maxBytes: 2_000_000,
    validate(bytes) {
      requireBytes(bytes, [0x4d, 0x5a], "win32-x64 DLL");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const peOffset = view.getUint32(0x3c, true);
      requireBytes(bytes.subarray(peOffset), [0x50, 0x45, 0, 0], "win32-x64 PE image");
      if (view.getUint16(peOffset + 4, true) !== 0x8664) throw new Error("Windows DLL is not x64");
    },
  },
  {
    path: "native/bun_nltk.wasm",
    maxBytes: 250_000,
    validate(bytes) {
      requireBytes(bytes, [0, 0x61, 0x73, 0x6d], "WASM binary");
    },
  },
];

const results = artifacts.map((artifact) => {
  const absolute = resolve(root, artifact.path);
  const bytes = readFileSync(absolute);
  artifact.validate(bytes);
  const size = statSync(absolute).size;
  if (size > artifact.maxBytes) {
    throw new Error(`${artifact.path} exceeds its size gate: ${size} > ${artifact.maxBytes}`);
  }
  return { path: artifact.path, bytes: size, max_bytes: artifact.maxBytes };
});

const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
const maxTotalBytes = 5_750_000;
if (totalBytes > maxTotalBytes) throw new Error(`native artifacts exceed total size gate: ${totalBytes} > ${maxTotalBytes}`);

console.log(JSON.stringify({ ok: true, artifacts: results, total_bytes: totalBytes, max_total_bytes: maxTotalBytes }, null, 2));
