"""Independent Blender reimport check for lily_004_final.glb.

Run:
  blender --background --factory-startup --python-exit-code 1 \
    --python reimport_verify.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GLB = ROOT / "export" / "lily_004_final.glb"
REPORT = ROOT / "reports" / "blender_reimport.json"
CLIPS = {
    "Growth": 16.0,
    "IdleClosed": 8.0,
    "TouchResponse": 2.0,
    "Bloom": 16.0,
    "IdleOpen": 8.0,
    "DissolveReady": 1.0,
}


def main() -> None:
    if not GLB.is_file():
        raise FileNotFoundError(GLB)
    # --factory-startup still creates Blender's default cube. Keep the check
    # independent of that startup content so counts describe only this GLB.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    action_names = {action.name for action in bpy.data.actions}
    if action_names != set(CLIPS):
        raise RuntimeError(f"Animation names changed: {sorted(action_names)}")
    durations = {
        action.name: round((action.frame_range[1] - action.frame_range[0]) / 24.0, 6)
        for action in bpy.data.actions
    }
    if durations != CLIPS:
        raise RuntimeError(f"Animation durations changed: {durations}")
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    vertex_count = sum(len(obj.data.vertices) for obj in mesh_objects)
    triangle_count = 0
    degenerate = []
    malformed_faces = []
    nonfinite = []
    bounds = []
    for obj in mesh_objects:
        mesh = obj.data
        for polygon in mesh.polygons:
            if len(polygon.vertices) != 3:
                malformed_faces.append({"mesh": obj.name, "vertices": len(polygon.vertices)})
                continue
            triangle_count += 1
            a, b, c = (mesh.vertices[index].co for index in polygon.vertices)
            area = (b - a).cross(c - a).length * 0.5
            if not math.isfinite(area):
                nonfinite.append(obj.name)
            elif area <= 1e-12:
                degenerate.append({"mesh": obj.name, "polygon": polygon.index, "area": area})
        for vertex in mesh.vertices:
            if not all(math.isfinite(float(component)) for component in vertex.co):
                nonfinite.append(obj.name)
        for normal in mesh.corner_normals:
            if not all(math.isfinite(float(component)) for component in normal.vector):
                nonfinite.append(obj.name + " normal")
        world_points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        if world_points:
            bounds.append({
                "mesh": obj.name,
                "min": [min(point[i] for point in world_points) for i in range(3)],
                "max": [max(point[i] for point in world_points) for i in range(3)],
            })
    if len(mesh_objects) != 7 or vertex_count != 11015 or triangle_count != 19188:
        raise RuntimeError(f"Unexpected mesh budget: meshes={len(mesh_objects)}, vertices={vertex_count}, triangles={triangle_count}")
    if malformed_faces or degenerate or nonfinite:
        raise RuntimeError(f"Mesh defects after reimport: malformed={len(malformed_faces)}, degenerate={len(degenerate)}, nonfinite={len(nonfinite)}")
    images = []
    for image in bpy.data.images:
        if image.source == "FILE":
            image.pixels[0]
            images.append({
                "name": image.name,
                "width": image.size[0],
                "height": image.size[1],
                "decodedPixels": len(image.pixels),
            })
    if len(images) != 7:
        raise RuntimeError(f"Expected 7 embedded base/roughness texture images; found {len(images)}")
    if not all(bpy.data.materials.get(name) for name in (
        "Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen", "Anther_SoftGold", "Filament_Ivory",
    )):
        raise RuntimeError("One or more stable material names were lost")
    report = {
        "glb": str(GLB),
        "meshCount": len(mesh_objects),
        "uploadVertices": vertex_count,
        "triangles": triangle_count,
        "animations": durations,
        "materials": sorted(material.name for material in bpy.data.materials),
        "decodedEmbeddedImages": images,
        "malformedFaces": len(malformed_faces),
        "degenerateTriangles": len(degenerate),
        "nonfiniteGeometryOrNormals": len(nonfinite),
        "meshBounds": bounds,
        "result": "PASS",
    }
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("BLENDER_REIMPORT", REPORT)
    print("BLENDER_REIMPORT_RESULT", json.dumps({k: report[k] for k in (
        "meshCount", "uploadVertices", "triangles", "animations", "result",
    )}, ensure_ascii=False))


if __name__ == "__main__":
    main()
