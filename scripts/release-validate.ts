import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
};

function normalizeTag(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const packageJsonPath = resolve(root, "package.json");
  const changelogPath = resolve(root, "CHANGELOG.md");

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
  const changelog = readFileSync(changelogPath, "utf8");

  if (pkg.private) {
    throw new Error("package.json has private=true; release is blocked");
  }

  if (!pkg.version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error(`invalid semantic version in package.json: ${pkg.version}`);
  }

  const tag = process.env.GIT_TAG ?? process.argv[2];
  if (tag) {
    const fromTag = normalizeTag(tag.trim());
    if (fromTag !== pkg.version) {
      throw new Error(`tag/version mismatch: tag=${fromTag}, package.json=${pkg.version}`);
    }
  }

  const versionHeader = `## [${pkg.version}]`;
  if (!changelog.includes(versionHeader)) {
    throw new Error(`CHANGELOG.md missing release header: ${versionHeader}`);
  }

  if (!changelog.includes("## [Unreleased]")) {
    throw new Error("CHANGELOG.md missing [Unreleased] section");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        package: pkg.name,
        version: pkg.version,
        checkedTag: tag ?? null,
      },
      null,
      2,
    ),
  );
}

main();
