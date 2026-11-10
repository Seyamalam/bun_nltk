import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WordNet, WordNetSynset, WordNetPos } from "./wordnet.ts";

export class WordNetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WordNetError";
  }
}

/** `{n|v: {0: rootCount, offset: count}}` as returned by `WordNetICCorpusReader.ic`. */
export type WordNetIcDict = Record<string, Record<number, number>>;

/** NLTK `Lemma` — a specific morphological sense of a word inside a synset. */
export class Lemma {
  constructor(
    private readonly reader: WordNetReader,
    private readonly _synset: Synset,
    private readonly _name: string,
    private readonly _senseKey: string,
  ) {}

  name(): string {
    return this._name;
  }

  synset(): Synset {
    return this._synset;
  }

  key(): string {
    return this._senseKey;
  }

  lang(): string {
    return "eng";
  }

  count(): number {
    return 0;
  }

  antonyms(): Lemma[] {
    const row = this._synset.row;
    return row.antonyms
      .map((id) => this.reader.synset(id))
      .filter((s): s is Synset => s !== null)
      .flatMap((s) => s.lemmas())
      .filter((l) => l.name() !== this._name);
  }

  derivationally_related_forms(): Lemma[] {
    return [];
  }

  pertainyms(): Lemma[] {
    return [];
  }

  frame_ids(): number[] {
    return this._synset.frame_ids();
  }

  frame_strings(): string[] {
    return this._synset.frame_strings();
  }

  syntactic_marker(): null {
    return null;
  }

  hypernyms(): Synset[] { return this._synset.hypernyms(); }
  instance_hypernyms(): Synset[] { return this._synset.instance_hypernyms(); }
  hyponyms(): Synset[] { return this._synset.hyponyms(); }
  instance_hyponyms(): Synset[] { return this._synset.instance_hyponyms(); }
  member_holonyms(): Synset[] { return this._synset.member_holonyms(); }
  substance_holonyms(): Synset[] { return this._synset.substance_holonyms(); }
  part_holonyms(): Synset[] { return this._synset.part_holonyms(); }
  member_meronyms(): Synset[] { return this._synset.member_meronyms(); }
  substance_meronyms(): Synset[] { return this._synset.substance_meronyms(); }
  part_meronyms(): Synset[] { return this._synset.part_meronyms(); }
  topic_domains(): Synset[] { return this._synset.topic_domains(); }
  usage_domains(): Synset[] { return this._synset.usage_domains(); }
  region_domains(): Synset[] { return this._synset.region_domains(); }
  in_topic_domains(): Synset[] { return this._synset.in_topic_domains(); }
  in_usage_domains(): Synset[] { return this._synset.in_usage_domains(); }
  in_region_domains(): Synset[] { return this._synset.in_region_domains(); }
  similar_tos(): Synset[] { return this._synset.similar_tos(); }
  also_sees(): Synset[] { return this._synset.also_sees(); }
  verb_groups(): Synset[] { return this._synset.verb_groups(); }
  attributes(): Synset[] { return this._synset.attributes(); }
  entailments(): Synset[] { return this._synset.entailments(); }
  causes(): Synset[] { return this._synset.causes(); }

  equals(other: Lemma): boolean {
    return this._name === other._name && this._synset.equals(other._synset);
  }

  toString(): string {
    return `Lemma('${this._synset.name()}.${this._name}')`;
  }
}

export class Synset {
  protected _name: string | null = null;

  constructor(
    private readonly reader: WordNetReader,
    readonly row: WordNetSynset,
  ) {}

  name(): string {
    if (this._name === null) this._name = `${this.row.lemmas[0]}.${this.row.pos}.${String(this.reader.senseNumber(this)).padStart(2, "0")}`;
    return this._name;
  }

  pos(): string {
    return this.row.pos;
  }

  offset(): number {
    return Number.parseInt(this.row.id.slice(0, 8), 10);
  }

  lexname(): string {
    return this.reader.lexname(this);
  }

  definition(): string {
    return this.row.gloss;
  }

  examples(): string[] {
    return [...this.row.examples];
  }

  lemma_names(): string[] {
    return [...this.row.lemmas];
  }

  lemmas(): Lemma[] {
    return this.row.lemmas.map((name) => this.reader.lemma(this, name));
  }

  private related(field: "hypernyms" | "hyponyms" | "similarTo" | "antonyms"): Synset[] {
    return this.reader.synsetsByIds(this.row[field]);
  }

  hypernyms(): Synset[] { return this.related("hypernyms"); }
  instance_hypernyms(): Synset[] { return []; }
  hyponyms(): Synset[] { return this.related("hyponyms"); }
  instance_hyponyms(): Synset[] { return []; }
  member_holonyms(): Synset[] { return []; }
  substance_holonyms(): Synset[] { return []; }
  part_holonyms(): Synset[] { return []; }
  member_meronyms(): Synset[] { return []; }
  substance_meronyms(): Synset[] { return []; }
  part_meronyms(): Synset[] { return []; }
  topic_domains(): Synset[] { return []; }
  in_topic_domains(): Synset[] { return []; }
  usage_domains(): Synset[] { return []; }
  in_usage_domains(): Synset[] { return []; }
  region_domains(): Synset[] { return []; }
  in_region_domains(): Synset[] { return []; }
  similar_tos(): Synset[] { return this.related("similarTo"); }
  also_sees(): Synset[] { return []; }
  verb_groups(): Synset[] { return []; }
  attributes(): Synset[] { return []; }
  entailments(): Synset[] { return []; }
  causes(): Synset[] { return []; }
  frame_ids(): number[] { return []; }
  frame_strings(): string[] { return []; }

  closure<T>(rel: (s: Synset) => Iterable<T>, depth = -1): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    const walk = (s: Synset, d: number): void => {
      if (depth >= 0 && d > depth) return;
      for (const t of rel(s)) {
        const item = t as unknown as { name?: () => string };
        const key = typeof item?.name === "function" ? item.name() : JSON.stringify(t);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
        if (t instanceof Synset) walk(t, d + 1);
      }
    };
    walk(this, 0);
    return out;
  }

  hypernym_paths(): Synset[][] {
    const paths: Synset[][] = [];
    for (const hypernym of this.hypernyms()) {
      for (const path of hypernym.hypernym_paths()) paths.push([...path, this]);
    }
    if (paths.length === 0) paths.push([this]);
    return paths;
  }

  root_hypernyms(): Synset[] {
    const out: Synset[] = [];
    const hypers = this.hypernyms();
    if (hypers.length === 0 || hypers.some((h) => h.equals(this))) return [this];
    for (const hypernym of hypers) out.push(...hypernym.root_hypernyms());
    return dedupe(out);
  }

  common_hypernyms(other: Synset): Synset[] {
    const mine = new Set([this, ...this.closure((s) => s.hypernyms())].map((s) => s.name()));
    return [other, ...other.closure((s) => s.hypernyms())].filter((s) => mine.has(s.name()));
  }

  lowest_common_hypernyms(other: Synset, simulateRoot = false, useMinDepth = false): Synset[] {
    const synsets = this.common_hypernyms(other);
    if (simulateRoot) synsets.push(new FakeRootSynset(this.reader));
    if (synsets.length === 0) return [];
    const depthOf = (s: Synset) => (useMinDepth ? s.min_depth() : s.max_depth());
    const maxDepth = Math.max(...synsets.map(depthOf));
    return synsets
      .filter((s) => depthOf(s) === maxDepth)
      .sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0));
  }

  hypernymDistances(distance = 0): Array<[Synset, number]> {
    const out: Array<[Synset, number]> = [[this, distance]];
    const seen = new Map([[this.name(), distance]]);
    const queue: Synset[] = [this];
    while (queue.length) {
      const s = queue.shift()!;
      const d = seen.get(s.name())!;
      for (const h of s.hypernyms()) {
        if (!seen.has(h.name())) {
          seen.set(h.name(), d + 1);
          out.push([h, d + 1]);
          queue.push(h);
        }
      }
    }
    return out;
  }

  hypernym_distances(distance = 0, simulateRoot = false): Set<[Synset, number]> {
    const seen = new Map<string, [Synset, number]>();
    const visit = (s: Synset, d: number): void => {
      const key = `${s.name()}|${d}`;
      if (seen.has(key)) return;
      seen.set(key, [s, d]);
      for (const hypernym of s.hypernyms()) visit(hypernym, d + 1);
    };
    visit(this, distance);
    if (simulateRoot) {
      const fakeDist = Math.max(...[...seen.values()].map(([, d]) => d)) + 1;
      seen.set(`*ROOT*|${fakeDist}`, [new FakeRootSynset(this.reader), fakeDist]);
    }
    return new Set(seen.values());
  }

  max_depth(): number {
    return this.reader.depthOf(this, "max");
  }

  min_depth(): number {
    return this.reader.depthOf(this, "min");
  }

  shortest_path_distance(other: Synset, simulateRoot = false): number | null {
    if (this.pos() !== other.pos() && !simulateRoot) return null;
    if (this.equals(other)) return 0;
    const selfDist = this._distanceMap(simulateRoot);
    const otherDist = other._distanceMap(simulateRoot);
    let best = Number.POSITIVE_INFINITY;
    for (const [name, d1] of selfDist) {
      const d2 = otherDist.get(name);
      if (d2 !== undefined) best = Math.min(best, d1 + d2);
    }
    return best === Number.POSITIVE_INFINITY ? null : best;
  }

  private _distanceMap(simulateRoot: boolean): Map<string, number> {
    const distances = new Map<string, number>();
    for (const [s, d] of this.hypernymDistances()) distances.set(s.name(), d);
    if (simulateRoot && this.name() !== "*ROOT*") {
      distances.set("*ROOT*", Math.max(...distances.values()) + 1);
    }
    return distances;
  }

  private _shortestHypernymPath(other: Synset): Set<Synset> {
    const path = new Set<Synset>([this]);
    if (this.equals(other)) return path;
    let queue: Synset[] = [this];
    const cameFrom = new Map<string, Synset>();
    while (queue.length) {
      const next: Synset[] = [];
      for (const s of queue) {
        for (const h of s.hypernyms()) {
          if (cameFrom.has(h.name())) continue;
          cameFrom.set(h.name(), s);
          if (h.equals(other)) {
            let cur: Synset | undefined = h;
            while (cur) {
              path.add(cur);
              cur = cameFrom.get(cur.name());
            }
            return path;
          }
          next.push(h);
        }
      }
      queue = next;
    }
    return path;
  }

  path_similarity(other: Synset, _verbose = false, simulateRoot = true): number | null {
    const dist = this.shortest_path_distance(other, simulateRoot);
    if (dist === null || dist < 0) return null;
    return 1 / (dist + 1);
  }

  lch_similarity(other: Synset, _verbose = false, simulateRoot = true): number | null {
    if (this.pos() !== other.pos()) {
      throw new WordNetError(`Computing the lch similarity requires ${this} and ${other} to have the same part of speech.`);
    }
    const needRoot = this.needsRoot();
    const depth = this.reader.maxDepth(this.pos() as WordNetPos) + (needRoot ? 1 : 0);
    const distance = this.shortest_path_distance(other, simulateRoot && needRoot);
    if (distance === null || distance < 0 || depth === 0) return null;
    return -Math.log((distance + 1) / (2.0 * depth));
  }

  wup_similarity(other: Synset, _verbose = false, simulateRoot = true): number | null {
    const needRoot = this.needsRoot() || other.needsRoot();
    const subsumers = this.lowest_common_hypernyms(other, simulateRoot && needRoot, true);
    if (subsumers.length === 0) return null;
    const subsumer = subsumers.some((s) => s.equals(this)) ? this : subsumers[0]!;
    const depth = subsumer.max_depth() + 1;
    let len1 = this.shortest_path_distance(subsumer, simulateRoot && needRoot);
    let len2 = other.shortest_path_distance(subsumer, simulateRoot && needRoot);
    if (len1 === null || len2 === null) return null;
    len1 += depth;
    len2 += depth;
    return (2.0 * depth) / (len1 + len2);
  }

  private needsRoot(): boolean {
    return this.pos() !== "n";
  }

  res_similarity(other: Synset, ic: WordNetIcDict, verbose = false): number {
    return lcsIc(this, other, ic, verbose)[2];
  }
  jcn_similarity(other: Synset, ic: WordNetIcDict, verbose = false): number {
    if (this.equals(other)) return IC_INF;
    const [ic1, ic2, lcs] = lcsIc(this, other, ic, verbose);
    if (ic1 === 0 || ic2 === 0) return 0;
    const icDifference = ic1 + ic2 - 2 * lcs;
    return icDifference === 0 ? IC_INF : 1 / icDifference;
  }
  lin_similarity(other: Synset, ic: WordNetIcDict, verbose = false): number {
    const [ic1, ic2, lcs] = lcsIc(this, other, ic, verbose);
    return (2.0 * lcs) / (ic1 + ic2);
  }

  tree(rel: (s: Synset) => Synset[] = (s) => s.hyponyms(), cutmark?: number): unknown {
    const kids = rel(this);
    if (kids.length === 0) return this.name();
    return [this.name(), kids.map((k) => k.tree(rel, cutmark))];
  }

  equals(other: Synset): boolean {
    return this.row.id === other.row.id;
  }

  lt(other: Synset): boolean {
    return this.name() < other.name();
  }

  toString(): string {
    return `Synset('${this.name()}')`;
  }
}

function dedupe(synsets: Synset[]): Synset[] {
  const seen = new Set<string>();
  return synsets.filter((s) => (seen.has(s.name()) ? false : (seen.add(s.name()), true)));
}

const LEXFILE_NAMES: Record<string, string> = {
  "00": "adj.all", "01": "adj.pert", "02": "adv.all",
  "03": "noun.Tops", "04": "noun.act", "05": "noun.animal", "06": "noun.artifact",
  "07": "noun.attribute", "08": "noun.body", "09": "noun.cognition",
  "10": "noun.communication", "11": "noun.event", "12": "noun.feeling",
  "13": "noun.food", "14": "noun.group", "15": "noun.location", "16": "noun.motive",
  "17": "noun.object", "18": "noun.person", "19": "noun.phenomenon",
  "20": "noun.plant", "21": "noun.possession", "22": "noun.process",
  "23": "noun.quantity", "24": "noun.relation", "25": "noun.shape",
  "26": "noun.state", "27": "noun.substance", "28": "noun.time",
  "29": "verb.body", "30": "verb.change", "31": "verb.cognition",
  "32": "verb.communication", "33": "verb.competition", "34": "verb.consumption",
  "35": "verb.contact", "36": "verb.creation", "37": "verb.emotion",
  "38": "verb.motion", "39": "verb.perception", "40": "verb.possession",
  "41": "verb.social", "42": "verb.stative", "43": "verb.weather",
  "44": "verb.ppl", "45": "adj.all",
};

// Lexfile->offset ranges derived from the official data.{noun,verb,adj,adv} files.
const LEXFILE_RANGES: Array<[number, number, string]> = [
  [1740, 34213, "03"], [34479, 1312096, "04"], [1313093, 2665812, "05"],
  [2665985, 4615728, "06"], [4615866, 5216240, "07"], [5216365, 5611221, "08"],
  [5611302, 6251553, "09"], [6251781, 7283198, "10"], [7283364, 7479799, "11"],
  [7479926, 7555775, "12"], [7555863, 7938594, "13"], [7938773, 8489392, "14"],
  [8489497, 9178596, "15"], [9178727, 9185865, "16"], [9186064, 9483519, "17"],
  [9483738, 11408414, "18"], [11408559, 11529441, "19"], [11529603, 13240362, "20"],
  [13240514, 13423267, "21"], [13423405, 13575433, "22"], [13575869, 13780339, "23"],
  [13780449, 13860548, "24"], [13860793, 13919919, "25"], [13920012, 14580476, "26"],
  [14580597, 15113050, "27"], [15113229, 15300051, "28"],
];
const VERB_LEXFILE_RANGES: Array<[number, number, string]> = [
  [1740, 109540, "29"], [109660, 588084, "30"], [588221, 740449, "31"],
  [740577, 1072133, "32"], [1072262, 1156706, "33"], [1156834, 1205459, "34"],
  [1205696, 1617034, "35"], [1617192, 1759166, "36"], [1759326, 1831308, "37"],
  [1831531, 2105657, "38"], [2105810, 2199435, "39"], [2199590, 2366884, "40"],
  [2367032, 2603567, "41"], [2603699, 2756359, "42"], [2756558, 2772310, "43"],
  [2772400, 3147281, "44"],
];

export class WordNetReader {
  private readonly synsetCache = new Map<string, Synset>();
  private readonly senseNumbers = new Map<string, number>();
  private readonly lexnames = new Map<string, string>();
  private readonly depthCache = new Map<string, number>();
  private _maxDepth = new Map<string, number>();

  constructor(private readonly wn: WordNet) {
    this.computeSenseNumbers();
  }

  private computeSenseNumbers(): void {
    const byLemmaPos = new Map<string, Synset[]>();
    for (const row of this.wn.allSynsets()) {
      const s = this.synset(row.id)!;
      for (const lemma of row.lemmas) {
        const key = `${lemma}.${row.pos}`;
        const bucket = byLemmaPos.get(key) ?? [];
        bucket.push(s);
        byLemmaPos.set(key, bucket);
      }
    }
    for (const [key, synsets] of byLemmaPos) {
      synsets.sort((a, b) => a.row.id.localeCompare(b.row.id));
      synsets.forEach((s, i) => {
        if (!this.senseNumbers.has(s.row.id)) this.senseNumbers.set(s.row.id, i + 1);
      });
      void key;
    }
  }

  senseNumber(synset: Synset): number {
    return this.wn.senseNumsFor(synset.row)[0] || this.senseNumbers.get(synset.row.id) || 1;
  }

  senseNumberFor(synset: Synset, lemma: string): number {
    const idx = synset.row.lemmas.indexOf(lemma);
    return this.wn.senseNumsFor(synset.row)[idx] || this.senseNumbers.get(synset.row.id) || 1;
  }

  lexname(synset: Synset): string {
    const cached = this.lexnames.get(synset.row.id);
    if (cached !== undefined) return cached;
    const offset = synset.offset();
    let lexfile = "adj.all";
    if (synset.pos() === "r") lexfile = "adv.all";
    else if (synset.pos() === "a") lexfile = "adj.all";
    else {
      const ranges = synset.pos() === "n" ? LEXFILE_RANGES : VERB_LEXFILE_RANGES;
      for (const [lo, hi, id] of ranges) {
        if (offset >= lo && offset <= hi) {
          lexfile = LEXFILE_NAMES[id] ?? "noun.Tops";
          break;
        }
      }
    }
    this.lexnames.set(synset.row.id, lexfile);
    return lexfile;
  }

  depthOf(synset: Synset, which: "max" | "min"): number {
    const cacheKey = `${synset.row.id}:${which}`;
    const hit = this.depthCache.get(cacheKey);
    if (hit !== undefined) return hit;
    const hypers = synset.hypernyms();
    let depth = 0;
    if (hypers.length) {
      const ds = hypers.map((h) => this.depthOf(h, which));
      depth = 1 + (which === "max" ? Math.max(...ds) : Math.min(...ds));
    }
    this.depthCache.set(cacheKey, depth);
    return depth;
  }

  synset(idOrName: string): Synset | null {
    const cached = this.synsetCache.get(idOrName);
    if (cached) return cached;
    const row = this.wn.synset(idOrName) ?? this.rowByName(idOrName);
    if (!row) return null;
    const s = new Synset(this, row);
    this.synsetCache.set(idOrName, s);
    return s;
  }

  private rowByName(name: string): WordNetSynset | null {
    const m = name.match(/^([^.]+)\.([nvar])\.(\d+)$/);
    if (!m) return null;
    const lemma = m[1]!.toLowerCase().replace(/ /g, "_");
    const pos = m[2] === "n" || m[2] === "v" || m[2] === "a" || m[2] === "r" ? (m[2] as WordNetPos) : undefined;
    if (!pos) return null;
    const n = Number.parseInt(m[3]!, 10);
    const candidates = this.wn.allSynsets(pos).filter((r) => r.lemmas.includes(lemma));
    const withNums = candidates.filter((r) => this.wn.senseNumsFor(r).some(Boolean));
    if (withNums.length === candidates.length && withNums.length) {
      const hit = candidates.find((r) => this.wn.senseNumsFor(r)[r.lemmas.indexOf(lemma)] === n);
      return hit ?? null;
    }
    candidates.sort((a, b) => a.id.localeCompare(b.id));
    return candidates[n - 1] ?? null;
  }

  lemma(synset: Synset, name: string): Lemma {
    const posDigit = { n: "1", v: "2", a: "3", r: "4" }[synset.pos() as WordNetPos] ?? "1";
    const lexfile = this.lexfileId(synset);
    return new Lemma(this, synset, name, `${name}%${posDigit}:${lexfile}:00::`);
  }

  private lexfileId(synset: Synset): string {
    const lexname = this.lexname(synset);
    for (const [id, name] of Object.entries(LEXFILE_NAMES)) if (name === lexname) return id;
    return "00";
  }

  lemmaFromKey(key: string): Lemma | null {
    const m = key.match(/^(.+?)%(\d):(\d{2}):(\d{2}):(.*):(.*)$/);
    if (!m) return null;
    const candidates = this.all_synsets().filter((s) => s.lemmas().some((l) => l.key() === key));
    return candidates.length ? candidates[0]!.lemmas().find((l) => l.key() === key) ?? null : null;
  }

  synsetsByIds(ids: string[]): Synset[] {
    return ids.map((id) => this.synset(id)).filter((s): s is Synset => s !== null);
  }

  synsets(lemma: string, pos?: WordNetPos): Synset[] {
    const norm = lemma.toLowerCase().replace(/ /g, "_");
    const rows = this.wn.synsets(lemma, pos);
    const hasNums = rows.every((r) => this.wn.senseNumsFor(r).some(Boolean));
    const ordered = hasNums
      ? [...rows].sort(
          (a, b) =>
            (this.wn.senseNumsFor(a)[a.lemmas.indexOf(norm)] || 99) -
            (this.wn.senseNumsFor(b)[b.lemmas.indexOf(norm)] || 99),
        )
      : rows;
    return ordered.map((r) => this.synset(r.id)!);
  }

  all_synsets(pos?: WordNetPos): Synset[] {
    return this.wn.allSynsets(pos).map((r) => this.synset(r.id)!);
  }

  lemmaFromName(lemmaName: string, synset: Synset): Lemma {
    return this.lemma(synset, lemmaName);
  }

  lemmas(lemma: string, pos?: WordNetPos): Lemma[] {
    return this.synsets(lemma, pos).flatMap((s) => s.lemmas().filter((l) => l.name() === lemma.toLowerCase().replace(/ /g, "_")));
  }

  all_lemma_names(pos?: WordNetPos): string[] {
    return [...new Set(this.all_synsets(pos).flatMap((s) => s.lemma_names()))].sort();
  }

  maxDepth(pos: WordNetPos): number {
    let d = this._maxDepth.get(pos);
    if (d === undefined) {
      d = Math.max(0, ...this.wn.allSynsets(pos).map((r) => this.depthOf(new Synset(this, r), "max")));
      this._maxDepth.set(pos, d);
    }
    return d;
  }
}

export function wordnetReader(wn: WordNet): WordNetReader {
  return new WordNetReader(wn);
}

/** Simulated `*ROOT*` synset used by `simulate_root` code paths (NLTK `Synset(None)`). */
class FakeRootSynset extends Synset {
  constructor(reader: WordNetReader) {
    super(reader, {
      id: "*ROOT*",
      pos: "n",
      lemmas: ["*ROOT*"],
      gloss: "",
      examples: [],
      hypernyms: [],
      hyponyms: [],
      similarTo: [],
      antonyms: [],
    });
    this._name = "*ROOT*";
  }
}

const IC_INF = 1e300;

export function information_content(synset: Synset, ic: WordNetIcDict): number {
  let pos: string = synset.pos();
  if (pos === "s") pos = "a";
  const icpos = ic[pos];
  if (icpos === undefined) {
    throw new WordNetError(`Information content file has no entries for part-of-speech: ${pos}`);
  }
  const counts = icpos[synset.offset()] ?? 0;
  return counts === 0 ? IC_INF : -Math.log(counts / (icpos[0] ?? 0));
}

function lcsIc(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose = false): [number, number, number] {
  if (synset1.pos() !== synset2.pos()) {
    throw new WordNetError(
      `Computing the least common subsumer requires ${synset1} and ${synset2} to have the same part of speech.`,
    );
  }
  const ic1 = information_content(synset1, ic);
  const ic2 = information_content(synset2, ic);
  const subsumers = synset1.common_hypernyms(synset2);
  const subsumerIc = subsumers.length === 0 ? 0 : Math.max(...subsumers.map((s) => information_content(s, ic)));
  if (verbose) console.log("> LCS Subsumer by content:", subsumerIc);
  return [ic1, ic2, subsumerIc];
}

/** `nltk.corpus.reader.wordnet` module-level similarity delegators. */
export function jcn_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose = false): number {
  return synset1.jcn_similarity(synset2, ic, verbose);
}

export function lin_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose = false): number {
  return synset1.lin_similarity(synset2, ic, verbose);
}

export function path_similarity(synset1: Synset, synset2: Synset, verbose = false, simulateRoot = true): number | null {
  return synset1.path_similarity(synset2, verbose, simulateRoot);
}

export function lch_similarity(synset1: Synset, synset2: Synset, verbose = false, simulateRoot = true): number | null {
  return synset1.lch_similarity(synset2, verbose, simulateRoot);
}

export function wup_similarity(synset1: Synset, synset2: Synset, verbose = false, simulateRoot = true): number | null {
  return synset1.wup_similarity(synset2, verbose, simulateRoot);
}

export function res_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose = false): number {
  return synset1.res_similarity(synset2, ic, verbose);
}

/** `WordNetICCorpusReader` — loads `ic-*.dat` information-content files. */
export class WordNetICCorpusReader {
  constructor(
    private readonly root: string,
    readonly fileids: string | readonly string[] = "*",
  ) {}

  ic(icfile: string): WordNetIcDict {
    const ic: WordNetIcDict = { n: {}, v: {} };
    const text = readFileSync(join(this.root, icfile), "utf8");
    const lines = text.split("\n");
    for (let num = 0; num < lines.length; num++) {
      if (num === 0) continue;
      const line = lines[num]!.trim();
      if (line === "") continue;
      const fields = line.split(/\s+/);
      const offset = Number.parseInt(fields[0]!.slice(0, -1), 10);
      const value = Number.parseFloat(fields[1]!);
      const last = fields[0]![fields[0]!.length - 1];
      const pos = last === "n" ? "n" : last === "v" ? "v" : null;
      if (pos === null) {
        throw new Error(`Unidentified part of speech in WordNet Information Content file for field ${fields[0]}`);
      }
      if (fields.length === 3 && fields[2] === "ROOT") ic[pos]![0] = (ic[pos]![0] ?? 0) + value;
      if (value !== 0) ic[pos]![offset] = value;
    }
    return ic;
  }
}
