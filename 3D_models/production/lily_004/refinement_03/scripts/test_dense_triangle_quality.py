"""Dense source and exported-GLB triangle quality integration check."""

import bpy
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
import verify_geometry


scene = bpy.context.scene
fps = scene.render.fps / scene.render.fps_base
source_topology = {}
for name in ("Petals", "Petals_Outside"):
    mesh = bpy.data.objects[name].data
    mesh.calc_loop_triangles()
    assert len(mesh.vertices) == 2970, (name, len(mesh.vertices))
    assert len(mesh.polygons) == 5376 and all(len(poly.vertices) == 3 for poly in mesh.polygons), name
    source_topology[name] = {tuple(sorted(triangle.vertices)) for triangle in mesh.loop_triangles}
dense, failures = verify_geometry.dense_pose_checks(scene, fps)
assert dense["triangle_tessellation"] == "evaluated mesh.loop_triangles", dense
assert dense["degenerate_triangle_count"] == 0, dense
assert dense["minimum_triangle_area_ratio"] > verify_geometry.MIN_TRIANGLE_AREA_RATIO, dense
assert not any("degenerate" in item.get("error", "").lower() for item in failures), failures
assert dense["normal_fold_events_outside_attachment"] == 0, dense
assert dense["temporal_normal_flip_events_outside_attachment"] == 0, dense
assert dense["root_attachment_normal_discontinuities"] == sum(
    item["count"] for item in dense["root_attachment_normal_discontinuities_by_clip_island"].values()
), dense

glb_path = Path(bpy.data.filepath).resolve().parent.parent / "export" / "lily_004_geometry.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
result = bpy.ops.import_scene.gltf(filepath=str(glb_path))
assert result == {"FINISHED"}, result
for name in ("Petals", "Petals_Outside"):
    obj = bpy.data.objects[name]
    mesh = obj.data
    mesh.calc_loop_triangles()
    exported_topology = {tuple(sorted(triangle.vertices)) for triangle in mesh.loop_triangles}
    qualities = []
    for tri in mesh.loop_triangles:
        a, b, c = (mesh.vertices[index].co for index in tri.vertices)
        max_edge_squared = max((b - a).length_squared, (c - b).length_squared,
                               (a - c).length_squared)
        area_twice = (b - a).cross(c - a).length
        qualities.append(area_twice / max_edge_squared if max_edge_squared else 0.0)
    assert len(mesh.polygons) == 5376 and all(len(poly.vertices) == 3 for poly in mesh.polygons), name
    assert exported_topology == source_topology[name], (name, len(exported_topology), len(source_topology[name]))
    assert min(qualities) > verify_geometry.MIN_TRIANGLE_AREA_RATIO, (name, min(qualities))
print(f"DENSE_TRIANGLE_TEST PASS source_min_ratio={dense['minimum_triangle_area_ratio']:.9g}")
