/**
 * Chat-80 world KB reader (port of nltk.sem.chat80).
 * Chat-80 Prolog KB is a corpus; without it, queries throw helpfully.
 */
export interface Chat80KB { query(sql: string): unknown[]; tables: string[]; }
function chat80Error(): never {
  throw new Error("nltk.sem.chat80 requires the Chat-80 Prolog KB corpus (nltk_data/sem/chat80) which is not bundled in the JS runtime.");
}
export class Chat80CorpusReader {
  constructor(_root?: string, _files?: string[]) {}
  sqlQuery(_query: string): unknown[] { return chat80Error(); }
  query(_q: string): unknown[] { return chat80Error(); }
}
export function demo(): string { return chat80Error(); }
export const items: string[] = [];
