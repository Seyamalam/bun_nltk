import json
from pathlib import Path
import sys
from unittest.mock import patch
import unittest

from test_config import oracle

ROOT = Path(__file__).resolve().parents[2]


class IntegrationContractTests(unittest.TestCase):
    def test_inventory_and_ci_share_exact_python_pin(self):
        versions = json.loads((ROOT / "scripts/ci/versions.json").read_text())
        inventory = json.loads((ROOT / "compatibility/inventory.json").read_text())
        self.assertEqual(versions["python"], "3.14.4")
        self.assertEqual(versions["python"], inventory["pythonVersion"])
        with patch.object(sys, "version_info", (3, 12, 12)):
            with self.assertRaisesRegex(ValueError, "Expected Python 3.14.4"):
                oracle.check_python()

    def test_wheels_are_fully_hash_locked(self):
        rows = (ROOT / "scripts/ci/oracle-requirements.txt").read_text().splitlines()
        pins = [row for row in rows if row and not row.startswith("#")]
        self.assertEqual(len(pins), 10)
        for row in pins:
            self.assertRegex(row, r"^[\w-]+==[\d.]+ --hash=sha256:[0-9a-f]{64}$")
        self.assertIn("nltk==3.10.3", pins[0])

    def test_static_and_family_commands_are_wired(self):
        script = (ROOT / "scripts/ci/validate.sh").read_text()
        for command in ["compatibility:check", "compatibility:typecheck",
                        "scripts/build-nltk-compat.ts --check"]:
            self.assertIn(command, script)
        for family in ["tokenizers", "punkt", "metrics", "parsing"]:
            path = f"scripts/verify-{family}-portable.ts"
            self.assertTrue((ROOT / path).is_file())
            self.assertIn(path, script)
        self.assertIn("scripts/verify-parsing-packaged.ts", script)

    def test_both_rust_manifests_and_isolation_are_required(self):
        script = (ROOT / "scripts/ci/validate.sh").read_text()
        self.assertIn("for manifest in rust/Cargo.toml rust/compat/Cargo.toml", script)
        self.assertIn('cargo test --locked --manifest-path "$manifest"', script)
        self.assertIn('cargo clippy --locked --manifest-path "$manifest"', script)
        helper = (ROOT / "scripts/build-nltk-compat.ts").read_text()
        self.assertIn("process.env.CARGO_TARGET_DIR", helper)
        self.assertIn('"--locked"', helper)
        build = (ROOT / "scripts/ci/native-build.ts").read_text()
        self.assertIn('"cargo", "build", "--locked"', build)
        self.assertIn("copyFileSync(source", build)
        self.assertIn("cargo_lock_sha256", build)
        self.assertIn("--remap-path-prefix=", build)


if __name__ == "__main__":
    unittest.main()
