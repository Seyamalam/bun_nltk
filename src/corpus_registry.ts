import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { CorpusMiniIndex, CorpusRegistryManifest } from "./corpus";

export type CorpusDownloadOptions = {
  fetchBytes?: (url: string) => Promise<Uint8Array>;
  overwrite?: boolean;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
  timeoutMs?: number;
};

export function containedCorpusPath(base: string, path: string): string {
  if (typeof path !== "string" || !path || isAbsolute(path)) throw new Error("invalid corpus path");
  const root = realpathSync(base);
  const target = realpathSync(resolve(root, path));
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`corpus path escapes bundle directory: ${path}`);
  }
  return target;
}

function validateManifest(value: unknown): asserts value is CorpusRegistryManifest {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
      !("entries" in value) || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 10_000) {
    throw new Error("invalid corpus registry manifest: expected version 1 and 1–10000 entries");
  }
  for (const entry of value.entries) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id ||
        typeof entry.url !== "string" || !entry.url ||
        (entry.fileName !== undefined && typeof entry.fileName !== "string") ||
        (entry.sha256 !== undefined && (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256))) ||
        (entry.categories !== undefined && (!Array.isArray(entry.categories) || !entry.categories.every((x: unknown) => typeof x === "string")))) {
      throw new Error("invalid corpus registry entry");
    }
  }
}

function safeFileName(input: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(input) || input.endsWith(".") ||
      /^(?:index\.json|con(?:\..*)?|prn(?:\..*)?|aux(?:\..*)?|nul(?:\..*)?|com[1-9](?:\..*)?|lpt[1-9](?:\..*)?)$/i.test(input)) {
    throw new Error(`unsafe or reserved corpus filename: ${input}`);
  }
  return input;
}

function positiveLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

async function fetchBounded(url: string, maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("corpus downloads require HTTPS without URL credentials");
  }
  const response = await fetch(parsed, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  if (!response.ok || !response.body) throw new Error(`failed to download corpus entry: ${url} (${response.status})`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RangeError("corpus entry exceeds maxEntryBytes");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function atomicWrite(target: string, bytes: Uint8Array | string, overwrite: boolean): void {
  const temporary = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
  try {
    if (overwrite) renameSync(temporary, target);
    else linkSync(temporary, target); // Exclusive publication, including concurrent writers.
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function loadCorpusRegistryManifest(manifestPath: string): CorpusRegistryManifest {
  const payload: unknown = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
  validateManifest(payload);
  return payload;
}

export async function downloadCorpusRegistry(
  manifestOrPath: CorpusRegistryManifest | string,
  outDir: string,
  options: CorpusDownloadOptions = {},
): Promise<string> {
  const manifest = typeof manifestOrPath === "string" ? loadCorpusRegistryManifest(manifestOrPath) : manifestOrPath;
  validateManifest(manifest);
  const maxEntry = positiveLimit(options.maxEntryBytes ?? 64 * 1024 * 1024, "maxEntryBytes");
  const maxTotal = positiveLimit(options.maxTotalBytes ?? 256 * 1024 * 1024, "maxTotalBytes");
  const timeout = positiveLimit(options.timeoutMs ?? 30_000, "timeoutMs");
  const names = manifest.entries.map((entry) => safeFileName(entry.fileName ?? `${entry.id}.txt`));
  if (new Set(names.map((x) => x.toLowerCase())).size !== names.length ||
      new Set(manifest.entries.map((entry) => entry.id)).size !== names.length) {
    throw new Error("duplicate corpus IDs or filenames");
  }
  mkdirSync(outDir, { recursive: true });
  const root = realpathSync(outDir);
  const indexPath = resolve(root, "index.json");
  const overwrite = options.overwrite ?? false;
  if (!overwrite && [...names, "index.json"].some((name) => existsSync(resolve(root, name)))) {
    throw new Error("corpus destination already exists; set overwrite:true to replace it");
  }
  const files: CorpusMiniIndex["files"] = [];
  let totalBytes = 0;
  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i]!;
    const bytes = options.fetchBytes ? await options.fetchBytes(entry.url) : await fetchBounded(entry.url, maxEntry, timeout);
    if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error(`downloaded empty corpus entry: ${entry.id}`);
    totalBytes += bytes.length;
    if (bytes.length > maxEntry || totalBytes > maxTotal) throw new RangeError("corpus download exceeds byte budget");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (entry.sha256 && digest !== entry.sha256.toLowerCase()) throw new Error(`sha256 mismatch for ${entry.id}`);
    const name = names[i]!;
    atomicWrite(resolve(root, name), bytes, overwrite);
    files.push({ id: entry.id, path: name, categories: entry.categories ?? [] });
  }
  const index: CorpusMiniIndex = { version: 1, files };
  atomicWrite(indexPath, `${JSON.stringify(index, null, 2)}\n`, overwrite);
  return indexPath;
}
