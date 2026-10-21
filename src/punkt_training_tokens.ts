/** Existing TypeScript training tokenizer; training has not migrated to Rust. */
import {
  PYTHON_SPACE as space,
  PYTHON_NONSPACE as nonspace,
  trimPythonEnd,
  pythonIsUpper,
  pythonIsLower,
} from "./python_text";

const nonword = String.raw`[)";}\]*:@'({\[‘’“”«»?!]`;
const multi = String.raw`(?:-{2,}|\.{2,}|(?:\.${space}){2,}\.)`;
const wordstart = String.raw`[^\("\x60{\[:;&#*@)}\]\-,]`;
const wordPattern = new RegExp(
  `${multi}|(?=${wordstart})${nonspace}+?(?=${space}|$|${nonword}|${multi}|,(?=$|${space}|${nonword}|${multi}))|${nonspace}`,
  "gu",
);

export class PunktToken {
  type: string;
  sentbreak = false;
  abbr = false;
  ellipsis = false;
  constructor(public tok: string, public parastart = false, public linestart = false) {
    this.type = /^-?[.,]?\p{Nd}[\p{Nd},.-]*\.?$/u.test(tok) ? "##number##" : tok.toLowerCase();
  }
  get noPeriod() {
    return this.type.length > 1 && this.type.endsWith(".") ? this.type.slice(0, -1) : this.type;
  }
  get noSentPeriod() { return this.sentbreak ? this.noPeriod : this.type; }
  get upper() { return pythonIsUpper(Array.from(this.tok)[0]!); }
  get lower() { return pythonIsLower(Array.from(this.tok)[0]!); }
  get initial() { return /^(?!\p{Nd})[\p{L}\p{N}_]\.$/u.test(this.tok); }
}

export function punktWords(text: string): PunktToken[] {
  const tokens: PunktToken[] = [];
  let para = false;
  for (const line of text.split("\n")) {
    if (!trimPythonEnd(line)) { para = true; continue; }
    const words = line.match(wordPattern) ?? [];
    words.forEach((word, i) => tokens.push(new PunktToken(word, i === 0 && para, i === 0)));
    if (words.length) para = false;
  }
  return tokens;
}

export function firstPass(tokens: PunktToken[], abbreviations: Set<string>) {
  for (const t of tokens) {
    if ([".", "?", "!"].includes(t.tok)) t.sentbreak = true;
    else if (/^\.{2,}$/.test(t.tok)) t.ellipsis = true;
    else if (t.tok.endsWith(".") && !t.tok.endsWith("..")) {
      const base = t.tok.slice(0, -1).toLowerCase();
      if (abbreviations.has(base) || abbreviations.has(base.split("-").at(-1)!)) t.abbr = true;
      else t.sentbreak = true;
    }
  }
}
