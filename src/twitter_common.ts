// nltk.twitter.common — tweet-JSON → CSV extraction utilities.
// Twython-dependent streaming APIs remain out of scope; these are the pure
// file-transform helpers.

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { pyError } from "./internals";

const HIER_SEPARATOR = ".";

/** nltk.twitter.common.extract_fields — pull (possibly nested) field values. */
export function extract_fields(tweet: Record<string, unknown>, fields: string[]): unknown[] {
  const out: unknown[] = [];
  for (const field of fields) {
    try {
      _add_field_to_out(tweet, field, out);
    } catch (e) {
      if (e instanceof TypeError || e instanceof Error) {
        throw pyError("RuntimeError", `Fatal error when extracting fields. Cannot find field ${field}`);
      }
      throw e;
    }
  }
  return out;
}

function _add_field_to_out(json: Record<string, unknown>, field: string, out: unknown[]): void {
  if (_is_composed_key(field)) {
    const [key, value] = _get_key_value_composed(field);
    _add_field_to_out(json[key] as Record<string, unknown>, value, out);
  } else {
    out.push(json[field]);
  }
}

function _is_composed_key(field: string): boolean {
  return field.includes(HIER_SEPARATOR);
}

function _get_key_value_composed(field: string): [string, string] {
  const out = field.split(HIER_SEPARATOR);
  return [out[0]!, out.slice(1).join(HIER_SEPARATOR)];
}

function _get_entity_recursive(json: unknown, entity: string): unknown {
  if (json === null || json === undefined) return null;
  if (Array.isArray(json)) {
    for (const item of json) {
      const candidate = _get_entity_recursive(item, entity);
      if (candidate !== null && candidate !== undefined) return candidate;
    }
    return null;
  }
  if (typeof json === "object") {
    for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
      if (key === entity) return value;
      if (key === "entities" || key === "extended_entities") {
        const candidate = _get_entity_recursive(value, entity);
        if (candidate !== null && candidate !== undefined) return candidate;
      }
    }
    return null;
  }
  return null;
}

/** Minimal csv.writer: quote fields containing [",\n\r] or always? Python csv
 * uses QUOTE_MINIMAL — quote only when needed; double internal quotes. */
function csvQuote(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(values: unknown[]): string {
  return values.map(csvQuote).join(",") + "\r\n";
}

class CsvWriter {
  constructor(private outf: { write(s: string): void }) {}
  writerow(row: unknown[]): void { this.outf.write(csvRow(row)); }
}

function _outf_writer(outfile: string, encoding: string | null, _errors: string, gzip_compress: boolean): [CsvWriter, { close(): void }] {
  const chunks: string[] = [];
  const outf = { write(s: string): void { chunks.push(s); },
    close(): void {
      const text = chunks.join("");
      if (gzip_compress) writeFileSync(outfile, gzipSync(new TextEncoder().encode(text)));
      else writeFileSync(outfile, text, (encoding ?? "utf8") as BufferEncoding);
    } };
  return [new CsvWriter(outf), outf];
}

/** nltk.twitter.common.json2csv — line-separated tweet JSON → CSV rows. */
export function json2csv(
  fp: Iterable<string> | string,
  outfile: string,
  fields: string[],
  encoding = "utf8",
  errors = "replace",
  gzip_compress = false,
): void {
  const [writer, outf] = _outf_writer(outfile, encoding, errors, gzip_compress);
  writer.writerow(fields);
  const lines = typeof fp === "string" ? fp.split("\n").filter((l) => l.length) : fp;
  for (const line of lines) {
    if (!line) continue;
    const tweet = JSON.parse(line);
    writer.writerow(extract_fields(tweet, fields));
  }
  outf.close();
}

/** nltk.twitter.common.get_header_field_list */
export function get_header_field_list(main_fields: string[], entity_type: string, entity_fields: string[]): string[] {
  let main_entity: string | null = null;
  let sub_entity: string;
  if (_is_composed_key(entity_type)) {
    const [key, value] = _get_key_value_composed(entity_type);
    main_entity = key;
    sub_entity = value;
  } else {
    sub_entity = entity_type;
  }
  const output1 = main_entity ? main_fields.map((x) => [main_entity, x].join(HIER_SEPARATOR)) : main_fields;
  const output2 = entity_fields.map((x) => [sub_entity, x].join(HIER_SEPARATOR));
  return [...output1, ...output2];
}

function _write_to_file(object_fields: unknown[], items: unknown, entity_fields: string[], writer: CsvWriter): void {
  if (!items || (typeof items === "object" && !Array.isArray(items) && Object.keys(items as object).length === 0)
    || (Array.isArray(items) && items.length === 0)) return;
  if (typeof items === "object" && !Array.isArray(items)) {
    const row = [...object_fields];
    const entity_field_values = entity_fields.filter((x) => !_is_composed_key(x));
    const entity_field_composed = entity_fields.filter(_is_composed_key);
    const dict = items as Record<string, unknown>;
    for (const field of entity_field_values) {
      const value = dict[field];
      if (Array.isArray(value)) row.push(...value);
      else row.push(value);
    }
    for (const d of entity_field_composed) {
      const [kd, vd] = _get_key_value_composed(d);
      const json_dict = dict[kd];
      if (typeof json_dict !== "object" || json_dict === null) {
        throw pyError("RuntimeError", `Key ${kd} does not contain a dictionary in the json file`);
      }
      row.push((json_dict as Record<string, unknown>)[vd]);
    }
    writer.writerow(row);
    return;
  }
  for (const item of items as Record<string, unknown>[]) {
    writer.writerow([...object_fields, ...extract_fields(item, entity_fields)]);
  }
}

/** nltk.twitter.common.json2csv_entities — one CSV row per entity. */
export function json2csv_entities(
  tweets_file: Iterable<string> | string,
  outfile: string,
  main_fields: string[],
  entity_type: string,
  entity_fields: string[],
  encoding = "utf8",
  errors = "replace",
  gzip_compress = false,
): void {
  const [writer, outf] = _outf_writer(outfile, encoding, errors, gzip_compress);
  const header = get_header_field_list(main_fields, entity_type, entity_fields);
  writer.writerow(header);
  const lines = typeof tweets_file === "string" ? tweets_file.split("\n").filter((l) => l.length) : tweets_file;
  for (const line of lines) {
    if (!line) continue;
    const tweet = JSON.parse(line);
    if (_is_composed_key(entity_type)) {
      const [key, value] = _get_key_value_composed(entity_type);
      const object_json = _get_entity_recursive(tweet, key);
      if (!object_json) continue;
      const object_fields = extract_fields(object_json as Record<string, unknown>, main_fields);
      const items = _get_entity_recursive(object_json, value);
      _write_to_file(object_fields, items, entity_fields, writer);
    } else {
      const tweet_fields = extract_fields(tweet, main_fields);
      const items = _get_entity_recursive(tweet, entity_type);
      _write_to_file(tweet_fields, items, entity_fields, writer);
    }
  }
  outf.close();
}