/**
 * Shim for nltk.toolbox — Toolbox / Standard Format Marker (SFM) reader.
 *
 * Toolbox SFM parsing (StandardFormat, ToolboxData, ToolboxSettings, chunk_parse)
 * is file/encoding/corpus dependent. This shim preserves the public API with
 * typed signatures and throws a helpful error for corpus/file paths, while
 * providing a pure in-memory SFM string parser so programmatic use without
 * files can proceed.
 */

export interface SFMField { marker: string; value: string; }

function toolboxMissing(op: string, filename?: string): never {
  throw new Error(
    `nltk.toolbox.${op}: requires Toolbox SFM data${filename ? ` file '${filename}'` : ""}. ` +
    `In bun_nltk this is a shim (file I/O and nltk.data PathPointer not bundled). ` +
    `Options:\n` +
    `  • Parse an in-memory SFM string via StandardFormat.openString + fields/rawFields\n` +
    `  • Load Toolbox data in Python: from nltk.toolbox import ToolboxData; ToolboxData().open(path)\n` +
    `  • Use parseSFMString() helper below for pure string parsing`
  );
}

/** Pure helper: parse SFM string into fields without file I/O. */
export function parseSFMString(s: string): SFMField[] {
  const fields: SFMField[] = [];
  const lineRegex = /^\\(\S+)\s*(.*)$/;
  let cur: SFMField | null = null;
  for (const rawLine of s.split("\n")) {
    const m = rawLine.match(lineRegex);
    if (m) {
      if (cur) fields.push(cur);
      cur = { marker: m[1]!, value: m[2]! };
    } else {
      if (cur) cur.value += "\n" + rawLine;
      else if (rawLine.trim() !== "") {
        // continuation before any marker — treat as blank marker field
        cur = { marker: "", value: rawLine };
      }
    }
  }
  if (cur) fields.push(cur);
  return fields;
}

export class StandardFormat {
  protected _encoding: string | null;
  protected _content: string | null = null;

  constructor(filename?: string, encoding?: string) {
    this._encoding = encoding ?? null;
    if (filename != null) this.open(filename);
  }

  open(sfmFile: string): void {
    // File-based open requires corpus/pathsec — shim
    toolboxMissing("StandardFormat.open", sfmFile);
  }

  openString(s: string): void {
    this._content = s;
  }

  open_string(s: string): void { this.openString(s); }

  *rawFields(): Iterable<[string, string]> {
    if (this._content == null) throw new Error("StandardFormat: no file/string opened. Call openString(s) first.");
    const fields = parseSFMString(this._content);
    for (const f of fields) yield [f.marker, f.value];
  }

  *fields(opts: { strip?: boolean; unwrap?: boolean } = {}): Iterable<[string, string]> {
    const strip = opts.strip ?? true;
    const unwrap = opts.unwrap ?? true;
    for (const [mkr, val] of this.rawFields()) {
      let v = val;
      if (unwrap) v = v.replace(/\n/g, " ");
      if (strip) v = v.trimEnd();
      yield [mkr, v];
    }
  }

  raw_fields(): Iterable<[string, string]> { return this.rawFields(); }
}

export class ToolboxData extends StandardFormat {
  parse(_grammar?: string, _kwargs?: Record<string, unknown>): unknown {
    toolboxMissing("ToolboxData.parse");
  }

  toSFMString(_tree?: unknown): string {
    toolboxMissing("ToolboxData.to_sfm_string");
  }
}

export class ToolboxSettings extends StandardFormat {
  parse(_kwargs?: Record<string, unknown>): unknown {
    toolboxMissing("ToolboxSettings.parse");
  }
}

export function toSFMString(_tree: unknown, _encoding?: string): string {
  toolboxMissing("to_sfm_string");
}

export const to_sfm_string = toSFMString;

export function toSettingsString(_tree: unknown, _encoding?: string): string {
  toolboxMissing("to_settings_string");
}
export const to_settings_string = toSettingsString;

export function removeBlanks(_elem: unknown): void { toolboxMissing("remove_blanks"); }
export const remove_blanks = removeBlanks;

export function addDefaultFields(_elem: unknown, _defaultFields: unknown): void { toolboxMissing("add_default_fields"); }
export const add_default_fields = addDefaultFields;

export function sortFields(_elem: unknown, _fieldOrders: unknown): void { toolboxMissing("sort_fields"); }
export const sort_fields = sortFields;

export function addBlankLines(_tree: unknown, _blanksBefore: unknown, _blanksBetween: unknown): void { toolboxMissing("add_blank_lines"); }
export const add_blank_lines = addBlankLines;

export function demo(): never { toolboxMissing("demo"); }
