import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(import.meta.resolve("bun_nltk/package.json"));
const source = resolve(dirname(packageJsonPath), "native", "bun_nltk.wasm");
const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const destination = resolve(publicDirectory, "bun_nltk.wasm");

await mkdir(publicDirectory, { recursive: true });
await copyFile(source, destination);

const { size } = await stat(destination);
console.log(`Copied bun_nltk.wasm (${size.toLocaleString()} bytes)`);

