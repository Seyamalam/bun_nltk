import copy
import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

import yaml


def module(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / file)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


config = module("semaphore_config", "validate-config.py")
oracle = module("semaphore_oracle", "oracle.py")


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.path = config.ROOT / ".semaphore/semaphore.yml"
        self.value = config.load(self.path)

    def test_all_pipelines(self):
        for path in (config.ROOT / ".semaphore").glob("*.yml"):
            config.validate(config.load(path), path)

    def test_duplicate_yaml_key(self):
        with self.assertRaisesRegex(ValueError, "Duplicate YAML"):
            yaml.load("version: v1.0\nversion: v2.0\n", Loader=config.UniqueLoader)

    def test_rejects_hosted_windows(self):
        self.value["agent"]["machine"] = {"type": "windows-latest"}
        with self.assertRaisesRegex(ValueError, "Unreviewed runner"):
            config.validate(self.value, self.path)

    def test_rejects_wrong_macos_image(self):
        self.value["agent"]["machine"] = {"type": "a2-standard-4", "os_image": "macos-14"}
        with self.assertRaisesRegex(ValueError, "Unreviewed runner"):
            config.validate(self.value, self.path)

    def test_unknown_dependency(self):
        self.value["blocks"][0]["dependencies"] = ["missing"]
        with self.assertRaisesRegex(ValueError, "Unknown dependency"):
            config.validate(self.value, self.path)

    def test_dependency_cycle(self):
        self.value["blocks"][0]["dependencies"] = [self.value["blocks"][0]["name"]]
        with self.assertRaisesRegex(ValueError, "cycle"):
            config.validate(self.value, self.path)

    def test_all_dependencies_required_when_any_explicit(self):
        del self.value["blocks"][0]["dependencies"]
        with self.assertRaisesRegex(ValueError, "Invalid or missing keys"):
            config.validate(self.value, self.path)

    def test_no_automatic_native_promotions(self):
        self.value["promotions"][0]["auto_promote"] = {"when": "true"}
        with self.assertRaises(ValueError):
            config.validate(self.value, self.path)

    def test_commands_cannot_be_yaml_mappings(self):
        value = copy.deepcopy(self.value)
        value["blocks"][0]["task"]["jobs"][0]["commands"] = [{"echo": "hello"}]
        with self.assertRaisesRegex(ValueError, "Commands must"):
            config.validate(value, self.path)

    def test_no_missing_promotion_files(self):
        self.value["promotions"][0]["pipeline_file"] = "missing.yml"
        with self.assertRaisesRegex(ValueError, "Missing"):
            config.validate(self.value, self.path)


class OracleArchiveTests(unittest.TestCase):
    def archive(self, name: str) -> bytes:
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr(name, b"fixture")
        return output.getvalue()

    def test_valid_members(self):
        self.assertEqual(oracle.archive_members(self.archive("treebank/file.txt"), "treebank"),
                         [("treebank/file.txt", b"fixture")])

    def test_traversal_and_wrong_package_rejected(self):
        for name in ["../file", "/treebank/file", "treebank/../../file", "other/file", "treebank\\file"]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "Unsafe"):
                oracle.archive_members(self.archive(name), "treebank")

    def test_symlink_rejected(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            entry = zipfile.ZipInfo("treebank/link")
            entry.external_attr = 0o120777 << 16
            archive.writestr(entry, "../../outside")
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            oracle.archive_members(output.getvalue(), "treebank")


if __name__ == "__main__":
    unittest.main()
