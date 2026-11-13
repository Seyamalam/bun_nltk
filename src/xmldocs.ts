// Minimal xml.etree.ElementTree + ElementPath engine for XML corpus readers.
// Original: xml.etree.ElementTree (parse) + ElementPath (find/findall/findtext/
// iter subset), plus the regex tag-scanning constants from
// nltk/corpus/reader/xmldocs.py.
//
// Scope (the subset NLTK readers actually use):
//   paths: "tag", "a/b/c", ".", "./x", "*", ".//x", "x//y", "{ns}tag",
//          "p:tag" with an ns map, "tag[@attr]", "tag[@attr='v']",
//          "tag[@attr=\"v\"]", "tag[N]" (1-based position).
//   element API: tag/text/tail/attrib(Map)/children, iter(), getiterator(),
//          find/findall/findtext, get/set/keys/items/append, len -> child count.
//   parser: iterative (explicit stack); namespaces expand to {uri}local like
//          ElementTree; entities &amp; &lt; &gt; &quot; &apos; &#d; &#xH;;
//          comments, PIs, CDATA and DOCTYPE (incl. internal subset) handled.

import { pyError } from "./internals";

const XML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
};

/** Decode XML entity/character references. Unknown named entities raise
 * ParseError, matching ElementTree's "undefined entity" failure. */
export function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z_:][\w.:-]*);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isNaN(code)) throw pyError("ParseError", `invalid character reference ${whole}`);
      return String.fromCodePoint(code);
    }
    const v = XML_ENTITIES[body];
    if (v === undefined) throw pyError("ParseError", `undefined entity &${body};`);
    return v;
  });
}

/** ElementTree-style attribute map: preserves document order, ``in`` -> has. */
export type XmlAttrib = Map<string, string>;

export class XMLElement {
  tag: string;
  text: string | null;
  tail: string | null;
  attrib: XmlAttrib;
  children: XMLElement[];

  constructor(tag: string, attrib?: XmlAttrib | Record<string, string>) {
    this.tag = tag;
    this.text = null;
    this.tail = null;
    this.children = [];
    if (attrib instanceof Map) this.attrib = attrib;
    else this.attrib = new Map(Object.entries(attrib ?? {}));
  }

  /** Python ``len(elt)`` — number of subelements. */
  get length(): number {
    return this.children.length;
  }

  /** Python ``elt[i]`` — child by index (negative indexes allowed); or
   * ``elt.get(key, default)`` — attrib lookup. */
  get(i: number): XMLElement | undefined;
  get(key: string, deflt?: string | null): string | null;
  get(key: number | string, deflt: string | null = null): XMLElement | string | null | undefined {
    if (typeof key === "number") {
      const idx = key < 0 ? key + this.children.length : key;
      return this.children[idx];
    }
    return this.attrib.has(key) ? this.attrib.get(key)! : deflt;
  }

  *[Symbol.iterator](): Iterator<XMLElement> {
    yield* this.children;
  }

  append(child: XMLElement): void {
    this.children.push(child);
  }

  /** attrib[key] = value. */
  set(key: string, value: string): void {
    this.attrib.set(key, value);
  }

  keys(): string[] {
    return [...this.attrib.keys()];
  }

  items(): Array<[string, string]> {
    return [...this.attrib.entries()];
  }

  /** Element.iter(tag) — depth-first document order, self first. */
  *iter(tag?: string | null): Generator<XMLElement> {
    if (tag === undefined || tag === null || tag === "*" || this.tag === tag) yield this;
    for (const child of this.children) yield* child.iter(tag);
  }

  /** Deprecated alias kept for parity with Python <=3.8 API. */
  getiterator(tag?: string | null): XMLElement[] {
    return [...this.iter(tag)];
  }

  findall(path: string, ns?: Record<string, string> | null): XMLElement[] {
    return selectAll(this, compilePath(path, ns));
  }

  findAll(path: string, ns?: Record<string, string> | null): XMLElement[] {
    return this.findall(path, ns);
  }

  find(path: string, ns?: Record<string, string> | null): XMLElement | null {
    const out = selectAll(this, compilePath(path, ns));
    return out.length ? out[0]! : null;
  }

  /** Element.findtext — text of first match ("" if none), default if missing. */
  findtext(path: string, deflt?: string | null, ns?: Record<string, string> | null): string | null {
    const elt = this.find(path, ns);
    if (elt === null) return deflt ?? null;
    return elt.text ?? "";
  }

  findText(path: string, deflt?: string | null, ns?: Record<string, string> | null): string | null {
    return this.findtext(path, deflt, ns);
  }

  /** Shallow structural projection for debugging/serialization. */
  toJSON(): unknown {
    const out: Record<string, unknown> = { tag: this.tag };
    if (this.attrib.size) out.attrib = Object.fromEntries(this.attrib);
    if (this.text !== null) out.text = this.text;
    if (this.tail !== null) out.tail = this.tail;
    if (this.children.length) out.children = this.children;
    return out;
  }
}

// { ElementPath compiler/evaluator

interface PathStep {
  axis: "child" | "descendant" | "self" | "parent";
  tag: string;        // "*" matches all
  attr?: string;      // [@attr] presence test
  attrValue?: string; // [@attr='v'] value test
  position?: number;  // [n] 1-based position among matching siblings
}

function compilePath(path: string, ns?: Record<string, string> | null): PathStep[] {
  const resolveTag = (t: string): string => {
    if (t === "*") return t;
    if (t.startsWith("{")) return t;
    const m = /^([A-Za-z_][\w.-]*):(.+)$/.exec(t);
    if (m && ns && m[1]! in ns) return `{${ns[m[1]!]}}${m[2]}`;
    return t;
  };
  const steps: PathStep[] = [];
  // Split on "/" — but not inside {namespace} braces (URIs contain "/").
  const raw: string[] = [];
  {
    let cur = "";
    let depth = 0;
    for (const ch of path) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      if (ch === "/" && depth === 0) {
        raw.push(cur);
        cur = "";
      } else cur += ch;
    }
    raw.push(cur);
  }
  let descendantNext = false;
  for (const token of raw) {
    if (token === "") { descendantNext = true; continue; }
    let axis: PathStep["axis"] = descendantNext ? "descendant" : "child";
    descendantNext = false;
    if (token === ".") { steps.push({ axis: "self", tag: "*" }); continue; }
    if (token === "..") { steps.push({ axis: "parent", tag: "*" }); continue; }
    // tag + optional predicates
    const m = /^([^[]+)((?:\[[^\]]*\])*)$/.exec(token);
    const tagPart = m ? m[1]! : token;
    const predPart = m ? m[2]! : "";
    const step: PathStep = { axis, tag: resolveTag(tagPart === "." ? "*" : tagPart) };
    const preds = predPart.match(/\[([^\]]*)\]/g) ?? [];
    for (const p of preds) {
      const body = p.slice(1, -1);
      let pm = /^@([^=!'"]+)$/.exec(body);
      if (pm) { step.attr = pm[1]!; continue; }
      pm = /^@([^=!'"]+)\s*=\s*(['"])(.*?)\2$/.exec(body);
      if (pm) { step.attr = pm[1]!; step.attrValue = pm[3]!; continue; }
      pm = /^(\d+)$/.exec(body);
      if (pm) { step.position = parseInt(pm[1]!, 10); continue; }
      pm = /^(['"])(.*?)\1$/.exec(body);
      if (pm) { step.attr = "."; step.attrValue = pm[2]!; continue; }
      throw pyError("SyntaxError", `unsupported ElementPath predicate [${body}] in ${path}`);
    }
    steps.push(step);
  }
  return steps;
}

function* descendants(elt: XMLElement): Generator<XMLElement> {
  for (const child of elt.children) {
    yield child;
    yield* descendants(child);
  }
}

function stepMatches(elt: XMLElement, step: PathStep): boolean {
  if (step.tag !== "*" && elt.tag !== step.tag) return false;
  if (step.attr !== undefined) {
    if (step.attr === ".") {
      if (step.attrValue !== undefined && (elt.text ?? "") !== step.attrValue) return false;
    } else if (!elt.attrib.has(step.attr)) {
      return false;
    } else if (step.attrValue !== undefined && elt.attrib.get(step.attr) !== step.attrValue) {
      return false;
    }
  }
  return true;
}

function selectAll(context: XMLElement, steps: PathStep[]): XMLElement[] {
  let current: XMLElement[] = [context];
  for (const step of steps) {
    const next: XMLElement[] = [];
    for (const ctx of current) {
      if (step.axis === "self") {
        if (stepMatches(ctx, step)) next.push(ctx);
      } else if (step.axis === "parent") {
        // ElementPath '..' walks via implicit parents; our elements do not
        // retain parents, so '..' only matches where no candidates exist.
        // NLTK readers never use it — kept as an explicit failure.
        throw pyError("SyntaxError", "ElementPath '..' not supported");
      } else {
        const candidates = step.axis === "child"
          ? ctx.children : [...descendants(ctx)];
        const matched = candidates.filter((e) => stepMatches(e, step));
        if (step.position !== undefined) {
          const picked = matched[step.position - 1];
          if (picked !== undefined) next.push(picked);
        } else {
          next.push(...matched);
        }
      }
    }
    current = next;
  }
  return current;
}

// { Iterative XML parser

const NAME_RE = /^[^\s/>]+/;
const ATTR_RE = /([^\s=/>?]+)\s*(?:=\s*("[^"]*"|'[^']*'))?/g;

interface OpenFrame {
  elt: XMLElement;
  // namespace context: prefix -> uri ("" = default ns)
  ns: Map<string, string>;
}

function resolveName(qname: string, ns: Map<string, string>): string {
  const colon = qname.indexOf(":");
  if (colon >= 0) {
    const prefix = qname.slice(0, colon);
    const local = qname.slice(colon + 1);
    const uri = ns.get(prefix);
    if (uri === undefined) throw pyError("ParseError", `unbound prefix ${prefix} in <${qname}>`);
    return `{${uri}}${local}`;
  }
  const deflt = ns.get("");
  return deflt !== undefined ? `{${deflt}}${qname}` : qname;
}

const TOKEN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^[>]*(?:\[[^\]]*\][^[>]*)?>|<\?[\s\S]*?\?>|<\/[^>]+>|<[^>]+>|[^<]+|</g;

/** Iteratively parse an XML document/fragment into the first root element.
 * Follows ElementTree semantics: namespaces expand to ``{uri}local`` (default
 * ``xmlns`` applies to elements, not attributes), entity refs decode in text
 * and attribute values, comments/PIs/DOCTYPE are skipped, CDATA becomes text. */
export function parseXmlString(xml: string): XMLElement {
  const stack: OpenFrame[] = [];
  const rootNs = new Map<string, string>([["xml", "http://www.w3.org/XML/1998/namespace"], ["xmlns", "http://www.w3.org/2000/xmlns/"]]);
  let root: XMLElement | null = null;
  const top = (): OpenFrame | undefined => stack[stack.length - 1];

  const addText = (raw: string): void => {
    if (!raw) return;
    const frame = top();
    if (!frame) return; // text outside the root element is ignored
    const t = xmlUnescape(raw);
    const last = frame.elt.children[frame.elt.children.length - 1];
    if (last) last.tail = (last.tail ?? "") + t;
    else frame.elt.text = (frame.elt.text ?? "") + t;
  };

  const closeElement = (qname: string): void => {
    const frame = stack.pop();
    if (!frame) throw pyError("ParseError", `mismatched tag </${qname}>`);
    const expected = frame.elt.tag;
    const closing = resolveName(qname, frame.ns);
    if (closing !== expected) {
      throw pyError("ParseError", `mismatched tag: expected </${expected}> got </${qname}>`);
    }
    if (stack.length === 0 && root === null) root = frame.elt;
  };

  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(xml)) !== null) {
    const tok = m[0];
    if (tok === "<" ) {
      // Stray '<': the pattern's catch-all ensures no infinite loop.
      throw pyError("ParseError", "not well-formed (invalid token)");
    }
    if (tok.startsWith("<!--") || tok.startsWith("<?") || tok.startsWith("<!DOCTYPE")) {
      continue; // comments, PIs, doctype
    }
    if (tok.startsWith("<![CDATA[")) {
      addText(tok.slice(9, -3));
      continue;
    }
    if (tok.startsWith("</")) {
      const qname = tok.slice(2, -1).trim();
      closeElement(qname);
      continue;
    }
    if (!tok.startsWith("<")) {
      // character data: element .text (before first child) or last child's .tail
      addText(tok);
      continue;
    }
    // start tag or empty-element tag
    let inner = tok.slice(1, -1);
    const selfClose = /\/\s*$/.test(inner);
    if (selfClose) inner = inner.replace(/\/\s*$/, "");
    const nameMatch = NAME_RE.exec(inner);
    if (!nameMatch) throw pyError("ParseError", `not well-formed: ${tok}`);
    const qname = nameMatch[0];
    // fresh ns context = parent's + this tag's xmlns* attrs
    const parentNs = top() ? top()!.ns : rootNs;
    const ns = new Map(parentNs);
    const attrSrc = inner.slice(nameMatch[0].length);
    const attrPairs: Array<[string, string]> = [];
    ATTR_RE.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = ATTR_RE.exec(attrSrc)) !== null) {
      if (am.index > 0 && /[^\s]/.test(attrSrc.slice(0, am.index)) === false && am[1] === undefined) break;
      const aname = am[1]!;
      if (!aname) break;
      const rawv = am[2];
      const value = rawv === undefined ? "" : xmlUnescape(rawv.slice(1, -1));
      attrPairs.push([aname, value]);
    }
    // apply xmlns declarations before resolving element/attr names
    for (const [aname, value] of attrPairs) {
      if (aname === "xmlns") ns.set("", value);
      else if (aname.startsWith("xmlns:")) ns.set(aname.slice(6), value);
    }
    const elt = new XMLElement(resolveName(qname, ns));
    for (const [aname, value] of attrPairs) {
      if (aname === "xmlns" || aname.startsWith("xmlns:")) {
        // ElementTree keeps xmlns declarations out of attrib? It does NOT:
        // xmlns* attributes are consumed by the parser and absent from attrib.
        continue;
      }
      elt.attrib.set(resolveName(aname, aname.includes(":") ? ns : withoutDefault(ns)), value);
    }
    const frame = top();
    if (frame) {
      frame.elt.append(elt);
      if (!selfClose) stack.push({ elt, ns });
      else if (stack.length === 0 && root === null) root = elt;
    } else {
      if (!selfClose) stack.push({ elt, ns });
      else if (root === null) root = elt;
    }
    if (root !== null && stack.length === 0 && !selfClose) {
      // document fully closed; keep scanning so trailing junk still parses
      // harmlessly like ElementTree (it errors, but readers never produce it)
    }
  }
  if (stack.length !== 0) {
    throw pyError("ParseError", `unclosed token: <${top()!.elt.tag}>`);
  }
  if (root === null) throw pyError("ParseError", "no element found");
  return root;
}

function withoutDefault(ns: Map<string, string>): Map<string, string> {
  const copy = new Map(ns);
  copy.delete("");
  return copy;
}

/** Parse XML from a readable text stream (SeekableUnicodeStreamReader-like). */
export function parseXmlStream(stream: { read(size?: number): string }): XMLElement {
  return parseXmlString(stream.read());
}
