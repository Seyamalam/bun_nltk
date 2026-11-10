/**
 * Port of nltk.misc.sort — selection / bubble / merge / quick sort (instrumented, in-place).
 * Each function sorts the array in place and returns a comparison/operation count
 * matching the Python implementation's return value.
 */

export function selection<T>(a: T[]): number {
  let count = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j]! < a[minIdx]!) minIdx = j;
      count += 1;
    }
    const tmp = a[minIdx]!;
    a[minIdx] = a[i]!;
    a[i] = tmp;
  }
  return count;
}

export function bubble<T>(a: T[]): number {
  let count = 0;
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j + 1]! < a[j]!) {
        const tmp = a[j]!;
        a[j] = a[j + 1]!;
        a[j + 1] = tmp;
        count += 1;
      }
    }
  }
  return count;
}

function mergeLists<T>(b: T[], c: T[]): [T[], number] {
  let count = 0;
  let i = 0, j = 0;
  const a: T[] = [];
  while (i < b.length && j < c.length) {
    count += 1;
    if (b[i]! <= c[j]!) { a.push(b[i]!); i++; }
    else { a.push(c[j]!); j++; }
  }
  if (i === b.length) a.push(...c.slice(j));
  else a.push(...b.slice(i));
  return [a, count];
}

export function merge<T>(a: T[]): number {
  let count = 0;
  if (a.length > 1) {
    const midpoint = Math.floor(a.length / 2);
    const b = a.slice(0, midpoint);
    const c = a.slice(midpoint);
    const countB = merge(b);
    const countC = merge(c);
    const [result, countA] = mergeLists(b, c);
    a.splice(0, a.length, ...result);
    count = countA + countB + countC;
  }
  return count;
}

function partition<T>(a: T[], l: number, r: number): [number, number] {
  const p = a[l]!;
  let i = l;
  let j = r + 1;
  let count = 0;
  while (true) {
    while (i < r) {
      i += 1;
      if (a[i]! >= p) break;
    }
    while (j > l) {
      j -= 1;
      if (j < l || a[j]! <= p) break;
    }
    // swap
    { const tmp = a[i]!; a[i] = a[j]!; a[j] = tmp; }
    count += 1;
    if (i >= j) break;
  }
  // undo last swap
  { const tmp = a[i]!; a[i] = a[j]!; a[j] = tmp; }
  { const tmp = a[l]!; a[l] = a[j]!; a[j] = tmp; }
  return [j, count];
}

function quickRec<T>(a: T[], l: number, r: number): number {
  let count = 0;
  if (l < r) {
    const [s, c] = partition(a, l, r);
    count += c;
    count += quickRec(a, l, s - 1);
    count += quickRec(a, s + 1, r);
  }
  return count;
}

export function quick<T>(a: T[]): number {
  return quickRec(a, 0, a.length - 1);
}

export function demo(): void {
  const shuffle = <T>(arr: T[]) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j]!, arr[i]!]; } };
  for (const size of [10, 20, 50, 100, 200, 500, 1000]) {
    const a = Array.from({ length: size }, (_, i) => i);
    shuffle(a);
    const cs = selection(a);
    shuffle(a);
    const cb = bubble(a);
    shuffle(a);
    const cm = merge(a);
    shuffle(a);
    const cq = quick(a);
    console.log(`size=${String(size).padStart(5)}:  selection=${String(cs).padStart(8)},  bubble=${String(cb).padStart(8)},  merge=${String(cm).padStart(6)},  quick=${String(cq).padStart(6)}`);
  }
}
