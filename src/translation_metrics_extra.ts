import { syncWasm } from "./sync_wasm.ts";

export type ChrFOptions = { minLen?: number; maxLen?: number; beta?: number; ignoreWhitespace?: boolean };
export type NistOptions = { n?: number };

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${name} must be an integer`);
  if (value < 0 || value > 0xffffffff) throw new RangeError(`${name} is outside the WASM unsigned integer range`);
}
function text(value: string | string[]): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.some((token) => typeof token !== "string")) throw new TypeError("sentences must be strings or string arrays");
  return value.join(" ");
}
function append(packet: number[], values: readonly number[]): void {
  packet.push(values.length);
  for (const value of values) packet.push(value);
}

export function corpusChrF(references: Array<string | string[]>, hypotheses: Array<string | string[]>, options: ChrFOptions = {}): number {
  if (references.length !== hypotheses.length) throw new RangeError("The number of hypotheses and their references should be the same");
  const min = options.minLen ?? 1, max = options.maxLen ?? 6, beta = options.beta ?? 3.0;
  integer(min, "minLen"); integer(max, "maxLen");
  if (max > 1024) throw new RangeError("ChrF order exceeds the explicit 1024-order resource limit");
  if (typeof beta !== "number") throw new TypeError("beta must be numeric");
  const packet = [hypotheses.length];
  for (let i = 0; i < hypotheses.length; i++) {
    packet.push(1);
    append(packet, Array.from(text(references[i]!), (c) => c.codePointAt(0)!));
    append(packet, Array.from(text(hypotheses[i]!), (c) => c.codePointAt(0)!));
  }
  return syncWasm().evaluationMetrics().translation(0, Uint32Array.from(packet), min, max, beta, options.ignoreWhitespace ?? true);
}
export function sentenceChrF(reference: string | string[], hypothesis: string | string[], options: ChrFOptions = {}): number {
  return corpusChrF([reference], [hypothesis], options);
}

export function nistLengthPenalty(refLen: number, hypLen: number): number {
  if (typeof refLen !== "number" || typeof hypLen !== "number") throw new TypeError("lengths must be numeric");
  return syncWasm().evaluationMetrics().nistLengthPenalty(refLen, hypLen);
}
export function corpusNist(listOfReferences: string[][][], hypotheses: string[][], options: NistOptions = {}): number {
  if (listOfReferences.length !== hypotheses.length) throw new RangeError("The number of hypotheses and their reference(s) should be the same");
  const n = options.n ?? 5;
  integer(n, "n");
  if (n > 1024) throw new RangeError("NIST order exceeds the explicit 1024-order resource limit");
  const ids = new Map<string, number>();
  const encode = (tokens: string[]): number[] => {
    if (!Array.isArray(tokens)) throw new TypeError("NIST sentences must be token arrays");
    return tokens.map((token) => {
      if (typeof token !== "string") throw new TypeError("NIST tokens must be strings");
      let id = ids.get(token);
      if (id === undefined) { id = ids.size; integer(id, "token ID"); ids.set(token, id); }
      return id;
    });
  };
  const packet = [hypotheses.length];
  for (let i = 0; i < hypotheses.length; i++) {
    const refs = listOfReferences[i]!;
    packet.push(refs.length);
    for (const ref of refs) append(packet, encode(ref));
    append(packet, encode(hypotheses[i]!));
  }
  return syncWasm().evaluationMetrics().translation(1, Uint32Array.from(packet), 1, n, 0, false);
}
export function sentenceNist(references: string[][], hypothesis: string[], options: NistOptions = {}): number {
  return corpusNist([references], [hypothesis], options);
}
