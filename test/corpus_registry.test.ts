import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadCorpusRegistry, loadCorpusBundleFromIndex, type CorpusRegistryManifest } from "../index";

function sha256(text: string): string {
  const hash = createHash("sha256");
  hash.update(new TextEncoder().encode(text));
  return hash.digest("hex");
}

test("downloadCorpusRegistry writes index and loads corpus bundle", async () => {
  const contents = new Map<string, string>([
    ["mem://news", "Markets rallied while rates cooled."],
    ["mem://science", "Researchers measured perplexity drift."],
  ]);
  const manifest: CorpusRegistryManifest = {
    version: 1,
    entries: [
      { id: "news", url: "mem://news", categories: ["news"], sha256: sha256(contents.get("mem://news")!) },
      { id: "science", url: "mem://science", categories: ["science"], sha256: sha256(contents.get("mem://science")!) },
    ],
  };

  const out = mkdtempSync(join(tmpdir(), "bun-nltk-corpus-"));
  try {
    const indexPath = await downloadCorpusRegistry(manifest, out, {
      fetchBytes: async (url) => new TextEncoder().encode(contents.get(url) ?? ""),
    });
    const corpus = loadCorpusBundleFromIndex(indexPath);
    expect(corpus.fileIds()).toEqual(["news", "science"]);
    expect(corpus.raw({ categories: ["science"] }).toLowerCase()).toContain("perplexity");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("corpus download preserves existing files unless overwrite is explicit", async () => {
  const out = mkdtempSync(join(tmpdir(), "bun-nltk-corpus-"));
  const manifest: CorpusRegistryManifest = { version: 1, entries: [{ id: "keep", url: "mem://keep", fileName: "keep.txt" }] };
  const fetchBytes = async () => new TextEncoder().encode("new");
  try {
    writeFileSync(join(out, "keep.txt"), "original");
    await expect(downloadCorpusRegistry(manifest, out, { overwrite: false, fetchBytes })).rejects.toThrow("already exists");
    expect(readFileSync(join(out, "keep.txt"), "utf8")).toBe("original");
    await downloadCorpusRegistry(manifest, out, { overwrite: true, fetchBytes });
    expect(readFileSync(join(out, "keep.txt"), "utf8")).toBe("new");
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("corpus registry rejects traversal, collisions, reserved names and oversized downloads", async () => {
  const out = mkdtempSync(join(tmpdir(), "bun-nltk-corpus-"));
  const fetchBytes = async () => new Uint8Array(8);
  try {
    for (const fileName of ["..", ".", "../escape", "index.json", "INDEX.JSON", "CON.txt", "a/../b", "a\\b", "x."]) {
      await expect(downloadCorpusRegistry({ version: 1, entries: [{ id: "x", url: "mem://x", fileName }] }, out, { fetchBytes })).rejects.toThrow();
    }
    await expect(downloadCorpusRegistry({ version: 1, entries: [
      { id: "a", url: "mem://a", fileName: "A.txt" }, { id: "b", url: "mem://b", fileName: "a.txt" },
    ] }, out, { fetchBytes })).rejects.toThrow("duplicate");
    await expect(downloadCorpusRegistry({ version: 1, entries: [{ id: "x", url: "mem://x" }] }, out,
      { fetchBytes, maxEntryBytes: 4 })).rejects.toThrow(RangeError);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("corpus bundle rejects paths and symlinks outside its directory", () => {
  const out = mkdtempSync(join(tmpdir(), "bun-nltk-corpus-"));
  try {
    const bundle = join(out, "bundle");
    // A separate nested bundle makes the sibling file an out-of-bounds target.
    const nested = mkdtempSync(join(out, "bundle-"));
    writeFileSync(bundle, "private");
    for (const path of ["../bundle", bundle]) {
      writeFileSync(join(nested, "index.json"), JSON.stringify({ version: 1, files: [{ id: "x", path }] }));
      expect(() => loadCorpusBundleFromIndex(join(nested, "index.json"))).toThrow();
    }
    if (process.platform !== "win32") {
      symlinkSync(bundle, join(nested, "link.txt"));
      writeFileSync(join(nested, "index.json"), JSON.stringify({ version: 1, files: [{ id: "x", path: "link.txt" }] }));
      expect(() => loadCorpusBundleFromIndex(join(nested, "index.json"))).toThrow("escapes");
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("downloadCorpusRegistry rejects checksum mismatch", async () => {
  const manifest: CorpusRegistryManifest = {
    version: 1,
    entries: [{ id: "x", url: "mem://x", sha256: "deadbeef" }],
  };
  const out = mkdtempSync(join(tmpdir(), "bun-nltk-corpus-"));
  try {
    await expect(
      downloadCorpusRegistry(manifest, out, {
        fetchBytes: async () => new TextEncoder().encode("payload"),
      }),
    ).rejects.toThrow();
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
