/**
 * Legality-principle syllabifier (port of nltk.tokenize.legality_principle).
 *
 * Splits a word into syllables by onset-maximization over legal onsets/codas
 * derived from a corpus. Faithful to NLTK's Counter-based threshold.
 */

export class LegalitySyllableTokenizer {
  private readonly vowels: Set<string>;
  private readonly legalOnsets: Set<string>;
  private readonly legalCodas: Set<string>;

  constructor(tokenizedSourceText: string[], vowels = "aeiouy", legalFrequencyThreshold = 0.001) {
    this.vowels = new Set(vowels.split(""));
    // Collect onsets/codas from corpus
    const onsets: string[] = [];
    const codas: string[] = [];
    for (const word of tokenizedSourceText) {
      const lower = word.toLowerCase();
      // Split on vowels to find consonant clusters
      const _parts: string[] = [];
      const _cur = "";
      const _inVowel = false;
      // Build onset/coda candidates by scanning for vowel boundaries (matches NLTK's ipc approach)
      // Simplified: use regex split on vowels to extract clusters
      const clusters = lower.split(new RegExp(`[${vowels.replace(/[\]\\^-]/g, "\\$&")}]+`));
      // First cluster is onset of first syllable, last is coda of last
      // For each internal cluster, try splits for onset/coda
      // NLTK builds legal onsets/codas by counting all consonant clusters that appear word-initially/finally
      // and also internal splits. We approximate by collecting any cluster that appears at word edges.
      if (clusters.length > 0) {
        if (clusters[0]) onsets.push(clusters[0]!);
        if (clusters.length > 1 && clusters[clusters.length-1]) codas.push(clusters[clusters.length-1]!);
      }
      // Also add internal clusters as potential onsets/codas (NLTK does frequency-based filtering)
      for (let i = 1; i < clusters.length - 1; i++) {
        const c = clusters[i]!;
        if (c) { onsets.push(c); codas.push(c); }
      }
    }
    // Frequency filter
    const totalOn = onsets.length || 1;
    const totalCo = codas.length || 1;
    const countOn = new Map<string, number>();
    const countCo = new Map<string, number>();
    for (const o of onsets) countOn.set(o, (countOn.get(o) ?? 0) + 1);
    for (const c of codas) countCo.set(c, (countCo.get(c) ?? 0) + 1);
    this.legalOnsets = new Set([...countOn.entries()].filter(([,n]) => n/totalOn >= legalFrequencyThreshold).map(([k])=>k));
    this.legalCodas = new Set([...countCo.entries()].filter(([,n]) => n/totalCo >= legalFrequencyThreshold).map(([k])=>k));
    // Always allow empty onset/coda
    this.legalOnsets.add("");
    this.legalCodas.add("");
  }

  tokenize(word: string): string[] {
    if (!word) return [];
    // No vowels => single chunk
    if (![...word].some(ch => this.vowels.has(ch.toLowerCase()))) return [word];
    // If word is all vowels or single char
    if (word.length <= 1) return [word];

    // Build syllables by scanning for vowel nuclei and maximizing onset
    const lower = word;
    const isVowel = (ch: string) => this.vowels.has(ch.toLowerCase());
    const syllables: string[] = [];
    const _i = 0;
    const _syllStart = 0;

    // Find vowel positions
    const vowelIdx: number[] = [];
    for (let k = 0; k < lower.length; k++) if (isVowel(lower[k]!)) vowelIdx.push(k);
    if (vowelIdx.length === 0) return [word];
    if (vowelIdx.length === 1) return [word];

    // Split between vowels by choosing the longest legal onset for the next syllable
    const splitPoints: number[] = [];
    for (let vi = 0; vi < vowelIdx.length - 1; vi++) {
      const leftV = vowelIdx[vi]!;
      const rightV = vowelIdx[vi+1]!;
      const cluster = lower.slice(leftV + 1, rightV);
      if (cluster.length === 0) { splitPoints.push(leftV + 1); continue; }
      // Try to maximize onset of next syllable that is legal
      let best = 0; // number of chars to assign to next onset (from end of cluster)
      for (let k = cluster.length; k >= 0; k--) {
        const onset = cluster.slice(cluster.length - k);
        const coda = cluster.slice(0, cluster.length - k);
        if (this.legalOnsets.has(onset.toLowerCase()) && this.legalCodas.has(coda.toLowerCase())) {
          best = k;
          break;
        }
      }
      // Split point is rightV - best
      splitPoints.push(rightV - best);
    }

    let prev = 0;
    for (const sp of splitPoints) {
      syllables.push(word.slice(prev, sp));
      prev = sp;
    }
    syllables.push(word.slice(prev));
    return syllables.filter(Boolean);
  }
}

export function legalityTokenize(word: string, corpus: string[], vowels = "aeiouy"): string[] {
  return new LegalitySyllableTokenizer(corpus, vowels).tokenize(word);
}
