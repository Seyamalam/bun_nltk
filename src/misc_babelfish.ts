/**
 * Port of nltk.misc.babelfish — Babelfish online translation (service discontinued).
 * nltk's babelize_shell() only prints a notice; ported verbatim.
 */

export function babelizeShell(): void {
  console.log("Babelfish online translation service is no longer available.");
}

/** Alias matching Python snake_case */
export const babelize_shell = babelizeShell;
