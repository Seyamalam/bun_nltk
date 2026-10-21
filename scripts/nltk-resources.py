#!/usr/bin/env python3
"""Explicit, checksum-locked NLTK resources; check mode never downloads."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / "scripts/ci/nltk-data-lock.json").read_text())
VERSIONS = json.loads((ROOT / "scripts/ci/versions.json").read_text())
DEFAULT_RESOURCES = ("wordnet", "averaged_perceptron_tagger_eng", "vader_lexicon")
MAX_DOWNLOAD_BYTES = 80_000_000
MAX_EXTRACTED_BYTES = 512_000_000
MAX_MEMBERS = 100_000


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str, expected: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as response:
        content = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(content) > MAX_DOWNLOAD_BYTES:
        raise ValueError(f"Resource exceeds download limit: {url}")
    if sha256(content) != expected:
        raise ValueError(f"SHA256 mismatch: {url}")
    return content


def selected_resources(names: str) -> list[dict]:
    requested = names.split(",")
    known = {package["id"]: package for package in LOCK["packages"]}
    if not requested or any(name not in known for name in requested):
        raise ValueError("Choose comma-separated resource IDs from nltk-data-lock.json")
    if len(set(requested)) != len(requested):
        raise ValueError("Duplicate resource ID")
    return [known[name] for name in requested]


def members(data: bytes, package_id: str) -> list[tuple[str, bytes]]:
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError("Archive exceeds download limit")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_MEMBERS:
            raise ValueError("Archive has too many members")
        if sum(entry.file_size for entry in entries) > MAX_EXTRACTED_BYTES:
            raise ValueError("Archive exceeds expanded-size limit")
        result = []
        seen = set()
        for entry in entries:
            path = PurePosixPath(entry.filename)
            mode = (entry.external_attr >> 16) & 0o170000
            if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                    or not path.parts or path.parts[0] != package_id
                    or mode not in (0, 0o040000, 0o100000)):
                raise ValueError(f"Unsafe archive member: {entry.filename}")
            name = path.as_posix()
            if name in seen:
                raise ValueError(f"Duplicate archive member: {package_id}")
            seen.add(name)
            if not entry.is_dir():
                result.append((name, archive.read(entry)))
        if not result:
            raise ValueError(f"Empty archive: {package_id}")
        return result


def destination(directory: Path, relative: str) -> Path:
    current = directory
    if any(parent.is_symlink() for parent in (directory, *directory.parents)):
        raise ValueError(f"Symlink data directory or ancestor: {directory}")
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or "\\" in relative:
        raise ValueError(f"Unsafe destination: {relative}")
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Symlink destination: {current}")
    return current


def resource_bytes(directory: Path, relative: str, expected: str) -> bytes:
    path = destination(directory, relative)
    if path.stat().st_size > MAX_DOWNLOAD_BYTES:
        raise ValueError(f"Resource exceeds download limit: {path}")
    data = path.read_bytes()
    if sha256(data) != expected:
        raise ValueError(f"Archive checksum mismatch: {path}")
    return data


def provision(directory: Path, packages: list[dict]) -> None:
    base = f"https://raw.githubusercontent.com/nltk/nltk_data/{LOCK['revision']}"
    index_path = destination(directory, "index.xml")
    if index_path.exists():
        index = resource_bytes(directory, "index.xml", LOCK["indexSha256"])
    else:
        index = download(f"{base}/index.xml", LOCK["indexSha256"])
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_bytes(index)
    indexed = {entry.attrib["id"]: entry.attrib for entry in ET.fromstring(index).iter("package")}
    for package in packages:
        if package["id"] not in indexed:
            raise ValueError(f"Resource absent from locked index: {package['id']}")
        if indexed[package["id"]].get("sha256_checksum") != package["sha256"]:
            raise ValueError(f"Index/archive checksum disagreement: {package['id']}")
    for package in packages:
        relative = f"{package['subdir']}/{package['id']}.zip"
        path = destination(directory, relative)
        if path.exists():
            data = resource_bytes(directory, relative, package["sha256"])
        else:
            data = download(f"{base}/packages/{relative}", package["sha256"])
        files = members(data, package["id"])
        # Check every output path before writing any part of this resource.
        outputs = [(destination(directory, f"{package['subdir']}/{name}"), value)
                   for name, value in files] if package["unzip"] else []
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        for output, value in outputs:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(value)


def verify(directory: Path, packages: list[dict]) -> dict:
    index = resource_bytes(directory, "index.xml", LOCK["indexSha256"])
    metadata = {entry.attrib["id"]: entry.attrib for entry in ET.fromstring(index).iter("package")}
    results = []
    for package in packages:
        relative = f"{package['subdir']}/{package['id']}.zip"
        data = resource_bytes(directory, relative, package["sha256"])
        files = members(data, package["id"])
        if package["unzip"]:
            for name, expected in files:
                output = destination(directory, f"{package['subdir']}/{name}")
                if output.stat().st_size != len(expected) or output.read_bytes() != expected:
                    raise ValueError(f"Extracted fixture mismatch: {output}")
        entry = metadata.get(package["id"])
        if entry is None:
            raise ValueError(f"Resource absent from locked index: {package['id']}")
        if entry.get("sha256_checksum") != package["sha256"]:
            raise ValueError(f"Index/archive checksum disagreement: {package['id']}")
        results.append({
            "id": package["id"], "archive": relative, "bytes": len(data),
            "sha256": package["sha256"], "extracted": package["unzip"],
            "license": entry.get("license"), "copyright": entry.get("copyright"),
            "upstreamUrl": entry.get("url"), "verified": True,
        })
    return {
        "scope": "Pinned resource integrity and availability only, not behavioral parity",
        "dataRevision": LOCK["revision"], "indexSha256": LOCK["indexSha256"],
        "dataRoot": str(directory), "resources": results,
    }


def availability(directory: Path, packages: list[dict]) -> dict:
    import nltk

    if nltk.__version__ != "3.10.3":
        raise ValueError(f"Expected NLTK 3.10.3, got {nltk.__version__}")
    nltk.data.path[:] = [str(directory)]
    probes = {}
    for package in packages:
        name = package["id"]
        if name == "wordnet":
            from nltk.corpus import wordnet
            probes[name] = {"dogSynsets": len(wordnet.synsets("dog"))}
        elif name == "averaged_perceptron_tagger_eng":
            from nltk.tag.perceptron import PerceptronTagger
            probes[name] = {"tags": PerceptronTagger().tag(["A", "dog", "runs", "."])}
        elif name == "vader_lexicon":
            from nltk.sentiment.vader import SentimentIntensityAnalyzer
            probes[name] = {"good": SentimentIntensityAnalyzer().polarity_scores("good")}
        else:
            probes[name] = {"archiveVerified": True}
    return {"nltk": nltk.__version__, "python": sys.version, "probes": probes}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "check"))
    parser.add_argument("--data-dir", default=os.environ.get("NLTK_DATA"))
    parser.add_argument("--resources", default=",".join(DEFAULT_RESOURCES))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if not args.data_dir:
        parser.error("Set --data-dir or NLTK_DATA to a dedicated resource directory")
    actual = ".".join(map(str, sys.version_info[:3]))
    if actual != VERSIONS["python"]:
        parser.error(f"Expected Python {VERSIONS['python']}, got {actual}")
    directory = Path(args.data_dir).absolute()
    packages = selected_resources(args.resources)
    if args.mode == "prepare":
        provision(directory, packages)
    report = verify(directory, packages)
    report.update(availability(directory, packages))
    output = json.dumps(report, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output)
    print(output, end="")


if __name__ == "__main__":
    main()
