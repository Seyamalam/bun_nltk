// NLTK tabdata — shim (tab-separated corpus helpers)
// Original: nltk/tabdata.py

function unavailable(name: string): never {
  throw new Error(`${name} requires NLTK tab-data corpora — not available in JS`);
}

function rmNl(s: string): string { return s.replace(/\n$/, ""); }
export const rm_nl = rmNl;

export class TabEncoder { encode(..._a: unknown[]): never { return unavailable("tabdata.TabEncoder.encode"); } }
export class TabDecoder { decode(..._a: unknown[]): never { return unavailable("tabdata.TabDecoder.decode"); } }
export class MaxentEncoder extends TabEncoder {}
export class MaxentDecoder extends TabDecoder {}
export class PunktDecoder extends TabDecoder {}
