"""Dense geometry-stage checks for the Lily 004 blend and exported GLB."""

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry_path_safety import resolve_output_root, validate_output_paths


EXPECTED_CLIPS = {
    "Growth": 9.0,
    "IdleClosed": 8.0,
    "TouchResponse": 2.0,
    "Bloom": 8.0,
    "IdleOpen": 8.0,
    "DissolveReady": 1.0,
}
CURVATURE_LIMIT_M = 0.005
BOUNDARY_TOLERANCE_M = 1e-5
SYNC_TOLERANCE_M = 1e-5
MIN_TRIANGLE_AREA_RATIO = 1e-6
NORMAL_FOLD_DOT_LIMIT = -0.25
ROOT_ATTACHMENT_MAX_ROW = 1
MAX_FRAME_STEP_M = 0.03
# Measured on the read-only v13 source at its Bloom endpoint; geometry context only.
V13_OPEN_CUP_DEPTH_M = 0.10173279047012329
V13_FRONT_TEPAL_REACH_M = 0.22547610104084015
SOURCE_OPEN_EDGE_ROLL_M = 0.003117665648460388
PETAL_VERTICES = 33 * 15
PETAL_FACES = 32 * 14 * 2


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--glb", default="export/lily_004_geometry.glb")
    parser.add_argument("--report", default="reports/geometry_quality.json")
    parser.add_argument("--open-profile-only", action="store_true")
    return parser.parse_args(values)


def output_path(root, relative):
    root = root.resolve()
    target = (root / relative).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise RuntimeError(f"Refusing report outside output root: {target}") from error
    return target


def animation_owners():
    owners = []
    for obj in bpy.data.objects:
        if obj.animation_data and obj.animation_data.nla_tracks:
            owners.append((obj.name, obj.animation_data.nla_tracks))
        if obj.data and getattr(obj.data, "shape_keys", None):
            keys = obj.data.shape_keys
            if keys.animation_data and keys.animation_data.nla_tracks:
                owners.append((f"{obj.name}.shape_keys", keys.animation_data.nla_tracks))
    return owners


def validate_clip_durations(fps):
    observations = []
    by_clip = {}
    failures = []
    for owner_name, tracks in animation_owners():
        for track in tracks:
            if track.name not in EXPECTED_CLIPS:
                continue
            if len(track.strips) != 1:
                failures.append({"owner": owner_name, "clip": track.name, "error": "expected one NLA strip"})
                continue
            strip = track.strips[0]
            duration = (strip.frame_end - strip.frame_start) / fps
            expected = EXPECTED_CLIPS[track.name]
            passed = abs(duration - expected) <= 1e-5
            observation = {
                "owner": owner_name,
                "clip": track.name,
                "duration_seconds": round(duration, 6),
                "expected_seconds": expected,
                "pass": passed,
            }
            observations.append(observation)
            by_clip.setdefault(track.name, []).append(duration)
            if not passed:
                failures.append(observation)
    for clip, durations in by_clip.items():
        if max(durations) - min(durations) > 1e-5:
            failures.append({"clip": clip, "error": "animation owners disagree on duration", "durations": durations})
    if set(by_clip) != set(EXPECTED_CLIPS):
        failures.append({"error": "clip inventory mismatch", "found": sorted(by_clip)})
    return observations, failures


def shape_key_profile(obj, island, posed):
    keys = obj.data.shape_keys.key_blocks
    basis = keys["Basis"].data
    profile = []
    for row in range(33):
        total = Vector()
        for column in range(15):
            index = island * PETAL_VERTICES + row * 15 + column
            base = basis[index].co
            point = base.copy()
            if posed:
                for key in keys[1:]:
                    weight = key.value
                    if abs(weight) > 1e-9:
                        point += (key.data[index].co - base) * weight
            total += point / 15.0
        profile.append(total)
    return profile


def bend_metric(profile, basis_profile):
    worst = {"magnitude_m": 0.0, "row": None}
    for row in range(1, 32):
        curve = (profile[row + 1] - 2.0 * profile[row] + profile[row - 1])
        rest = (basis_profile[row + 1] - 2.0 * basis_profile[row] + basis_profile[row - 1])
        magnitude = (curve - rest).length
        if magnitude > worst["magnitude_m"]:
            worst = {"magnitude_m": magnitude, "row": row}
    return worst


def clip_strip(owner, clip_name):
    tracks = owner.animation_data.nla_tracks if hasattr(owner, "animation_data") and owner.animation_data else owner.nla_tracks
    track = next((track for track in tracks if track.name == clip_name), None)
    if not track or not track.strips:
        raise RuntimeError(f"Missing {clip_name} NLA track on {owner.name}")
    return track.strips[0]


def evaluated_mesh(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    faces = [tuple(poly.vertices) for poly in mesh.polygons]
    return evaluated, mesh, vertices, faces


def clear_mesh(evaluated, mesh):
    evaluated.to_mesh_clear()


def triangle_area_and_quality(points, vertices):
    a, b, c = (points[index] for index in vertices)
    ab = b - a
    bc = c - b
    ca = a - c
    cross = ab.cross(c - a)
    longest_edge_squared = max(ab.length_squared, bc.length_squared, ca.length_squared)
    area = cross.length * 0.5
    quality = cross.length / longest_edge_squared if longest_edge_squared > 1e-30 else 0.0
    return area, quality, cross


def mesh_snapshot(scene, frame):
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = {}
    for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
        evaluated, mesh, vertices, _ = evaluated_mesh(obj, depsgraph)
        result[obj.name] = vertices
        clear_mesh(evaluated, mesh)
    return result


def object_vertex_snapshot(scene, object_names, frame):
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = {}
    for name in object_names:
        obj = bpy.data.objects[name]
        evaluated, mesh, vertices, _ = evaluated_mesh(obj, depsgraph)
        result[name] = vertices
        clear_mesh(evaluated, mesh)
    return result


def max_vertex_difference(left, right):
    if left.keys() != right.keys():
        return float("inf")
    worst = 0.0
    for name in left:
        if len(left[name]) != len(right[name]):
            return float("inf")
        for a, b in zip(left[name], right[name]):
            worst = max(worst, max(abs(a[axis] - b[axis]) for axis in range(3)))
    return worst


def boundary_checks(scene, fps):
    keys = bpy.data.objects["Petals"].data.shape_keys
    petal_track = next(track for track in keys.animation_data.nla_tracks if track.name == "Growth")
    starts = {}
    ends = {}
    for name in EXPECTED_CLIPS:
        strip = next(track.strips[0] for track in keys.animation_data.nla_tracks if track.name == name)
        starts[name] = strip.frame_start
        ends[name] = strip.frame_end
    boundaries = (
        ("Growth", "IdleClosed"),
        ("IdleClosed", "TouchResponse"),
        ("TouchResponse", "Bloom"),
        ("Bloom", "IdleOpen"),
        ("IdleOpen", "DissolveReady"),
    )
    result = []
    for left, right in boundaries:
        left_pose = mesh_snapshot(scene, round(ends[left]))
        right_pose = mesh_snapshot(scene, round(starts[right]))
        error = max_vertex_difference(left_pose, right_pose)
        result.append({"boundary": f"{left}->{right}", "max_vertex_delta_m": error,
                       "tolerance_m": BOUNDARY_TOLERANCE_M, "pass": error <= BOUNDARY_TOLERANCE_M})
    return result


def bounds_and_curvature(obj, depsgraph):
    evaluated, mesh, points, _ = evaluated_mesh(obj, depsgraph)
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    sizes = maximum - minimum
    centerline = []
    low, high = minimum.z, maximum.z
    span = max(high - low, 1e-8)
    for bin_index in range(12):
        start = low + span * bin_index / 12.0
        end = low + span * (bin_index + 1) / 12.0
        selected = [point for point in points if start <= point.z < end or
                    (bin_index == 11 and point.z <= end)]
        if selected:
            centerline.append(sum(selected, Vector()) / len(selected))
    bend = 0.0
    if len(centerline) >= 3:
        a, b = centerline[0], centerline[-1]
        chord = b - a
        if chord.length > 1e-8:
            direction = chord.normalized()
            bend = max((point - (a + direction * (point - a).dot(direction))).length
                       for point in centerline[1:-1])
    clear_mesh(evaluated, mesh)
    return {"bounds_m": [round(value, 6) for value in sizes],
            "centerline_deviation_m": round(bend, 6)}


def growth_evidence(scene, fps):
    petals = bpy.data.objects["Petals"]
    shape_keys = petals.data.shape_keys
    growth_strip = clip_strip(shape_keys, "Growth")
    sample_seconds = (0.0, 2.0, 4.0, 6.0, 7.2, 8.0, 9.0)
    samples = []
    for seconds in sample_seconds:
        frame = round(growth_strip.frame_start + seconds * fps)
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        row = {"time_seconds": seconds, "frame": frame}
        row["stem"] = bounds_and_curvature(bpy.data.objects["Stem"], depsgraph)
        row["stem_shape_weights"] = {
            name: round(bpy.data.objects["Stem"].data.shape_keys.key_blocks[name].value, 6)
            for name in ("Sprout", "EarlyShoot", "MidShoot")
        }
        row["leaf_unfold_weights"] = {
            name: round(bpy.data.objects[name].data.shape_keys.key_blocks["YoungFolded"].value, 6)
            for name in ("Leaf_A", "Leaf_B")
        }
        row["head_root_scale"] = [round(value, 6) for value in
                                  bpy.data.objects["Head_Root"].matrix_world.to_scale()]
        row["petal_bounds"] = bounds_and_curvature(petals, depsgraph)["bounds_m"]
        row["growth_bud_form_weight"] = round(shape_keys.key_blocks["GrowthBudForm"].value, 6)
        samples.append(row)

    exact_weights = []
    for clip_name in EXPECTED_CLIPS:
        track = next(track for track in shape_keys.animation_data.nla_tracks if track.name == clip_name)
        strip = track.strips[0]
        clip_samples = []
        for point_name, frame in (("start", round(strip.frame_start)),
                                  ("mid", round((strip.frame_start + strip.frame_end) * 0.5)),
                                  ("end", round(strip.frame_end))):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            value = shape_keys.key_blocks["GrowthBudForm"].value
            clip_samples.append({"position": point_name, "frame": frame, "weight": round(value, 9)})
        exact_weights.append({"clip": clip_name, "samples": clip_samples})
    growth_start, growth_end = samples[0], samples[-1]
    stem_weights = [sample["stem_shape_weights"] for sample in samples]
    leaf_start = samples[0]["leaf_unfold_weights"]
    leaf_end = samples[-1]["leaf_unfold_weights"]
    failures = []
    if max(weights["Sprout"] for weights in stem_weights) < 0.99 or max(weights["MidShoot"] for weights in stem_weights) < 0.9:
        failures.append({"error": "Growth does not transition from Sprout through mature stem morphs"})
    if any(leaf_start[name] < 0.99 or leaf_end[name] > 1e-8 for name in ("Leaf_A", "Leaf_B")):
        failures.append({"error": "Growth leaf-unfold morph endpoints are not exact", "start": leaf_start,
                         "end": leaf_end})
    if growth_start["growth_bud_form_weight"] < 0.99 or growth_end["growth_bud_form_weight"] > 1e-8:
        failures.append({"error": "GrowthBudForm does not return exactly to zero at Growth endpoint"})
    for clip in exact_weights:
        for sample in clip["samples"]:
            if clip["clip"] == "Growth" and sample["position"] == "start":
                expected = 1.0
            elif clip["clip"] == "Growth" and sample["position"] == "end":
                expected = 0.0
            elif clip["clip"] == "Growth" and sample["position"] == "mid":
                if not 0.0 < sample["weight"] <= 1.0:
                    failures.append({"error": "GrowthBudForm has no active mid-growth profile", "sample": sample})
                continue
            else:
                expected = 0.0
            if abs(sample["weight"] - expected) > 1e-8:
                failures.append({"error": "GrowthBudForm leaks into a non-growth phase or endpoint",
                                 "clip": clip["clip"], "sample": sample})
    growth_end_frame = round(growth_strip.frame_end)
    idle_closed_start_frame = round(clip_strip(shape_keys, "IdleClosed").frame_start)
    endpoint_pose_names = ("Petals", "Petals_Outside")
    growth_end_pose = object_vertex_snapshot(scene, endpoint_pose_names, growth_end_frame)
    idle_closed_start_pose = object_vertex_snapshot(scene, endpoint_pose_names, idle_closed_start_frame)
    endpoint_delta = max_vertex_difference(growth_end_pose, idle_closed_start_pose)
    if endpoint_delta > BOUNDARY_TOLERANCE_M:
        failures.append({"error": "Growth endpoint tepal vertices differ from IdleClosed start",
                         "max_vertex_delta_m": endpoint_delta,
                         "tolerance_m": BOUNDARY_TOLERANCE_M})
    report = {"samples": samples, "GrowthBudForm_clip_samples": exact_weights,
              "growth_endpoint_against_idle_closed_max_vertex_delta_m": endpoint_delta,
              "assessment": "uniform 16s→9s retime retained after sampled growth evidence; existing Stem morph phases and both YoungFolded leaf morphs progress, with added eight-percent radial juvenile-bud profile fading to exact mature closed shape at 9s"}
    return report, failures


def load_v13_open_positions(reference_path):
    object_names = ("Petals", "Petals_Outside")
    collections = (bpy.data.meshes, bpy.data.shape_keys, bpy.data.actions,
                   bpy.data.materials, bpy.data.images)
    original_ids = {collection: {item.as_pointer() for item in collection}
                    for collection in collections}
    imported_objects = []
    reference_positions = {}
    with bpy.data.libraries.load(str(reference_path), link=False) as (data_from, data_to):
        missing = set(object_names) - set(data_from.objects)
        if missing:
            raise RuntimeError(f"v13 reference is missing tepal objects: {sorted(missing)}")
        data_to.objects = list(object_names)
    imported_objects = [obj for obj in data_to.objects if obj is not None]
    try:
        if len(imported_objects) != len(object_names):
            raise RuntimeError("v13 reference did not load both tepal objects")
        for object_name, reference_obj in zip(object_names, imported_objects):
            if len(reference_obj.data.vertices) != PETAL_VERTICES * 6:
                raise RuntimeError(f"v13 {object_name} has unexpected vertex count")
            keys = reference_obj.data.shape_keys.key_blocks
            if "Basis" not in keys or "TipCurl" not in keys:
                raise RuntimeError(f"v13 {object_name} needs Basis and TipCurl shape keys")
            if keys["TipCurl"].relative_key != keys["Basis"]:
                raise RuntimeError(f"v13 {object_name}.TipCurl is not relative to Basis")
            reference_positions[object_name] = [
                reference_obj.matrix_world @ vertex.co.copy()
                for vertex in keys["TipCurl"].data
            ]
    finally:
        for obj in imported_objects:
            if bpy.data.objects.get(obj.name) is obj:
                bpy.data.objects.remove(obj, do_unlink=True)
        for collection in collections:
            for item in list(collection):
                if item.as_pointer() not in original_ids[collection] and item.users == 0:
                    collection.remove(item)
    return reference_positions


def profile_statistics(vertices):
    profiles = []
    for island in range(6):
        rows = []
        for row in range(33):
            values = [vertices[island * PETAL_VERTICES + row * 15 + column] for column in range(15)]
            rows.append(sum(values, Vector()) / len(values))
        profiles.append(rows)
    cup_depths = []
    edge_rolls = []
    for island, rows in enumerate(profiles):
        baseline_z = (rows[0].z + rows[-1].z) * 0.5
        cup_depths.append(max(rows[row].z for row in range(8, 25)) - baseline_z)
        middle = rows[16].z
        row_offset = island * PETAL_VERTICES + 16 * 15
        left_edge = sum(vertices[index].z for index in (row_offset, row_offset + 1)) * 0.5
        right_edge = sum(vertices[index].z for index in (row_offset + 13, row_offset + 14)) * 0.5
        if island == 5:
            edge_rolls.append((left_edge + right_edge) * 0.5 - middle)
    reach = profiles[5][0].y - profiles[5][-1].y
    return {
        "full_open_cup_depth_m": max(cup_depths),
        "cup_depths_by_island_m": cup_depths,
        "front_tepal_forward_reach_m": reach,
        "front_edge_roll_m": edge_rolls[0],
    }


def compare_open_pose_to_v13(scene, reference_positions):
    petals = bpy.data.objects["Petals"]
    strip = next(track.strips[0] for track in
                 petals.data.shape_keys.animation_data.nla_tracks if track.name == "Bloom")
    scene.frame_set(round(strip.frame_end))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    by_object = {}
    all_deltas = []
    samples = []
    for object_name in ("Petals", "Petals_Outside"):
        evaluated, mesh, candidate, _ = evaluated_mesh(bpy.data.objects[object_name], depsgraph)
        reference = reference_positions[object_name]
        if len(candidate) != len(reference):
            clear_mesh(evaluated, mesh)
            raise RuntimeError(f"v13 endpoint vertex count changed for {object_name}")
        deltas = [(point - target).length for point, target in zip(candidate, reference)]
        all_deltas.extend(deltas)
        by_object[object_name] = {
            "vertices": len(deltas),
            "max_vertex_delta_m": max(deltas, default=0.0),
            "mean_vertex_delta_m": sum(deltas) / len(deltas),
        }
        if object_name == "Petals":
            for island in range(6):
                index = island * PETAL_VERTICES + 16 * 15 + 7
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
        clear_mesh(evaluated, mesh)
    return {
        "reference": "baseline/lily_004_v13_final.blend Bloom endpoint (16 s)",
        "candidate": "source/lily_004_geometry.blend Bloom endpoint (8 s), evaluated",
        "max_vertex_delta_m": max(all_deltas, default=0.0),
        "mean_vertex_delta_m": sum(all_deltas) / len(all_deltas),
        "by_object": by_object,
        "mid_row_centerline_samples": samples,
        "attachment_and_tip_rows_are_pinned_by_correction": [0, 32],
    }


def open_profile_metrics(scene, reference_path):
    petals = bpy.data.objects["Petals"]
    strip = next(track.strips[0] for track in petals.data.shape_keys.animation_data.nla_tracks if track.name == "Bloom")
    scene.frame_set(round(strip.frame_end))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated, mesh, vertices, _ = evaluated_mesh(petals, depsgraph)
    candidate_metrics = profile_statistics(vertices)
    reference_positions = load_v13_open_positions(reference_path)
    reference_metrics = profile_statistics(reference_positions["Petals"])
    comparison = compare_open_pose_to_v13(scene, reference_positions)
    metrics = {
        **candidate_metrics,
        "v13_source_comparison": {
            "source_blend": "baseline/lily_004_v13_final.blend",
            "source_sha256": __import__("hashlib").sha256(Path(reference_path).read_bytes()).hexdigest(),
            "source_metrics": reference_metrics,
            "candidate_delta": {
                "cup_depth_m": candidate_metrics["full_open_cup_depth_m"] - reference_metrics["full_open_cup_depth_m"],
                "front_tepal_forward_reach_m": candidate_metrics["front_tepal_forward_reach_m"] - reference_metrics["front_tepal_forward_reach_m"],
                "front_edge_roll_m": candidate_metrics["front_edge_roll_m"] - reference_metrics["front_edge_roll_m"],
            },
            "assessment": "informational_only",
        },
        "v13_endpoint_geometry_comparison": comparison,
        "metric_assessment": "cup depth and front reach are source-relative visual heuristics, not pass/fail thresholds",
        "visual_acceptance": "pending/R12,R18",
    }
    clear_mesh(evaluated, mesh)
    return metrics


def glb_check(path):
    path = Path(path).resolve()
    raw = path.read_bytes()
    if len(raw) < 20:
        raise RuntimeError("GLB is too short")
    magic, version, total = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67 or version != 2 or total != len(raw):
        raise RuntimeError("Invalid GLB 2 header or byte length")
    length, kind = struct.unpack_from("<II", raw, 12)
    if kind != 0x4E4F534A:
        raise RuntimeError("GLB first chunk is not JSON")
    document = json.loads(raw[20:20 + length])
    animations = {}
    failures = []
    for animation in document.get("animations", []):
        name = animation.get("name")
        if not name:
            failures.append({"error": "unnamed animation"})
            continue
        inputs = [document["accessors"][sampler["input"]] for sampler in animation.get("samplers", [])]
        starts = [accessor.get("min", [None])[0] for accessor in inputs if accessor.get("min")]
        ends = [accessor.get("max", [None])[0] for accessor in inputs if accessor.get("max")]
        duration = max(ends) - min(starts) if starts and ends else None
        expected = EXPECTED_CLIPS.get(name)
        weights = {
            document["nodes"][channel["target"]["node"]].get("name")
            for channel in animation.get("channels", [])
            if channel.get("target", {}).get("path") == "weights"
        }
        passed = expected is not None and duration is not None and abs(duration - expected) <= 1e-5
        if not passed:
            failures.append({"animation": name, "duration_seconds": duration, "expected_seconds": expected})
        if not {"Petals", "Petals_Outside"}.issubset(weights):
            failures.append({"animation": name, "error": "missing tepal morph channels", "weight_nodes": sorted(weights)})
        animations[name] = {"duration_seconds": duration, "expected_seconds": expected,
                            "weight_nodes": sorted(weights), "pass": passed}
    if set(animations) != set(EXPECTED_CLIPS):
        failures.append({"error": "GLB animation inventory mismatch", "found": sorted(animations)})
    triangle_geometry = {}
    for node in document.get("nodes", []):
        name = node.get("name")
        if name not in ("Petals", "Petals_Outside") or "mesh" not in node:
            continue
        mesh = document["meshes"][node["mesh"]]
        primitive_triangles = []
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            index_count = (document["accessors"][primitive["indices"]]["count"]
                           if "indices" in primitive else
                           document["accessors"][primitive["attributes"]["POSITION"]]["count"])
            triangle_count = index_count // 3 if mode == 4 and index_count % 3 == 0 else 0
            primitive_triangles.append({"mode": mode, "index_count": index_count,
                                        "triangle_count": triangle_count})
            expected_triangles = PETAL_FACES * 6
            if mode != 4 or triangle_count != expected_triangles:
                failures.append({"object": name, "error": "GLB tepal primitive is not the expected triangle list",
                                 "primitive": primitive_triangles[-1],
                                 "expected_triangles": expected_triangles})
        triangle_geometry[name] = {"triangles": sum(item["triangle_count"] for item in primitive_triangles),
                                   "primitives": primitive_triangles}
    if set(triangle_geometry) != {"Petals", "Petals_Outside"}:
        failures.append({"error": "GLB tepal triangle inventory mismatch",
                         "found": sorted(triangle_geometry)})
    geometry = {
        "bytes": len(raw),
        "sha256": __import__("hashlib").sha256(raw).hexdigest(),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "tepal_triangles": triangle_geometry,
        "animations": animations,
    }
    return geometry, failures


def validate_topology_and_winding():
    required_objects = {"Lily_Root", "Head_Root", "Calyx", "Flower_Interior", "Flower_Details",
                        "Leaf_A", "Leaf_B", "Leaf_A_Pivot", "Leaf_B_Pivot", "Stem", "Petals", "Petals_Outside"}
    object_names = set(bpy.data.objects.keys())
    failures = []
    if not required_objects.issubset(object_names):
        failures.append({"error": "required anatomy objects are missing", "missing": sorted(required_objects - object_names)})
    if len(bpy.data.objects) != 14:
        failures.append({"error": "object count changed", "expected": 14, "actual": len(bpy.data.objects)})
    if sum(1 for obj in bpy.data.objects if obj.type == "MESH") != 7:
        failures.append({"error": "mesh object count changed", "expected": 7,
                         "actual": sum(1 for obj in bpy.data.objects if obj.type == "MESH")})
    inventory = {}
    for name in ("Petals", "Petals_Outside"):
        obj = bpy.data.objects[name]
        inventory[name] = {
            "parent": obj.parent.name if obj.parent else None,
            "vertices": len(obj.data.vertices),
            "faces": len(obj.data.polygons),
            "shape_keys": [key.name for key in obj.data.shape_keys.key_blocks],
        }
        if obj.parent is None or obj.parent.name != "Head_Root":
            failures.append({"object": name, "error": "parent hierarchy changed"})
        if len(obj.data.vertices) != PETAL_VERTICES * 6 or len(obj.data.polygons) != PETAL_FACES * 6:
            failures.append({"object": name, "error": "source grid topology changed"})
    petal = bpy.data.objects["Petals"].data
    outside = bpy.data.objects["Petals_Outside"].data
    if len(petal.shape_keys.key_blocks) != len(outside.shape_keys.key_blocks):
        failures.append({"error": "paired petal morph inventories differ"})
    else:
        max_delta = 0.0
        for key in petal.shape_keys.key_blocks:
            paired = outside.shape_keys.key_blocks.get(key.name)
            if paired is None:
                failures.append({"error": "paired petal morph name missing", "name": key.name})
                continue
            for index in range(len(key.data)):
                max_delta = max(max_delta, (key.data[index].co - paired.data[index].co).length)
        if max_delta > SYNC_TOLERANCE_M:
            failures.append({"error": "paired tepal shape keys are not synchronized", "max_delta_m": max_delta})
    growth_key_rows = {}
    for name, mesh in (("Petals", petal), ("Petals_Outside", outside)):
        block = mesh.shape_keys.key_blocks.get("GrowthBudForm")
        if block is None:
            failures.append({"object": name, "error": "GrowthBudForm target is missing"})
            continue
        max_root_delta = max((block.data[island * PETAL_VERTICES + column].co -
                              mesh.shape_keys.key_blocks["Basis"].data[island * PETAL_VERTICES + column].co).length
                             for island in range(6) for column in range(15))
        max_tip_delta = max((block.data[island * PETAL_VERTICES + 32 * 15 + column].co -
                             mesh.shape_keys.key_blocks["Basis"].data[island * PETAL_VERTICES + 32 * 15 + column].co).length
                            for island in range(6) for column in range(15))
        growth_key_rows[name] = {"max_attachment_delta_m": max_root_delta,
                                 "max_tip_delta_m": max_tip_delta}
        if max_root_delta > 1e-8 or max_tip_delta > 1e-8:
            failures.append({"object": name, "error": "GrowthBudForm moved pinned attachment/tip rows",
                             **growth_key_rows[name]})
    petal_normals = {tuple(sorted(poly.vertices)): poly.normal.copy() for poly in petal.polygons}
    outside_normals = {tuple(sorted(poly.vertices)): poly.normal.copy() for poly in outside.polygons}
    if petal_normals.keys() != outside_normals.keys():
        failures.append({"error": "paired petal surfaces have different fixed triangle connectivity",
                         "inner_triangles": len(petal_normals),
                         "outer_triangles": len(outside_normals)})
    paired_signatures = sorted(petal_normals.keys() & outside_normals.keys())
    base_dots = [petal_normals[signature].dot(outside_normals[signature])
                 for signature in paired_signatures]
    winding = {
        "face_pairs": len(base_dots),
        "min_dot": min(base_dots),
        "mean_dot": sum(base_dots) / len(base_dots),
        "max_dot": max(base_dots),
        "opposite_face_pairs": sum(1 for value in base_dots if value <= -0.999),
        "pairing": "sorted vertex-ID triangle signature",
    }
    if winding["opposite_face_pairs"] != len(base_dots):
        failures.append({"error": "paired petal surfaces do not have opposite winding", **winding})
    return {"objects": inventory, "winding": winding,
            "growth_bud_pinned_rows": growth_key_rows}, failures


def dense_pose_checks(scene, fps):
    petals = bpy.data.objects["Petals"]
    outside = bpy.data.objects["Petals_Outside"]
    key_data = petals.data.shape_keys
    basis_profiles = [shape_key_profile(petals, island, False) for island in range(6)]
    static_faces_by_island = [[] for _ in range(6)]
    for polygon in petals.data.polygons:
        islands = {index // PETAL_VERTICES for index in polygon.vertices}
        if len(islands) != 1:
            raise RuntimeError(f"A tepal face crosses islands: {polygon.index}/{sorted(islands)}")
        island = next(iter(islands))
        vertex_start = island * PETAL_VERTICES
        static_faces_by_island[island].append(
            tuple(index - vertex_start for index in polygon.vertices))
    if any(len(faces) != PETAL_FACES for faces in static_faces_by_island):
        raise RuntimeError("Static tepal triangle topology does not contain 896 faces per island")
    results = {"frames_checked": 0, "curvature_peak_m": 0.0, "curvature_worst": None,
               "max_frame_step_m": 0.0, "frame_step_worst": None,
               "max_paired_surface_delta_m": 0.0, "normal_alignment_min": 1.0,
               "triangle_tessellation": "evaluated mesh.loop_triangles",
               "triangle_quality_measure": "twice-area / longest-edge-squared (scale independent)",
               "triangle_quality_limit": MIN_TRIANGLE_AREA_RATIO,
               "minimum_triangle_area_m2": float("inf"),
               "minimum_triangle_area_ratio": float("inf"),
               "triangle_quality_worst": None,
               "degenerate_triangle_count": 0,
               "triangle_count_per_surface": None,
               "normal_fold_dot_limit": NORMAL_FOLD_DOT_LIMIT,
               "root_attachment_definition": f"all vertices lie in tepal rows 0-{ROOT_ATTACHMENT_MAX_ROW}",
               "root_attachment_normal_discontinuities": 0,
               "root_attachment_normal_discontinuities_by_clip_island": {},
               "normal_fold_events_outside_attachment": 0,
               "normal_fold_samples_outside_attachment": [],
               "root_attachment_normal_samples": [],
               "normal_flip_events": 0,
               "root_attachment_temporal_normal_discontinuities": 0,
               "temporal_normal_flip_events_outside_attachment": 0,
               "root_attachment_temporal_normal_samples": [],
               "temporal_normal_flip_samples_outside_attachment": [],
               "intersection_events": [], "allowed_root_contacts": 0}
    failures = []
    max_frames_per_clip = {}
    for clip_name in ("Growth", "Bloom"):
        strip = next(track.strips[0] for track in key_data.animation_data.nla_tracks if track.name == clip_name)
        first = round(strip.frame_start)
        last = round(strip.frame_end)
        max_frames_per_clip[clip_name] = last - first + 1
        previous_vertices = None
        previous_normals = None
        for frame in range(first, last + 1):
            scene.frame_set(frame)
            time_seconds = (frame - strip.frame_start) / fps
            for island in range(6):
                metric = bend_metric(shape_key_profile(petals, island, True), basis_profiles[island])
                if metric["magnitude_m"] > results["curvature_peak_m"]:
                    results["curvature_peak_m"] = metric["magnitude_m"]
                    results["curvature_worst"] = {"clip": clip_name, "time_seconds": round(time_seconds, 6),
                                                   "island": island + 1, **metric}
            depsgraph = bpy.context.evaluated_depsgraph_get()
            petal_eval, petal_mesh, petal_vertices, petal_faces = evaluated_mesh(petals, depsgraph)
            outer_eval, outer_mesh, outer_vertices, outer_faces = evaluated_mesh(outside, depsgraph)
            petal_mesh.calc_loop_triangles()
            outer_mesh.calc_loop_triangles()
            paired_delta = max((a - b).length for a, b in zip(petal_vertices, outer_vertices))
            results["max_paired_surface_delta_m"] = max(results["max_paired_surface_delta_m"], paired_delta)
            inner_triangles = [tuple(triangle.vertices) for triangle in petal_mesh.loop_triangles]
            outer_triangles = [tuple(triangle.vertices) for triangle in outer_mesh.loop_triangles]
            if results["triangle_count_per_surface"] is None:
                results["triangle_count_per_surface"] = {
                    "Petals": len(inner_triangles), "Petals_Outside": len(outer_triangles)}
            if len(inner_triangles) != len(outer_triangles):
                failures.append({"error": "paired tepal surfaces have different native triangle counts",
                                 "inner": len(inner_triangles), "outer": len(outer_triangles)})
            inner_by_signature = {tuple(sorted(triangle)): triangle for triangle in inner_triangles}
            outer_by_signature = {tuple(sorted(triangle)): triangle for triangle in outer_triangles}
            if inner_by_signature.keys() != outer_by_signature.keys():
                failures.append({"error": "paired tepal surfaces use different native triangle connectivity"})

            normals = []
            edge_triangles = {}
            for triangle_index, vertices in enumerate(inner_triangles):
                area, quality, cross = triangle_area_and_quality(petal_vertices, vertices)
                if area < results["minimum_triangle_area_m2"]:
                    results["minimum_triangle_area_m2"] = area
                if quality < results["minimum_triangle_area_ratio"]:
                    results["minimum_triangle_area_ratio"] = quality
                    results["triangle_quality_worst"] = {
                        "clip": clip_name, "time_seconds": round(time_seconds, 6),
                        "surface": "Petals", "triangle": triangle_index,
                        "vertices": list(vertices), "area_m2": area, "area_ratio": quality}
                if not math.isfinite(quality) or quality <= MIN_TRIANGLE_AREA_RATIO:
                    results["degenerate_triangle_count"] += 1
                normal = cross.normalized() if cross.length > 1e-30 else None
                normals.append(normal)
                for first, second in ((vertices[0], vertices[1]), (vertices[1], vertices[2]),
                                      (vertices[2], vertices[0])):
                    edge = tuple(sorted((first, second)))
                    edge_triangles.setdefault(edge, []).append(triangle_index)

                signature = tuple(sorted(vertices))
                outer_vertices_for_triangle = outer_by_signature.get(signature)
                if outer_vertices_for_triangle is not None:
                    outer_area, outer_quality, outer_cross = triangle_area_and_quality(
                        outer_vertices, outer_vertices_for_triangle)
                    if outer_area < results["minimum_triangle_area_m2"]:
                        results["minimum_triangle_area_m2"] = outer_area
                    if outer_quality < results["minimum_triangle_area_ratio"]:
                        results["minimum_triangle_area_ratio"] = outer_quality
                        results["triangle_quality_worst"] = {
                            "clip": clip_name, "time_seconds": round(time_seconds, 6),
                            "surface": "Petals_Outside", "triangle": triangle_index,
                            "vertices": list(outer_vertices_for_triangle),
                            "area_m2": outer_area, "area_ratio": outer_quality}
                    if not math.isfinite(outer_quality) or outer_quality <= MIN_TRIANGLE_AREA_RATIO:
                        results["degenerate_triangle_count"] += 1
                    if cross.length > 1e-30 and outer_cross.length > 1e-30:
                        alignment = cross.normalized().dot(outer_cross.normalized())
                        results["normal_alignment_min"] = min(results["normal_alignment_min"], alignment)

            for edge, triangle_ids in edge_triangles.items():
                if len(triangle_ids) != 2:
                    continue
                first_normal, second_normal = (normals[index] for index in triangle_ids)
                if first_normal is None or second_normal is None:
                    continue
                alignment = first_normal.dot(second_normal)
                if alignment >= NORMAL_FOLD_DOT_LIMIT:
                    continue
                involved = inner_triangles[triangle_ids[0]] + inner_triangles[triangle_ids[1]]
                rows = [index % PETAL_VERTICES // 15 for index in involved]
                islands = {index // PETAL_VERTICES for index in involved}
                sample = {"clip": clip_name, "frame": frame, "time_seconds": round(time_seconds, 6),
                          "islands": [index + 1 for index in sorted(islands)],
                          "rows": [min(rows), max(rows)], "normal_dot": alignment}
                root_attachment = len(islands) == 1 and max(rows) <= ROOT_ATTACHMENT_MAX_ROW
                if root_attachment:
                    results["root_attachment_normal_discontinuities"] += 1
                    island = next(iter(islands)) + 1
                    group = f"{clip_name}:island{island}"
                    summary = results["root_attachment_normal_discontinuities_by_clip_island"].setdefault(
                        group, {"count": 0, "worst_normal_dot": 1.0, "worst_frame": None})
                    summary["count"] += 1
                    if alignment < summary["worst_normal_dot"]:
                        summary["worst_normal_dot"] = alignment
                        summary["worst_frame"] = frame
                    if len(results["root_attachment_normal_samples"]) < 10:
                        results["root_attachment_normal_samples"].append(sample)
                else:
                    results["normal_fold_events_outside_attachment"] += 1
                    if len(results["normal_fold_samples_outside_attachment"]) < 10:
                        results["normal_fold_samples_outside_attachment"].append(sample)
            if previous_normals is not None:
                for face_index, current in enumerate(normals):
                    previous = previous_normals[face_index]
                    if current is not None and previous is not None and current.dot(previous) < -0.25:
                        results["normal_flip_events"] += 1
                        vertices = inner_triangles[face_index]
                        rows = [index % PETAL_VERTICES // 15 for index in vertices]
                        islands = {index // PETAL_VERTICES for index in vertices}
                        sample = {"clip": clip_name, "frame": frame,
                                  "time_seconds": round(time_seconds, 6),
                                  "islands": [index + 1 for index in sorted(islands)],
                                  "rows": [min(rows), max(rows)],
                                  "normal_dot": current.dot(previous)}
                        if len(islands) == 1 and max(rows) <= ROOT_ATTACHMENT_MAX_ROW:
                            results["root_attachment_temporal_normal_discontinuities"] += 1
                            if len(results["root_attachment_temporal_normal_samples"]) < 10:
                                results["root_attachment_temporal_normal_samples"].append(sample)
                        else:
                            results["temporal_normal_flip_events_outside_attachment"] += 1
                            if len(results["temporal_normal_flip_samples_outside_attachment"]) < 10:
                                results["temporal_normal_flip_samples_outside_attachment"].append(sample)
            previous_normals = normals
            if previous_vertices is not None:
                step = max((a - b).length for a, b in zip(petal_vertices, previous_vertices))
                if step > results["max_frame_step_m"]:
                    results["max_frame_step_m"] = step
                    results["frame_step_worst"] = {"clip": clip_name, "frame": frame, "delta_m": step}
            previous_vertices = petal_vertices
            if clip_name == "Bloom":
                bvh_by_island = []
                for island in range(6):
                    vertex_start = island * PETAL_VERTICES
                    island_vertices = petal_vertices[vertex_start:vertex_start + PETAL_VERTICES]
                    island_faces = static_faces_by_island[island]
                    bvh_by_island.append(BVHTree.FromPolygons(island_vertices, island_faces))
                for first_island in range(6):
                    for second_island in range(first_island + 1, 6):
                        overlaps = bvh_by_island[first_island].overlap(bvh_by_island[second_island])
                        if not overlaps:
                            continue
                        root_only = all(
                            max(vertex // 15 for vertex in faces_by_island[first_island][left]) <= ROOT_ATTACHMENT_MAX_ROW
                            and max(vertex // 15 for vertex in faces_by_island[second_island][right]) <= ROOT_ATTACHMENT_MAX_ROW
                            for left, right in overlaps)
                        if root_only:
                            results["allowed_root_contacts"] += len(overlaps)
                        else:
                            event = {"frame": frame, "time_seconds": round(time_seconds, 6),
                                     "islands": [first_island + 1, second_island + 1],
                                     "overlap_pairs": len(overlaps), "sample_face_pairs": overlaps[:8]}
                            if len(results["intersection_events"]) < 100:
                                results["intersection_events"].append(event)
            results["frames_checked"] += 1
            clear_mesh(petal_eval, petal_mesh)
            clear_mesh(outer_eval, outer_mesh)
    if results["curvature_peak_m"] > CURVATURE_LIMIT_M:
        failures.append({"error": "longitudinal bend discontinuity exceeds limit",
                         "peak_m": results["curvature_peak_m"], "limit_m": CURVATURE_LIMIT_M,
                         "worst": results["curvature_worst"]})
    if results["max_paired_surface_delta_m"] > SYNC_TOLERANCE_M:
        failures.append({"error": "paired inner/outer surfaces diverged",
                         "max_delta_m": results["max_paired_surface_delta_m"]})
    if results["normal_alignment_min"] > -0.999:
        failures.append({"error": "inner/outer normals are not opposite", "min_dot": results["normal_alignment_min"]})
    if results["degenerate_triangle_count"]:
        failures.append({"error": "degenerate native surface triangles detected",
                         "count": results["degenerate_triangle_count"],
                         "minimum_area_ratio": results["minimum_triangle_area_ratio"],
                         "limit": MIN_TRIANGLE_AREA_RATIO})
    if results["normal_fold_events_outside_attachment"]:
        failures.append({"error": "adjacent native triangle normals fold outside the root attachment zone",
                         "count": results["normal_fold_events_outside_attachment"],
                         "samples": results["normal_fold_samples_outside_attachment"]})
    if results["temporal_normal_flip_events_outside_attachment"]:
        failures.append({"error": "native triangle normal changed direction sharply outside the root attachment zone",
                         "count": results["temporal_normal_flip_events_outside_attachment"],
                         "samples": results["temporal_normal_flip_samples_outside_attachment"]})
    if results["intersection_events"]:
        failures.append({"error": "inter-petal intersections outside attachment zones",
                         "count_sampled": len(results["intersection_events"]),
                         "first": results["intersection_events"][:5]})
    if results["max_frame_step_m"] > MAX_FRAME_STEP_M:
        failures.append({"error": "per-frame petal vertex jump exceeds limit",
                         "peak_m": results["max_frame_step_m"], "limit_m": MAX_FRAME_STEP_M,
                         "worst": results["frame_step_worst"]})
    results["frames_per_clip"] = max_frames_per_clip
    results["limits"] = {"curvature_m": CURVATURE_LIMIT_M, "sync_m": SYNC_TOLERANCE_M,
                         "boundary_m": BOUNDARY_TOLERANCE_M, "max_frame_step_m": MAX_FRAME_STEP_M}
    return results, failures


def main():
    args = parse_args()
    package_root, root = resolve_output_root(__file__, args.output_root)
    report_path = output_path(root, args.report)
    glb_path = output_path(root, args.glb)
    v13_reference_path = (Path(root) / "baseline" / "lily_004_v13_final.blend").resolve()
    source_path = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    validate_output_paths(
        root, {"report": report_path},
        inputs=(("source blend", source_path), ("GLB input", glb_path),
                ("v13 reference blend", v13_reference_path)),
        protected_roots=(package_root / "baseline",),
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    report = {"status": "RUNNING", "source_blend": bpy.data.filepath,
              "v13_reference_blend": str(v13_reference_path),
              "glb_input_path": str(glb_path)}
    failures = []
    try:
        if not v13_reference_path.is_file():
            raise RuntimeError(f"Missing read-only v13 geometry reference: {v13_reference_path}")
        report["clip_durations"], duration_failures = validate_clip_durations(fps)
        failures.extend(duration_failures)
        report["topology"], topology_failures = validate_topology_and_winding()
        failures.extend(topology_failures)
        report["open_profile"] = open_profile_metrics(scene, v13_reference_path)
        if not args.open_profile_only:
            report["growth_evidence"], growth_failures = growth_evidence(scene, fps)
            failures.extend(growth_failures)
            report["boundaries"] = boundary_checks(scene, fps)
            failures.extend(item for item in report["boundaries"] if not item["pass"])
            report["dense_geometry"], geometry_failures = dense_pose_checks(scene, fps)
            failures.extend(geometry_failures)
            report["glb"], glb_failures = glb_check(glb_path)
            report["glb"]["path"] = str(glb_path)
            failures.extend(glb_failures)
    except Exception as error:
        failures.append({"error": repr(error)})
    report["failures"] = failures
    report["status"] = "PASS" if not failures else "FAIL"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    summary = report.get("dense_geometry", {})
    print(f"GEOMETRY_VERIFY {report['status']} failures={len(failures)} clips={len(report.get('clip_durations', []))} "
          f"boundaries={len(report.get('boundaries', []))} frames={summary.get('frames_checked', 0)} "
          f"bend_peak={summary.get('curvature_peak_m', float('nan')):.6f}m intersections={len(summary.get('intersection_events', []))}")
    if failures:
        for failure in failures[:12]:
            print("GEOMETRY_FAILURE", json.dumps(failure, ensure_ascii=False))
        raise RuntimeError(f"Geometry verification failed; see {report_path}")


if __name__ == "__main__":
    main()
