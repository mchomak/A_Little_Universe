import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import render_comparison

comparison_checkpoints = render_comparison.comparison_checkpoints
render_engine_name = getattr(render_comparison, "render_engine_name", None)
viewer_camera_to_blender = getattr(render_comparison, "viewer_camera_to_blender", None)
activate_nla_clip = getattr(render_comparison, "activate_nla_clip", None)
sample_color_factor = getattr(render_comparison, "sample_color_factor", None)
set_render_asset_visibility = getattr(render_comparison, "set_render_asset_visibility", None)
capture_asset_rest_state = getattr(render_comparison, "capture_asset_rest_state", None)
restore_asset_rest_state = getattr(render_comparison, "restore_asset_rest_state", None)


class ComparisonCheckpointTests(unittest.TestCase):
    def test_checkpoints_use_each_exported_clip_duration(self):
        self.assertIsNotNone(comparison_checkpoints)

        self.assertEqual(
            comparison_checkpoints(
                {"Growth": 16.0, "Bloom": 16.0},
                {"Growth": 9.0, "Bloom": 8.0},
            ),
            [
                {"clip": "Growth", "label": "end", "beforeSeconds": 16.0, "afterSeconds": 9.0},
                {"clip": "Bloom", "label": "start", "beforeSeconds": 0.0, "afterSeconds": 0.0},
                {"clip": "Bloom", "label": "mid", "beforeSeconds": 8.0, "afterSeconds": 4.0},
                {"clip": "Bloom", "label": "end", "beforeSeconds": 16.0, "afterSeconds": 8.0},
            ],
        )

    def test_eevee_selection_uses_an_available_blender_engine_id(self):
        self.assertIsNotNone(render_engine_name)
        self.assertEqual(render_engine_name(("BLENDER_EEVEE", "BLENDER_WORKBENCH", "CYCLES")), "BLENDER_EEVEE")

    def test_viewer_camera_is_converted_from_gltf_y_up_to_blender_z_up(self):
        self.assertIsNotNone(viewer_camera_to_blender)
        self.assertEqual(
            viewer_camera_to_blender((1.35, 1.18, 2.35), (0.0, 0.54, 0.1)),
            {"position": (1.35, -2.35, 1.18), "target": (0.0, -0.1, 0.54)},
        )

    def test_nla_selection_clears_imported_active_action(self):
        self.assertIsNotNone(activate_nla_clip)
        growth = SimpleNamespace(name="Growth", mute=False)
        bloom = SimpleNamespace(name="Bloom", mute=True)
        data = SimpleNamespace(action=growth, nla_tracks=[growth, bloom])

        activate_nla_clip(data, "Bloom")

        self.assertIsNone(data.action)
        self.assertTrue(growth.mute)
        self.assertFalse(bloom.mute)

    def test_metadata_color_sampling_uses_absolute_growth_time_and_clamps_endpoints(self):
        self.assertIsNotNone(sample_color_factor, "render_comparison.py must sample metadata color by absolute clip time")
        factor = {
            "material": "Petal_Pearl",
            "keyframes": [
                {"timeSeconds": 0.0, "linearSrgbFactor": [0.2, 0.47, 0.2]},
                {"timeSeconds": 4.5, "linearSrgbFactor": [0.38, 0.59, 0.31]},
                {"timeSeconds": 9.0, "linearSrgbFactor": [1.0, 1.0, 1.0]},
            ],
        }

        self.assertEqual(sample_color_factor(factor, -1.0), (0.2, 0.47, 0.2))
        self.assertEqual(sample_color_factor(factor, 4.5), (0.38, 0.59, 0.31))
        self.assertEqual(sample_color_factor(factor, 9.0), (1.0, 1.0, 1.0))
        self.assertEqual(sample_color_factor(factor, 10.0), (1.0, 1.0, 1.0))

    def test_cli_rejects_report_path_that_overwrites_an_input_glb(self):
        root = render_comparison.ROOT
        argv = [
            "render_comparison.py",
            "--baseline-glb", str(root / "baseline" / "lily_004_animated.glb"),
            "--final-glb", str(root / "export" / "lily_004_refined.glb"),
            "--maturation-json", str(root / "export" / "bud_maturation.json"),
            "--output-root", str(root),
            "--report", str(root / "export" / "lily_004_refined.glb"),
        ]

        with patch.object(sys, "argv", argv), self.assertRaises(SystemExit):
            render_comparison._args()

    def test_cli_rejects_reports_inside_read_only_baseline_and_primary_trees(self):
        root = render_comparison.ROOT
        for report in (root / "baseline" / "checksums.sha256",
                       Path("C:/Users/McHomak/Projects/A_Little_Universe/unsafe-report.json")):
            argv = [
                "render_comparison.py",
                "--baseline-glb", str(root / "baseline" / "lily_004_animated.glb"),
                "--final-glb", str(root / "export" / "lily_004_refined.glb"),
                "--maturation-json", str(root / "export" / "bud_maturation.json"),
                "--output-root", str(root),
                "--report", str(report),
            ]
            with self.subTest(report=report), patch.object(sys, "argv", argv), self.assertRaises(SystemExit):
                render_comparison._args()


class RenderAssetIsolationTests(unittest.TestCase):
    def test_each_render_hides_every_non_selected_asset_collection(self):
        self.assertIsNotNone(set_render_asset_visibility)
        before = {"collection": SimpleNamespace(hide_render=False)}
        after = {"collection": SimpleNamespace(hide_render=False)}

        set_render_asset_visibility((before, after), after)

        self.assertTrue(before["collection"].hide_render)
        self.assertFalse(after["collection"].hide_render)

        set_render_asset_visibility((before, after), before)

        self.assertFalse(before["collection"].hide_render)
        self.assertTrue(after["collection"].hide_render)

    def test_pose_reset_restores_imported_transforms_and_shape_keys_and_clears_nla_state(self):
        self.assertIsNotNone(capture_asset_rest_state)
        self.assertIsNotNone(restore_asset_rest_state)
        track = SimpleNamespace(mute=False)
        action = object()
        slot = object()
        animation = SimpleNamespace(action=action, action_slot=slot, nla_tracks=[track])
        key_block = SimpleNamespace(value=0.25)
        shape_keys = SimpleNamespace(key_blocks=[key_block], animation_data=None)
        obj = SimpleNamespace(
            type="MESH",
            location=(1.0, 2.0, 3.0),
            rotation_mode="XYZ",
            rotation_euler=(0.1, 0.2, 0.3),
            rotation_quaternion=(1.0, 0.0, 0.0, 0.0),
            rotation_axis_angle=(0.0, 0.0, 0.0, 1.0),
            scale=(1.0, 1.0, 1.0),
            delta_location=(0.0, 0.0, 0.0),
            delta_rotation_euler=(0.0, 0.0, 0.0),
            delta_scale=(1.0, 1.0, 1.0),
            data=SimpleNamespace(shape_keys=shape_keys),
            animation_data=animation,
        )
        asset = {"objects": [obj], "restState": capture_asset_rest_state([obj])}
        obj.location = (9.0, 9.0, 9.0)
        obj.rotation_euler = (1.0, 1.0, 1.0)
        key_block.value = 0.9

        restore_asset_rest_state(asset)

        self.assertEqual(obj.location, (1.0, 2.0, 3.0))
        self.assertEqual(obj.rotation_euler, (0.1, 0.2, 0.3))
        self.assertEqual(key_block.value, 0.25)
        self.assertIsNone(animation.action)
        self.assertIsNone(animation.action_slot)
        self.assertTrue(track.mute)


if __name__ == "__main__":
    unittest.main()
