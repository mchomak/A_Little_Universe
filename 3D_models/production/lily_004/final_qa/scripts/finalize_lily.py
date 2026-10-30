"""Create the final v13 lily with portable mature PBR maps, preserving its rig.

Run with Blender 5.2.3:
  blender --background ../baseline/lily_004_v13_final_original.blend \
    --python finalize_lily.py

This script writes only under the sibling final_qa directory. The original
animated GLB is kept as a separate byte-identical reference.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TEXTURES = ROOT / "textures"
SOURCE_OUT = ROOT / "source" / "lily_004_final.blend"
GLB_OUT = ROOT / "export" / "lily_004_final.glb"
REPORT_OUT = ROOT / "reports" / "final_asset.json"
BASELINE = ROOT / "baseline" / "lily_004_v13_final_original.blend"
MATERIAL_NAMES = (
    "Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen",
    "Anther_SoftGold", "Filament_Ivory",
)
REQUIRED_OBJECTS = (
    "Lily_Root", "Petals", "Petals_Outside", "Flower_Details", "Stem",
    "Leaf_A", "Leaf_B", "Calyx",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def srgb8_to_linear(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    def convert(channel: int) -> float:
        value = channel / 255.0
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    return tuple(convert(channel) for channel in rgb)


def object_signature() -> dict:
    result = {}
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        record = {
            "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            "location": [round(float(v), 9) for v in obj.location],
            "rotationMode": obj.rotation_mode,
            "rotationEuler": [round(float(v), 9) for v in obj.rotation_euler],
            "rotationQuaternion": [round(float(v), 9) for v in obj.rotation_quaternion],
            "scale": [round(float(v), 9) for v in obj.scale],
            "materialSlots": [slot.material.name if slot.material else None for slot in obj.material_slots],
        }
        if obj.type == "MESH":
            mesh = obj.data
            record["vertices"] = len(mesh.vertices)
            record["edges"] = len(mesh.edges)
            record["polygons"] = len(mesh.polygons)
            record["polygonsByMaterial"] = [sum(1 for p in mesh.polygons if p.material_index == i) for i in range(len(mesh.materials))]
            digest = hashlib.sha256()
            for vertex in mesh.vertices:
                digest.update(("%.9f,%.9f,%.9f;" % tuple(vertex.co)).encode("ascii"))
            for polygon in mesh.polygons:
                digest.update((",".join(str(i) for i in polygon.vertices) + ";").encode("ascii"))
            for layer in mesh.uv_layers:
                digest.update(layer.name.encode("utf-8"))
                for loop in layer.data:
                    digest.update(("%.8f,%.8f;" % tuple(loop.uv)).encode("ascii"))
            if mesh.shape_keys:
                record["shapeKeys"] = []
                for key in mesh.shape_keys.key_blocks:
                    key_hash = hashlib.sha256()
                    for point in key.data:
                        key_hash.update(("%.9f,%.9f,%.9f;" % tuple(point.co)).encode("ascii"))
                    record["shapeKeys"].append({"name": key.name, "sha256": key_hash.hexdigest()})
            record["geometrySha256"] = digest.hexdigest()
        if obj.animation_data:
            record["nla"] = [
                {
                    "track": track.name,
                    "strips": [
                        {
                            "name": strip.name,
                            "action": strip.action.name if strip.action else None,
                            "start": round(float(strip.frame_start), 6),
                            "end": round(float(strip.frame_end), 6),
                            "actionStart": round(float(strip.action_frame_start), 6),
                            "actionEnd": round(float(strip.action_frame_end), 6),
                            "scale": round(float(strip.scale), 8),
                            "blend": strip.blend_type,
                        }
                        for strip in track.strips
                    ],
                }
                for track in obj.animation_data.nla_tracks
            ]
        result[obj.name] = record
    return result


def make_material(name: str, base: Path | None, roughness_map: Path | None,
                  base_color: tuple[float, float, float], roughness: float,
                  *, double_sided: bool = False) -> None:
    material = bpy.data.materials.get(name)
    if material is None:
        raise RuntimeError(f"Expected source material {name!r}")
    if base and not base.is_file():
        raise FileNotFoundError(base)
    if roughness_map and not roughness_map.is_file():
        raise FileNotFoundError(roughness_map)
    material.use_nodes = True
    material.use_backface_culling = not double_sided
    material.diffuse_color = (*base_color, 1.0)
    tree = material.node_tree
    if tree.animation_data:
        tree.animation_data_clear()
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (460, 40)
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Portable Principled PBR"
    shader.label = "Matte botanical glTF PBR"
    shader.location = (190, 40)
    shader.inputs["Base Color"].default_value = (*base_color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Alpha"].default_value = 1.0
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.0
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    if base:
        image = bpy.data.images.load(str(base), check_existing=True)
        image.colorspace_settings.name = "sRGB"
        image.pack()
        node = tree.nodes.new("ShaderNodeTexImage")
        node.name = "Base Color Map"
        node.image = image
        node.location = (-500, 160)
        tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    if roughness_map:
        image = bpy.data.images.load(str(roughness_map), check_existing=True)
        image.colorspace_settings.name = "Non-Color"
        image.pack()
        node = tree.nodes.new("ShaderNodeTexImage")
        node.name = "Roughness Map"
        node.image = image
        node.location = (-500, -120)
        tree.links.new(node.outputs["Color"], shader.inputs["Roughness"])


def validate_source() -> None:
    absent = [name for name in REQUIRED_OBJECTS if bpy.data.objects.get(name) is None]
    if absent:
        raise RuntimeError(f"v13 source lacks required lily objects: {absent}")
    absent = [name for name in MATERIAL_NAMES if bpy.data.materials.get(name) is None]
    if absent:
        raise RuntimeError(f"v13 source lacks required materials: {absent}")
    for name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[name]
        if not obj.data.shape_keys or len(obj.data.shape_keys.key_blocks) != 9:
            raise RuntimeError(f"{name} does not have the expected Basis + 8 morph targets")
        if [key.name for key in obj.data.shape_keys.key_blocks[1:7]] != [f"Closed_{i:02d}" for i in range(1, 7)]:
            raise RuntimeError(f"{name} is missing the six stable Closed morph targets")
    if len(bpy.data.actions) < 36:
        raise RuntimeError(f"v13 source action inventory unexpectedly small: {len(bpy.data.actions)}")


def assign_materials() -> None:
    make_material("Petal_Pearl", TEXTURES / "lily_petal_pearl_base.png", TEXTURES / "lily_petal_roughness.png", (0.95, 0.91, 0.90), 0.43)
    make_material("Petal_Outside", TEXTURES / "lily_petal_outside_base.png", TEXTURES / "lily_petal_roughness.png", (0.93, 0.91, 0.96), 0.43)
    make_material("Leaf_SoftGreen", TEXTURES / "lily_leaf_base.png", TEXTURES / "lily_leaf_roughness.png", srgb8_to_linear((116, 162, 122)), 0.52, double_sided=True)
    make_material("Stem_SoftGreen", TEXTURES / "lily_stem_base.png", TEXTURES / "lily_stem_roughness.png", srgb8_to_linear((104, 143, 105)), 0.53, double_sided=True)
    make_material("Anther_SoftGold", None, None, srgb8_to_linear((204, 162, 76)), 0.44, double_sided=True)
    make_material("Filament_Ivory", None, None, srgb8_to_linear((239, 223, 199)), 0.52, double_sided=True)
    for obj_name, material_name in (
        ("Petals", "Petal_Pearl"),
        ("Petals_Outside", "Petal_Outside"),
        ("Leaf_A", "Leaf_SoftGreen"),
        ("Leaf_B", "Leaf_SoftGreen"),
        ("Stem", "Stem_SoftGreen"),
        ("Calyx", "Stem_SoftGreen"),
    ):
        obj = bpy.data.objects[obj_name]
        indices = [polygon.material_index for polygon in obj.data.polygons]
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[material_name])
        for polygon, index in zip(obj.data.polygons, indices):
            polygon.material_index = min(index, 0)
    details = bpy.data.objects["Flower_Details"]
    slot_names = [slot.name for slot in details.data.materials]
    if slot_names != ["Anther_SoftGold", "Filament_Ivory"]:
        raise RuntimeError(f"Unexpected detail material slot order: {slot_names}")
    indices = [polygon.material_index for polygon in details.data.polygons]
    details.data.materials.clear()
    details.data.materials.append(bpy.data.materials["Anther_SoftGold"])
    details.data.materials.append(bpy.data.materials["Filament_Ivory"])
    for polygon, index in zip(details.data.polygons, indices):
        polygon.material_index = index


def main() -> None:
    if not Path(bpy.data.filepath).resolve() == BASELINE.resolve():
        raise RuntimeError(f"Open the preserved baseline blend as input: {BASELINE}")
    if not GLB_OUT.parent.is_dir() or not SOURCE_OUT.parent.is_dir():
        raise FileNotFoundError("final_qa source/export directories are missing")
    if not BASELINE.is_file():
        raise FileNotFoundError(BASELINE)
    validate_source()
    before = object_signature()
    frames_before = (bpy.context.scene.frame_start, bpy.context.scene.frame_end, bpy.context.scene.render.fps)
    assign_materials()
    after = object_signature()
    if before.keys() != after.keys():
        raise RuntimeError("Material pass changed the object inventory")
    for name in before:
        a, b = before[name], after[name]
        for key in ("type", "parent", "location", "rotationMode", "rotationEuler", "rotationQuaternion", "scale", "vertices", "edges", "polygons", "polygonsByMaterial", "geometrySha256", "shapeKeys", "nla"):
            if a.get(key) != b.get(key):
                raise RuntimeError(f"Material pass changed {name}.{key}")
    if frames_before != (bpy.context.scene.frame_start, bpy.context.scene.frame_end, bpy.context.scene.render.fps):
        raise RuntimeError("Material pass changed scene playback settings")

    for image in bpy.data.images:
        if image.source == "FILE" and image.users > 0:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_OUT))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUT),
        export_format="GLB",
        export_animation_mode="NLA_TRACKS",
        export_anim_slide_to_zero=True,
        export_optimize_animation_keep_anim_object=True,
        export_current_frame=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    metrics = {}
    for name, obj in bpy.data.objects.items():
        if obj.type == "MESH":
            metrics[name] = {
                "vertices": len(obj.data.vertices),
                "triangles": sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons),
                "shapeKeys": [key.name for key in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else [],
                "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            }
    report = {
        "sourceBlend": str(BASELINE),
        "sourceBlendSha256": sha256(BASELINE),
        "finalBlend": str(SOURCE_OUT),
        "finalGlb": str(GLB_OUT),
        "finalGlbSha256": sha256(GLB_OUT),
        "finalGlbBytes": GLB_OUT.stat().st_size,
        "geometryAndRigSignaturePreserved": True,
        "sceneFrameRange": [bpy.context.scene.frame_start, bpy.context.scene.frame_end],
        "fps": bpy.context.scene.render.fps,
        "meshes": metrics,
        "materials": {
            name: {
                "metallic": 0.0,
                "roughness": {"Petal_Pearl": 0.43, "Petal_Outside": 0.43, "Leaf_SoftGreen": 0.52, "Stem_SoftGreen": 0.53, "Anther_SoftGold": 0.44, "Filament_Ivory": 0.52}[name],
                "baseColorFactorLinear": {
                    "Petal_Pearl": [0.95, 0.91, 0.90],
                    "Petal_Outside": [0.93, 0.91, 0.96],
                    "Leaf_SoftGreen": list(srgb8_to_linear((116, 162, 122))),
                    "Stem_SoftGreen": list(srgb8_to_linear((104, 143, 105))),
                    "Anther_SoftGold": list(srgb8_to_linear((204, 162, 76))),
                    "Filament_Ivory": list(srgb8_to_linear((239, 223, 199))),
                }[name],
                "textureFiles": {
                    "Petal_Pearl": ["textures/lily_petal_pearl_base.png", "textures/lily_petal_roughness.png"],
                    "Petal_Outside": ["textures/lily_petal_outside_base.png", "textures/lily_petal_roughness.png"],
                    "Leaf_SoftGreen": ["textures/lily_leaf_base.png", "textures/lily_leaf_roughness.png"],
                    "Stem_SoftGreen": ["textures/lily_stem_base.png", "textures/lily_stem_roughness.png"],
                    "Anther_SoftGold": [],
                    "Filament_Ivory": [],
                }[name],
            }
            for name in MATERIAL_NAMES
        },
        "textureInventory": [
            {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size}
            for path in sorted(TEXTURES.glob("*.png"))
        ],
        "extensionsExpected": "Standard metallic-roughness maps only; no decoder required",
    }
    REPORT_OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("FINAL_BLEND", SOURCE_OUT)
    print("FINAL_GLB", GLB_OUT)
    print("FINAL_REPORT", REPORT_OUT)
    print("FINAL_GLB_SHA256", report["finalGlbSha256"])
    print("FINAL_GLB_BYTES", report["finalGlbBytes"])


if __name__ == "__main__":
    main()
