// nltk.pathsec — path sandbox for corpus/data access (ENFORCE mode).
// Original: nltk/pathsec.py (NLTK 3.10.3, GHSA-p4rw follow-up).

import { existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { pyError } from "./internals";

export const ENFORCE = true;

let allowedRootsCache: Set<string> | null = null;
let lastDataPaths: string | null = null;

/** nltk.pathsec.is_private_dir — dir is safe to trust as a data root. */
export function is_private_dir(path: string): boolean {
  let st;
  try { st = statSync(path); } catch { return false; }
  if (!st.isDirectory()) return false;
  if (process.platform === "win32") return true;
  // Must be owned by us (or root); reject group/world-writable.
  const uid = process.getuid ? process.getuid() : 0;
  if (st.uid !== uid && st.uid !== 0) return false;
  if (st.mode & 0o022) return false;
  return true;
}

export function _get_allowed_roots(): Set<string> {
  const currentPaths = getDataPaths().join("");
  const envPaths = process.env["NLTK_DATA"] ?? "";
  const state = currentPaths + "" + envPaths;
  if (allowedRootsCache !== null && lastDataPaths === state) return allowedRootsCache;
  const roots = new Set<string>();
  for (const p of [...getDataPaths(), ...envPaths.split(":")]) {
    if (!p) continue;
    try { roots.add(pathResolve(expandUser(String(p)))); } catch { /* skip */ }
  }
  for (const loc of ["~/nltk_data", "/usr/share/nltk_data"]) {
    try {
      const p = pathResolve(expandUser(loc));
      if (existsSync(p)) roots.add(p);
    } catch { /* skip */ }
  }
  try {
    const tmp = pathResolve(tmpdir());
    if (is_private_dir(tmp)) roots.add(tmp);
  } catch { /* skip */ }
  allowedRootsCache = roots;
  lastDataPaths = state;
  return roots;
}

function expandUser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return homedir() + p.slice(1);
  return p;
}

import { dataPath } from "./data";
function getDataPaths(): string[] {
  return dataPath;
}

function isRelativeTo(target: string, root: string): boolean {
  return target === root || target.startsWith(root.endsWith("/") ? root : root + "/");
}

/**
 * nltk.pathsec.validate_path — ensure file access is restricted to allowed
 * data directories.  Throws PermissionError in ENFORCE mode.
 */
export function validate_path(pathInput: string | number | { path: string } | null | undefined, context = "NLTK", requiredRoot: string | null = null): void {
  if (typeof pathInput === "number" || !pathInput || !String(pathInput).trim()) return;
  let raw: string;
  if (typeof pathInput === "object" && "path" in pathInput) raw = String(pathInput.path);
  else raw = String(pathInput);

  if (raw.includes("://")) {
    const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(raw);
    const scheme = m ? m[1]!.toLowerCase() : "";
    if (["http", "https", "ftp"].includes(scheme)) return;
    if (scheme === "file") raw = decodeURIComponent(raw.slice(7));
  }

  let target: string;
  try {
    target = pathResolve(raw);
  } catch {
    const lower = raw.toLowerCase();
    if (lower.includes(".zip")) return; // virtual path inside a zip
    throw pyError("PermissionError", `Security Violation [${context}]: Cannot resolve path ${raw}`);
  }

  // LAYER 1 (required_root scope)
  if (requiredRoot !== null) {
    const req = pathResolve(requiredRoot);
    if (!isRelativeTo(target, req)) {
      throw pyError("PermissionError", `Security Violation [${context}]: Path ${target} escapes required root ${req}`);
    }
    return;
  }

  // LAYER 2: NLTK_DATA sandbox roots.
  const roots = _get_allowed_roots();
  for (const root of roots) {
    if (isRelativeTo(target, root)) return;
  }

  // CWD fallback — under ENFORCE this is refused (matches NLTK).
  const cwd = pathResolve(process.cwd());
  if (isRelativeTo(target, cwd)) {
    const msg = `Security Violation [${context}]: CWD access restricted in ENFORCE mode. Authorize via: nltk.data.path.append('.')`;
    throw pyError("PermissionError", msg);
  }

  throw pyError("PermissionError", `Security Violation [${context}]: Unauthorized path ${target}`);
}

/** nltk.pathsec.open — secure wrapper for file opens. Returns raw bytes. */
export function pathsec_open(file: string | { path: string }, mode = "rb", context = "pathsec.open", requiredRoot: string | null = null): Uint8Array {
  const raw = typeof file === "object" && "path" in file ? file.path : (file as string);
  validate_path(raw, context, requiredRoot);
  const fd = openSync(raw, mode === "rb" || mode === "r" ? "r" : mode as never);
  try {
    const size = statSync(raw).size;
    const buf = new Uint8Array(size);
    let off = 0;
    while (off < size) off += readSync(fd, buf, off, size - off, off);
    return buf;
  } finally {
    closeSync(fd);
  }
}

/** nltk.pathsec.validate_zip_archive — reject unsafe zip members. */
export function validate_zip_archive(names: string[], context = "pathsec.ZipFile"): void {
  for (const name of names) {
    const normalized = name.replace(/\\/g, "/");
    if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.split("/").includes("..")) {
      throw pyError("PermissionError", `Security Violation [${context}]: Unsafe zip member ${name}`);
    }
  }
}

export const zip_member_is_unsafe = (name: string): boolean => {
  const normalized = name.replace(/\\/g, "/");
  return normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.split("/").includes("..");
};

