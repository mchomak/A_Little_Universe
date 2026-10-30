# Lily 004 — final asset package

**Version:** 1.0 candidate, 2026-10-30
**Integration status:** **Not ready** — see [QA_REPORT.md](QA_REPORT.md).

## Files

- `export/lily_004_final.glb` — self-contained GLB candidate (1,732,192 bytes).
- `source/lily_004_final.blend` — editable final Blender file.
- `baseline/lily_004_animated_original.glb` — byte-identical backup of the original GLB; SHA-256 `8152f8094a30c3af6eee4ecbc8e94afb4c93536828ea1ea9d0f2f8349a143c`.
- `baseline/lily_004_v13_final_original.blend` — preserved v13 source used for reproducible export; SHA-256 `a6373f7395a9f3d46ef51bfb1eef9426efaae1d9a27182dfdb7333d0f3503e83`.
- `textures/` — source PNGs for the embedded final maps.
- `screenshots/` — Original/Final pairs at seven timeline states and two additional close-up pairs.
- `reports/` — glTF-Transform inspections, Khronos validator output, Blender reimport report, material/export manifest and GLTFLoader pose comparison.
- `scripts/` — export, validator, reimport and pose-check scripts.

The final GLB SHA-256 is `fbf63a526f4fd2cbbf04ee4dbc75e4b7de68f32b7b33131b5644845c56160202`.

## Model and animation

The selected base is Original v13. The geometry retains one lily, six petal-like lobes, central stamens with gold anthers, one curved stem and two asymmetric leaves. No Digital Peony geometry or deformation was carried into this asset.

Animation clip names and durations are preserved at 24 fps:

| Clip | Duration |
| --- | ---: |
| `Growth` | 16 s |
| `IdleClosed` | 8 s |
| `TouchResponse` | 2 s |
| `Bloom` | 16 s |
| `IdleOpen` | 8 s |
| `DissolveReady` | 1 s |

The GLB contains 7 mesh entries, 11,015 uploaded vertices, 57,564 render vertices and 19,188 triangles. Three.js creates 8 `Mesh` objects because `Flower_Details` has two material primitives. Stable Blender object names are `Lily_Root`, `Head_Root`, `Petals`, `Petals_Outside`, `Flower_Details`, `Stem`, `Leaf_A`, `Leaf_B` and `Calyx`. GLB mesh names are `Sphere.006`, `Cube.003`, `Petals_ResampledSource`, `Petals_OutsideMesh`, `Plane.011`, `Plane.012` and `Cube.002`. The two petal meshes contain the six-lobe flower surface; keep their names and hierarchy available to future scene 04 particle sampling.

## Materials and runtime

Six named non-metallic PBR materials preserve the pearl-white and pale-pink petals, green leaves and stem, warm gold anthers and ivory filaments. Four compact base-color PNGs and three roughness PNGs are embedded: petal maps are 512×512, leaf maps 256×512 and stem maps 128×512. The GLB has no normal maps, transmission or external texture dependencies. It uses standard glTF metallic-roughness materials, no extensions and no decoder requirement.

Use Three.js `GLTFLoader` and select clips by their names above. Provide a soft key, fill and rim light in the host scene; illumination is not baked into the asset. The dark-blue review page is a comparison preset, not a required runtime environment. The asset and review page were checked in desktop Chromium; physical iPad/Safari behavior and performance were not verified.

## Reproducible commands

Run from the project root in this worktree with Blender 5.2.3 and Node.js installed:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background '3D_models\production\lily_004\final_qa\baseline\lily_004_v13_final_original.blend' --python-exit-code 1 --python '3D_models\production\lily_004\final_qa\scripts\finalize_lily.py'
node '3D_models\production\lily_004\final_qa\scripts\validate_glb.cjs'
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python '3D_models\production\lily_004\final_qa\scripts\reimport_verify.py'
```

The Original/Final review page is `http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html`. The pose comparison helper `scripts/gltfloader_pose_compare.js` runs in that page's DevTools context after both variants load; it compares the real `GLTFLoader` poses and writes the JSON summary to `reports/gltfloader_pose_comparison.json`.
