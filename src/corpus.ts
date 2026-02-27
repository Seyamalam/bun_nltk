import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { sentenceTokenizePunkt } from "./punkt";
import { wordTokenizeSubset } from "./tokenizers";

export type CorpusFile = {
  id: string;
  text: string;
  categories: string[];
};

export type CorpusMiniIndex = {
  version: number;
  files: Array<{
    id: string;
    path: string;
    categories?: string[];
  }>;
};

export type CorpusRegistryEntry = {
  id: string;
  url: string;
  categories?: string[];
  sha256?: string;
  fileName?: string;
};

export type CorpusRegistryManifest = {
  version: number;
  entries: CorpusRegistryEntry[];
};

type ReadOptions = {
  fileIds?: string[];
  categories?: string[];
};

function normalizeSet(values?: string[]): Set<string> | null {
  if (!values || values.length === 0) return null;
  return new Set(values.map((item) => item.toLowerCase()));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export class CorpusReader {
  private readonly files = new Map<string, CorpusFile>();

  constructor(files: CorpusFile[]) {
    for (const file of files) {
      this.files.set(file.id, {
        id: file.id,
        text: file.text,
        categories: uniqueSorted(file.categories.map((item) => item.toLowerCase())),
      });
    }
  }

  fileIds(options: ReadOptions = {}): string[] {
    return this.selectFiles(options).map((item) => item.id);
  }

  raw(options: ReadOptions = {}): string {
    const selected = this.selectFiles(options);
    return selected.map((item) => item.text).join("\n");
  }

  words(options: ReadOptions = {}): string[] {
    return wordTokenizeSubset(this.raw(options)).map((token) => token.toLowerCase());
  }

  sents(options: ReadOptions = {}): string[] {
    const selected = this.selectFiles(options);
    const out: string[] = [];
    for (const file of selected) {
      for (const sentence of sentenceTokenizePunkt(file.text)) {
        if (sentence.trim()) out.push(sentence.trim());
      }
    }
    return out;
  }

  paras(options: ReadOptions = {}): string[] {
    const selected = this.selectFiles(options);
    const out: string[] = [];
    for (const file of selected) {
      const parts = file.text
        .split(/\r?\n\r?\n/g)
        .map((row) => row.trim())
        .filter((row) => row.length > 0);
      out.push(...parts);
    }
    return out;
  }

  categories(): string[] {
    const out: string[] = [];
    for (const file of this.files.values()) out.push(...file.categories);
    return uniqueSorted(out);
  }

  private selectFiles(options: ReadOptions): CorpusFile[] {
    const wantedIds = normalizeSet(options.fileIds);
    const wantedCategories = normalizeSet(options.categories);
    const selected: CorpusFile[] = [];

    for (const file of this.files.values()) {
      if (wantedIds && !wantedIds.has(file.id.toLowerCase())) continue;
      if (wantedCategories) {
        const found = file.categories.some((cat) => wantedCategories.has(cat));
        if (!found) continue;
      }
      selected.push(file);
    }

    selected.sort((a, b) => a.id.localeCompare(b.id));
    return selected;
  }
}

let cachedMiniCorpus: CorpusReader | null = null;

export function loadBundledMiniCorpus(rootPath?: string): CorpusReader {
  if (!rootPath && cachedMiniCorpus) return cachedMiniCorpus;
  const base = rootPath ?? resolve(import.meta.dir, "..", "corpora", "mini");
  const index = JSON.parse(readFileSync(resolve(base, "index.json"), "utf8")) as CorpusMiniIndex;
  const files: CorpusFile[] = index.files.map((row) => ({
    id: row.id,
    text: readFileSync(resolve(base, row.path), "utf8"),
    categories: row.categories ?? [],
  }));
  const reader = new CorpusReader(files);
  if (!rootPath) cachedMiniCorpus = reader;
  return reader;
}

export function loadCorpusBundleFromIndex(indexPath: string): CorpusReader {
  const absIndex = resolve(indexPath);
  const base = dirname(absIndex);
  const index = JSON.parse(readFileSync(absIndex, "utf8")) as CorpusMiniIndex;
  const files: CorpusFile[] = index.files.map((row) => ({
    id: row.id,
    text: readFileSync(resolve(base, row.path), "utf8"),
    categories: row.categories ?? [],
  }));
  return new CorpusReader(files);
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download corpus entry: ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export function loadCorpusRegistryManifest(manifestPath: string): CorpusRegistryManifest {
  const payload = JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as CorpusRegistryManifest;
  if (!Array.isArray(payload.entries)) throw new Error("invalid corpus registry manifest: entries must be an array");
  return payload;
}

export async function downloadCorpusRegistry(
  manifestOrPath: CorpusRegistryManifest | string,
  outDir: string,
  options?: {
    fetchBytes?: (url: string) => Promise<Uint8Array>;
    overwrite?: boolean;
  },
): Promise<string> {
  const manifest = typeof manifestOrPath === "string" ? loadCorpusRegistryManifest(manifestOrPath) : manifestOrPath;
  if (!manifest.entries || manifest.entries.length === 0) throw new Error("corpus registry has no entries");
  mkdirSync(outDir, { recursive: true });

  const fetchBytes = options?.fetchBytes ?? defaultFetchBytes;
  const files: CorpusMiniIndex["files"] = [];

  for (const entry of manifest.entries) {
    const bytes = await fetchBytes(entry.url);
    if (!bytes || bytes.length === 0) throw new Error(`downloaded empty corpus entry: ${entry.id}`);

    const digest = sha256Hex(bytes);
    if (entry.sha256 && digest.toLowerCase() !== entry.sha256.toLowerCase()) {
      throw new Error(`sha256 mismatch for ${entry.id}: expected=${entry.sha256} actual=${digest}`);
    }

    const name = sanitizeFileName(entry.fileName ?? `${entry.id}.txt`);
    const target = resolve(outDir, name);
    writeFileSync(target, bytes);
    files.push({
      id: entry.id,
      path: name,
      categories: entry.categories ?? [],
    });
  }

  const index: CorpusMiniIndex = { version: 1, files };
  const indexPath = resolve(outDir, "index.json");
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return indexPath;
}
