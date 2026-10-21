#!/usr/bin/env python3
"""Pinned oracle provisioning, not a behavioral parity test."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import runpy
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LOCK = json.loads((ROOT / "scripts/ci/nltk-data-lock.json").read_text())


def verified_bytes(url: str, expected: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"SHA256 mismatch: {url}")
    return data


def archive_members(data: bytes, package_id: str) -> list[tuple[str, bytes]]:
    result = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for member in archive.infolist():
            path = PurePosixPath(member.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in member.filename
                    or not path.parts or path.parts[0] != package_id
                    or (member.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError(f"Unsafe archive member: {member.filename}")
            if not member.is_dir():
                result.append((member.filename, archive.read(member)))
    if not result:
        raise ValueError(f"Empty archive: {package_id}")
    return result


def data_root() -> Path:
    directory = os.environ.get("NLTK_DATA")
    if not directory:
        raise ValueError("Set NLTK_DATA to a dedicated CI data directory")
    return Path(directory).resolve()


def prepare() -> None:
    directory = data_root()
    base = f"https://raw.githubusercontent.com/nltk/nltk_data/{LOCK['revision']}"
    directory.mkdir(parents=True, exist_ok=True)
    index = verified_bytes(f"{base}/index.xml", LOCK["indexSha256"])
    (directory / "index.xml").write_bytes(index)
    for package in LOCK["packages"]:
        subdir = directory / package["subdir"]
        subdir.mkdir(parents=True, exist_ok=True)
        archive = subdir / f"{package['id']}.zip"
        if archive.exists() and hashlib.sha256(archive.read_bytes()).hexdigest() == package["sha256"]:
            data = archive.read_bytes()
        else:
            data = verified_bytes(f"{base}/packages/{package['subdir']}/{package['id']}.zip", package["sha256"])
            archive.write_bytes(data)
        members = archive_members(data, package["id"])
        if package["unzip"]:
            for name, contents in members:
                output = subdir / name
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(contents)
    check()


def check() -> None:
    import nltk
    import numpy
    import scipy

    if nltk.__version__ != "3.10.3":
        raise ValueError(f"Expected NLTK 3.10.3, got {nltk.__version__} at {nltk.__file__}")
    directory = data_root()
    # Do not silently satisfy a missing fixture from a user's home directory.
    nltk.data.path[:] = [str(directory)]
    for package in LOCK["packages"]:
        subdir = directory / package["subdir"]
        data = (subdir / f"{package['id']}.zip").read_bytes()
        if hashlib.sha256(data).hexdigest() != package["sha256"]:
            raise ValueError(f"Archive checksum mismatch: {package['id']}")
        if package["unzip"]:
            for name, expected in archive_members(data, package["id"]):
                if (subdir / name).read_bytes() != expected:
                    raise ValueError(f"Extracted fixture mismatch: {name}")
    from nltk.corpus import brown, movie_reviews, treebank, wordnet, stopwords
    # These calls establish data availability only, not bun_nltk parity.
    availability = {
        "brown_files": len(brown.fileids()), "movie_reviews_files": len(movie_reviews.fileids()),
        "treebank_files": len(treebank.fileids()), "wordnet_dog_synsets": len(wordnet.synsets("dog")),
        "english_stopwords": len(stopwords.words("english")),
    }
    for resource in ["tokenizers/punkt_tab/english/", "taggers/averaged_perceptron_tagger_eng/",
                     "chunkers/maxent_ne_chunker_tab/", "corpora/words", "corpora/wordnet_ic",
                     "sentiment/vader_lexicon.zip"]:
        nltk.data.find(resource)
    report = {
        "scope": "Oracle version, checksums and data availability only; no behavioral parity claim",
        "nltk": nltk.__version__, "oracle_path": nltk.__file__, "python": sys.version,
        "numpy": numpy.__version__, "scipy": scipy.__version__,
        "data_revision": LOCK["revision"], "data_root": str(directory), "availability": availability,
    }
    output = ROOT / "artifacts/semaphore-oracle/availability.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


def fixtures() -> None:
    import nltk

    check()
    known = {package["id"] for package in LOCK["packages"]}

    def offline_download(package_id: str, **_kwargs: object) -> bool:
        if package_id not in known:
            raise ValueError(f"Fixture importer requested unpinned resource: {package_id}")
        return True

    # The existing importer requests downloads. Replace only that transport in
    # this process, after every pinned archive has been verified; no live index.
    nltk.download = offline_download
    sys.argv = ["scripts/import_nltk_fixtures.py", "--out-dir", "test/fixtures/nltk_imported",
                "--max-trees", "220", "--max-parser-cases", "80", "--train-per-label", "220",
                "--test-per-label", "80"]
    runpy.run_path(str(ROOT / "scripts/import_nltk_fixtures.py"), run_name="__main__")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["prepare", "check", "fixtures"])
    arguments = parser.parse_args()
    {"prepare": prepare, "check": check, "fixtures": fixtures}[arguments.mode]()
