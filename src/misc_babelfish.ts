/**
 * Shim for nltk.misc.babelfish — Babelfish online translation (service discontinued).
 * Preserves API; throws helpful error. Port of nltk/misc/babelfish.py.
 */

export function babelizeShell(): never {
  throw new Error(
    `nltk.misc.babelfish: Babelfish online translation service is no longer available. ` +
    `This module is retained in NLTK for error-message compatibility (NLTK Book 2.0). ` +
    `In bun_nltk this service is not implemented. Use a modern translation API instead.`
  );
}

/** Alias matching Python snake_case */
export const babelize_shell = babelizeShell;
