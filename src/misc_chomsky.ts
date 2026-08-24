/**
 * Port of nltk.misc.chomsky — Chomsky random text generator.
 * Faithful port of leadins/subjects/verbs/objects and generate_chomsky.
 * Uses Math.random shuffle; wrapping via simple greedy fill to lineLength.
 */

export const leadins = `To characterize a linguistic level L,
    On the other hand,
    This suggests that
    It appears that
    Furthermore,
    We will bring evidence in favor of the following thesis:
    To provide a constituent structure for T(Z,K),
    From C1, it follows that
    For any transformation which is sufficiently diversified in application to be of any interest,
    Analogously,
    Clearly,
    Note that
    Of course,
    Suppose, for instance, that
    Thus
    With this clarification,
    Conversely,
    We have already seen that
    By combining adjunctions and certain deformations,
    I suggested that these results would follow from the assumption that
    If the position of the trace in (99c) were only relatively inaccessible to movement,
    However, this assumption is not correct, since
    Comparing these examples with their parasitic gap counterparts in (96) and (97), we see that
    In the discussion of resumptive pronouns following (81),
    So far,
    Nevertheless,
    For one thing,
    Summarizing, then, we assume that
    A consequence of the approach just outlined is that
    Presumably,
    On our assumptions,
    It may be, then, that
    It must be emphasized, once again, that
    Let us continue to suppose that
    Notice, incidentally, that`;

export const subjects = ` the notion of level of grammaticalness
    a case of semigrammaticalness of a different sort
    most of the methodological work in modern linguistics
    a subset of English sentences interesting on quite independent grounds
    the natural general principle that will subsume this case
    an important property of these three types of EC
    any associated supporting element
    the appearance of parasitic gaps in domains relatively inaccessible to ordinary extraction
    the speaker-hearer's linguistic intuition
    the descriptive power of the base component
    the earlier discussion of deviance
    this analysis of a formative as a pair of sets of features
    this selectionally introduced contextual feature
    a descriptively adequate grammar
    the fundamental error of regarding functional notions as categorial
    relational information
    the systematic use of complex symbols
    the theory of syntactic features developed earlier`;

export const verbs = `can be defined in such a way as to impose
    delimits
    suffices to account for
    cannot be arbitrary in
    is not subject to
    does not readily tolerate
    raises serious doubts about
    is not quite equivalent to
    does not affect the structure of
    may remedy and, at the same time, eliminate
    is not to be considered in determining
    is to be regarded as
    is unspecified with respect to
    is, apparently, determined by
    is necessary to impose an interpretation on
    appears to correlate rather closely with
    is rather different from`;

export const objects = ` problems of phonemic and morphological analysis.
    a corpus of utterance tokens upon which conformity has been defined by the paired utterance test.
    the traditional practice of grammarians.
    the levels of acceptability from fairly high (e.g. (99a)) to virtual gibberish (e.g. (98d)).
    a stipulation to place the constructions into these various categories.
    a descriptive fact.
    a parasitic gap construction.
    the extended c-command discussed in connection with (34).
    the ultimate standard that determines the accuracy of any proposed grammar.
    the system of base rules exclusive of the lexicon.
    irrelevant intervening contexts in selectional rules.
    nondistinctness in the sense of distinctive feature theory.
    a general convention regarding the forms of the grammar.
    an abstract underlying order.
    an important distinction in language use.
    the requirement that branching is not tolerated within the dominance scope of a complex symbol.
    the strong generative capacity of the theory.`;

const _rawObjects = objects;

function splitAndTrim(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter((x) => x.length > 0).map((x) => x.replace(/\\\s*/g, " ").replace(/\s+/g, " ").trim());
}

// Use raw strings split correctly (handles backslash continuations)
function parseList(s: string): string[] {
  // Join backslash-newline continuations first
  const normalized = s.replace(/\\\n\s*/g, " ");
  return normalized.split("\n").map((l) => l.trim()).filter(Boolean);
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
}

function textwrapFill(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

export function generateChomsky(times = 5, lineLength = 72): string {
  const parts: string[][] = [];
  for (const part of [leadins, subjects, verbs, _rawObjects]) {
    const phrases = parseList(part);
    shuffleInPlace(phrases);
    parts.push(phrases);
  }
  const n = Math.min(times, Math.min(...parts.map((p) => p.length)));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    for (const p of parts) out.push(p[i]!);
  }
  return textwrapFill(out.join(" "), lineLength);
}

/** Alias matching Python name. */
export const generate_chomsky = generateChomsky;

// keep splitAndTrim exported for testing (not part of NLTK API)
export const _internal = { splitAndTrim, parseList, textwrapFill };
