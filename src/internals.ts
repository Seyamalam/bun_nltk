// NLTK internals — shim (Java + file-find helpers not available in JS)
// Original: nltk/internals.py

/** Build an Error carrying a Python exception class name for
 * NLTK-compatible error surfacing (e.g. KeyError, IndexError). */
export function pyError(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

function unavailable(name: string): never {
  throw new Error(`${name} requires Java/subprocess — not available in JS`);
}

export function configJava(..._a: unknown[]): never { return unavailable("internals.config_java"); }
export const config_java = configJava;
export function java(..._a: unknown[]): never { return unavailable("internals.java"); }
export class UntrustedJarError extends Error {}
export class ReadError extends Error {}
export function readStr(..._a: unknown[]): never { return unavailable("internals.read_str"); }
export const read_str = readStr;
export function readInt(..._a: unknown[]): never { return unavailable("internals.read_int"); }
export const read_int = readInt;
export function readNumber(..._a: unknown[]): never { return unavailable("internals.read_number"); }
export const read_number = readNumber;
export function overridden(_method: unknown): boolean { return false; }
export function deprecated(_message: string) { return (_t: unknown, _k: string, d: PropertyDescriptor) => d; }
export class Deprecated { constructor(public message: string) {} }
export class Counter {
  private value: number;
  constructor(initialValue = 0) {
    this.value = initialValue;
  }
  get(): number {
    this.value += 1;
    return this.value;
  }
}
export function findFile(..._a: unknown[]): never { return unavailable("internals.find_file"); }
export const find_file = findFile;
export function findDir(..._a: unknown[]): never { return unavailable("internals.find_dir"); }
export const find_dir = findDir;
export function findBinary(..._a: unknown[]): never { return unavailable("internals.find_binary"); }
export const find_binary = findBinary;
export function findJar(..._a: unknown[]): never { return unavailable("internals.find_jar"); }
export const find_jar = findJar;
export function sliceBounds(_seq: unknown, _slice: unknown): [number, number] { return [0, 0]; }
export const slice_bounds = sliceBounds;
export function isWritable(_path: string): boolean { return false; }
export const is_writable = isWritable;
