# Lily 004 — final asset QA

**Date:** 2026-10-30
**Result:** **Not ready for main-site integration.** The GLB is technically loadable and animation-compatible, but the open flower still has large dark gaps and a low, plate-like front lobe. Geometry was deliberately kept identical to Original v13; resolving those visible problems would require a separate geometry decision.

## Selected source and deliverable

- Selected **Original v13**, not the Digital Peony experimental candidate. The earlier candidate changed the `Growth` and `Bloom` durations, while the visual experiment did not establish an improvement worth replacing the source.
- Original backup: `baseline/lily_004_animated_original.glb`, 1,592,136 bytes, SHA-256 `8152f8094a30c3af6eee4ecbc8e94afb4c93536828ea1ea9d0f2f8349a143c`.
- Matching editable v13 source copy: `baseline/lily_004_v13_final_original.blend`, SHA-256 `a6373f7395a9f3d46ef51bfb1eef9426efaae1d9a27182dfdb7333d0f3503e83`.
- Final candidate: `export/lily_004_final.glb`, 1,732,192 bytes, SHA-256 `fbf63a526f4fd2cbbf04ee4dbc75e4b7de68f32b7b33131b5644845c56160202`.
- Editable final: `source/lily_004_final.blend`.
- Re-exporting the saved v13 source with `scripts/finalize_lily.py` reproduced the same final GLB SHA-256. The original GLB remains unchanged.

The final file is 140,056 bytes (8.8%) larger than the source because it embeds added base-color and roughness maps. No mesh compression, joining, welding, simplification or animation compression was applied.

## Model, materials and animation

The geometry signature, mesh hierarchy, transforms, morph targets and NLA timing were preserved. The result has 7 GLB mesh entries, 11,015 uploaded vertices, 57,564 render vertices and 19,188 triangles. The flower retains six petal-like lobes, stamens and gold anthers, one curved stem and two asymmetric leaves.

Six named non-metallic materials use a pearl-white/pale-pink petal palette, subtle longitudinal veins and soft roughness variation; green stem/leaf maps and warm solid gold/ivory materials are also embedded. There are 7 PNG images total: four base-color maps and three roughness maps. There are no normal maps, external images, required glTF extensions or decoder dependencies. Surface improvement is visible in close-ups but remains modest; it does not change the silhouette or the dark shading in the open pose.

| Clip | Duration | Blender reimport | GLTFLoader |
| --- | ---: | --- | --- |
| `Growth` | 16 s | Pass | Sampled |
| `IdleClosed` | 8 s | Pass | Sampled |
| `TouchResponse` | 2 s | Pass | Sampled |
| `Bloom` | 16 s | Pass | 0/25/50/75/100% sampled |
| `IdleOpen` | 8 s | Pass | Sampled |
| `DissolveReady` | 1 s | Pass | Sampled |

## Verification

- `@gltf-transform/cli inspect` recorded the source and final inventories in `baseline/original-inspect.txt` and `reports/final-inspect.txt`.
- Khronos glTF Validator 2.0.0-dev.3.10: **0 errors, 0 warnings** on both files. Original has 6 informational findings; final has 4 (`UNUSED_OBJECT` ×2 and `NODE_EMPTY` ×2). Full output is `reports/validator-report.json`.
- Independent Blender import of the final GLB passed: 7 meshes, 11,015 uploaded vertices, 19,188 triangles, all six expected clips/durations, 7 decoded embedded images, and 0 malformed faces, degenerate triangles or non-finite positions/normals. See `reports/blender_reimport.json`.
- Existing review-page Three.js `GLTFLoader` compared 20 sampled poses across Original and Final. Every sample had 11,015 vertices; the maximum world-space difference was 0.0000437 m (0.044 mm), under the recorded 0.1 mm tolerance. Handoff seams `Growth→IdleClosed`, `IdleClosed→TouchResponse`, `TouchResponse→Bloom`, `Bloom→IdleOpen`, `IdleOpen→DissolveReady` and both idle loops measured 0 in the viewer check. See `reports/gltfloader_pose_comparison.json`.
- The review page loaded both files without browser console errors or warnings (desktop Chromium). The paired 1440×900 screenshots are in `screenshots/`; close-up 3/4-top pairs at Bloom 75% and 100% show the material, gaps, and stamens.
- Geometry review found 0 overlaps between different petal lobes at the sampled states. At Bloom 75% and 100%, the only reported stamen intersections were within the reviewer-excluded 2.5 cm basal zone; outside that zone there were 0. This check does not cover same-name inner/outer petal pairs, near contacts or intermediate frames.

## Remaining limits

- The open flower still has large dark gaps and a hanging front lobe that reads as a separate plate. These are inherited geometry/animation characteristics; this pass intentionally made no structural geometry change. **This blocks integration.**
- The BVH overlap check is limited to the listed sampled states and exclusions. Full collision/intersection proof is not available.
- Browser checks used desktop Chromium only. Physical iPad/Safari, frame rate, GPU memory, loading time and sustained performance are **Not verified**.
- Scene 04 dissolve behavior is not implemented or verified; stable mesh names and hierarchy were retained for future sampling.

The test page remains at `http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html`; use its **Original / Final** buttons with the existing clip selector and timeline. The asset is a reviewable final-material candidate, not approved for production integration.
