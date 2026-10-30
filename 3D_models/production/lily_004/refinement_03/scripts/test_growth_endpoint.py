"""Focused Blender integration check for the Growth -> IdleClosed petal seam."""

import bpy
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
import verify_geometry


scene = bpy.context.scene
fps = scene.render.fps / scene.render.fps_base
report, failures = verify_geometry.growth_evidence(scene, fps)

delta = report["growth_endpoint_against_idle_closed_max_vertex_delta_m"]
assert delta <= verify_geometry.BOUNDARY_TOLERANCE_M, delta
assert not any("GrowthBudForm" in item.get("error", "") for item in failures), failures
print(f"GROWTH_ENDPOINT_TEST PASS max_vertex_delta_m={delta:.9f}")
