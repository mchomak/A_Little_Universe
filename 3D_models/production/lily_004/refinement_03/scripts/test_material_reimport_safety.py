from __future__ import annotations

import hashlib
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_DIR = Path(__file__).resolve().parent
REFINEMENT_ROOT = SCRIPT_DIR.parent
GLB = REFINEMENT_ROOT / "export" / "lily_004_material_study.glb"


def load_checker():
    spec = importlib.util.spec_from_file_location("check_material_reimport_under_test", SCRIPT_DIR / "check_material_reimport.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"bpy": types.ModuleType("bpy")}):
        spec.loader.exec_module(module)
    return module


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class MaterialReimportSafetyTests(unittest.TestCase):
    def test_report_cannot_overwrite_glb_input(self) -> None:
        self.assertTrue(GLB.is_file(), f"test GLB is missing: {GLB}")
        before = sha256(GLB)
        checker = load_checker()
        for report in (GLB, GLB.parent, GLB / "nested-report.json"):
            with self.subTest(report=report), patch.object(
                sys,
                "argv",
                ["check_material_reimport.py", "--", "--glb", str(GLB), "--report", str(report)],
            ):
                with self.assertRaises(SystemExit):
                    checker.parse_args()
        self.assertEqual(sha256(GLB), before, "rejected overlapping report paths changed the GLB input bytes")

    def test_report_cannot_target_tracked_baseline_or_primary_tree(self) -> None:
        checker = load_checker()
        baseline_report = REFINEMENT_ROOT / "baseline" / "must_not_write.json"
        primary_report = Path("C:/Users/McHomak/Projects/A_Little_Universe/unsafe-report.json")
        for report in (baseline_report, primary_report):
            with self.subTest(report=report), patch.object(
                sys,
                "argv",
                ["check_material_reimport.py", "--", "--glb", str(GLB), "--report", str(report)],
            ):
                with self.assertRaises(SystemExit):
                    checker.parse_args()
            self.assertFalse(report.exists(), f"safety check created a report in a protected tree: {report}")


if __name__ == "__main__":
    unittest.main()
