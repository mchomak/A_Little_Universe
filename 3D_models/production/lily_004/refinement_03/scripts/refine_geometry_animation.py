"""Refine the existing Lily 004 tepal deformation and retime its NLA clips."""

import argparse
import hashlib
import json
import math
import sys
import traceback
from collections import Counter, defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry_path_safety import resolve_output_root, validate_output_paths


CLIP_SECONDS = {
    "Growth": 9.0,
    "IdleClosed": 8.0,
    "TouchResponse": 2.0,
    "Bloom": 8.0,
    "IdleOpen": 8.0,
    "DissolveReady": 1.0,
}
PETAL_ROWS = 33
PETAL_COLUMNS = 15
PETAL_COUNT = 6
SMOOTHING_PASSES = 12
SMOOTHING_STRENGTH = 1.0
MIDSECTION_ARC_M = 0.008
CROSS_SECTION_CAMBER_M = 0.002
MIDSECTION_SHOULDER_M = 0.002
GROWTH_BUD_CONTRACTION = 0.08


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--blend", default="source/lily_004_geometry.blend")
    parser.add_argument("--glb", default="export/lily_004_geometry.glb")
    parser.add_argument("--report", default="reports/geometry_refinement.json")
    parser.add_argument("--screenshots", default="screenshots")
    parser.add_argument("--render-mode", choices=("full", "focused", "none"), default="full")
    return parser.parse_args(values)


def safe_path(root, relative):
    root = root.resolve()
    target = (root / relative).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise RuntimeError(f"Refusing to write outside refinement_03: {target}") from error
    return target


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def row_profile(obj, island, use_pose):
    keys = obj.data.shape_keys.key_blocks
    basis = keys["Basis"].data
    profile = []
    for row in range(PETAL_ROWS):
        sums = Vector()
        for column in range(PETAL_COLUMNS):
            index = island * PETAL_ROWS * PETAL_COLUMNS + row * PETAL_COLUMNS + column
            base = basis[index].co
            point = base.copy()
            if use_pose:
                for key in keys[1:]:
                    weight = key.value
                    if abs(weight) > 1e-9:
                        point += (key.data[index].co - base) * weight
            sums += point / PETAL_COLUMNS
        profile.append(sums)
    return profile


def bend_metric(profile, basis):
    worst = {"magnitude_m": 0.0, "row": None}
    for row in range(1, PETAL_ROWS - 1):
        displacement_curve = (
            (profile[row + 1] - 2.0 * profile[row] + profile[row - 1])
            - (basis[row + 1] - 2.0 * basis[row] + basis[row - 1])
        )
        magnitude = displacement_curve.length
        if magnitude > worst["magnitude_m"]:
            worst = {"magnitude_m": magnitude, "row": row}
    return worst


def sample_bloom_bend(scene, obj, frame_step=6):
    track = next((track for track in obj.data.shape_keys.animation_data.nla_tracks if track.name == "Bloom"), None)
    if not track or not track.strips:
        raise RuntimeError(f"Missing Bloom strip on {obj.name}")
    strip = track.strips[0]
    first = round(strip.frame_start)
    last = round(strip.frame_end)
    basis = [row_profile(obj, island, False) for island in range(PETAL_COUNT)]
    samples = []
    for frame in range(first, last + 1, frame_step):
        scene.frame_set(frame)
        for island in range(PETAL_COUNT):
            metric = bend_metric(row_profile(obj, island, True), basis[island])
            samples.append({
                "object": obj.name,
                "island": island + 1,
                "frame": frame,
                "time_seconds": round((frame - strip.frame_start) / (scene.render.fps / scene.render.fps_base), 6),
                **metric,
            })
    return samples


def inventory_shape_keys():
    inventory = {}
    for object_name in ("Petals", "Petals_Outside", "Stem", "Leaf_A", "Leaf_B"):
        obj = bpy.data.objects.get(object_name)
        if obj and obj.data.shape_keys:
            inventory[object_name] = [key.name for key in obj.data.shape_keys.key_blocks]
    return inventory


def animation_owners():
    for obj in bpy.data.objects:
        if obj.animation_data and obj.animation_data.nla_tracks:
            yield obj.name, obj.animation_data
        keys = obj.data.shape_keys if obj.data and getattr(obj.data, "shape_keys", None) else None
        if keys and keys.animation_data and keys.animation_data.nla_tracks:
            yield f"{obj.name}.shape_keys", keys.animation_data


def smooth_target_deltas():
    changed = {}
    for object_name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[object_name]
        keys = obj.data.shape_keys.key_blocks
        basis = keys["Basis"].data
        for key in keys[1:]:
            if not key.name.startswith("SeamClear_"):
                continue
            for island in range(PETAL_COUNT):
                for column in range(PETAL_COLUMNS):
                    indices = [
                        island * PETAL_ROWS * PETAL_COLUMNS + row * PETAL_COLUMNS + column
                        for row in range(PETAL_ROWS)
                    ]
                    original = [key.data[index].co - basis[index].co for index in indices]
                    filtered = [value.copy() for value in original]
                    for _ in range(SMOOTHING_PASSES):
                        updated = [value.copy() for value in filtered]
                        for row in range(1, PETAL_ROWS - 1):
                            updated[row] = filtered[row - 1] * 0.25 + filtered[row] * 0.5 + filtered[row + 1] * 0.25
                        filtered = updated
                    for row, index in enumerate(indices):
                        correction = original[row].lerp(filtered[row], SMOOTHING_STRENGTH)
                        key.data[index].co = basis[index].co + correction
            obj.data.update()
            changed.setdefault(object_name, []).append(key.name)
    return changed


def shape_key_coordinate_snapshot(mesh):
    if not mesh.shape_keys:
        return ()
    return tuple((key.name, tuple(tuple(point.co) for point in key.data))
                 for key in mesh.shape_keys.key_blocks)


def uv_vertex_snapshot(mesh):
    result = {}
    for layer in mesh.uv_layers:
        by_vertex = defaultdict(set)
        for loop_index, loop in enumerate(mesh.loops):
            uv = layer.data[loop_index].uv
            by_vertex[loop.vertex_index].add((float(uv.x), float(uv.y)))
        result[layer.name] = tuple((index, tuple(sorted(values)))
                                   for index, values in sorted(by_vertex.items()))
    return result


def shape_key_animation_snapshot(mesh):
    shape_keys = mesh.shape_keys
    animation = shape_keys.animation_data if shape_keys else None
    if not animation:
        return ()
    return tuple((track.name, tuple((strip.name, strip.action.name,
                                     strip.frame_start, strip.frame_end,
                                     strip.action_frame_start, strip.action_frame_end,
                                     strip.blend_type, strip.influence)
                                    for strip in track.strips))
                 for track in animation.nla_tracks)


def triangle_signature_counts(mesh):
    mesh.calc_loop_triangles()
    return Counter(tuple(sorted(triangle.vertices)) for triangle in mesh.loop_triangles)


def triangulate_tepal_surfaces():
    """Freeze the exact Basis/GLB quad diagonal in the two animated tepal grids."""
    results = {}
    for object_name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[object_name]
        mesh = obj.data
        if any(len(poly.vertices) != 4 for poly in mesh.polygons):
            raise RuntimeError(f"Expected quad-only input for {object_name}")
        before = {
            "vertices": len(mesh.vertices),
            "shape_key_coordinates": shape_key_coordinate_snapshot(mesh),
            "uv_vertex_values": uv_vertex_snapshot(mesh),
            "shape_key_animation": shape_key_animation_snapshot(mesh),
            "triangle_signatures": triangle_signature_counts(mesh),
            "material_counts": Counter(poly.material_index for poly in mesh.polygons),
            "material_slots": tuple(slot.name for slot in obj.material_slots),
            "face_count": len(mesh.polygons),
        }
        expected_material_counts = Counter()
        for poly in mesh.polygons:
            expected_material_counts[poly.material_index] += 2

        prior_active = bpy.context.view_layer.objects.active
        prior_selection = tuple(bpy.context.selected_objects)
        try:
            if bpy.context.object and bpy.context.object.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.quads_convert_to_tris(quad_method="FIXED", ngon_method="BEAUTY")
            bpy.ops.object.mode_set(mode="OBJECT")
        finally:
            if bpy.context.object and bpy.context.object.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")
            bpy.ops.object.select_all(action="DESELECT")
            for selected in prior_selection:
                if bpy.data.objects.get(selected.name) is selected:
                    selected.select_set(True)
            if prior_active and bpy.data.objects.get(prior_active.name) is prior_active:
                bpy.context.view_layer.objects.active = prior_active

        mesh = obj.data
        mesh.update()
        after_triangles = triangle_signature_counts(mesh)
        checks = {
            "vertex_count_preserved": len(mesh.vertices) == before["vertices"],
            "shape_key_coordinates_preserved": shape_key_coordinate_snapshot(mesh) == before["shape_key_coordinates"],
            "uv_vertex_values_preserved": uv_vertex_snapshot(mesh) == before["uv_vertex_values"],
            "shape_key_animation_preserved": shape_key_animation_snapshot(mesh) == before["shape_key_animation"],
            "material_slots_preserved": tuple(slot.name for slot in obj.material_slots) == before["material_slots"],
            "material_face_counts_preserved": Counter(poly.material_index for poly in mesh.polygons) == expected_material_counts,
            "fixed_basis_diagonal_preserved": after_triangles == before["triangle_signatures"],
            "all_faces_triangles": all(len(poly.vertices) == 3 for poly in mesh.polygons),
        }
        if not all(checks.values()):
            raise RuntimeError(f"Static triangulation changed protected {object_name} data: {checks}")
        results[object_name] = {
            "vertices": len(mesh.vertices),
            "faces_before": before["face_count"],
            "faces_after": len(mesh.polygons),
            "triangles_after": sum(after_triangles.values()),
            "triangulation": "FIXED; matches Basis mesh.loop_triangles and exported GLB connectivity",
            "checks": checks,
        }
    return results


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def restore_v13_tipcurl_targets(reference_path):
    """Map v13's evaluated open positions into the current TipCurl targets."""
    object_names = ("Petals", "Petals_Outside")
    data_collections = (
        bpy.data.meshes,
        bpy.data.shape_keys,
        bpy.data.actions,
        bpy.data.materials,
        bpy.data.images,
    )
    original_ids = {collection: {item.as_pointer() for item in collection}
                    for collection in data_collections}
    imported_objects = []
    reference_positions = {}
    objects = {}
    try:
        with bpy.data.libraries.load(str(reference_path), link=False) as (data_from, data_to):
            missing = set(object_names) - set(data_from.objects)
            if missing:
                raise RuntimeError(f"v13 reference is missing tepal objects: {sorted(missing)}")
            data_to.objects = list(object_names)
        imported_objects = [obj for obj in data_to.objects if obj is not None]
        if len(imported_objects) != len(object_names):
            raise RuntimeError("v13 reference did not load both tepal objects")

        for object_name, reference_obj in zip(object_names, imported_objects):
            target_obj = bpy.data.objects[object_name]
            reference_keys = reference_obj.data.shape_keys.key_blocks
            target_keys = target_obj.data.shape_keys.key_blocks
            if len(reference_obj.data.vertices) != len(target_obj.data.vertices):
                raise RuntimeError(
                    f"Cannot transfer {object_name}: v13 has {len(reference_obj.data.vertices)} vertices, "
                    f"04m has {len(target_obj.data.vertices)}"
                )
            if len(reference_obj.data.polygons) != len(target_obj.data.polygons):
                raise RuntimeError(
                    f"Cannot transfer {object_name}: v13/04m face counts differ "
                    f"({len(reference_obj.data.polygons)} vs {len(target_obj.data.polygons)})"
                )
            if "Basis" not in reference_keys or "TipCurl" not in reference_keys:
                raise RuntimeError(f"v13 {object_name} needs Basis and TipCurl shape keys")
            if "Basis" not in target_keys or "TipCurl" not in target_keys:
                raise RuntimeError(f"04m {object_name} needs Basis and TipCurl shape keys")
            reference_basis = reference_keys["Basis"].data
            reference_tip = reference_keys["TipCurl"]
            target_basis = target_keys["Basis"].data
            target_tip = target_keys["TipCurl"]
            if reference_tip.relative_key != reference_keys["Basis"]:
                raise RuntimeError(f"v13 {object_name}.TipCurl is not relative to Basis")
            if target_tip.relative_key != target_keys["Basis"]:
                raise RuntimeError(f"04m {object_name}.TipCurl is not relative to Basis")

            transferred_max = 0.0
            target_inverse = target_obj.matrix_world.inverted()
            reference_world_positions = []
            for index in range(len(target_basis)):
                old_position = target_tip.data[index].co.copy()
                source_position = reference_obj.matrix_world @ reference_tip.data[index].co
                source_local = target_inverse @ source_position
                target_tip.data[index].co = source_local
                reference_world_positions.append(source_position.copy())
                transferred_max = max(transferred_max, (target_tip.data[index].co - old_position).length)
            target_obj.data.update()
            reference_positions[object_name] = reference_world_positions
            objects[object_name] = {
                "source_target": "v13 evaluated TipCurl=1 endpoint mapped through current object inverse transform",
                "vertex_count": len(target_basis),
                "face_count": len(target_obj.data.polygons),
                "max_removed_04m_target_delta_m": round(transferred_max, 6),
                "mapped_rows": [0, PETAL_ROWS - 1],
            }
    finally:
        for obj in imported_objects:
            if bpy.data.objects.get(obj.name) is obj:
                bpy.data.objects.remove(obj, do_unlink=True)
        for collection in data_collections:
            for item in list(collection):
                if item.as_pointer() not in original_ids[collection] and item.users == 0:
                    collection.remove(item)

    return reference_positions, objects


def sculpt_open_tip_profile(scene, reference_path):
    """Start from v13's full-open target, then add only a restrained mid-row bend."""
    petals = bpy.data.objects["Petals"]
    scene.frame_set(round(next(track.strips[0].frame_end for track in
                               petals.data.shape_keys.animation_data.nla_tracks if track.name == "Bloom")))
    reference_positions, transferred_objects = restore_v13_tipcurl_targets(reference_path)
    local_up = petals.matrix_world.to_3x3().inverted() @ Vector((0.0, 0.0, 1.0))
    local_up.normalize()
    changed = {}
    for object_name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[object_name]
        keys = obj.data.shape_keys.key_blocks
        basis = keys["Basis"].data
        key = keys["TipCurl"]
        cross_parameters = [column / (PETAL_COLUMNS - 1) * 2.0 - 1.0
                            for column in range(PETAL_COLUMNS)]
        mean_square = sum(value * value for value in cross_parameters) / PETAL_COLUMNS
        shoulder_profile = [4.0 * value * value * (1.0 - value * value)
                            for value in cross_parameters]
        mean_shoulder = sum(shoulder_profile) / PETAL_COLUMNS
        max_added_displacement = 0.0
        max_cross_mean = 0.0
        for island in range(PETAL_COUNT):
            start = island * PETAL_ROWS * PETAL_COLUMNS
            for row in range(PETAL_ROWS):
                u = row / (PETAL_ROWS - 1)
                longitudinal = math.sin(math.pi * u)
                root_guard = smoothstep(u / 0.14)
                mid_arc = MIDSECTION_ARC_M * longitudinal ** 1.7 * root_guard
                cross_envelope = longitudinal ** 1.2 * root_guard
                cross_offsets = []
                for column in range(PETAL_COLUMNS):
                    index = start + row * PETAL_COLUMNS + column
                    s = cross_parameters[column]
                    camber = CROSS_SECTION_CAMBER_M * 3.0 * (s * s - mean_square) * cross_envelope
                    shoulder = MIDSECTION_SHOULDER_M * (shoulder_profile[column] - mean_shoulder) * cross_envelope
                    cross_offsets.append(camber + shoulder)
                    correction = local_up * (mid_arc + camber + shoulder)
                    key.data[index].co += correction
                    max_added_displacement = max(max_added_displacement, correction.length)
                max_cross_mean = max(max_cross_mean, abs(sum(cross_offsets) / PETAL_COLUMNS))
        obj.data.update()
        changed[object_name] = {
            "target": "TipCurl",
            "max_added_displacement_m": round(max_added_displacement, 6),
            "longitudinal_arc_m": MIDSECTION_ARC_M,
            "zero_mean_cross_section_camber_scale_m": CROSS_SECTION_CAMBER_M,
            "zero_mean_shoulder_relief_m": MIDSECTION_SHOULDER_M,
            "max_absolute_cross_section_mean_offset_m": round(max_cross_mean, 12),
        }
    return {
        "reference_blend": str(reference_path.resolve()),
        "reference_sha256": sha256(reference_path),
        "objects": transferred_objects,
        "sculpted_objects": changed,
        "method": "v13 evaluated open endpoint positions mapped into matching TipCurl targets; restrained 8 mm longitudinal mid-row arc with 2 mm zero-mean transverse camber and shoulder relief; attachment and tip rows pinned",
        "tip_contour_blend": "none; v13 evaluated endpoint mapped across the full matching tepal grid",
        "_reference_open_positions": reference_positions,
    }


def compare_evaluated_open_pose_to_v13(scene, reference_positions):
    petals = bpy.data.objects["Petals"]
    bloom = next(track.strips[0] for track in
                 petals.data.shape_keys.animation_data.nla_tracks if track.name == "Bloom")
    scene.frame_set(round(bloom.frame_end))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    by_object = {}
    all_deltas = []
    samples = []
    for object_name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[object_name]
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        candidate = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        reference = reference_positions[object_name]
        if len(candidate) != len(reference):
            evaluated.to_mesh_clear()
            raise RuntimeError(f"v13 endpoint vertex count changed for {object_name}")
        deltas = [(point - target).length for point, target in zip(candidate, reference)]
        all_deltas.extend(deltas)
        by_object[object_name] = {
            "vertices": len(deltas),
            "max_vertex_delta_m": max(deltas, default=0.0),
            "mean_vertex_delta_m": sum(deltas) / len(deltas),
        }
        if object_name == "Petals":
            for island in range(PETAL_COUNT):
                index = island * PETAL_ROWS * PETAL_COLUMNS + 16 * PETAL_COLUMNS + 7
                point = candidate[index]
                target = reference[index]
                delta = point - target
                samples.append({
                    "island": island + 1,
                    "row": 16,
                    "column": 7,
                    "reference_world_m": [round(value, 6) for value in target],
                    "candidate_world_m": [round(value, 6) for value in point],
                    "delta_world_m": [round(value, 6) for value in delta],
                    "delta_length_m": round(delta.length, 6),
                })
        evaluated.to_mesh_clear()
    return {
        "reference": "baseline/lily_004_v13_final.blend Bloom endpoint (16 s)",
        "candidate": "source/lily_004_geometry.blend Bloom endpoint (8 s), evaluated",
        "max_vertex_delta_m": max(all_deltas, default=0.0),
        "mean_vertex_delta_m": sum(all_deltas) / len(all_deltas),
        "by_object": by_object,
        "mid_row_centerline_samples": samples,
        "attachment_and_tip_rows_are_pinned_by_correction": [0, PETAL_ROWS - 1],
    }


def add_growth_bud_profile(scene):
    """Add an edge-preserving, six-island closed-bud fullness variation to Growth."""
    primary = bpy.data.objects["Petals"]
    keys = primary.data.shape_keys.key_blocks
    basis = keys["Basis"].data
    closed_keys = [keys[f"Closed_{index:02d}"] for index in range(1, PETAL_COUNT + 1)]
    closed_points = []
    for vertex_index in range(len(basis)):
        point = basis[vertex_index].co.copy()
        for key in closed_keys:
            point += key.data[vertex_index].co - basis[vertex_index].co
        closed_points.append(point)
    center = sum(closed_points, Vector()) / len(closed_points)
    corrections = [Vector() for _ in basis]
    for island in range(PETAL_COUNT):
        for row in range(PETAL_ROWS):
            u = row / (PETAL_ROWS - 1)
            envelope = math.sin(math.pi * u) ** 1.35
            for column in range(PETAL_COLUMNS):
                index = island * PETAL_ROWS * PETAL_COLUMNS + row * PETAL_COLUMNS + column
                radial = closed_points[index] - center
                radial.z = 0.0
                corrections[index] = -radial * (GROWTH_BUD_CONTRACTION * envelope)

    created = {}
    for object_name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[object_name]
        if obj.data.shape_keys.key_blocks.get("GrowthBudForm"):
            raise RuntimeError(f"GrowthBudForm already exists on {object_name}; expected pristine baseline input")
        key = obj.shape_key_add(name="GrowthBudForm", from_mix=False)
        key.slider_min = 0.0
        key.slider_max = 1.0
        for index, correction in enumerate(corrections):
            key.data[index].co = obj.data.shape_keys.key_blocks["Basis"].data[index].co + correction
        obj.data.update()
        created[object_name] = key.name
    return {"name": "GrowthBudForm", "targets": created,
            "max_displacement_m": round(max(correction.length for correction in corrections), 6),
            "description": "8% coherent radial contraction of the six closed tepal islands at mid-length; row 0 and row 32 pinned"}


def set_curve_keys(curve, points):
    for frame, value in points:
        existing = next((point for point in curve.keyframe_points if abs(point.co.x - frame) < 1e-4), None)
        if existing is None:
            existing = curve.keyframe_points.insert(frame, value, options={"FAST"})
        else:
            existing.co.y = value
        existing.interpolation = "BEZIER"
        existing.handle_left_type = "AUTO_CLAMPED"
        existing.handle_right_type = "AUTO_CLAMPED"
    curve.update()


def animate_growth_bud_profile(scene):
    """Weight the juvenile closed-profile correction only inside Growth."""
    fps = scene.render.fps / scene.render.fps_base
    touched = []
    for object_name in ("Petals", "Petals_Outside"):
        keys = bpy.data.objects[object_name].data.shape_keys
        for track in keys.animation_data.nla_tracks:
            if track.name not in CLIP_SECONDS or not track.strips:
                continue
            strip = track.strips[0]
            action = strip.action
            action_strip = next(item for layer in action.layers for item in layer.strips)
            slot_handle = strip.action_slot.handle if strip.action_slot else None
            bag = next((item for item in action_strip.channelbags if item.slot_handle == slot_handle), None)
            if bag is None:
                raise RuntimeError(f"Cannot find action channelbag for {object_name}/{track.name}")
            data_path = 'key_blocks["GrowthBudForm"].value'
            curve = next((item for item in bag.fcurves if item.data_path == data_path and item.array_index == 0), None)
            if curve is None:
                curve = bag.fcurves.new(data_path=data_path, index=0)
            start = strip.action_frame_start
            duration = strip.action_frame_end - strip.action_frame_start
            if track.name == "Growth":
                profile = ((0.0, 1.0), (5.4, 1.0), (7.15, 0.78), (8.0, 0.35), (9.0, 0.0))
                points = [(start + seconds * fps, weight) for seconds, weight in profile]
            else:
                points = [(start, 0.0), (start + duration, 0.0)]
            set_curve_keys(curve, points)
            touched.append({"object": object_name, "clip": track.name,
                            "action": action.name, "frame_values": points})
    return touched


def retime_action(action, action_start, action_end, factor):
    if action is None:
        raise RuntimeError("NLA strip has no action")
    new_end = action_start + (action_end - action_start) * factor
    if not action.layers:
        raise RuntimeError(f"Unsupported legacy action datablock: {action.name}")
    for layer in action.layers:
        for action_strip in layer.strips:
            for bag in action_strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.co.x = action_start + (point.co.x - action_start) * factor
                        point.handle_left.x = action_start + (point.handle_left.x - action_start) * factor
                        point.handle_right.x = action_start + (point.handle_right.x - action_start) * factor
                    curve.update()
    return new_end


def retime_clips(scene):
    fps = scene.render.fps / scene.render.fps_base
    found = set()
    changed_actions = {}
    retimed_actions = {}
    for owner_name, animation in animation_owners():
        for track in animation.nla_tracks:
            if track.name not in CLIP_SECONDS:
                continue
            if not track.strips:
                raise RuntimeError(f"Empty NLA track: {owner_name}/{track.name}")
            if len(track.strips) != 1:
                raise RuntimeError(f"Expected one NLA strip: {owner_name}/{track.name}")
            strip = track.strips[0]
            duration_frames = strip.frame_end - strip.frame_start
            target_frames = CLIP_SECONDS[track.name] * fps
            factor = target_frames / duration_frames
            action_start = strip.action_frame_start
            action_end = strip.action_frame_end
            action_id = strip.action.as_pointer()
            if action_id not in retimed_actions:
                new_action_end = retime_action(strip.action, action_start, action_end, factor)
                retimed_actions[action_id] = factor
                changed_actions[strip.action.name] = factor
            elif abs(retimed_actions[action_id] - factor) > 1e-9:
                raise RuntimeError(f"Shared action has conflicting retime factors: {strip.action.name}")
            else:
                new_action_end = action_start + (action_end - action_start) * factor
            strip.action_frame_end = new_action_end
            strip.scale = 1.0
            expected_end = strip.frame_start + target_frames
            if abs(strip.frame_end - expected_end) > 1e-4:
                strip.frame_end = expected_end
            if abs(strip.frame_end - expected_end) > 1e-3:
                raise RuntimeError(f"NLA duration mismatch after retime: {owner_name}/{track.name}")
            found.add(track.name)
    if found != set(CLIP_SECONDS):
        raise RuntimeError(f"Clip inventory mismatch: {sorted(found)}")
    return changed_actions


def collect_clip_durations(scene):
    fps = scene.render.fps / scene.render.fps_base
    observations = {}
    for owner_name, animation in animation_owners():
        for track in animation.nla_tracks:
            if track.name in CLIP_SECONDS and track.strips:
                duration = (track.strips[0].frame_end - track.strips[0].frame_start) / fps
                observations.setdefault(track.name, []).append((owner_name, duration))
    durations = {}
    for clip_name, values in observations.items():
        duration = values[0][1]
        for owner_name, observed in values:
            if abs(observed - duration) > 1e-5:
                raise RuntimeError(f"Animation owners disagree on {clip_name} duration")
        durations[clip_name] = round(duration, 6)
    return durations


def clip_durations(scene):
    durations = collect_clip_durations(scene)
    for clip_name, expected in CLIP_SECONDS.items():
        if abs(durations.get(clip_name, float("inf")) - expected) > 1e-5:
            raise RuntimeError(f"Clip duration mismatch: {clip_name}={durations.get(clip_name)} expected={expected}")
    if set(durations) != set(CLIP_SECONDS):
        raise RuntimeError(f"Clip inventory mismatch: {sorted(durations)}")
    return durations


def render_studies(scene, screenshot_root, label, mode="full"):
    from mathutils import Vector

    if mode == "none" or (mode == "focused" and label.startswith("before")):
        return
    screenshot_root.mkdir(parents=True, exist_ok=True)
    old_camera = scene.camera
    old_engine = scene.render.engine
    old_resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    old_filepath = scene.render.filepath
    old_format = scene.render.image_settings.file_format
    old_color_mode = scene.render.image_settings.color_mode
    old_world = scene.world
    old_view_transform = scene.view_settings.view_transform
    old_exposure = scene.view_settings.exposure
    old_material_override = scene.view_layers[0].material_override
    created_objects = []
    created_data = []
    try:
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 800
        scene.render.resolution_y = 800
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.exposure = -0.5
        world = bpy.data.worlds.new("__geometry_study_world")
        world.use_nodes = True
        background = world.node_tree.nodes.get("Background")
        background.inputs["Color"].default_value = (0.08, 0.08, 0.095, 1.0)
        background.inputs["Strength"].default_value = 0.55
        scene.world = world
        created_data.append(world)
        target = Vector((0.095, -0.075, 0.58))
        camera_data = bpy.data.cameras.new("__geometry_study_camera")
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = 1.65
        camera = bpy.data.objects.new("__geometry_study_camera", camera_data)
        scene.collection.objects.link(camera)
        created_objects.append(camera)
        created_data.append(camera_data)
        scene.camera = camera
        light_specs = (
            ((-0.8, -1.4, 1.75), 75.0, 1.3),
            ((1.2, 0.5, 1.0), 42.0, 1.6),
            ((-0.3, 1.5, 0.75), 24.0, 1.3),
        )
        for index, (location, energy, size) in enumerate(light_specs):
            data = bpy.data.lights.new(f"__geometry_study_key_{index}", "AREA")
            data.energy = energy
            data.shape = "DISK"
            data.size = size
            light = bpy.data.objects.new(data.name, data)
            scene.collection.objects.link(light)
            light.location = location
            light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
            created_objects.append(light)
            created_data.append(data)
        blooms = [("front", Vector((0.0, -2.7, 0.08))),
                  ("three_quarter", Vector((1.8, -2.2, 0.12))),
                  ("side", Vector((2.7, 0.0, 0.08)))] if mode == "full" else []
        bloom_strip = next(track.strips[0] for track in bpy.data.objects["Petals"].data.shape_keys.animation_data.nla_tracks if track.name == "Bloom")
        max_seconds = round((bloom_strip.frame_end - bloom_strip.frame_start) /
                            (scene.render.fps / scene.render.fps_base))
        for angle_name, offset in blooms:
            camera.location = target + offset
            camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
            times = range(0, max_seconds + 1, max(1, max_seconds // 8)) if angle_name == "front" else (0, max_seconds // 4, max_seconds // 2, (3 * max_seconds) // 4, max_seconds)
            for seconds in times:
                scene.frame_set(round(bloom_strip.frame_start + seconds * scene.render.fps / scene.render.fps_base))
                scene.render.filepath = str(screenshot_root / f"geometry_{label}_bloom_{angle_name}_{seconds:02d}.png")
                bpy.ops.render.render(write_still=True)
        growth_strip = next(track.strips[0] for track in bpy.data.objects["Petals"].data.shape_keys.animation_data.nla_tracks if track.name == "Growth")
        camera.location = target + Vector((0.0, -2.7, 0.08))
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        growth_seconds = round((growth_strip.frame_end - growth_strip.frame_start) / (scene.render.fps / scene.render.fps_base))
        growth_samples = sorted(set((0, growth_seconds // 3, (2 * growth_seconds) // 3, growth_seconds))) if mode == "full" else []
        for seconds in growth_samples:
            scene.frame_set(round(growth_strip.frame_start + seconds * scene.render.fps / scene.render.fps_base))
            scene.render.filepath = str(screenshot_root / f"geometry_{label}_growth_front_{seconds:02d}.png")
            bpy.ops.render.render(write_still=True)

        # Focused studies use a single stable head-centered framing for the
        # closed, early, middle, almost-open, and open poses.
        scene.frame_set(round(bloom_strip.frame_start))
        if mode == "focused":
            frames = [round(bloom_strip.frame_start + seconds * scene.render.fps / scene.render.fps_base)
                      for seconds in (0.0, 0.8, 2.0, 4.0, float(max_seconds))]
        else:
            frames = [round(bloom_strip.frame_start + (bloom_strip.frame_end - bloom_strip.frame_start) * fraction)
                      for fraction in (0.0, 0.25, 0.5, 0.75, 1.0)]
        head_points = []
        for frame in frames:
            scene.frame_set(frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            for name in ("Calyx", "Flower_Details", "Petals", "Petals_Outside"):
                obj = bpy.data.objects.get(name)
                if not obj:
                    continue
                evaluated = obj.evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                head_points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
                evaluated.to_mesh_clear()
        minimum = Vector(tuple(min(point[axis] for point in head_points) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in head_points) for axis in range(3)))
        detail_target = (minimum + maximum) * 0.5
        camera_data.ortho_scale = 0.60
        for light_index, light in enumerate(created_objects[1:]):
            offsets = (Vector((-0.55, -0.8, 0.6)), Vector((0.65, 0.3, 0.45)), Vector((-0.25, 0.85, 0.3)))
            light.location = detail_target + offsets[light_index]
            light.rotation_euler = (detail_target - light.location).to_track_quat("-Z", "Y").to_euler()
        detail_angles = (
            ("front", Vector((0.0, -1.5, 0.95))),
            ("three_quarter", Vector((1.0, -1.4, 1.12))),
            ("side", Vector((1.5, 0.0, 0.95))),
        )
        phase_indices = range(len(frames))
        for angle_name, offset in detail_angles:
            camera.location = detail_target + offset
            camera.rotation_euler = (detail_target - camera.location).to_track_quat("-Z", "Y").to_euler()
            for phase_index in phase_indices:
                frame = frames[phase_index]
                scene.frame_set(frame)
                seconds = round((frame - bloom_strip.frame_start) / (scene.render.fps / scene.render.fps_base))
                scene.render.filepath = str(screenshot_root / f"geometry_{label}_detail_{angle_name}_{phase_index}_{seconds:02d}.png")
                bpy.ops.render.render(write_still=True)
        if label == "after":
            clay = bpy.data.materials.new("__geometry_clay_review")
            clay.use_nodes = True
            shader = clay.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = (0.72, 0.70, 0.73, 1.0)
            shader.inputs["Roughness"].default_value = 0.86
            shader.inputs["Metallic"].default_value = 0.0
            scene.view_layers[0].material_override = clay
            created_data.append(clay)
            clay_views = (
                ("front", Vector((0.0, -1.5, 0.95))),
                ("three_quarter", Vector((1.0, -1.4, 1.12))),
                ("side", Vector((1.5, 0.0, 0.95))),
            )
            for angle_name, offset in clay_views:
                camera.location = detail_target + offset
                camera.rotation_euler = (detail_target - camera.location).to_track_quat("-Z", "Y").to_euler()
                clay_phases = (0, 1, 2, 4) if angle_name in ("front", "three_quarter") else (4,)
                for phase_index in clay_phases:
                    frame = frames[phase_index]
                    scene.frame_set(frame)
                    seconds = round((frame - bloom_strip.frame_start) / (scene.render.fps / scene.render.fps_base))
                    scene.render.filepath = str(screenshot_root / f"geometry_after_clay_detail_{angle_name}_{phase_index}_{seconds:02d}.png")
                    bpy.ops.render.render(write_still=True)
    finally:
        scene.camera = old_camera
        scene.render.engine = old_engine
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = old_resolution
        scene.render.filepath = old_filepath
        scene.render.image_settings.file_format = old_format
        scene.render.image_settings.color_mode = old_color_mode
        scene.view_settings.view_transform = old_view_transform
        scene.view_settings.exposure = old_exposure
        scene.world = old_world
        scene.view_layers[0].material_override = old_material_override
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


def main():
    args = parse_args()
    package_root, root = resolve_output_root(__file__, args.output_root)
    blend_path = safe_path(root, args.blend)
    glb_path = safe_path(root, args.glb)
    report_path = safe_path(root, args.report)
    screenshot_root = safe_path(root, args.screenshots)
    source_path = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    allowed_suffixes = (
        Path("iteration_02") / "versions" / "lily_004_v2_04m_bloom.blend",
        Path("refinement_03") / "baseline" / "live_v2_04m_unsaved.blend",
    )
    if source_path is None or not any(
            source_path.as_posix().lower().endswith(suffix.as_posix().lower())
            for suffix in allowed_suffixes):
        raise RuntimeError(f"Unexpected source blend: {source_path}")
    reference_path = safe_path(root, "baseline/lily_004_v13_final.blend")
    validate_output_paths(
        root,
        {"blend": blend_path, "glb": glb_path, "report": report_path,
         "screenshots": screenshot_root},
        inputs=(("source blend", source_path), ("v13 reference blend", reference_path)),
        protected_roots=(package_root / "baseline",),
    )
    for path in (blend_path, glb_path, report_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    screenshot_root.mkdir(parents=True, exist_ok=True)
    report = {"status": "RUNNING", "source_blend": bpy.data.filepath}
    try:
        report["source_sha256"] = sha256(source_path)
        scene = bpy.context.scene
        fps = scene.render.fps / scene.render.fps_base
        expected_source_durations = {
            "Growth": 16.0, "IdleClosed": 8.0, "TouchResponse": 2.0,
            "Bloom": 16.0, "IdleOpen": 8.0, "DissolveReady": 1.0,
        }
        before_clips = collect_clip_durations(scene)
        if before_clips != expected_source_durations:
            raise RuntimeError(f"Unexpected source clip durations: {before_clips}")
        before_inventory = inventory_shape_keys()
        before_bend = []
        for name in ("Petals", "Petals_Outside"):
            before_bend.extend(sample_bloom_bend(scene, bpy.data.objects[name]))
        report["baseline"] = {
            "clip_durations_seconds": before_clips,
            "simple_retime": {
                "Growth": {"source_seconds": 16.0, "target_seconds": 9.0,
                           "uniform_time_scale": 9.0 / 16.0,
                           "playback_speed_multiplier": 16.0 / 9.0,
                           "acceleration_multiplier": (16.0 / 9.0) ** 2},
                "Bloom": {"source_seconds": 16.0, "target_seconds": 8.0,
                          "uniform_time_scale": 0.5,
                          "playback_speed_multiplier": 2.0,
                          "acceleration_multiplier": 4.0},
            },
            "bloom_bend_peak_m": max(item["magnitude_m"] for item in before_bend),
            "bloom_bend_samples": before_bend,
        }
        report["shape_keys_before"] = before_inventory
        render_studies(scene, screenshot_root, "before_04m", args.render_mode)
        report["target_coordinates_smoothed"] = smooth_target_deltas()
        open_profile_targets = sculpt_open_tip_profile(scene, reference_path)
        reference_positions = open_profile_targets.pop("_reference_open_positions")
        report["open_profile_targets"] = open_profile_targets
        changed_actions = retime_clips(scene)
        report["growth_bud_profile"] = add_growth_bud_profile(scene)
        report["growth_bud_curves"] = animate_growth_bud_profile(scene)
        after_clips = clip_durations(scene)
        if after_clips != CLIP_SECONDS:
            raise RuntimeError(f"Retimed clip durations do not match the contract: {after_clips}")
        after_bend = []
        for name in ("Petals", "Petals_Outside"):
            after_bend.extend(sample_bloom_bend(scene, bpy.data.objects[name]))
        report["static_tepal_triangulation"] = triangulate_tepal_surfaces()
        report["shape_keys_after"] = inventory_shape_keys()
        report["retimed_actions"] = changed_actions
        report["clip_durations_seconds"] = after_clips
        report["v13_open_pose_comparison"] = compare_evaluated_open_pose_to_v13(
            scene, reference_positions)
        report["bloom_bend_peak_m"] = max(item["magnitude_m"] for item in after_bend)
        report["bloom_bend_samples"] = after_bend
        report["geometry_change"] = {
            "method": "twelve-pass longitudinal low-pass on existing SeamClear targets; mapped v13's full evaluated open endpoint into TipCurl while retaining 04m Basis/closed/seam keys; added an 8 mm mean mid-row arc and mean-zero 2 mm cross-section camber/shoulder relief; added an 8% coherent radial GrowthBudForm target with root/tip rows pinned; converted only the two tepal meshes to their verified FIXED Basis/GLB triangle connectivity without changing vertices or morph data",
            "passes": SMOOTHING_PASSES,
            "blend_strength": SMOOTHING_STRENGTH,
            "morph_inventory_changed": report["shape_keys_before"] != report["shape_keys_after"],
            "before": report["shape_keys_before"],
            "after": report["shape_keys_after"],
        }
        render_studies(scene, screenshot_root, "after", args.render_mode)
        scene.frame_set(1281)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
        result = bpy.ops.export_scene.gltf(
            filepath=str(glb_path),
            export_format="GLB",
            export_animation_mode="NLA_TRACKS",
            export_anim_slide_to_zero=True,
            export_optimize_animation_keep_anim_object=True,
            export_current_frame=True,
        )
        if result != {"FINISHED"}:
            raise RuntimeError(f"GLB export did not finish: {result}")
        report["outputs"] = {
            "blend": str(blend_path),
            "glb": str(glb_path),
            "glb_bytes": glb_path.stat().st_size,
            "glb_sha256": sha256(glb_path),
            "screenshot_directory": str(screenshot_root),
        }
        report["status"] = "CREATED"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"GEOMETRY_REFINEMENT CREATED clips={after_clips} bend_peak={report['bloom_bend_peak_m']:.6f}m glb_bytes={glb_path.stat().st_size}")
    except Exception as error:
        report["status"] = "FAIL"
        report["error"] = repr(error)
        report["traceback"] = traceback.format_exc()
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        raise


if __name__ == "__main__":
    main()
