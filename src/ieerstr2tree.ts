// nltk.chunk.ieerstr2tree — IEER-style marked text → chunk tree.
// Faithful port of nltk/chunk/util.py's ieerstr2tree + _ieer_read_text.
import { SimpleTree, type SimpleTreeChild } from "./corpus_tree";
import { pyError } from "./internals";

// re.DOTALL: text spans lines.
const IEER_DOC_RE = /<DOC>\s*(?:<DOCNO>\s*(?<docno>.+?)\s*<\/DOCNO>\s*)?(?:<DOCTYPE>\s*(?<doctype>.+?)\s*<\/DOCTYPE>\s*)?(?:<DATE_TIME>\s*(?<date_time>.+?)\s*<\/DATE_TIME>\s*)?<BODY>\s*(?:<HEADLINE>\s*(?<headline>.+?)\s*<\/HEADLINE>\s*)?<TEXT>(?<text>.*?)<\/TEXT>\s*<\/BODY>\s*<\/DOC>\s*/s;
const IEER_TYPE_RE = /^<b_\w+\s+[^>]*?type="(?<type>\w+)"/;

export interface IeerTreeDict {
  text: SimpleTree | SimpleTreeChild[];
  docno: string | null;
  doctype: string | null;
  date_time: string | null;
  headline: SimpleTree | SimpleTreeChild[];
}

function ieerReadText(s: string | undefined, rootLabel: string): SimpleTree | SimpleTreeChild[] {
  const stack: SimpleTree[] = [new SimpleTree(rootLabel, [])];
  // s is undefined when there is no headline — python returns the empty
  // list in place of a Tree.
  if (s === undefined) return [];
  for (const m of s.matchAll(/<[^>]+>|[^\s<]+/g)) {
    const piece = m[0];
    let bad = false;
    if (piece.startsWith("<b_")) {
      const tm = IEER_TYPE_RE.exec(piece);
      if (tm === null) console.log("XXXX", piece);
      const chunk = new SimpleTree(tm!.groups!["type"]!, []);
      const top = stack[stack.length - 1];
      if (!top) bad = true;
      else { top.children.push(chunk); stack.push(chunk); }
    } else if (piece.startsWith("<e_")) {
      if (stack.length === 0) bad = true;
      else stack.pop();
    } else {
      const top = stack[stack.length - 1];
      if (!top) bad = true;
      else top.children.push(piece);
    }
    if (bad) throw pyError("ValueError", `Bad IEER string (error at character ${m.index})`);
  }
  if (stack.length !== 1) throw pyError("ValueError", "Bad IEER string");
  return stack[0]!;
}

/** nltk.chunk.ieerstr2tree — IEER marked string → Tree or doc dict. */
export function ieerstr2tree(s: string, _chunkTypes?: string[], rootLabel = "S"): SimpleTree | SimpleTreeChild[] | IeerTreeDict {
  const m = IEER_DOC_RE.exec(s);
  if (m && m.index === 0) {
    const g = m.groups!;
    return {
      text: ieerReadText(g["text"], rootLabel),
      docno: g["docno"] ?? null,
      doctype: g["doctype"] ?? null,
      date_time: g["date_time"] ?? null,
      headline: ieerReadText(g["headline"], rootLabel),
    };
  }
  return ieerReadText(s, rootLabel);
}
