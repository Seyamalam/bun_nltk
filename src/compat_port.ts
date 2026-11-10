// nltk.compat — Python-2/3 compatibility shims. In NLTK 3.10.3 the legacy
// _PY3_DATA_UPDATES list is empty, so add_py3_data returns its path unchanged.

const _PY3_DATA_UPDATES: string[] = [];

/** nltk.compat.add_py3_data — insert '/PY3' after a known legacy path segment. */
export function add_py3_data(path: string): string {
  for (const item of _PY3_DATA_UPDATES) {
    if (path.includes(item) && !path.includes("/PY3")) {
      let pos = path.indexOf(item) + item.length;
      if (path.slice(pos, pos + 4) === ".zip") pos += 4;
      path = path.slice(0, pos) + "/PY3" + path.slice(pos);
      break;
    }
  }
  return path;
}

/** nltk.compat.py3_data — decorator rewriting the second arg through add_py3_data. */
export function py3_data<F extends (...args: never[]) => unknown>(init_func: F): F {
  const wrapped = function (this: unknown, ...args: unknown[]) {
    args = [args[0], add_py3_data(String(args[1])), ...args.slice(2)];
    return (init_func as unknown as (...a: unknown[]) => unknown).apply(this, args);
  };
  return wrapped as unknown as F;
}
