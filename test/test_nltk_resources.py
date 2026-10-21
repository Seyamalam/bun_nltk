"""Offline security and integrity tests for explicit NLTK resource provisioning."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location(
    "nltk_resources", Path(__file__).resolve().parents[1] / "scripts/nltk-resources.py")
resources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resources)


class ResourceTests(unittest.TestCase):
    def archive(self, entries):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            for name, value in entries:
                archive.writestr(name, value)
        return output.getvalue()

    def test_locked_default_selection(self):
        self.assertEqual([p["id"] for p in resources.selected_resources(
            ",".join(resources.DEFAULT_RESOURCES))], list(resources.DEFAULT_RESOURCES))
        for value in ["", "wordnet,wordnet", "unreviewed"]:
            with self.assertRaises(ValueError):
                resources.selected_resources(value)

    def test_member_boundaries(self):
        self.assertEqual(resources.members(self.archive([("wordnet/data.noun", b"x")]),
                                           "wordnet"), [("wordnet/data.noun", b"x")])
        for name in ["../escape", "/wordnet/escape", "wordnet/../escape",
                     "other/data", "wordnet\\escape"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                resources.members(self.archive([(name, b"x")]), "wordnet")

    def test_duplicate_member(self):
        with self.assertWarns(UserWarning):
            data = self.archive([("wordnet/data", b"a"), ("wordnet/data", b"b")])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            resources.members(data, "wordnet")
        data = self.archive([("wordnet/data", b"a"), ("wordnet/./data", b"b")])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            resources.members(data, "wordnet")

    def test_symlink_and_special_members(self):
        for mode in (0o120777, 0o060600, 0o020600):
            entry = zipfile.ZipInfo("wordnet/data")
            entry.external_attr = mode << 16
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                resources.members(self.archive([(entry, b"x")]), "wordnet")

    def test_empty_and_expansion_limits(self):
        with self.assertRaisesRegex(ValueError, "Empty"):
            resources.members(self.archive([]), "wordnet")
        data = self.archive([("wordnet/a", b"1234"), ("wordnet/b", b"1234")])
        with patch.object(resources, "MAX_MEMBERS", 1), self.assertRaises(ValueError):
            resources.members(data, "wordnet")
        with patch.object(resources, "MAX_EXTRACTED_BYTES", 7), self.assertRaises(ValueError):
            resources.members(data, "wordnet")

    def test_preexisting_symlink_rejected(self):
        with tempfile.TemporaryDirectory(dir="/tmp/opencode") as tmp:
            root = Path(tmp)
            (root / "taggers").symlink_to(root / "outside")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                resources.destination(root, "taggers/model.json")
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                resources.destination(root, "../escape")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                resources.destination(root / "taggers" / "nested", "model.json")

    def test_archive_hash_checked_offline(self):
        with tempfile.TemporaryDirectory(dir="/tmp/opencode") as tmp:
            root = Path(tmp)
            (root / "test.zip").write_bytes(b"data")
            with patch.object(resources, "download", side_effect=AssertionError("network")):
                self.assertEqual(resources.resource_bytes(root, "test.zip",
                                                          resources.sha256(b"data")), b"data")
                with self.assertRaisesRegex(ValueError, "checksum"):
                    resources.resource_bytes(root, "test.zip", "0" * 64)

    def test_check_detects_extracted_drift_without_network(self):
        archive = self.archive([("fixture/data", b"verified")])
        package = {"id": "fixture", "subdir": "corpora", "unzip": True,
                   "sha256": resources.sha256(archive)}
        index = (f'<nltk_data><packages><package id="fixture" '
                 f'sha256_checksum="{package["sha256"]}" license="Test" />'
                 '</packages></nltk_data>').encode()
        lock = {"revision": "offline-test", "indexSha256": resources.sha256(index)}
        with tempfile.TemporaryDirectory(dir="/tmp/opencode") as tmp:
            root = Path(tmp)
            (root / "index.xml").write_bytes(index)
            (root / "corpora/fixture").mkdir(parents=True)
            (root / "corpora/fixture.zip").write_bytes(archive)
            data = root / "corpora/fixture/data"
            data.write_bytes(b"verified")
            with patch.object(resources, "LOCK", lock), patch.object(
                    resources, "download", side_effect=AssertionError("network")):
                self.assertTrue(resources.verify(root, [package])["resources"][0]["verified"])
                data.write_bytes(b"corrupt!")
                with self.assertRaisesRegex(ValueError, "Extracted fixture mismatch"):
                    resources.verify(root, [package])

    def test_download_hash_and_byte_limit(self):
        with patch.object(resources.urllib.request, "urlopen", return_value=io.BytesIO(b"data")):
            self.assertEqual(resources.download("https://invalid.test/archive", resources.sha256(b"data")), b"data")
        with patch.object(resources.urllib.request, "urlopen", return_value=io.BytesIO(b"data")):
            with self.assertRaisesRegex(ValueError, "SHA256"):
                resources.download("https://invalid.test/archive", "0" * 64)
        with patch.object(resources, "MAX_DOWNLOAD_BYTES", 3), patch.object(
                resources.urllib.request, "urlopen", return_value=io.BytesIO(b"data")):
            with self.assertRaisesRegex(ValueError, "download limit"):
                resources.download("https://invalid.test/archive", resources.sha256(b"data"))


if __name__ == "__main__":
    unittest.main()
