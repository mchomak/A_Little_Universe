import unittest
import sys
import struct
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify_final

VerificationError = verify_final.VerificationError
clip_inventory = verify_final.clip_inventory
require_pass_report = getattr(verify_final, "require_pass_report", None)
validate_growth_bvh_report = getattr(verify_final, "validate_growth_bvh_report", None)
summarize_gltf = getattr(verify_final, "summarize_gltf", None)
validate_pose_bounds_report = getattr(verify_final, "validate_pose_bounds_report", None)
validate_clip_boundary_bounds = getattr(verify_final, "validate_clip_boundary_bounds", None)


class ClipInventoryTests(unittest.TestCase):
    def test_clip_inventory_reads_zero_based_exported_accessors(self):
        self.assertIsNotNone(
            clip_inventory,
            "verify_final.py must expose clip_inventory for exported animation evidence",
        )
        document = {
            "accessors": [{"min": [0.0], "max": [9.0]}],
            "animations": [
                {"name": "Growth", "samplers": [{"input": 0}]},
            ],
        }

        self.assertEqual(
            clip_inventory(document),
            {"Growth": {"startSeconds": 0.0, "endSeconds": 9.0, "durationSeconds": 9.0}},
        )

    def test_final_clip_boundary_bounds_are_continuous(self):
        self.assertIsNotNone(validate_clip_boundary_bounds)
        bounds = {
            "min": [0.0, 0.0, 0.0],
            "max": [1.0, 2.0, 3.0],
            "dimensions": [1.0, 2.0, 3.0],
        }
        poses = {
            "Growth@9s": bounds,
            "IdleClosed@0s": bounds,
            "Bloom@0s": bounds,
            "Bloom@8s": bounds,
            "IdleOpen@0s": bounds,
        }

        validate_clip_boundary_bounds(poses)

        poses["Growth@9s"] = {**bounds, "max": [1.0, 1.9, 3.0]}
        with self.assertRaisesRegex(VerificationError, "Growth@9s.*IdleClosed@0s"):
            validate_clip_boundary_bounds(poses)

    def test_cli_rejects_report_path_that_overwrites_a_source_glb(self):
        root = Path(verify_final.__file__).resolve().parent.parent
        argv = [
            "verify_final.py",
            "--root", str(root),
            "--report", str(root / "export" / "lily_004_refined.glb"),
        ]

        with patch.object(sys, "argv", argv), self.assertRaises(SystemExit):
            verify_final._arguments()

    def test_clip_inventory_rejects_nonzero_export_start(self):
        self.assertIsNotNone(VerificationError)
        document = {
            "accessors": [{"min": [0.25], "max": [9.0]}],
            "animations": [{"name": "Growth", "samplers": [{"input": 0}]}],
        }

        with self.assertRaisesRegex(VerificationError, "not zero-based"):
            clip_inventory(document)

    def test_component_report_cannot_hide_findings_behind_pass_status(self):
        self.assertIsNotNone(require_pass_report)

        with self.assertRaisesRegex(VerificationError, "contains failures"):
            require_pass_report(
                {"status": "PASS", "failures": [{"error": "intersection"}]},
                "geometry",
            )

    def test_growth_bvh_report_is_bound_to_the_final_glb_and_covers_all_growth_frames(self):
        self.assertIsNotNone(
            validate_growth_bvh_report,
            "verify_final.py must validate independent Growth BVH evidence",
        )
        report = {
            "status": "PASS",
            "glbSha256": "a" * 64,
            "clip": "Growth",
            "durationSeconds": 9.0,
            "framesChecked": 217,
            "triangleCountPerIsland": [896] * 6,
            "intersectionEvents": [],
            "allowedRootContacts": 4,
        }

        result = validate_growth_bvh_report(report, expected_sha256="a" * 64)

        self.assertEqual(result["framesChecked"], 217)
        self.assertEqual(result["intersectionEvents"], 0)

    def test_growth_bvh_report_cannot_hide_truncated_intersections(self):
        report = {
            "status": "PASS",
            "glbSha256": "b" * 64,
            "clip": "Growth",
            "durationSeconds": 9.0,
            "framesChecked": 217,
            "intersectionEventCount": 1,
            "triangleCountPerIsland": [896] * 6,
            "intersectionEvents": [],
            "allowedRootContacts": 0,
        }

        with self.assertRaisesRegex(VerificationError, "intersection count"):
            validate_growth_bvh_report(report, expected_sha256="b" * 64)

    def test_gltf_summary_reports_parentage_triangles_and_world_bounds(self):
        self.assertIsNotNone(summarize_gltf, "verify_final.py must summarize exported hierarchy and geometry")
        binary = struct.pack(
            "<9f3H",
            0.0, 0.0, 0.0,
            2.0, 1.0, 0.0,
            1.0, 0.0, 0.0,
            0, 1, 2,
        )
        document = {
            "nodes": [
                {"name": "Lily_Root", "children": [1]},
                {"name": "Petals", "mesh": 0},
            ],
            "scenes": [{"nodes": [0]}],
            "scene": 0,
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
            "bufferViews": [
                {"buffer": 0, "byteOffset": 0, "byteLength": 36},
                {"buffer": 0, "byteOffset": 36, "byteLength": 6},
            ],
            "accessors": [
                {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
                {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"},
            ],
        }

        result = summarize_gltf(document, binary)

        self.assertEqual(result["nodes"]["Petals"]["parent"], "Lily_Root")
        self.assertEqual(result["meshes"]["Petals"]["triangleCount"], 1)
        self.assertEqual(result["worldBounds"]["dimensions"], [2.0, 1.0, 0.0])

    def test_pose_bounds_require_evaluated_open_and_bloom_endpoints_for_all_assets(self):
        self.assertIsNotNone(validate_pose_bounds_report, "verify_final.py must validate evaluated endpoint bounds")
        report = {
            "status": "PASS",
            "coordinateSystem": "glTF Y-up (bounds converted from Blender Z-up import)",
            "unit": "meter by Blender pipeline contract",
            "assets": {
                "baseline": {"sha256": "1" * 64, "clipDurationsSeconds": {"Growth": 16.0, "Bloom": 16.0, "IdleClosed": 8.0, "IdleOpen": 8.0}, "poses": {"base": {}, "Bloom@8s": {}, "IdleOpen@8s": {}}},
                "geometry": {"sha256": "2" * 64, "clipDurationsSeconds": {"Growth": 9.0, "Bloom": 8.0, "IdleClosed": 8.0, "IdleOpen": 8.0}, "poses": {"base": {}, "Bloom@8s": {}, "IdleOpen@8s": {}}},
                "final": {"sha256": "3" * 64, "clipDurationsSeconds": {"Growth": 9.0, "Bloom": 8.0, "IdleClosed": 8.0, "IdleOpen": 8.0}, "poses": {"base": {}, "Bloom@8s": {}, "IdleOpen@8s": {}}},
            },
        }

        with self.assertRaisesRegex(VerificationError, "evaluated pose bounds"):
            validate_pose_bounds_report(report, {"baseline": "1" * 64, "geometry": "2" * 64, "final": "3" * 64})

    def test_gltf_summary_applies_sparse_morph_deltas_and_default_node_weights(self):
        binary = struct.pack(
            "<9f3H H3f",
            0.0, 0.0, 0.0,
            1.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            0, 1, 2,
            1,
            1.0, 0.0, 0.0,
        )
        document = {
            "nodes": [{"name": "Lily_Root", "children": [1]}, {"name": "Petals", "mesh": 0, "weights": [0.5]}],
            "scenes": [{"nodes": [0]}], "scene": 0,
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1,
                                           "targets": [{"POSITION": 2}]}]}],
            "bufferViews": [
                {"buffer": 0, "byteOffset": 0, "byteLength": 36},
                {"buffer": 0, "byteOffset": 36, "byteLength": 6},
                {"buffer": 0, "byteOffset": 42, "byteLength": 2},
                {"buffer": 0, "byteOffset": 44, "byteLength": 12},
            ],
            "accessors": [
                {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
                {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"},
                {"componentType": 5126, "count": 3, "type": "VEC3",
                 "sparse": {"count": 1, "indices": {"bufferView": 2, "componentType": 5123},
                            "values": {"bufferView": 3}}},
            ],
        }

        result = summarize_gltf(document, binary)

        self.assertEqual(result["worldBounds"]["dimensions"], [1.0, 1.0, 0.0])
        self.assertEqual(result["defaultWeightsBounds"]["dimensions"], [1.5, 1.0, 0.0])
        self.assertEqual(result["morphEnvelopeBounds"]["dimensions"], [2.0, 1.0, 0.0])


if __name__ == "__main__":
    unittest.main()
