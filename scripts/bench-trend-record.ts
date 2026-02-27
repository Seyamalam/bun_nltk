import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BenchHistory = {
  version: string;
  generated_at: string;
  speedups: Record<string, number>;
};

function main() {
  const root = resolve(import.meta.dir, "..");
  const dashboard = JSON.parse(readFileSync(resolve(root, "artifacts", "bench-dashboard.json"), "utf8")) as {
    generated_at: string;
    speedups: Record<string, number>;
  };
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
  const version = `v${pkg.version}`;

  const historyDir = resolve(root, "bench", "history");
  mkdirSync(historyDir, { recursive: true });

  const payload: BenchHistory = {
    version,
    generated_at: dashboard.generated_at,
    speedups: dashboard.speedups,
  };

  const itemPath = resolve(historyDir, `${version}.json`);
  writeFileSync(itemPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  let index: string[] = [];
  const indexPath = resolve(historyDir, "index.json");
  try {
    index = JSON.parse(readFileSync(indexPath, "utf8")) as string[];
  } catch {
    index = [];
  }
  if (!index.includes(version)) index.push(version);
  index.sort();
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        version,
        path: itemPath,
      },
      null,
      2,
    ),
  );
}

main();

