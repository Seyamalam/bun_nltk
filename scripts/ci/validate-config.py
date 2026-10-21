#!/usr/bin/env python3
"""Local repository-specific Semaphore checks, not the server's full schema."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import yaml

ROOT = Path(__file__).resolve().parents[2]


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader: UniqueLoader, node: yaml.MappingNode) -> dict:
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if key in mapping:
            raise ValueError(f"Duplicate YAML key: {key}")
        mapping[key] = loader.construct_object(value_node)
    return mapping


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def load(path: Path) -> dict:
    value = yaml.load(path.read_text(), Loader=UniqueLoader)
    if not isinstance(value, dict):
        raise ValueError(f"Expected pipeline mapping: {path}")
    return value


def keys(mapping: dict, allowed: set[str], required: set[str] = frozenset()) -> None:
    if not isinstance(mapping, dict) or set(mapping) - allowed or required - set(mapping):
        raise ValueError(f"Invalid or missing keys: {mapping}")


def commands(section: dict) -> None:
    keys(section, {"commands"}, {"commands"})
    rows = section["commands"]
    if not isinstance(rows, list) or not rows or any(not isinstance(row, str) or not row.strip() for row in rows):
        raise ValueError("Commands must be nonempty strings (quote YAML colon expressions)")


def machine(agent: dict) -> None:
    keys(agent, {"machine"}, {"machine"})
    keys(agent["machine"], {"type", "os_image"}, {"type"})
    value = agent["machine"]
    supported = {
        "f1-standard-4": "ubuntu2404",
        "a2-standard-4": "macos-xcode26",
        "s1-bun-nltk-windows-x64": None,
    }
    if value["type"] not in supported or value.get("os_image") != supported[value["type"]]:
        raise ValueError(f"Unreviewed runner/image pair: {value}")


def environment(rows: list[dict]) -> None:
    names = set()
    for row in rows:
        keys(row, {"name", "value"}, {"name", "value"})
        if not isinstance(row["value"], str) or row["name"] in names:
            raise ValueError("Environment values must be strings with unique names")
        names.add(row["name"])


def task(config: dict, global_config: bool = False) -> None:
    allowed = {"prologue", "epilogue", "env_vars"}
    keys(config, allowed if global_config else allowed | {"jobs", "agent"}, set() if global_config else {"jobs"})
    if "agent" in config:
        machine(config["agent"])
    if "prologue" in config:
        commands(config["prologue"])
    if "epilogue" in config:
        keys(config["epilogue"], {"always", "on_pass", "on_fail"})
        for section in config["epilogue"].values():
            commands(section)
    if "env_vars" in config:
        environment(config["env_vars"])
    if not global_config:
        if not config["jobs"]:
            raise ValueError("Task must have jobs")
        for job in config["jobs"]:
            keys(job, {"name", "commands"}, {"name", "commands"})
            commands({"commands": job["commands"]})


def validate(config: dict, path: Path) -> None:
    keys(config, {"version", "name", "agent", "execution_time_limit", "auto_cancel", "global_job_config", "blocks", "promotions"},
         {"version", "name", "agent", "blocks"})
    if config["version"] != "v1.0":
        raise ValueError("Only Semaphore v1.0 pipelines are supported")
    machine(config["agent"])
    if "execution_time_limit" in config:
        limit = config["execution_time_limit"]
        keys(limit, {"minutes"}, {"minutes"})
        if not isinstance(limit["minutes"], int) or not 1 <= limit["minutes"] <= 1440:
            raise ValueError("Invalid timeout")
    if "global_job_config" in config:
        task(config["global_job_config"], True)
    if "auto_cancel" in config:
        keys(config["auto_cancel"], {"running"}, {"running"})
        keys(config["auto_cancel"]["running"], {"when"}, {"when"})
    blocks = config["blocks"]
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("Pipeline must have blocks")
    names = [block["name"] for block in blocks]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate block name")
    explicit = any("dependencies" in block for block in blocks)
    graph = {}
    for block in blocks:
        keys(block, {"name", "dependencies", "task"}, {"name", "task"} | ({"dependencies"} if explicit else set()))
        dependencies = block.get("dependencies", [])
        if not isinstance(dependencies, list) or set(dependencies) - set(names):
            raise ValueError("Unknown dependency")
        graph[block["name"]] = dependencies
        task(block["task"])
    visited = set()

    def visit(name: str, ancestors: set[str]) -> None:
        if name in ancestors:
            raise ValueError("Block dependency cycle")
        if name not in visited:
            for dependency in graph[name]:
                visit(dependency, ancestors | {name})
            visited.add(name)

    for name in graph:
        visit(name, set())
    for promotion in config.get("promotions", []):
        # Native promotions must remain manual until the owner authorizes cost
        # and access to trusted, privileged self-hosted hardware.
        keys(promotion, {"name", "pipeline_file"}, {"name", "pipeline_file"})
        destination = (path.parent / promotion["pipeline_file"]).resolve()
        if destination.parent != path.parent.resolve() or not destination.is_file():
            raise ValueError("Missing or out-of-directory promotion pipeline")


def main() -> None:
    files = sorted((ROOT / ".semaphore").glob("*.yml"))
    for path in files:
        validate(load(path), path)
    for name in ["setup.sh", "validate.sh"]:
        subprocess.run(["bash", "-n", str(ROOT / "scripts/ci" / name)], check=True)
    # spc is supplied by Semaphore's toolbox. sem has no documented validate
    # subcommand. Use the real compiler if installed; never contact an org.
    compiler = shutil.which("spc")
    if compiler:
        with tempfile.TemporaryDirectory(prefix="semaphore-config-") as directory:
            for path in files:
                subprocess.run([compiler, "compile", "--input", str(path), "--output", str(Path(directory) / path.name),
                                "--logs", str(Path(directory) / f"{path.stem}.jsonl")], cwd=ROOT, check=True)
    print(json.dumps({"pipelines": len(files), "yaml_and_repository_contract": "passed",
                      "bash_syntax": "passed", "official_spc": "passed" if compiler else "not installed; not executed",
                      "remote_execution": "not performed"}, indent=2))


if __name__ == "__main__":
    main()
