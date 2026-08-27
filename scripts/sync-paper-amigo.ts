import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface PaperAmigoRemoteFile {
  key: string;
  hash: string;
  name: string;
  size: number;
  url: string;
  uploadedAt: string;
}

interface PaperAmigoManifest {
  schema_version: number;
  project_id: string;
  title: string;
  source_pdf: string;
  sha256: string;
  remote_file: {
    key: string;
    name: string;
    size: number;
    url: string;
    uploaded_at: string;
  };
}

interface PaperAmigoProjectList {
  projects: Array<{
    id: string;
    files: PaperAmigoRemoteFile[];
  }>;
}

const root = resolve(import.meta.dir, "..");
const manifestPath = resolve(root, "paper", "paper-amigo.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PaperAmigoManifest;
const pdfPath = resolve(root, manifest.source_pdf);
const pdf = readFileSync(pdfPath);
const localHash = createHash("sha256").update(pdf).digest("hex");

function runPaperAmigo(command: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["paper-amigo", ...command], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout).trim(),
    stderr: new TextDecoder().decode(result.stderr).trim(),
  };
}

function listProject(): PaperAmigoProjectList["projects"][number] {
  const result = runPaperAmigo(["project", "list", "--json"]);
  if (result.exitCode !== 0) {
    throw new Error(`paper-amigo project list failed (${result.exitCode}): ${result.stderr}`);
  }
  const listing = JSON.parse(result.stdout) as PaperAmigoProjectList;
  const project = listing.projects.find((candidate) => candidate.id === manifest.project_id);
  if (!project) throw new Error(`Paper Amigo project not found: ${manifest.project_id}`);
  return project;
}

function findRecordedFile(project: PaperAmigoProjectList["projects"][number]): PaperAmigoRemoteFile {
  const byKey = project.files.find((file) => file.key === manifest.remote_file.key);
  if (byKey) return byKey;

  const byName = project.files.filter((file) => file.name === manifest.remote_file.name);
  if (byName.length === 1) return byName[0]!;
  throw new Error(`Paper Amigo file not found: ${manifest.remote_file.key}`);
}

function saveManifest(remote: PaperAmigoRemoteFile): void {
  const updated: PaperAmigoManifest = {
    ...manifest,
    sha256: remote.hash,
    remote_file: {
      key: remote.key,
      name: remote.name,
      size: remote.size,
      url: remote.url,
      uploaded_at: remote.uploadedAt,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

let project = listProject();
let remote = findRecordedFile(project);
let status = "unchanged";

if (remote.hash !== localHash || remote.size !== pdf.byteLength) {
  const replacement = runPaperAmigo([
    "project",
    "replace",
    manifest.project_id,
    remote.key,
    pdfPath,
    "--json",
  ]);

  if (replacement.exitCode !== 0) {
    const output = `${replacement.stdout}\n${replacement.stderr}`;
    if (!output.includes("replacement-status-unknown")) {
      throw new Error(`paper-amigo project replace failed (${replacement.exitCode}): ${output.trim()}`);
    }
  }

  project = listProject();
  const matches = project.files.filter(
    (file) => file.hash === localHash && file.name === manifest.remote_file.name,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Paper Amigo replacement could not be verified: found ${matches.length} matching remote files`,
    );
  }
  remote = matches[0]!;
  status = "replaced";
}

if (remote.hash !== localHash || remote.name !== manifest.remote_file.name || remote.size !== pdf.byteLength) {
  throw new Error(
    `Paper Amigo file does not match ${manifest.source_pdf}: remote hash=${remote.hash}, local hash=${localHash}`,
  );
}

saveManifest(remote);
console.log(
  JSON.stringify(
    {
      ok: true,
      status,
      project_id: manifest.project_id,
      source_pdf: manifest.source_pdf,
      sha256: localHash,
      bytes: pdf.byteLength,
      remote_key: remote.key,
      remote_url: remote.url,
    },
    null,
    2,
  ),
);
