# Lily 004 baseline inventory

Read-only inventory from Blender 5.2.3 LTS. Source files and the live Blender session were not modified.

## Baseline recommendation

**Use `iteration_02/versions/lily_004_v2_04m_bloom.blend` as the refinement base** to stay consistent with the current front and three-quarter bloom screenshots. Preserve `versions/lily_004_v13_final.blend` and the exported animated GLB as comparison baselines. The v2_04m blend includes two leaf growth shape keys/actions and the additional petal seam-clearance/tip-unfurl keys visible in the newer iteration. This is a screenshot-continuity choice: the existing STATUS_V2 report describes v2_04m as an intermediate checkpoint whose bloom artistic acceptance remains open.

Screenshots: `iteration_02/screenshots/v2_04m_bloom_front.png` and `iteration_02/screenshots/v2_04m_bloom_three_quarter.png`.

## v13 final blend

- Scene: 1–1305 at 24 fps; 14 objects, 36 actions, 6 materials.
- Mesh totals: 10357 vertices, 19998 edges, 9682 faces (19188 fan-estimated triangles); 1444 boundary edges, 1444 non-manifold edges.

| Mesh | Dimensions (m) | V / E / F | Shape keys | Materials |
|---|---:|---:|---|---|
| `Calyx` | 0.0240 × 0.0240 × 0.0180 | 114 / 240 / 128 | — | Stem_SoftGreen |
| `Flower_Details` | 0.1068 × 0.0900 × 0.1632 | 2825 / 5616 / 2816 | — | Anther_SoftGold, Filament_Ivory |
| `Leaf_A` | 0.0581 × 0.4705 × 0.2447 | 425 / 808 / 384 | — | Leaf_SoftGreen |
| `Leaf_B` | 0.0520 × 0.4211 × 0.2190 | 425 / 808 / 384 | — | Leaf_SoftGreen |
| `Petals` | 0.4502 × 0.4727 × 0.1580 | 2970 / 5652 / 2688 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc | Petal_Pearl |
| `Petals_Outside` | 0.4502 × 0.4727 × 0.1580 | 2970 / 5652 / 2688 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc | Petal_Outside |
| `Stem` | 0.1085 × 0.2097 × 0.8230 | 628 / 1222 / 594 | Basis, Sprout, EarlyShoot, MidShoot, Sway | Stem_SoftGreen |

### Animation and action paths

- `Flower_Interior` (object): Growth: Growth→Growth__Flower_Interior [1–385]; IdleClosed: IdleClosed→IdleClosed__Flower_Interior [401–593]; TouchResponse: TouchResponse→TouchResponse__Flower_Interior [609–657]; Bloom: Bloom→Bloom__Flower_Interior [673–1057]; IdleOpen: IdleOpen→IdleOpen__Flower_Interior [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Flower_Interior [1281–1305]
- `Head_Root` (object): Growth: Growth→Growth__Head_Root [1–385]; IdleClosed: IdleClosed→IdleClosed__Head_Root [401–593]; TouchResponse: TouchResponse→TouchResponse__Head_Root [609–657]; Bloom: Bloom→Bloom__Head_Root [673–1057]; IdleOpen: IdleOpen→IdleOpen__Head_Root [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Head_Root [1281–1305]
- `Leaf_A_Pivot` (object): Growth: Growth→Growth__Leaf_A_Pivot [1–385]; IdleClosed: IdleClosed→IdleClosed__Leaf_A_Pivot [401–593]; TouchResponse: TouchResponse→TouchResponse__Leaf_A_Pivot [609–657]; Bloom: Bloom→Bloom__Leaf_A_Pivot [673–1057]; IdleOpen: IdleOpen→IdleOpen__Leaf_A_Pivot [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Leaf_A_Pivot [1281–1305]
- `Leaf_B_Pivot` (object): Growth: Growth→Growth__Leaf_B_Pivot [1–385]; IdleClosed: IdleClosed→IdleClosed__Leaf_B_Pivot [401–593]; TouchResponse: TouchResponse→TouchResponse__Leaf_B_Pivot [609–657]; Bloom: Bloom→Bloom__Leaf_B_Pivot [673–1057]; IdleOpen: IdleOpen→IdleOpen__Leaf_B_Pivot [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Leaf_B_Pivot [1281–1305]
- `Petals` (shape keys): Growth: Growth→Growth__Key [1–385]; IdleClosed: IdleClosed→IdleClosed__Key [401–593]; TouchResponse: TouchResponse→TouchResponse__Key [609–657]; Bloom: Bloom→Bloom__Key [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key [1281–1305]
- `Petals_Outside` (shape keys): Growth: Growth→Growth__Key [1–385]; IdleClosed: IdleClosed→IdleClosed__Key [401–593]; TouchResponse: TouchResponse→TouchResponse__Key [609–657]; Bloom: Bloom→Bloom__Key [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key [1281–1305]
- `Stem` (shape keys): Growth: Growth→Growth__Key.001 [1–385]; IdleClosed: IdleClosed→IdleClosed__Key.001 [401–593]; TouchResponse: TouchResponse→TouchResponse__Key.001 [609–657]; Bloom: Bloom→Bloom__Key.001 [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key.001 [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key.001 [1281–1305]
- Action-layer data paths by slot:
  - `KEKey`: `key_blocks["Closed_01"].value`, `key_blocks["Closed_02"].value`, `key_blocks["Closed_03"].value`, `key_blocks["Closed_04"].value`, `key_blocks["Closed_05"].value`, `key_blocks["Closed_06"].value`, `key_blocks["TipArc"].value`, `key_blocks["TipCurl"].value`
  - `KEKey.001`: `key_blocks["EarlyShoot"].value`, `key_blocks["MidShoot"].value`, `key_blocks["Sprout"].value`, `key_blocks["Sway"].value`
  - `OBFlower_Interior`: `scale`
  - `OBHead_Root`: `location`, `rotation_euler`, `scale`
  - `OBLeaf_A_Pivot`: `location`, `rotation_euler`, `scale`
  - `OBLeaf_B_Pivot`: `location`, `rotation_euler`, `scale`
- Full per-action layer, strip, slot, NLA timing, and curve/keyframe counts are in `baseline_inventory.json`.

### Materials and images

- `Anther_SoftGold`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Filament_Ivory`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Leaf_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_leaf_base.png
- `Petal_Outside`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_outer.png
- `Petal_Pearl`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_base.png
- `Stem_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- Image `leaf.psd`: 2048 × 2048, packed=True, source exists=True.
- Image `lily_leaf_base.png`: 256 × 512, packed=True, source exists=True.
- Image `lily_petal_base.png`: 512 × 512, packed=True, source exists=True.
- Image `lily_petal_outer.png`: 512 × 512, packed=True, source exists=True.
- Image `render.jpg`: 1024 × 1024, packed=True, source exists=False.
- Some packed images keep source paths outside this worktree. Their packed image data is embedded in the blend/GLB, so a missing original path does not imply missing texture data.

## v2 04m bloom blend

- Scene: 1–1305 at 24 fps; 14 objects, 38 actions, 6 materials.
- Mesh totals: 10357 vertices, 19998 edges, 9682 faces (19188 fan-estimated triangles); 1444 boundary edges, 1444 non-manifold edges.

| Mesh | Dimensions (m) | V / E / F | Shape keys | Materials |
|---|---:|---:|---|---|
| `Calyx` | 0.0240 × 0.0240 × 0.0180 | 114 / 240 / 128 | — | Stem_SoftGreen |
| `Flower_Details` | 0.1068 × 0.0900 × 0.1632 | 2825 / 5616 / 2816 | — | Anther_SoftGold, Filament_Ivory |
| `Leaf_A` | 0.0581 × 0.4705 × 0.2447 | 425 / 808 / 384 | Basis, YoungFolded | Leaf_SoftGreen |
| `Leaf_B` | 0.0520 × 0.4211 × 0.2190 | 425 / 808 / 384 | Basis, YoungFolded | Leaf_SoftGreen |
| `Petals` | 0.4498 × 0.4727 × 0.1750 | 2970 / 5652 / 2688 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc, SeamClear_01, SeamClear_02, SeamClear_03, SeamClear_04, SeamClear_05, SeamClear_06, TipUnfurl | Petal_Pearl |
| `Petals_Outside` | 0.4498 × 0.4727 × 0.1750 | 2970 / 5652 / 2688 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc, SeamClear_01, SeamClear_02, SeamClear_03, SeamClear_04, SeamClear_05, SeamClear_06, TipUnfurl | Petal_Outside |
| `Stem` | 0.1085 × 0.2097 × 0.8230 | 628 / 1222 / 594 | Basis, Sprout, EarlyShoot, MidShoot, Sway | Stem_SoftGreen |

### Animation and action paths

- `Flower_Interior` (object): Growth: Growth→Growth__Flower_Interior [1–385]; IdleClosed: IdleClosed→IdleClosed__Flower_Interior [401–593]; TouchResponse: TouchResponse→TouchResponse__Flower_Interior [609–657]; Bloom: Bloom→Bloom__Flower_Interior [673–1057]; IdleOpen: IdleOpen→IdleOpen__Flower_Interior [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Flower_Interior [1281–1305]
- `Head_Root` (object): Growth: Growth→Growth__Head_Root [1–385]; IdleClosed: IdleClosed→IdleClosed__Head_Root [401–593]; TouchResponse: TouchResponse→TouchResponse__Head_Root [609–657]; Bloom: Bloom→Bloom__Head_Root [673–1057]; IdleOpen: IdleOpen→IdleOpen__Head_Root [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Head_Root [1281–1305]
- `Leaf_A` (shape keys): Growth: Growth→Growth__Leaf_A_YoungFolded [1–385]
- `Leaf_A_Pivot` (object): Growth: Growth→Growth__Leaf_A_Pivot [1–385]; IdleClosed: IdleClosed→IdleClosed__Leaf_A_Pivot [401–593]; TouchResponse: TouchResponse→TouchResponse__Leaf_A_Pivot [609–657]; Bloom: Bloom→Bloom__Leaf_A_Pivot [673–1057]; IdleOpen: IdleOpen→IdleOpen__Leaf_A_Pivot [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Leaf_A_Pivot [1281–1305]
- `Leaf_B` (shape keys): Growth: Growth→Growth__Leaf_B_YoungFolded [1–385]
- `Leaf_B_Pivot` (object): Growth: Growth→Growth__Leaf_B_Pivot [1–385]; IdleClosed: IdleClosed→IdleClosed__Leaf_B_Pivot [401–593]; TouchResponse: TouchResponse→TouchResponse__Leaf_B_Pivot [609–657]; Bloom: Bloom→Bloom__Leaf_B_Pivot [673–1057]; IdleOpen: IdleOpen→IdleOpen__Leaf_B_Pivot [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Leaf_B_Pivot [1281–1305]
- `Petals` (shape keys): Growth: Growth→Growth__Key [1–385]; IdleClosed: IdleClosed→IdleClosed__Key [401–593]; TouchResponse: TouchResponse→TouchResponse__Key [609–657]; Bloom: Bloom→Bloom__Key [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key [1281–1305]
- `Petals_Outside` (shape keys): Growth: Growth→Growth__Key [1–385]; IdleClosed: IdleClosed→IdleClosed__Key [401–593]; TouchResponse: TouchResponse→TouchResponse__Key [609–657]; Bloom: Bloom→Bloom__Key [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key [1281–1305]
- `Stem` (shape keys): Growth: Growth→Growth__Key.001 [1–385]; IdleClosed: IdleClosed→IdleClosed__Key.001 [401–593]; TouchResponse: TouchResponse→TouchResponse__Key.001 [609–657]; Bloom: Bloom→Bloom__Key.001 [673–1057]; IdleOpen: IdleOpen→IdleOpen__Key.001 [1073–1265]; DissolveReady: DissolveReady→DissolveReady__Key.001 [1281–1305]
- Action-layer data paths by slot:
  - `KEKey`: `key_blocks["Closed_01"].value`, `key_blocks["Closed_02"].value`, `key_blocks["Closed_03"].value`, `key_blocks["Closed_04"].value`, `key_blocks["Closed_05"].value`, `key_blocks["Closed_06"].value`, `key_blocks["SeamClear_01"].value`, `key_blocks["SeamClear_02"].value`, `key_blocks["SeamClear_03"].value`, `key_blocks["SeamClear_04"].value`, `key_blocks["SeamClear_05"].value`, `key_blocks["SeamClear_06"].value`, `key_blocks["TipArc"].value`, `key_blocks["TipCurl"].value`, `key_blocks["TipUnfurl"].value`
  - `KEKey.001`: `key_blocks["EarlyShoot"].value`, `key_blocks["MidShoot"].value`, `key_blocks["Sprout"].value`, `key_blocks["Sway"].value`
  - `KEKey.003`: `key_blocks["YoungFolded"].value`
  - `KEKey.004`: `key_blocks["YoungFolded"].value`
  - `OBFlower_Interior`: `scale`
  - `OBHead_Root`: `location`, `rotation_euler`, `scale`
  - `OBLeaf_A_Pivot`: `location`, `rotation_euler`, `scale`
  - `OBLeaf_B_Pivot`: `location`, `rotation_euler`, `scale`
- Full per-action layer, strip, slot, NLA timing, and curve/keyframe counts are in `baseline_inventory.json`.

### Materials and images

- `Anther_SoftGold`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Filament_Ivory`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Leaf_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_leaf_base.png
- `Petal_Outside`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_outer.png
- `Petal_Pearl`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_base.png
- `Stem_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- Image `leaf.psd`: 2048 × 2048, packed=True, source exists=False.
- Image `lily_leaf_base.png`: 256 × 512, packed=True, source exists=True.
- Image `lily_petal_base.png`: 512 × 512, packed=True, source exists=True.
- Image `lily_petal_outer.png`: 512 × 512, packed=True, source exists=True.
- Image `render.jpg`: 1024 × 1024, packed=True, source exists=False.
- Some packed images keep source paths outside this worktree. Their packed image data is embedded in the blend/GLB, so a missing original path does not imply missing texture data.

## v13 animated GLB import

- Scene: 1–250 at 24 fps; 14 objects, 6 actions, 6 materials.
- Mesh totals: 11015 vertices, 30136 edges, 19188 faces (19188 fan-estimated triangles); 2708 boundary edges, 2708 non-manifold edges.

| Mesh | Dimensions (m) | V / E / F | Shape keys | Materials |
|---|---:|---:|---|---|
| `Calyx` | 0.0001 × 0.0001 × 0.0001 | 151 / 374 / 224 | — | Stem_SoftGreen |
| `Flower_Details` | 0.0000 × 0.0000 × 0.0000 | 3427 / 8864 / 5488 | — | Anther_SoftGold, Filament_Ivory |
| `Leaf_A` | 0.0001 × 0.0005 × 0.0002 | 425 / 1192 / 768 | — | Leaf_SoftGreen |
| `Leaf_B` | 0.0001 × 0.0004 × 0.0002 | 425 / 1192 / 768 | — | Leaf_SoftGreen |
| `Petals` | 0.0008 × 0.0007 × 0.0015 | 2970 / 8340 / 5376 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc | Petal_Pearl |
| `Petals_Outside` | 0.0008 × 0.0007 × 0.0015 | 2970 / 8340 / 5376 | Basis, Closed_01, Closed_02, Closed_03, Closed_04, Closed_05, Closed_06, TipCurl, TipArc | Petal_Outside |
| `Stem` | 0.0055 × 0.0046 × 0.0181 | 647 / 1834 / 1188 | Basis, Sprout, EarlyShoot, MidShoot, Sway | Stem_SoftGreen |

### Animation and action paths

- `Flower_Interior` (object): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Head_Root` (object): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Leaf_A_Pivot` (object): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Leaf_B_Pivot` (object): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Petals` (shape keys): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Petals_Outside` (shape keys): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- `Stem` (shape keys): DissolveReady: DissolveReady→DissolveReady [1–25]; IdleOpen: IdleOpen→IdleOpen [1–193]; Bloom: Bloom→Bloom [1–385]; TouchResponse: TouchResponse→TouchResponse [1–49]; IdleClosed: IdleClosed→IdleClosed [1–193]; Growth: Growth→Growth [1–385]
- Action-layer data paths by slot:
  - `KEPetals`: `key_blocks["Closed_01"].value`, `key_blocks["Closed_02"].value`, `key_blocks["Closed_03"].value`, `key_blocks["Closed_04"].value`, `key_blocks["Closed_05"].value`, `key_blocks["Closed_06"].value`, `key_blocks["TipArc"].value`, `key_blocks["TipCurl"].value`
  - `KEPetals_Outside`: `key_blocks["Closed_01"].value`, `key_blocks["Closed_02"].value`, `key_blocks["Closed_03"].value`, `key_blocks["Closed_04"].value`, `key_blocks["Closed_05"].value`, `key_blocks["Closed_06"].value`, `key_blocks["TipArc"].value`, `key_blocks["TipCurl"].value`
  - `KEStem`: `key_blocks["EarlyShoot"].value`, `key_blocks["MidShoot"].value`, `key_blocks["Sprout"].value`, `key_blocks["Sway"].value`
  - `OBFlower_Interior`: `location`, `rotation_quaternion`, `scale`
  - `OBHead_Root`: `location`, `rotation_quaternion`, `scale`
  - `OBLeaf_A_Pivot`: `location`, `rotation_quaternion`, `scale`
  - `OBLeaf_B_Pivot`: `location`, `rotation_quaternion`, `scale`
- Full per-action layer, strip, slot, NLA timing, and curve/keyframe counts are in `baseline_inventory.json`.

### Materials and images

- `Anther_SoftGold`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Filament_Ivory`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- `Leaf_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_leaf_base
- `Petal_Outside`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_outer
- `Petal_Pearl`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL, TEX_IMAGE; images lily_petal_base
- `Stem_SoftGreen`: nodes BSDF_PRINCIPLED, OUTPUT_MATERIAL
- Image `lily_leaf_base`: 256 × 512, packed=True, source exists=False.
- Image `lily_petal_base`: 512 × 512, packed=True, source exists=False.
- Image `lily_petal_outer`: 512 × 512, packed=True, source exists=False.
- Imported at scene frame 1, the start of the Growth clip. Its small frame-1 dimensions reflect the closed seed pose and object scale tracks; compare animated clip samples rather than these static dimensions to the full-size blend pose.
- Some packed images keep source paths outside this worktree. Their packed image data is embedded in the blend/GLB, so a missing original path does not imply missing texture data.

## v13 vs v2_04m differences

- Both blends contain the same 14 object names, 10,357 mesh vertices, 19,998 edges, and 9,682 quad faces. Both use the same six materials and packed runtime textures.
- v2_04m adds `YoungFolded` to `Leaf_A` and `Leaf_B`, animated by `Growth__Leaf_A_YoungFolded` and `Growth__Leaf_B_YoungFolded` through `key_blocks["YoungFolded"].value`.
- v2_04m adds `SeamClear_01`–`SeamClear_06` and `TipUnfurl` to `Petals` and `Petals_Outside`; the Bloom and related shape-key actions animate those named key-block values.
- Petal base dimensions change from 0.450169 × 0.472716 × 0.157968 m in v13 to 0.449799 × 0.472668 × 0.175042 m in v2_04m. Other mesh topology counts are unchanged.
- v13 has 36 actions; v2_04m has 38. Both retain the six scene clips: Growth, IdleClosed, TouchResponse, Bloom, IdleOpen, and DissolveReady. The v2_04m addition is the two leaf growth actions.
- The v13 GLB imports as a triangulated mesh set (19,188 triangle faces) with six clip actions and the older petal/leaf key inventory. It does not contain v2_04m’s additional keys.

## Saved v2_04m vs live unsaved backup

- Meaningful content difference: **no** (mesh/shape-key coordinates, action curves, NLA setup, material graphs, and packed image data; tolerance 1.0e-07).
- Mesh topology changed: 0 objects; base mesh coordinates changed: 0 objects.
- Shape-key changes: 0 added, 0 removed, 0 coordinate sets changed.
- Actions: 0 added, 0 removed, 0 changed; NLA owners: 0 added, 0 removed, 0 changed.
- Materials: 0 added, 0 removed, 0 changed; images: 0 content changes, 2 path-only changes.
- Scene/session state: saved frame 1281 vs live-backup frame 1204; active object `Flower_Details` vs `Flower_Details`. Frame and selection differences were excluded from content comparison.
- Image source path only: `leaf.psd`, `render.jpg`; packed image content and metadata match.
- Selected objects: ['Flower_Details'] vs [] (UI state only).
- Reproduction: run `compare_v2_04m_saved_vs_live.py` with the saved v2_04m blend, `baseline/live_v2_04m_unsaved.blend`, and `baseline_inventory.json`.

## glTF exporter capabilities found in Blender

- `bpy.ops.export_scene.gltf` is registered with 110 RNA properties. Supported property identifiers are recorded in `baseline_inventory.json`.
- Relevant available controls include GLB/animation export, NLA strips, morph targets and morph animation, materials, texture/image formats, Y-up conversion, transform application, and animation sampling/optimization.
- This Blender build returns no enum items for the dynamic `export_format` RNA property; the baseline GLB imported successfully. The operator does expose image-format values AUTO, JPEG, WEBP, and NONE.

## Reproduction

Run `inspect_lily_asset.py` from a Blender background session with these arguments: `versions/lily_004_v13_final.blend`, `iteration_02/versions/lily_004_v2_04m_bloom.blend`, `refinement_03/baseline/lily_004_animated.glb`, and the output JSON path. It writes this Markdown report beside the JSON.
