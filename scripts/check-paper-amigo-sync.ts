import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PaperAmigoManifest {
  project_id: string;
  source_pdf: string;
  sha256: string;
  remote_file: {
    key: string;
    name: string;
    size: number;
  };
}

interface PaperAmigoProjectList {
  projects: Array<{
    id: string;
    files: Array<{
      key: string;
      hash: string;
      name: string;
      size: number;
    }>;
  }>;
}

const root = resolve(import.meta.dir, "..");
const manifestPath = resolve(root, "paper", "paper-amigo.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PaperAmigoManifest;
const pdfPath = resolve(root, manifest.source_pdf);
const pdf = readFileSync(pdfPath);
const localHash = createHash("sha256").update(pdf).digest("hex");

if (localHash !== manifest.sha256) {
  throw new Error(
    [
      `Paper Amigo is stale for ${manifest.source_pdf}.`,
      `Manifest: ${manifest.sha256}`,
      `Local PDF: ${localHash}`,
      "Run `paper-amigo --help` and replace the PDF in the recorded project when the CLI supports replacement.",
      "Do not create a duplicate project without the maintainer's approval.",
    ].join("\n"),
  );
}

const result = Bun.spawnSync(["paper-amigo", "project", "list", "--json"], {
  cwd: root,
  stdout: "pipe",
  stderr: "pipe",
});

if (result.exitCode !== 0) {
  const stderr = new TextDecoder().decode(result.stderr).trim();
  throw new Error(`paper-amigo project list failed (${result.exitCode}): ${stderr}`);
}

const listing = JSON.parse(new TextDecoder().decode(result.stdout)) as PaperAmigoProjectList;
const project = listing.projects.find((candidate) => candidate.id === manifest.project_id);
if (!project) throw new Error(`Paper Amigo project not found: ${manifest.project_id}`);

const remote = project.files.find((file) => file.key === manifest.remote_file.key);
if (!remote) throw new Error(`Paper Amigo file not found: ${manifest.remote_file.key}`);
if (remote.hash !== localHash || remote.name !== manifest.remote_file.name || remote.size !== pdf.byteLength) {
  throw new Error(
    `Paper Amigo file does not match ${manifest.source_pdf}: remote hash=${remote.hash}, local hash=${localHash}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      project_id: manifest.project_id,
      source_pdf: manifest.source_pdf,
      sha256: localHash,
      bytes: pdf.byteLength,
      remote_key: remote.key,
    },
    null,
    2,
  ),
);
