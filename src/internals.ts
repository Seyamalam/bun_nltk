// NLTK internals — shim (Java + file-find helpers not available in JS)
// Original: nltk/internals.py

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Build an Error carrying a Python exception class name for
 * NLTK-compatible error surfacing (e.g. KeyError, IndexError). */
export function pyError(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

function unavailable(name: string): never {
  throw new Error(`${name} requires Java/subprocess — not available in JS`);
}

export function configJava(..._a: unknown[]): never { return unavailable("internals.config_java"); }
export const config_java = configJava;
export function java(..._a: unknown[]): never { return unavailable("internals.java"); }
export class UntrustedJarError extends Error {}

/** nltk.internals.ReadError — expected/position ValueError subclass. */
export class ReadError extends Error {
  constructor(
    public readonly expected: string,
    public readonly position: number,
  ) {
    super(`Expected ${expected} at ${position}`);
    this.name = "ReadError";
  }
}

const STRING_START_RE = /[uU]?[rR]?("""|'''|"|')/y;

/** Evaluate a Python string literal (escapes + u/r prefixes). */
function pythonStrEval(lit: string): string {
  const m = /^([uU]?[rR]?)("""|'''|"|')/.exec(lit)!;
  const raw = /[rR]/.test(m[1]!);
  const quote = m[2]!;
  const inner = lit.slice(m[0].length, lit.length - quote.length);
  if (raw) return inner;
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const e = inner[++i];
    if (e === undefined) throw new ReadError("valid escape sequence", 0);
    switch (e) {
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "a": out += "\x07"; break;
      case "\n": break; // line continuation
      case "\\": case "'": case '"': out += e; break;
      case "x": {
        const hex = inner.slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new ReadError("valid escape sequence", 0);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 2;
        break;
      }
      case "u": {
        const hex = inner.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new ReadError("valid escape sequence", 0);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        break;
      }
      case "U": {
        const hex = inner.slice(i + 1, i + 9);
        if (!/^[0-9a-fA-F]{8}$/.test(hex)) throw new ReadError("valid escape sequence", 0);
        out += String.fromCodePoint(parseInt(hex, 16));
        i += 8;
        break;
      }
      default: {
        if (/[0-7]/.test(e)) {
          let oct = e;
          while (oct.length < 3 && /[0-7]/.test(inner[i + 1] ?? "")) oct += inner[++i];
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += "\\" + e; // Python keeps unknown escapes literal (DeprecationWarning)
        }
      }
    }
  }
  return out;
}

/** nltk.internals.read_str — read a Python string literal at start_position. */
export function readStr(s: string, startPosition: number): [string, number] {
  STRING_START_RE.lastIndex = startPosition;
  const m = STRING_START_RE.exec(s);
  if (!m || m.index !== startPosition) throw new ReadError("open quote", startPosition);
  const quotemark = m[1]!;
  const endRe = new RegExp(`\\\\|${quotemark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  let position = m[0].length + startPosition;
  let match: RegExpExecArray | null;
  for (;;) {
    endRe.lastIndex = position;
    match = endRe.exec(s);
    if (!match) throw new ReadError("close quote", position);
    if (match[0] === "\\") position = match.index + 2;
    else break;
  }
  const end = match.index + quotemark.length;
  let value: string;
  try {
    value = pythonStrEval(s.slice(startPosition, end));
  } catch (e) {
    if (e instanceof ReadError) throw new ReadError("valid escape sequence", startPosition);
    throw e;
  }
  return [value, end];
}
export const read_str = readStr;

const READ_INT_RE = /-?\d+/y;

/** nltk.internals.read_int — read an integer literal at start_position. */
export function readInt(s: string, startPosition: number): [number, number] {
  READ_INT_RE.lastIndex = startPosition;
  const m = READ_INT_RE.exec(s);
  if (!m || m.index !== startPosition) throw new ReadError("integer", startPosition);
  return [parseInt(m[0], 10), m.index + m[0].length];
}
export const read_int = readInt;

const READ_NUMBER_RE = /-?(\d*)([.]?\d*)?/y;

/** nltk.internals.read_number — read an int or float literal at start_position. */
export function readNumber(s: string, startPosition: number): [number, number] {
  READ_NUMBER_RE.lastIndex = startPosition;
  const m = READ_NUMBER_RE.exec(s);
  if (!m || m.index !== startPosition || (!m[1] && !m[2])) {
    throw new ReadError("number", startPosition);
  }
  if (m[2]) {
    const v = parseFloat(m[0]);
    if (Number.isNaN(v)) throw pyError("ValueError", `could not convert string to float: '${m[0]}'`);
    return [v, m.index + m[0].length];
  }
  return [parseInt(m[0], 10), m.index + m[0].length];
}
export const read_number = readNumber;

/**
 * nltk.internals.overridden — true if `name` is defined on more than one
 * class in the instance's prototype chain (i.e. a base-class method was
 * overridden). Signature adapted: Python takes a bound method; JS takes
 * (instance, name).
 */
export function overridden(instance: object, name: string): boolean {
  if ((typeof instance !== "object" && typeof instance !== "function") || instance === null) {
    throw pyError("TypeError", "Expected an instance method.");
  }
  let count = 0;
  for (let proto = Object.getPrototypeOf(instance); proto; proto = Object.getPrototypeOf(proto)) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) count++;
  }
  return count > 1;
}
export function deprecated<F extends (...args: any[]) => any>(message: string) {
  return (func: F): F => {
    const wrapped = function (this: unknown, ...args: unknown[]) {
      const msg = `Function ${func.name}() has been deprecated.  ${message}`;
      const chunks = msg.split(/(\s+)/).filter((c) => c !== "");
      const lines: string[] = [];
      let cur = "";
      for (const chunk of chunks) {
        if (("  " + cur + chunk).length <= 70 || cur.trim() === "") {
          if (cur === "" && /^\s+$/.test(chunk)) continue;
          cur += chunk;
        } else {
          lines.push(cur.replace(/\s+$/, ""));
          cur = /^\s+$/.test(chunk) ? "" : chunk;
        }
      }
      if (cur.trim() !== "") lines.push(cur.replace(/\s+$/, ""));
      console.warn("\n" + lines.map((l) => "  " + l).join("\n"));
      return func.apply(this, args);
    } as unknown as F & { __deprecated__?: boolean };
    wrapped.__deprecated__ = true;
    return wrapped as F;
  };
}
/**
 * nltk.internals.Deprecated — base class marking deprecated classes.
 * Instantiating a class that (transitively) directly extends Deprecated
 * warns "Class <dep> has been deprecated.  <doc>".
 */
export class Deprecated {
  constructor(..._args: unknown[]) {
    const cls = new.target as Function & { name: string; doc?: string; __doc__?: string };
    // The deprecated class: first in the chain that directly extends Deprecated.
    let dep: typeof cls | null = null;
    for (let cur: Function | null = cls; cur && cur !== Deprecated; cur = Object.getPrototypeOf(cur)) {
      if (Object.getPrototypeOf(cur) === Deprecated) {
        dep = cur;
        break;
      }
    }
    if (!dep) throw new Error("Unable to determine which base is deprecated.");
    const doc = String(dep.__doc__ ?? dep.doc ?? "")
      .replace(/^\s*@deprecated:/, "")
      .replace(/^\s*/gm, "");
    const name = `Class ${dep.name}` + (cls !== dep ? ` (base class for ${cls.name})` : "");
    const msg = `${name} has been deprecated.  ${doc}`;
    // textwrap.fill(msg, initial_indent="    ", subsequent_indent="    ")
    const indent = "    ";
    const width = 70;
    const norm = msg.replace(/[\n\t\v\f\r]/g, " ");
    const chunks = norm.split(/(\s+)/).filter((c) => c !== "");
    const lines: string[] = [];
    let cur = indent;
    for (const c of chunks) {
      const isWs = /^\s+$/.test(c);
      if (cur.length + c.length <= width) {
        if (isWs && cur === indent) continue;
        cur += c;
      } else {
        lines.push(cur.replace(/\s+$/, ""));
        cur = indent + (isWs ? "" : c);
      }
    }
    if (cur.trim() !== "") lines.push(cur.replace(/\s+$/, ""));
    console.warn("\n" + lines.join("\n"));
  }
}
export class Counter {
  private value: number;
  constructor(initialValue = 0) {
    this.value = initialValue;
  }
  get(): number {
    this.value += 1;
    return this.value;
  }
}
export interface FindFileOptions {
  env_vars?: string | string[];
  searchpath?: string[];
  file_names?: string[];
  url?: string;
  verbose?: boolean;
  finding_dir?: boolean;
}

const PATHSEP = process.platform === "win32" ? ";" : ":";

/** nltk.internals.find_file_iter — yield candidate locations for a file. */
export function* findFileIter(filename: string, options: FindFileOptions = {}): Generator<string> {
  const envVars = typeof options.env_vars === "string" ? options.env_vars.split(/\s+/) : (options.env_vars ?? []);
  const fileNames = [filename, ...(options.file_names ?? [])];
  const searchpath = options.searchpath ?? [];
  const verbose = options.verbose ?? false;
  const findingDir = options.finding_dir ?? false;
  const isfile = (p: string) => { try { return statSync(p).isFile(); } catch { return false; } };
  const expand = (p: string) => p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
  let yielded = false;

  // File exists, no magic
  for (const alternative of fileNames) {
    const pathToFile = join(filename, alternative);
    if (isfile(pathToFile)) {
      if (verbose) console.log(`[Found ${filename}: ${pathToFile}]`);
      yielded = true;
      yield pathToFile;
    }
    if (isfile(alternative)) {
      if (verbose) console.log(`[Found ${filename}: ${alternative}]`);
      yielded = true;
      yield alternative;
    }
    const fileDirPath = join(filename, "file", alternative);
    if (isfile(fileDirPath)) {
      if (verbose) console.log(`[Found ${filename}: ${fileDirPath}]`);
      yielded = true;
      yield fileDirPath;
    }
  }

  // Check environment variables
  for (const envVar of envVars) {
    const envVal = process.env[envVar];
    if (envVal === undefined) continue;
    if (findingDir) {
      for (const raw of envVal.split(PATHSEP)) {
        const envDir = expand(raw);
        if (envDir) {
          yielded = true;
          yield envDir;
        }
      }
    }
    for (const raw of envVal.split(PATHSEP)) {
      const envDir = expand(raw);
      if (isfile(envDir)) {
        if (verbose) console.log(`[Found ${filename}: ${envDir}]`);
        yielded = true;
        yield envDir;
      }
      for (const alternative of fileNames) {
        const pathToFile = join(envDir, alternative);
        if (isfile(pathToFile)) {
          if (verbose) console.log(`[Found ${filename}: ${pathToFile}]`);
          yielded = true;
          yield pathToFile;
        }
        const binPath = join(envDir, "bin", alternative);
        if (isfile(binPath)) {
          if (verbose) console.log(`[Found ${filename}: ${binPath}]`);
          yielded = true;
          yield binPath;
        }
      }
    }
  }

  // Check the path list.
  for (const directory of searchpath) {
    for (const alternative of fileNames) {
      const pathToFile = join(directory, alternative);
      if (isfile(pathToFile)) {
        yielded = true;
        yield pathToFile;
      }
    }
  }

  // POSIX: try `which` for each alternative.
  if (process.platform !== "win32") {
    for (const alternative of fileNames) {
      try {
        const p = Bun.spawnSync(["which", alternative], { stdout: "pipe", stderr: "pipe" });
        const path = p.stdout.toString().trim();
        if (path.endsWith(alternative) && existsSync(path)) {
          if (verbose) console.log(`[Found ${filename}: ${path}]`);
          yielded = true;
          yield path;
        }
      } catch {
        // ignore spawn errors, like the oracle's bare except around Popen
      }
    }
  }

  if (!yielded) {
    let msg =
      `NLTK was unable to find the ${filename} file!` +
      `\nUse software specific configuration parameters`;
    if (envVars.length) msg += ` or set the ${envVars[0]} environment variable`;
    msg += ".";
    if (searchpath.length) {
      msg += "\n\n  Searched in:";
      msg += searchpath.map((d) => `\n    - ${d}`).join("");
    }
    if (options.url) msg += `\n\n  For more information on ${filename}, see:\n    <${options.url}>`;
    const div = "=".repeat(75);
    const e = new Error(`\n\n${div}\n${msg}\n${div}`);
    e.name = "LookupError";
    throw e;
  }
}
export const find_file_iter = findFileIter;

/** nltk.internals.find_file — first match from find_file_iter. */
export function findFile(filename: string, options: Omit<FindFileOptions, "finding_dir"> = {}): string {
  return findFileIter(filename, options).next().value;
}
export const find_file = findFile;

/** nltk.internals.find_dir — first match from find_file_iter with finding_dir. */
export function findDir(filename: string, options: Omit<FindFileOptions, "finding_dir"> = {}): string {
  return findFileIter(filename, { ...options, finding_dir: true }).next().value;
}
export const find_dir = findDir;

export interface FindBinaryOptions extends FindFileOptions {
  path_to_bin?: string;
  binary_names?: string[];
}

/** nltk.internals.find_binary_iter — find_file_iter filtered to absolute paths for bare names. */
export function* findBinaryIter(
  name: string,
  options: FindBinaryOptions = {},
): Generator<string> {
  const { path_to_bin, binary_names, ...rest } = options;
  const searchingBareName = !path_to_bin && !name.includes("/");
  let safeMatch = false;
  for (const path of findFileIter(path_to_bin || name, { ...rest, file_names: binary_names })) {
    if (searchingBareName && !path.startsWith("/")) continue;
    safeMatch = true;
    yield path;
  }
  if (searchingBareName && !safeMatch) {
    const e = new Error(
      `NLTK found ${JSON.stringify(name)} only in the current working directory, which ` +
        "is not a trusted location for executables. Install it on PATH or in " +
        "a configured location, or pass an explicit path_to_bin.",
    );
    e.name = "LookupError";
    throw e;
  }
}
export const find_binary_iter = findBinaryIter;

/** nltk.internals.find_binary — first match from find_binary_iter. */
export function findBinary(name: string, options: FindBinaryOptions = {}): string {
  return findBinaryIter(name, options).next().value;
}
export const find_binary = findBinary;
export function findJar(..._a: unknown[]): never { return unavailable("internals.find_jar"); }
export const find_jar = findJar;
export function sliceBounds(_seq: unknown, _slice: unknown): [number, number] { return [0, 0]; }
export const slice_bounds = sliceBounds;

/** nltk.internals.is_writable — POSIX permission-bit check. */
export function isWritable(path: string): boolean {
  if (!existsSync(path)) return false;
  const { getuid, getgid, getgroups } = process;
  if (typeof getuid === "function") {
    const st = statSync(path);
    const perm = st.mode & 0o777;
    if (perm & 0o002) return true;
    if (st.uid === getuid() && perm & 0o200) return true;
    const gids = [getgid!(), ...((getgroups?.() ?? []) as number[])];
    if (perm & 0o020 && gids.includes(st.gid)) return true;
    return false;
  }
  return true;
}
export const is_writable = isWritable;
