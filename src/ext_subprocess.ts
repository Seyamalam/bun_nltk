/**
 * nltk external-tool adapters — subprocess/HTTP parity with Python NLTK 3.10.3.
 *
 * Ports of the "gap adapters" that drive external binaries and HTTP services:
 *   - nltk.internals.{find_file_iter, find_binary_iter, find_jar_iter, find_jar,
 *     find_jars_within_path, config_java, java, _validate_java_options,
 *     _verify_jar_sandbox, UntrustedJarError, try_port (nltk.parse.corenlp)}
 *   - nltk.parse.corenlp.{CoreNLPServer, GenericCoreNLPParser, CoreNLPParser,
 *     CoreNLPDependencyParser}
 *   - nltk.tag.stanford.{StanfordTagger, StanfordPOSTagger, StanfordNERTagger}
 *   - nltk.tag.hunpos.HunposTagger
 *   - nltk.classify.senna.Senna + nltk.tag.senna.{SennaTagger,
 *     SennaChunkTagger, SennaNERTagger}
 *   - nltk.parse.malt.{MaltParser, find_maltparser, find_malt_model,
 *     malt_regex_tagger}
 *   - nltk.parse.bllip.BllipParser (+ _ensure_ascii)
 *   - nltk.sem.boxer.Boxer (reusing src/sem_boxer.ts DRS classes)
 *   - nltk.parse.dependencygraph.dot2img
 *   - nltk.classify.{megam, tadm} subprocess helpers +
 *     nltk.classify.maxent.train_maxent_classifier_with_megam
 *
 * Every spawn passes an explicit snapshot of the live environment
 * (`env: {...process.env}`) because Bun caches PATH at process start while
 * Python's subprocess resolves executables against the *current* os.environ.
 * Errors use Python exception names via pyError so differential tests can
 * compare `Name:message` verbatim.
 */

import {
  existsSync,
  openSync,
  closeSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

import { pyError, UntrustedJarError } from "./internals.ts";
import { ZipFilePathPointer } from "./data.ts";
import { taggedsents_to_conll } from "./parse_conll.ts";
import { DependencyGraph } from "./dependency_graph.ts";
import { SimpleTree } from "./corpus_tree.ts";
import { transform as corenlpTransform, type CoreNlpSentence } from "./parse_stepping.ts";
import { RegexpTagger } from "./sequential_taggers.ts";
import {
  NltkDrtBoxerDrsInterpreter,
  parseToDrsDict,
  type BoxerDrsInterpreter,
} from "./sem_boxer.ts";
import {
  BinaryMaxentFeatureEncoding,
  type MaxentEncodingExample,
} from "./maxent_feature_encoding.ts";
import {
  ConditionalExponentialClassifier,
  TadmEventMaxentFeatureEncoding,
  _externalMaxentTrainers,
  parse_megam_weights,
  parse_tadm_weights,
  write_megam_file,
  write_tadm_file,
} from "./maxent_nltk.ts";

// ---------------------------------------------------------------------------
// Python path/env helpers
// ---------------------------------------------------------------------------

const PATHSEP = ":"; // os.pathsep on POSIX (this port targets POSIX oracle).

/** os.path.join with POSIX semantics (absolute parts reset the result). */
export function pyJoin(...parts: string[]): string {
  let out = "";
  for (const p of parts) {
    if (p === "") {
      if (out === "") continue;
      if (!out.endsWith("/")) out += "/";
      continue;
    }
    if (p.startsWith("/")) {
      out = p;
    } else if (out === "" || out.endsWith("/")) {
      out += p;
    } else {
      out += "/" + p;
    }
  }
  return out;
}

/** os.path.normpath (POSIX). Empty input -> ".". */
export function pyNormpath(p: string): string {
  if (p === "") return ".";
  const initialSlashes = p.startsWith("//") && !p.startsWith("///") ? 2 : p.startsWith("/") ? 1 : 0;
  const comps = p.split("/");
  const newComps: string[] = [];
  for (const comp of comps) {
    if (comp === "" || comp === ".") continue;
    if (comp !== ".." || (initialSlashes === 0 && newComps.length === 0) ||
        (newComps.length > 0 && newComps[newComps.length - 1] === "..")) {
      newComps.push(comp);
    } else {
      newComps.pop();
    }
  }
  let out = "/".repeat(initialSlashes) + newComps.join("/");
  if (out === "") out = initialSlashes === 0 ? "." : "/".repeat(initialSlashes);
  return out || ".";
}

/** os.path.split -> [head, tail] (POSIX). */
export function pySplit(p: string): [string, string] {
  let s = p;
  const i = p.lastIndexOf("/") + 1;
  const head = s.slice(0, i);
  const tail = s.slice(i);
  let head2 = head;
  if (head && head !== "/".repeat(head.length)) {
    head2 = head.replace(/\/+$/, "");
  }
  return [head2, tail];
}

export const pyDirname = (p: string): string => pySplit(p)[0];
export const pyBasename = (p: string): string => pySplit(p)[1];
/** os.path.isabs — TypeError on non-str input, verbatim (e.g. None). */
export const pyIsabs = (p: string): boolean => {
  if (typeof p !== "string") {
    throw pyError(
      "TypeError",
      `expected str, bytes or os.PathLike object, not ${p === null || p === undefined ? "NoneType" : typeof p}`,
    );
  }
  return p.startsWith("/");
};

/** os.path.expanduser for '~' and '~/' prefixes (no ~user expansion). */
export function expanduser(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return homedir() + p.slice(1);
  return p;
}

export function pyIsfile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
export function pyIsdir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
export function pyExists(p: string): boolean {
  return existsSync(p);
}
export function pyRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/** os.path.commonpath — throws ValueError('') on mismatch (mirrors ValueError). */
export function pyCommonpath(paths: string[]): string {
  if (paths.length === 0) throw pyError("ValueError", "commonpath() arg is an empty sequence");
  const abs = paths.map((p) => (p === "" ? "." : p));
  const splitPaths = abs.map((p) => p.split("/"));
  const isabs = abs.every((p) => p.startsWith("/")) ? true : abs.every((p) => !p.startsWith("/")) ? false : null;
  if (isabs === null) throw pyError("ValueError", "Can't mix absolute and relative paths");
  const first = splitPaths[0]!;
  let commonLen = first.length;
  for (const sp of splitPaths.slice(1)) {
    commonLen = Math.min(commonLen, sp.length);
    for (let i = 0; i < commonLen; i++) {
      if (sp[i] !== first[i]) {
        commonLen = i;
        break;
      }
    }
  }
  const common = first.slice(0, commonLen).join("/");
  if (common === "" && isabs) return "/";
  return common;
}

// ---------------------------------------------------------------------------
// Python repr/format helpers
// ---------------------------------------------------------------------------

function pyIsPrintable(cp: number): boolean {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp < 0x20 || cp === 0x7f) return false;
  if (cp >= 0x80 && cp <= 0xa0) return false;
  if (cp === 0xad) return false;
  return true;
}

function pyEscapeChar(cp: number): string {
  if (cp <= 0xff) return "\\x" + cp.toString(16).padStart(2, "0");
  if (cp <= 0xffff) return "\\u" + cp.toString(16).padStart(4, "0");
  return "\\U" + cp.toString(16).padStart(8, "0");
}

/** repr() of a Python str. */
export function pyStrRepr(s: string): string {
  let quote = "'";
  if (s.includes("'") && !s.includes('"')) quote = '"';
  let out = quote;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (!pyIsPrintable(cp)) out += pyEscapeChar(cp);
    else out += ch;
  }
  return out + quote;
}

/** repr() of Python bytes (b'...'). */
export function pyBytesRepr(b: Uint8Array | null): string {
  if (b === null) return "None";
  let quote = "'";
  let hasSingle = false;
  let hasDouble = false;
  for (const c of b) {
    if (c === 0x27) hasSingle = true;
    if (c === 0x22) hasDouble = true;
  }
  if (hasSingle && !hasDouble) quote = '"';
  let out = "b" + quote;
  for (const c of b) {
    if (c === 0x5c) out += "\\\\";
    else if (c === 0x27 && quote === "'") out += "\\'";
    else if (c === 0x22 && quote === '"') out += '\\"';
    else if (c === 0x09) out += "\\t";
    else if (c === 0x0a) out += "\\n";
    else if (c === 0x0d) out += "\\r";
    else if (c >= 0x20 && c <= 0x7e) out += String.fromCharCode(c);
    else out += "\\x" + c.toString(16).padStart(2, "0");
  }
  return out + quote;
}

/** repr() for the small set of values embedded in oracle messages. */
export function pyRepr(v: unknown): string {
  if (typeof v === "string") return pyStrRepr(v);
  if (v === null || v === undefined) return "None";
  if (v instanceof Uint8Array) return pyBytesRepr(v);
  if (v && typeof v === "object" && (v as { __pyType?: string }).__pyType === "re.Match") return "<re.Match object>";
  return String(v);
}

/** repr() of a Python list of strings. */
export function pyListRepr(items: string[]): string {
  return "[" + items.map(pyStrRepr).join(", ") + "]";
}

/** textwrap.fill for whitespace-only text (TextWrapper defaults, width 70). */
export function textwrapFill(
  text: string,
  initialIndent = "",
  subsequentIndent = "",
  width = 70,
): string {
  const words = text.replace(/\s+/g, " ").replace(/^ +| +$/g, "").split(" ").filter((w) => w !== "");
  const lines: string[] = [];
  let cur = initialIndent;
  const fresh = (s: string) => s === initialIndent || s === subsequentIndent;
  for (let w of words) {
    if (fresh(cur)) {
      // First word on this line; break_long_words if it can't fit at all.
      while (cur.length + w.length > width && w.length > width - cur.length) {
        const room = width - cur.length;
        lines.push(cur + w.slice(0, room));
        w = w.slice(room);
        cur = subsequentIndent;
      }
      cur = cur + w;
    } else if (cur.length + 1 + w.length <= width) {
      cur = cur + " " + w;
    } else {
      lines.push(cur);
      cur = subsequentIndent;
      while (cur.length + w.length > width && w.length > width - cur.length) {
        const room = width - cur.length;
        lines.push(cur + w.slice(0, room));
        w = w.slice(room);
        cur = subsequentIndent;
      }
      cur = cur + w;
    }
  }
  lines.push(cur);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Codecs with Python error semantics
// ---------------------------------------------------------------------------

/** bytes.decode('latin-1'/'iso-8859-1'). */
export function latin1Decode(b: Uint8Array): string {
  let out = "";
  for (const c of b) out += String.fromCharCode(c);
  return out;
}

/** str.encode('latin-1') -> bytes, raising UnicodeEncodeError verbatim. */
export function latin1Encode(s: string): Uint8Array {
  const out = new Uint8Array([...s].length);
  let i = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0xff) {
      throw pyError(
        "UnicodeEncodeError",
        `'latin-1' codec can't encode character '${pyEscapeChar(cp)}' in position ${i}: ordinal not in range(256)`,
      );
    }
    out[i++] = cp;
  }
  return out;
}

/** str.encode('ascii') -> boolean ok (BllipParser only needs the check). */
export function isAscii(s: string): boolean {
  for (const ch of s) if (ch.codePointAt(0)! > 0x7f) return false;
  return true;
}

const UTF8 = new TextEncoder();
const UTF8D = new TextDecoder();

/** str.encode(encoding) supporting utf-8/latin-1/ascii. */
export function pyEncode(s: string, encoding: string | null): Uint8Array {
  if (encoding === null || encoding === undefined) return UTF8.encode(s);
  const norm = encoding.toLowerCase().replace(/_/g, "-");
  if (norm === "utf-8" || norm === "utf8") return UTF8.encode(s);
  if (norm === "latin-1" || norm === "iso-8859-1" || norm === "latin1") return latin1Encode(s);
  if (norm === "ascii" || norm === "us-ascii") {
    let i = 0;
    for (const ch of s) {
      if (ch.codePointAt(0)! > 0x7f) {
        throw pyError(
          "UnicodeEncodeError",
          `'ascii' codec can't encode character '${pyEscapeChar(ch.codePointAt(0)!)}' in position ${i}: ordinal not in range(128)`,
        );
      }
      i++;
    }
    return UTF8.encode(s);
  }
  return UTF8.encode(s);
}

/** bytes.decode(encoding); for str input raises the Python AttributeError. */
export function pyDecode(data: string | Uint8Array | null, encoding: string | null): string {
  if (data === null || data === undefined) {
    throw pyError("AttributeError", "'NoneType' object has no attribute 'decode'");
  }
  if (typeof data === "string") {
    throw pyError("AttributeError", "'str' object has no attribute 'decode'");
  }
  const norm = (encoding ?? "utf-8").toLowerCase().replace(/_/g, "-");
  if (norm === "latin-1" || norm === "iso-8859-1" || norm === "latin1") return latin1Decode(data);
  if (norm === "ascii" || norm === "us-ascii") {
    for (const c of data) {
      if (c > 0x7f) {
        throw pyError(
          "UnicodeDecodeError",
          `'ascii' codec can't decode byte ${pyEscapeChar(c)} in position 0: ordinal not in range(128)`,
        );
      }
    }
    return latin1Decode(data);
  }
  return UTF8D.decode(data);
}

// ---------------------------------------------------------------------------
// Tempfiles (tempfile.mkstemp / NamedTemporaryFile)
// ---------------------------------------------------------------------------

const TMP_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_";

export function mkstemp(prefix = "tmp", suffix = "", dir = tmpdir()): { fd: number; path: string } {
  for (let i = 0; i < 100; i++) {
    let name = prefix;
    for (let j = 0; j < 8; j++) name += TMP_CHARS[Math.floor(Math.random() * TMP_CHARS.length)];
    name += suffix;
    const p = pyJoin(dir, name);
    try {
      const fd = openSync(p, "wx", 0o600);
      return { fd, path: p };
    } catch {
      continue;
    }
  }
  throw pyError("OSError", "No usable temporary file name found");
}

/** tempfile.NamedTemporaryFile(delete=False, mode='w') equivalent. */
export class NamedTempFile {
  readonly name: string;
  private _written: string[] = [];
  closed = false;
  constructor(prefix: string, dir: string) {
    const { fd, path } = mkstemp(prefix, "", dir);
    this.name = path;
    closeSync(fd);
  }
  write(s: string): void {
    this._written.push(s);
  }
  close(): void {
    if (!this.closed) {
      writeFileSync(this.name, this._written.join(""), "utf8");
      this.closed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// warnings.warn -> recorded warnings (test-visible) + Python-style stderr line
// ---------------------------------------------------------------------------

export interface PyWarning {
  message: string;
  category: string;
}

export const emittedWarnings: PyWarning[] = [];

export function warn(message: string, category = "UserWarning"): void {
  emittedWarnings.push({ message, category });
}

// ---------------------------------------------------------------------------
// subprocess helpers honoring the live environment
// ---------------------------------------------------------------------------

type SpawnStream = "pipe" | "devnull" | null | true | undefined;

interface SpawnError extends Error {
  code?: string;
  errno?: number;
  path?: string;
}

function spawnEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) out[k] = v;
  return out;
}

function pySpawnError(prog: string, e: unknown): Error {
  const err = e as SpawnError;
  const errno = typeof err?.errno === "number" && err.errno !== 0 ? -err.errno : 2;
  const filename = err?.path ?? prog;
  if (errno === 2) {
    return pyError("FileNotFoundError", `[Errno 2] No such file or directory: '${filename}'`);
  }
  if (errno === 13) {
    return pyError("PermissionError", `[Errno 13] Permission denied: '${filename}'`);
  }
  return pyError("OSError", `[Errno ${errno}] ${err?.message ?? "spawn failed"}: '${filename}'`);
}

interface SyncResult {
  stdout: Uint8Array | null;
  stderr: Uint8Array | null;
  exitCode: number;
  signalCode: string | null;
}

function spawnSyncPy(
  cmd: string[],
  opts: {
    stdin?: Uint8Array | "pipe" | "devnull" | "inherit" | null;
    stdout?: "pipe" | "devnull" | "inherit" | null;
    stderr?: "pipe" | "devnull" | "inherit" | null;
    cwd?: string | null;
  } = {},
): SyncResult {
  const stdio: Record<string, unknown> = {};
  stdio.stdin =
    opts.stdin instanceof Uint8Array
      ? opts.stdin
      : opts.stdin === "pipe" || opts.stdin === "devnull"
        ? "ignore"
        : "inherit";
  stdio.stdout = opts.stdout === "pipe" ? "pipe" : opts.stdout === "devnull" ? "ignore" : "inherit";
  stdio.stderr = opts.stderr === "pipe" ? "pipe" : opts.stderr === "devnull" ? "ignore" : "inherit";
  if (opts.cwd) stdio.cwd = opts.cwd;
  stdio.env = spawnEnv();
  try {
    const r = Bun.spawnSync(cmd, stdio as never);
    const killed = (r as unknown as { signalCode?: string | null }).signalCode ?? null;
    return {
      stdout: opts.stdout === "pipe" ? new Uint8Array(r.stdout) : null,
      stderr: opts.stderr === "pipe" ? new Uint8Array(r.stderr) : null,
      exitCode: r.exitCode ?? killedToReturnCode(killed) ?? 0,
      signalCode: killed,
    };
  } catch (e) {
    throw pySpawnError(cmd[0]!, e);
  }
}

const SIGNALS: Record<string, number> = {
  SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5, SIGABRT: 6,
  SIGBUS: 7, SIGFPE: 8, SIGKILL: 9, SIGUSR1: 10, SIGSEGV: 11, SIGUSR2: 12,
  SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15, SIGSTKFLT: 16, SIGCHLD: 17,
  SIGCONT: 18, SIGSTOP: 19, SIGTSTP: 20, SIGTTIN: 21, SIGTTOU: 22,
  SIGURG: 23, SIGXCPU: 24, SIGXFSZ: 25, SIGVTALRM: 26, SIGPROF: 27,
  SIGWINCH: 28, SIGIO: 29, SIGPWR: 30, SIGSYS: 31,
};

function killedToReturnCode(signalCode: string | null): number | null {
  if (!signalCode) return null;
  const n = SIGNALS[signalCode];
  return n === undefined ? null : -n;
}

/** Bun.Subprocess-shaped handle (ambient-free so the portable d.ts stays
 * usable for node/browser consumers without Bun types). */
export interface PySubprocessLike {
  readonly pid: number;
  kill(signal?: string | number): void;
  readonly exited: Promise<number>;
  readonly stdin: unknown;
  readonly stdout: unknown;
  readonly stderr: unknown;
}

/** subprocess.Popen equivalent used for non-blocking java() and interactive tools. */
export class PyPopen {
  readonly proc: PySubprocessLike;
  private readonly _stdoutPiped: boolean;
  private readonly _stderrPiped: boolean;

  constructor(
    cmd: string[],
    opts: {
      stdin?: "pipe" | "devnull" | null;
      stdout?: "pipe" | "devnull" | null;
      stderr?: "pipe" | "devnull" | null;
      cwd?: string | null;
      text?: boolean;
    } = {},
  ) {
    this._stdoutPiped = opts.stdout === "pipe";
    this._stderrPiped = opts.stderr === "pipe";
    const stdio: Record<string, unknown> = {
      stdin: opts.stdin === "pipe" ? "pipe" : opts.stdin === "devnull" ? "ignore" : "inherit",
      stdout: opts.stdout === "pipe" ? "pipe" : opts.stdout === "devnull" ? "ignore" : "inherit",
      stderr: opts.stderr === "pipe" ? "pipe" : opts.stderr === "devnull" ? "ignore" : "inherit",
      env: spawnEnv(),
    };
    if (opts.cwd) stdio.cwd = opts.cwd;
    this.proc = Bun.spawn(cmd, stdio as never);
  }

  get pid(): number {
    return this.proc.pid;
  }

  private _rc(): number | null {
    const p = this.proc as unknown as { exitCode?: number | null; signalCode?: string | null };
    if (p.exitCode !== null && p.exitCode !== undefined) return p.exitCode;
    return killedToReturnCode(p.signalCode ?? null);
  }

  poll(): number | null {
    return this._rc();
  }

  get returncode(): number | null {
    return this._rc();
  }

  terminate(): void {
    this.proc.kill();
  }

  kill(): void {
    this.proc.kill("SIGKILL");
  }

  async wait(): Promise<number> {
    await this.proc.exited;
    return this._rc() ?? 0;
  }

  get stdin(): { write(d: Uint8Array): number; flush(): number | Promise<number>; end(): void | Promise<void> } | null {
    const s = this.proc.stdin;
    return typeof s === "object" && s !== null
      ? (s as unknown as { write(d: Uint8Array): number; flush(): number | Promise<number>; end(): void | Promise<void> })
      : null;
  }

  get stdoutStream(): ReadableStream<Uint8Array> | null {
    return this._stdoutPiped ? (this.proc.stdout as ReadableStream<Uint8Array>) : null;
  }

  async communicate(input?: Uint8Array): Promise<[string | null, string | null]> {
    const stdin = this.stdin;
    if (input !== undefined && stdin) {
      stdin.write(input);
    }
    if (stdin) {
      try {
        stdin.end();
      } catch {
        /* already closed */
      }
    }
    const readStream = async (s: ReadableStream<Uint8Array> | null): Promise<string | null> => {
      if (!s) return null;
      try {
        return UTF8D.decode(await new Response(s).arrayBuffer());
      } catch {
        // stream already partially consumed (e.g. interactive line reader)
        return "";
      }
    };
    const outP = readStream(this._stdoutPiped ? (this.proc.stdout as ReadableStream<Uint8Array>) : null);
    const errP = readStream(this._stderrPiped ? (this.proc.stderr as ReadableStream<Uint8Array>) : null);
    await this.proc.exited;
    return [await outP, await errP];
  }
}

// ---------------------------------------------------------------------------
// nltk.internals: find_file_iter / find_binary_iter / find_jar_iter
// ---------------------------------------------------------------------------

export interface FindFileOptions {
  env_vars?: string | string[];
  searchpath?: string[];
  file_names?: string[];
  url?: string | null;
  verbose?: boolean;
  finding_dir?: boolean;
}

function _decodeStdoutdata(stdoutdata: Uint8Array | null): string {
  if (stdoutdata === null) return "";
  return UTF8D.decode(stdoutdata);
}

export function* findFileIter(filename: string, options: FindFileOptions = {}): Generator<string> {
  const fileNames = [filename, ...(options.file_names ?? [])];
  const envVars = typeof options.env_vars === "string" ? options.env_vars.split(" ") : (options.env_vars ?? []);
  const searchpath = options.searchpath ?? [];
  const verbose = options.verbose ?? false;
  const findingDir = options.finding_dir ?? false;
  let yielded = false;

  // File exists, no magic
  for (const alternative of fileNames) {
    let pathToFile = pyJoin(filename, alternative);
    if (pyIsfile(pathToFile)) {
      if (verbose) console.log(`[Found ${filename}: ${pathToFile}]`);
      yielded = true;
      yield pathToFile;
    }
    // Check the bare alternatives
    if (pyIsfile(alternative)) {
      if (verbose) console.log(`[Found ${filename}: ${alternative}]`);
      yielded = true;
      yield alternative;
    }
    // Check if the alternative is inside a 'file' directory
    pathToFile = pyJoin(filename, "file", alternative);
    if (pyIsfile(pathToFile)) {
      if (verbose) console.log(`[Found ${filename}: ${pathToFile}]`);
      yielded = true;
      yield pathToFile;
    }
  }

  // Check environment variables
  for (const envVar of envVars) {
    const envVal = process.env[envVar];
    if (envVal === undefined) continue;
    if (findingDir) {
      for (const raw of envVal.split(PATHSEP)) {
        const envDir = expanduser(raw);
        if (envDir) {
          yielded = true;
          yield envDir;
        }
      }
    }
    for (const raw of envVal.split(PATHSEP)) {
      const envDir = expanduser(raw);
      if (pyIsfile(envDir)) {
        if (verbose) console.log(`[Found ${filename}: ${envDir}]`);
        yielded = true;
        yield envDir;
      }
      for (const alternative of fileNames) {
        const pathToFile = pyJoin(envDir, alternative);
        if (pyIsfile(pathToFile)) {
          if (verbose) console.log(`[Found ${filename}: ${pathToFile}]`);
          yielded = true;
          yield pathToFile;
        }
        const binPath = pyJoin(envDir, "bin", alternative);
        if (pyIsfile(binPath)) {
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
      const pathToFile = pyJoin(directory, alternative);
      if (pyIsfile(pathToFile)) {
        yielded = true;
        yield pathToFile;
      }
    }
  }

  // POSIX: try 'which' for each alternative; OSError propagates (e.g. a dead
  // PATH makes `which` itself unresolvable -> FileNotFoundError, as Python).
  // spawnSync errors are wrapped the way Python's FileNotFoundError formats.
  if (process.platform !== "win32") {
    for (const alternative of fileNames) {
      let out: Uint8Array;
      try {
        const p = Bun.spawnSync(["which", alternative], {
          stdout: "pipe",
          stderr: "pipe",
          env: spawnEnv(),
        });
        out = new Uint8Array(p.stdout);
      } catch (e) {
        throw pySpawnError("which", e);
      }
      const path = _decodeStdoutdata(out).trim();
      if (path.endsWith(alternative) && pyExists(path)) {
        if (verbose) console.log(`[Found ${filename}: ${path}]`);
        yielded = true;
        yield path;
      }
    }
  }

  if (!yielded) {
    let msg =
      `NLTK was unable to find the ${filename} file!` +
      "\nUse software specific configuration parameters";
    if (envVars.length) msg += ` or set the ${envVars[0]} environment variable`;
    msg += ".";
    if (searchpath.length) {
      msg += "\n\n  Searched in:";
      msg += searchpath.map((d) => `\n    - ${d}`).join("");
    }
    if (options.url) msg += `\n\n  For more information on ${filename}, see:\n    <${options.url}>`;
    const div = "=".repeat(75);
    throw pyError("LookupError", `\n\n${div}\n${msg}\n${div}`);
  }
}
export const find_file_iter = findFileIter;

export function findFile(filename: string, options: Omit<FindFileOptions, "finding_dir"> = {}): string {
  return findFileIter(filename, options).next().value;
}
export const find_file = findFile;

export function findDir(filename: string, options: Omit<FindFileOptions, "finding_dir"> = {}): string {
  return findFileIter(filename, { ...options, finding_dir: true }).next().value;
}
export const find_dir = findDir;

export interface FindBinaryOptions extends FindFileOptions {
  path_to_bin?: string | null;
  binary_names?: string[];
}

export function* findBinaryIter(name: string, options: FindBinaryOptions = {}): Generator<string> {
  const { path_to_bin, binary_names, ...rest } = options;
  const searchingBareName = !path_to_bin && pyDirname(name) === "";
  let safeMatch = false;
  for (const path of findFileIter(path_to_bin || name, { ...rest, file_names: binary_names })) {
    if (searchingBareName && !pyIsabs(path)) continue;
    safeMatch = true;
    yield path;
  }
  if (searchingBareName && !safeMatch) {
    throw pyError(
      "LookupError",
      `NLTK found ${pyStrRepr(name)} only in the current working directory, which ` +
        "is not a trusted location for executables. Install it on PATH or in " +
        "a configured location, or pass an explicit path_to_bin.",
    );
  }
}
export const find_binary_iter = findBinaryIter;

export function findBinary(name: string, options: FindBinaryOptions = {}): string {
  return findBinaryIter(name, options).next().value;
}
export const find_binary = findBinary;

export interface FindJarOptions {
  path_to_jar?: string | null;
  env_vars?: string | string[];
  searchpath?: string[];
  url?: string | null;
  verbose?: boolean;
  is_regex?: boolean;
}

function reMatch(pattern: string, s: string): RegExpExecArray | null {
  // Python re.match anchors at the start of the string (prefix match).
  return new RegExp(`^(?:${pattern})`).exec(s);
}

export function* findJarIter(namePattern: string, options: FindJarOptions = {}): Generator<string> {
  const isRegex = options.is_regex ?? false;
  const verbose = options.verbose ?? false;
  const searchpath = options.searchpath ?? [];
  let envVars = typeof options.env_vars === "string" ? options.env_vars.split(" ") : (options.env_vars ?? []);
  let yielded = false;

  // Make sure we check the CLASSPATH first
  envVars = ["CLASSPATH", ...envVars];

  // Explicit location
  const pathToJar = options.path_to_jar;
  if (pathToJar !== null && pathToJar !== undefined) {
    if (pyIsfile(pathToJar)) {
      yielded = true;
      yield pathToJar;
    } else {
      throw pyError("LookupError", `Could not find ${namePattern} jar file at ${pathToJar}`);
    }
  }

  // Check environment variables
  for (const envVar of envVars) {
    const envVal = process.env[envVar];
    if (envVal === undefined) continue;
    if (envVar === "CLASSPATH") {
      for (const cpRaw of envVal.split(PATHSEP)) {
        const cp = expanduser(cpRaw);
        if (pyIsfile(cp)) {
          const filename = pyBasename(cp);
          if ((isRegex && reMatch(namePattern, filename)) || (!isRegex && filename === namePattern)) {
            if (verbose) console.log(`[Found ${namePattern}: ${cp}]`);
            yielded = true;
            yield cp;
          }
        }
        if (pyIsdir(cp)) {
          if (!isRegex) {
            if (pyIsfile(pyJoin(cp, namePattern))) {
              if (verbose) console.log(`[Found ${namePattern}: ${cp}]`);
              yielded = true;
              yield pyJoin(cp, namePattern);
            }
          } else {
            for (const fileName of readdirSync(cp)) {
              if (reMatch(namePattern, fileName)) {
                if (verbose) console.log(`[Found ${namePattern}: ${pyJoin(cp, fileName)}]`);
                yielded = true;
                yield pyJoin(cp, fileName);
              }
            }
          }
        }
      }
    } else {
      const jarEnv = expanduser(envVal);
      const jarIter = pyIsdir(jarEnv) ? readdirSync(jarEnv).map((p) => pyJoin(jarEnv, p)) : [jarEnv];
      for (const pathToJarEntry of jarIter) {
        if (pyIsfile(pathToJarEntry)) {
          const filename = pyBasename(pathToJarEntry);
          if ((isRegex && reMatch(namePattern, filename)) || (!isRegex && filename === namePattern)) {
            if (verbose) console.log(`[Found ${namePattern}: ${pathToJarEntry}]`);
            yielded = true;
            yield pathToJarEntry;
          }
        }
      }
    }
  }

  // Check the path list.
  for (const directory of searchpath) {
    if (isRegex) {
      let dirEntries: string[];
      try {
        dirEntries = readdirSync(directory);
      } catch (e) {
        throw pySpawnError(directory, e);
      }
      for (const filename of dirEntries) {
        const pathToJarEntry = pyJoin(directory, filename);
        if (pyIsfile(pathToJarEntry)) {
          if (reMatch(namePattern, filename)) {
            if (verbose) console.log(`[Found ${filename}: ${pathToJarEntry}]`);
          }
        }
        // NLTK quirk: in the is_regex branch the yield is unconditional
        // (mis-indented in nltk/internals.py), so every file in the
        // directory is yielded, match or not.
        yielded = true;
        yield pathToJarEntry;
      }
    } else {
      const pathToJarEntry = pyJoin(directory, namePattern);
      if (pyIsfile(pathToJarEntry)) {
        if (verbose) console.log(`[Found ${namePattern}: ${pathToJarEntry}]`);
        yielded = true;
        yield pathToJarEntry;
      }
    }
  }

  if (!yielded) {
    let msg = `NLTK was unable to find ${namePattern}!`;
    if (envVars.length) msg += ` Set the ${envVars[0]} environment variable`;
    msg = textwrapFill(msg + ".", "  ", "  ");
    if (searchpath.length) {
      msg += "\n\n  Searched in:";
      msg += searchpath.map((d) => `\n    - ${d}`).join("");
    }
    if (options.url) {
      msg += `\n\n  For more information, on ${namePattern}, see:\n    <${options.url}>`;
    }
    const div = "=".repeat(75);
    throw pyError("LookupError", `\n\n${div}\n${msg}\n${div}`);
  }
}
export const find_jar_iter = findJarIter;

export function findJar(namePattern: string, options: FindJarOptions = {}): string {
  return findJarIter(namePattern, options).next().value;
}
export const find_jar = findJar;

/** find_jars_within_path — os.walk + fnmatch('*.jar'). */
export function findJarsWithinPath(pathToJars: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = pyJoin(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jar")) out.push(p);
    }
  };
  walk(pathToJars);
  return out;
}
export const find_jars_within_path = findJarsWithinPath;

// ---------------------------------------------------------------------------
// nltk.internals: java machinery (+ CVE-2026-12841 allowlist + jar sandbox)
// ---------------------------------------------------------------------------

/** Mutable module state mirroring nltk.internals._java_bin / _java_options. */
export const _javaState = {
  bin: null as string | null,
  options: [] as string[],
};

const _SAFE_JVM_PREFIXES = [
  "-xmx", "-mx", "-xms", "-ms", "-xss", "-ss", "-xbatch", "-xint", "-xcomp",
  "-xmixed", "-verbose",
];
const _SAFE_JVM_EXACT = new Set(["-server", "-client"]);
const _MODULE_LIST_RE = /^[A-Za-z0-9_.,-]+$/;
const _UNSAFE_OPTION_CHARS = new Set(" \t\r\n;|&$`<>(){}[]*?!'\"\\");

/** nltk.internals._validate_java_options. */
export function validateJavaOptions(options: Iterable<string>): void {
  const opts = [...options];
  let i = 0;
  while (i < opts.length) {
    const flag = opts[i]!;
    if (typeof flag !== "string" || !flag) {
      throw pyError(
        "ValueError",
        `java_options contains an invalid (non-string or empty) entry: ` +
          `${pyRepr(flag)} (CVE-2026-12841, CWE-88).`,
      );
    }
    let bad = false;
    for (const c of flag) {
      const cp = c.codePointAt(0)!;
      if (/\s/.test(c) || cp < 0x20 || cp === 0x7f || _UNSAFE_OPTION_CHARS.has(c)) {
        bad = true;
        break;
      }
    }
    if (bad) {
      throw pyError(
        "ValueError",
        `java_options contains whitespace, a control character, or a ` +
          `shell metacharacter, which a valid JVM flag never does: ` +
          `${pyRepr(flag)} (CVE-2026-12841, CWE-88).`,
      );
    }
    const n = flag.toLowerCase();
    if (n.startsWith("@")) {
      throw pyError(
        "ValueError",
        `java_options contains a disallowed Java argument file ` +
          `reference: ${pyRepr(flag)} (CVE-2026-12841, CWE-88).`,
      );
    }
    if (n === "--add-modules") {
      const mods: unknown = i + 1 < opts.length ? opts[i + 1] : null;
      if (typeof mods !== "string" || !_MODULE_LIST_RE.test(mods)) {
        throw pyError(
          "ValueError",
          `--add-modules must be followed by a plain module list, got ` +
            `${pyRepr(mods)} (CVE-2026-12841, CWE-88).`,
        );
      }
      i += 2;
      continue;
    }
    if (n.startsWith("--add-modules=")) {
      if (!_MODULE_LIST_RE.test(flag.split("=", 2)[1]!)) {
        throw pyError(
          "ValueError",
          `--add-modules has a non-module-list value: ${pyRepr(flag)} ` +
            `(CVE-2026-12841, CWE-88).`,
        );
      }
      i += 1;
      continue;
    }
    if (_SAFE_JVM_EXACT.has(n)) {
      i += 1;
      continue;
    }
    if (_SAFE_JVM_PREFIXES.some((p) => n.startsWith(p))) {
      i += 1;
      continue;
    }
    throw pyError(
      "ValueError",
      `java_options contains a disallowed JVM/launcher flag: ${pyRepr(flag)}. ` +
        `Only JVM memory/stack tuning, -verbose, -server/-client and ` +
        `--add-modules are permitted; pass anything else through ` +
        `java(trusted_raw_options=...) (CVE-2026-12841, CWE-88).`,
    );
  }
}
export const _validate_java_options = validateJavaOptions;

/**
 * Trusted jar roots: mirrors nltk.data.path for this port. `null` computes the
 * default list (NLTK_DATA entries, ~/nltk_data, then the standard system
 * dirs); assign an array to override, mirroring the mutable nltk.data.path.
 */
export let jarSandboxDataPath: string[] | null = null;
export function setJarSandboxDataPath(v: string[] | null): void {
  jarSandboxDataPath = v;
}

export function computeJarSandboxDataPath(): string[] {
  if (jarSandboxDataPath !== null) return jarSandboxDataPath;
  const roots: string[] = [];
  const nd = process.env.NLTK_DATA;
  if (nd) roots.push(...nd.split(PATHSEP).filter((p) => p !== ""));
  roots.push(expanduser("~/nltk_data"));
  roots.push(
    "/usr/share/nltk_data",
    "/usr/local/share/nltk_data",
    "/usr/lib/nltk_data",
    "/usr/local/lib/nltk_data",
  );
  return roots;
}

/** internals.ts' UntrustedJarError doesn't set `name`; differential pins key
 * off `type(e).__name__`, so surface the Python class name explicitly. */
function mkUntrustedJarError(message: string): UntrustedJarError {
  const e = new UntrustedJarError(message);
  e.name = "UntrustedJarError";
  return e;
}

/** nltk.internals._verify_jar_sandbox. */
export function verifyJarSandbox(classpathEntries: string | Iterable<string>): void {
  if (process.env.NLTK_ALLOW_UNSAFE_JARS === "1" || process.env.NLTK_ALLOW_UNSAFE_CLASSPATH === "1") {
    warn("Arbitrary JAR execution is permitted via NLTK_ALLOW_UNSAFE_JARS/CLASSPATH=1", "UserWarning");
    return;
  }
  const entries = typeof classpathEntries === "string" ? [classpathEntries] : [...classpathEntries];

  const trustedRoots: string[] = [];
  for (const p of computeJarSandboxDataPath()) {
    try {
      trustedRoots.push(pyRealpath(p));
    } catch {
      continue;
    }
  }
  for (const wp of ["/usr/share/weka", "/usr/local/weka", "/opt/weka"]) {
    try {
      const absWp = pyRealpath(wp);
      if (pyIsdir(absWp)) trustedRoots.push(absWp);
    } catch {
      continue;
    }
  }
  const dedup = [...new Set(trustedRoots)];

  for (const entry of entries) {
    if (!entry) continue;
    if (!pyIsabs(entry)) {
      throw mkUntrustedJarError(`Relative paths are strictly forbidden: ${entry}`);
    }
    const cleanEntry = pyRealpath(entry); // normcase is a no-op on POSIX
    let allowed = false;
    for (const root of dedup) {
      try {
        if (pyCommonpath([root, cleanEntry]) === root) {
          allowed = true;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!allowed) {
      throw mkUntrustedJarError(
        `Classpath entry ${entry} is not in a trusted location (outside nltk_data).\n` +
          `Trusted roots: ${pyListRepr(dedup)}`,
      );
    }
  }
}
export const _verify_jar_sandbox = verifyJarSandbox;

/** nltk.internals.config_java. */
export function configJava(cfg: { bin?: string | null; options?: string | string[] | null; verbose?: boolean } = {}): void {
  const { bin = null, options = null, verbose = false } = cfg;
  _javaState.bin = findBinary("java", {
    path_to_bin: bin,
    env_vars: ["JAVAHOME", "JAVA_HOME"],
    verbose,
    binary_names: ["java.exe"],
  });
  if (options !== null) {
    let opts: string[];
    if (typeof options === "string") opts = options.split(/\s+/).filter((s) => s !== "");
    else opts = [...options];
    validateJavaOptions(opts);
    _javaState.options = opts;
  }
}
export const config_java = configJava;

export interface JavaOptions {
  classpath?: string | string[] | null;
  stdin?: SpawnStream;
  stdout?: SpawnStream;
  stderr?: SpawnStream;
  blocking?: boolean;
  options?: string | string[] | null;
  trusted_raw_options?: string | string[] | null;
}

function _normaliseStream(stream: SpawnStream): "pipe" | "devnull" | null {
  if (stream === null || stream === undefined) return null;
  if (stream === "pipe" || stream === true) return "pipe";
  if (stream === "devnull") return "devnull";
  return stream as "pipe";
}

/** nltk.internals.java — blocking variant returns [stdout, stderr] strings. */
export function java(cmd: string[] | string, options: JavaOptions & { blocking: false }): PyPopen;
export function java(cmd: string[] | string, options?: JavaOptions): [string | null, string | null];
export function java(cmd: string[] | string, options: JavaOptions = {}): [string | null, string | null] | PyPopen {
  if (typeof cmd === "string") {
    throw pyError("TypeError", "cmd must be a sequence of strings, not a string");
  }
  const cmdList = [...cmd];
  const stdin = _normaliseStream(options.stdin);
  const stdout = _normaliseStream(options.stdout);
  const stderr = _normaliseStream(options.stderr);
  const blocking = options.blocking ?? true;

  let optList: string[];
  if (options.options === null || options.options === undefined) {
    optList = _javaState.options.length ? [..._javaState.options] : [];
  } else {
    optList = typeof options.options === "string" ? options.options.split(/\s+/).filter((s) => s !== "") : [...options.options];
    validateJavaOptions(optList);
  }
  if (options.trusted_raw_options) {
    const tro = typeof options.trusted_raw_options === "string"
      ? options.trusted_raw_options.split(/\s+/).filter((s) => s !== "")
      : [...options.trusted_raw_options];
    optList = optList.concat(tro);
  }

  let classpathArg: string | null = null;
  if (options.classpath !== null && options.classpath !== undefined) {
    let rawEntries: string[];
    let originalClasspathString: string | null;
    if (typeof options.classpath === "string") {
      rawEntries = options.classpath.split(PATHSEP).filter((p) => p !== "");
      originalClasspathString = options.classpath;
    } else {
      rawEntries = [...options.classpath];
      originalClasspathString = null;
    }
    if (!rawEntries.length) throw pyError("ValueError", "Classpath is empty after splitting");
    verifyJarSandbox(rawEntries);
    classpathArg = originalClasspathString ?? rawEntries.join(PATHSEP);
  }

  const finalCmd: string[] = [];
  finalCmd.push(_javaState.bin ?? "java");
  finalCmd.push(...optList);
  if (classpathArg !== null) finalCmd.push("-cp", classpathArg);
  finalCmd.push(...cmdList);

  const io = (s: "pipe" | "devnull" | null) => (s === null ? "inherit" : s);
  try {
    if (blocking) {
      const r = spawnSyncPy(finalCmd, {
        stdin: io(stdin) === "pipe" ? "pipe" : io(stdin) === "devnull" ? "devnull" : "inherit",
        stdout: io(stdout) === "pipe" ? "pipe" : io(stdout) === "devnull" ? "devnull" : "inherit",
        stderr: io(stderr) === "pipe" ? "pipe" : io(stderr) === "devnull" ? "devnull" : "inherit",
      });
      const stdoutData = stdout === "pipe" ? UTF8D.decode(r.stdout!) : null;
      const stderrData = stderr === "pipe" ? UTF8D.decode(r.stderr!) : null;
      const returncode = r.signalCode ? killedToReturnCode(r.signalCode)! : r.exitCode;
      if (returncode !== 0) {
        throw pyError(
          "OSError",
          `Java command failed: ${finalCmd.join(" ")}\n` +
            `Return code: ${returncode}\nOutput: ${stdoutData}\nError: ${stderrData}`,
        );
      }
      return [stdoutData, stderrData];
    }
    return new PyPopen(finalCmd, { stdin, stdout, stderr });
  } catch (e) {
    // Python: `except OSError as e: raise OSError(f"Failed to execute Java
    // command: ...\nError: {e}")` — this also re-wraps the "Java command
    // failed" OSError raised by the rc!=0 branch above.
    if (e instanceof Error && ["OSError", "FileNotFoundError", "PermissionError"].includes(e.name)) {
      throw pyError("OSError", `Failed to execute Java command: ${finalCmd.join(" ")}\nError: ${e.message}`);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// nltk.parse.corenlp
// ---------------------------------------------------------------------------

/** nltk.parse.corenlp.CoreNLPServerError (EnvironmentError semantics). */
export class CoreNLPServerError extends Error {
  readonly errno: number | null;
  constructor(a?: unknown, b?: unknown) {
    if (a === undefined) super("");
    else if (b === undefined) super(String(a));
    else super(`[Errno ${a}] ${b}`);
    this.name = "CoreNLPServerError";
    this.errno = typeof a === "number" && b !== undefined ? a : null;
  }
}

/** nltk.parse.corenlp.try_port — bind localhost, close, return the port. */
export function tryPort(port = 0): number {
  try {
    const listener = Bun.listen({
      hostname: "localhost",
      socket: {
        open() {},
        data() {},
      },
      port,
    });
    const p = listener.port;
    listener.stop();
    return p;
  } catch {
    throw pyError("OSError", "[Errno 98] Address already in use");
  }
}
export const try_port = tryPort;

/** Python max() over jar names with re.match keys — only len==1 is safe. */
function pyMaxJar(jars: string[], pattern: string): string {
  if (jars.length === 1) return jars[0]!;
  // re.match is anchored at the path start, so a full path like
  // /dir/stanford-corenlp-3.9.2.jar yields None (NoneType), not a Match.
  const keyType = (jar: string) => (reMatch(pattern, jar) ? "re.Match" : "NoneType");
  // max() compares key(jars[i]) > key(best); the first comparison raises.
  const a = keyType(jars[0]!);
  const b = keyType(jars[1]!);
  throw pyError("TypeError", `'>' not supported between instances of '${b}' and '${a}'`);
}

const _STANFORD_URL = "https://stanfordnlp.github.io/CoreNLP/";

export class CoreNLPServer {
  static _MODEL_JAR_PATTERN = "stanford-corenlp-(\\d+)\\.(\\d+)\\.(\\d+)-models\\.jar";
  static _JAR = "stanford-corenlp-(\\d+)\\.(\\d+)\\.(\\d+)\\.jar";

  url = "";
  verbose: boolean;
  _classpath: [string, string] = ["", ""];
  corenlp_options: string[];
  java_options: string[];
  popen: PyPopen | null = null;

  constructor(options: {
    path_to_jar?: string | null;
    path_to_models_jar?: string | null;
    verbose?: boolean;
    java_options?: string[] | null;
    corenlp_options?: string[] | null;
    port?: number | null;
  } = {}) {
    const corenlpOptions = options.corenlp_options ?? ["-preload", "tokenize,ssplit,pos,lemma,parse,depparse"];
    const jars = [
      ...findJarIter(CoreNLPServer._JAR, {
        path_to_jar: options.path_to_jar ?? null,
        env_vars: ["CORENLP"],
        searchpath: [],
        url: _STANFORD_URL,
        verbose: options.verbose ?? false,
        is_regex: true,
      }),
    ];
    const stanfordJar = pyMaxJar(jars, CoreNLPServer._JAR);

    let port = options.port ?? null;
    if (port === null) {
      try {
        port = tryPort(9000);
      } catch {
        port = tryPort();
        corenlpOptions.push("-port", String(port));
      }
    } else {
      tryPort(port);
      corenlpOptions.push("-port", String(port));
    }
    this.url = `http://localhost:${port}`;

    const modelJar = pyMaxJar(
      [
        ...findJarIter(CoreNLPServer._MODEL_JAR_PATTERN, {
          path_to_jar: options.path_to_models_jar ?? null,
          env_vars: ["CORENLP_MODELS"],
          searchpath: [],
          url: _STANFORD_URL,
          verbose: options.verbose ?? false,
          is_regex: true,
        }),
      ],
      CoreNLPServer._MODEL_JAR_PATTERN,
    );

    this.verbose = options.verbose ?? false;
    this._classpath = [stanfordJar, modelJar];
    this.corenlp_options = corenlpOptions;
    this.java_options = options.java_options ?? ["-mx2g"];
  }

  async start(stdout: "devnull" | "pipe" | null = "devnull", stderr: "devnull" | "pipe" | null = "devnull"): Promise<void> {
    _importRequests();
    const cmd = ["edu.stanford.nlp.pipeline.StanfordCoreNLPServer"];
    if (this.corenlp_options) cmd.push(...this.corenlp_options);

    const defaultOptions = _javaState.options.join(" ");
    configJava({ options: this.java_options, verbose: this.verbose });
    try {
      this.popen = java(cmd, {
        classpath: this._classpath,
        blocking: false,
        stdout,
        stderr,
      });
    } finally {
      configJava({ options: defaultOptions, verbose: this.verbose });
    }

    const returncode = this.popen.poll();
    if (returncode !== null) {
      const [, stderrdata] = await this.popen.communicate();
      // universal_newlines=True makes communicate() return str; Python's
      // `.decode("ascii")` on a str raises AttributeError ('str' object has no
      // attribute 'decode'), on None -> 'NoneType'. The CoreNLPServerError
      // construction below is therefore unreachable in the oracle too.
      const decoded = pyDecode(stderrdata as string | null, "ascii");
      throw new CoreNLPServerError(returncode, `Could not start the server. The error was: ${decoded}`);
    }

    let live = false;
    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(this.url + "/live", { signal: AbortSignal.timeout(60000) });
        if (response.ok) {
          live = true;
          break;
        }
      } catch {
        await Bun.sleep(1000);
      }
    }
    if (!live) throw new CoreNLPServerError("Could not connect to the server.");

    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(this.url + "/ready", { signal: AbortSignal.timeout(60000) });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await Bun.sleep(1000);
      }
    }
    if (!ready) throw new CoreNLPServerError("The server is not ready.");
  }

  async stop(): Promise<void> {
    if (this.popen) {
      this.popen.terminate();
      await this.popen.wait();
    }
  }
}

/** lenient/strict json.loads for Response.json(strict=...). */
export function pyJsonLoads(text: string, strict = true): unknown {
  const parse = (t: string): unknown => {
    try {
      return JSON.parse(t);
    } catch (e) {
      // Python json.loads raises JSONDecodeError (a ValueError subclass);
      // keep the exception name while retaining JSON.parse's message.
      const err = pyError("JSONDecodeError", String((e as Error)?.message ?? e));
      (err as { name: string }).name = "JSONDecodeError";
      throw err;
    }
  };
  if (strict) {
    // json.loads(strict=True): raw control chars (cp < 0x20) inside strings
    // are rejected with a positional JSONDecodeError. JSON.parse's own
    // message differs, so scan for the offending char and emit Python's.
    let inStr = false;
    let esc = false;
    let pos = 0;
    let line = 1;
    let lineStart = 0;
    for (const ch of text) {
      if (esc) esc = false;
      else if (inStr && ch === "\\") esc = true;
      else if (ch === '"') inStr = !inStr;
      else if (inStr && ch.codePointAt(0)! < 0x20) {
        throw pyError(
          "JSONDecodeError",
          `Invalid control character at: line ${line} column ${pos - lineStart + 1} (char ${pos})`,
        );
      }
      if (ch === "\n") {
        line += 1;
        lineStart = pos + 1;
      }
      pos += 1;
    }
    return parse(text);
  }
  let out = "";
  let inStr = false;
  let esc = false;
  for (const ch of text) {
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (inStr && ch === "\\") {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if (inStr && cp < 0x20) {
      out += "\\u" + cp.toString(16).padStart(4, "0");
      continue;
    }
    out += ch;
  }
  return parse(out);
}

/** json.dumps(obj) with Python default separators (', ', ': ') + ensure_ascii. */
export function pyJsonDumps(v: unknown): string {
  const escStr = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const cp = ch.codePointAt(0)!;
      if (ch === '"') out += '\\"';
      else if (ch === "\\") out += "\\\\";
      else if (ch === "\b") out += "\\b";
      else if (ch === "\f") out += "\\f";
      else if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else if (cp < 0x20 || cp > 0x7e) {
        if (cp <= 0xffff) out += "\\u" + cp.toString(16).padStart(4, "0");
        else {
          const c = cp - 0x10000;
          out += "\\u" + (0xd800 + (c >> 10)).toString(16).padStart(4, "0") +
                 "\\u" + (0xdc00 + (c & 0x3ff)).toString(16).padStart(4, "0");
        }
      } else out += ch;
    }
    return out + '"';
  };
  const enc = (x: unknown): string => {
    if (x === null || x === undefined) return "null";
    if (typeof x === "string") return escStr(x);
    if (typeof x === "number") return Number.isInteger(x) ? String(x) : JSON.stringify(x);
    if (typeof x === "boolean") return x ? "true" : "false";
    if (Array.isArray(x)) return "[" + x.map(enc).join(", ") + "]";
    if (typeof x === "object") {
      const parts: string[] = [];
      for (const [k, val] of Object.entries(x as Record<string, unknown>)) {
        parts.push(`${escStr(k)}: ${enc(val)}`);
      }
      return "{" + parts.join(", ") + "}";
    }
    return String(x);
  };
  return enc(v);
}

/** urllib.parse.quote_plus / requests' urlencode of a str->str dict. */
export function quotePlus(s: string): string {
  const bytes = UTF8.encode(s);
  let out = "";
  for (const b of bytes) {
    const c = String.fromCharCode(b);
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "_" || c === "." || c === "-" || c === "~") {
      out += c;
    } else if (c === " ") {
      out += "+";
    } else {
      out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

export function urlencode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${quotePlus(k)}=${quotePlus(v)}`)
    .join("&");
}

const HTTP_REASONS: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 408: "Request Timeout", 409: "Conflict",
  410: "Gone", 413: "Payload Too Large", 414: "URI Too Long", 415: "Unsupported Media Type",
  418: "I'm a Teapot", 422: "Unprocessable Entity", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

interface CoreNlpRequestRecord {
  method: string;
  path: string;
  contentType: string | null;
  body: string;
}

/** Injectable HTTP transport (mirrors requests.Session.post) for tests. */
export type CoreNlpPost = (
  url: string,
  params: Record<string, string>,
  data: Uint8Array,
  headers: Record<string, string>,
  timeout: number,
) => Promise<{ status: number; reason: string; body: Uint8Array; url: string; ok: boolean }>;

async function defaultPost(
  url: string,
  params: Record<string, string>,
  data: Uint8Array,
  headers: Record<string, string>,
  timeout: number,
): Promise<{ status: number; reason: string; body: Uint8Array; url: string; ok: boolean }> {
  const qs = urlencode(params);
  const fullUrl = url + (url.includes("?") ? "&" : "?") + qs;
  let resp: Response;
  try {
    resp = await fetch(fullUrl, {
      method: "POST",
      body: data.slice().buffer as ArrayBuffer,
      headers,
      signal: AbortSignal.timeout(timeout * 1000),
    });
  } catch (e) {
    throw pyError("ConnectionError", String((e as Error)?.message ?? e));
  }
  const body = new Uint8Array(await resp.arrayBuffer());
  return { status: resp.status, reason: resp.statusText || HTTP_REASONS[resp.status] || "", body, url: fullUrl, ok: resp.ok };
}

/** Mirrors `import requests` availability inside corenlp methods. */
let _requestsAvailable = true;
export function setRequestsAvailable(v: boolean): void {
  _requestsAvailable = v;
}
function _importRequests(): void {
  if (!_requestsAvailable) throw pyError("ModuleNotFoundError", "No module named 'requests'");
}

export class GenericCoreNLPParser {
  url: string;
  encoding: string;
  tagtype: string | null;
  strict_json: boolean;
  /** Test hook replacing requests.Session().post. */
  post: CoreNlpPost = defaultPost;
  /** Recorded requests (method/url/headers/body) for differential pinning. */
  lastRequest: CoreNlpRequestRecord | null = null;

  _OUTPUT_FORMAT = "";
  static parser_annotator = "";

  constructor(
    url:
      | string
      | { url?: string; encoding?: string; tagtype?: string | null; strict_json?: boolean } = "http://localhost:9000",
    encoding = "utf8",
    tagtype: string | null = null,
    strict_json = true,
  ) {
    _importRequests();
    if (url !== null && typeof url === "object") {
      ({ encoding = "utf8", tagtype = null, strict_json = true } = url);
      url = url.url ?? "http://localhost:9000";
    }
    this.url = url as string;
    this.encoding = encoding;
    if (!["pos", "ner", null].includes(tagtype)) {
      throw pyError("ValueError", "tagtype must be either 'pos', 'ner' or None");
    }
    this.tagtype = tagtype;
    this.strict_json = strict_json;
  }

  parseSents(sentences: Iterable<string[]>, properties: Record<string, string> | null = null): AsyncGenerator<unknown[]> {
    const strs = mapIter(sentences, (words) => words.join(" "));
    return this.rawParseSents(strs, false, properties);
  }
  parse_sents = this.parseSents;

  async rawParse(sentence: string, properties: Record<string, string> | null = null): Promise<unknown> {
    const defaultProperties: Record<string, string> = { "tokenize.whitespace": "false" };
    Object.assign(defaultProperties, properties ?? {});
    const it = this.rawParseSents([sentence], false, defaultProperties);
    const first = await it.next();
    return first.value;
  }
  raw_parse = this.rawParse;

  async apiCall(data: string, properties: Record<string, string> | null = null, timeout = 60): Promise<Record<string, unknown>> {
    const defaultProperties: Record<string, string> = {
      outputFormat: "json",
      annotators: `tokenize,pos,lemma,ssplit,${(this.constructor as typeof GenericCoreNLPParser).parser_annotator}`,
    };
    Object.assign(defaultProperties, properties ?? {});

    const params = { properties: pyJsonDumps(defaultProperties) };
    const headers = { "Content-Type": `text/plain; charset=${this.encoding}` };
    const body = pyEncode(data, this.encoding);
    const response = await this.post(this.url, params, body, headers, timeout);

    if (response.status >= 400) {
      // The oracle's requests shim raise_for_status() emits "<status> Error".
      throw pyError("HTTPError", `${response.status} Error`);
    }
    return pyJsonLoads(UTF8D.decode(response.body), this.strict_json) as Record<string, unknown>;
  }
  api_call = this.apiCall;

  async *rawParseSents(
    sentences: Iterable<string>,
    _verbose = false,
    properties: Record<string, string> | null = null,
  ): AsyncGenerator<unknown[]> {
    const defaultProperties: Record<string, string> = { "ssplit.eolonly": "true" };
    Object.assign(defaultProperties, properties ?? {});
    const parsedData = (await this.apiCall([...sentences].join("\n"), defaultProperties)) as {
      sentences: unknown[];
    };
    for (const parsedSent of parsedData.sentences) {
      yield [this.makeTree(parsedSent)];
    }
  }
  raw_parse_sents = this.rawParseSents;

  async *parseText(text: string, properties: Record<string, string> | null = null): AsyncGenerator<unknown> {
    const parsedData = (await this.apiCall(text, properties)) as { sentences: unknown[] };
    for (const parse of parsedData.sentences) {
      yield this.makeTree(parse);
    }
  }
  parse_text = this.parseText;

  async *tokenize(text: string, properties: Record<string, string> | null = null): AsyncGenerator<string> {
    const defaultProperties: Record<string, string> = { annotators: "tokenize,ssplit" };
    Object.assign(defaultProperties, properties ?? {});
    const result = (await this.apiCall(text, defaultProperties)) as {
      sentences: { tokens: Record<string, string | null>[] }[];
    };
    for (const sentence of result.sentences) {
      for (const token of sentence.tokens) {
        yield token["originalText"] || (token["word"] as string);
      }
    }
  }

  async tagSents(sentences: Iterable<string[]>, properties: Record<string, string> | null = null): Promise<[string, string][][]> {
    const strs = mapIter(sentences, (words) => words.join(" "));
    let props = properties;
    if (props === null || props === undefined) {
      props = { "tokenize.whitespace": "true", "ner.useSUTime": "false" };
    }
    const out: [string, string][][] = [];
    for await (const inner of this.rawTagSents(strs, props)) {
      out.push(inner[0]!);
    }
    return out;
  }
  tag_sents = this.tagSents;

  async tag(sentence: string[], properties: Record<string, string> | null = null): Promise<[string, string][]> {
    return (await this.tagSents([sentence], properties))[0]!;
  }

  async *rawTagSents(
    sentences: Iterable<string>,
    properties: Record<string, string> | null = null,
  ): AsyncGenerator<[string, string][][]> {
    const defaultProperties: Record<string, string> = {
      "ssplit.isOneSentence": "true",
      annotators: "tokenize,ssplit,",
    };
    Object.assign(defaultProperties, properties ?? {});
    if (!(this.tagtype === "pos" || this.tagtype === "ner")) {
      throw pyError("AssertionError", "CoreNLP tagger supports only 'pos' or 'ner' tags.");
    }
    defaultProperties["annotators"] += this.tagtype;
    for (const sentence of sentences) {
      const taggedData = (await this.apiCall(sentence, defaultProperties)) as {
        sentences: { tokens: Record<string, string>[] }[];
      };
      yield taggedData.sentences.map((taggedSentence) =>
        taggedSentence.tokens.map((token) => [token["word"]!, token[this.tagtype!]!] as [string, string]),
      );
    }
  }
  raw_tag_sents = this.rawTagSents;

  makeTree(_result: unknown): unknown {
    throw pyError("NotImplementedError", "make_tree must be implemented by subclasses");
  }
  make_tree = this.makeTree;
}

function* mapIter<T, U>(it: Iterable<T>, f: (x: T) => U): Generator<U> {
  for (const x of it) yield f(x);
}

export class CoreNLPParser extends GenericCoreNLPParser {
  override _OUTPUT_FORMAT = "penn";
  static override parser_annotator = "parse";

  override makeTree(result: unknown): SimpleTree {
    return SimpleTree.fromstring((result as { parse: string }).parse);
  }
  override make_tree = this.makeTree;
}

export class CoreNLPDependencyParser extends GenericCoreNLPParser {
  override _OUTPUT_FORMAT = "conll2007";
  static override parser_annotator = "depparse";

  override makeTree(result: unknown): DependencyGraph {
    const rows = [...corenlpTransform(result as CoreNlpSentence)].sort((a, b) => {
      const x = a[0] as number;
      const y = b[0] as number;
      return x - y;
    });
    const lines = rows.map((row) => row.slice(1).join(" ")).join("\n");
    return new DependencyGraph(lines, { cellSeparator: " " });
  }
  override make_tree = this.makeTree;
}

// ---------------------------------------------------------------------------
// nltk.tag.stanford
// ---------------------------------------------------------------------------

const _STANFORD_Tagger_URL = "https://nlp.stanford.edu/software";

export class StanfordTagger {
  static _SEPARATOR = "";
  static _JAR = "";
  protected _cls<T extends typeof StanfordTagger = typeof StanfordTagger>(): T {
    return this.constructor as T;
  }
  _stanford_jar = "";
  _stanford_model = "";
  _encoding = "utf8";
  java_options: string | string[] = "-mx1000m";
  _input_file_path: string | null = null;

  constructor(
    model_filename: string,
    options: {
      path_to_jar?: string | null;
      encoding?: string;
      verbose?: boolean;
      java_options?: string | string[];
    } = {},
  ) {
    if ((this as { constructor: { name: string } }).constructor === StanfordTagger) {
      throw pyError(
        "TypeError",
        "Can't instantiate abstract class StanfordTagger without an implementation for abstract method '_cmd'",
      );
    }
    warn(
      "\nThe StanfordTokenizer will be deprecated in version 3.2.6.\n" +
        "Please use \u001b[91mnltk.parse.corenlp.CoreNLPParser\u001b[0m instead.",
      "DeprecationWarning",
    );
    if (!this._cls()._JAR) {
      warn(
        "The StanfordTagger class is not meant to be instantiated directly. " +
          "Did you mean StanfordPOSTagger or StanfordNERTagger?",
      );
    }
    this._stanford_jar = findJar(this._cls()._JAR, {
      path_to_jar: options.path_to_jar ?? null,
      searchpath: [],
      url: _STANFORD_Tagger_URL,
      verbose: options.verbose ?? false,
    });
    this._stanford_model = findFile(model_filename, {
      env_vars: ["STANFORD_MODELS"],
      verbose: options.verbose ?? false,
    });
    this._encoding = options.encoding ?? "utf8";
    this.java_options = options.java_options ?? "-mx1000m";
  }

  get _cmd(): string[] {
    throw pyError("NotImplementedError", "_cmd must be implemented by subclasses");
  }

  tag(tokens: string[]): [string, string][] {
    return this.tagSents([tokens]).flat();
  }

  tagSents(sentences: string[][]): [string, string][][] {
    const encoding = this._encoding;
    let inputFilePath: string | null = null;
    let javaSucceeded = false;
    let stanposOutput: string | null = null;
    let cleanupErr: unknown = null;
    try {
      const { fd, path } = mkstemp("tmp");
      inputFilePath = path;
      this._input_file_path = inputFilePath;
      closeSync(fd);

      const cmd = [...this._cmd, "-encoding", encoding];
      const input = sentences.map((x) => x.join(" ")).join("\n");
      writeFileSync(inputFilePath, pyEncode(input, encoding));

      const [out] = java(cmd, {
        classpath: this._stanford_jar,
        stdout: "pipe",
        stderr: "pipe",
        options: this.java_options,
      });
      // java() uses universal_newlines=True, so `out` is str; Python calls
      // .decode(encoding) on it -> AttributeError ('str' object has no
      // attribute 'decode'). Preserved verbatim.
      stanposOutput = pyDecode(out, encoding);
      javaSucceeded = true;
    } finally {
      if (inputFilePath) {
        try {
          unlinkSync(inputFilePath);
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err?.code === "ENOENT") {
            // pass
          } else if (javaSucceeded) {
            cleanupErr = e;
          }
        }
      }
    }
    if (cleanupErr) throw cleanupErr;
    return this.parseOutput(stanposOutput as string, sentences);
  }
  tag_sents = this.tagSents;

  parseOutput(text: string, _sentences: string[][] | null = null): [string, string][][] {
    const taggedSentences: [string, string][][] = [];
    for (const taggedSentence of text.trim().split("\n")) {
      const sentence: [string, string][] = [];
      for (const taggedWord of taggedSentence.trim().split(/\s+/)) {
        if (taggedWord === "") continue;
        const wordTags = taggedWord.trim().split(this._cls()._SEPARATOR);
        sentence.push([wordTags.slice(0, -1).join(""), wordTags[wordTags.length - 1]!.replace(/0/g, "").toUpperCase()]);
      }
      taggedSentences.push(sentence);
    }
    return taggedSentences;
  }
  parse_output = this.parseOutput;
}

export class StanfordPOSTagger extends StanfordTagger {
  static override _SEPARATOR = "_";
  static override _JAR = "stanford-postagger.jar";

  override get _cmd(): string[] {
    return [
      "edu.stanford.nlp.tagger.maxent.MaxentTagger",
      "-model",
      this._stanford_model,
      "-textFile",
      this._input_file_path!,
      "-tokenize",
      "false",
      "-outputFormatOptions",
      "keepEmptySentences",
    ];
  }
}

export class StanfordNERTagger extends StanfordTagger {
  static override _SEPARATOR = "/";
  static override _JAR = "stanford-ner.jar";
  static _FORMAT = "slashTags";

  override get _cmd(): string[] {
    return [
      "edu.stanford.nlp.ie.crf.CRFClassifier",
      "-loadClassifier",
      this._stanford_model,
      "-textFile",
      this._input_file_path!,
      "-outputFormat",
      this._cls<typeof StanfordNERTagger>()._FORMAT,
      "-tokenizerFactory",
      "edu.stanford.nlp.process.WhitespaceTokenizer",
      "-tokenizerOptions",
      '"tokenizeNLs=false"',
    ];
  }

  override parseOutput(text: string, sentences: string[][] | null = null): [string, string][][] {
    if (this._cls<typeof StanfordNERTagger>()._FORMAT === "slashTags") {
      const taggedSentences: [string, string][] = [];
      for (const taggedSentence of text.trim().split("\n")) {
        for (const taggedWord of taggedSentence.trim().split(/\s+/)) {
          if (taggedWord === "") continue;
          const wordTags = taggedWord.trim().split(this._cls()._SEPARATOR);
          taggedSentences.push([wordTags.slice(0, -1).join(""), wordTags[wordTags.length - 1]!]);
        }
      }
      const result: [string, string][][] = [];
      let start = 0;
      for (const sent of sentences ?? []) {
        result.push(taggedSentences.slice(start, start + sent.length));
        start += sent.length;
      }
      return result;
    }
    throw pyError("NotImplementedError", "");
  }
  override parse_output = this.parseOutput;
}

// ---------------------------------------------------------------------------
// nltk.tag.hunpos
// ---------------------------------------------------------------------------

const _HUNPOS_URL = "https://code.google.com/p/hunpos/";
const _HUNPOS_CHARSET = "ISO-8859-1";

class PipeLineReader {
  private buf = new Uint8Array(0);
  // Bun's stream reader has an extended surface (readMany); keep it opaque.
  private reader: { read(): Promise<{ value?: Uint8Array; done: boolean }> };
  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader() as unknown as typeof this.reader;
  }
  /** bytes up to and including '\n' (like file.readline()); null at EOF. */
  async readline(): Promise<Uint8Array | null> {
    for (;;) {
      const idx = this.buf.indexOf(0x0a);
      if (idx >= 0) {
        const line = this.buf.slice(0, idx + 1);
        this.buf = this.buf.slice(idx + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) {
        if (this.buf.length === 0) return null;
        const r = this.buf;
        this.buf = new Uint8Array(0);
        return r;
      }
      const nb = new Uint8Array(this.buf.length + value!.length);
      nb.set(this.buf);
      nb.set(value!, this.buf.length);
      this.buf = nb;
    }
  }
}

function bytesStrip(b: Uint8Array): Uint8Array {
  let s = 0;
  let e = b.length;
  const ws = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0b || c === 0x0c;
  while (s < e && ws(b[s]!)) s++;
  while (e > s && ws(b[e - 1]!)) e--;
  return b.slice(s, e);
}

function bytesSplit(b: Uint8Array, sep: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  let cur = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === sep) {
      out.push(b.slice(cur, i));
      cur = i + 1;
    }
  }
  out.push(b.slice(cur));
  return out;
}

export class HunposTagger {
  _hunpos_bin = "";
  _hunpos_model = "";
  _encoding: string;
  _hunpos: PyPopen | null = null;
  _closed = true;
  private _reader: PipeLineReader | null = null;

  constructor(
    path_to_model: string,
    options: { path_to_bin?: string | null; encoding?: string; verbose?: boolean } = {},
  ) {
    const encoding = options.encoding ?? _HUNPOS_CHARSET;
    const hunposPaths = [
      "/usr/bin",
      "/usr/local/bin",
      "/opt/local/bin",
      "/Applications/bin",
      "~/bin",
      "~/Applications/bin",
    ].map(expanduser);
    this._hunpos_bin = findBinary("hunpos-tag", {
      path_to_bin: options.path_to_bin ?? null,
      env_vars: ["HUNPOS_TAGGER"],
      searchpath: hunposPaths,
      url: _HUNPOS_URL,
      verbose: options.verbose ?? false,
    });
    this._hunpos_model = findFile(path_to_model, {
      env_vars: ["HUNPOS_TAGGER"],
      verbose: options.verbose ?? false,
    });
    this._encoding = encoding;
    try {
      this._hunpos = new PyPopen([this._hunpos_bin, this._hunpos_model], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (e) {
      throw pySpawnError(this._hunpos_bin, e);
    }
    this._reader = new PipeLineReader(this._hunpos.stdoutStream!);
    this._closed = false;
  }

  async close(): Promise<void> {
    if (!this._closed && this._hunpos) {
      await this._hunpos.communicate();
      this._closed = true;
    }
  }

  async tag(tokens: string[]): Promise<[string, Uint8Array | null][]> {
    const stdin = this._hunpos!.stdin!;
    for (let token of tokens as (string | Uint8Array)[]) {
      if (typeof token === "string") {
        if (token.includes("\n")) {
          throw pyError("AssertionError", "Tokens should not contain newlines");
        }
        token = pyEncode(token, this._encoding);
      }
      const line = new Uint8Array((token as Uint8Array).length + 1);
      line.set(token as Uint8Array);
      line[line.length - 1] = 0x0a;
      stdin.write(line);
    }
    stdin.write(new Uint8Array([0x0a]));
    await Promise.resolve(stdin.flush());

    const taggedTokens: [string, Uint8Array | null][] = [];
    for (const token of tokens) {
      const raw = await this._reader!.readline();
      const tagged = bytesSplit(bytesStrip(raw ?? new Uint8Array(0)), 0x09);
      const tag = tagged.length > 1 ? tagged[1]! : null;
      taggedTokens.push([token as string, tag]);
    }
    await this._reader!.readline(); // consume the final empty line
    return taggedTokens;
  }

  async tagSents(sentences: string[][]): Promise<[string, Uint8Array | null][][]> {
    const out: [string, Uint8Array | null][][] = [];
    for (const sent of sentences) out.push(await this.tag(sent));
    return out;
  }
  tag_sents = this.tagSents;
}

// ---------------------------------------------------------------------------
// nltk.classify.senna + nltk.tag.senna
// ---------------------------------------------------------------------------

function sennaOsName(): string {
  if (process.platform === "linux") return "Linux";
  if (process.platform === "darwin") return "Darwin";
  if (process.platform === "win32") return "Windows";
  return "";
}
function sennaBits(): string {
  return ["x64", "arm64", "ppc64", "s390x", "riscv64"].includes(process.arch) ? "64bit" : "32bit";
}

export class Senna {
  static SUPPORTED_OPERATIONS = ["pos", "chk", "ner"];
  _encoding: string;
  _path: string | null = null;
  operations: string[];

  constructor(senna_path: string | null, operations: string[], encoding = "utf-8") {
    this._encoding = encoding;
    // Python signature accepts None; os.path.isabs(None) raises TypeError.
    const sp = senna_path as string;
    if (pyIsabs(sp)) {
      this._path = pyNormpath(sp) + "/";
    }
    if (this._path === null || !pyIsfile(this.executable(this._path))) {
      const sennaEnv = process.env.SENNA;
      if (sennaEnv && pyIsabs(sennaEnv)) {
        this._path = pyNormpath(sennaEnv) + "/";
      }
    }
    if (this._path === null || !pyIsfile(this.executable(this._path))) {
      throw pyError(
        "LookupError",
        "Senna executable not found. Pass an absolute senna_path to " +
          "Senna(...) or set the SENNA environment variable to the " +
          "absolute directory that contains the senna binary.",
      );
    }
    this.operations = operations;
  }

  executable(basePath: string): string {
    const osName = sennaOsName();
    if (osName === "Linux") {
      return pyJoin(basePath, sennaBits() === "64bit" ? "senna-linux64" : "senna-linux32");
    }
    if (osName === "Windows") return pyJoin(basePath, "senna-win32.exe");
    if (osName === "Darwin") return pyJoin(basePath, "senna-osx");
    return pyJoin(basePath, "senna");
  }

  _map(): Map<string, number> {
    const m = new Map<string, number>();
    let i = 1;
    for (const operation of Senna.SUPPORTED_OPERATIONS) {
      if (this.operations.includes(operation)) {
        m.set(operation, i);
        i += 1;
      }
    }
    return m;
  }

  tag(tokens: string[]): any {
    return this.tagSents([tokens])[0]! as Record<string, string>[];
  }

  // Subclasses narrow the row type (dict -> (word, tag) tuple), mirroring
  // Python's unchecked subclass overrides; kept as `any` for that reason.
  tagSents(sentences: string[][]): any {
    const encoding = this._encoding;
    if (!pyIsfile(this.executable(this._path!))) {
      throw pyError("LookupError", `Senna executable expected at ${this.executable(this._path!)} but not found`);
    }
    const sennaCmd = [
      this.executable(this._path!),
      "-path",
      this._path!,
      "-usrtokens",
      "-iobtags",
      ...this.operations.map((op) => "-" + op),
    ];
    const input = sentences.map((x) => x.join(" ")).join("\n") + "\n";
    const inputBytes = pyEncode(input, encoding);
    let r: SyncResult;
    try {
      r = spawnSyncPy(sennaCmd, { stdin: inputBytes, stdout: "pipe", stderr: "pipe" });
    } catch (e) {
      throw pySpawnError(sennaCmd[0]!, e);
    }
    if (r.exitCode !== 0) {
      throw pyError("RuntimeError", `Senna command failed! Details: ${pyBytesRepr(r.stderr)}`);
    }
    const sennaOutput = pyDecode(r.stdout!, encoding);
    const map = this._map();
    const taggedSentences: Record<string, string>[][] = [[]];
    let sentenceIndex = 0;
    let tokenIndex = 0;
    for (const taggedWord of sennaOutput.trim().split("\n")) {
      if (!taggedWord) {
        taggedSentences.push([]);
        sentenceIndex += 1;
        tokenIndex = 0;
        continue;
      }
      const tags = taggedWord.split("\t");
      const result: Record<string, string> = {};
      for (const tag of map.keys()) {
        result[tag] = tags[map.get(tag)!]!.trim();
      }
      const sent = sentences[sentenceIndex];
      if (sent === undefined || sent[tokenIndex] === undefined) {
        throw pyError(
          "IndexError",
          `Misalignment error occurred at sentence number ${sentenceIndex}. Possible reason` +
            ` is that the sentence size exceeded the maximum size. Check the ` +
            `documentation of Senna class for more information.`,
        );
      }
      result["word"] = sent[tokenIndex]!;
      taggedSentences[taggedSentences.length - 1]!.push(result);
      tokenIndex += 1;
    }
    return taggedSentences;
  }
  tag_sents = this.tagSents as (sentences: string[][]) => any;
}

export class SennaTagger extends Senna {
  constructor(path: string, encoding = "utf-8") {
    super(path, ["pos"], encoding);
  }
  override tag(tokens: string[]): [string, string][] {
    return this.tagSents([tokens])[0]!;
  }
  override tagSents(sentences: string[][]): [string, string][][] {
    const tagged = super.tagSents(sentences) as Record<string, string>[][];
    return tagged.map((sent) => sent.map((a) => [a["word"]!, a["pos"]!] as [string, string]));
  }
  override tag_sents = this.tagSents;
}

export class SennaChunkTagger extends Senna {
  constructor(path: string, encoding = "utf-8") {
    super(path, ["chk"], encoding);
  }
  override tag(tokens: string[]): [string, string][] {
    return this.tagSents([tokens])[0]!;
  }
  override tagSents(sentences: string[][]): [string, string][][] {
    const tagged = super.tagSents(sentences) as Record<string, string>[][];
    return tagged.map((sent) => sent.map((a) => [a["word"]!, a["chk"]!] as [string, string]));
  }
  override tag_sents = this.tagSents;

  *bioToChunks(taggedSent: [string, string][], chunkType: string): Generator<[string, string]> {
    let currentChunk: string[] = [];
    let currentChunkPosition: number[] = [];
    for (let idx = 0; idx < taggedSent.length; idx++) {
      const [word, pos] = taggedSent[idx]!;
      if (pos.includes("-" + chunkType)) {
        currentChunk.push(word);
        currentChunkPosition.push(idx);
      } else {
        if (currentChunk.length) {
          yield [currentChunk.join(" "), currentChunkPosition.join("-")];
          currentChunk = [];
          currentChunkPosition = [];
        }
      }
    }
    if (currentChunk.length) {
      yield [currentChunk.join(" "), currentChunkPosition.join("-")];
    }
  }
  bio_to_chunks = this.bioToChunks;
}

export class SennaNERTagger extends Senna {
  constructor(path: string, encoding = "utf-8") {
    super(path, ["ner"], encoding);
  }
  override tag(tokens: string[]): [string, string][] {
    return this.tagSents([tokens])[0]!;
  }
  override tagSents(sentences: string[][]): [string, string][][] {
    const tagged = super.tagSents(sentences) as Record<string, string>[][];
    return tagged.map((sent) => sent.map((a) => [a["word"]!, a["ner"]!] as [string, string]));
  }
  override tag_sents = this.tagSents;
}

// ---------------------------------------------------------------------------
// nltk.parse.malt
// ---------------------------------------------------------------------------

export function maltRegexTagger(): (sentence: string[]) => [string, string | null][] {
  const tagger = new RegexpTagger([
    ["\\.$", "."],
    ["\\,$", ","],
    ["\\?$", "?"],
    ["\\($", "("],
    ["\\)$", ")"],
    ["\\[$", "["],
    ["\\]$", "]"],
    ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
    ["(The|the|A|a|An|an)$", "DT"],
    ["(He|he|She|she|It|it|I|me|Me|You|you)$", "PRP"],
    ["(His|his|Her|her|Its|its)$", "PRP$"],
    ["(my|Your|your|Yours|yours)$", "PRP$"],
    ["(on|On|in|In|at|At|since|Since)$", "IN"],
    ["(for|For|ago|Ago|before|Before)$", "IN"],
    ["(till|Till|until|Until)$", "IN"],
    ["(by|By|beside|Beside)$", "IN"],
    ["(under|Under|below|Below)$", "IN"],
    ["(over|Over|above|Above)$", "IN"],
    ["(across|Across|through|Through)$", "IN"],
    ["(into|Into|towards|Towards)$", "IN"],
    ["(onto|Onto|from|From)$", "IN"],
    [".*able$", "JJ"],
    [".*ness$", "NN"],
    [".*ly$", "RB"],
    [".*s$", "NNS"],
    [".*ing$", "VBG"],
    [".*ed$", "VBD"],
    [".*", "NN"],
  ]);
  return (sentence: string[]) => tagger.tag(sentence);
}
export const malt_regex_tagger = maltRegexTagger;

/** nltk.parse.malt.find_maltparser. Returns the (unsorted) jar list. */
export function findMaltparser(parserDirname: string): string[] {
  let maltDir: string;
  if (pyIsabs(parserDirname) && pyIsdir(parserDirname)) {
    maltDir = parserDirname;
  } else {
    maltDir = findDir(parserDirname, { env_vars: ["MALT_PARSER"] });
  }
  const maltJars = new Set(findJarsWithinPath(maltDir));
  const jars = new Set([...maltJars].map((j) => pySplit(j)[1]));
  const maltDependencies = new Set(["log4j.jar", "libsvm.jar", "liblinear-1.8.jar"]);
  if (![...maltDependencies].every((d) => jars.has(d))) {
    throw pyError("AssertionError", "");
  }
  if (![...jars].some((i) => i.startsWith("maltparser-") && i.endsWith(".jar"))) {
    throw pyError("AssertionError", "");
  }
  // Python returns list(set(...)) — order is hash-randomized there; the port
  // returns a deterministic sorted order (the oracle sorts malt_jars for the
  // same reason: it is the only stable order both sides can pin).
  return [...maltJars].sort();
}
export const find_maltparser = findMaltparser;

/** nltk.parse.malt.find_malt_model. */
export function findMaltModel(modelFilename: string | null): string {
  if (modelFilename === null || modelFilename === undefined) {
    return "malt_temp.mco";
  } else if (pyExists(modelFilename)) {
    return modelFilename;
  } else {
    return findFile(modelFilename, { env_vars: ["MALT_MODEL"], verbose: false });
  }
}
export const find_malt_model = findMaltModel;

export class MaltParser {
  malt_jars: string[];
  additional_java_args: string[];
  model: string;
  _trained: boolean;
  working_dir: string;
  tagger: (sentence: string[]) => [string, string | null][];

  constructor(options: {
    parser_dirname?: string;
    model_filename?: string | null;
    tagger?: ((sentence: string[]) => [string, string | null][]) | null;
    additional_java_args?: string[] | null;
  } = {}) {
    this.malt_jars = findMaltparser(options.parser_dirname ?? "");
    this.additional_java_args = options.additional_java_args ?? [];
    this.model = findMaltModel(options.model_filename ?? null);
    this._trained = this.model !== "malt_temp.mco";
    this.working_dir = tmpdir();
    this.tagger = options.tagger ?? maltRegexTagger();
  }

  *parseTaggedSents(
    sentences: Iterable<[string, string | null][]>,
    verbose = false,
    topRelationLabel = "null",
  ): Generator<DependencyGraph[]> {
    if (!this._trained) {
      throw pyError("Exception", "Parser has not been trained. Call train() first.");
    }
    let inputFileName: string | null = null;
    let outputFileName: string | null = null;
    try {
      const inputFile = new NamedTempFile("malt_input.conll.", this.working_dir);
      const outputFile = new NamedTempFile("malt_output.conll.", this.working_dir);
      inputFileName = inputFile.name;
      outputFileName = outputFile.name;

      const modelDir = pySplit(this.model)[0];
      let modelCwd: string | null = modelDir ? resolve(modelDir) : null;
      if (modelCwd && !pyIsdir(modelCwd)) modelCwd = null;

      for (const line of taggedsents_to_conll(sentences as Iterable<Iterable<[string, string]>>)) {
        inputFile.write(String(line));
      }
      inputFile.close();
      outputFile.close();

      const cmd = this.generateMaltCommand(inputFileName, outputFileName, "parse");
      const ret = MaltParser._execute(cmd, verbose, modelCwd);
      if (ret !== 0) {
        throw pyError(
          "Exception",
          `MaltParser parsing (${cmd.join(" ")}) failed with exit code ${ret}`,
        );
      }
      const content = readFileSync(outputFileName, "utf8");
      for (const treeStr of content.split("\n\n")) {
        yield [new DependencyGraph(treeStr, { topRelationLabel })];
      }
    } finally {
      for (const filename of [inputFileName, outputFileName]) {
        if (filename) {
          try {
            unlinkSync(filename);
          } catch {
            /* OSError: pass */
          }
        }
      }
    }
  }
  parse_tagged_sents = this.parseTaggedSents;

  parseSents(
    sentences: Iterable<string[]>,
    verbose = false,
    topRelationLabel = "null",
  ): Generator<DependencyGraph[]> {
    const tagger = this.tagger;
    const tagged = mapIter(sentences, (s) => tagger(s));
    return this.parseTaggedSents(tagged, verbose, topRelationLabel);
  }
  parse_sents = this.parseSents;

  generateMaltCommand(inputfilename: string, outputfilename: string | null = null, mode: string | null = null): string[] {
    verifyJarSandbox(this.malt_jars);
    validateJavaOptions(this.additional_java_args);
    const cmd = ["java"];
    cmd.push(...this.additional_java_args);
    cmd.push("-cp", this.malt_jars.join(PATHSEP));
    cmd.push("org.maltparser.Malt");
    if (pyExists(this.model)) {
      cmd.push("-c", pySplit(this.model)[1]);
    } else {
      cmd.push("-c", this.model);
    }
    cmd.push("-i", inputfilename);
    if (mode === "parse") {
      cmd.push("-o", outputfilename!);
    }
    cmd.push("-m", mode!);
    return cmd;
  }
  generate_malt_command = this.generateMaltCommand;

  static _execute(cmd: string[], verbose = false, cwd: string | null = null): number {
    const out = verbose ? "inherit" : "pipe";
    const r = spawnSyncPy(cmd, { stdout: out, stderr: out, cwd });
    return r.signalCode ? killedToReturnCode(r.signalCode)! : r.exitCode;
  }

  train(depgraphs: DependencyGraph[], verbose = false): void {
    const inputFile = new NamedTempFile("malt_train.conll.", this.working_dir);
    const inputStr = depgraphs.map((dg) => dg.to_conll(10)).join("\n");
    inputFile.write(String(inputStr));
    inputFile.close();
    this.trainFromFile(inputFile.name, verbose);
    unlinkSync(inputFile.name);
  }

  trainFromFile(conllFile: string | ZipFilePathPointer, verbose = false): void {
    if (conllFile instanceof ZipFilePathPointer) {
      const inputFile = new NamedTempFile("malt_train.conll.", this.working_dir);
      const conllStr = conllFile.open().read();
      inputFile.write(String(conllStr));
      inputFile.close();
      this.trainFromFile(inputFile.name, verbose);
      return;
    }
    const cmd = this.generateMaltCommand(conllFile as string, null, "learn");
    const ret = MaltParser._execute(cmd, verbose);
    if (ret !== 0) {
      throw pyError(
        "Exception",
        `MaltParser training (${cmd.join(" ")}) failed with exit code ${ret}`,
      );
    }
    this._trained = true;
  }
  train_from_file = this.trainFromFile;
}

// ---------------------------------------------------------------------------
// nltk.parse.bllip
// ---------------------------------------------------------------------------

let _bllipImportErrorMessage = "No module named 'bllipparser'";
export function setBllipImportErrorMessage(msg: string): void {
  _bllipImportErrorMessage = msg;
}

function _ensureBllipImportOrError(): void {
  throw pyError("ImportError", `Couldn't import bllipparser module: ${_bllipImportErrorMessage}`);
}

export function _ensureAscii(words: string[]): void {
  for (let i = 0; i < words.length; i++) {
    if (!isAscii(words[i]!)) {
      throw pyError(
        "ValueError",
        `Token ${i} (${pyStrRepr(words[i]!)}) is non-ASCII. BLLIP Parser ` +
          `currently doesn't support non-ASCII inputs.`,
      );
    }
  }
}
export const _ensure_ascii = _ensureAscii;

export class BllipParser {
  /** undefined unless a (nonexistent) bllipparser backend bound it. */
  rrp: unknown = undefined;

  constructor(
    _parser_model: string | null = null,
    _reranker_features: string | null = null,
    _reranker_weights: string | null = null,
    _parser_options: Record<string, string> | null = null,
    _reranker_options: Record<string, string> | null = null,
  ) {
    _ensureBllipImportOrError();
  }

  static fromUnifiedModelDir(
    _model_dir: string,
    _parser_options: Record<string, string> | null = null,
    _reranker_options: Record<string, string> | null = null,
  ): BllipParser {
    throw pyError("NameError", "name 'get_unified_model_parameters' is not defined");
  }
  static from_unified_model_dir(
    model_dir: string,
    parser_options: Record<string, string> | null = null,
    reranker_options: Record<string, string> | null = null,
  ): BllipParser {
    return BllipParser.fromUnifiedModelDir(model_dir, parser_options, reranker_options);
  }

  *parse(sentence: string[]): Generator<SimpleTree> {
    _ensureAscii(sentence);
    if (this.rrp === undefined) {
      throw pyError("AttributeError", "'BllipParser' object has no attribute 'rrp'");
    }
    yield* [] as SimpleTree[];
  }

  *taggedParse(wordAndTagPairs: [string, string | null][]): Generator<SimpleTree> {
    const words: string[] = [];
    const tagMap = new Map<number, string>();
    for (let i = 0; i < wordAndTagPairs.length; i++) {
      const [word, tag] = wordAndTagPairs[i]!;
      words.push(word);
      if (tag !== null) tagMap.set(i, tag);
    }
    _ensureAscii(words);
    if (this.rrp === undefined) {
      throw pyError("AttributeError", "'BllipParser' object has no attribute 'rrp'");
    }
    yield* [] as SimpleTree[];
  }
  tagged_parse = this.taggedParse;
}

// ---------------------------------------------------------------------------
// nltk.sem.boxer.Boxer (subprocess half; DRS classes come from sem_boxer.ts)
// ---------------------------------------------------------------------------

const _BOXER_URL = "http://svn.ask.it.usyd.edu.au/trac/candc/";

export class Boxer {
  _boxer_drs_interpreter: BoxerDrsInterpreter;
  _resolve: boolean;
  _elimeq: boolean;
  _candc_bin = "";
  _candc_models_path = "";
  _boxer_bin = "";

  constructor(options: {
    boxer_drs_interpreter?: BoxerDrsInterpreter | null;
    elimeq?: boolean;
    bin_dir?: string | null;
    verbose?: boolean;
    resolve?: boolean;
  } = {}) {
    this._boxer_drs_interpreter = options.boxer_drs_interpreter ?? new NltkDrtBoxerDrsInterpreter();
    this._resolve = options.resolve ?? true;
    this._elimeq = options.elimeq ?? false;
    this.setBinDir(options.bin_dir ?? null, options.verbose ?? false);
  }

  setBinDir(binDir: string | null, verbose = false): void {
    this._candc_bin = this._findBinary("candc", binDir, verbose);
    this._candc_models_path = pyNormpath(pyJoin(this._candc_bin.slice(0, -5), "../models"));
    this._boxer_bin = this._findBinary("boxer", binDir, verbose);
  }
  set_bin_dir = this.setBinDir;

  interpret(input: string, discourseId: string | null = null, question = false, verbose = false): unknown {
    const discourseIds = discourseId !== null ? [discourseId] : null;
    const d = this.interpretMultiSents([[input]], discourseIds, question, verbose)[0];
    if (!d) throw pyError("Exception", `Unable to interpret: "${input}"`);
    return d;
  }

  interpretMulti(input: string[], discourseId: string | null = null, question = false, verbose = false): unknown {
    const discourseIds = discourseId !== null ? [discourseId] : null;
    const d = this.interpretMultiSents([input], discourseIds, question, verbose)[0];
    if (!d) throw pyError("Exception", `Unable to interpret: "${input}"`);
    return d;
  }
  interpret_multi = this.interpretMulti;

  interpretSents(inputs: string[], discourseIds: string[] | null = null, question = false, verbose = false): unknown[] {
    return this.interpretMultiSents(inputs.map((i) => [i]), discourseIds, question, verbose);
  }
  interpret_sents = this.interpretSents;

  interpretMultiSents(inputs: string[][], discourseIds: string[] | null = null, question = false, verbose = false): unknown[] {
    let useDiscId: boolean;
    let ids: string[];
    if (discourseIds !== null) {
      if (inputs.length !== discourseIds.length) throw pyError("AssertionError", "");
      if (!discourseIds.every((id) => id !== null)) throw pyError("AssertionError", "");
      useDiscId = true;
      ids = discourseIds;
    } else {
      ids = inputs.map((_, i) => String(i));
      useDiscId = false;
    }
    const candcOut = this._callCandc(inputs, ids, question, verbose);
    const boxerOut = this._callBoxer(candcOut, verbose);
    const drsDict = parseToDrsDict(boxerOut, useDiscId, this._boxer_drs_interpreter);
    return ids.map((id) => drsDict.get(id) ?? null);
  }
  interpret_multi_sents = this.interpretMultiSents;

  _callCandc(inputs: string[][], discourseIds: string[], question: boolean, verbose = false): Uint8Array {
    const args = [
      "--models",
      pyJoin(this._candc_models_path, question ? "questions" : "boxer"),
      "--candc-printer",
      "boxer",
    ];
    const lines: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      lines.push(`<META>'${discourseIds[i]}'`);
      lines.push(...inputs[i]!);
    }
    return this._call(lines.join("\n"), this._candc_bin, args, verbose);
  }
  _call_candc = this._callCandc;

  _callBoxer(candcOut: Uint8Array, verbose = false): Uint8Array {
    const { fd, path: tempFilename } = mkstemp("boxer-", ".in");
    try {
      // Python: f.write(candc_out.decode("utf-8")) — a str candc_out raises
      // AttributeError ('str' object has no attribute 'decode'), verbatim.
      writeFileSync(tempFilename, pyDecode(candcOut, "utf-8"), "utf8");
    } finally {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
    }
    const args = [
      "--box", "false",
      "--semantics", "drs",
      "--resolve", this._resolve ? "true" : "false",
      "--elimeq", this._elimeq ? "true" : "false",
      "--format", "prolog",
      "--instantiate", "true",
      "--input", tempFilename,
    ];
    const stdout = this._call(null, this._boxer_bin, args, verbose);
    unlinkSync(tempFilename);
    return stdout;
  }
  _call_boxer = this._callBoxer;

  _findBinary(name: string, binDir: string | null, verbose = false): string {
    for (const binary of findBinaryIter(name, {
      path_to_bin: binDir,
      env_vars: ["CANDC"],
      url: _BOXER_URL,
      binary_names: [name, name + ".exe"],
      verbose,
    })) {
      if (pyIsabs(binary)) return binary;
    }
    throw pyError(
      "LookupError",
      `No absolute ${pyStrRepr(name)} binary found. Pass an absolute bin_dir to Boxer(...) ` +
        `or set the CANDC environment variable to an absolute directory that ` +
        `contains the candc/boxer binaries (a binary found relative to the ` +
        `current working directory is refused).`,
    );
  }

  _call(inputStr: string | null, binary: string, args: string[] = [], verbose = false): Uint8Array {
    if (verbose) {
      console.log("Calling:", binary);
      console.log("Args:", pyListRepr(args));
      console.log("Input:", inputStr);
      console.log("Command:", binary + " " + args.join(" "));
    }
    const cmd = [binary, ...args];
    let r: SyncResult;
    try {
      if (inputStr === null) {
        r = spawnSyncPy(cmd, { stdout: "pipe", stderr: "pipe" });
      } else {
        r = spawnSyncPy(cmd, { stdin: UTF8.encode(inputStr), stdout: "pipe", stderr: "pipe" });
      }
    } catch (e) {
      throw pySpawnError(binary, e);
    }
    const returncode = r.signalCode ? killedToReturnCode(r.signalCode)! : r.exitCode;
    if (verbose) {
      console.log("Return code:", returncode);
      if (r.stdout && r.stdout.length) console.log("stdout:\n", pyBytesRepr(r.stdout), "\n");
      if (r.stderr && r.stderr.length) console.log("stderr:\n", pyBytesRepr(r.stderr), "\n");
    }
    if (returncode !== 0) {
      throw pyError(
        "Exception",
        `ERROR CALLING: ${binary} ${args.join(" ")}\nReturncode: ${returncode}\n${pyBytesRepr(r.stderr)}`,
      );
    }
    return r.stdout!;
  }
}

// ---------------------------------------------------------------------------
// nltk.parse.dependencygraph.dot2img
// ---------------------------------------------------------------------------

export function dot2img(dotString: string, t = "svg"): string | Uint8Array | null {
  let dotBinary: string;
  try {
    dotBinary = findBinary("dot");
  } catch (e) {
    if (e instanceof Error && e.name === "LookupError") {
      throw pyError("Exception", "Cannot find the dot binary from Graphviz package");
    }
    throw e;
  }
  try {
    if (["dot", "dot_json", "json", "svg"].includes(t)) {
      const r = spawnSyncPy([dotBinary, `-T${t}`], {
        stdin: UTF8.encode(dotString),
        stdout: "pipe",
        stderr: "pipe",
      });
      return UTF8D.decode(r.stdout!);
    }
    const r = spawnSyncPy([dotBinary, `-T${t}`], {
      stdin: UTF8.encode(dotString),
      stdout: "inherit",
      stderr: "inherit",
    });
    void r;
    return null;
  } catch {
    throw pyError(
      "Exception",
      `Cannot create image representation by running dot from string: ${dotString}`,
    );
  }
}

// ---------------------------------------------------------------------------
// nltk.classify.megam / tadm subprocess helpers
// ---------------------------------------------------------------------------

export const _megamState = { bin: null as string | null };
export const _tadmState = { bin: null as string | null };

export function configMegam(bin: string | null = null): void {
  _megamState.bin = findBinary("megam", {
    path_to_bin: bin,
    env_vars: ["MEGAM"],
    binary_names: ["megam.opt", "megam", "megam_686", "megam_i686.opt"],
    url: "http://hal3.name/megam/",
  });
}
export const config_megam = configMegam;

export function callMegam(args: string[] | string): string {
  if (typeof args === "string") {
    throw pyError("TypeError", "args should be a list of strings");
  }
  if (_megamState.bin === null) configMegam();
  const cmd = [_megamState.bin!, ...args];
  const r = spawnSyncPy(cmd, { stdout: "pipe", stderr: "inherit" });
  const returncode = r.signalCode ? killedToReturnCode(r.signalCode)! : r.exitCode;
  if (returncode !== 0) {
    console.log();
    console.log("None"); // stderr is None (not piped) -> Python prints 'None'
    throw pyError("OSError", "megam command failed!");
  }
  return UTF8D.decode(r.stdout!);
}
export const call_megam = callMegam;

export function configTadm(bin: string | null = null): void {
  _tadmState.bin = findBinary("tadm", {
    path_to_bin: bin,
    env_vars: ["TADM"],
    binary_names: ["tadm"],
    url: "http://tadm.sf.net",
  });
}
export const config_tadm = configTadm;

export function callTadm(args: string[] | string): void {
  if (typeof args === "string") {
    throw pyError("TypeError", "args should be a list of strings");
  }
  if (_tadmState.bin === null) configTadm();
  const cmd = [_tadmState.bin!, ...args];
  const r = spawnSyncPy(cmd, { stdout: "inherit", stderr: "inherit" });
  const returncode = r.signalCode ? killedToReturnCode(r.signalCode)! : r.exitCode;
  if (returncode !== 0) {
    console.log();
    console.log("None");
    throw pyError("OSError", "tadm command failed!");
  }
}
export const call_tadm = callTadm;

const LOG2E = Math.LOG2E; // numpy.log2(numpy.e)

export interface MegamTrainOptions {
  trace?: number;
  encoding?: BinaryMaxentFeatureEncoding | null;
  labels?: string[] | null;
  gaussian_prior_sigma?: number;
  explicit?: boolean;
  bernoulli?: boolean;
  count_cutoff?: number;
  max_iter?: number;
  ll_delta?: number;
}

/** nltk.classify.maxent.train_maxent_classifier_with_megam. */
export function trainMaxentClassifierWithMegam(
  trainToks: MaxentEncodingExample[],
  options: MegamTrainOptions = {},
): ConditionalExponentialClassifier {
  const trace = options.trace ?? 3;
  let explicit = true;
  let bernoulli = true;
  if (options.explicit !== undefined) explicit = options.explicit;
  if (options.bernoulli !== undefined) bernoulli = options.bernoulli;

  let encoding = options.encoding ?? null;
  if (encoding === null) {
    const countCutoff = options.count_cutoff ?? 0;
    encoding = BinaryMaxentFeatureEncoding.train(trainToks, countCutoff, options.labels ?? null, {
      alwayson_features: true,
    });
  } else if (options.labels !== null && options.labels !== undefined) {
    throw pyError("ValueError", "Specify encoding or labels, not both");
  }

  let trainfileName: string;
  {
    const { fd, path } = mkstemp("nltk-");
    trainfileName = path;
    try {
      const chunks: string[] = [];
      const stream = { write: (s: string) => chunks.push(s) };
      write_megam_file(trainToks, encoding, stream, bernoulli, explicit);
      writeFileSync(trainfileName, chunks.join(""), "utf8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw pyError("ValueError", `Error while creating megam training file: ${msg}`);
    } finally {
      try {
        closeSync(fd);
      } catch {
        /* closed */
      }
    }
  }

  const opts: string[] = [];
  opts.push("-nobias", "-repeat", "10");
  if (explicit) opts.push("-explicit");
  if (!bernoulli) opts.push("-fvals");
  const invVariance = options.gaussian_prior_sigma ? 1.0 / options.gaussian_prior_sigma ** 2 : 0;
  opts.push("-lambda", invVariance.toFixed(2), "-tune");
  if (trace < 3) opts.push("-quiet");
  if (options.max_iter !== undefined) opts.push("-maxi", `${options.max_iter}`);
  if (options.ll_delta !== undefined) opts.push("-dpp", `${Math.abs(options.ll_delta)}`);
  if (typeof (encoding as unknown as { cost?: unknown }).cost === "function") opts.push("-multilabel");
  opts.push("multiclass", trainfileName);
  const stdout = callMegam(opts);

  try {
    unlinkSync(trainfileName);
  } catch (e) {
    console.log(`Warning: unable to delete ${trainfileName}: ${e}`);
  }

  const weights = parse_megam_weights(stdout, encoding.length(), explicit);
  for (let i = 0; i < weights.length; i++) weights[i] = weights[i]! * LOG2E;
  return new ConditionalExponentialClassifier(encoding, weights);
}
export const train_maxent_classifier_with_megam = trainMaxentClassifierWithMegam;
// Late-bind so maxent_nltk's train(algorithm="megam") dispatches here without a
// module import cycle (this module already imports ConditionalExponentialClassifier).
_externalMaxentTrainers.megam = trainMaxentClassifierWithMegam as unknown as (t: unknown, o: Record<string, unknown>) => unknown;

/** nltk.classify.maxent.TadmMaxentClassifier — ConditionalExponentialClassifier subclass. */
export class TadmMaxentClassifier extends ConditionalExponentialClassifier {
  static override train(trainToks: MaxentEncodingExample[], options: {
    algorithm?: string;
    trace?: number;
    encoding?: TadmEventMaxentFeatureEncoding | null;
    labels?: string[] | null;
    gaussian_prior_sigma?: number;
    count_cutoff?: number;
    max_iter?: number | null;
    min_lldelta?: number | null;
  } = {}): TadmMaxentClassifier {
    const algorithm = options.algorithm ?? "tao_lmvm";
    const trace = options.trace ?? 3;
    const sigma = options.gaussian_prior_sigma ?? 0;
    const countCutoff = options.count_cutoff ?? 0;
    const maxIter = options.max_iter ?? null;
    const llDelta = options.min_lldelta ?? null;

    let encoding = options.encoding ?? null;
    if (!encoding) {
      encoding = TadmEventMaxentFeatureEncoding.train(trainToks, countCutoff, options.labels ?? null);
    }

    const { fd: trainFd, path: trainfileName } = mkstemp("nltk-tadm-events-", ".gz");
    const { fd: weightFd, path: weightfileName } = mkstemp("nltk-tadm-weights-");
    try {
      closeSync(trainFd);
      closeSync(weightFd);
    } catch {
      /* closed */
    }

    {
      const chunks: string[] = [];
      const stream = { write: (s: string) => chunks.push(s) };
      write_tadm_file(trainToks, encoding, stream);
      writeFileSync(trainfileName, gzipSync(Buffer.from(chunks.join(""), "utf8")));
    }

    const opts: string[] = [];
    opts.push("-monitor");
    opts.push("-method", algorithm);
    if (sigma) opts.push("-l2", (sigma ** 2).toFixed(6));
    if (maxIter) opts.push("-max_it", `${maxIter}`);
    if (llDelta) opts.push("-fatol", Math.abs(llDelta).toFixed(6));
    opts.push("-events_in", trainfileName);
    opts.push("-params_out", weightfileName);
    if (trace < 3) opts.push("2>&1");
    else opts.push("-summary");

    callTadm(opts);

    const weightsText = readFileSync(weightfileName, "utf8");
    const weights = parse_tadm_weights(weightsText.split("\n"));

    unlinkSync(trainfileName);
    unlinkSync(weightfileName);

    for (let i = 0; i < weights.length; i++) weights[i] = weights[i]! * LOG2E;
    return new TadmMaxentClassifier(encoding as never, weights);
  }
}

// Note: parse_megam_weights/write_*/parse_tadm_weights, parseToDrsDict and
// taggedsents_to_conll keep their canonical homes (maxent_nltk/sem_boxer/
// parse_conll) — no duplicate re-exports here so export provenance stays
// unambiguous for the compatibility scanner.
