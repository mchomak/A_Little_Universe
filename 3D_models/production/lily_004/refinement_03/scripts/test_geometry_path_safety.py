"""Regression tests for geometry author/verifier output-path safety."""

import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPTS = Path(__file__).resolve().parent


def load_script(name, scripts=SCRIPTS):
    script = scripts / name
    spec = importlib.util.spec_from_file_location(f"path_safety_{script.stem}", script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    bpy = types.ModuleType("bpy")
    bpy.data = types.SimpleNamespace(filepath="")
    mathutils = types.ModuleType("mathutils")
    mathutils.Vector = lambda *args: None
    bvhtree = types.ModuleType("mathutils.bvhtree")
    bvhtree.BVHTree = object
    with patch.dict(sys.modules, {"bpy": bpy, "mathutils": mathutils,
                                  "mathutils.bvhtree": bvhtree}):
        spec.loader.exec_module(module)
    return module


def fast_author_patches(module):
    module.bpy.data.objects = {name: object() for name in ("Petals", "Petals_Outside")}
    module.bpy.context = types.SimpleNamespace(
        scene=types.SimpleNamespace(
            render=types.SimpleNamespace(fps=24, fps_base=1), frame_set=lambda _frame: None),
        preferences=types.SimpleNamespace(filepaths=types.SimpleNamespace(save_version=1)))

    def save_as_mainfile(filepath):
        Path(filepath).write_bytes(b"overwritten by unsafe author run")
        return {"FINISHED"}

    def export_gltf(filepath, **_kwargs):
        Path(filepath).write_bytes(b"generated test GLB")
        return {"FINISHED"}

    module.bpy.ops = types.SimpleNamespace(
        wm=types.SimpleNamespace(save_as_mainfile=save_as_mainfile),
        export_scene=types.SimpleNamespace(gltf=export_gltf))
    expected_source_clips = {
        "Growth": 16.0, "IdleClosed": 8.0, "TouchResponse": 2.0,
        "Bloom": 16.0, "IdleOpen": 8.0, "DissolveReady": 1.0,
    }
    return (
        patch.object(module, "collect_clip_durations", return_value=expected_source_clips),
        patch.object(module, "inventory_shape_keys", return_value={"keys": []}),
        patch.object(module, "sample_bloom_bend", return_value=[{"magnitude_m": 0.0}]),
        patch.object(module, "render_studies"),
        patch.object(module, "smooth_target_deltas", return_value={}),
        patch.object(module, "sculpt_open_tip_profile", return_value={"_reference_open_positions": {}}),
        patch.object(module, "retime_clips", return_value={}),
        patch.object(module, "add_growth_bud_profile", return_value={}),
        patch.object(module, "animate_growth_bud_profile", return_value={}),
        patch.object(module, "clip_durations", return_value=module.CLIP_SECONDS),
        patch.object(module, "triangulate_tepal_surfaces", return_value={}),
        patch.object(module, "compare_evaluated_open_pose_to_v13", return_value={}),
    )


class GeometryOutputPathSafetyTests(unittest.TestCase):
    def test_author_rejects_output_root_outside_refinement_package_before_writing(self):
        module = load_script("refine_geometry_animation.py")
        with tempfile.TemporaryDirectory() as temporary:
            outside_root = Path(temporary) / "refinement_03"
            args = ["blender", "--", "--output-root", str(outside_root),
                    "--render-mode", "none"]
            with patch.object(sys, "argv", args):
                with self.assertRaisesRegex(RuntimeError, "outside.*package"):
                    module.main()
            self.assertFalse(outside_root.exists(), "rejected output root must remain untouched")

    def test_author_rejects_output_root_inside_read_only_baseline(self):
        with tempfile.TemporaryDirectory() as temporary:
            package = Path(temporary) / "refinement_03"
            scripts = package / "scripts"
            scripts.mkdir(parents=True)
            (scripts / "refine_geometry_animation.py").write_bytes(
                (SCRIPTS / "refine_geometry_animation.py").read_bytes())
            (scripts / "geometry_path_safety.py").write_bytes(
                (SCRIPTS / "geometry_path_safety.py").read_bytes())
            module = load_script("refine_geometry_animation.py", scripts)
            unsafe_root = package / "baseline" / "refinement_03"
            args = ["blender", "--", "--output-root", str(unsafe_root),
                    "--render-mode", "none"]
            with patch.object(sys, "argv", args):
                with self.assertRaisesRegex(RuntimeError, "read-only baseline"):
                    module.main()
            self.assertFalse(unsafe_root.exists(), "baseline tree must remain untouched")

    def test_verifier_rejects_output_root_outside_refinement_package_before_writing(self):
        module = load_script("verify_geometry.py")
        with tempfile.TemporaryDirectory() as temporary:
            outside_root = Path(temporary) / "refinement_03"
            (outside_root / "baseline").mkdir(parents=True)
            (outside_root / "baseline" / "lily_004_v13_final.blend").write_bytes(b"read-only")
            args = ["blender", "--", "--output-root", str(outside_root)]
            module.bpy.context = types.SimpleNamespace(
                scene=types.SimpleNamespace(render=types.SimpleNamespace(fps=24, fps_base=1)))
            stubs = (
                patch.object(module, "validate_clip_durations", return_value=([], [])),
                patch.object(module, "validate_topology_and_winding", return_value=({}, [])),
                patch.object(module, "open_profile_metrics", return_value={}),
                patch.object(module, "growth_evidence", return_value=({}, [])),
                patch.object(module, "boundary_checks", return_value=[]),
                patch.object(module, "dense_pose_checks", return_value=({}, [])),
                patch.object(module, "glb_check", return_value=({}, [])),
            )
            with patch.object(sys, "argv", args), stubs[0], stubs[1], stubs[2], stubs[3], stubs[4], stubs[5], stubs[6]:
                with self.assertRaisesRegex(RuntimeError, "outside.*package"):
                    module.main()
            self.assertFalse((outside_root / "reports").exists(), "rejected output root must not create reports")

    def test_author_rejects_output_blend_that_is_the_source_input(self):
        module = load_script("refine_geometry_animation.py")
        package_root = SCRIPTS.parent
        with tempfile.TemporaryDirectory(dir=package_root) as temporary:
            output_root = Path(temporary) / "refinement_03"
            source = output_root / "baseline" / "live_v2_04m_unsaved.blend"
            source.parent.mkdir(parents=True)
            original = b"source bytes must survive a rejected run"
            source.write_bytes(original)
            module.bpy.data.filepath = str(source)
            patches = fast_author_patches(module)
            args = ["blender", "--", "--output-root", str(output_root),
                    "--blend", "baseline/live_v2_04m_unsaved.blend",
                    "--render-mode", "none"]
            with patch.object(sys, "argv", args), patches[0], patches[1], patches[2], patches[3], \
                    patches[4], patches[5], patches[6], patches[7], patches[8], patches[9], \
                    patches[10], patches[11]:
                with self.assertRaisesRegex(RuntimeError, "overlapping input"):
                    module.main()
            self.assertEqual(source.read_bytes(), original, "rejected author run must preserve source bytes")

    def test_author_rejects_report_overwriting_source_input_and_preserves_bytes(self):
        module = load_script("refine_geometry_animation.py")
        package_root = SCRIPTS.parent
        with tempfile.TemporaryDirectory(dir=package_root) as temporary:
            output_root = Path(temporary) / "refinement_03"
            source = output_root / "baseline" / "live_v2_04m_unsaved.blend"
            source.parent.mkdir(parents=True)
            original = b"source bytes must survive a rejected report path"
            source.write_bytes(original)
            module.bpy.data.filepath = str(source)
            patches = fast_author_patches(module)
            args = ["blender", "--", "--output-root", str(output_root),
                    "--report", "baseline/live_v2_04m_unsaved.blend", "--render-mode", "none"]
            with patch.object(sys, "argv", args), patches[0], patches[1], patches[2], patches[3], \
                    patches[4], patches[5], patches[6], patches[7], patches[8], patches[9], \
                    patches[10], patches[11]:
                with self.assertRaisesRegex(RuntimeError, "overlapping input"):
                    module.main()
            self.assertEqual(source.read_bytes(), original, "rejected report path must preserve source bytes")

    def test_author_rejects_report_and_glb_output_collision_before_writing(self):
        module = load_script("refine_geometry_animation.py")
        package_root = SCRIPTS.parent
        with tempfile.TemporaryDirectory(dir=package_root) as temporary:
            output_root = Path(temporary) / "refinement_03"
            source = output_root / "baseline" / "live_v2_04m_unsaved.blend"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"author source sentinel")
            shared_output = output_root / "export" / "candidate.glb"
            shared_output.parent.mkdir()
            original = b"export/report sentinel bytes"
            shared_output.write_bytes(original)
            module.bpy.data.filepath = str(source)
            patches = fast_author_patches(module)
            args = ["blender", "--", "--output-root", str(output_root),
                    "--glb", "export/candidate.glb", "--report", "export/candidate.glb",
                    "--render-mode", "none"]
            with patch.object(sys, "argv", args), patches[0], patches[1], patches[2], patches[3], \
                    patches[4], patches[5], patches[6], patches[7], patches[8], patches[9], \
                    patches[10], patches[11]:
                with self.assertRaisesRegex(RuntimeError, "overlapping geometry outputs"):
                    module.main()
            self.assertEqual(shared_output.read_bytes(), original,
                             "rejected GLB/report collision must preserve sentinel bytes")

    def test_verifier_rejects_report_overwriting_glb_input_and_preserves_bytes(self):
        module = load_script("verify_geometry.py")
        package_root = SCRIPTS.parent
        with tempfile.TemporaryDirectory(dir=package_root) as temporary:
            output_root = Path(temporary) / "refinement_03"
            baseline_reference = output_root / "baseline" / "lily_004_v13_final.blend"
            baseline_reference.parent.mkdir(parents=True)
            baseline_reference.write_bytes(b"baseline reference bytes")
            glb = output_root / "export" / "candidate.glb"
            glb.parent.mkdir()
            original = b"GLB bytes must survive a rejected report path"
            glb.write_bytes(original)
            module.bpy.context = types.SimpleNamespace(
                scene=types.SimpleNamespace(render=types.SimpleNamespace(fps=24, fps_base=1)))
            patches = (
                patch.object(module, "validate_clip_durations", return_value=([], [])),
                patch.object(module, "validate_topology_and_winding", return_value=({}, [])),
                patch.object(module, "open_profile_metrics", return_value={}),
            )
            args = ["blender", "--", "--output-root", str(output_root),
                    "--glb", "export/candidate.glb", "--report", "export/candidate.glb",
                    "--open-profile-only"]
            with patch.object(sys, "argv", args), patches[0], patches[1], patches[2]:
                with self.assertRaisesRegex(RuntimeError, "overlapping input"):
                    module.main()
            self.assertEqual(glb.read_bytes(), original, "rejected report path must preserve GLB bytes")

    def test_verifier_rejects_report_overwriting_baseline_and_preserves_bytes(self):
        module = load_script("verify_geometry.py")
        package_root = SCRIPTS.parent
        with tempfile.TemporaryDirectory(dir=package_root) as temporary:
            output_root = Path(temporary) / "refinement_03"
            baseline = output_root / "baseline" / "lily_004_v13_final.blend"
            baseline.parent.mkdir(parents=True)
            original = b"baseline bytes must survive a rejected report path"
            baseline.write_bytes(original)
            glb = output_root / "export" / "candidate.glb"
            glb.parent.mkdir()
            glb.write_bytes(b"test glb")
            module.bpy.context = types.SimpleNamespace(
                scene=types.SimpleNamespace(render=types.SimpleNamespace(fps=24, fps_base=1)))
            patches = (
                patch.object(module, "validate_clip_durations", return_value=([], [])),
                patch.object(module, "validate_topology_and_winding", return_value=({}, [])),
                patch.object(module, "open_profile_metrics", return_value={}),
            )
            args = ["blender", "--", "--output-root", str(output_root),
                    "--glb", "export/candidate.glb",
                    "--report", "baseline/lily_004_v13_final.blend", "--open-profile-only"]
            with patch.object(sys, "argv", args), patches[0], patches[1], patches[2]:
                with self.assertRaisesRegex(RuntimeError, "overlapping input|protected read-only tree"):
                    module.main()
            self.assertEqual(baseline.read_bytes(), original,
                             "rejected report path must preserve baseline bytes")


if __name__ == "__main__":
    unittest.main()
