/** Unicode semantics shared by ports of Python's str/re operations. */
export const PYTHON_SPACE = String.raw`[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]`;
export const PYTHON_NONSPACE = PYTHON_SPACE.replace("[", "[^");
const spaces = new RegExp(`${PYTHON_SPACE}+`, "u");
const trailingSpaces = new RegExp(`${PYTHON_SPACE}+$`, "u");
export const splitPythonWhitespace = (text: string) => text.split(spaces).filter(Boolean);
export const trimPythonEnd = (text: string) => text.replace(trailingSpaces, "");
export const pythonIsUpper = (text: string) =>
  /\p{Uppercase}/u.test(text) && !/[\p{Lowercase}\p{Lt}]/u.test(text);
export const pythonIsLower = (text: string) =>
  /\p{Lowercase}/u.test(text) && !/[\p{Uppercase}\p{Lt}]/u.test(text);
export function pythonIsTitle(text: string): boolean {
  let previousCased = false,
    cased = false;
  for (const char of text) {
    if (/[\p{Uppercase}\p{Lt}]/u.test(char)) {
      if (previousCased) return false;
      previousCased = cased = true;
    } else if (/\p{Lowercase}/u.test(char)) {
      if (!previousCased) return false;
      previousCased = cased = true;
    } else previousCased = false;
  }
  return cased;
}
