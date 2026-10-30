"""Render matching BEFORE/AFTER checkpoints from the actual exported GLBs."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry_path_safety import resolve_output_root, validate_output_paths

try:
    import bpy
    from mathutils import Matrix, Quaternion, Vector
except ImportError:  # Allows the public time-planning seam to be unit-tested on host Python.
    bpy = None
    Matrix = None
    Quaternion = None
    Vector = None


ROOT = Path(__file__).resolve().parent.parent
PRIMARY_ROOT = Path("C:/Users/McHomak/Projects/A_Little_Universe")
CAMERA_DISTANCE_SCALE = 1.3
CAMERA_POSITION_SOURCE = (1.35, 1.8, 2.35)
CAMERA_TARGET_SOURCE = (0.0, 0.54, 0.1)
CAMERA_ORTHO_SCALE = 1.25


def comparison_checkpoints(before: dict[str, float], after: dict[str, float]) -> list[dict[str, Any]]:
    """Select the requested beats using each file's own exported duration."""
    required = {"Growth", "Bloom"}
    if not required.issubset(before) or not required.issubset(after):
        raise ValueError("both exports must provide Growth and Bloom durations")
    for side, durations in (("before", before), ("after", after)):
        for clip in required:
            value = float(durations[clip])
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{side} {clip} duration must be positive and finite")

    return [
        {"clip": "Growth", "label": "end", "beforeSeconds": float(before["Growth"]), "afterSeconds": float(after["Growth"])},
        {"clip": "Bloom", "label": "start", "beforeSeconds": 0.0, "afterSeconds": 0.0},
        {"clip": "Bloom", "label": "mid", "beforeSeconds": float(before["Bloom"]) / 2, "afterSeconds": float(after["Bloom"]) / 2},
        {"clip": "Bloom", "label": "end", "beforeSeconds": float(before["Bloom"]), "afterSeconds": float(after["Bloom"])},
    ]


def sample_color_factor(material_factor: dict[str, Any], seconds: float) -> tuple[float, float, float]:
    """Sample a material's piecewise-linear linear-sRGB factor at absolute Growth time."""
    keyframes = material_factor.get("keyframes")
    if not isinstance(keyframes, list) or not keyframes:
        raise ValueError("material metadata must contain keyframes")
    times = [float(keyframe["timeSeconds"]) for keyframe in keyframes]
    factors = [tuple(float(channel) for channel in keyframe["linearSrgbFactor"]) for keyframe in keyframes]
    if any(not math.isfinite(time) for time in times) or any(
        times[index] >= times[index + 1] for index in range(len(times) - 1)
    ):
        raise ValueError("material keyframe times must be finite and strictly increasing")
    if any(len(factor) != 3 or not all(math.isfinite(value) for value in factor) for factor in factors):
        raise ValueError("material keyframes must provide three finite linear-sRGB channels")
    sample_time = float(seconds)
    if not math.isfinite(sample_time):
        raise ValueError("Growth sample time must be finite")
    if sample_time <= times[0]:
        return factors[0]
    if sample_time >= times[-1]:
        return factors[-1]
    for index in range(len(times) - 1):
        if times[index] <= sample_time <= times[index + 1]:
            progress = (sample_time - times[index]) / (times[index + 1] - times[index])
            return tuple(factors[index][channel] +
                         (factors[index + 1][channel] - factors[index][channel]) * progress
                         for channel in range(3))
    raise ValueError("material Growth keyframes do not cover the requested time")


def render_engine_name(available: tuple[str, ...] | list[str]) -> str:
    """Select the installed Eevee identifier across Blender's engine naming change."""
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if candidate in available:
            return candidate
    raise RuntimeError(f"Eevee is unavailable; installed render engines: {tuple(available)}")


def viewer_camera_to_blender(position: tuple[float, float, float], target: tuple[float, float, float]) -> dict[str, tuple[float, float, float]]:
    """Map the stock viewer's glTF Y-up camera coordinates to Blender Z-up."""
    convert = lambda xyz: (float(xyz[0]), -float(xyz[2]), float(xyz[1]))
    return {"position": convert(position), "target": convert(target)}


def _args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-glb", type=Path, required=True)
    parser.add_argument("--final-glb", type=Path, required=True)
    parser.add_argument("--maturation-json", type=Path, default=ROOT / "export" / "bud_maturation.json")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=Path("reports/final_render_comparison.json"))
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    try:
        _, args.output_root = resolve_output_root(__file__, args.output_root)
    except RuntimeError as error:
        parser.error(str(error))
    args.baseline_glb = args.baseline_glb.resolve()
    args.final_glb = args.final_glb.resolve()
    args.maturation_json = args.maturation_json.resolve()
    args.report = (args.report if args.report.is_absolute() else args.output_root / args.report).resolve()
    try:
        args.maturation_json.relative_to(ROOT)
    except ValueError as error:
        parser.error("--maturation-json must stay inside refinement_03")
    render_dir = args.output_root / "screenshots" / "comparison"
    image_names = [
        f"{clip}_{label}_{side}.png"
        for clip, label in (("growth", "end"), ("bloom", "start"), ("bloom", "mid"), ("bloom", "end"))
        for side in ("before", "after")
    ] + ["growth_young_metadata.png", "growth_mature_metadata.png", "comparison_sheet.png"]
    output_paths = {"report": args.report}
    output_paths.update({f"image:{name}": render_dir / name for name in image_names})
    try:
        validate_output_paths(
            args.output_root,
            output_paths,
            inputs=(("baseline GLB", args.baseline_glb), ("final GLB", args.final_glb),
                    ("maturation JSON", args.maturation_json)),
            protected_roots=(ROOT / "baseline", PRIMARY_ROOT),
        )
    except RuntimeError as error:
        parser.error(str(error))
    for path in (args.baseline_glb, args.final_glb):
        if not path.is_file():
            parser.error(f"GLB does not exist: {path}")
    if not args.maturation_json.is_file():
        parser.error(f"maturation metadata does not exist: {args.maturation_json}")
    return args


def _animation_tracks(obj: Any) -> list[Any]:
    tracks = []
    for owner in _animation_owners(obj):
        animation_data = getattr(owner, "animation_data", None)
        if animation_data:
            tracks.extend(animation_data.nla_tracks)
    return tracks


def _animation_owners(obj: Any) -> list[Any]:
    owners = [obj]
    if obj.type == "MESH" and obj.data.shape_keys:
        owners.append(obj.data.shape_keys)
    return owners


def activate_nla_clip(animation_data: Any, clip: str) -> None:
    """Use imported NLA tracks instead of the active action assigned by glTF import."""
    if hasattr(animation_data, "action_slot") and animation_data.action is not None:
        animation_data.action_slot = None
    animation_data.action = None
    for track in animation_data.nla_tracks:
        track.mute = track.name != clip


def _read_gltf_document(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise RuntimeError(f"not a binary glTF asset: {path}")
    json_length = struct.unpack_from("<I", raw, 12)[0]
    if raw[16:20] != b"JSON" or 20 + json_length > len(raw):
        raise RuntimeError(f"binary glTF has no valid JSON chunk: {path}")
    return json.loads(raw[20:20 + json_length].decode("utf-8").rstrip("\x00 \t\r\n"))


def _gltf_shape_defaults(objects: list[Any], document: dict[str, Any]) -> dict[Any, list[float]]:
    """Map GLTF node/mesh default weights onto the matching imported mesh objects."""
    nodes = [node for node in document.get("nodes", []) if "mesh" in node]
    meshes = document.get("meshes", [])
    defaults: dict[int, list[float]] = {}
    for obj in objects:
        shape_keys = getattr(getattr(obj, "data", None), "shape_keys", None)
        if shape_keys is None:
            continue
        candidates = []
        for node in nodes:
            name = node.get("name")
            if not isinstance(name, str):
                continue
            if obj.name == name or (obj.name.startswith(name + ".") and obj.name[len(name) + 1:].isdigit()):
                candidates.append(node)
        if len(candidates) != 1:
            raise RuntimeError(f"could not map imported morph mesh {obj.name} to one GLTF node")
        node = candidates[0]
        mesh = meshes[node["mesh"]]
        target_count = max((len(primitive.get("targets", [])) for primitive in mesh.get("primitives", [])), default=0)
        weights = node.get("weights", mesh.get("weights", [0.0] * target_count))
        if len(weights) != target_count:
            raise RuntimeError(f"GLTF default morph weights do not match {obj.name} target count")
        blocks = [block for block in shape_keys.key_blocks if block.name != "Basis"]
        if len(blocks) != target_count:
            raise RuntimeError(f"imported shape-key count does not match {obj.name} GLTF targets")
        defaults[id(obj)] = [float(weight) for weight in weights]
    return defaults


def _restore_gltf_node_trs(objects: list[Any], document: dict[str, Any]) -> None:
    """Restore imported objects from GLB node defaults, not the importer's evaluated action frame."""
    if Quaternion is None or Matrix is None:
        raise RuntimeError("GLB node transform restoration must run under Blender")
    nodes = document.get("nodes", [])
    gltf_to_blender = Quaternion((math.sqrt(0.5), math.sqrt(0.5), 0.0, 0.0))
    for obj in objects:
        exact = [node for node in nodes if node.get("name") == obj.name]
        candidates = exact or [
            node for node in nodes
            if isinstance(node.get("name"), str)
            and obj.name.startswith(node["name"] + ".")
            and obj.name[len(node["name"]) + 1:].isdigit()
        ]
        if len(candidates) != 1:
            raise RuntimeError(f"could not map imported object {obj.name} to one GLTF node")
        node = candidates[0]
        if "matrix" in node:
            values = node["matrix"]
            if len(values) != 16:
                raise RuntimeError(f"GLTF node matrix has an invalid length: {obj.name}")
            gltf_matrix = Matrix([[float(values[column * 4 + row]) for column in range(4)] for row in range(4)])
            basis = gltf_to_blender.to_matrix().to_4x4()
            location, rotation, scale = (basis @ gltf_matrix @ basis.inverted()).decompose()
        else:
            translation = node.get("translation", (0.0, 0.0, 0.0))
            rotation_xyzw = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
            source_scale = node.get("scale", (1.0, 1.0, 1.0))
            if len(translation) != 3 or len(rotation_xyzw) != 4 or len(source_scale) != 3:
                raise RuntimeError(f"GLTF node TRS has an invalid component count: {obj.name}")
            source_rotation = Quaternion((rotation_xyzw[3], rotation_xyzw[0], rotation_xyzw[1], rotation_xyzw[2]))
            location = (float(translation[0]), -float(translation[2]), float(translation[1]))
            rotation = gltf_to_blender @ source_rotation @ gltf_to_blender.conjugated()
            scale = (float(source_scale[0]), float(source_scale[2]), float(source_scale[1]))
        obj.location = location
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = rotation
        obj.scale = scale


def capture_asset_rest_state(objects: list[Any], glb_path: Path | None = None) -> list[tuple[Any, dict[str, Any]]]:
    """Snapshot imported GLB node transforms and its actual morph defaults before sampling."""
    document = _read_gltf_document(glb_path) if glb_path is not None else None
    shape_defaults = _gltf_shape_defaults(objects, document) if document is not None else {}
    for obj in objects:
        for owner in _animation_owners(obj):
            animation_data = getattr(owner, "animation_data", None)
            if not animation_data:
                continue
            if hasattr(animation_data, "action_slot") and animation_data.action is not None:
                animation_data.action_slot = None
            animation_data.action = None
            for track in animation_data.nla_tracks:
                track.mute = True
    if document is not None:
        _restore_gltf_node_trs(objects, document)
    if bpy is not None:
        bpy.context.scene.frame_set(bpy.context.scene.frame_current)
        bpy.context.view_layer.update()
    state = []
    transform_properties = ("location", "scale", "delta_location", "delta_scale")
    for obj in objects:
        values = {name: tuple(getattr(obj, name)) for name in transform_properties if hasattr(obj, name)}
        if hasattr(obj, "rotation_mode"):
            values["rotation_mode"] = obj.rotation_mode
            rotation_property = {
                "QUATERNION": "rotation_quaternion",
                "AXIS_ANGLE": "rotation_axis_angle",
            }.get(obj.rotation_mode, "rotation_euler")
            values[rotation_property] = tuple(getattr(obj, rotation_property))
        if hasattr(obj, "delta_rotation_euler"):
            values["delta_rotation_euler"] = tuple(obj.delta_rotation_euler)
        shape_keys = getattr(getattr(obj, "data", None), "shape_keys", None)
        if shape_keys is not None:
            if id(obj) in shape_defaults:
                blocks = [block for block in shape_keys.key_blocks if block.name != "Basis"]
                values["shape_key_values"] = [(block, weight) for block, weight in zip(blocks, shape_defaults[id(obj)])]
            else:
                values["shape_key_values"] = [(block, float(block.value)) for block in shape_keys.key_blocks]
        state.append((obj, values))
    return state


def restore_asset_rest_state(asset: dict[str, Any]) -> None:
    """Clear imported actions/slots, mute NLA tracks, and restore GLB rest values."""
    for obj, values in asset["restState"]:
        for owner in _animation_owners(obj):
            animation_data = getattr(owner, "animation_data", None)
            if not animation_data:
                continue
            if hasattr(animation_data, "action_slot") and animation_data.action is not None:
                animation_data.action_slot = None
            animation_data.action = None
            for track in animation_data.nla_tracks:
                track.mute = True
        for name, value in values.items():
            if name == "shape_key_values":
                for block, rest_value in value:
                    block.value = rest_value
            else:
                setattr(obj, name, value)
    if bpy is not None:
        bpy.context.view_layer.update()


def apply_metadata_factor(material: Any, factor: tuple[float, float, float]) -> None:
    """Multiply the imported mature PBR texture by one transient linear-sRGB factor."""
    material.use_nodes = True
    tree = material.node_tree
    principled = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        raise RuntimeError(f"PBR material has no Principled BSDF: {material.name}")
    base_color = principled.inputs["Base Color"]
    multiplier = tree.nodes.get("__ALU_metadata_color_factor")
    if multiplier is None:
        multiplier = tree.nodes.new("ShaderNodeMixRGB")
        multiplier.name = "__ALU_metadata_color_factor"
        multiplier.label = "Transient Growth metadata factor (linear-sRGB)"
        multiplier.blend_type = "MULTIPLY"
        multiplier.inputs["Fac"].default_value = 1.0
        source_links = list(base_color.links)
        if source_links:
            tree.links.new(source_links[0].from_socket, multiplier.inputs["Color1"])
            for link in source_links:
                tree.links.remove(link)
        else:
            multiplier.inputs["Color1"].default_value = base_color.default_value
        tree.links.new(multiplier.outputs["Color"], base_color)
    multiplier.inputs["Color2"].default_value = (*factor, 1.0)


def apply_growth_metadata(asset: dict[str, Any], material_factors: list[dict[str, Any]], seconds: float) -> dict[str, list[float]]:
    """Apply metadata samples to imported petal materials for diagnostic renders only."""
    materials = {slot.material for obj in asset["objects"] if obj.type == "MESH"
                 for slot in obj.material_slots if slot.material is not None}
    sampled: dict[str, list[float]] = {}
    for contract in material_factors:
        expected_name = contract["material"]
        candidates = [material for material in materials
                      if material.name == expected_name or material.name.startswith(expected_name + ".")]
        if len(candidates) != 1:
            raise RuntimeError(f"expected one imported {expected_name} material, found {len(candidates)}")
        factor = sample_color_factor(contract, seconds)
        apply_metadata_factor(candidates[0], factor)
        sampled[expected_name] = list(factor)
    return sampled


def _clear_factory_scene() -> None:
    if bpy.data.filepath:
        raise RuntimeError("render comparison must start with Blender --factory-startup, not a user blend file")
    bpy.context.scene.camera = None
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _import_glb(path: Path, label: str) -> Any:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"GLB import produced no objects: {path}")
    collection = bpy.data.collections.new(f"__ALU_{label}")
    bpy.context.scene.collection.children.link(collection)
    for obj in imported:
        for owner_collection in list(obj.users_collection):
            owner_collection.objects.unlink(obj)
        collection.objects.link(obj)
    collection.hide_render = True
    durations: dict[str, float] = {}
    for obj in imported:
        for track in _animation_tracks(obj):
            if track.name in ("Growth", "Bloom") and track.strips:
                strip = track.strips[0]
                duration = (strip.action_frame_end - strip.action_frame_start) / (bpy.context.scene.render.fps * strip.scale)
                durations[track.name] = max(duration, durations.get(track.name, 0.0))
    if set(durations) != {"Growth", "Bloom"}:
        raise RuntimeError(f"could not read exported Growth/Bloom NLA clips for {label}: {durations}")
    asset = {"collection": collection, "objects": imported, "durations": durations,
             "restState": capture_asset_rest_state(imported, path)}
    restore_asset_rest_state(asset)
    return asset


def _set_pose(asset: dict[str, Any], clip: str, seconds: float) -> None:
    scene = bpy.context.scene
    restore_asset_rest_state(asset)
    found = False
    target_frame = None
    fps = scene.render.fps / scene.render.fps_base
    for obj in asset["objects"]:
        for owner in _animation_owners(obj):
            animation_data = getattr(owner, "animation_data", None)
            if not animation_data:
                continue
            activate_nla_clip(animation_data, clip)
            for track in animation_data.nla_tracks:
                if track.name == clip and track.strips:
                    strip = track.strips[0]
                    target_frame = strip.frame_start + seconds * fps * strip.scale
                    found = True
    if not found or target_frame is None:
        raise RuntimeError(f"could not select {clip} NLA strips")
    scene.frame_set(round(target_frame))
    bpy.context.view_layer.update()


def _add_camera_and_lights() -> tuple[list[Any], list[Any], Any]:
    scene = bpy.context.scene
    created_objects, created_data = [], []
    camera_data = bpy.data.cameras.new("__ALU_comparison_camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = CAMERA_ORTHO_SCALE
    created_data.append(camera_data)
    camera = bpy.data.objects.new("__ALU_comparison_camera", camera_data)
    scene.collection.objects.link(camera)
    camera_pose = viewer_camera_to_blender(CAMERA_POSITION_SOURCE, CAMERA_TARGET_SOURCE)
    camera.location = camera_pose["position"]
    target = Vector(camera_pose["target"])
    camera.location = target + (camera.location - target) * CAMERA_DISTANCE_SCALE
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    created_objects.append(camera)

    world = bpy.data.worlds.new("__ALU_comparison_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.035, 0.075, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    saved_world = scene.world
    scene.world = world
    created_data.append(world)

    for name, location, energy, color, size in (
        ("__ALU_key", (2, 3, 3), 500.0, (1.0, 0.89, 0.86), 3.0),
        ("__ALU_fill", (-2, 2, -3), 360.0, (0.73, 0.66, 1.0), 3.5),
        ("__ALU_front", (0, -3, 1), 240.0, (1.0, 0.95, 0.88), 4.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
        created_data.append(data)
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
        created_objects.append(light)
    bpy.context.view_layer.update()
    return created_objects, created_data, saved_world


def set_render_asset_visibility(assets: tuple[dict[str, Any], ...], active_asset: dict[str, Any]) -> None:
    """Render one imported GLB at a time so before/after objects cannot overlap."""
    for asset in assets:
        asset["collection"].hide_render = asset is not active_asset


def _render_one(asset: dict[str, Any], assets: tuple[dict[str, Any], ...],
                clip: str, seconds: float, label: str, output: Path) -> dict[str, Any]:
    set_render_asset_visibility(assets, asset)
    _set_pose(asset, clip, seconds)
    scene = bpy.context.scene
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return {"path": str(output.resolve()), "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}


def _write_contact_sheet(records: list[dict[str, Any]], output_path: Path) -> dict[str, Any]:
    """Write paired BEFORE/AFTER rows, followed by the metadata young/mature pair."""
    from array import array

    images = [bpy.data.images.load(record["path"], check_existing=False) for record in records]
    try:
        if not images:
            raise RuntimeError("contact sheet requires rendered images")
        if any(tuple(image.size) != (720, 900) for image in images):
            raise RuntimeError("contact sheet expects the shared 720x900 render size")
        tile_width, tile_height = 360, 450
        for image in images:
            image.colorspace_settings.name = "Non-Color"
            image.scale(tile_width, tile_height)
        columns = 2
        rows = (len(images) + columns - 1) // columns
        sheet = bpy.data.images.new("__ALU_final_comparison_sheet", width=tile_width * columns,
                                    height=tile_height * rows, alpha=False, float_buffer=False)
        try:
            sheet.colorspace_settings.name = "Non-Color"
            pixels = array("f", [0.0]) * (tile_width * columns * tile_height * rows * 4)
            for image_index, image in enumerate(images):
                source = array("f", image.pixels[:])
                left = (image_index % columns) * tile_width
                bottom = (rows - 1 - image_index // columns) * tile_height
                row_size = tile_width * 4
                for y in range(tile_height):
                    source_start = y * row_size
                    target_start = ((bottom + y) * tile_width * columns + left) * 4
                    pixels[target_start:target_start + row_size] = source[source_start:source_start + row_size]
            sheet.pixels.foreach_set(pixels)
            sheet.filepath_raw = str(output_path)
            sheet.file_format = "PNG"
            sheet.save()
        finally:
            bpy.data.images.remove(sheet)
    finally:
        for image in images:
            bpy.data.images.remove(image)
    return {"path": str(output_path.resolve()), "bytes": output_path.stat().st_size,
            "sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
            "resolution": [tile_width * columns, tile_height * rows],
            "layout": "rows 1-4: BEFORE/AFTER checkpoints; row 5: young/mature metadata pair"}


def main() -> None:
    if bpy is None:
        raise SystemExit("Run with Blender 5.2: blender --background --python render_comparison.py -- ...")
    args = _args()
    if args.baseline_glb == args.final_glb:
        raise RuntimeError("baseline and final GLB inputs must be different files")
    _clear_factory_scene()
    scene = bpy.context.scene
    engine_ids = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = render_engine_name(engine_ids)
    scene.render.resolution_x, scene.render.resolution_y = 720, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps, scene.render.fps_base = 24, 1.0
    scene.view_settings.view_transform = "AgX"
    scene.render.image_settings.color_mode = "RGBA"

    before = _import_glb(args.baseline_glb, "before")
    after = _import_glb(args.final_glb, "after")
    created_objects, created_data, saved_world = _add_camera_and_lights()
    scene.render.resolution_x, scene.render.resolution_y = 720, 900
    output_dir = args.output_root / "screenshots" / "comparison"
    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoints = comparison_checkpoints(before["durations"], after["durations"])
    rendered = []
    color_samples = []
    metadata = json.loads(args.maturation_json.read_text(encoding="utf-8"))
    if (metadata.get("schemaVersion") != 1 or metadata.get("clip") != "Growth"
            or metadata.get("durationSeconds") != 9.0
            or metadata.get("colorSpace") != "linear-sRGB"
            or metadata.get("sampling", {}).get("mode") != "absolute-clip-time"):
        raise RuntimeError("maturation metadata does not satisfy the Growth absolute-time contract")
    material_factors = metadata.get("materialFactors", [])
    if {factor.get("material") for factor in material_factors} != {"Petal_Pearl", "Petal_Outside"}:
        raise RuntimeError("maturation metadata must contain both petal material factors")
    try:
        for checkpoint in checkpoints:
            record = {**checkpoint}
            for key, asset, seconds in (
                ("before", before, checkpoint["beforeSeconds"]),
                ("after", after, checkpoint["afterSeconds"]),
            ):
                path = output_dir / f"{checkpoint['clip'].lower()}_{checkpoint['label']}_{key}.png"
                image_record = _render_one(asset, (before, after), checkpoint["clip"], seconds, key, path)
                record[key] = image_record
            rendered.append(record)
        geometry_pose_seconds = after["durations"]["Growth"]
        for label, metadata_seconds in (("young", 0.0), ("mature", 9.0)):
            sampled_factors = apply_growth_metadata(after, material_factors, metadata_seconds)
            path = output_dir / f"growth_{label}_metadata.png"
            image_record = _render_one(after, (before, after), "Growth", geometry_pose_seconds, label, path)
            color_samples.append({
                "label": label,
                "clip": "Growth",
                "absoluteSeconds": metadata_seconds,
                "metadataSampling": "absolute clip time; piecewise-linear in linear-sRGB",
                "materialFactors": sampled_factors,
                "geometryPose": "same final GLB; Growth end pose held fixed for a color-only metadata comparison",
                "geometryPoseSeconds": geometry_pose_seconds,
                "image": image_record,
            })
    finally:
        scene.world = saved_world
        for obj in created_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        for data in created_data:
            if data.users == 0:
                if data.bl_rna.identifier == "Camera":
                    bpy.data.cameras.remove(data)
                elif data.bl_rna.identifier == "Light":
                    bpy.data.lights.remove(data)
                elif data.bl_rna.identifier == "World":
                    bpy.data.worlds.remove(data)

    sheet_records = [image for checkpoint in rendered for image in (checkpoint["before"], checkpoint["after"])]
    sheet_records.extend(sample["image"] for sample in color_samples)
    contact_sheet = _write_contact_sheet(sheet_records, output_dir / "comparison_sheet.png")
    camera_pose = viewer_camera_to_blender(CAMERA_POSITION_SOURCE, CAMERA_TARGET_SOURCE)

    report = {
        "schemaVersion": 1,
        "status": "PASS",
        "renderer": scene.render.engine,
        "resolution": [scene.render.resolution_x, scene.render.resolution_y],
        "camera": {
            "position": [camera_pose["target"][axis] +
                         (camera_pose["position"][axis] - camera_pose["target"][axis]) * CAMERA_DISTANCE_SCALE
                         for axis in range(3)],
            "target": list(camera_pose["target"]),
            "sourceCoordinates": "stock viewer glTF Y-up",
            "projection": "orthographic",
            "orthoScale": CAMERA_ORTHO_SCALE,
            "elevationDegrees": round(math.degrees(math.atan2(
                camera_pose["position"][2] - camera_pose["target"][2],
                math.hypot(camera_pose["position"][0] - camera_pose["target"][0],
                           camera_pose["position"][1] - camera_pose["target"][1]))), 2),
            "distanceScale": CAMERA_DISTANCE_SCALE,
        },
        "lighting": "same temporary camera/world/area lights for both GLBs",
        "before": {"path": str(args.baseline_glb), "sha256": hashlib.sha256(args.baseline_glb.read_bytes()).hexdigest(), "durationsSeconds": before["durations"]},
        "after": {"path": str(args.final_glb), "sha256": hashlib.sha256(args.final_glb.read_bytes()).hexdigest(), "durationsSeconds": after["durations"]},
        "checkpoints": rendered,
        "colorMetadata": {
            "contract": str(args.maturation_json),
            "schemaVersion": metadata["schemaVersion"],
            "sampling": metadata["sampling"],
            "plainGLTFLoaderDefault": "mature material; the viewer does not consume this metadata",
            "samples": color_samples,
        },
        "contactSheet": contact_sheet,
        "knownLimitation": "Blender EEVEE render uses a shared comparison setup; final viewer camera/light proof is recorded separately.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"RENDER_COMPARISON PASS images={len(rendered) * 2 + len(color_samples)} sheet={contact_sheet['path']} report={args.report}")


if __name__ == "__main__":
    main()
