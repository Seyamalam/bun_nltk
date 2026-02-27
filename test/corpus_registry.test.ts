import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
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
