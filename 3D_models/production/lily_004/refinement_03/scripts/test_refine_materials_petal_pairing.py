from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().with_name("refine_materials.py")


def load_refine_materials():
    spec = importlib.util.spec_from_file_location("refine_materials_petal_pairing_test", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    mathutils = types.ModuleType("mathutils")
    mathutils.Vector = lambda values: tuple(values)
    with patch.dict(sys.modules, {"bpy": types.ModuleType("bpy"), "mathutils": mathutils}):
        spec.loader.exec_module(module)
    return module


class Normal:
    def __init__(self, x: float, y: float, z: float) -> None:
        self.xyz = (x, y, z)

    def dot(self, other: "Normal") -> float:
        return sum(a * b for a, b in zip(self.xyz, other.xyz))


class Face:
    def __init__(self, vertices: tuple[int, ...], normal: Normal) -> None:
        self.vertices = vertices
        self.normal = normal


class PetalFacePairingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.validator = load_refine_materials().validate_petal_face_pairing

    def test_opposite_wound_faces_pair_by_signature_after_reordering(self) -> None:
        inner = [
            Face((0, 1, 2), Normal(0, 0, 1)),
            Face((2, 3, 0), Normal(0, 1, 0)),
        ]
        outer = [
            Face((0, 3, 2), Normal(0, -1, 0)),
            Face((1, 2, 0), Normal(0, 0, -1)),
        ]
        dots = self.validator(inner, outer)
        self.assertEqual(dots, [-1.0, -1.0])

    def test_mismatched_face_geometry_is_rejected(self) -> None:
        inner = [Face((0, 1, 2), Normal(0, 0, 1)), Face((2, 3, 0), Normal(0, 1, 0))]
        outer = [Face((0, 3, 2), Normal(0, -1, 0)), Face((1, 2, 4), Normal(0, 0, -1))]
        with self.assertRaisesRegex(RuntimeError, "mismatched face topology"):
            self.validator(inner, outer)

    def test_same_winding_is_rejected(self) -> None:
        inner = [Face((0, 1, 2), Normal(0, 0, 1)), Face((2, 3, 0), Normal(0, 1, 0))]
        outer = [Face((0, 3, 2), Normal(0, -1, 0)), Face((1, 2, 0), Normal(0, 0, 1))]
        with self.assertRaisesRegex(RuntimeError, "consistently opposite face normals"):
            self.validator(inner, outer)


if __name__ == "__main__":
    unittest.main()
