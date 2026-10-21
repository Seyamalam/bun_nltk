import { expect, test } from "bun:test";
import { auditDeclaration } from "../scripts/audit-generated.ts";

test("generated declaration audit permits ambient types and compiler constant literals", () => {
  expect(() => auditDeclaration("generated.d.ts", `
import type { X } from './types.js';
export declare const word = "literal";
export declare const count = -2;
export declare class Example { static readonly LIMIT = 12; enabled = true; method(x: X): void; }
export type Result = X | null;
export interface Options { value: number; }
`)).not.toThrow();
});

test("generated declaration audit rejects hidden runtime code", () => {
  for (const source of [
    "export function f() { return 1; }",
    "export const value = run();",
    "export const value = object.property;",
    "export const value = [1];",
    "export class Example { value = new Object(); }",
    "export class Example { static { run(); } }",
    "export default run();",
    "enum Example { member = run() }",
    "run();",
    "if (true) run();",
    "while (true) {}",
    "throw 'bad';",
  ]) expect(() => auditDeclaration("generated.d.ts", source)).toThrow("Executable code");
});
