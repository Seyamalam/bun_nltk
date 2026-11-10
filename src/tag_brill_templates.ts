/**
 * Ports of the template-set factories in nltk.tag.brill:
 * nltkdemo18, nltkdemo18plus, fntbl37, brill24, describe_template_sets.
 */
import { Pos, Template, Word } from "./brill_tagger";

/**
 * Return 18 templates, from the original nltk demo, in multi-feature syntax.
 */
export function nltkdemo18(): Template[] {
  return [
    new Template(new Pos([-1])),
    new Template(new Pos([1])),
    new Template(new Pos([-2])),
    new Template(new Pos([2])),
    new Template(new Pos([-2, -1])),
    new Template(new Pos([1, 2])),
    new Template(new Pos([-3, -2, -1])),
    new Template(new Pos([1, 2, 3])),
    new Template(new Pos([-1]), new Pos([1])),
    new Template(new Word([-1])),
    new Template(new Word([1])),
    new Template(new Word([-2])),
    new Template(new Word([2])),
    new Template(new Word([-2, -1])),
    new Template(new Word([1, 2])),
    new Template(new Word([-3, -2, -1])),
    new Template(new Word([1, 2, 3])),
    new Template(new Word([-1]), new Word([1])),
  ];
}

/**
 * Return 18 templates, from the original nltk demo, and additionally a few
 * multi-feature ones (the motivation is easy comparison with nltkdemo18).
 */
export function nltkdemo18plus(): Template[] {
  return [
    ...nltkdemo18(),
    new Template(new Word([-1]), new Pos([1])),
    new Template(new Pos([-1]), new Word([1])),
    new Template(new Word([-1]), new Word([0]), new Pos([1])),
    new Template(new Pos([-1]), new Word([0]), new Word([1])),
    new Template(new Pos([-1]), new Word([0]), new Pos([1])),
  ];
}

/**
 * Return 37 templates taken from the postagging task of the
 * fntbl distribution https://www.cs.jhu.edu/~rflorian/fntbl/
 * (37 is after excluding a handful which do not condition on Pos[0];
 * fntbl can do that but the current nltk implementation cannot.)
 */
export function fntbl37(): Template[] {
  return [
    new Template(new Word([0]), new Word([1]), new Word([2])),
    new Template(new Word([-1]), new Word([0]), new Word([1])),
    new Template(new Word([0]), new Word([-1])),
    new Template(new Word([0]), new Word([1])),
    new Template(new Word([0]), new Word([2])),
    new Template(new Word([0]), new Word([-2])),
    new Template(new Word([1, 2])),
    new Template(new Word([-2, -1])),
    new Template(new Word([1, 2, 3])),
    new Template(new Word([-3, -2, -1])),
    new Template(new Word([0]), new Pos([2])),
    new Template(new Word([0]), new Pos([-2])),
    new Template(new Word([0]), new Pos([1])),
    new Template(new Word([0]), new Pos([-1])),
    new Template(new Word([0])),
    new Template(new Word([-2])),
    new Template(new Word([2])),
    new Template(new Word([1])),
    new Template(new Word([-1])),
    new Template(new Pos([-1]), new Pos([1])),
    new Template(new Pos([1]), new Pos([2])),
    new Template(new Pos([-1]), new Pos([-2])),
    new Template(new Pos([1])),
    new Template(new Pos([-1])),
    new Template(new Pos([-2])),
    new Template(new Pos([2])),
    new Template(new Pos([1, 2, 3])),
    new Template(new Pos([1, 2])),
    new Template(new Pos([-3, -2, -1])),
    new Template(new Pos([-2, -1])),
    new Template(new Pos([1]), new Word([0]), new Word([1])),
    new Template(new Pos([1]), new Word([0]), new Word([-1])),
    new Template(new Pos([-1]), new Word([-1]), new Word([0])),
    new Template(new Pos([-1]), new Word([0]), new Word([1])),
    new Template(new Pos([-2]), new Pos([-1])),
    new Template(new Pos([1]), new Pos([2])),
    new Template(new Pos([1]), new Pos([2]), new Word([1])),
  ];
}

/**
 * Return 24 templates of the seminal TBL paper, Brill (1995).
 */
export function brill24(): Template[] {
  return [
    new Template(new Pos([-1])),
    new Template(new Pos([1])),
    new Template(new Pos([-2])),
    new Template(new Pos([2])),
    new Template(new Pos([-2, -1])),
    new Template(new Pos([1, 2])),
    new Template(new Pos([-3, -2, -1])),
    new Template(new Pos([1, 2, 3])),
    new Template(new Pos([-1]), new Pos([1])),
    new Template(new Pos([-2]), new Pos([-1])),
    new Template(new Pos([1]), new Pos([2])),
    new Template(new Word([-1])),
    new Template(new Word([1])),
    new Template(new Word([-2])),
    new Template(new Word([2])),
    new Template(new Word([-2, -1])),
    new Template(new Word([1, 2])),
    new Template(new Word([-1, 0])),
    new Template(new Word([0, 1])),
    new Template(new Word([0])),
    new Template(new Word([-1]), new Pos([-1])),
    new Template(new Word([1]), new Pos([1])),
    new Template(new Word([0]), new Word([-1]), new Pos([-1])),
    new Template(new Word([0]), new Word([1]), new Pos([1])),
  ];
}

// Raw __doc__ strings as Python 3.14 dedents them (leading newline, no
// continuation indent, trailing newline) — inspect.getmembers order is
// alphabetical: brill24, fntbl37, nltkdemo18, nltkdemo18plus.
const TEMPLATE_SET_DOCS: ReadonlyArray<readonly [string, string]> = [
  ["brill24", "\nReturn 24 templates of the seminal TBL paper, Brill (1995)\n"],
  [
    "fntbl37",
    "\nReturn 37 templates taken from the postagging task of the\nfntbl distribution https://www.cs.jhu.edu/~rflorian/fntbl/\n(37 is after excluding a handful which do not condition on Pos[0];\nfntbl can do that but the current nltk implementation cannot.)\n",
  ],
  ["nltkdemo18", "\nReturn 18 templates, from the original nltk demo, in multi-feature syntax\n"],
  [
    "nltkdemo18plus",
    "\nReturn 18 templates, from the original nltk demo, and additionally a few\nmulti-feature ones (the motivation is easy comparison with nltkdemo18)\n",
  ],
];

/**
 * Print the available template sets in this demo, with a short description.
 * NLTK enumerates the module functions via inspect (`print(name, obj.__doc__,
 * "\n")`); the port pins the same four entries in alphabetical order, each
 * emitted chunk ending in ` \n\n` exactly as print() produces.
 */
export function describe_template_sets(out: (chunk: string) => void = (c) => process.stdout.write(c)): void {
  for (const [name, doc] of TEMPLATE_SET_DOCS) {
    out(`${name} ${doc} \n\n`);
  }
}
export const describeTemplateSets = describe_template_sets;
