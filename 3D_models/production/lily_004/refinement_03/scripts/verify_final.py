"""Independent final-delivery checks for the Lily 004 GLB package."""
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
    from mathutils.bvhtree import BVHTree
except ImportError:  # The structural/report seams are also tested with host Python.
    bpy = None
    BVHTree = None


CLIP_DURATIONS = {
    "Growth": 9.0,
    "IdleClosed": 8.0,
    "TouchResponse": 2.0,
    "Bloom": 8.0,
    "IdleOpen": 8.0,
    "DissolveReady": 1.0,
}
PRIMARY_ROOT = Path("C:/Users/McHomak/Projects/A_Little_Universe")

COMPONENT_FORMATS = {
    5120: "b", 5121: "B", 5122: "h", 5123: "H",
    5125: "I", 5126: "f",
}
TYPE_WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


class VerificationError(RuntimeError):
    """Raised when the final package contradicts its exported evidence."""


def require_pass_report(report: dict[str, Any], label: str) -> None:
    """Reject failed reports and PASS reports that still contain findings."""
    status = report.get("status", report.get("result"))
    if status != "PASS":
        raise VerificationError(f"{label} report status is {status!r}, expected 'PASS'")
    findings = report.get("failures", [])
    if findings:
        raise VerificationError(f"{label} report contains failures: {findings[:3]!r}")


def validate_growth_bvh_report(report: dict[str, Any], expected_sha256: str) -> dict[str, Any]:
    """Require dense, zero-intersection BVH evidence for this exact final GLB."""
    require_pass_report(report, "Growth BVH")
    if report.get("clip") != "Growth":
        raise VerificationError("Growth BVH report must identify the Growth clip")
    if report.get("glbSha256") != expected_sha256:
        raise VerificationError("Growth BVH report does not match the final GLB SHA-256")
    try:
        duration = float(report["durationSeconds"])
        frames = int(report["framesChecked"])
        allowed = int(report.get("allowedRootContacts", 0))
        intersection_count = int(report.get("intersectionEventCount", len(report["intersectionEvents"])))
        events = report["intersectionEvents"]
    except (KeyError, TypeError, ValueError) as error:
        raise VerificationError("Growth BVH report is missing required sample evidence") from error
    if not math.isfinite(duration) or abs(duration - CLIP_DURATIONS["Growth"]) > 1e-6:
        raise VerificationError(f"Growth BVH duration must be 9s, found {duration!r}")
    if frames != 217:
        raise VerificationError(f"Growth BVH must check all 217 frames, found {frames}")
    if allowed < 0 or intersection_count < 0 or not isinstance(events, list):
        raise VerificationError("Growth BVH contact/intersection counts are invalid")
    if intersection_count or events:
        raise VerificationError(f"Growth BVH intersection count is nonzero: {intersection_count}")
    if report.get("triangleCountPerIsland") != [896] * 6:
        raise VerificationError("Growth BVH must verify six 896-triangle island surfaces")
    if events:
        raise VerificationError(f"Growth BVH found inter-petal intersections: {events[:3]!r}")
    return {
        "clip": "Growth",
        "durationSeconds": duration,
        "framesChecked": frames,
        "intersectionEvents": 0,
        "allowedRootContacts": allowed,
        "glbSha256": expected_sha256,
    }


def validate_pose_bounds_report(report: dict[str, Any], expected_hashes: dict[str, str]) -> dict[str, Any]:
    """Require measured base and evaluated Growth/closed/open endpoints for all three GLBs."""
    require_pass_report(report, "Pose bounds")
    if report.get("coordinateSystem") != "glTF Y-up (bounds converted from Blender Z-up import)" or report.get("unit") != "meter by Blender pipeline contract":
        raise VerificationError("pose bounds report has an unexpected axis or unit contract")
    assets = report.get("assets")
    if not isinstance(assets, dict) or set(assets) != set(expected_hashes):
        raise VerificationError("pose bounds report must contain baseline, geometry, and final assets")
    for label, expected_hash in expected_hashes.items():
        asset = assets[label]
        if asset.get("sha256") != expected_hash:
            raise VerificationError(f"{label} evaluated bounds are not bound to the expected GLB")
        poses = asset.get("poses")
        durations = asset.get("clipDurationsSeconds", {})
        required_poses = {"base"}
        for clip in ("Growth", "IdleClosed", "Bloom", "IdleOpen"):
            try:
                duration = float(durations[clip])
            except (KeyError, TypeError, ValueError) as error:
                raise VerificationError(f"{label} pose report is missing {clip} duration") from error
            required_poses.add(f"{clip}@0s")
            required_poses.add(f"{clip}@{duration:g}s")
        if not isinstance(poses, dict) or not required_poses.issubset(poses):
            raise VerificationError(f"{label} is missing evaluated pose bounds for Growth/Bloom/IdleOpen endpoints")
        for bound_name in ("baseAccessorBounds", "defaultWeightsBounds", "morphEnvelopeBounds"):
            bounds = asset.get(bound_name)
            if not isinstance(bounds, dict):
                raise VerificationError(f"{label} is missing {bound_name}")
            try:
                coordinates = [float(value) for field in ("min", "max", "dimensions") for value in bounds[field]]
            except (KeyError, TypeError, ValueError) as error:
                raise VerificationError(f"{label} {bound_name} is incomplete") from error
            if len(coordinates) != 9 or not all(math.isfinite(value) for value in coordinates):
                raise VerificationError(f"{label} {bound_name} is invalid")
        for pose_name, bounds in poses.items():
            try:
                coordinates = [float(value) for field in ("min", "max", "dimensions") for value in bounds[field]]
            except (KeyError, TypeError, ValueError) as error:
                raise VerificationError(f"{label} evaluated pose bounds are incomplete: {pose_name}") from error
            if len(coordinates) != 9 or not all(math.isfinite(value) for value in coordinates):
                raise VerificationError(f"{label} evaluated pose bounds are invalid: {pose_name}")
    geometry_poses = assets["geometry"]["poses"]
    final_poses = assets["final"]["poses"]
    if set(geometry_poses) != set(final_poses):
        raise VerificationError("geometry-stage and final evaluated pose bounds have different sample sets")
    for pose_name in geometry_poses:
        for field in ("min", "max", "dimensions"):
            left = geometry_poses[pose_name][field]
            right = final_poses[pose_name][field]
            if any(abs(float(a) - float(b)) > 1e-5 for a, b in zip(left, right)):
                raise VerificationError(f"material stage changed evaluated geometry bounds: {pose_name}")
    for bound_name in ("baseAccessorBounds", "defaultWeightsBounds", "morphEnvelopeBounds"):
        for field in ("min", "max", "dimensions"):
            left = assets["geometry"][bound_name][field]
            right = assets["final"][bound_name][field]
            if any(abs(float(a) - float(b)) > 1e-5 for a, b in zip(left, right)):
                raise VerificationError(f"material stage changed {bound_name}: {field}")
    for label, asset in assets.items():
        default_pose = asset["poses"]["base"]
        expected_default = asset["defaultWeightsBounds"]
        if any(abs(float(a) - float(b)) > 1e-5 for field in ("min", "max", "dimensions")
               for a, b in zip(default_pose[field], expected_default[field])):
            raise VerificationError(f"{label} imported base pose does not apply its glTF default node weights")
    return {
        "coordinateSystem": report["coordinateSystem"],
        "unit": report["unit"],
        "assets": {label: {"sha256": assets[label]["sha256"], "baseAccessorBounds": assets[label]["baseAccessorBounds"],
                           "defaultWeightsBounds": assets[label]["defaultWeightsBounds"],
                           "morphEnvelopeBounds": assets[label]["morphEnvelopeBounds"], "poses": assets[label]["poses"]}
                   for label in expected_hashes},
        "geometryStageBoundsPreservedByMaterials": True,
    }


def validate_clip_boundary_bounds(poses: dict[str, Any]) -> None:
    """Require measured endpoint bounds to agree across continuous exported clip boundaries."""
    boundaries = (
        ("Growth@9s", "IdleClosed@0s"),
        ("IdleClosed@0s", "Bloom@0s"),
        ("Bloom@8s", "IdleOpen@0s"),
    )
    for first_name, second_name in boundaries:
        if first_name not in poses or second_name not in poses:
            raise VerificationError(f"pose report is missing boundary bounds: {first_name} / {second_name}")
        for field in ("min", "max", "dimensions"):
            first = poses[first_name][field]
            second = poses[second_name][field]
            if any(abs(float(a) - float(b)) > 1e-5 for a, b in zip(first, second)):
                raise VerificationError(f"evaluated clip boundary bounds differ: {first_name} vs {second_name} ({field})")


def growth_bvh_glb(glb_path: Path, report_path: Path) -> dict[str, Any]:
    """Sample every Growth frame from an imported GLB and test tepal BVHs."""
    if bpy is None or BVHTree is None:
        raise RuntimeError("Growth BVH generation must run under Blender 5.2")
    glb_path = glb_path.resolve()
    if not glb_path.is_file():
        raise VerificationError(f"final GLB does not exist: {glb_path}")
    raw = glb_path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = 24, 1.0
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    petals = bpy.data.objects.get("Petals")
    if petals is None or petals not in imported:
        raise VerificationError("imported final GLB is missing Petals")
    owners = []
    for obj in imported:
        owners.append(obj)
        if obj.type == "MESH" and obj.data.shape_keys:
            owners.append(obj.data.shape_keys)
    strips = []
    for owner in owners:
        animation_data = getattr(owner, "animation_data", None)
        if not animation_data:
            continue
        animation_data.action = None
        for track in animation_data.nla_tracks:
            track.mute = track.name != "Growth"
            if track.name == "Growth" and track.strips:
                strips.extend(track.strips)
    if not strips:
        raise VerificationError("imported final GLB has no Growth NLA strips")
    strip = strips[0]
    fps = scene.render.fps / scene.render.fps_base
    duration = (strip.action_frame_end - strip.action_frame_start) / (fps * strip.scale)
    if abs(duration - CLIP_DURATIONS["Growth"]) > 1e-6:
        raise VerificationError(f"imported Growth duration is {duration:g}s, expected 9s")

    base_mesh = petals.data
    base_mesh.calc_loop_triangles()
    island_faces: list[list[tuple[int, int, int]]] = [[] for _ in range(6)]
    vertices_per_island = 495
    for triangle in base_mesh.loop_triangles:
        indices = tuple(int(index) for index in triangle.vertices)
        islands = {index // vertices_per_island for index in indices}
        if len(islands) != 1 or not 0 <= next(iter(islands)) < 6:
            raise VerificationError("Growth BVH found a tepal triangle crossing island boundaries")
        island = next(iter(islands))
        island_faces[island].append(tuple(index - island * vertices_per_island for index in indices))
    if any(len(faces) != 896 for faces in island_faces):
        raise VerificationError("Growth BVH expected 896 triangles in each of six tepals")

    events: list[dict[str, Any]] = []
    event_count = 0
    allowed_root_contacts = 0
    frame_start = round(strip.frame_start)
    frames_checked = 0
    for offset in range(217):
        scene.frame_set(frame_start + offset)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = petals.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            bvh_by_island = []
            for island in range(6):
                start = island * vertices_per_island
                island_vertices = vertices[start:start + vertices_per_island]
                bvh_by_island.append(BVHTree.FromPolygons(island_vertices, island_faces[island]))
            seconds = offset / fps
            for first_island in range(6):
                for second_island in range(first_island + 1, 6):
                    overlaps = bvh_by_island[first_island].overlap(bvh_by_island[second_island])
                    if not overlaps:
                        continue
                    root_only = all(
                        max(index // 15 for index in island_faces[first_island][left]) <= 1
                        and max(index // 15 for index in island_faces[second_island][right]) <= 1
                        for left, right in overlaps
                    )
                    if root_only:
                        allowed_root_contacts += len(overlaps)
                    else:
                        event_count += 1
                        if len(events) < 100:
                            events.append({
                                "frame": frame_start + offset,
                                "timeSeconds": round(seconds, 6),
                                "islands": [first_island + 1, second_island + 1],
                                "overlapPairs": len(overlaps),
                                "sampleFacePairs": overlaps[:8],
                            })
            frames_checked += 1
        finally:
            evaluated.to_mesh_clear()

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)

    result = {
        "schemaVersion": 1,
        "status": "PASS" if event_count == 0 and frames_checked == 217 else "FAIL",
        "glb": str(glb_path),
        "glbSha256": digest,
        "glbBytes": len(raw),
        "clip": "Growth",
        "durationSeconds": duration,
        "framesChecked": frames_checked,
        "framesPerSecond": fps,
        "triangleCountPerIsland": [len(faces) for faces in island_faces],
        "allowedRootContacts": allowed_root_contacts,
        "intersectionEventCount": event_count,
        "intersectionEvents": events,
        "failures": ([{"error": "inter-petal intersections outside attachment zones", "count": event_count}]
                     if event_count or frames_checked != 217 else []),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


def pose_bounds_glbs(paths: dict[str, Path], report_path: Path) -> dict[str, Any]:
    """Measure base and evaluated endpoint bounds for baseline, geometry, and final GLBs."""
    if bpy is None:
        raise RuntimeError("pose-bound generation must run under Blender 5.2")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from render_comparison import _animation_owners, _set_pose, capture_asset_rest_state, restore_asset_rest_state

    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = 24, 1.0
    assets: dict[str, Any] = {}
    for label, source_path in paths.items():
        path = source_path.resolve()
        if not path.is_file():
            raise VerificationError(f"{label} GLB does not exist: {path}")
        raw = path.read_bytes()
        document, binary, _ = read_glb(path)
        static_summary = summarize_gltf(document, binary)
        inventory = clip_inventory(document)
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = [obj for obj in bpy.data.objects if obj not in before]
        mesh_objects = [obj for obj in imported if obj.type == "MESH"]
        if len(mesh_objects) != 7:
            raise VerificationError(f"{label} GLB imported {len(mesh_objects)} mesh objects, expected 7")

        asset = {"objects": imported, "restState": capture_asset_rest_state(imported, path)}
        owners = [owner for obj in imported for owner in _animation_owners(obj)]
        restore_asset_rest_state(asset)
        scene.frame_set(1)

        def bounds_for_pose() -> dict[str, list[float]]:
            depsgraph = bpy.context.evaluated_depsgraph_get()
            points = []
            for obj in mesh_objects:
                evaluated = obj.evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                try:
                    for vertex in mesh.vertices:
                        point = evaluated.matrix_world @ vertex.co
                        points.append((float(point.x), float(point.z), -float(point.y)))
                finally:
                    evaluated.to_mesh_clear()
            if not points:
                raise VerificationError(f"{label} GLB produced no evaluated mesh vertices")
            minimum = [min(float(point[axis]) for point in points) for axis in range(3)]
            maximum = [max(float(point[axis]) for point in points) for axis in range(3)]
            return {"min": minimum, "max": maximum,
                    "dimensions": [maximum[axis] - minimum[axis] for axis in range(3)]}

        poses: dict[str, Any] = {"base": {**bounds_for_pose(), "pose": "imported rest transforms and shape keys; actions/slots cleared and NLA muted"}}
        for clip in ("Growth", "IdleClosed", "Bloom", "IdleOpen"):
            duration = inventory[clip]["durationSeconds"]
            samples = sorted(set((0.0, duration, duration / 2.0)))
            for seconds in samples:
                try:
                    _set_pose(asset, clip, seconds)
                except RuntimeError as error:
                    raise VerificationError(f"{label} GLB pose sampling failed for {clip}@{seconds:g}s: {error}") from error
                strip = next((track.strips[0] for owner in owners
                              for animation_data in [getattr(owner, "animation_data", None)] if animation_data
                              for track in animation_data.nla_tracks if track.name == clip and track.strips), None)
                if strip is None:
                    raise VerificationError(f"{label} GLB is missing {clip} NLA strips")
                frame = scene.frame_current
                pose_key = f"{clip}@{seconds:g}s"
                poses[pose_key] = {**bounds_for_pose(), "clip": clip, "absoluteSeconds": seconds,
                                   "durationSeconds": duration, "frame": frame}
        assets[label] = {
            "path": str(path),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "clipDurationsSeconds": {name: value["durationSeconds"] for name, value in inventory.items()},
            "meshObjects": len(mesh_objects),
            "baseAccessorBounds": static_summary["worldBounds"],
            "defaultWeightsBounds": static_summary["defaultWeightsBounds"],
            "morphEnvelopeBounds": static_summary["morphEnvelopeBounds"],
            "poses": poses,
        }
        if label == "final":
            validate_clip_boundary_bounds(poses)
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
    result = {"schemaVersion": 1, "status": "PASS",
              "coordinateSystem": "glTF Y-up (bounds converted from Blender Z-up import)",
              "unit": "meter by Blender pipeline contract", "method": "independent Blender GLB import; evaluated mesh world bounds",
              "assets": assets, "failures": []}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


def clip_inventory(document: dict[str, Any]) -> dict[str, dict[str, float]]:
    """Return each exported animation's zero-based time range in seconds."""
    accessors = document.get("accessors")
    animations = document.get("animations")
    if not isinstance(accessors, list) or not isinstance(animations, list):
        raise VerificationError("glTF document must contain accessors and animations")

    inventory: dict[str, dict[str, float]] = {}
    for animation in animations:
        name = animation.get("name")
        samplers = animation.get("samplers")
        if not isinstance(name, str) or not name:
            raise VerificationError("every exported animation must have a name")
        if name in inventory:
            raise VerificationError(f"duplicate exported animation name: {name}")
        if not isinstance(samplers, list) or not samplers:
            raise VerificationError(f"animation has no samplers: {name}")

        starts: list[float] = []
        ends: list[float] = []
        for sampler in samplers:
            try:
                accessor = accessors[sampler["input"]]
                start = float(accessor["min"][0])
                end = float(accessor["max"][0])
            except (KeyError, IndexError, TypeError, ValueError) as error:
                raise VerificationError(f"animation input range is missing or invalid: {name}") from error
            if not math.isfinite(start) or not math.isfinite(end) or end < start:
                raise VerificationError(f"animation input range is non-finite or reversed: {name}")
            starts.append(start)
            ends.append(end)

        start, end = min(starts), max(ends)
        if abs(start) > 1e-6:
            raise VerificationError(f"exported animation is not zero-based: {name} starts at {start:g}s")
        inventory[name] = {
            "startSeconds": start,
            "endSeconds": end,
            "durationSeconds": end - start,
        }
    return inventory


def _accessor_values(document: dict[str, Any], binary: bytes, accessor_index: int) -> list[tuple[float, ...]]:
    try:
        accessor = document["accessors"][accessor_index]
        component_format = COMPONENT_FORMATS[accessor["componentType"]]
        width = TYPE_WIDTHS[accessor["type"]]
        count = int(accessor["count"])
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise VerificationError(f"invalid GLB accessor {accessor_index}") from error
    element_size = struct.calcsize("<" + component_format * width)
    if count < 0:
        raise VerificationError(f"GLB accessor has a negative count: {accessor_index}")

    def read_view(view_index: int, value_count: int, fmt: str, value_width: int,
                  byte_offset: int = 0, stride_override: int | None = None) -> list[tuple[float, ...]]:
        try:
            view = document["bufferViews"][view_index]
            component_size = struct.calcsize("<" + fmt * value_width)
            stride = int(stride_override if stride_override is not None else view.get("byteStride", component_size))
            start = int(view.get("byteOffset", 0)) + int(byte_offset)
            view_end = int(view.get("byteOffset", 0)) + int(view["byteLength"])
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise VerificationError(f"invalid GLB buffer view {view_index}") from error
        if view.get("buffer", 0) != 0 or stride < component_size or start < 0:
            raise VerificationError("GLB accessors must use a valid embedded binary buffer view")
        if value_count and start + (value_count - 1) * stride + component_size > min(view_end, len(binary)):
            raise VerificationError(f"GLB accessor exceeds its buffer view: {view_index}")
        return [struct.unpack_from("<" + fmt * value_width, binary, start + row * stride)
                for row in range(value_count)]

    if "bufferView" in accessor:
        output = read_view(accessor["bufferView"], count, component_format, width,
                           int(accessor.get("byteOffset", 0)))
    else:
        output = [(0,) * width for _ in range(count)]
    sparse = accessor.get("sparse")
    if sparse is not None:
        try:
            sparse_count = int(sparse["count"])
            index_record = sparse["indices"]
            index_format = COMPONENT_FORMATS[index_record["componentType"]]
            value_record = sparse["values"]
        except (KeyError, TypeError, ValueError) as error:
            raise VerificationError(f"invalid sparse GLB accessor: {accessor_index}") from error
        if sparse_count < 0 or sparse_count > count:
            raise VerificationError(f"invalid sparse accessor element count: {accessor_index}")
        sparse_indices = read_view(index_record["bufferView"], sparse_count, index_format, 1,
                                   int(index_record.get("byteOffset", 0)))
        sparse_values = read_view(value_record["bufferView"], sparse_count, component_format, width,
                                  int(value_record.get("byteOffset", 0)))
        previous_index = -1
        for sparse_index, sparse_value in zip(sparse_indices, sparse_values):
            target_index = int(sparse_index[0])
            if target_index <= previous_index or target_index >= count:
                raise VerificationError(f"sparse accessor indices are duplicate, unordered, or out of range: {accessor_index}")
            previous_index = target_index
            output[target_index] = sparse_value
    if any(not math.isfinite(float(value)) for row in output for value in row):
        raise VerificationError(f"GLB accessor contains a non-finite value: {accessor_index}")
    return output


def _identity_matrix() -> list[list[float]]:
    return [[1.0 if row == column else 0.0 for column in range(4)] for row in range(4)]


def _multiply_matrix(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    return [[sum(left[row][k] * right[k][column] for k in range(4)) for column in range(4)]
            for row in range(4)]


def _local_matrix(node: dict[str, Any]) -> list[list[float]]:
    if "matrix" in node:
        values = node["matrix"]
        if len(values) != 16:
            raise VerificationError("glTF node matrix must contain 16 values")
        return [[float(values[column * 4 + row]) for column in range(4)] for row in range(4)]
    translation = [float(value) for value in node.get("translation", (0, 0, 0))]
    rotation = [float(value) for value in node.get("rotation", (0, 0, 0, 1))]
    scale = [float(value) for value in node.get("scale", (1, 1, 1))]
    if len(translation) != 3 or len(rotation) != 4 or len(scale) != 3:
        raise VerificationError("glTF node TRS has an invalid component count")
    if not all(math.isfinite(value) for value in translation + rotation + scale):
        raise VerificationError("glTF node TRS contains a non-finite value")
    x, y, z, w = rotation
    norm = math.sqrt(x * x + y * y + z * z + w * w)
    if norm <= 1e-12:
        raise VerificationError("glTF node rotation quaternion is degenerate")
    x, y, z, w = (value / norm for value in rotation)
    rotation_matrix = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), translation[0]],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), translation[1]],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), translation[2]],
        [0.0, 0.0, 0.0, 1.0],
    ]
    for row in range(3):
        for column in range(3):
            rotation_matrix[row][column] *= scale[column]
    return rotation_matrix


def _transform_point(matrix: list[list[float]], point: tuple[float, ...]) -> tuple[float, float, float]:
    return tuple(sum(matrix[row][column] * float(point[column]) for column in range(3)) + matrix[row][3]
                 for row in range(3))


def _canonical_connectivity(triangles: list[tuple[int, int, int]]) -> str:
    canonical = sorted(tuple(sorted(triangle)) for triangle in triangles)
    encoded = json.dumps(canonical, separators=(",", ":")).encode("ascii")
    return hashlib.sha256(encoded).hexdigest()


def summarize_gltf(document: dict[str, Any], binary: bytes) -> dict[str, Any]:
    """Summarize exported nodes, mesh connectivity, budgets, and base-pose bounds."""
    gltf_nodes = document.get("nodes")
    meshes = document.get("meshes")
    scenes = document.get("scenes")
    if not isinstance(gltf_nodes, list) or not isinstance(meshes, list) or not isinstance(scenes, list):
        raise VerificationError("GLB must contain nodes, meshes, and scenes")
    names = [node.get("name") for node in gltf_nodes]
    if any(not isinstance(name, str) or not name for name in names) or len(set(names)) != len(names):
        raise VerificationError("every GLB node must have a unique non-empty name")
    parent_index: dict[int, int] = {}
    children: dict[int, list[int]] = {}
    for parent, node in enumerate(gltf_nodes):
        child_indices = node.get("children", [])
        if not isinstance(child_indices, list):
            raise VerificationError(f"GLB children must be an array: {names[parent]}")
        children[parent] = child_indices
        for child in child_indices:
            if not isinstance(child, int) or child < 0 or child >= len(gltf_nodes) or child in parent_index:
                raise VerificationError("GLB node has an invalid or multiply-parented child")
            parent_index[child] = parent

    local_matrices = [_local_matrix(node) for node in gltf_nodes]
    world_matrices: dict[int, list[list[float]]] = {}
    visiting: set[int] = set()

    def world_matrix(index: int) -> list[list[float]]:
        if index in world_matrices:
            return world_matrices[index]
        if index in visiting:
            raise VerificationError("GLB node hierarchy contains a cycle")
        visiting.add(index)
        parent = parent_index.get(index)
        value = (_multiply_matrix(world_matrix(parent), local_matrices[index])
                 if parent is not None else local_matrices[index])
        visiting.remove(index)
        world_matrices[index] = value
        return value

    scene_index = int(document.get("scene", 0))
    try:
        root_indices = scenes[scene_index]["nodes"]
    except (IndexError, KeyError, TypeError) as error:
        raise VerificationError("GLB selected scene is invalid") from error
    scene_roots = [names[index] for index in root_indices]
    if any(index < 0 or index >= len(names) for index in root_indices):
        raise VerificationError("GLB scene references an unknown root node")
    structural_roots = [names[index] for index in range(len(names)) if index not in parent_index]
    if set(scene_roots) != set(structural_roots):
        raise VerificationError("GLB scene roots disagree with the node hierarchy")

    node_summary: dict[str, Any] = {}
    mesh_summary: dict[str, Any] = {}
    all_positions: list[tuple[float, float, float]] = []
    default_weight_positions: list[tuple[float, float, float]] = []
    morph_minimum = [math.inf, math.inf, math.inf]
    morph_maximum = [-math.inf, -math.inf, -math.inf]
    total_triangles = 0
    draw_calls = 0
    for index, node in enumerate(gltf_nodes):
        name = names[index]
        local_transform = ({"matrix": [float(value) for value in node["matrix"]]} if "matrix" in node else {
            "translation": [float(value) for value in node.get("translation", (0, 0, 0))],
            "rotation": [float(value) for value in node.get("rotation", (0, 0, 0, 1))],
            "scale": [float(value) for value in node.get("scale", (1, 1, 1))],
        })
        node_summary[name] = {
            "parent": names[parent_index[index]] if index in parent_index else None,
            "children": [names[child] for child in children[index]],
            "meshIndex": node.get("mesh"),
            "localTransform": local_transform,
            "localMatrix": local_matrices[index],
        }
        if "mesh" not in node:
            continue
        try:
            mesh = meshes[node["mesh"]]
            primitives = mesh["primitives"]
        except (IndexError, KeyError, TypeError) as error:
            raise VerificationError(f"GLB node references an invalid mesh: {name}") from error
        primitive_summary = []
        vertex_count = 0
        triangle_count = 0
        mesh_default_weights = mesh.get("weights", [])
        node_default_weights = node.get("weights", mesh_default_weights)
        for primitive_index, primitive in enumerate(primitives):
            if primitive.get("mode", 4) != 4:
                raise VerificationError(f"GLB primitive is not a triangle list: {name}/{primitive_index}")
            try:
                position_accessor = primitive["attributes"]["POSITION"]
                positions = _accessor_values(document, binary, position_accessor)
            except (KeyError, TypeError) as error:
                raise VerificationError(f"GLB primitive has no POSITION accessor: {name}/{primitive_index}") from error
            if any(len(position) != 3 for position in positions):
                raise VerificationError(f"GLB POSITION must be VEC3: {name}/{primitive_index}")
            targets = primitive.get("targets", [])
            weights = [float(value) for value in node_default_weights] if node_default_weights else [0.0] * len(targets)
            if len(weights) != len(targets) or any(not math.isfinite(value) for value in weights):
                raise VerificationError(f"GLB default morph weights do not match targets: {name}/{primitive_index}")
            morph_deltas = []
            for target in targets:
                if "POSITION" in target:
                    delta_values = _accessor_values(document, binary, target["POSITION"])
                    if len(delta_values) != len(positions) or any(len(delta) != 3 for delta in delta_values):
                        raise VerificationError(f"GLB morph target POSITION count differs from its base mesh: {name}/{primitive_index}")
                else:
                    delta_values = [(0.0, 0.0, 0.0)] * len(positions)
                morph_deltas.append(delta_values)
            index_values = (_accessor_values(document, binary, primitive["indices"])
                            if "indices" in primitive else [(i,) for i in range(len(positions))])
            indices = [int(value[0]) for value in index_values]
            if len(indices) % 3:
                raise VerificationError(f"GLB triangle index count is not divisible by three: {name}/{primitive_index}")
            if any(value < 0 or value >= len(positions) for value in indices):
                raise VerificationError(f"GLB primitive index is outside its vertex range: {name}/{primitive_index}")
            triangles = [tuple(indices[offset:offset + 3]) for offset in range(0, len(indices), 3)]
            count = len(triangles)
            vertex_count += len(positions)
            triangle_count += count
            draw_calls += 1
            total_triangles += count
            primitive_summary.append({
                "primitiveIndex": primitive_index,
                "vertexCount": len(positions),
                "triangleCount": count,
                "connectivitySha256": _canonical_connectivity(triangles),
            })
            matrix = world_matrix(index)
            for vertex_index, position in enumerate(positions):
                base_position = tuple(float(value) for value in position)
                all_positions.append(_transform_point(matrix, base_position))
                default_position = [base_position[axis] + sum(
                    weights[target_index] * float(morph_deltas[target_index][vertex_index][axis])
                    for target_index in range(len(targets))) for axis in range(3)]
                default_weight_positions.append(_transform_point(matrix, tuple(default_position)))
                low = [base_position[axis] + sum(min(0.0, float(delta[vertex_index][axis]))
                     for delta in morph_deltas) for axis in range(3)]
                high = [base_position[axis] + sum(max(0.0, float(delta[vertex_index][axis]))
                      for delta in morph_deltas) for axis in range(3)]
                for mask in range(8):
                    corner = tuple(high[axis] if mask & (1 << axis) else low[axis] for axis in range(3))
                    world_corner = _transform_point(matrix, corner)
                    for axis in range(3):
                        morph_minimum[axis] = min(morph_minimum[axis], world_corner[axis])
                        morph_maximum[axis] = max(morph_maximum[axis], world_corner[axis])
        if name in mesh_summary:
            raise VerificationError(f"multiple node instances share the GLB node name: {name}")
        mesh_summary[name] = {
            "meshIndex": node["mesh"],
            "vertexCount": vertex_count,
            "triangleCount": triangle_count,
            "primitiveCount": len(primitive_summary),
            "defaultMorphWeights": [float(value) for value in node_default_weights],
            "primitives": primitive_summary,
        }
    if not all_positions:
        raise VerificationError("GLB has no mesh vertices")
    minimum = [min(point[axis] for point in all_positions) for axis in range(3)]
    maximum = [max(point[axis] for point in all_positions) for axis in range(3)]
    dimensions = [maximum[axis] - minimum[axis] for axis in range(3)]
    default_minimum = [min(point[axis] for point in default_weight_positions) for axis in range(3)]
    default_maximum = [max(point[axis] for point in default_weight_positions) for axis in range(3)]
    default_dimensions = [default_maximum[axis] - default_minimum[axis] for axis in range(3)]
    morph_dimensions = [morph_maximum[axis] - morph_minimum[axis] for axis in range(3)]
    return {
        "sceneRoots": scene_roots,
        "nodes": node_summary,
        "meshes": mesh_summary,
        "nodeCount": len(gltf_nodes),
        "meshObjectCount": len(mesh_summary),
        "triangleCount": total_triangles,
        "drawCalls": draw_calls,
        "worldBounds": {"pose": "base POSITION accessors; morph weights not evaluated", "min": minimum,
                        "max": maximum, "dimensions": dimensions},
        "defaultWeightsBounds": {"pose": "POSITION plus glTF node/mesh default weights; static node transforms",
                                 "min": default_minimum, "max": default_maximum, "dimensions": default_dimensions},
        "morphEnvelopeBounds": {"pose": "conservative independent morph weights in [0,1]; static node transforms",
                                "min": morph_minimum, "max": morph_maximum, "dimensions": morph_dimensions},
        "units": {"coordinateSystem": "glTF Y-up", "unit": "meter by Blender pipeline contract",
                  "scale": 1.0, "unitExplicitInGLB": False},
    }


def read_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
    """Read and validate a binary glTF 2.0 container."""
    raw = path.read_bytes()
    if len(raw) < 20:
        raise VerificationError(f"GLB is too short: {path}")
    magic, version, declared_length = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67 or version != 2 or declared_length != len(raw):
        raise VerificationError(f"invalid GLB 2 header or byte length: {path}")
    offset = 12
    document = None
    binary = None
    while offset + 8 <= len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk_end = offset + length
        if chunk_end > len(raw):
            raise VerificationError(f"GLB chunk exceeds file length: {path}")
        chunk = raw[offset:chunk_end]
        offset = chunk_end
        if kind == 0x4E4F534A:
            if document is not None:
                raise VerificationError(f"GLB contains more than one JSON chunk: {path}")
            document = json.loads(chunk.decode("utf-8"))
        elif kind == 0x004E4942:
            if binary is not None:
                raise VerificationError(f"GLB contains more than one binary chunk: {path}")
            binary = chunk
    if offset != len(raw) or not isinstance(document, dict) or binary is None:
        raise VerificationError(f"GLB is missing a required JSON or binary chunk: {path}")
    buffers = document.get("buffers", [])
    if len(buffers) != 1 or buffers[0].get("uri") is not None:
        raise VerificationError(f"GLB must use one embedded binary buffer: {path}")
    if int(buffers[0].get("byteLength", 0)) > len(binary):
        raise VerificationError(f"GLB binary chunk is shorter than its declared buffer: {path}")
    return document, binary, {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def summarize_glb(path: Path) -> dict[str, Any]:
    document, binary, identity = read_glb(path)
    return {**summarize_gltf(document, binary), **identity, "path": str(path.resolve())}


def _matrices_equal(left: list[list[float]], right: list[list[float]], tolerance: float = 1e-6) -> bool:
    return all(abs(left[row][column] - right[row][column]) <= tolerance
               for row in range(4) for column in range(4))


def _transform_changes(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    changes = []
    for name in sorted(set(before["nodes"]) & set(after["nodes"])):
        left = before["nodes"][name]["localMatrix"]
        right = after["nodes"][name]["localMatrix"]
        if not _matrices_equal(left, right):
            changes.append({"node": name, "before": before["nodes"][name]["localTransform"],
                            "after": after["nodes"][name]["localTransform"]})
    return changes


def compare_asset_summaries(baseline: dict[str, Any], final: dict[str, Any]) -> dict[str, Any]:
    """Compare hierarchy, root frame, fixed triangle connectivity, bounds, and budgets."""
    failures: list[dict[str, Any]] = []
    baseline_nodes, final_nodes = baseline["nodes"], final["nodes"]
    hierarchy_match = (baseline["sceneRoots"] == final["sceneRoots"]
                       and set(baseline_nodes) == set(final_nodes)
                       and all(baseline_nodes[name]["parent"] == final_nodes[name]["parent"]
                               and baseline_nodes[name]["children"] == final_nodes[name]["children"]
                               for name in set(baseline_nodes) & set(final_nodes)))
    if not hierarchy_match:
        failures.append({"error": "final node names, scene roots, or parent hierarchy differ from baseline"})
    if baseline["nodeCount"] != 14 or final["nodeCount"] != 14:
        failures.append({"error": "final asset must preserve the 14-node inventory",
                         "baseline": baseline["nodeCount"], "final": final["nodeCount"]})
    if baseline["meshObjectCount"] != 7 or final["meshObjectCount"] != 7:
        failures.append({"error": "final asset must preserve the seven mesh objects",
                         "baseline": baseline["meshObjectCount"], "final": final["meshObjectCount"]})

    root_name = "Lily_Root"
    identity = _identity_matrix()
    root = final_nodes.get(root_name)
    root_identity = root is not None and _matrices_equal(root["localMatrix"], identity)
    root_match = root_identity and root_name in baseline_nodes and _matrices_equal(
        baseline_nodes[root_name]["localMatrix"], root["localMatrix"])
    if not root_match:
        failures.append({"error": "Lily_Root TRS must preserve the baseline identity pivot"})

    mesh_names_match = set(baseline["meshes"]) == set(final["meshes"])
    connectivity_differences = []
    for name in sorted(set(baseline["meshes"]) & set(final["meshes"])):
        old, new = baseline["meshes"][name], final["meshes"][name]
        if old["vertexCount"] != new["vertexCount"] or old["primitives"] != new["primitives"]:
            connectivity_differences.append(name)
    connectivity_match = mesh_names_match and not connectivity_differences
    if not connectivity_match:
        failures.append({"error": "fixed triangle connectivity or mesh inventory differs from baseline",
                         "differentMeshes": connectivity_differences,
                         "baselineMeshes": sorted(baseline["meshes"]),
                         "finalMeshes": sorted(final["meshes"])})

    for label, asset in (("baseline", baseline), ("final", final)):
        if not math.isfinite(asset["triangleCount"]) or asset["triangleCount"] <= 0 or asset["triangleCount"] > 24000:
            failures.append({"error": f"{label} triangle budget is invalid", "value": asset["triangleCount"]})
        if asset["drawCalls"] < 8 or asset["drawCalls"] > 10:
            failures.append({"error": f"{label} draw-call budget is outside 8-10", "value": asset["drawCalls"]})
    if final["units"] != baseline["units"]:
        failures.append({"error": "GLB axis/unit contract differs from the baseline"})
    bounds = {
        "baseAccessor": {"baseline": baseline["worldBounds"], "final": final["worldBounds"],
                          "dimensionDelta": [final["worldBounds"]["dimensions"][axis] - baseline["worldBounds"]["dimensions"][axis]
                                             for axis in range(3)]},
        "defaultWeights": {"baseline": baseline["defaultWeightsBounds"], "final": final["defaultWeightsBounds"],
                           "dimensionDelta": [final["defaultWeightsBounds"]["dimensions"][axis] - baseline["defaultWeightsBounds"]["dimensions"][axis]
                                              for axis in range(3)]},
        "morphEnvelope": {"baseline": baseline["morphEnvelopeBounds"], "final": final["morphEnvelopeBounds"],
                          "dimensionDelta": [final["morphEnvelopeBounds"]["dimensions"][axis] - baseline["morphEnvelopeBounds"]["dimensions"][axis]
                                             for axis in range(3)]},
    }
    return {
        "status": "PASS" if not failures else "FAIL",
        "hierarchyMatchesBaseline": hierarchy_match,
        "root": {"name": root_name, "matchesBaseline": root_match, "identityTRS": root_identity,
                 "transform": root["localTransform"] if root else None},
        "transformChangesFromBaseline": _transform_changes(baseline, final),
        "units": final["units"],
        "bounds": bounds,
        "topology": {"fixedTriangleConnectivityMatchesBaseline": connectivity_match,
                     "differentMeshes": connectivity_differences},
        "budgets": {"triangleCount": final["triangleCount"], "triangleLimit": 24000,
                    "drawCalls": final["drawCalls"], "drawCallRange": [8, 10]},
        "failures": failures,
    }


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise VerificationError(f"cannot read JSON evidence: {path}: {error}") from error
    if not isinstance(value, dict):
        raise VerificationError(f"JSON evidence must be an object: {path}")
    return value


def _file_identity(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise VerificationError(f"required artifact is missing: {path}")
    raw = path.read_bytes()
    return {"path": str(path.resolve()), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def _verify_component_asset(report: dict[str, Any], label: str, expected_sha256: str) -> None:
    candidates = [report.get("glbSha256"), report.get("glb", {}).get("sha256") if isinstance(report.get("glb"), dict) else None]
    if label == "viewer":
        candidates.append(report.get("asset", {}).get("sha256"))
    if label == "render":
        candidates.append(report.get("after", {}).get("sha256"))
    if expected_sha256 not in candidates:
        raise VerificationError(f"{label} evidence does not identify the final GLB SHA-256")


def _validate_maturation_contract(contract: dict[str, Any]) -> dict[str, Any]:
    if (contract.get("schemaVersion") != 1 or contract.get("clip") != "Growth"
            or contract.get("durationSeconds") != 9.0 or contract.get("colorSpace") != "linear-sRGB"):
        raise VerificationError("maturation metadata has an incompatible schema, clip, duration, or color space")
    sampling = contract.get("sampling", {})
    if (sampling.get("mode") != "absolute-clip-time" or sampling.get("interpolation") != "piecewise-linear"
            or sampling.get("nonGrowth") != "mature" or sampling.get("crossfade", {}).get("durationSeconds") != 0.25):
        raise VerificationError("maturation metadata does not satisfy the absolute-time/mature/crossfade contract")
    factors = contract.get("materialFactors")
    if not isinstance(factors, list) or {item.get("material") for item in factors} != {"Petal_Pearl", "Petal_Outside"}:
        raise VerificationError("maturation metadata must contain both named petal materials")
    expected_times = [0.0, 4.5, 6.75, 9.0]
    for item in factors:
        keyframes = item.get("keyframes", [])
        if [float(frame.get("timeSeconds", -1)) for frame in keyframes] != expected_times:
            raise VerificationError(f"{item.get('material')} metadata sample times do not match the contract")
        for frame in keyframes:
            rgb = frame.get("linearSrgbFactor", [])
            if len(rgb) != 3 or not all(math.isfinite(float(value)) and 0.0 <= float(value) <= 1.0 for value in rgb):
                raise VerificationError(f"{item.get('material')} metadata contains an invalid linear-sRGB factor")
    return {"schemaVersion": contract["schemaVersion"], "clip": contract["clip"],
            "durationSeconds": contract["durationSeconds"], "colorSpace": contract["colorSpace"],
            "sampling": sampling, "materialFactors": factors}


def _validate_viewer_report(report: dict[str, Any], final_asset: dict[str, Any]) -> dict[str, Any]:
    require_pass_report(report, "actual GLB viewer")
    _verify_component_asset(report, "viewer", final_asset["sha256"])
    if report.get("pageErrors"):
        raise VerificationError(f"actual GLB viewer reported page errors: {report['pageErrors'][:3]!r}")
    webgl = report.get("webgl", {})
    if not webgl.get("webgl2"):
        raise VerificationError("actual GLB viewer did not use WebGL2")
    animation = report.get("animations", {})
    if animation.get("durationsSeconds") != CLIP_DURATIONS:
        raise VerificationError("actual GLB viewer animation durations differ from the six-clip contract")
    boundaries = animation.get("boundaryMaxDeltaMeters", {})
    if len(boundaries) != 5 or any(not math.isfinite(float(value)) or float(value) > 1e-5 for value in boundaries.values()):
        raise VerificationError("actual GLB viewer boundary evidence is missing or over tolerance")
    idle = animation.get("idleLoopMaxDeltaMeters", {})
    if not {"IdleClosed", "IdleOpen", "DissolveReady"}.issubset(idle) or any(float(value) > 1e-5 for value in idle.values()):
        raise VerificationError("actual GLB viewer idle-loop evidence is missing or over tolerance")
    crossfades = report.get("crossfadeTests", {})
    if crossfades.get("durationSeconds") != 0.25 or crossfades.get("phasesSeconds") != [2, 6]:
        raise VerificationError("actual GLB viewer did not test the required 0.25s arbitrary-phase crossfades")
    crossfade_rows = [value for key, value in crossfades.items() if isinstance(value, dict)]
    if len(crossfade_rows) != 4 or any(float(row.get("initialJumpMeters", math.inf)) > 1e-5 for row in crossfade_rows):
        raise VerificationError("actual GLB viewer crossfade tests are incomplete or jump at transition start")
    if animation.get("renderCalls") != final_asset["drawCalls"] or animation.get("renderedTriangles") != final_asset["triangleCount"]:
        raise VerificationError("actual viewer draw/triangle observations differ from the exported GLB summary")
    return {"webgl": webgl, "animations": animation, "crossfadeTests": crossfades,
            "pageErrors": report.get("pageErrors", [])}


def _verify_image_record(record: dict[str, Any], root: Path, label: str) -> dict[str, Any]:
    path = Path(record.get("path", "")).resolve()
    try:
        path.relative_to(root)
    except ValueError as error:
        raise VerificationError(f"{label} image escapes refinement_03: {path}") from error
    identity = _file_identity(path)
    if record.get("bytes") != identity["bytes"] or record.get("sha256") != identity["sha256"]:
        raise VerificationError(f"{label} image bytes or hash do not match its report")
    return identity


def _validate_render_report(report: dict[str, Any], root: Path, baseline: dict[str, Any],
                            final_asset: dict[str, Any], contract: dict[str, Any]) -> dict[str, Any]:
    require_pass_report(report, "comparison render")
    _verify_component_asset(report, "render", final_asset["sha256"])
    if report.get("before", {}).get("sha256") != baseline["sha256"]:
        raise VerificationError("comparison render did not use the v13 baseline GLB")
    if len(report.get("checkpoints", [])) != 4:
        raise VerificationError("comparison render must include four before/after checkpoints")
    image_identities = []
    expected_checkpoints = [
        ("Growth", "end", 16.0, 9.0), ("Bloom", "start", 0.0, 0.0),
        ("Bloom", "mid", 8.0, 4.0), ("Bloom", "end", 16.0, 8.0),
    ]
    for row, expected in zip(report["checkpoints"], expected_checkpoints):
        actual = (row.get("clip"), row.get("label"), row.get("beforeSeconds"), row.get("afterSeconds"))
        if actual != expected:
            raise VerificationError(f"comparison checkpoint differs from the contract: {actual!r}")
        for side in ("before", "after"):
            image_identities.append(_verify_image_record(row[side], root, f"{row['clip']} {row['label']} {side}"))
    color = report.get("colorMetadata", {})
    if "mature" not in color.get("plainGLTFLoaderDefault", "").lower():
        raise VerificationError("comparison report must state that a plain GLTFLoader defaults to mature colors")
    samples = color.get("samples", [])
    if [(item.get("label"), item.get("absoluteSeconds")) for item in samples] != [("young", 0.0), ("mature", 9.0)]:
        raise VerificationError("comparison report lacks the young@0s/mature@9s metadata pair")
    expected_by_name = {item["material"]: item for item in contract["materialFactors"]}
    for sample in samples:
        observed = sample.get("materialFactors", {})
        for name, expected in expected_by_name.items():
            expected_rgb = expected["keyframes"][0 if sample["label"] == "young" else -1]["linearSrgbFactor"]
            if observed.get(name) != expected_rgb:
                raise VerificationError(f"rendered metadata sample does not match {name} at {sample['label']}")
        image_identities.append(_verify_image_record(sample["image"], root, f"Growth {sample['label']} metadata"))
    if len(samples) != 2:
        raise VerificationError("comparison report must contain exactly two metadata color samples")
    sheet = report.get("contactSheet", {})
    image_identities.append(_verify_image_record(sheet, root, "comparison contact sheet"))
    return {"renderer": report.get("renderer"), "resolution": report.get("resolution"),
            "camera": report.get("camera"), "lighting": report.get("lighting"),
            "checkpoints": report["checkpoints"], "colorMetadata": color,
            "contactSheet": sheet, "verifiedImages": image_identities}


def build_final_report(args: argparse.Namespace) -> dict[str, Any]:
    root = args.root.resolve()
    output = args.report.resolve()
    try:
        output.relative_to(root)
    except ValueError as error:
        raise VerificationError("--report must stay inside refinement_03") from error
    paths = {name: (path if path.is_absolute() else root / path).resolve() for name, path in {
        "baseline": args.baseline_glb, "geometry": args.geometry_glb, "final": args.final_glb,
        "blend": args.final_blend, "geometryReport": args.geometry_report,
        "reimportReport": args.reimport_report, "viewerReport": args.viewer_report,
        "renderReport": args.render_report, "growthBvhReport": args.growth_bvh_report,
        "poseBoundsReport": args.pose_bounds_report, "maturation": args.maturation_json,
    }.items()}
    for label, path in paths.items():
        if label.endswith("Report") or label == "maturation":
            try:
                path.relative_to(root)
            except ValueError as error:
                raise VerificationError(f"{label} input must stay inside refinement_03") from error
    baseline = summarize_glb(paths["baseline"])
    geometry = summarize_glb(paths["geometry"])
    final_asset = summarize_glb(paths["final"])
    final_blend_identity = _file_identity(paths["blend"])
    component_reports = {
        "geometry": _read_json(paths["geometryReport"]),
        "reimport": _read_json(paths["reimportReport"]),
        "viewer": _read_json(paths["viewerReport"]),
        "render": _read_json(paths["renderReport"]),
        "growthBvh": _read_json(paths["growthBvhReport"]),
        "poseBounds": _read_json(paths["poseBoundsReport"]),
    }
    geometry_check = compare_asset_summaries(baseline, final_asset)
    material_preservation = compare_asset_summaries(geometry, final_asset)
    failures = geometry_check["failures"] + material_preservation["failures"]
    if material_preservation["transformChangesFromBaseline"]:
        failures.append({"error": "material stage changed geometry-stage local transforms"})
    for bound_name in ("worldBounds", "defaultWeightsBounds", "morphEnvelopeBounds"):
        for field in ("min", "max", "dimensions"):
            if any(abs(float(a) - float(b)) > 1e-5 for a, b in
                   zip(geometry[bound_name][field], final_asset[bound_name][field])):
                failures.append({"error": "material stage changed geometry-stage bounds", "bound": bound_name, "field": field})

    geometry_report = component_reports["geometry"]
    require_pass_report(geometry_report, "final geometry")
    _verify_component_asset(geometry_report, "geometry", final_asset["sha256"])
    if geometry_report.get("glb", {}).get("bytes") != final_asset["bytes"]:
        raise VerificationError("final geometry report has the wrong GLB byte count")
    boundaries = geometry_report.get("boundaries", [])
    if len(boundaries) != 5 or any(not item.get("pass") or float(item.get("max_vertex_delta_m", math.inf)) > 1e-5
                                  for item in boundaries):
        raise VerificationError("final geometry report has missing or failed clip boundaries")
    dense = geometry_report.get("dense_geometry", {})
    if (dense.get("frames_checked") != 410 or dense.get("normal_fold_events_outside_attachment") != 0
            or dense.get("temporal_normal_flip_events_outside_attachment") != 0
            or dense.get("intersection_events")):
        raise VerificationError("final geometry dense-frame normals/intersection evidence contains findings")

    reimport = component_reports["reimport"]
    require_pass_report(reimport, "final material reimport")
    _verify_component_asset(reimport, "reimport", final_asset["sha256"])
    imported_materials = reimport.get("importedMaterials", {})
    decoded_images = reimport.get("images", [])
    if len(imported_materials) != 6 or len(decoded_images) != 7 or any(
        not image.get("hasDataAfterPixelRead") or max(int(image.get("width", 0)), int(image.get("height", 0))) > 512
        for image in decoded_images
    ):
        raise VerificationError("final GLB material/embedded texture reimport evidence is incomplete")

    contract = _validate_maturation_contract(_read_json(paths["maturation"]))
    viewer = _validate_viewer_report(component_reports["viewer"], final_asset)
    rendered = _validate_render_report(component_reports["render"], root, baseline, final_asset, contract)
    growth_bvh = validate_growth_bvh_report(component_reports["growthBvh"], final_asset["sha256"])
    expected_hashes = {key: value["sha256"] for key, value in
                       (("baseline", baseline), ("geometry", geometry), ("final", final_asset))}
    poses = validate_pose_bounds_report(component_reports["poseBounds"], expected_hashes)
    base_pose = poses["assets"]["final"]["poses"]["base"]
    if any(abs(float(a) - float(b)) > 1e-5 for field in ("min", "max", "dimensions")
           for a, b in zip(base_pose[field], final_asset["defaultWeightsBounds"][field])):
        raise VerificationError("evaluated base pose disagrees with final GLB node.weights bounds")

    report = {
        "schemaVersion": 1,
        "status": "PASS" if not failures else "FAIL",
        "baseline": {key: baseline[key] for key in ("path", "bytes", "sha256", "worldBounds", "defaultWeightsBounds", "morphEnvelopeBounds", "triangleCount", "drawCalls")},
        "geometryStage": {key: geometry[key] for key in ("path", "bytes", "sha256", "worldBounds", "defaultWeightsBounds", "morphEnvelopeBounds", "triangleCount", "drawCalls")},
        "finalBlend": final_blend_identity,
        "finalGLB": {key: final_asset[key] for key in ("path", "bytes", "sha256", "nodeCount", "meshObjectCount", "triangleCount", "drawCalls", "sceneRoots", "worldBounds", "defaultWeightsBounds", "morphEnvelopeBounds")},
        "assetComparison": {"v13ToFinal": geometry_check, "geometryStageToFinal": material_preservation},
        "clipInventory": clip_inventory(read_glb(paths["final"])[0]),
        "geometryEvidence": {"boundaries": boundaries, "denseGeometry": dense},
        "materialReimport": {"materials": imported_materials, "decodedEmbeddedImages": decoded_images,
                              "rootMaturationExtra": reimport.get("rootMaturationExtra")},
        "viewerEvidence": viewer,
        "growthBvhEvidence": growth_bvh,
        "poseBoundsEvidence": poses,
        "renderEvidence": rendered,
        "maturationContract": contract,
        "knownLimitations": [
            "Physical iPad/Safari behavior and performance were not tested.",
            "Plain GLTFLoader consumers show the mature baked material; Growth coloration requires sampling bud_maturation.json by absolute clip time.",
        ],
        "failures": failures,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--baseline-glb", type=Path, default=Path("baseline/lily_004_animated.glb"))
    parser.add_argument("--geometry-glb", type=Path, default=Path("export/lily_004_geometry.glb"))
    parser.add_argument("--final-glb", type=Path, default=Path("export/lily_004_refined.glb"))
    parser.add_argument("--final-blend", type=Path, default=Path("source/lily_004_refined.blend"))
    parser.add_argument("--geometry-report", type=Path, default=Path("reports/final_geometry.json"))
    parser.add_argument("--reimport-report", type=Path, default=Path("reports/final_material_reimport.json"))
    parser.add_argument("--viewer-report", type=Path, default=Path("reports/final_viewer.json"))
    parser.add_argument("--render-report", type=Path, default=Path("reports/final_render_comparison.json"))
    parser.add_argument("--growth-bvh-report", type=Path, default=Path("reports/final_growth_bvh.json"))
    parser.add_argument("--pose-bounds-report", type=Path, default=Path("reports/final_pose_bounds.json"))
    parser.add_argument("--maturation-json", type=Path, default=Path("export/bud_maturation.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/final_verification.json"))
    parser.add_argument("--blender-evidence", action="store_true", help="generate Growth BVH and pose bounds with imported GLBs")
    raw_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(raw_args)
    try:
        _, args.root = resolve_output_root(__file__, args.root)
    except RuntimeError as error:
        parser.error(str(error))
    if not args.root.is_dir():
        parser.error(f"--root does not exist: {args.root}")
    if not args.report.is_absolute():
        args.report = args.root / args.report
    args.report = args.report.resolve()
    def resolve(value: Path) -> Path:
        return value.resolve() if value.is_absolute() else (args.root / value).resolve()
    args.baseline_glb = resolve(args.baseline_glb)
    args.geometry_glb = resolve(args.geometry_glb)
    args.final_glb = resolve(args.final_glb)
    args.final_blend = resolve(args.final_blend)
    args.geometry_report = resolve(args.geometry_report)
    args.reimport_report = resolve(args.reimport_report)
    args.viewer_report = resolve(args.viewer_report)
    args.render_report = resolve(args.render_report)
    args.growth_bvh_report = resolve(args.growth_bvh_report)
    args.pose_bounds_report = resolve(args.pose_bounds_report)
    args.maturation_json = resolve(args.maturation_json)
    if args.blender_evidence:
        outputs = {"Growth BVH report": args.growth_bvh_report, "pose bounds report": args.pose_bounds_report}
        inputs = (("baseline GLB", args.baseline_glb), ("geometry GLB", args.geometry_glb),
                  ("final GLB", args.final_glb), ("final blend", args.final_blend))
    else:
        outputs = {"final verification report": args.report}
        inputs = (("baseline GLB", args.baseline_glb), ("geometry GLB", args.geometry_glb),
                  ("final GLB", args.final_glb), ("final blend", args.final_blend),
                  ("geometry report", args.geometry_report), ("material reimport report", args.reimport_report),
                  ("viewer report", args.viewer_report), ("render report", args.render_report),
                  ("Growth BVH report", args.growth_bvh_report), ("pose bounds report", args.pose_bounds_report),
                  ("maturation JSON", args.maturation_json))
    try:
        validate_output_paths(args.root, outputs, inputs=inputs,
                              protected_roots=(args.root / "baseline", PRIMARY_ROOT))
    except RuntimeError as error:
        parser.error(str(error))
    return args


def main() -> int:
    args = _arguments()
    if args.blender_evidence:
        if bpy is None:
            raise VerificationError("--blender-evidence requires Blender 5.2")
        root = args.root
        def resolve(value: Path) -> Path:
            return value.resolve() if value.is_absolute() else (root / value).resolve()
        baseline = resolve(args.baseline_glb)
        geometry = resolve(args.geometry_glb)
        final_asset = resolve(args.final_glb)
        growth_report = resolve(args.growth_bvh_report)
        pose_report = resolve(args.pose_bounds_report)
        for output in (growth_report, pose_report):
            try:
                output.relative_to(root)
            except ValueError as error:
                raise VerificationError("Blender evidence reports must stay inside refinement_03") from error
        growth_bvh_glb(final_asset, growth_report)
        pose_bounds_glbs({"baseline": baseline, "geometry": geometry, "final": final_asset}, pose_report)
        print(f"FINAL_BLENDER_EVIDENCE PASS growth={growth_report} poses={pose_report}")
        return 0
    report = build_final_report(args)
    print(f"FINAL_VERIFY {report['status']} report={args.report} failures={len(report['failures'])}")
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
