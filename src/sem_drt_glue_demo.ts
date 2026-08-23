/**
 * DRT+Glue demo (port of nltk.sem.drt_glue_demo).
 * GUI demo (tkinter in Python) — stubbed in JS runtime.
 */
function demoError(): never {
  throw new Error("nltk.sem.drt_glue_demo is a tkinter GUI demo not available in the JS runtime. Use sem.glue + sem.drt directly.");
}
export function demo(): never { return demoError(); }
export class DrtGlueDemo { constructor(..._args: unknown[]) { demoError(); } }
export class DrtGlueDemoFrame { constructor(..._args: unknown[]) { demoError(); } }
