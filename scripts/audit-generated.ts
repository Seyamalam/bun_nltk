/** Exact generator-owned exceptions to the handwritten 600-LOC guard.
 * Declaration byte regeneration is independently enforced by CI's portable lane.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dir, "..");
export function auditDeclaration(path: string, text: string): void {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  function literal(node: ts.Expression): boolean {
    return ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node) ||
      node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword ||
      (ts.isPrefixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken) &&
        ts.isNumericLiteral(node.operand));
  }
  function visit(node: ts.Node): void {
    if ((ts.isFunctionLike(node) && "body" in node && node.body !== undefined) ||
        (ts.isVariableDeclaration(node) && node.initializer !== undefined && !literal(node.initializer)) ||
        (ts.isPropertyDeclaration(node) && node.initializer !== undefined && !literal(node.initializer)) ||
        (ts.isEnumMember(node) && node.initializer !== undefined && !literal(node.initializer)) ||
        (ts.isExportAssignment(node) && !ts.isIdentifier(node.expression)) ||
        ts.isDecorator(node) ||
        ts.isClassStaticBlockDeclaration(node) || ts.isExpressionStatement(node) ||
        ts.isIfStatement(node) || ts.isIterationStatement(node, false) ||
        ts.isTryStatement(node) || ts.isThrowStatement(node) || ts.isSwitchStatement(node)) {
      throw new Error(`Executable code in generated declaration: ${path}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  // A separate compiler check catches syntax, imports and consumers; this audit
  // only establishes that the exempt tree cannot hide handwritten runtime code.
}

if (import.meta.main) {
  for (const generator of ["scripts/export-compat-unicode.py", "scripts/generate-tokenizer-unicode.py"]) {
    const child = Bun.spawnSync(["python3", generator, "--check"], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (child.exitCode !== 0) throw new Error(new TextDecoder().decode(child.stderr));
  }
  const tracked = Bun.spawnSync(["git", "ls-files", "dist/portable/*.d.ts", "dist/portable/**/*.d.ts"], {
    cwd: root, stdout: "pipe", stderr: "pipe",
  });
  if (tracked.exitCode !== 0) throw new Error(new TextDecoder().decode(tracked.stderr));
  const declarations = new TextDecoder().decode(tracked.stdout).trim().split("\n").filter(Boolean);
  if (!declarations.length) throw new Error("Missing build-owned portable declarations");
  for (const path of declarations) auditDeclaration(path, readFileSync(resolve(root, path), "utf8"));
  console.log(JSON.stringify({ generatedUnicode: "byte-identical", declarations: declarations.length, scope: "Only audited generated outputs; handwritten sources retain the LOC limit" }));
}
