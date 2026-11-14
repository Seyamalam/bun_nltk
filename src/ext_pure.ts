/**
 * Pure (no external binary/corpus/network) helpers for the NLTK 3.10.3
 * 'unsupported' compatibility batch:
 *
 *   - Python repr()/str()/pprint()-compatible formatting (incl. defaultdict)
 *   - C-style printf formatting used by parser demos (%11.4f etc.)
 *   - MT19937 + Python Random port (shuffle/randrange/sample) for seeded demos
 *   - numpy ndarray str()/repr() formatting (dragon4 float formatting)
 *   - nltk.internals.find_jar_iter/find_jar/find_jars_within_path
 *   - nltk.parse.corenlp.try_port / find_jar_iter
 *   - nltk.parse.malt.{malt_regex_tagger,find_maltparser,find_malt_model,
 *     find_jars_within_path,ZipFilePathPointer}
 *   - nltk.tag.stanford.find_jar
 *   - nltk.twitter.api.{TweetHandlerI,BasicTweetHandler,
 *     LocalTimezoneOffsetWithUTC,LOCAL}
 *   - nltk.twitter.common.outf_writer_compat
 *   - nltk.chat chatbot function dictionary
 *   - nltk.parse.dependencygraph demo data (conll_data1/2, treebank_data) and
 *     pprint-based DependencyGraph rendering
 *
 * Everything here is pure TypeScript (fs/env/socket allowed); no stdin reads,
 * no Java, no network calls that leave the local machine.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { gunzipSync, gzipSync } from "node:zlib";
import { openSync, closeSync, writeSync } from "node:fs";
import { pyError } from "./internals";
import { pyBasename, pyJoin, pyNormpath, pySplit } from "./ext_subprocess";
import { ZipFilePathPointer } from "./data";

// ---------------------------------------------------------------------------
// Python object model used by repr()/pformat()
// ---------------------------------------------------------------------------

/** Tagged Python float (so repr keeps the '.0'/sci notation an int would not). */
export class PyFloat {
  readonly __pyfloat = true;
  constructor(public readonly v: number) {}
  valueOf(): number { return this.v; }
}
export const pyfloat = (v: number): PyFloat => new PyFloat(v);

/** Tagged Python tuple. */
export class PyTuple<T = unknown> extends Array<T> {
  readonly __pytuple = true;
}
export const pytuple = <T>(...items: T[]): PyTuple<T> => {
  const t = new PyTuple<T>();
  t.push(...items);
  return t;
};

/** Tagged Python set. */
export class PySet<T = unknown> extends Set<T> {
  readonly __pyset = true;
}
export const pyset = <T>(items?: Iterable<T>): PySet<T> => new PySet<T>(items);

/** Ordered Python dict. */
export class PyDict<K = unknown, V = unknown> extends Map<K, V> {
  readonly __pydict = true;
}
export const pydict = <K, V>(entries?: Iterable<[K, V]>): PyDict<K, V> =>
  new PyDict<K, V>(entries);

/** Python collections.defaultdict. factoryRepr is the repr of default_factory. */
export class PyDefaultDict<K = unknown, V = unknown> extends PyDict<K, V> {
  readonly __pydefaultdict = true;
  constructor(public readonly factoryRepr: string, entries?: Iterable<[K, V]>) {
    super(entries);
  }
}
export const pydefaultdict = <K, V>(factoryRepr: string, entries?: Iterable<[K, V]>) =>
  new PyDefaultDict<K, V>(factoryRepr, entries);

// ---------------------------------------------------------------------------
// Python repr()/str() for scalars and containers
// ---------------------------------------------------------------------------

/** Python repr() of a float: shortest round-trip, sci notation exp>=16|<=-5. */
export function pyFloatRepr(v: number): string {
  if (Number.isNaN(v)) return "nan";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  if (Object.is(v, -0)) return "-0.0";
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return `${v}.0`;
  // Shortest round-trip digits via toPrecision(17) trimming.
  let s = `${v}`;
  let mantissa = s, exp = 0;
  const ei = s.indexOf("e");
  if (ei >= 0) {
    mantissa = s.slice(0, ei);
    exp = parseInt(s.slice(ei + 1), 10);
  } else {
    const dot = s.indexOf(".");
    if (dot < 0) {
      // Large integer-valued float (>= 1e16): Python switches to sci notation.
      const digits = s.replace("-", "");
      if (digits.length >= 17) {
        mantissa = digits;
        exp = digits.length - 1;
      } else return `${s}.0`;
    } else {
      const ip = s.slice(0, dot), fp = s.slice(dot + 1);
      if (/^0*$/.test(ip)) {
        const lead = fp.match(/^0*/)![0].length;
        if (lead + 1 >= 5) {
          mantissa = fp.slice(lead);
          exp = -(lead + 1);
        } else return s;
      } else return s;
    }
  }
  mantissa = mantissa.replace(".", "").replace(/0+$/, "");
  if (mantissa === "" || mantissa === "-") mantissa = "0";
  const neg = mantissa.startsWith("-");
  const m = neg ? mantissa.slice(1) : mantissa;
  const digits = m.length > 1 ? `${m[0]}.${m.slice(1)}` : m;
  const esign = exp < 0 ? "-" : "+";
  const eabs = `${Math.abs(exp)}`.padStart(2, "0");
  return `${neg ? "-" : ""}${digits}e${esign}${eabs}`;
}

/** Python repr() of a string: single quotes unless it contains one. */
export function pyStrRepr(s: string): string {
  let out = "";
  let quote = "'";
  if (s.includes("'") && !s.includes('"')) quote = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === quote || ch === "\\") out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 32 || code === 127) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${quote}${out}${quote}`;
}

const isPyFloat = (v: unknown): v is PyFloat => v instanceof PyFloat;

/** Python repr() over scalars + tagged containers (dict keys sorted, pprint-style). */
export function pyRepr(v: unknown, sortedKeys = true): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (isPyFloat(v)) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? `${v}` : pyFloatRepr(v);
  if (typeof v === "string") return pyStrRepr(v);
  if (v instanceof PyDefaultDict) {
    return `defaultdict(${v.factoryRepr}, ${dictRepr(v, sortedKeys)})`;
  }
  if (v instanceof PyDict || v instanceof Map) {
    return dictRepr(v as Map<unknown, unknown>, sortedKeys);
  }
  if (v instanceof PySet || v instanceof Set) {
    const items = [...(v as Set<unknown>)];
    if (!items.length) return "set()";
    const reps = items.map((x) => pyRepr(x, sortedKeys));
    if (sortedKeys) reps.sort();
    return `{${reps.join(", ")}}`;
  }
  if (v instanceof PyTuple) {
    const items = (v as PyTuple).map((x) => pyRepr(x, sortedKeys));
    return items.length === 1 ? `(${items[0]},)` : `(${items.join(", ")})`;
  }
  if (Array.isArray(v)) return `[${v.map((x) => pyRepr(x, sortedKeys)).join(", ")}]`;
  if (typeof v === "object") {
    const anyv = v as { repr?: () => string; toString?: () => string };
    if (typeof anyv.repr === "function") return anyv.repr();
    return anyv.toString ? anyv.toString() : String(v);
  }
  return String(v);
}

function dictRepr(d: Map<unknown, unknown>, sortedKeys: boolean): string {
  if (d.size === 0) return "{}";
  let entries = [...d.entries()];
  if (sortedKeys) {
    entries = entries.sort(([a], [b]) => pyKeyCmp(a, b));
  }
  return `{${entries.map(([k, v]) => `${pyRepr(k, sortedKeys)}: ${pyRepr(v, sortedKeys)}`).join(", ")}}`;
}

/** Python key ordering for the pprint demos (ints, then strings, tuples). */
export function pyKeyCmp(a: unknown, b: unknown): number {
  const rank = (x: unknown): number =>
    typeof x === "number" ? 0 : typeof x === "string" ? 1 : x instanceof PyTuple ? 2 : 3;
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (a instanceof PyTuple && b instanceof PyTuple) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = pyKeyCmp(a[i], b[i]);
      if (c !== 0) return c;
    }
    return a.length - b.length;
  }
  return String(pyRepr(a)).localeCompare(pyRepr(b));
}

/** Python str() — identical to repr except strings are unquoted. */
export function pyStr(v: unknown): string {
  if (typeof v === "string") return v;
  return pyRepr(v);
}

/** Python print(*args, sep=' ', end='\n') routed into an output sink. */
export type PrintSink = (text: string) => void;
export function pyPrint(out: PrintSink, ...args: unknown[]): void {
  let end = "\n";
  if (args.length && typeof args[args.length - 1] === "object" && args[args.length - 1] !== null && "__end__" in (args[args.length - 1] as object)) {
    end = (args.pop() as { __end__: string }).__end__;
  }
  out(args.map((a) => pyStr(a)).join(" ") + end);
}
/** Pass as the last arg of pyPrint to override the trailing newline. */
export const pyEnd = (end: string): { __end__: string } => ({ __end__: end });

// ---------------------------------------------------------------------------
// pprint.pformat port (subset: dict/defaultdict/list/tuple/set/str/scalars)
// ---------------------------------------------------------------------------

/** Format like pprint.pformat(obj, indent=1, width=80). */
export function pformat(obj: unknown, options: { indent?: number; width?: number; sortDicts?: boolean } = {}): string {
  const pp = new PyPrettyPrinter(options.indent ?? 1, options.width ?? 80, options.sortDicts ?? true);
  return pp.pformat(obj);
}

class PyPrettyPrinter {
  private readonly indentPerLevel: number;
  private readonly width: number;
  private readonly sortDicts: boolean;
  constructor(indentPerLevel: number, width: number, sortDicts: boolean) {
    this.indentPerLevel = indentPerLevel;
    this.width = width;
    this.sortDicts = sortDicts;
  }

  pformat(obj: unknown): string {
    const parts: string[] = [];
    this.format(obj, parts, 0, 0, 1);
    return parts.join("");
  }

  private reprOf(v: unknown): string {
    return pyRepr(v, this.sortDicts);
  }

  /** PrettyPrinter._format */
  private format(obj: unknown, out: string[], indent: number, allowance: number, level: number): void {
    const rep = this.reprOf(obj);
    const maxWidth = this.width - indent - allowance;
    if (rep.length > maxWidth) {
      if (obj instanceof PyDefaultDict) return this.pprintDefaultDict(obj, out, indent, allowance, level);
      if (obj instanceof PyDict || obj instanceof Map) return this.pprintDict(obj as Map<unknown, unknown>, out, indent, allowance, level);
      if (obj instanceof PyTuple) return this.pprintTuple(obj, out, indent, allowance, level);
      if (obj instanceof PySet || obj instanceof Set) return this.pprintSet(obj as Set<unknown>, out, indent, allowance, level);
      if (Array.isArray(obj)) return this.pprintList(obj, out, indent, allowance, level);
    }
    out.push(rep);
  }

  private pprintDict(d: Map<unknown, unknown>, out: string[], indent: number, allowance: number, level: number): void {
    out.push("{");
    if (this.indentPerLevel > 1) out.push(" ".repeat(this.indentPerLevel - 1));
    if (d.size) {
      let items = [...d.entries()];
      if (this.sortDicts) items = items.sort(([a], [b]) => pyKeyCmp(a, b));
      this.formatDictItems(items, out, indent, allowance + 1, level);
    }
    out.push("}");
  }

  private pprintDefaultDict(d: PyDefaultDict, out: string[], indent: number, allowance: number, level: number): void {
    if (!d.size) { out.push(this.reprOf(d)); return; }
    const ind = indent + "defaultdict".length + 1;
    out.push(`defaultdict(${d.factoryRepr},\n${" ".repeat(ind)}`);
    this.pprintDict(d, out, ind, allowance + 1, level);
    out.push(")");
  }

  private pprintList(items: unknown[], out: string[], indent: number, allowance: number, level: number): void {
    out.push("[");
    this.formatItems(items, out, indent, allowance + 1, level);
    out.push("]");
  }

  private pprintTuple(t: PyTuple, out: string[], indent: number, allowance: number, level: number): void {
    out.push("(");
    const endchar = t.length === 1 ? ",)" : ")";
    this.formatItems([...t], out, indent, allowance + endchar.length, level);
    out.push(endchar);
  }

  private pprintSet(s: Set<unknown>, out: string[], indent: number, allowance: number, level: number): void {
    if (!s.size) { out.push("set()"); return; }
    out.push("{");
    const items = [...s].sort(pyKeyCmp);
    this.formatItems(items, out, indent, allowance + 1, level);
    out.push("}");
  }

  private formatDictItems(items: [unknown, unknown][], out: string[], indent: number, allowance: number, level: number): void {
    const ind = indent + this.indentPerLevel;
    const delimnl = `,\n${" ".repeat(ind)}`;
    items.forEach(([key, ent], i) => {
      const last = i === items.length - 1;
      const rep = this.reprOf(key);
      out.push(rep, ": ");
      this.format(ent, out, ind + rep.length + 2, last ? allowance : 1, level + 1);
      if (!last) out.push(delimnl);
    });
  }

  private formatItems(items: unknown[], out: string[], indent: number, allowance: number, level: number): void {
    const ind = indent + this.indentPerLevel;
    if (this.indentPerLevel > 1) out.push(" ".repeat(this.indentPerLevel - 1));
    const delimnl = `,\n${" ".repeat(ind)}`;
    let delim = "";
    items.forEach((ent, i) => {
      const last = i === items.length - 1;
      out.push(delim);
      delim = delimnl;
      this.format(ent, out, ind, last ? allowance : 1, level + 1);
    });
  }
}

// ---------------------------------------------------------------------------
// textwrap.fill port (subsequent_indent=' ' as used by find_jar)
// ---------------------------------------------------------------------------

export function textwrapFill(
  text: string,
  width: number,
  initialIndent = "",
  subsequentIndent = "",
): string {
  // Mirrors textwrap.fill defaults: break_long_words=True, single space
  // separator, subsequent lines get subsequent_indent.
  const words = text.split(" ").filter((w) => w !== "");
  const lines: string[] = [];
  let cur = "";
  let curIsFirst = true;
  for (const w of words) {
    const indent = curIsFirst ? initialIndent : subsequentIndent;
    if (cur === "") cur = indent + w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else { lines.push(cur); cur = subsequentIndent + w; curIsFirst = false; }
  }
  if (cur !== "") lines.push(cur);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// printf-style formatting (subset used by the parse demos)
// ---------------------------------------------------------------------------

export function sprintf(fmt: string, ...args: unknown[]): string {
  let i = 0;
  return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([dfsr%])/g, (_m, flags: string, w: string | undefined, p: string | undefined, conv: string) => {
    if (conv === "%") return "%";
    const width = w !== undefined ? parseInt(w, 10) : 0;
    const prec = p !== undefined ? parseInt(p, 10) : undefined;
    let arg = args[i++];
    let s = "";
    if (conv === "d") {
      s = `${Math.trunc(Number(arg))}`;
      if (flags?.includes("0")) s = s.padStart(width, "0");
      else s = s.padStart(width, " ");
    } else if (conv === "f") {
      const n = Number(arg);
      s = prec === undefined ? pyFloatRepr(n) : n.toFixed(prec);
      if (flags?.includes("+") && !s.startsWith("-")) s = `+${s}`;
      if (flags?.includes("0")) s = s.startsWith("-") ? `-${s.slice(1).padStart(width - 1, "0")}` : s.padStart(width, "0");
      else s = s.padStart(width, " ");
    } else if (conv === "s") {
      arg = args[i - 1];
      s = prec !== undefined ? pyStr(arg).slice(0, prec) : pyStr(arg);
      s = flags?.includes("-") ? s.padEnd(width, " ") : s.padStart(width, " ");
    } else if (conv === "r") {
      s = pyRepr(arg);
      s = s.padStart(width, " ");
    }
    return s;
  });
}

// ---------------------------------------------------------------------------
// MT19937 + Python Random (seed/shuffle/randrange/sample/random)
// ---------------------------------------------------------------------------

export class MT19937 {
  private mt = new Uint32Array(624);
  private idx = 624;
  seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      this.mt[i] = (Math.imul(1812433253, this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30)) + i) >>> 0;
    }
    this.idx = 624;
  }
  /** Python's init_by_array seeding (what random.seed(int) calls). */
  seedByArray(keys: number[]): void {
    this.seed(19650218);
    let i = 1, j = 0;
    const k = Math.max(624, keys.length);
    for (let n = 0; n < k; n++) {
      this.mt[i] = ((this.mt[i]! ^ Math.imul(this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30), 1664525)) + (keys[j]! >>> 0) + j) >>> 0;
      i++; j++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
      if (j >= keys.length) j = 0;
    }
    for (let n = 0; n < 623; n++) {
      this.mt[i] = ((this.mt[i]! ^ Math.imul(this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30), 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
    }
    this.mt[0] = 0x80000000;
    this.idx = 624;
  }
  private twist(): void {
    const m = this.mt;
    for (let i = 0; i < 624; i++) {
      const y = (m[i]! & 0x80000000) | (m[(i + 1) % 624]! & 0x7fffffff);
      m[i] = m[(i + 397) % 624]! ^ (y >>> 1);
      if (y & 1) m[i] = m[i]! ^ 0x9908b0df;
    }
    this.idx = 0;
  }
  uint32(): number {
    if (this.idx >= 624) this.twist();
    let y = this.mt[this.idx++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }
}

/** Port of Python's random.Random (integer seeds + shuffle/randrange/sample). */
export class PyRandom {
  private mt = new MT19937();
  constructor(seed?: number) { if (seed !== undefined) this.seed(seed); }
  seed(a: number): void {
    if (!Number.isInteger(a)) throw pyError("TypeError", "seed expects int");
    // CPython: int seed -> init_by_array over 32-bit little-endian words.
    const keys: number[] = [];
    let v = a >>> 0;
    keys.push(v);
    // For large ints Python splits the whole bignum; demos only use small.
    this.mt.seedByArray(keys);
  }
  getrandbits(k: number): bigint {
    // CPython: words are drawn little-endian; each word contributes its
    // HIGH `bits` bits (genrand_int32 >> (32 - bits)).
    const words = Math.ceil(k / 32);
    let result = 0n;
    for (let i = 0; i < words; i++) {
      const bits = Math.min(32, k - i * 32);
      const w = BigInt(this.mt.uint32()) >> BigInt(32 - bits);
      result |= w << BigInt(i * 32);
    }
    return result;
  }
  randbelow(n: number): number {
    const k = Math.max(1, n.toString(2).length); // bit_length
    let r = Number(this.getrandbits(k));
    while (r >= n) r = Number(this.getrandbits(k));
    return r;
  }
  random(): number {
    // CPython: (a >> 5) * 2**26 + (b >> 6), all over 2**53.
    const a = this.mt.uint32() >>> 5, b = this.mt.uint32() >>> 6;
    return (a * 67108864.0 + b) / 9007199254740992.0;
  }
  randrange(n: number): number { return this.randbelow(n); }
  shuffle<T>(x: T[]): T[] {
    for (let i = x.length - 1; i > 0; i--) {
      const j = this.randbelow(i + 1);
      [x[i], x[j]] = [x[j]!, x[i]!];
    }
    return x;
  }
  sample<T>(pop: T[], k: number): T[] {
    const n = pop.length;
    const result: T[] = Array.from({ length: k });
    const setsize = 21;
    if (k <= 5) {
      // small pool path
      const pool = pop.slice();
      for (let i = 0; i < k; i++) {
        const j = this.randbelow(n - i);
        result[i] = pool[j]!;
        pool[j] = pool[n - i - 1]!;
      }
      return result;
    }
    void setsize;
    const selected = new Set<number>();
    for (let i = 0; i < k; i++) {
      let j = this.randbelow(n);
      while (selected.has(j)) j = this.randbelow(n);
      selected.add(j);
      result[i] = pop[j]!;
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// numpy-compatible ndarray str()/repr() formatting
// ---------------------------------------------------------------------------

/** Minimal ndarray: flat 1-D or 2-D float/int data + numpy str/repr. */
export class NdArray {
  constructor(
    public readonly data: number[] | number[][],
    public readonly kind: "int" | "float" = "float",
  ) {}
  get shape(): [number, number?] {
    return Array.isArray(this.data[0])
      ? [(this.data as number[][]).length, (this.data as number[][])[0]!.length]
      : [(this.data as number[]).length];
  }
  str(): string {
    const rows = Array.isArray(this.data[0]) ? (this.data as number[][]) : [this.data as number[]];
    const fmts = npFormatMatrix(rows, this.kind);
    const line = (r: string[]) => `[${r.join(" ")}]`;
    if (!Array.isArray(this.data[0])) return line(fmts[0]!);
    return `[${fmts.map((r, i) => (i === 0 ? line(r) : ` ${line(r)}`)).join("\n")}]`;
  }
  repr(): string {
    return `array(${this.str()}${this.kind === "int" ? "" : ""})`;
  }
  toString(): string { return this.str(); }
}

export const ndarray = (data: number[] | number[][], kind: "int" | "float" = "float"): NdArray => new NdArray(data, kind);

/**
 * numpy legacy array formatting: per-element "%.8f" trimmed to a trailing '.'
 * (positional mode) or "%.8e" (scientific, chosen when max_abs >= 1e8,
 * min_nonzero < 1e-4, or max/min > 1000). Integer parts are right-aligned and
 * fraction parts left-aligned across the whole matrix, like FloatFormat's
 * pad_left/pad_right — e.g. [-3.5, -1.51] -> ["-3.5 ", "-1.51"].
 */
export function npFormatMatrix(rows: number[][], kind: "int" | "float" = "float"): string[][] {
  if (kind === "int") return rows.map((r) => r.map((v) => `${Math.trunc(v)}`));
  const nz = rows.flat().filter((v) => Number.isFinite(v) && v !== 0).map(Math.abs);
  let sci = false;
  if (nz.length) {
    const mx = Math.max(...nz), mn = Math.min(...nz);
    sci = mx >= 1e8 || mn < 1e-4 || mx / mn > 1000;
  }
  // element -> [intPart, fracPart, expSuffix]. Sci mode: numpy FloatFormat
  // two-pass — precision = max frac length of %.8e trimmed to '.', then every
  // element prints %.{precision}e (frac zero-padded to the common width).
  let sciP = 0;
  if (sci) {
    const fracLen = (v: number): number => {
      if (!Number.isFinite(v)) return 0;
      const s = v.toExponential(8);
      return s.match(/^-?\d\.(\d+)e/)![1]!.replace(/0+$/, "").length;
    };
    sciP = Math.max(...rows.flat().map(fracLen));
  }
  const raw = (v: number): [string, string, string] => {
    if (Number.isNaN(v)) return ["nan", "", ""];
    if (!Number.isFinite(v)) return [v > 0 ? "inf" : "-inf", "", ""];
    if (sci) {
      const m = v.toExponential(sciP).match(/^(-?\d)(?:\.(\d+))?e([+-])(\d+)$/)!;
      return [m[1]!, m[2] ?? "", `e${m[3]}${m[4]!.padStart(2, "0")}`];
    }
    const s = v.toFixed(8).replace(/(\.\d*?)0+$/, "$1");
    const dot = s.indexOf(".");
    return dot < 0 ? [s, "", ""] : [s.slice(0, dot), s.slice(dot + 1), ""];
  };
  const parts = rows.map((r) => r.map(raw));
  const padL = Math.max(...parts.flat().map((p) => p[0].length));
  const padR = Math.max(...parts.flat().map((p) => p[1].length));
  return parts.map((r) => r.map(([l, f, e]) => `${l.padStart(padL, " ")}.${f.padEnd(padR, " ")}${e}`));
}

/** numpy scalar formatting: positional if it round-trips at 8 digits, else sci. */
export function npFormat(v: number, kind: "int" | "float" = "float"): string {
  if (kind === "int") return `${Math.trunc(v)}`;
  if (Number.isNaN(v)) return "nan";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  // dragon4_positional(x, precision=-1, fractional=True, trim='k')
  const pos = dragonPositional(v);
  // If the positional form needs more than 16 chars or exp outside [-4,16) -> sci
  const exp = Math.floor(Math.log10(Math.abs(v)));
  if (pos.length > 16 || v !== 0 && (exp >= 16 || exp < -4)) {
    return dragonScientific(v);
  }
  return pos;
}

/** numpy dragon4 positional with trim='k' (keep trailing . and one 0). */
export function dragonPositional(v: number): string {
  if (v === 0) return Object.is(v, -0) ? "-0." : "0.";
  // shortest round-trip decimal digits
  const { digits, exp } = shortestDigits(v);
  const neg = digits.startsWith("-") || v < 0;
  const d = (digits.startsWith("-") ? digits.slice(1) : digits).replace(/^0+/, "") || "0";
  let s: string;
  if (exp >= 0) {
    if (d.length <= exp + 1) s = d.padEnd(exp + 1, "0") + ".";
    else s = `${d.slice(0, exp + 1)}.${d.slice(exp + 1)}`;
  } else {
    s = `0.${"0".repeat(-exp - 1)}${d}`;
  }
  s = s.replace(/(\.\d*?)0+$/, "$1");
  if (s.endsWith(".")) s += "0";
  // numpy trims: 'k' keeps a trailing '.', e.g. '5.' stays '5.'
  return `${neg ? "-" : ""}${s}`;
}

/** numpy dragon4 scientific (exp=[x,2] two-digit). */
export function dragonScientific(v: number): string {
  const { digits, exp } = shortestDigits(v);
  const neg = v < 0;
  const d = digits.replace("-", "");
  const mant = d.length > 1 ? `${d[0]}.${d.slice(1)}` : d[0]!;
  const esign = exp < 0 ? "-" : "+";
  return `${neg ? "-" : ""}${mant}e${esign}${`${Math.abs(exp)}`.padStart(2, "0")}`;
}

/** Shortest round-trip digits + decimal exponent (like Ryu/dragon4 output). */
function shortestDigits(v: number): { digits: string; exp: number } {
  let s = v.toExponential(16);
  // trim digits while round-tripping
  let m = s.match(/^(-?\d)(?:\.(\d+))?e([+-]\d+)$/)!;
  let dig = (m[1]! + (m[2] ?? "")).replace(/0+$/, "");
  let e = parseInt(m[3]!, 10);
  for (let p = dig.length; p > 1; p--) {
    const cand = `${dig.slice(0, 1)}.${dig.slice(1, p)}e${e >= 0 ? "+" : ""}${e}`;
    if (Number(cand) !== Math.abs(v)) { dig = dig.slice(0, p); break; }
    dig = dig.slice(0, p);
  }
  // verify last digit
  while (dig.length > 1 && Number(`${dig[0]}.${dig.slice(1)}e${e}`) !== Math.abs(v)) {
    dig = dig.slice(0, -1);
  }
  if (Number(`${dig[0]}.${dig.slice(1)}e${e}`) !== Math.abs(v)) {
    // fall back to full precision
    s = v.toExponential(16);
    m = s.match(/^(-?\d)(?:\.(\d+))?e([+-]\d+)$/)!;
    dig = (m[1]! + (m[2] ?? "")).replace(/0+$/, "");
    e = parseInt(m[3]!, 10);
  }
  return { digits: dig, exp: e };
}

// ---------------------------------------------------------------------------
// nltk.internals / parse.corenlp / tag.stanford / parse.malt jar helpers
// ---------------------------------------------------------------------------

const PATHSEP = ":"; // os.pathsep on POSIX
const isFile = (p: string): boolean => { try { return statSync(p).isFile(); } catch { return false; } };
const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

interface FindJarIterOptions {
  path_to_jar?: string | null;
  envVars?: string[] | string;
  searchpath?: string[];
  url?: string | null;
  verbose?: boolean;
  isRegex?: boolean;
  out?: PrintSink;
}

/** nltk.internals.find_jar_iter — CLASSPATH-first env scan + regex quirk. */
export function* findJarIter(namePattern: string, options: FindJarIterOptions = {}): Generator<string> {
  const {
    path_to_jar = null, searchpath = [], url = null,
    verbose = false, isRegex = false,
  } = options;
  const out = options.out ?? ((s: string) => process.stdout.write(`${s}\n`));
  let envVars = options.envVars ?? [];
  if (typeof envVars === "string") envVars = envVars.split(" ");
  let yielded = false;
  envVars = ["CLASSPATH", ...envVars];

  if (path_to_jar !== null) {
    if (isFile(path_to_jar)) { yielded = true; yield path_to_jar; }
    else throw pyError("LookupError", `Could not find ${namePattern} jar file at ${path_to_jar}`);
  }

  for (const envVar of envVars) {
    const envVal = process.env[envVar];
    if (envVal === undefined) continue;
    if (envVar === "CLASSPATH") {
      for (const cp of envVal.split(PATHSEP)) {
        if (isFile(cp)) {
          const filename = pyBasename(cp);
          if ((isRegex && matchName(filename, namePattern)) || (!isRegex && filename === namePattern)) {
            if (verbose) out(`[Found ${namePattern}: ${cp}]`);
            yielded = true;
            yield cp;
          }
        }
        if (isDir(cp)) {
          if (!isRegex) {
            const p = pyJoin(cp, namePattern);
            if (isFile(p)) {
              if (verbose) out(`[Found ${namePattern}: ${cp}]`);
              yielded = true;
              yield p;
            }
          } else {
            for (const fileName of readdirSync(cp)) {
              if (matchName(fileName, namePattern)) {
                if (verbose) out(`[Found ${namePattern}: ${pyJoin(cp, fileName)}]`);
                yielded = true;
                yield pyJoin(cp, fileName);
              }
            }
          }
        }
      }
    } else {
      const jarEnv = envVal;
      const jarIter = isDir(jarEnv) ? readdirSync(jarEnv).map((f) => pyJoin(jarEnv, f)) : [jarEnv];
      for (const p of jarIter) {
        if (isFile(p)) {
          const filename = pyBasename(p);
          if ((isRegex && matchName(filename, namePattern)) || (!isRegex && filename === namePattern)) {
            if (verbose) out(`[Found ${namePattern}: ${p}]`);
            yielded = true;
            yield p;
          }
        }
      }
    }
  }

  for (const directory of searchpath) {
    if (isRegex) {
      for (const filename of readdirSync(directory)) {
        const pathToJar = pyJoin(directory, filename);
        if (isFile(pathToJar) && matchName(filename, namePattern) && verbose) {
          out(`[Found ${filename}: ${pathToJar}]`);
        }
        // NLTK quirk: yields every directory entry regardless of a match.
        yielded = true;
        yield pathToJar;
      }
    } else {
      const pathToJar = pyJoin(directory, namePattern);
      if (isFile(pathToJar)) {
        if (verbose) out(`[Found ${namePattern}: ${pathToJar}]`);
        yielded = true;
        yield pathToJar;
      }
    }
  }

  if (!yielded) {
    let msg = `NLTK was unable to find ${namePattern}!`;
    if (envVars.length) msg += ` Set the ${envVars[0]} environment variable`;
    msg = textwrapFill(`${msg}.`, 69, "  ", "  ");
    if (searchpath.length) {
      msg += `\n\n  Searched in:${searchpath.map((d) => `\n    - ${d}`).join("")}`;
    }
    if (url) msg += `\n\n  For more information, on ${namePattern}, see:\n    <${url}>`;
    const div = "=".repeat(75);
    throw pyError("LookupError", `\n\n${div}\n${msg}\n${div}`);
  }
}
export const find_jar_iter = findJarIter;

function matchName(base: string, pattern: string): boolean {
  try { return new RegExp(pattern).test(base); } catch { return false; }
}

/** nltk.internals.find_jar — first find_jar_iter result or LookupError. */
export function findJar(namePattern: string, options: FindJarIterOptions = {}): string {
  const it = findJarIter(namePattern, options);
  const { value, done } = it.next();
  if (done) throw pyError("LookupError", `Could not find ${namePattern}`);
  return value as string;
}
export const find_jar = findJar;

/** nltk.internals.find_jars_within_path — os.walk collecting *.jar files. */
export function findJarsWithinPath(pathToJars: string): string[] {
  const jars: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = pyJoin(dir, entry);
      if (isDir(full)) walk(full);
      else if (entry.endsWith(".jar")) jars.push(full);
    }
  };
  walk(pathToJars);
  return jars;
}
export const find_jars_within_path = findJarsWithinPath;

/** nltk.parse.corenlp.try_port(port=0): bind a socket, return the port. */
export function tryPort(port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", (err: NodeJS.ErrnoException) => {
      reject(Object.assign(
        pyError("OSError", `${err.errno ?? 98}: ${err.errno === 98 || err.code === "EADDRINUSE" ? "Address already in use" : (err.message ?? "Address already in use")}`),
        { errno: err.errno ?? 98, strerror: "Address already in use" },
      ));
    });
    srv.listen(port, "localhost", () => {
      const addr = srv.address();
      const p = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(p));
    });
  });
}
export const try_port = tryPort;

/**
 * nltk.internals.find_file_iter / find_dir — minimal port covering the
 * malt/stanford lookup paths (env var dirs, searchpath, 'which' fallback is
 * intentionally skipped to keep this pure of subprocesses).
 */
function* findFileIter(
  filename: string,
  options: { envVars?: string[]; searchpath?: string[]; fileNames?: string[]; url?: string | null; findingDir?: boolean } = {},
): Generator<string> {
  const { envVars = [], searchpath = [], fileNames = null, url = null, findingDir = false } = options;
  const alts = [filename, ...(fileNames ?? [])];
  let yielded = false;

  for (const alternative of alts) {
    const p1 = pyJoin(filename, alternative);
    if (isFile(p1)) { yielded = true; yield p1; }
    if (isFile(alternative)) { yielded = true; yield alternative; }
    const p2 = pyJoin(filename, "file", alternative);
    if (isFile(p2)) { yielded = true; yield p2; }
  }

  for (const envVar of envVars) {
    const envVal = process.env[envVar];
    if (envVal === undefined) continue;
    if (findingDir) {
      for (const envDir of envVal.split(PATHSEP)) {
        if (envDir) { yielded = true; yield envDir; }
      }
    }
    for (const envDir of envVal.split(PATHSEP)) {
      if (isFile(envDir)) { yielded = true; yield envDir; }
      for (const alternative of alts) {
        const p = pyJoin(envDir, alternative);
        if (isFile(p)) { yielded = true; yield p; }
        const pb = pyJoin(envDir, "bin", alternative);
        if (isFile(pb)) { yielded = true; yield pb; }
      }
    }
  }

  for (const directory of searchpath) {
    for (const alternative of alts) {
      const p = pyJoin(directory, alternative);
      if (isFile(p)) { yielded = true; yield p; }
    }
  }

  if (!yielded) {
    let msg = `NLTK was unable to find the ${filename} file!\nUse software specific configuration parameters`;
    if (envVars.length) msg += ` or set the ${envVars[0]} environment variable`;
    msg += ".";
    if (searchpath.length) {
      msg += `\n\n  Searched in:${searchpath.map((d) => `\n    - ${d}`).join("")}`;
    }
    if (url) msg += `\n\n  For more information on ${filename}, see:\n    <${url}>`;
    const div = "=".repeat(75);
    throw pyError("LookupError", `\n\n${div}\n${msg}\n${div}`);
  }
}

/** nltk.parse.malt.find_maltparser — abs path or find_dir via MALT_PARSER. */
export function findMaltparser(parserDirname: string): string[] {
  let maltDir: string;
  if (parserDirname.startsWith("/") && isDir(parserDirname)) {
    maltDir = parserDirname;
  } else {
    maltDir = [...findFileIter(parserDirname, { envVars: ["MALT_PARSER"], findingDir: true })][0]!;
    if (maltDir === undefined) throw pyError("LookupError", `Could not find ${parserDirname}`);
  }
  const maltJars = new Set(findJarsWithinPath(maltDir));
  const jars = new Set([...maltJars].map((j) => pyBasename(j)));
  const deps = new Set(["log4j.jar", "libsvm.jar", "liblinear-1.8.jar"]);
  if (![...deps].every((d) => jars.has(d))) {
    throw pyError("AssertionError", "assertion failed");
  }
  if (![...jars].some((j) => j.startsWith("maltparser-") && j.endsWith(".jar"))) {
    throw pyError("AssertionError", "assertion failed");
  }
  return [...maltJars];
}
export const find_maltparser = findMaltparser;

/** nltk.parse.malt.find_malt_model. */
export function findMaltModel(modelFilename: string | null | undefined): string {
  if (modelFilename === null || modelFilename === undefined) return "malt_temp.mco";
  if (existsSync(modelFilename)) return modelFilename;
  const it = findFileIter(modelFilename, { envVars: ["MALT_MODEL"] });
  const { value, done } = it.next();
  if (done) throw pyError("LookupError", `Could not find ${modelFilename}`);
  return value as string;
}
export const find_malt_model = findMaltModel;

/** nltk.parse.malt.malt_regex_tagger: RegexpTagger rules -> tag callable. */
const MALT_REGEX_TAGS: Array<[RegExp, string]> = [
  [/\.$/, "."],
  [/,$/, ","],
  [/\?$/, "?"],
  [/\($/, "("],
  [/\)$/, ")"],
  [/\[$/, "["],
  [/\]$/, "]"],
  [/^-?[0-9]+(\.[0-9]+)?$/, "CD"],
  [/^(The|the|A|a|An|an)$/, "DT"],
  [/^(He|he|She|she|It|it|I|me|Me|You|you)$/, "PRP"],
  [/^(His|his|Her|her|Its|its)$/, "PRP$"],
  [/^(my|Your|your|Yours|yours)$/, "PRP$"],
  [/^(on|On|in|In|at|At|since|Since)$/, "IN"],
  [/^(for|For|ago|Ago|before|Before)$/, "IN"],
  [/^(till|Till|until|Until)$/, "IN"],
  [/^(by|By|beside|Beside)$/, "IN"],
  [/^(under|Under|below|Below)$/, "IN"],
  [/^(over|Over|above|Above)$/, "IN"],
  [/^(across|Across|through|Through)$/, "IN"],
  [/^(into|Into|towards|Towards)$/, "IN"],
  [/^(onto|Onto|from|From)$/, "IN"],
  [/.*able$/, "JJ"],
  [/.*ness$/, "NN"],
  [/.*ly$/, "RB"],
  [/.*s$/, "NNS"],
  [/.*ing$/, "VBG"],
  [/.*ed$/, "VBD"],
  [/.*/, "NN"],
];
export function maltRegexTagger(): (tokens: string[]) => Array<[string, string]> {
  return (tokens: string[]) =>
    tokens.map((t) => {
      for (const [re, tag] of MALT_REGEX_TAGS) {
        if (re.test(t)) return [t, tag];
      }
      return [t, "NN"];
    });
}
export const malt_regex_tagger = maltRegexTagger;

/** nltk.tag.stanford.find_jar — delegates to internals.find_jar. */
export function stanfordFindJar(namePattern: string, options: FindJarIterOptions = {}): string {
  return findJar(namePattern, options);
}
export const stanford_find_jar = stanfordFindJar;

export { ZipFilePathPointer };

// ---------------------------------------------------------------------------
// nltk.twitter.api — TweetHandlerI, BasicTweetHandler, tzinfo, LOCAL
// ---------------------------------------------------------------------------

/** datetime.timedelta: str() is "H:MM:SS" (with days prefixed when nonzero). */
export class PyTimedelta {
  constructor(readonly totalSeconds: number) {}
  toString(): string {
    const days = Math.trunc(this.totalSeconds / 86400);
    const rem = this.totalSeconds - days * 86400;
    const h = Math.trunc(rem / 3600), m = Math.trunc((rem % 3600) / 60), s = rem % 60;
    const t = `${h}:${`${m}`.padStart(2, "0")}:${`${s}`.padStart(2, "0")}`;
    return days ? `${days} day${days === 1 ? "" : "s"}, ${t}` : t;
  }
}
/** tzinfo subclass: fixed utcoffset/dst = zero (NLTK's UTC-like local tz). */
export class LocalTimezoneOffsetWithUTC {
  static STDOFFSET = new PyTimedelta(0);
  static DSTOFFSET = new PyTimedelta(0);
  utcoffset(_dt: unknown): PyTimedelta { return LocalTimezoneOffsetWithUTC.STDOFFSET; }
  dst(_dt: unknown): PyTimedelta { return LocalTimezoneOffsetWithUTC.DSTOFFSET; }
  tzname(_dt: unknown): string { return "UTC"; }
}
export const LOCAL = new LocalTimezoneOffsetWithUTC();

/** Python datetime tuple -> "YYYY-MM-DD HH:MM:SS+00:00" string. */
function pyDatetimeStr(d: { year: number; month: number; day: number; hour: number; minute: number; second: number }): string {
  const p = (n: number, w = 2) => `${n}`.padStart(w, "0");
  return `${d.year}-${p(d.month)}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}:${p(d.second)}+00:00`;
}

function mkDate(...t: number[]): { year: number; month: number; day: number; hour: number; minute: number; second: number; epoch: number } {
  const [year, month, day, hour = 0, minute = 0, second = 0] = t;
  return { year: year!, month: month!, day: day!, hour, minute, second, epoch: Date.UTC(year!, month! - 1, day!, hour, minute, second) };
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
/** strptime("%a %b %d %H:%M:%S +0000 %Y") for twitter 'created_at'. */
export function parseTwitterDate(s: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; epoch: number } {
  const m = s.match(/^\w{3} (\w{3}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) \+0000 (\d{4})$/);
  if (!m) throw pyError("ValueError", `time data ${pyStrRepr(s)} does not match format ${pyStrRepr("%a %b %d %H:%M:%S +0000 %Y")}`);
  return mkDate(+m[6]!, MONTHS[m[1]!]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!);
}

/** nltk.twitter.api.BasicTweetHandler — counter/limit/stop logic (concrete). */
export class BasicTweetHandler {
  limit: number;
  counter = 0;
  do_stop = false;
  max_id: number | null = null;
  constructor(options: { limit?: number } | number = {}) {
    this.limit = typeof options === "number" ? options : (options.limit ?? 20);
  }
  do_continue(): boolean {
    return this.counter < this.limit && !this.do_stop;
  }
}

interface TweetHandlerOptions {
  limit?: number;
  upper_date_limit?: number[] | null;
  lower_date_limit?: number[] | null;
  upperDateLimit?: number[] | null;
  lowerDateLimit?: number[] | null;
}

/**
 * nltk.twitter.api.TweetHandlerI(BasicTweetHandler) — abstract; constructing
 * it directly raises Python's TypeError naming the abstract methods.
 */
export class TweetHandlerI extends BasicTweetHandler {
  upper_date_limit: { year: number; month: number; day: number; hour: number; minute: number; second: number; epoch: number } | null = null;
  lower_date_limit: { year: number; month: number; day: number; hour: number; minute: number; second: number; epoch: number } | null = null;
  startingup = true;
  constructor(options: TweetHandlerOptions = {}) {
    if (new.target === TweetHandlerI) {
      throw pyError("TypeError", "Can't instantiate abstract class TweetHandlerI without an implementation for abstract methods 'handle', 'on_finish'");
    }
    super({ limit: options.limit ?? 20 });
    const upper = options.upper_date_limit ?? options.upperDateLimit ?? null;
    const lower = options.lower_date_limit ?? options.lowerDateLimit ?? null;
    if (upper) this.upper_date_limit = mkDate(...upper);
    if (lower) this.lower_date_limit = mkDate(...lower);
  }
  handle(_data: unknown): void { throw pyError("NotImplementedError", "abstract method"); }
  on_finish(): void { throw pyError("NotImplementedError", "abstract method"); }
  /** Port of TweetHandlerI.check_date_limit + verbose message. */
  check_date_limit(data: { created_at?: string }, verbose = false, out?: PrintSink): void {
    if (!this.upper_date_limit && !this.lower_date_limit) return;
    const tweetDate = parseTwitterDate(data.created_at!);
    if ((this.upper_date_limit && tweetDate.epoch > this.upper_date_limit.epoch) ||
        (this.lower_date_limit && tweetDate.epoch < this.lower_date_limit.epoch)) {
      const message = this.upper_date_limit ? "earlier" : "later";
      const dateLimit = this.upper_date_limit ?? this.lower_date_limit!;
      if (verbose) {
        (out ?? ((s) => process.stdout.write(s)))(
          `Date limit ${pyDatetimeStr(dateLimit)} is ${message} than date of current tweet ${pyDatetimeStr(tweetDate)}\n`);
      }
      this.do_stop = true;
    }
  }
}

// ---------------------------------------------------------------------------
// nltk.twitter.common.outf_writer_compat (deprecated shim over csv.writer)
// ---------------------------------------------------------------------------

const DEPRECATION = "\n  Function outf_writer_compat() has been deprecated.  Use open() and\n  csv.writer() directly instead.\n";
let outfWarned = false;

/** Minimal csv.writer (QUOTE_MINIMAL, \r\n terminator). */
export class CsvWriter {
  constructor(private readonly file: CsvFile) {}
  writerow(row: unknown[]): void {
    const fields = row.map((f) => {
      const s = f === null || f === undefined ? "" : String(f);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    this.file.write(`${fields.join(",")}\r\n`);
  }
}

/** Writable file wrapper: plain or gzip; encodes with the given charset. */
export class CsvFile {
  private buf: string[] = [];
  private fd: number;
  constructor(private readonly path: string, private readonly gzipMode: boolean) {
    this.fd = openSync(path, "w");
  }
  write(s: string): void {
    // Errors='replace' is a no-op for valid UTF-8 output.
    if (this.gzipMode) this.buf.push(s);
    else writeSync(this.fd, Buffer.from(s, "utf8"));
  }
  close(): void {
    if (this.gzipMode) {
      writeSync(this.fd, gzipSync(Buffer.from(this.buf.join(""), "utf8")));
    }
    closeSync(this.fd);
  }
  read(): string {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const raw = readFileSync(this.path);
    return (this.gzipMode ? gunzipSync(raw) : raw).toString("utf8");
  }
}

/** nltk.twitter.common.outf_writer_compat — returns [csv.writer, fileobj]. */
export function outfWriterCompat(
  outfile: string,
  encoding = "utf8",
  errors = "replace",
  gzip_compress: boolean | { gzip_compress?: boolean } = false,
): [CsvWriter, CsvFile] {
  void encoding; void errors;
  const gz = typeof gzip_compress === "object" ? !!gzip_compress.gzip_compress : gzip_compress;
  if (!outfWarned) {
    outfWarned = true;
    process.stderr.write(`DeprecationWarning: ${DEPRECATION}`);
  }
  const fh = new CsvFile(outfile, gz);
  return [new CsvWriter(fh), fh];
}
export const outf_writer_compat = outfWriterCompat;

// ---------------------------------------------------------------------------
// nltk.chat — bots registry (chat functions constructable, non-interactive)
// ---------------------------------------------------------------------------

import { eliza_chat, iesha_chat, rude_chat, suntsu_chat, zen_chat } from "./chat";

/** nltk.chat.bots — [(fn, name)] as in nltk/chat/__init__.py. */
export const bots: Array<[((input?: () => string | null, out?: PrintSink) => void), string]> = [
  [eliza_chat, "Eliza (psycho-babble)"],
  [iesha_chat, "Iesha (teen anime junky)"],
  [rude_chat, "Rude (abusive bot)"],
  [suntsu_chat, "Suntsu (Chinese sayings)"],
  [zen_chat, "Zen (gems of wisdom)"],
];

/**
 * nltk.chat.chatbots — prints the bot menu, waits for `input()` on stdin in
 * Python; here the input function is injected (no stdin reads).
 */
export function chatbots(out: PrintSink, inputFn: () => string | null = () => null): void {
  out("Which chatbot would you like to talk to?\n");
  const botcount = bots.length;
  for (let i = 0; i < botcount; i++) out(`  ${i + 1}: ${bots[i]![1]}\n`);
  let choice = "";
  for (;;) {
    out(`\nEnter a number in the range 1-${botcount}: `);
    const line = inputFn();
    if (line === null) throw pyError("EOFError", "EOF when reading a line");
    choice = line.trim();
    if (/^\d+$/.test(choice) && parseInt(choice, 10) - 1 >= 0 && parseInt(choice, 10) - 1 < botcount) break;
    out("   Error: bad chatbot number\n");
  }
  const chatbot = bots[parseInt(choice, 10) - 1]![0];
  chatbot(inputFn, out);
}

// ---------------------------------------------------------------------------
// nltk.parse.dependencygraph demo data + pprint rendering
// ---------------------------------------------------------------------------

export const conll_data1 = `
1   Ze                ze                Pron  Pron  per|3|evofmv|nom                 2   su      _  _
2   had               heb               V     V     trans|ovt|1of2of3|ev             0   ROOT    _  _
3   met               met               Prep  Prep  voor                             8   mod     _  _
4   haar              haar              Pron  Pron  bez|3|ev|neut|attr               5   det     _  _
5   moeder            moeder            N     N     soort|ev|neut                    3   obj1    _  _
6   kunnen            kan               V     V     hulp|ott|1of2of3|mv              2   vc      _  _
7   gaan              ga                V     V     hulp|inf                         6   vc      _  _
8   winkelen          winkel            V     V     intrans|inf                      11  cnj     _  _
9   ,                 ,                 Punc  Punc  komma                            8   punct   _  _
10  zwemmen           zwem              V     V     intrans|inf                      11  cnj     _  _
11  of                of                Conj  Conj  neven                            7   vc      _  _
12  terrassen         terras            N     N     soort|mv|neut                    11  cnj     _  _
13  .                 .                 Punc  Punc  punt                             12  punct   _  _
`;

export const treebank_data = `Pierre  NNP     2       NMOD
Vinken  NNP     8       SUB
,       ,       2       P
61      CD      5       NMOD
years   NNS     6       AMOD
old     JJ      2       NMOD
,       ,       2       P
will    MD      0       ROOT
join    VB      8       VC
the     DT      11      NMOD
board   NN      9       OBJ
as      IN      9       VMOD
a       DT      15      NMOD
nonexecutive    JJ      15      NMOD
director        NN      12      PMOD
Nov.    NNP     9       VMOD
29      CD      16      NMOD
.       .       9       VMOD
`;

/** conll_data2 = 7 sample conll entries (from dependencygraph.py docstring). */
export const conll_data2 = `1   Cathy             Cathy             N     N     eigen|ev|neut                    2   su      _  _
2   zag               zie               V     V     trans|ovt|1of2of3|ev             0   ROOT    _  _
3   hen               hen               Pron  Pron  per|3|mv|datofacc                2   obj1    _  _
4   wild              wild              Adj   Adj   attr|stell|onverv                5   mod     _  _
5   zwaaien           zwaai             N     N     soort|mv|neut                    2   vc      _  _
6   .                 .                 Punc  Punc  punt                             5   punct   _  _

1   Ze                ze                Pron  Pron  per|3|evofmv|nom                 2   su      _  _
2   had               heb               V     V     trans|ovt|1of2of3|ev             0   ROOT    _  _
3   met               met               Prep  Prep  voor                             8   mod     _  _
4   haar              haar              Pron  Pron  bez|3|ev|neut|attr               5   det     _  _
5   moeder            moeder            N     N     soort|ev|neut                    3   obj1    _  _
6   kunnen            kan               V     V     hulp|ott|1of2of3|mv              2   vc      _  _
7   gaan              ga                V     V     hulp|inf                         6   vc      _  _
8   winkelen          winkel            V     V     intrans|inf                      11  cnj     _  _
9   ,                 ,                 Punc  Punc  komma                            8   punct   _  _
10  zwemmen           zwem              V     V     intrans|inf                      11  cnj     _  _
11  of                of                Conj  Conj  neven                            7   vc      _  _
12  terrassen         terras            N     N     soort|mv|neut                    11  cnj     _  _
13  .                 .                 Punc  Punc  punt                             12  punct   _  _

1   Dat               dat               Pron  Pron  aanw|neut|attr                   2   det     _  _
2   werkwoord         werkwoord         N     N     soort|ev|neut                    6   obj1    _  _
3   had               heb               V     V     hulp|ovt|1of2of3|ev              0   ROOT    _  _
4   ze                ze                Pron  Pron  per|3|evofmv|nom                 6   su      _  _
5   zelf              zelf              Pron  Pron  aanw|neut|attr|wzelf             3   predm   _  _
6   uitgevonden       vind              V     V     trans|verldw|onverv              3   vc      _  _
7   .                 .                 Punc  Punc  punt                             6   punct   _  _

1   Het               het               Pron  Pron  onbep|neut|zelfst                2   su      _  _
2   hoorde            hoor              V     V     trans|ovt|1of2of3|ev             0   ROOT    _  _
3   bij               bij               Prep  Prep  voor                             2   ld      _  _
4   de                de                Art   Art   bep|zijdofmv|neut                6   det     _  _
5   warme             warm              Adj   Adj   attr|stell|vervneut              6   mod     _  _
6   zomerdag          zomerdag          N     N     soort|ev|neut                    3   obj1    _  _
7   die               die               Pron  Pron  betr|neut|zelfst                 6   mod     _  _
8   ze                ze                Pron  Pron  per|3|evofmv|nom                 12  su      _  _
9   ginds             ginds             Adv   Adv   gew|aanw                         12  mod     _  _
10  achter            achter            Adv   Adv   gew|geenfunc|stell|onverv        12  svp     _  _
11  had               heb               V     V     hulp|ovt|1of2of3|ev              7   body    _  _
12  gelaten           laat              V     V     trans|verldw|onverv              11  vc      _  _
13  .                 .                 Punc  Punc  punt                             12  punct   _  _

1   Ze                ze                Pron  Pron  per|3|evofmv|nom                 2   su      _  _
2   hadden            heb               V     V     trans|ovt|1of2of3|mv             0   ROOT    _  _
3   languit           languit           Adv   Adv   gew|geenfunc|stell|onverv        11  mod     _  _
4   naast             naast             Prep  Prep  voor                             11  mod     _  _
5   elkaar            elkaar            Pron  Pron  rec|neut                         4   obj1    _  _
6   op                op                Prep  Prep  voor                             11  ld      _  _
7   de                de                Art   Art   bep|zijdofmv|neut                8   det     _  _
8   strandstoelen     strandstoel       N     N     soort|mv|neut                    6   obj1    _  _
9   kunnen            kan               V     V     hulp|inf                         2   vc      _  _
10  gaan              ga                V     V     hulp|inf                         9   vc      _  _
11  liggen            lig               V     V     intrans|inf                      10  vc      _  _
12  .                 .                 Punc  Punc  punt                             11  punct   _  _

1   Zij               zij               Pron  Pron  per|3|evofmv|nom                 2   su      _  _
2   zou               zal               V     V     hulp|ovt|1of2of3|ev              7   cnj     _  _
3   mams              mams              N     N     soort|ev|neut                    4   det     _  _
4   rug               rug               N     N     soort|ev|neut                    5   obj1    _  _
5   ingewreven        wrijf             V     V     trans|verldw|onverv              6   vc      _  _
6   hebben            heb               V     V     hulp|inf                         2   vc      _  _
7   en                en                Conj  Conj  neven                            0   ROOT    _  _
8   mam               mam               V     V     trans|ovt|1of2of3|ev             7   cnj     _  _
9   de                de                Art   Art   bep|zijdofmv|neut                10  det     _  _
10  hare              hare              Pron  Pron  bez|3|ev|neut|attr               8   obj1    _  _
11  .                 .                 Punc  Punc  punt                             10  punct   _  _

1   Of                of                Conj  Conj  onder|metfin                     0   ROOT    _  _
2   ze                ze                Pron  Pron  per|3|evofmv|nom                 3   su      _  _
3   had               heb               V     V     hulp|ovt|1of2of3|ev              0   ROOT    _  _
4   gewoon            gewoon            Adj   Adj   adv|stell|onverv                 10  mod     _  _
5   met               met               Prep  Prep  voor                             10  mod     _  _
6   haar              haar              Pron  Pron  bez|3|ev|neut|attr               7   det     _  _
7   vriendinnen       vriendin          N     N     soort|mv|neut                    5   obj1    _  _
8   rond              rond              Adv   Adv   deelv                            10  svp     _  _
9   kunnen            kan               V     V     hulp|inf                         3   vc      _  _
10  slenteren         slenter           V     V     intrans|inf                      9   vc      _  _
11  in                in                Prep  Prep  voor                             10  mod     _  _
12  de                de                Art   Art   bep|zijdofmv|neut                13  det     _  _
13  buurt             buurt             N     N     soort|ev|neut                    11  obj1    _  _
14  van               van               Prep  Prep  voor                             13  mod     _  _
15  Trafalgar_Square  Trafalgar_Square  MWU   N_N   eigen|ev|neut_eigen|ev|neut      14  obj1    _  _
16  .                 .                 Punc  Punc  punt                             15  punct   _  _
`;

/**
 * pprint.pformat(dg.nodes) — nodes is a defaultdict of int -> node dict.
 * depsKind controls whether each node's deps renders as defaultdict(list)
 * (conll/rule-based parsed graphs) or plain dict (probnpp yields).
 */
export function pformatDependencyGraph(
  nodes: ReadonlyArray<{ address: number | null; word: string | null; lemma: string | null; ctag: string | null; tag: string | null; feats: string | null; head: number | null; rel: string | null; deps: Record<string, number[]> | number[] | undefined } | undefined>,
  depsKind: "defaultdict" | "plain" = "defaultdict",
): string {
  const dd = new PyDefaultDict<number, PyDict<string, unknown>>(
    "<function DependencyGraph.__init__.<locals>.<lambda> at 0x7f0000000000>",
  );
  nodes.forEach((node, i) => {
    if (!node) return;
    const depsVal = node.deps;
    let deps: PyDict<string | number, number[]>;
    if (depsKind === "defaultdict") {
      const d = new PyDefaultDict<string | number, number[]>("<class 'list'>");
      if (depsVal && !Array.isArray(depsVal)) {
        for (const [k, v] of Object.entries(depsVal)) d.set(k, v);
      }
      deps = d;
    } else {
      deps = new PyDict<string | number, number[]>();
      if (depsVal && !Array.isArray(depsVal)) {
        for (const [k, v] of Object.entries(depsVal)) deps.set(k, v);
      } else if (Array.isArray(depsVal)) {
        for (const [j, v] of depsVal.entries()) deps.set(j, [v]);
      }
    }
    const nd = new PyDict<string, unknown>();
    nd.set("address", node.address);
    nd.set("ctag", node.ctag);
    nd.set("deps", deps);
    nd.set("feats", node.feats);
    nd.set("head", node.head);
    nd.set("lemma", node.lemma);
    nd.set("rel", node.rel);
    nd.set("tag", node.tag);
    nd.set("word", node.word);
    dd.set(i, nd);
  });
  return pformat(dd, { width: 80, indent: 1 });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export { pyNormpath, pyJoin, pySplit, pyBasename };
