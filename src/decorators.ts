// NLTK decorators — lightweight JS port
// Original: nltk/decorators.py

export function decorator(caller: (fn: unknown, ...args: unknown[])=> unknown) {
  return function decoratorFactory(fn: (...args: unknown[])=> unknown) {
    return (...args: unknown[]) => caller(fn, ...args);
  };
}

export function decoratorFactory<T>(cls: new (...a: unknown[])=> T): (fn: unknown)=> unknown {
  return (fn: unknown) => fn;
}

export function memoize<T extends (...args: unknown[])=> unknown>(fn: T): T {
  const cache = new Map<string, unknown>();
  const wrapped = (...args: unknown[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const val = (fn as (...a: unknown[])=> unknown)(...args);
    cache.set(key, val);
    return val;
  };
  return wrapped as unknown as T;
}

export const getattr_ = (obj: Record<string, unknown>, name: string, defaultThunk: ()=> unknown): unknown =>
  name in obj ? obj[name] : defaultThunk();
