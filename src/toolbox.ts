// nltk.toolbox — Toolbox standard-format-marker file reading/writing.
// ElementTree is replaced by a minimal ToolboxElement that preserves tag /
// text / ordered-children semantics used by the toolbox helpers.

import { PathPointer } from "./data";
import { pathsec_open } from "./pathsec";
import { pyError } from "./internals";
import { regexpChunkParse } from "./chunk";

/** Minimal xml.etree.ElementTree.Element substitute for toolbox trees. */
export class ToolboxElement {
  tag: string;
  text: string | null;
  children: ToolboxElement[];

  constructor(tag: string, text: string | null = null, children: ToolboxElement[] = []) {
    this.tag = tag;
    this.text = text;
    this.children = children;
  }

  get length(): number { return this.children.length; }
  get(i: number): ToolboxElement | undefined { return this.children[i]; }
  [Symbol.iterator](): Iterator<ToolboxElement> { return this.children[Symbol.iterator](); }

  find(path: string): ToolboxElement | null {
    const parts = path.split("/");
    const match = (el: ToolboxElement, idx: number): ToolboxElement | null => {
      for (const c of el.children) {
        if (c.tag === parts[idx]) {
          if (idx === parts.length - 1) return c;
          const r = match(c, idx + 1);
          if (r) return r;
        }
      }
      return null;
    };
    if (parts[0] === this.tag) {
      if (parts.length === 1) return this;
      return match(this, 1);
    }
    return match(this, 0);
  }

  findall(path: string): ToolboxElement[] {
    const parts = path.split("/");
    const collect = (el: ToolboxElement, idx: number, acc: ToolboxElement[]) => {
      for (const c of el.children) {
        if (c.tag === parts[idx]) {
          if (idx === parts.length - 1) acc.push(c);
          else collect(c, idx + 1, acc);
        }
      }
    };
    const acc: ToolboxElement[] = [];
    if (parts[0] === this.tag) {
      if (parts.length === 1) return [this];
      collect(this, 1, acc);
    } else {
      collect(this, 0, acc);
    }
    return acc;
  }

  append(child: ToolboxElement): void { this.children.push(child); }
  getiterator(): ToolboxElement[] {
    const out: ToolboxElement[] = [this];
    for (const c of this.children) out.push(...c.getiterator());
    return out;
  }
  set childrenReplace(children: ToolboxElement[]) { this.children = children; }
}

class TreeBuilder {
  private stack: ToolboxElement[] = [];
  private root: ToolboxElement | null = null;
  start(tag: string): void {
    const el = new ToolboxElement(tag);
    if (this.stack.length) this.stack[this.stack.length - 1]!.append(el);
    else this.root = el;
    this.stack.push(el);
  }
  data(text: string | null): void {
    const top = this.stack[this.stack.length - 1];
    if (top && text != null) top.text = (top.text ?? "") + text;
  }
  end(tag?: string): void {
    const el = this.stack.pop()!;
    if (tag !== undefined && el.tag !== tag) throw pyError("ValueError", `mismatched end tag ${tag}`);
  }
  close(): ToolboxElement {
    if (this.stack.length) throw pyError("ValueError", "unclosed elements");
    return this.root!;
  }
}

/** nltk.toolbox.StandardFormat — sequential reader for SFM files/strings. */
export class StandardFormat {
  protected _encoding: string | null;
  protected _file: Iterator<string> | null = null;
  line_num = 0;

  constructor(filename: string | PathPointer | null = null, encoding: string | null = null) {
    this._encoding = encoding;
    if (filename !== null) this.open(filename);
  }

  open(sfm_file: string | PathPointer): void {
    const enc = this._encoding ?? "utf-8";
    let text: string;
    if (sfm_file instanceof PathPointer) {
      text = sfm_file.open(enc).read();
    } else {
      text = new TextDecoder(enc === "utf8" ? "utf-8" : enc as "utf-8").decode(
        pathsec_open(sfm_file, "r", "toolbox.StandardFormat"),
      );
    }
    this.open_string(text);
  }

  open_string(s: string): void {
    const lines = s.split("\n");
    // StringIO iteration yields lines with trailing '\n' (except the last).
    const withEol = lines.slice(0, -1).map((l) => l + "\n").concat([lines[lines.length - 1]!]);
    this._file = withEol[Symbol.iterator]();
  }

  *raw_fields(): Generator<[string | null, string]> {
    const joinString = "\n";
    const lineRegexp = (first: string) => new RegExp(`^${first}(?:\\\\(\\S+)\\s*)?(.*)$`, "m");
    const firstLinePat = lineRegexp("(?:\xEF\xBB\xBF)?");
    const linePat = lineRegexp("");
    const it = this._file!;
    let r = it.next();
    if (r.done) return;
    let mobj = firstLinePat.exec(r.value)!;
    let mkr: string | null = mobj[1] ?? null;
    let valueLines = [mobj[2]!];
    this.line_num = 0;
    while (!(r = it.next()).done) {
      this.line_num += 1;
      mobj = linePat.exec(r.value)!;
      const lineMkr = mobj[1] ?? null;
      const lineValue = mobj[2]!;
      if (lineMkr) {
        yield [mkr, valueLines.join(joinString)];
        mkr = lineMkr;
        valueLines = [lineValue];
      } else {
        valueLines.push(lineValue);
      }
    }
    this.line_num += 1;
    yield [mkr, valueLines.join(joinString)];
  }

  *fields(options: { strip?: boolean; unwrap?: boolean; encoding?: string | null; errors?: string; unicode_fields?: string[] | null } = {}): Generator<[string | null, string]> {
    const { strip = true, unwrap = true, encoding = null, unicode_fields = null } = options;
    if (encoding === null && unicode_fields !== null) {
      throw pyError("ValueError", "unicode_fields is set but not encoding.");
    }
    const unwrapPat = /\n+/g;
    for (const [mkr, val0] of this.raw_fields()) {
      let val = val0;
      if (unwrap) val = val.replace(unwrapPat, " ");
      if (strip) val = val.replace(/\s+$/, "");
      yield [mkr, val];
    }
  }

  close(): void {
    this._file = null;
  }
}

/** nltk.toolbox.ToolboxData — records all markers at the same level. */
export class ToolboxData extends StandardFormat {
  parse(options: { grammar?: string | null; key?: string | null } & Record<string, unknown> = {}): ToolboxElement {
    const { grammar = null, ...kwargs } = options;
    if (grammar) return this._chunk_parse(grammar, kwargs);
    return this._record_parse(kwargs);
  }

  private _record_parse(kwargs: Record<string, unknown>): ToolboxElement {
    let key = kwargs["key"] as string | null | undefined ?? null;
    const builder = new TreeBuilder();
    builder.start("toolbox_data");
    builder.start("header");
    let inRecords = false;
    for (const [mkr0, value] of this.fields(kwargs as never)) {
      const mkr = mkr0!;
      if (key === null && !inRecords && mkr[0] !== "_") key = mkr;
      if (mkr === key) {
        if (inRecords) builder.end("record");
        else { builder.end("header"); inRecords = true; }
        builder.start("record");
      }
      builder.start(mkr);
      builder.data(value);
      builder.end(mkr);
    }
    if (inRecords) builder.end("record");
    else builder.end("header");
    builder.end("toolbox_data");
    return builder.close();
  }

  private _tree2etree(elements: Array<{ kind?: string; label?: string; token?: string; tag?: string; tokens?: Array<{ token: string; tag: string }> }>, rootLabel: string): ToolboxElement {
    const root = new ToolboxElement(rootLabel);
    for (const child of elements) {
      if (child && child.kind === "chunk") {
        const sub = new ToolboxElement(child.label!);
        for (const tok of child.tokens ?? []) sub.append(new ToolboxElement(tok.tag, tok.token));
        root.append(sub);
      } else if (child) {
        root.append(new ToolboxElement(child.tag!, child.token ?? null));
      }
    }
    return root;
  }

  private _chunk_parse(grammar: string, kwargs: Record<string, unknown>): ToolboxElement {
    const rootLabel = (kwargs["root_label"] as string | undefined) ?? "record";
    const db = this.parse(kwargs);
    const tbEtree = new ToolboxElement("toolbox_data");
    const header = db.find("header");
    if (header) tbEtree.append(header);
    for (const record of db.findall("record")) {
      const tokens = record.children.map((elem): { token: string; tag: string } => ({ token: elem.text ?? "", tag: elem.tag }));
      const parsed = regexpChunkParse(tokens, grammar);
      tbEtree.append(this._tree2etree(parsed as never, rootLabel));
    }
    return tbEtree;
  }
}

const _is_value = /\S/;

/** nltk.toolbox.to_sfm_string — tree → SFM text. */
export function to_sfm_string(tree: ToolboxElement, options: { encoding?: string | null; errors?: string; unicode_fields?: Set<string> | null } = {}): string {
  const { encoding = null, unicode_fields = null } = options;
  if (tree.tag === "record") {
    const root = new ToolboxElement("toolbox_data");
    root.append(tree);
    tree = root;
  }
  if (tree.tag !== "toolbox_data") throw pyError("ValueError", "not a toolbox_data element structure");
  if (encoding === null && unicode_fields !== null && unicode_fields !== undefined) {
    throw pyError("ValueError", "if encoding is not specified then neither should unicode_fields");
  }
  const l: string[] = [];
  for (const rec of tree) {
    l.push("\n");
    for (const field of rec) {
      const mkr = field.tag;
      const value = field.text ?? "";
      if (_is_value.test(value)) l.push(`\\${mkr} ${value}\n`);
      else l.push(`\\${mkr}${value}\n`);
    }
  }
  return l.slice(1).join("");
}

/** nltk.toolbox.ToolboxSettings — nested-block settings file. */
export class ToolboxSettings extends StandardFormat {
  constructor() { super(); }

  parse(kwargs: Record<string, unknown> = {}): ToolboxElement {
    const builder = new TreeBuilder();
    for (const [mkr0, value] of this.fields(kwargs as never)) {
      let mkr = mkr0!;
      let block: string | null = mkr[0]!;
      if (block === "+" || block === "-") mkr = mkr.slice(1);
      else block = null;
      if (block === "+") {
        builder.start(mkr);
        builder.data(value);
      } else if (block === "-") {
        builder.end(mkr);
      } else {
        builder.start(mkr);
        builder.data(value);
        builder.end(mkr);
      }
    }
    return builder.close();
  }
}

/** nltk.toolbox.to_settings_string — settings tree → text. */
export function to_settings_string(tree: { getroot?: () => ToolboxElement } | ToolboxElement): string {
  const root = typeof (tree as { getroot?: () => ToolboxElement }).getroot === "function"
    ? (tree as { getroot: () => ToolboxElement }).getroot()
    : tree as ToolboxElement;
  const l: string[] = [];
  _to_settings_string(root, l);
  return l.join("");
}

function _to_settings_string(node: ToolboxElement, l: string[]): void {
  const tag = node.tag;
  const text = node.text;
  if (node.children.length === 0) {
    if (text) l.push(`\\${tag} ${text}\n`);
    else l.push(`\\${tag}\n`);
  } else {
    if (text) l.push(`\\+${tag} ${text}\n`);
    else l.push(`\\+${tag}\n`);
    for (const n of node) _to_settings_string(n, l);
    l.push(`\\-${tag}\n`);
  }
}

/** nltk.toolbox.remove_blanks — strip empty elements in place. */
export function remove_blanks(elem: ToolboxElement): void {
  const out: ToolboxElement[] = [];
  for (const child of elem) {
    remove_blanks(child);
    if (child.text || child.children.length > 0) out.push(child);
  }
  elem.childrenReplace = out;
}

/** nltk.toolbox.add_default_fields — add blank elements in place. */
export function add_default_fields(elem: ToolboxElement, default_fields: Record<string, string[]>): void {
  for (const field of default_fields[elem.tag] ?? []) {
    if (elem.find(field) === null) elem.append(new ToolboxElement(field));
  }
  for (const child of elem) add_default_fields(child, default_fields);
}

/** nltk.toolbox.sort_fields — sort children by field_orders in place. */
export function sort_fields(elem: ToolboxElement, field_orders: Record<string, string[]>): void {
  const order_dicts: Record<string, Record<string, number>> = {};
  for (const [field, order] of Object.entries(field_orders)) {
    const order_key: Record<string, number> = {};
    order.forEach((subfield, i) => { order_key[subfield] = i; });
    order_dicts[field] = order_key;
  }
  _sort_fields(elem, order_dicts);
}

function _sort_fields(elem: ToolboxElement, orders_dicts: Record<string, Record<string, number>>): void {
  const order = orders_dicts[elem.tag];
  if (order) {
    const tmp = elem.children.map((child, i) => ({ key: order[child.tag] ?? 1e9, i, child }));
    tmp.sort((a, b) => a.key - b.key || a.i - b.i);
    elem.childrenReplace = tmp.map((t) => t.child);
  }
  for (const child of elem) {
    if (child.children.length) _sort_fields(child, orders_dicts);
  }
}

/** nltk.toolbox.add_blank_lines — append '\n' to last descendant of preceding element. */
export function add_blank_lines(tree: ToolboxElement, blanks_before: Record<string, string[]>, blanks_between: Record<string, string[]>): void {
  const before = blanks_before[tree.tag];
  const between = blanks_between[tree.tag];
  if (before === undefined || between === undefined) {
    for (const elem of tree) {
      if (elem.children.length) add_blank_lines(elem, blanks_before, blanks_between);
    }
    return;
  }
  let last_elem: ToolboxElement | null = null;
  for (const elem of tree) {
    const tag = elem.tag;
    if (last_elem !== null && last_elem.tag !== tag) {
      if (before.includes(tag) && last_elem !== null) {
        const e = last_elem.getiterator().pop()!;
        e.text = (e.text ?? "") + "\n";
      }
    } else {
      if (between.includes(tag)) {
        const e = last_elem!.getiterator().pop()!;
        e.text = (e.text ?? "") + "\n";
      }
    }
    if (elem.children.length) add_blank_lines(elem, blanks_before, blanks_between);
    last_elem = elem;
  }
}
/** (marker, value) field tuple yielded by StandardFormat.fields(). */
export type SFMField = [marker: string | null, value: string];

/** Parse a standard-format-marker string into a toolbox_data element tree. */
export function parseSFMString(s: string, key?: string | null): ToolboxElement {
  const data = new ToolboxData();
  data.open_string(s);
  return data.parse({ key: key ?? null });
}

/** camelCase alias for to_sfm_string(). */
export function toSFMString(tree: ToolboxElement, options?: { encoding?: string | null; errors?: string; unicode_fields?: Set<string> | null }): string {
  return to_sfm_string(tree, options);
}

/** camelCase alias for to_settings_string(). */
export function toSettingsString(tree: ToolboxElement): string {
  return to_settings_string(tree);
}

/** camelCase aliases for the tree helpers. */
export const removeBlanks = remove_blanks;
export const addDefaultFields = add_default_fields;
export const sortFields = sort_fields;
export const addBlankLines = add_blank_lines;
