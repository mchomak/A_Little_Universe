# Lily 004 refinement — delivery handoff

## Candidate and provenance

The final candidate is `3D_models/production/lily_004/refinement_03/export/lily_004_refined.glb` (relative to the repository root) and `C:\Users\McHomak\.codex\worktrees\lily004-refinement\A_Little_Universe\3D_models\production\lily_004\refinement_03\export\lily_004_refined.glb` (absolute path). It is 2,560,052 bytes; SHA-256 `c6fd5311e45f9586efc491ea6870cc6ae4123999fd954b1a9a607927841c0d24`. The editable source is `source/lily_004_refined.blend` (5,116,583 bytes; SHA-256 `3f60ecbf59cbbf4095d73901069cb001418b3ad0f65bc2022f5c41217fc86f89`).

The source lineage is v13 final → v2_04m bloom → the saved copy of the live v2_04m state → geometry refinement → final material/color export. The saved v2_04m and its read-only live-session copy have matching mesh coordinates, actions, materials, and packed image content. The v13 GLB was retained as the visual baseline. The geometry pass restores the v13 absolute open pose while carrying the newer 04m growth/seam keys. Petal triangulation changes face diagonals only: each of `Petals` and `Petals_Outside` keeps 2,970 vertices, the six-island layout, and matching coordinates/UVs/animation, with 5,376 triangles per surface.

Read-only backup hashes are in `baseline/checksums.sha256`: v13 GLB `8152f8094a30c3af6eee4ecbcb8e94bafb4c93536828ea1ea9d0f2f8349a143c`, v13 blend `a6373f7395a9f3d46ef51bfb1eef9426efaae1d9a27182dfdb7333d0f3503e83`, and live v2_04m copy `e827b67680e57bc2e6344e03bf6d289c56e838acf5e0427e227ef6ea1efefc12`. The source v13 files and primary checkout were not overwritten.

## Transform, axes, and bounds

The final asset retains the 14-node hierarchy and identity `Lily_Root` transform (translation `[0,0,0]`, rotation identity, scale `[1,1,1]`). glTF uses Y-up; dimensions below are evaluated world-space bounds in meters after importing the GLB into Blender and converting its Z-up coordinates to glTF Y-up. `Growth@9s` and `IdleClosed@0s` match exactly: min `[-0.241161078, 0, -0.260460198]`, max `[0.432095021, 1.077999949, 0.240759879]`, dimensions `[0.673256099, 1.077999949, 0.501220077]`. `Bloom@8s` and `IdleOpen@0s` also match exactly: min `[-0.241161078, 0, -0.260460198]`, max `[0.432095021, 0.985752523, 0.412155688]`, dimensions `[0.673256099, 0.985752523, 0.672615886]`. The full base/default/morph-envelope and sampled pose bounds are in `reports/final_pose_bounds.json`.

Geometry-stage and final material-stage node transforms and mesh connectivity match exactly. Relative to v13, three inherited child local translations differ: `Head_Root` `[0.09,0.823,0.18]`, `Leaf_A_Pivot` `[0.0248862,0.2069038,0.0164859]`, and `Leaf_B_Pivot` `[0.00959922,0.0553422,-0.0004869]`. These are local values carried through the 04m/geometry lineage, not world-space jumps; the final root remains identity.

## Animation and color contract

At 24 fps, exported clip names/durations are Growth 9 s, IdleClosed 8 s, TouchResponse 2 s, Bloom 8 s, IdleOpen 8 s, and DissolveReady 1 s. The v13 source had Growth/Bloom at 16 s; other source durations remain unchanged. Growth shows the sprout emerging and growing into a formed closed bud; IdleClosed holds that bud with subtle plant sway; TouchResponse briefly bends then settles to the closed pose; Bloom opens the outer and inner tepals in layers to reveal the anthers; IdleOpen holds the open flower with subtle sway; DissolveReady holds the open pose for the next scene and contains no dissolve effect. Growth→IdleClosed, IdleClosed→TouchResponse, TouchResponse→Bloom, Bloom→IdleOpen, and IdleOpen→DissolveReady have zero sampled endpoint vertex delta. IdleClosed and IdleOpen repeat; the other clips are one-shot/clamped. Arbitrary idle phases were tested with a 0.25 s crossfade and zero initial positional jump. See `reports/final_geometry.json` and `reports/final_viewer.json` for sample counts and measured steps.

`export/bud_maturation.json` and `Lily_Root.extras.ALU_budMaturation` define schema 1: `Growth`, 9 s, linear-sRGB, absolute clip-time samples, piecewise-linear per-channel interpolation, and endpoint clamping. `Petal_Pearl` RGB factors are 0 s `[0.20,0.47,0.20]`, 4.5 s `[0.38,0.59,0.31]`, 6.75 s `[0.83,0.79,0.70]`, and 9 s `[1,1,1]`. `Petal_Outside` factors are 0 s `[0.20,0.47,0.20]`, 4.5 s `[0.38,0.59,0.31]`, 6.75 s `[0.82,0.80,0.74]`, and 9 s `[1,1,1]`. Non-Growth clips use the mature factor. A 0.25 s transition blends in linear-sRGB; reverse scrubbing recomputes source/target factors from absolute clip times rather than accumulating frame deltas. A stock GLTFLoader shows the mature baked maps unless runtime code consumes this metadata. This delivery does not include that runtime integration.

## Mesh, morph, and texture budgets

The final GLB contains 11,015 vertices across 7 meshes, 19,188 triangles, and 8 draw calls. Its 38 morph targets are 16 on each tepal mesh (`Closed_01`–`Closed_06`, `TipCurl`, `TipArc`, `SeamClear_01`–`SeamClear_06`, `TipUnfurl`, `GrowthBudForm`), one `YoungFolded` target on each leaf, and four on `Stem` (`Sprout`, `EarlyShoot`, `MidShoot`, `Sway`).

The 7 embedded maps total 1,179,648 texels (two 256×512 leaf maps, three 512×512 petal maps, and two 128×512 stem maps). Assuming decoded RGBA8, base-level storage is 4.5 MiB; a full mip chain estimates about 6 MiB. Dense decoded float32 POSITION/NORMAL/TANGENT morph-target arrays estimate 2,363,472 bytes (about 2.25 MiB). These estimates state format and mip assumptions; actual GPU/driver allocation varies. The measured asset budgets are not an FPS or physical iPad/Safari performance claim.

## Verification and review files

`reports/final_geometry.json`, `final_material_reimport.json`, `final_viewer.json`, `final_growth_bvh.json`, `final_pose_bounds.json`, `final_render_comparison.json`, and `final_verification.json` record the checks against the frozen final GLB. Blender reimport decoded all 7 embedded images. The final GLB has 19,188 triangles and 8 render calls. Growth BVH evidence covers 217 frames, six islands × 896 triangles, with zero outside-root intersection events. The saved `final_viewer.json` is the automated isolated Playwright run at its recorded URL (`5183`), bound to the same frozen GLB hash; the current root CUA acceptance checked the stock viewer on port `5190` and is recorded separately in the task acceptance review.

`screenshots/comparison/` contains identical-camera before/after images for Growth end (v13 16 s / final 9 s), Bloom start (0 / 0 s), midpoint (8 / 4 s), and end (16 / 8 s), plus the metadata young/mature comparison at one fixed final `Growth@9s` pose and the contact sheet. The report labels that pair as color-only and records both metadata sample times. Both GLBs use one orthographic camera (`orthoScale=1.25`, elevation 25.65°) and the same lights. `screenshots/final_viewer.png` is the browser capture. The existing stock viewer HTML/JS copies remain byte-identical to production. Its virtual legacy URL `/export/lily_004_animated.glb` served the frozen final candidate during inspection; no viewer or frontend source was edited.

The accepted T01 clay-only shape review is linked here: [closed front](screenshots/geometry_after_clay_detail_front_0_00.png), [Bloom at 1.01 s, front](screenshots/geometry_after_clay_detail_front_1_01.png), [Bloom at 2.04 s, three-quarter](screenshots/geometry_after_clay_detail_three_quarter_2_04.png), and full-bloom [front](screenshots/geometry_after_clay_detail_front_4_08.png), [three-quarter](screenshots/geometry_after_clay_detail_three_quarter_4_08.png), and [side](screenshots/geometry_after_clay_detail_side_4_08.png). These are geometry-only evidence for the tepal cup/seams; they do not represent final PBR appearance. T01 accepted this geometry review in the canonical [acceptance-01 record](../../../../.autopilot/2026-10-29-lily004-refinement/acceptance-01.md).

## Changed deliverables

- Final source/export: `source/lily_004_refined.blend`, `export/lily_004_refined.glb`, and `export/bud_maturation.json`.
- Verification/render implementation and focused tests: `scripts/verify_final.py`, `scripts/test_verify_final.py`, `scripts/render_comparison.py`, and `scripts/test_render_comparison.py`.
- Reports: `reports/final_geometry.json`, `final_material_reimport.json`, `final_viewer.json`, `final_growth_bvh.json`, `final_pose_bounds.json`, `final_render_comparison.json`, and `final_verification.json`.
- Comparison and accepted geometry images: `screenshots/comparison/growth_end_{before,after}.png`, `bloom_{start,mid,end}_{before,after}.png`, `growth_{young,mature}_metadata.png`, `comparison_sheet.png`, the six linked clay images above, and `screenshots/final_viewer.png`.
- Notices and handoff: `license/ATTRIBUTION.md`, `license/74582 - White lily - License.html`, `license/preview_74582.jpg`, `README.md`, and `HANDOFF.md`.

### Reproduction commands

Run from the repository root with Blender 5.2.3 LTS, the host Python recorded in the project instructions, and the installed Three.js 0.186.1 viewer dependencies. The first two commands reproduce the 01 geometry-stage and 02 material-stage assembly that produced the final asset. Subsequent Blender commands generate `final_geometry.json`, decoded-material evidence, pose bounds, Growth BVH evidence, and the comparison images. The host Python runs the contract check, aggregate, and tests. The saved browser report is an automated isolated Playwright capture; current root UI acceptance used the same stock viewer at port 5190. The physical iPad/Safari check remains unperformed.

```powershell
$AssetRoot = (Resolve-Path '3D_models/production/lily_004/refinement_03').Path
$BlenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$HostPython = 'C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe'
$ThreeRoot = (Resolve-Path 'frontend/node_modules/three').Path

# 01: create geometry-stage blend/GLB from the saved v2_04m backup.
& $BlenderExe --background "$AssetRoot/baseline/live_v2_04m_unsaved.blend" --python-exit-code 1 --python "$AssetRoot/scripts/refine_geometry_animation.py" -- --output-root "$AssetRoot" --render-mode none

# 02 + 03 assembly: apply the material contract to the geometry-stage source.
& $BlenderExe --background "$AssetRoot/source/lily_004_geometry.blend" --python-exit-code 1 --python "$AssetRoot/scripts/refine_materials.py" -- --output-root "$AssetRoot" --name lily_004_refined
& $HostPython "$AssetRoot/scripts/check_material_contract.py" "$AssetRoot/export/lily_004_refined.glb" --json "$AssetRoot/export/bud_maturation.json"

# Generate the final geometry, decoded PBR reimport, evaluated pose, and BVH evidence.
& $BlenderExe --background "$AssetRoot/source/lily_004_refined.blend" --python-exit-code 1 --python "$AssetRoot/scripts/verify_geometry.py" -- --output-root "$AssetRoot" --glb "$AssetRoot/export/lily_004_refined.glb" --report reports/final_geometry.json
& $BlenderExe --background --factory-startup --python-exit-code 1 --python "$AssetRoot/scripts/check_material_reimport.py" -- --glb "$AssetRoot/export/lily_004_refined.glb" --report "$AssetRoot/reports/final_material_reimport.json"
& $BlenderExe --background --factory-startup --python-exit-code 1 --python "$AssetRoot/scripts/verify_final.py" -- --root "$AssetRoot" --baseline-glb "$AssetRoot/baseline/lily_004_animated.glb" --geometry-glb "$AssetRoot/export/lily_004_geometry.glb" --final-glb "$AssetRoot/export/lily_004_refined.glb" --blender-evidence --growth-bvh-report "$AssetRoot/reports/final_growth_bvh.json" --pose-bounds-report "$AssetRoot/reports/final_pose_bounds.json"

# Render comparisons in Blender, with explicit absolute input/output paths.
& $BlenderExe --background --factory-startup --python-exit-code 1 --python "$AssetRoot/scripts/render_comparison.py" -- --baseline-glb "$AssetRoot/baseline/lily_004_animated.glb" --final-glb "$AssetRoot/export/lily_004_refined.glb" --maturation-json "$AssetRoot/export/bud_maturation.json" --output-root "$AssetRoot" --report "$AssetRoot/reports/final_render_comparison.json"

# Verify adapter routes; omit --check-only to serve the stock viewer in a terminal.
& $HostPython "$AssetRoot/scripts/material_viewer_adapter.py" --asset "$AssetRoot/export/lily_004_refined.glb" --three-root "$ThreeRoot" --port 5190 --check-only
# In a separate terminal, run that same adapter command without --check-only,
# then open http://127.0.0.1:5190/scripts/viewer.html?asset=final in the browser.

# Aggregate and host checks.
& $HostPython "$AssetRoot/scripts/verify_final.py" --root "$AssetRoot"
Push-Location "$AssetRoot/scripts"
& $HostPython -m unittest test_verify_final test_render_comparison test_geometry_path_safety test_material_contract test_material_reimport_safety test_material_viewer_adapter test_refine_materials_petal_pairing
Pop-Location
```

The documented host command runs 39 tests across the 7 host-safe modules; four bpy-dependent test modules are run under Blender rather than host Python. Root's Blender evidence and aggregate checks pass; `reports/final_verification.json` reports `PASS` with no failures. The adapter's check-only command verifies hashes/routes and is not a substitute for opening the viewer. `reports/final_viewer.json` preserves its original automated run URL and exact asset SHA; the root's later port-5190 CUA review is separately recorded. None of these checks measures physical iPad/Safari performance.

## Safe transfer, rollback, and limitations

For a code-track integration, transfer only the approved final GLB and `export/bud_maturation.json` as assets; have a separate runtime change explicitly implement the metadata contract. Do not merge this asset worktree into the code branch or change the legacy source/runtime/viewer as part of this delivery. Before transfer, verify the GLB SHA-256 above. To roll back an integrated candidate, restore the original v13 GLB from `baseline/lily_004_animated.glb` after confirming its recorded hash `8152f8094a30c3af6eee4ecbcb8e94bafb4c93536828ea1ea9d0f2f8349a143c`; that backup is unchanged.

Attribution: “White lily” by Nmn9, Blend Swap model 74582, CC BY 3.0. Modifications include isolated/reconstructed elements, geometry/material changes, and added deformation/animation. The original `ATTRIBUTION.md`, license HTML, and preview JPG are copied under `license/`; include the attribution, source/license links, and modification note in site credits only when the asset is integrated. Physical iPad/Safari performance remains unverified; the measured triangle/texture/draw-call budgets are not an FPS guarantee.
