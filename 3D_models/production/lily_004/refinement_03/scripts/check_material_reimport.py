"""Reimport a material-study GLB in Blender and force every image pixel decode."""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_MATERIALS = {
    "Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen",
    "Anther_SoftGold", "Filament_Ivory",
}
TEXTURED_MATERIALS = {"Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def parse_args() -> tuple[Path, Path]:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--glb", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(argv)
    glb = args.glb.resolve()
    report = args.report.resolve()
    if not glb.is_file():
        parser.error(f"--glb does not exist: {glb}")
    try:
        report.relative_to(ROOT)
    except ValueError:
        parser.error(f"--report must remain inside {ROOT}")
    if report == ROOT / "baseline" or ROOT / "baseline" in report.parents:
        parser.error("--report may not target the read-only baseline")
    if report == glb or report in glb.parents or glb in report.parents:
        parser.error("--report path may not overlap the read-only --glb input")
    return glb, report


def main() -> None:
    glb_path, report_path = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    materials = {material.name: material for material in bpy.data.materials}
    require(set(materials) == EXPECTED_MATERIALS, f"unexpected imported materials: {sorted(materials)}")
    for name, material in materials.items():
        require(material.use_nodes, f"imported material has no PBR nodes: {name}")
        shaders = [node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"]
        require(len(shaders) == 1, f"expected one Principled shader: {name}")
        shader = shaders[0]
        require(abs(float(shader.inputs["Metallic"].default_value)) < 1e-6, f"nonzero metallic after GLB reimport: {name}")
        require(abs(float(shader.inputs["Alpha"].default_value) - 1.0) < 1e-6, f"non-opaque shader after GLB reimport: {name}")
        image_nodes = [node for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image]
        if name in TEXTURED_MATERIALS:
            require(len(image_nodes) >= 2, f"base color/roughness maps missing after reimport: {name}")
        else:
            require(not image_nodes, f"unexpected texture dependency on detail material: {name}")

    for name in ("Petal_Pearl", "Petal_Outside", "Stem_SoftGreen", "Anther_SoftGold", "Filament_Ivory"):
        require(materials[name].use_backface_culling, f"one-sided GLB material lost backface culling: {name}")
    require(not materials["Leaf_SoftGreen"].use_backface_culling, "thin leaf material must remain double-sided after reimport")

    expected_objects = {"Lily_Root", "Petals", "Petals_Outside", "Stem", "Leaf_A", "Leaf_B", "Calyx", "Flower_Details"}
    imported_objects = set(bpy.data.objects.keys())
    missing_objects = expected_objects - imported_objects
    require(not missing_objects, f"required lily objects missing after GLB reimport: {sorted(missing_objects)}")
    inner, outer = bpy.data.objects["Petals"], bpy.data.objects["Petals_Outside"]
    require(len(inner.data.vertices) == len(outer.data.vertices), "paired exported petal surfaces have different vertex counts")
    require(len(inner.data.polygons) == len(outer.data.polygons), "paired exported petal surfaces have different face counts")
    max_vertex_gap = max(
        ((inner.matrix_world @ a.co) - (outer.matrix_world @ b.co)).length
        for a, b in zip(inner.data.vertices, outer.data.vertices)
    )
    require(max_vertex_gap <= 1e-8, f"exported paired petal surfaces are not coincident: {max_vertex_gap}")
    outer_faces = {tuple(sorted(face.vertices)): face for face in outer.data.polygons}
    inner_faces = {tuple(sorted(face.vertices)): face for face in inner.data.polygons}
    require(len(outer_faces) == len(outer.data.polygons) and len(inner_faces) == len(inner.data.polygons), "exported petal mesh contains duplicate face signatures")
    require(inner_faces.keys() == outer_faces.keys(), "exported paired petal surfaces have different triangulated topology")
    inner_normal_matrix = inner.matrix_world.to_3x3().inverted().transposed()
    outer_normal_matrix = outer.matrix_world.to_3x3().inverted().transposed()
    normal_dots = []
    for face_key, inner_face in inner_faces.items():
        inner_normal = inner_normal_matrix @ inner_face.normal
        outer_normal = outer_normal_matrix @ outer_faces[face_key].normal
        inner_normal.normalize()
        outer_normal.normalize()
        normal_dots.append(inner_normal.dot(outer_normal))
    require(min(normal_dots) <= -0.999 and max(normal_dots) <= -0.999, "exported paired petal surfaces lost their complementary opposite normals")
    root_extra = bpy.data.objects["Lily_Root"].get("ALU_budMaturation")
    require(root_extra is not None and hasattr(root_extra, "keys"), "ALU_budMaturation root extra was not reimported as an object")
    require(root_extra.get("schemaVersion") == 1 and root_extra.get("clip") == "Growth", "reimported maturation extra has an invalid contract header")
    require(root_extra.get("durationSeconds") == 9.0 and root_extra.get("colorSpace") == "linear-sRGB", "reimported maturation extra has an invalid sampling range/color space")

    image_records = []
    for image in bpy.data.images:
        width, height = (int(size) for size in image.size[:])
        require(0 < width <= 512 and 0 < height <= 512, f"imported image exceeds 512px budget: {image.name} {width}x{height}")
        # Blender's GLB importer may leave image storage lazy until pixels are read.
        pixels = image.pixels[:]
        require(image.has_data, f"image pixels stayed lazy after access: {image.name}")
        require(len(pixels) == width * height * 4, f"decoded pixel count mismatch: {image.name}")
        require(all(math.isfinite(float(value)) for value in pixels), f"non-finite pixel data: {image.name}")
        require(any(float(value) > 0.0 for value in pixels), f"decoded image is unexpectedly blank: {image.name}")
        image_records.append({
            "name": image.name,
            "width": width,
            "height": height,
            "hasDataAfterPixelRead": bool(image.has_data),
            "decodedFloatCount": len(pixels),
        })
    require(len(image_records) == 7, f"expected 7 embedded material images, imported {len(image_records)}")

    root_extra_summary = {
        "schemaVersion": int(root_extra.get("schemaVersion")),
        "clip": str(root_extra.get("clip")),
        "durationSeconds": float(root_extra.get("durationSeconds")),
        "colorSpace": str(root_extra.get("colorSpace")),
        "materialNames": sorted(str(item.get("material")) for item in root_extra.get("materialFactors", [])),
    }
    report = {
        "schemaVersion": 1,
        "glb": str(glb_path),
        "glbBytes": glb_path.stat().st_size,
        "glbSha256": hashlib.sha256(glb_path.read_bytes()).hexdigest(),
        "importedObjects": sorted(imported_objects),
        "pairedPetalSurfaces": {
            "verticesPerSurface": len(inner.data.vertices),
            "facesPerSurface": len(inner.data.polygons),
            "maxCorrespondingVertexGap": max_vertex_gap,
            "normalDotRange": [min(normal_dots), max(normal_dots)],
            "complementaryOneSidedMaterials": True,
        },
        "importedMaterials": {
            name: {
                "doubleSided": not material.use_backface_culling,
                "metallic": float(next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED").inputs["Metallic"].default_value),
                "imageNodes": [node.image.name for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image],
            }
            for name, material in sorted(materials.items())
        },
        "images": image_records,
        "rootMaturationExtra": root_extra_summary,
        "result": "PASS",
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PASS: Blender GLB reimport; {len(materials)} materials; {len(image_records)} decoded embedded images")
    print(f"REPORT {report_path}")


if __name__ == "__main__":
    main()
