#!/usr/bin/env python3
"""Offline, version-pinned reflection only; no downloads and no coverage claims."""
from __future__ import annotations

import importlib
import inspect
import json
import re
import sys

EXPECTED_VERSION = "3.10.3"
EXPECTED_PYTHON = "3.14.4"


def signature(value):
    try:
        # Function and object defaults contain process-specific addresses.
        # Keep their descriptive repr but strip only the address for stable diffs.
        return re.sub(r" at 0x[0-9a-fA-F]+", "", str(inspect.signature(value)))
    except (TypeError, ValueError):
        return None


def discover(module_name):
    module = importlib.import_module(module_name)
    public = getattr(module, "__all__", None)
    names = sorted(set(public if public is not None else
                       [name for name in vars(module) if not name.startswith("_")]))
    targets, excluded = [], []
    for name in names:
        value = getattr(module, name)
        origin = getattr(value, "__module__", "")
        if (inspect.isclass(value) or inspect.isroutine(value)) and origin.startswith("nltk"):
            members = {}
            if inspect.isclass(value):
                for member_name, member in inspect.getmembers(value):
                    if not member_name.startswith("_") and callable(member):
                        members[member_name] = signature(member)
            targets.append({"name": name, "origin": origin,
                            "kind": "class" if inspect.isclass(value) else "function",
                            "signature": signature(value), "members": members})
        else:
            excluded.append(name)
    return {"module": module_name, "targets": targets, "excludedAttributes": excluded}


def main():
    import nltk
    if nltk.__version__ != EXPECTED_VERSION:
        raise RuntimeError(f"NLTK {EXPECTED_VERSION} required, found {nltk.__version__}")
    python_version = ".".join(map(str, sys.version_info[:3]))
    if python_version != EXPECTED_PYTHON:
        raise RuntimeError(f"Python {EXPECTED_PYTHON} required for inventory reflection, found {python_version}")
    request = json.load(sys.stdin)
    if request.get("pythonVersion") != EXPECTED_PYTHON:
        raise RuntimeError(f"Inventory must pin Python {EXPECTED_PYTHON}")
    # No file paths, wall clock, repr(object), or host data availability in the snapshot.
    # Module discovery is identical with or without installed corpora.
    modules = [discover(name) for name in request["modules"]]
    resources = {}
    for resource in request["dataResources"]:
        try:
            nltk.data.find(resource)
            resources[resource] = "available"
        except LookupError:
            resources[resource] = "missing"
    print(json.dumps({"nltkVersion": EXPECTED_VERSION, "pythonVersion": python_version, "modules": modules,
                      "resources": resources}, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
