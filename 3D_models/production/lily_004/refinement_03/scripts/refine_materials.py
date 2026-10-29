"""Apply portable lily materials and a reproducible Growth color contract.

Run with Blender 5.2.3 in background mode:
  blender --background INPUT.blend --python refine_materials.py -- --output-root PATH --name lily_004_material_study

The saved blend retains an animated shader tint that evaluates by frame. The
GLB uses direct glTF metallic-roughness PBR maps at the mature state and carries
the absolute-time runtime color contract on Lily_Root extras.
"""
from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FPS = 24
GROWTH_DURATION = 9.0
GROWTH_KEY_TIMES = (0.0, 4.5, 6.75, 9.0)
PETAL_BAKED_MATURE_FACTORS = {
    "Petal_Pearl": (0.95, 0.91, 0.90),
    "Petal_Outside": (0.93, 0.91, 0.96),
}
MATERIAL_NAMES = (
    "Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen",
    "Anther_SoftGold", "Filament_Ivory",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--name", default="lily_004_material_study")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[a-z0-9_]+", args.name):
        parser.error("--name must contain lowercase ASCII letters, digits, and underscores")
    output_root = args.output_root.resolve()
    try:
        output_root.relative_to(ROOT.resolve())
    except ValueError:
        parser.error(f"--output-root must remain inside {ROOT}")
    baseline = (ROOT / "baseline").resolve()
    if output_root == baseline or baseline in output_root.parents:
        parser.error("--output-root may not target the read-only baseline")
    args.output_root = output_root
    return args


def srgb_to_linear(value: float) -> float:
    value /= 255.0
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def linear_to_srgb_byte(value: float) -> int:
    value = clamp(value)
    encoded = 12.92 * value if value <= 0.0031308 else 1.055 * (value ** (1.0 / 2.4)) - 0.055
    return int(round(clamp(encoded) * 255.0))


def linear_rgba(rgb) -> tuple[float, float, float, float]:
    return float(rgb[0]), float(rgb[1]), float(rgb[2]), 1.0


def linear_from_bytes(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    return tuple(srgb_to_linear(float(channel)) for channel in rgb)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def gaussian(distance: float, width: float) -> float:
    return math.exp(-((distance / width) ** 2))


def petal_color(u: float, v: float, outer: bool) -> tuple[int, int, int]:
    center = math.sin(math.pi * v) ** 0.55
    streaks = 0.0
    offsets = (-0.27, -0.17, -0.095, -0.028, 0.052, 0.143, 0.258)
    for index, offset in enumerate(offsets):
        curve = 0.5 + offset * math.sin(math.pi * v) ** 0.72 + 0.004 * math.sin(2.0 * math.pi * v + index * 1.31) * center
        weight = 0.36 + 0.42 * (0.5 + 0.5 * math.sin(index * 1.91 + 0.4))
        streaks += weight * gaussian(u - curve, 0.0022 if abs(offset) < 0.08 else 0.0018)
    streaks = clamp(streaks * center)
    broad = gaussian(u - 0.5, 0.19) * center
    grain = 1.25 * math.sin(17.0 * math.pi * v + 2.0 * math.pi * u)
    grain += 0.75 * math.sin(41.0 * math.pi * v - 5.0 * math.pi * u)
    if outer:
        base, blush, vein, lavender = (251.0, 250.0, 253.0), (3.0, 5.0, 0.0), (4.0, 6.0, 1.0), (1.0, 2.0, 4.0)
    else:
        base, blush, vein, lavender = (253.0, 250.0, 249.0), (1.0, 7.0, 5.0), (5.0, 8.0, 6.0), (1.0, 1.0, 1.5)
    unbaked = tuple(
        int(round(clamp(base[channel] - broad * blush[channel] - streaks * vein[channel]
                        - lavender[channel] * (1.0 - center) + grain, 0.0, 255.0)))
        for channel in range(3)
    )
    mature = PETAL_BAKED_MATURE_FACTORS["Petal_Outside" if outer else "Petal_Pearl"]
    return tuple(linear_to_srgb_byte(srgb_to_linear(float(unbaked[channel])) * mature[channel]) for channel in range(3))


def green_color(u: float, v: float, stem: bool = False) -> tuple[int, int, int]:
    center = math.sin(math.pi * v) ** 0.6
    streaks = 0.0
    offsets = (-0.29, -0.18, -0.092, -0.021, 0.061, 0.168, 0.276)
    for index, offset in enumerate(offsets):
        curve = 0.5 + offset * math.sin(math.pi * v) ** 0.78 + 0.006 * math.sin(2.0 * math.pi * v + index * 1.17) * center
        weight = 0.38 + 0.4 * (0.5 + 0.5 * math.sin(index * 1.67 + 0.8))
        streaks += weight * gaussian(u - curve, 0.0030 if abs(offset) < 0.08 else 0.0024)
    streaks = clamp(streaks * center)
    broad = gaussian(u - 0.5, 0.17) * center
    wave = 1.8 * math.sin(12.0 * math.pi * v + 7.0 * math.pi * u)
    wave += 1.0 * math.sin(34.0 * math.pi * v - 3.0 * math.pi * u)
    base, highlight, vein = ((104.0, 143.0, 105.0), 15.0, 6.0) if stem else ((116.0, 162.0, 122.0), 20.0, 8.0)
    shade = broad * highlight + wave
    return tuple(int(round(clamp(base[channel] + shade - streaks * vein, 0.0, 255.0))) for channel in range(3))


def roughness_value(u: float, v: float, base: float, amplitude: float) -> float:
    center = math.sin(math.pi * v) ** 0.6
    streak = 0.0
    offsets = (-0.22, -0.126, -0.047, 0.019, 0.091, 0.217)
    for index, offset in enumerate(offsets):
        curve = 0.5 + offset * math.sin(math.pi * v) ** 0.7 + 0.004 * math.sin(2.0 * math.pi * v + index * 1.42) * center
        streak += (0.36 + 0.38 * (0.5 + 0.5 * math.sin(index * 2.03))) * gaussian(u - curve, 0.0032)
    streak = clamp(streak * center)
    variation = 0.55 * math.sin(8.0 * math.pi * v + 3.0 * math.pi * u)
    variation += 0.35 * math.sin(22.0 * math.pi * v - 2.0 * math.pi * u)
    return clamp(base + amplitude * variation + 0.012 * streak, 0.34, 0.62)


def create_png(path: Path, name: str, width: int, height: int, color_fn, *, non_color: bool = False):
    image = bpy.data.images.new(name, width=width, height=height, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    pixels = array.array("f")
    for y in range(height):
        v = y / max(1, height - 1)
        for x in range(width):
            u = x / max(1, width - 1)
            sample = color_fn(u, v)
            values = (float(sample),) * 3 if non_color else tuple(srgb_to_linear(float(channel)) for channel in sample)
            pixels.extend((values[0], values[1], values[2], 1.0))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def texture_assets(texture_dir: Path) -> dict[str, object]:
    texture_dir.mkdir(parents=True, exist_ok=True)
    return {
        "Petal_Pearl_BaseColor": create_png(texture_dir / "lily_petal_pearl_base.png", "ALU_Petal_Pearl_BaseColor", 512, 512, lambda u, v: petal_color(u, v, False)),
        "Petal_Outside_BaseColor": create_png(texture_dir / "lily_petal_outside_base.png", "ALU_Petal_Outside_BaseColor", 512, 512, lambda u, v: petal_color(u, v, True)),
        "Petal_Roughness": create_png(texture_dir / "lily_petal_roughness.png", "ALU_Petal_Roughness", 512, 512, lambda u, v: roughness_value(u, v, 0.43, 0.022), non_color=True),
        "Leaf_BaseColor": create_png(texture_dir / "lily_leaf_base.png", "ALU_Leaf_BaseColor", 256, 512, lambda u, v: green_color(u, v)),
        "Leaf_Roughness": create_png(texture_dir / "lily_leaf_roughness.png", "ALU_Leaf_Roughness", 256, 512, lambda u, v: roughness_value(u, v, 0.52, 0.035), non_color=True),
        "Stem_BaseColor": create_png(texture_dir / "lily_stem_base.png", "ALU_Stem_BaseColor", 128, 512, lambda u, v: green_color(u, v, True)),
        "Stem_Roughness": create_png(texture_dir / "lily_stem_roughness.png", "ALU_Stem_Roughness", 128, 512, lambda u, v: roughness_value(u, v, 0.53, 0.025), non_color=True),
    }


def contract_data() -> dict:
    colors = {
        "Petal_Pearl": ((0.20, 0.47, 0.20), (0.38, 0.59, 0.31), (0.83, 0.79, 0.70), (1.0, 1.0, 1.0)),
        "Petal_Outside": ((0.20, 0.47, 0.20), (0.38, 0.59, 0.31), (0.82, 0.80, 0.74), (1.0, 1.0, 1.0)),
    }
    materials = [
        {
            "material": name,
            "target": "pbrMetallicRoughness.baseColorFactor.rgb",
            "keyframes": [
                {"timeSeconds": time, "linearSrgbFactor": list(color)}
                for time, color in zip(GROWTH_KEY_TIMES, colors[name])
            ],
        }
        for name in ("Petal_Pearl", "Petal_Outside")
    ]
    return {
        "schemaVersion": 1,
        "clip": "Growth",
        "durationSeconds": GROWTH_DURATION,
        "colorSpace": "linear-sRGB",
        "sampling": {
            "mode": "absolute-clip-time",
            "interpolation": "piecewise-linear",
            "formula": "factor(t)=lerp(k[i].linearSrgbFactor,k[i+1].linearSrgbFactor,(clamp(t,0,9)-t[i])/(t[i+1]-t[i])); interpolate each RGB channel independently",
            "endpointClamping": True,
            "nonGrowth": "mature",
            "crossfade": {
                "durationSeconds": 0.25,
                "space": "linear-sRGB",
                "formula": "lerp(sourceFactor,targetFactor,clamp(transitionElapsedSeconds/0.25,0,1))",
                "sourceAndTarget": "sample each clip at its absolute clip time; non-Growth clips use their mature factor",
                "reverseScrub": "recompute from source/target absolute clip times and transition elapsed time; do not accumulate frame deltas",
            },
        },
        "materialFactors": materials,
    }


def material_factor(contract: dict, material_name: str, seconds: float) -> tuple[float, float, float]:
    entry = next(item for item in contract["materialFactors"] if item["material"] == material_name)
    samples = entry["keyframes"]
    time = clamp(seconds, 0.0, GROWTH_DURATION)
    for left, right in zip(samples, samples[1:]):
        if time <= right["timeSeconds"]:
            span = right["timeSeconds"] - left["timeSeconds"]
            amount = (time - left["timeSeconds"]) / span
            return tuple(
                left["linearSrgbFactor"][channel]
                + (right["linearSrgbFactor"][channel] - left["linearSrgbFactor"][channel]) * amount
                for channel in range(3)
            )
    return tuple(samples[-1]["linearSrgbFactor"])


def action_fcurves(action):
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            channelbag = getattr(strip, "channelbag", None)
            if channelbag is None:
                continue
            for slot in getattr(action, "slots", []):
                try:
                    bag = channelbag(slot)
                except (TypeError, RuntimeError):
                    continue
                if bag is not None:
                    curves.extend(list(bag.fcurves))
    return curves


def create_material(name: str, *, base_image=None, roughness_image=None, color=(1.0, 1.0, 1.0), roughness=0.5, metallic=0.0, tint=False, double_sided=False):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = not double_sided
    material.diffuse_color = linear_rgba(color)
    tree = material.node_tree
    if tree.animation_data:
        tree.animation_data_clear()
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (500, 40)
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Portable Principled PBR"
    shader.label = "glTF metallic-roughness PBR"
    shader.location = (220, 40)
    shader.inputs["Base Color"].default_value = linear_rgba(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Alpha"].default_value = 1.0
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.0
    tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    if base_image is not None:
        texture = tree.nodes.new("ShaderNodeTexImage")
        texture.name = "Base Color Map"
        texture.image = base_image
        texture.location = (-540, 180)
        if tint:
            factor = tree.nodes.new("ShaderNodeMixRGB")
            factor.name = "Growth Tint"
            factor.label = "Animated linear-sRGB growth factor"
            factor.blend_type = "MULTIPLY"
            factor.use_clamp = False
            factor.inputs["Fac"].default_value = 1.0
            factor.inputs["Color2"].default_value = linear_rgba(color)
            factor.location = (-180, 180)
            tree.links.new(texture.outputs["Color"], factor.inputs["Color1"])
            tree.links.new(factor.outputs["Color"], shader.inputs["Base Color"])
        else:
            tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    if roughness_image is not None:
        rough_texture = tree.nodes.new("ShaderNodeTexImage")
        rough_texture.name = "Roughness Map"
        rough_texture.image = roughness_image
        rough_texture.location = (-540, -120)
        tree.links.new(rough_texture.outputs["Color"], shader.inputs["Roughness"])
    return material


def animate_material_factor(material, contract: dict) -> None:
    tree = material.node_tree
    factor = tree.nodes.get("Growth Tint")
    if factor is None:
        raise RuntimeError(f"{material.name} has no real Growth Tint material path")
    samples = next(item["keyframes"] for item in contract["materialFactors"] if item["material"] == material.name)
    for sample in samples:
        frame = 1.0 + sample["timeSeconds"] * FPS
        factor.inputs["Color2"].default_value = linear_rgba(tuple(sample["linearSrgbFactor"]))
        tree.keyframe_insert(
            data_path=f'nodes["{factor.name}"].inputs["Color2"].default_value',
            frame=frame,
            group="Growth Maturation",
        )
    animation = tree.animation_data
    if animation is None or animation.action is None:
        raise RuntimeError(f"Blender did not author a material action for {material.name}")
    animation.action.name = f"Growth__ALU_Maturation__{material.name}"
    curves = action_fcurves(animation.action)
    if not curves:
        raise RuntimeError(f"No material f-curves were created for {material.name}")
    for curve in curves:
        curve.extrapolation = "CONSTANT"
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"


def object_signature() -> dict:
    objects = {}
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        transforms = {
            "location": tuple(round(float(v), 10) for v in obj.location),
            "rotationMode": obj.rotation_mode,
            "rotationEuler": tuple(round(float(v), 10) for v in obj.rotation_euler),
            "rotationQuaternion": tuple(round(float(v), 10) for v in obj.rotation_quaternion),
            "scale": tuple(round(float(v), 10) for v in obj.scale),
        }
        tracks = []
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                strips = [
                    {
                        "name": strip.name,
                        "action": strip.action.name if strip.action else None,
                        "frameStart": round(float(strip.frame_start), 8),
                        "frameEnd": round(float(strip.frame_end), 8),
                        "actionFrameStart": round(float(strip.action_frame_start), 8),
                        "actionFrameEnd": round(float(strip.action_frame_end), 8),
                        "scale": round(float(strip.scale), 8),
                        "blendType": strip.blend_type,
                    }
                    for strip in track.strips
                ]
                tracks.append({"name": track.name, "strips": strips})
        entry = {"type": obj.type, "parent": obj.parent.name if obj.parent else None, "transforms": transforms, "nla": tracks}
        if obj.type == "MESH":
            mesh = obj.data
            digest = hashlib.sha256()
            for vertex in mesh.vertices:
                digest.update(json.dumps(tuple(round(float(value), 10) for value in vertex.co), separators=(",", ":")).encode())
            for polygon in mesh.polygons:
                digest.update(json.dumps(tuple(int(index) for index in polygon.vertices), separators=(",", ":")).encode())
            keys = []
            if mesh.shape_keys:
                for key in mesh.shape_keys.key_blocks:
                    key_digest = hashlib.sha256()
                    for point in key.data:
                        key_digest.update(json.dumps(tuple(round(float(value), 10) for value in point.co), separators=(",", ":")).encode())
                    keys.append({"name": key.name, "sha256": key_digest.hexdigest()})
            entry["mesh"] = {
                "sha256": digest.hexdigest(),
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
                "shapeKeys": keys,
                "uvLayers": [layer.name for layer in mesh.uv_layers],
            }
        objects[obj.name] = entry
    scene = bpy.context.scene
    return {
        "objects": objects,
        "scene": {"frameStart": scene.frame_start, "frameEnd": scene.frame_end, "fps": scene.render.fps},
    }


def validate_material_names() -> None:
    missing = [name for name in MATERIAL_NAMES if bpy.data.materials.get(name) is None]
    if missing:
        raise RuntimeError(f"input is missing required lily materials: {missing}")
    for name in ("Lily_Root", "Petals", "Petals_Outside", "Stem", "Leaf_A", "Leaf_B", "Calyx", "Flower_Details"):
        if bpy.data.objects.get(name) is None:
            raise RuntimeError(f"input is not a compatible lily asset; missing {name}")


def assign_materials(images: dict[str, object], contract: dict) -> dict[str, object]:
    factors = {item["material"]: tuple(item["keyframes"][-1]["linearSrgbFactor"]) for item in contract["materialFactors"]}
    materials = {
        "Petal_Pearl": create_material("Petal_Pearl", base_image=images["Petal_Pearl_BaseColor"], roughness_image=images["Petal_Roughness"], color=factors["Petal_Pearl"], roughness=0.43, metallic=0.0, tint=True),
        "Petal_Outside": create_material("Petal_Outside", base_image=images["Petal_Outside_BaseColor"], roughness_image=images["Petal_Roughness"], color=factors["Petal_Outside"], roughness=0.43, metallic=0.0, tint=True),
        "Leaf_SoftGreen": create_material("Leaf_SoftGreen", base_image=images["Leaf_BaseColor"], roughness_image=images["Leaf_Roughness"], color=linear_from_bytes((116, 162, 122)), roughness=0.52, metallic=0.0, double_sided=True),
        "Stem_SoftGreen": create_material("Stem_SoftGreen", base_image=images["Stem_BaseColor"], roughness_image=images["Stem_Roughness"], color=linear_from_bytes((104, 143, 105)), roughness=0.53, metallic=0.0),
        "Anther_SoftGold": create_material("Anther_SoftGold", color=linear_from_bytes((204, 162, 76)), roughness=0.44, metallic=0.0),
        "Filament_Ivory": create_material("Filament_Ivory", color=linear_from_bytes((239, 223, 199)), roughness=0.52, metallic=0.0),
    }
    for material in materials.values():
        tint = material.node_tree.nodes.get("Growth Tint")
        shader = material.node_tree.nodes.get("Portable Principled PBR")
        material.diffuse_color = linear_rgba(tint.inputs["Color2"].default_value[:3] if tint else shader.inputs["Base Color"].default_value[:3])
    animate_material_factor(materials["Petal_Pearl"], contract)
    animate_material_factor(materials["Petal_Outside"], contract)

    def replace_slots(obj, slots):
        obj.data.materials.clear()
        for material in slots:
            obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = min(polygon.material_index, len(slots) - 1)

    replace_slots(bpy.data.objects["Petals"], [materials["Petal_Pearl"]])
    replace_slots(bpy.data.objects["Petals_Outside"], [materials["Petal_Outside"]])
    for name in ("Leaf_A", "Leaf_B"):
        replace_slots(bpy.data.objects[name], [materials["Leaf_SoftGreen"]])
    for name in ("Stem", "Calyx"):
        replace_slots(bpy.data.objects[name], [materials["Stem_SoftGreen"]])
    details = bpy.data.objects["Flower_Details"]
    indices = [polygon.material_index for polygon in details.data.polygons]
    old_names = [slot.name for slot in details.data.materials]
    if not old_names:
        raise RuntimeError("Flower_Details has no material slots")
    slots = []
    for old_name in old_names:
        if old_name not in ("Anther_SoftGold", "Filament_Ivory"):
            raise RuntimeError(f"unexpected Flower_Details material slot {old_name!r}")
        slots.append(materials[old_name])
    details.data.materials.clear()
    for material in slots:
        details.data.materials.append(material)
    for polygon, index in zip(details.data.polygons, indices):
        polygon.material_index = index
    return materials


def validate_petal_face_pairing(inner_faces, outer_faces) -> list[float]:
    def faces_by_signature(faces):
        result = {}
        for face in faces:
            signature = tuple(sorted(int(index) for index in face.vertices))
            if signature in result:
                raise RuntimeError("paired petal surface contains duplicate face signatures")
            result[signature] = face
        return result

    inner_by_signature = faces_by_signature(inner_faces)
    outer_by_signature = faces_by_signature(outer_faces)
    if inner_by_signature.keys() != outer_by_signature.keys():
        raise RuntimeError("paired petal surfaces have mismatched face topology")

    normal_dots = [
        inner_by_signature[signature].normal.dot(outer_by_signature[signature].normal)
        for signature in sorted(inner_by_signature)
    ]
    if not normal_dots or min(normal_dots) > -0.999 or max(normal_dots) > -0.999:
        raise RuntimeError("paired petal surfaces must have consistently opposite face normals")
    return normal_dots


def validate_petal_sidedness(materials: dict[str, object]) -> dict:
    inner = bpy.data.objects["Petals"]
    outer = bpy.data.objects["Petals_Outside"]
    inner_mesh, outer_mesh = inner.data, outer.data
    if len(inner_mesh.vertices) != len(outer_mesh.vertices) or len(inner_mesh.polygons) != len(outer_mesh.polygons):
        raise RuntimeError("paired petal surfaces must have matching vertex and face counts")
    if not inner_mesh.shape_keys or not outer_mesh.shape_keys:
        raise RuntimeError("paired petal surfaces must retain matching shape-key sets")
    inner_keys = list(inner_mesh.shape_keys.key_blocks)
    outer_keys = list(outer_mesh.shape_keys.key_blocks)
    if [key.name for key in inner_keys] != [key.name for key in outer_keys]:
        raise RuntimeError("paired petal surfaces have different shape-key names or order")

    max_vertex_gap = 0.0
    for inner_key, outer_key in zip(inner_keys, outer_keys):
        for inner_point, outer_point in zip(inner_key.data, outer_key.data):
            inner_world = inner.matrix_world @ inner_point.co
            outer_world = outer.matrix_world @ outer_point.co
            max_vertex_gap = max(max_vertex_gap, (inner_world - outer_world).length)
    if max_vertex_gap > 1e-8:
        raise RuntimeError(f"paired petal surfaces are not coincident across shape keys: max gap {max_vertex_gap}")

    normal_dots = validate_petal_face_pairing(inner_mesh.polygons, outer_mesh.polygons)

    one_sided = ("Petal_Pearl", "Petal_Outside", "Stem_SoftGreen", "Anther_SoftGold", "Filament_Ivory")
    for name in one_sided:
        if not materials[name].use_backface_culling:
            raise RuntimeError(f"{name} must cull backfaces to avoid overlapping double-sided surfaces")
    leaf_double_sided = not materials["Leaf_SoftGreen"].use_backface_culling
    if not leaf_double_sided:
        raise RuntimeError("thin leaves must remain visible from both sides")
    return {
        "objects": [inner.name, outer.name],
        "verticesPerSurface": len(inner_mesh.vertices),
        "facesPerSurface": len(inner_mesh.polygons),
        "shapeKeysChecked": [key.name for key in inner_keys],
        "maxCorrespondingVertexGap": max_vertex_gap,
        "normalDotRange": [min(normal_dots), max(normal_dots)],
        "petalMaterialsOneSided": True,
        "thinLeafMaterialDoubleSided": True,
    }


def set_root_extra(root, contract: dict) -> None:
    root["ALU_budMaturation"] = contract
    value = root["ALU_budMaturation"]
    if not hasattr(value, "keys"):
        raise RuntimeError("Blender did not store ALU_budMaturation as a nested JSON object")


def verify_curve_values(scene, materials: dict[str, object], contract: dict) -> dict:
    saved_frame = scene.frame_current
    sample_times = sorted(set(GROWTH_KEY_TIMES + tuple(
        (left + right) * 0.5 for left, right in zip(GROWTH_KEY_TIMES, GROWTH_KEY_TIMES[1:])
    )))
    try:
        for material_name in ("Petal_Pearl", "Petal_Outside"):
            factor = materials[material_name].node_tree.nodes["Growth Tint"].inputs["Color2"]
            samples = next(item["keyframes"] for item in contract["materialFactors"] if item["material"] == material_name)
            for seconds in sample_times:
                scene.frame_set(1 + round(seconds * FPS))
                expected = tuple(samples[-1]["linearSrgbFactor"])
                for left, right in zip(samples, samples[1:]):
                    if seconds <= right["timeSeconds"]:
                        amount = (seconds - left["timeSeconds"]) / (right["timeSeconds"] - left["timeSeconds"])
                        expected = tuple(
                            left["linearSrgbFactor"][channel]
                            + (right["linearSrgbFactor"][channel] - left["linearSrgbFactor"][channel]) * amount
                            for channel in range(3)
                        )
                        break
                actual = tuple(float(value) for value in factor.default_value[:3])
                if any(abs(left - right) > 1e-5 for left, right in zip(actual, expected)):
                    raise RuntimeError(f"direct frame-set material curve mismatch: {material_name} at {seconds}s: {actual} != {expected}")
    finally:
        scene.frame_set(saved_frame)
    return {"status": "PASS", "mode": "direct Blender frame_set", "timesSeconds": sample_times, "materials": ["Petal_Pearl", "Petal_Outside"]}


def remove_orphaned_images() -> None:
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)


def texture_inventory(images: dict[str, object], materials: dict[str, object]) -> list[dict]:
    used_by = {image.name: [] for image in images.values()}
    for material in materials.values():
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                used_by.setdefault(node.image.name, []).append(material.name)
    result = []
    for logical_name, image in images.items():
        path = Path(bpy.path.abspath(image.filepath))
        result.append({
            "logicalName": logical_name,
            "image": image.name,
            "path": str(path),
            "width": image.size[0],
            "height": image.size[1],
            "bytes": path.stat().st_size,
            "packed": image.packed_file is not None,
            "materials": sorted(used_by.get(image.name, [])),
        })
    return result


def source_render_settings(scene) -> dict[str, object]:
    return {
        "engine": str(scene.render.engine),
        "cyclesDevice": str(scene.cycles.device),
        "cyclesSamples": int(scene.cycles.samples),
        "cyclesUseDenoising": bool(scene.cycles.use_denoising),
    }


def render_material_study(output_dir: Path, scene, materials: dict[str, object], contract: dict) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)
    saved_camera, saved_world = scene.camera, scene.world
    saved_engine = scene.render.engine
    saved_resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    saved_filepath = scene.render.filepath
    saved_image_format = scene.render.image_settings.file_format
    saved_color = (scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure, scene.view_settings.gamma)
    saved_frame = scene.frame_current
    saved_cycles = (scene.cycles.device, scene.cycles.samples, scene.cycles.use_denoising)
    temp_objects, temp_data = [], []
    world = bpy.data.worlds.new("__ALU_material_study_world")
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 24
        scene.cycles.use_denoising = True
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 720, 960, 100
        scene.render.image_settings.file_format = "PNG"
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Base Contrast"
        scene.view_settings.exposure, scene.view_settings.gamma = 0.0, 1.0
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.09, 0.095, 0.11, 1.0)
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.95
        scene.world = world

        def add_area(name, location, target, power, size, color):
            data = bpy.data.lights.new(name, "AREA")
            data.energy, data.shape, data.size, data.color = power, "DISK", size, color
            temp_data.append(data)
            obj = bpy.data.objects.new(name, data)
            scene.collection.objects.link(obj)
            obj.location = location
            obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
            temp_objects.append(obj)

        scene.frame_set(385)
        bounds = [
            obj.matrix_world @ Vector(corner)
            for obj in bpy.data.objects if obj.type == "MESH"
            for corner in obj.bound_box
        ]
        if not bounds:
            raise RuntimeError("cannot render material study: no lily mesh bounds")
        min_corner = Vector(tuple(min(point[i] for point in bounds) for i in range(3)))
        max_corner = Vector(tuple(max(point[i] for point in bounds) for i in range(3)))
        target = (min_corner + max_corner) * 0.5
        camera_data = bpy.data.cameras.new("__ALU_material_study_camera")
        camera_data.type, camera_data.ortho_scale = "ORTHO", 1.42
        temp_data.append(camera_data)
        camera = bpy.data.objects.new("__ALU_material_study_camera", camera_data)
        scene.collection.objects.link(camera)
        camera.location = target + Vector((2.4, -3.8, 1.15))
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        temp_objects.append(camera)
        scene.camera = camera
        add_area("__ALU_key", target + Vector((-2.5, -3.0, 3.2)), target, 460.0, 3.0, (1.0, 0.89, 0.82))
        add_area("__ALU_fill", target + Vector((2.8, -2.0, 1.0)), target, 520.0, 3.5, (0.82, 0.88, 1.0))
        add_area("__ALU_rim", target + Vector((0.0, 2.5, 2.7)), target, 300.0, 2.5, (1.0, 0.95, 0.88))
        bpy.context.view_layer.update()

        records = []
        for label, growth_seconds in (("young", 0.0), ("mature", GROWTH_DURATION)):
            sample_frame = 1 + round(growth_seconds * FPS)
            for name in ("Petal_Pearl", "Petal_Outside"):
                tree = materials[name].node_tree
                scene.frame_set(sample_frame)
                factor_value = material_factor(contract, name, growth_seconds)
                animation = tree.animation_data
                saved_action = animation.action if animation else None
                if animation:
                    animation.action = None
                scene.frame_set(385)
                tree.nodes["Growth Tint"].inputs["Color2"].default_value = linear_rgba(factor_value)
                # Keep the per-material color sample fixed while geometry stays
                # at the same closed Growth endpoint for a fair material study.
                if animation:
                    animation.action = None
            scene.frame_set(385)
            image_path = output_dir / f"material_{label}_growth_{growth_seconds:g}s.png"
            scene.render.filepath = str(image_path)
            bpy.ops.render.render(write_still=True)
            records.append({
                "label": label,
                "growthSampleSeconds": growth_seconds,
                "geometryPose": "closed Growth endpoint held at source frame 385 for material-only comparison",
                "path": str(image_path),
                "bytes": image_path.stat().st_size,
            })
            for name in ("Petal_Pearl", "Petal_Outside"):
                animation = materials[name].node_tree.animation_data
                if animation:
                    animation.action = next(action for action in bpy.data.actions if action.name == f"Growth__ALU_Maturation__{name}")
        scene.render.resolution_x, scene.render.resolution_y = 900, 700
        scene.frame_set(1057)
        head_bounds = [
            obj.matrix_world @ Vector(corner)
            for obj in bpy.data.objects if obj.type == "MESH" and obj.name in ("Petals", "Petals_Outside", "Flower_Details")
            for corner in obj.bound_box
        ]
        if not head_bounds:
            raise RuntimeError("cannot render open-flower material study: no head bounds")
        head_min = Vector(tuple(min(point[i] for point in head_bounds) for i in range(3)))
        head_max = Vector(tuple(max(point[i] for point in head_bounds) for i in range(3)))
        head_target = (head_min + head_max) * 0.5
        camera_data.ortho_scale = 0.78
        camera.location = head_target + Vector((0.48, -1.8, 0.45))
        camera.rotation_euler = (head_target - camera.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        open_path = output_dir / "material_open_bloom_3quarter.png"
        scene.render.filepath = str(open_path)
        bpy.ops.render.render(write_still=True)
        records.append({
            "label": "open-bloom",
            "clip": "Bloom",
            "sourceFrame": 1057,
            "materialState": "mature",
            "geometryPose": "Bloom endpoint; source study retains its 16-second geometry timing",
            "path": str(open_path),
            "bytes": open_path.stat().st_size,
        })
        return records
    finally:
        for obj in temp_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        for data in temp_data:
            if data.users == 0:
                if data.bl_rna.identifier == "Camera":
                    bpy.data.cameras.remove(data)
                else:
                    bpy.data.lights.remove(data)
        scene.camera, scene.world = saved_camera, saved_world
        if world.users == 0:
            bpy.data.worlds.remove(world)
        scene.render.engine = saved_engine
        scene.cycles.device, scene.cycles.samples, scene.cycles.use_denoising = saved_cycles
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = saved_resolution
        scene.render.filepath = saved_filepath
        scene.render.image_settings.file_format = saved_image_format
        scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure, scene.view_settings.gamma = saved_color
        scene.frame_set(saved_frame)


def export_static_mature_glb(glb_path: Path, materials: dict[str, object], contract: dict) -> None:
    mature = {item["material"]: tuple(item["keyframes"][-1]["linearSrgbFactor"]) for item in contract["materialFactors"]}
    for name, material in materials.items():
        old_images = {
            node.name: node.image for node in material.node_tree.nodes
            if node.type == "TEX_IMAGE" and node.image is not None
        }
        material.node_tree.animation_data_clear()
        material.node_tree.nodes.clear()
        output = material.node_tree.nodes.new("ShaderNodeOutputMaterial")
        shader = material.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        shader.name = "Portable Principled PBR"
        shader.inputs["Alpha"].default_value = 1.0
        shader.inputs["Roughness"].default_value = {"Anther_SoftGold": 0.44, "Filament_Ivory": 0.52}.get(name, 0.5)
        shader.inputs["Metallic"].default_value = 0.0
        if "Coat Weight" in shader.inputs:
            shader.inputs["Coat Weight"].default_value = 0.0
        color = mature.get(name, tuple(material.diffuse_color[:3]))
        shader.inputs["Base Color"].default_value = linear_rgba(color)
        material.diffuse_color = linear_rgba(color)
        if name in ("Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen"):
            base_image = old_images.get("Base Color Map")
            roughness_image = old_images.get("Roughness Map")
            if base_image is None or roughness_image is None:
                raise RuntimeError(f"GLB export material lacks standard maps: {name}")
            base_node = material.node_tree.nodes.new("ShaderNodeTexImage")
            base_node.image = base_image
            material.node_tree.links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
            rough_node = material.node_tree.nodes.new("ShaderNodeTexImage")
            rough_node.image = roughness_image
            material.node_tree.links.new(rough_node.outputs["Color"], shader.inputs["Roughness"])
        material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_animation_mode="NLA_TRACKS",
        export_anim_slide_to_zero=True,
        export_optimize_animation_keep_anim_object=True,
        export_current_frame=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )


def main() -> None:
    args = parse_args()
    source_input = Path(bpy.data.filepath).resolve()
    output_root = args.output_root
    source_dir, export_dir = output_root / "source", output_root / "export"
    texture_dir, report_dir = output_root / "textures", output_root / "reports"
    stem = args.name.removeprefix("lily_004_")
    screenshot_dir = output_root / "screenshots" / f"material_{stem}"
    for directory in (source_dir, export_dir, report_dir):
        directory.mkdir(parents=True, exist_ok=True)
    source_out = source_dir / f"{args.name}.blend"
    glb_out = export_dir / f"{args.name}.glb"
    sidecar_out = export_dir / "bud_maturation.json"
    report_out = report_dir / f"material_{stem}.json"
    for path in (source_out, glb_out, sidecar_out, report_out):
        if path.resolve() == source_input:
            raise RuntimeError(f"refusing to overwrite Blender input: {path}")
        try:
            path.resolve().relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError(f"output escaped refinement root: {path}") from error

    validate_material_names()
    signature_before = object_signature()
    scene = bpy.context.scene
    saved_frame = scene.frame_current
    render_settings_before = source_render_settings(scene)
    contract = contract_data()
    set_root_extra(bpy.data.objects["Lily_Root"], contract)
    images = texture_assets(texture_dir)
    materials = assign_materials(images, contract)
    petal_sidedness = validate_petal_sidedness(materials)
    remove_orphaned_images()
    source_curve_samples = verify_curve_values(scene, materials, contract)
    sidecar_out.write_text(json.dumps(contract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    screenshots = render_material_study(screenshot_dir, scene, materials, contract)
    render_settings_after = source_render_settings(scene)
    signature_after = object_signature()
    if signature_before != signature_after:
        raise RuntimeError("material pass changed object geometry, transforms, hierarchy, or geometric NLA strips")
    if scene.frame_current != saved_frame:
        raise RuntimeError("material pass did not restore the input scene frame")
    if render_settings_after != render_settings_before:
        raise RuntimeError(
            "material preview changed source render settings before save: "
            f"before={render_settings_before}, after={render_settings_after}"
        )
    bpy.ops.wm.save_as_mainfile(filepath=str(source_out))
    export_static_mature_glb(glb_out, materials, contract)
    textures = texture_inventory(images, materials)
    for record in textures:
        if record["width"] > 512 or record["height"] > 512 or not record["packed"]:
            raise RuntimeError(f"texture budget/packing check failed: {record}")
    report = {
        "schemaVersion": 1,
        "sourceInput": str(source_input),
        "sourceOutput": str(source_out.resolve()),
        "glbOutput": str(glb_out.resolve()),
        "metadataOutput": str(sidecar_out.resolve()),
        "glbBytes": glb_out.stat().st_size,
        "glbSha256": hashlib.sha256(glb_out.read_bytes()).hexdigest(),
        "geometryPreserved": True,
        "preservationSignature": hashlib.sha256(json.dumps(signature_before, sort_keys=True).encode()).hexdigest(),
        "petalSurfaceSidedness": petal_sidedness,
        "sourceCurveSampleCheck": source_curve_samples,
        "sourceRenderSettings": {
            "beforePreview": render_settings_before,
            "afterPreview": render_settings_after,
            "preserved": render_settings_after == render_settings_before,
        },
        "materialContract": contract,
        "textures": textures,
        "screenshots": screenshots,
        "glbBaseState": "mature PBR textures and factors; Growth tint remains an absolute-time runtime contract",
        "runtimeRequirement": "A consumer must sample Lily_Root extras ALU_budMaturation; plain GLTFLoader does not animate material baseColorFactor from this metadata.",
    }
    report_out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("MATERIAL_SOURCE", source_out)
    print("MATERIAL_GLB", glb_out)
    print("MATURATION_JSON", sidecar_out)
    print("MATERIAL_REPORT", report_out)
    print("MATERIAL_SCREENSHOTS", screenshot_dir)
    print("MATERIAL_GEOMETRY_PRESERVED", True)
    print("MATERIAL_TEXTURES", json.dumps(textures, ensure_ascii=False))
    print("MATERIAL_GLB_BYTES", glb_out.stat().st_size)


if __name__ == "__main__":
    main()
