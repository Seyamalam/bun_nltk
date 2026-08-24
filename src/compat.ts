// NLTK compat — shim (Python 2/3 compat helpers, trivial in JS)
// Original: nltk/compat.py

export function addPy3Data(_path: string): void { /* no-op in JS */ }
export const add_py3_data = addPy3Data;

export function py3Data<T extends (...args: unknown[])=> unknown>(initFunc: T): T {
  return initFunc;
}
export const py3_data = py3Data;
