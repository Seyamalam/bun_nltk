import { readFileSync } from "node:fs";
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
