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

  const growDiag = () => {
    let prev = alignment.size - 1;
    while (prev < alignment.size) {
      let added = false;
      for (const k of [...alignment]) {
        const [e, f] = k.split(",").map(Number) as [number, number];
        if (!(0 <= e && e < srclen && 0 <= f && f < trglen)) continue;
        for (const [de, df] of neighbors) {
          const ne = e + de, nf = f + df;
          const nk = `${ne},${nf}`;
          if (union.has(nk)) {
            alignment.add(nk);
            alignedE.add(ne); alignedF.add(nf);
            prev++;
            added = true;
          }
        }
      }
      if (!added) break;
    }
  };

  const finalAnd = (label: string) => {
    void label;
    for (const k of union) {
      const [e, f] = k.split(",").map(Number) as [number, number];
      const k2 = `${e},${f}`;
      if (!alignment.has(k2) && 0 <= e && e < srclen && 0 <= f && f < trglen) {
        alignment.add(k);
        alignedE.add(e); alignedF.add(f);
      }
    }
  };

  growDiag();
  finalAnd("e2f");
  finalAnd("f2e");
  return [...alignment].map(k => k.split(",").map(Number) as Point).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
