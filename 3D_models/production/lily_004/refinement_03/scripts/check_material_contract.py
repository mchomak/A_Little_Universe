"""Read-only acceptance check for the GLB material maturation seam."""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total_length != len(data):
        raise ValueError(f"invalid GLB header: {path}")
    offset = 12
    document = None
    binary = b""
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset : offset + length]
        offset += length
        if kind == b"JSON":
            document = json.loads(chunk.decode("utf-8"))
        elif kind == b"BIN\x00":
            binary = chunk
    if document is None:
        raise ValueError("GLB has no JSON chunk")
    return document, binary


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_sampling_contract(sampling: dict) -> None:
    require(isinstance(sampling, dict), "sampling contract must be an object")
    require(sampling.get("mode") == "absolute-clip-time", "sampling must use absolute clip time")
    require(sampling.get("interpolation") == "piecewise-linear", "sampling interpolation must be explicit")
    require(sampling.get("nonGrowth") == "mature", "non-Growth clips must resolve to mature color")
    require(sampling.get("endpointClamping") is True, "Growth samples must clamp to the clip endpoints")
    require(
        sampling.get("formula") == "factor(t)=lerp(k[i].linearSrgbFactor,k[i+1].linearSrgbFactor,(clamp(t,0,9)-t[i])/(t[i+1]-t[i])); interpolate each RGB channel independently",
        "Growth sampling formula must linearly interpolate each channel with time clamped to [0,9]",
    )

    crossfade = sampling.get("crossfade")
    require(isinstance(crossfade, dict), "crossfade contract must be an object")
    require(crossfade.get("durationSeconds") == 0.25, "clip crossfade duration must be 0.25 seconds")
    require(crossfade.get("space") == "linear-sRGB", "crossfade must blend factors in linear-sRGB")
    require(
        crossfade.get("formula") == "lerp(sourceFactor,targetFactor,clamp(transitionElapsedSeconds/0.25,0,1))",
        "crossfade formula must clamp elapsed time over 0.25 seconds",
    )
    require(
        crossfade.get("sourceAndTarget") == "sample each clip at its absolute clip time; non-Growth clips use their mature factor",
        "crossfade endpoints must be sampled at absolute clip times with mature non-Growth colors",
    )
    require(
        crossfade.get("reverseScrub") == "recompute from source/target absolute clip times and transition elapsed time; do not accumulate frame deltas",
        "reverse scrub must recompute from absolute times without accumulating frame deltas",
    )


def embedded_png_dimensions(document: dict, binary: bytes) -> list[tuple[str, int, int]]:
    result = []
    for image in document.get("images", []):
        require("bufferView" in image, f"image is not embedded: {image.get('name', '<unnamed>')}")
        require(image.get("mimeType") == "image/png", f"unexpected image encoding: {image.get('mimeType')}")
        view = document["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        require(payload.startswith(b"\x89PNG\r\n\x1a\n"), "embedded image payload is not PNG")
        width, height = struct.unpack_from(">II", payload, 16)
        require(0 < width <= 512 and 0 < height <= 512, f"image exceeds 512px budget: {width}x{height}")
        result.append((image.get("name", "<unnamed>"), width, height))
    return result


def check(glb_path: Path, json_path: Path) -> None:
    document, binary = read_glb(glb_path)
    named_roots = [node for node in document.get("nodes", []) if node.get("name") == "Lily_Root"]
    require(len(named_roots) == 1, "expected one Lily_Root node")
    extras = named_roots[0].get("extras", {})
    require("ALU_budMaturation" in extras, "GLB Lily_Root extras missing ALU_budMaturation")
    require(json_path.is_file(), f"missing maturation sidecar: {json_path}")
    sidecar = json.loads(json_path.read_text(encoding="utf-8"))
    contract = extras["ALU_budMaturation"]
    require(isinstance(contract, dict), "GLB ALU_budMaturation must be a JSON object")
    require(contract == sidecar, "GLB extras and sidecar differ semantically")
    require(contract.get("schemaVersion") == 1, "unsupported maturation schemaVersion")
    require(contract.get("clip") == "Growth", "maturation clip must be Growth")
    require(contract.get("durationSeconds") == 9, "maturation duration must be 9 seconds")
    require(contract.get("colorSpace") == "linear-sRGB", "maturation factors must use linear-sRGB")
    sampling = contract.get("sampling", {})
    validate_sampling_contract(sampling)
    factors = contract.get("materialFactors", [])
    factor_names = {item.get("material") for item in factors}
    require(factor_names == {"Petal_Pearl", "Petal_Outside"}, f"unexpected animated materials: {factor_names}")

    materials = {item.get("name"): item for item in document.get("materials", [])}
    require(set(materials) == {"Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen", "Anther_SoftGold", "Filament_Ivory"}, "GLB material names do not match the lily contract")
    for name in ("Petal_Pearl", "Petal_Outside", "Leaf_SoftGreen", "Stem_SoftGreen"):
        pbr = materials[name].get("pbrMetallicRoughness", {})
        require("baseColorTexture" in pbr, f"base-color map missing: {name}")
        require("metallicRoughnessTexture" in pbr, f"roughness map missing: {name}")
        require(pbr.get("metallicFactor", 1) == 0, f"non-metal plant material must be non-metallic: {name}")
    gold_pbr = materials["Anther_SoftGold"].get("pbrMetallicRoughness", {})
    require(gold_pbr.get("metallicFactor", 1) == 0, "gold anther must remain a standard dielectric PBR material")
    require(abs(gold_pbr.get("roughnessFactor", 0) - 0.44) < 1e-6, "gold anther roughness was not exported")
    filament_pbr = materials["Filament_Ivory"].get("pbrMetallicRoughness", {})
    require(abs(filament_pbr.get("roughnessFactor", 0) - 0.52) < 1e-6, "filament roughness was not exported")
    for name in sorted(factor_names):
        material = materials.get(name)
        require(material is not None, f"GLB material missing: {name}")
        require(material.get("doubleSided", False) is False, f"paired petal surface must be one-sided: {name}")
        require(material.get("alphaMode", "OPAQUE") == "OPAQUE", f"material must be opaque: {name}")
        pbr = material.get("pbrMetallicRoughness", {})
        require(pbr.get("metallicFactor", 1) == 0, f"petal metallicFactor must be zero: {name}")
        require("baseColorTexture" in pbr, f"petal base-color texture missing: {name}")
        samples = next(item["keyframes"] for item in factors if item["material"] == name)
        times = [sample["timeSeconds"] for sample in samples]
        require(times[0] == 0 and times[-1] == 9 and times == sorted(set(times)), f"invalid keyframe times: {name}")
        require(all(len(sample["linearSrgbFactor"]) == 3 for sample in samples), f"invalid RGB factors: {name}")
        require(all(0 <= channel <= 1 for sample in samples for channel in sample["linearSrgbFactor"]), f"factor out of range: {name}")
        mature_factor = samples[-1]["linearSrgbFactor"]
        exported_factor = pbr.get("baseColorFactor", [1, 1, 1, 1])[:3]
        require(all(abs(actual - expected) < 1e-6 for actual, expected in zip(exported_factor, mature_factor)), f"GLB baseColorFactor does not match mature contract sample: {name}")

    require(materials["Leaf_SoftGreen"].get("doubleSided") is True, "thin leaf material must remain visible from both sides")
    for name in ("Stem_SoftGreen", "Anther_SoftGold", "Filament_Ivory"):
        require(materials[name].get("doubleSided", False) is False, f"closed-volume material should remain one-sided: {name}")

    require("KHR_animation_pointer" not in document.get("extensionsUsed", []), "contract must not depend on KHR_animation_pointer")
    image_sizes = embedded_png_dimensions(document, binary)
    require(image_sizes, "GLB must embed its material images")
    print(f"PASS: {glb_path.name}; {len(factors)} material curves; {len(image_sizes)} embedded PNGs <=512px")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path)
    args = parser.parse_args()
    json_path = args.json_path or args.glb.with_name("bud_maturation.json")
    try:
        check(args.glb, json_path)
    except (AssertionError, OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"FAIL: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
