// NLTK langnames — lightweight JS port (subset)
// Original: nltk/langnames.py

const ISO639: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", ru: "Russian", ja: "Japanese", zh: "Chinese",
  ar: "Arabic", hi: "Hindi", ko: "Korean", pl: "Polish", tr: "Turkish",
  sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish", el: "Greek",
  cs: "Czech", hu: "Hungarian", ro: "Romanian", he: "Hebrew", th: "Thai",
  vi: "Vietnamese", id: "Indonesian", ms: "Malay", ca: "Catalan", uk: "Ukrainian",
  fy: "Western Frisian", fry: "Western Frisian",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(ISO639).map(([k,v]) => [v.toLowerCase(), k])
);

export const iso639short: Record<string,string> = {};
export const iso639retired: Record<string,string> = { fri: "Western Frisian" };

export function langname(tag: string | null, typ = "full", strict = false): string | null {
  if (tag === null) { if (strict) throw new Error("Could not find language name for tag null"); return null; }
  const code = tag.split("-")[0]?.toLowerCase() ?? "";
  if (code in iso639retired) return iso639retired[code] ?? null;
  const name = ISO639[code];
  if (name) return typ === "full" ? name : name;
  if (strict) throw new Error(`Could not find language name for tag '${tag}'`);
  return null;
}

export function langcode(name: string, _typ = 2, strict = false): string | null {
  const code = NAME_TO_CODE[name.toLowerCase()];
  if (code) return code;
  if (strict) throw new Error(`Could not find language code for name '${name}'`);
  return null;
}

export function tag2q(tag: string, strict = false): string | null { return langname(tag, "full", strict); }
export function q2tag(qcode: string, strict = false): string | null { return langcode(qcode, 2, strict); }
export function q2name(qcode: string, typ = "full", strict = false): string | null { return langname(qcode, typ, strict); }
export function lang2q(name: string, strict = false): string | null { return langcode(name, 2, strict); }
export function inverseDict<T extends Record<string,string>>(d: T): Record<string,string> {
  return Object.fromEntries(Object.entries(d).map(([k,v])=>[v,k]));
}
export const inverse_dict = inverseDict;
