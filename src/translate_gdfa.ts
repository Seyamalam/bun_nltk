/**
 * GDFA word-alignment symmetrization (port of nltk.translate.gdfa).
 *
 * Koehn (2005) grow-diag-final-and. Accepts Pharaoh-format alignment strings.
 */

type Point = [number, number];

function parsePharaoh(s: string): Point[] {
  if (!s.trim()) return [];
  return s.trim().split(/\s+/).map(a => {
    const [x, y] = a.split("-").map(Number);
    return [x as number, y as number] as Point;
  });
}

export function growDiagFinalAnd(
  srclen: number,
  trglen: number,
  e2f: string,
  f2e: string,
): Point[] {
  const a2 = parsePharaoh(e2f);
  const b2 = parsePharaoh(f2e);
  const key = (p: Point) => `${p[0]},${p[1]}`;
  const setA = new Set(a2.map(key));
  const setB = new Set(b2.map(key));
  const alignment = new Set<string>();
  const union = new Set<string>([...setA, ...setB]);
  for (const k of setA) if (setB.has(k)) alignment.add(k);

  const alignedE = new Set<number>();
  const alignedF = new Set<number>();
  for (const k of alignment) {
    const [e, f] = k.split(",").map(Number) as [number, number];
    alignedE.add(e); alignedF.add(f);
  }

  const neighbors: Point[] = [[-1,0],[0,-1],[1,0],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

  // NLTK quirk: `aligned` is a dict keyed "e"/"f", so `point not in aligned` is
  // vacuously true for int coordinates — grow_diag adds any in-union neighbor of
  // an in-bounds aligned point (the neighbor itself is NOT bounds-checked).
  const growDiag = () => {
    let added = true;
    while (added) {
      added = false;
      for (const k of Array.from(alignment)) {
        const [e, f] = k.split(",").map(Number) as [number, number];
        if (!(0 <= e && e < srclen && 0 <= f && f < trglen)) continue;
        for (const [de, df] of neighbors) {
          const nk = `${e + de},${f + df}`;
          if (union.has(nk) && !alignment.has(nk)) {
            alignment.add(nk);
            added = true;
          }
        }
      }
    }
  };

  // final_and(a): `a` is unused in NLTK — it adds every in-bounds union point.
  const finalAnd = () => {
    for (const k of union) {
      const [e, f] = k.split(",").map(Number) as [number, number];
      if (0 <= e && e < srclen && 0 <= f && f < trglen) {
        alignment.add(`${e},${f}`);
        alignedE.add(e); alignedF.add(f);
      }
    }
  };

  growDiag();
  finalAnd();
  finalAnd();
  return [...alignment].map(k => k.split(",").map(Number) as Point).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
