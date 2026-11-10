// excluded-module closures differential vs pinned NLTK 3.10.3 oracle.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chat, reflections } from "../src/chat";
import {
  ToolboxData, ToolboxSettings, ToolboxElement,
  to_sfm_string, to_settings_string,
  remove_blanks, add_default_fields, sort_fields,
} from "../src/toolbox";
import {
  extract_fields, get_header_field_list, json2csv, json2csv_entities,
} from "../src/twitter_common";
import {
  Package, Collection, md5_hexdigest, sha256_hexdigest,
} from "../src/downloader";
import { add_py3_data, py3_data } from "../src/compat_port";

function oracle(): Record<string, any> {
  const res = spawnSync("python3", ["test/excluded_modules_oracle.py"], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

const o = oracle();
const tmp = mkdtempSync(join(tmpdir(), "excl-"));

const pairs: [string, string[]][] = [
  ["you are (.*)", ["Why do you think I am %1?"]],
  ["hello", ["Hi there."]],
];

describe("excluded modules vs NLTK 3.10.3 oracle", () => {
  test("Chat.respond substitution + no-match", () => {
    const c = new Chat(pairs, reflections, () => 0);
    expect(c.respond("you are sure")).toBe(o.chat.resp1);
    expect(c.respond("hello")).toBe(o.chat.resp2);
    expect(c.respond("zzz no match")).toBeUndefined();
    expect(c.respond("you are very nice and I am happy")).toBe(o.chat.reflSub);
  });

  test("Chat.converse scripted input", () => {
    const c = new Chat(pairs, reflections, () => 0);
    const lines: string[] = [];
    const inputs = ["you are mad!", "hello", "quit"];
    let i = 0;
    c.converse("quit", () => inputs[i++], (s) => lines.push(String(s)));
    // Python prints 'None' where JS prints 'undefined'.
    const expected = o.chat.converse.split("\n").filter((s: string) => s.length)
      .map((s: string) => (s === "None" ? "undefined" : s));
    expect(lines).toEqual(expected);
  });

  test("ToolboxData parse + to_sfm_string", () => {
    const SFM = "\\_sh v3.0  400  Rotokas\n\\lx kaa\n\\ps V.A\n\\ge gag\n\n\\lx kaa\n\\ps V.B\n\\ge strangle\n";
    const d = new ToolboxData();
    d.open_string(SFM);
    const p = d.parse();
    const recs = p.findall("record");
    expect(recs.length).toBe(o.toolbox.records);
    expect(recs[0]!.findall("lx")[0]!.text).toBe(o.toolbox.lx0);
    expect(p.find("header")!.find("_sh")!.text).toBe(o.toolbox.header_sh);
    expect(to_sfm_string(p)).toBe(o.toolbox.sfm);
    expect(recs.map((r) => r.children.map((c) => c.tag))).toEqual(o.toolbox.tags);
  });

  test("ToolboxSettings parse + to_settings_string", () => {
    const SET = "\\+mkrOverThis lx\n\\mkrOverThis lx\n\\+lngDefault English\n\\lngDefault English\n\\-lngDefault\n\\-mkrOverThis\n";
    const s = new ToolboxSettings();
    s.open_string(SET);
    const st = s.parse();
    const ser = (el: ToolboxElement): any => ({ tag: el.tag, text: el.text, kids: el.children.map(ser) });
    expect(ser(st)).toEqual(o.toolbox.settings_tree);
    expect(to_settings_string(st)).toBe(o.toolbox.settings_str);
  });

  test("toolbox helpers remove_blanks/add_default_fields/sort_fields", () => {
    const root = new ToolboxElement("record");
    root.append(new ToolboxElement("lx", "x"));
    root.append(new ToolboxElement("ge"));
    root.append(new ToolboxElement("ps", "n"));
    expect(root.children.map((c) => ({ tag: c.tag, text: c.text }))).toEqual(o.toolbox.before_rm);
    remove_blanks(root);
    expect(root.children.map((c) => ({ tag: c.tag, text: c.text }))).toEqual(o.toolbox.after_rm);
    const r2 = new ToolboxElement("record");
    r2.append(new ToolboxElement("ps", "n"));
    r2.append(new ToolboxElement("ge", "g"));
    add_default_fields(r2, { record: ["lx", "ps", "ge"] });
    expect(r2.children.map((c) => c.tag)).toEqual(o.toolbox.default_fields);
    const r3 = new ToolboxElement("record");
    for (const t of ["ge", "ps", "lx"]) r3.append(new ToolboxElement(t));
    sort_fields(r3, { record: ["lx", "ps", "ge"] });
    expect(r3.children.map((c) => c.tag)).toEqual(o.toolbox.sorted);
  });

  test("twitter extract_fields + headers + json2csv", () => {
    const tweet = { id: 1, text: "hello, world", user: { id: 9 }, entities: { hashtags: [{ text: "a" }, { text: "b" }] } };
    expect(extract_fields(tweet, ["id", "text", "user.id"])).toEqual(o.twitter.extract);
    expect(get_header_field_list(["id"], "hashtags", ["text"])).toEqual(o.twitter.header);
    expect(get_header_field_list(["id"], "user.urls", ["url"])).toEqual(o.twitter.header_composed);
    const jf = join(tmp, "t.csv");
    json2csv(
      ['{"id": 1, "text": "hello, world", "user": {"id": 9}}', '{"id": 2, "text": "t\\"q\\"", "user": {"id": 3}}'],
      jf, ["id", "text", "user.id"],
    );
    expect(readFileSync(jf, "utf8").replaceAll("\r\n", "\n")).toBe(o.twitter.csv);
    const j2 = join(tmp, "e.csv");
    json2csv_entities(['{"id": 1, "entities": {"hashtags": [{"text": "a"}, {"text": "b"}]}}'], j2, ["id"], "hashtags", ["text"]);
    expect(readFileSync(j2, "utf8").replaceAll("\r\n", "\n")).toBe(o.twitter.csv_ent);
  });

  test("downloader Package/Collection fromxml + hexdigests + validation", () => {
    const pkg = Package.fromxml('<package id="stopwords" url="https://x/stopwords.zip" subdir="corpora" size="100" unzipped_size="300" checksum="abc" unzip="1"/>');
    for (const [k, v] of Object.entries(o.dl.pkg as Record<string, unknown>)) {
      expect((pkg as any)[k]).toEqual(v);
    }
    expect(pkg.toString()).toBe(o.dl.repr);
    const col = Collection.fromxml('<collection id="all"><item ref="stopwords"/><item ref="punkt"/></collection>');
    expect(col.children).toEqual(o.dl.col.children);
    expect(col.toString()).toBe(o.dl.col.repr);
    const mf = join(tmp, "m.bin");
    writeFileSync(mf, Buffer.from("nltk"));
    expect(md5_hexdigest(mf)).toBe(o.dl.md5);
    expect(sha256_hexdigest(mf)).toBe(o.dl.sha256);
    expect(() => new Package({ id: "x", url: "u", subdir: "..", size: "1", unzipped_size: "1" })).toThrow();
    expect(() => new Package({ id: "a/b", url: "u", size: "1", unzipped_size: "1" })).toThrow();
  });

  test("compat py3_data/add_py3_data passthrough", () => {
    expect(add_py3_data("corpora/x.zip/foo")).toBe(o.compat.add_py3);
    expect(py3_data((a: string, b: string) => b)("p", "corpora/x.zip/foo")).toBe(o.compat.py3);
  });
});
