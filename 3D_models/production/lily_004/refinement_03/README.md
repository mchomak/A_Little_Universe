# Lily 004 refined candidate

This folder contains a reviewed, reproducible asset candidate for A Little Universe for You. It is not connected to the frontend; runtime integration is a separate change.

## Final asset

- GLB: [`export/lily_004_refined.glb`](export/lily_004_refined.glb) — 2,560,052 bytes, SHA-256 `c6fd5311e45f9586efc491ea6870cc6ae4123999fd954b1a9a607927841c0d24`.
- Editable Blender source: [`source/lily_004_refined.blend`](source/lily_004_refined.blend) — 5,116,583 bytes, SHA-256 `3f60ecbf59cbbf4095d73901069cb001418b3ad0f65bc2022f5c41217fc86f89`.
- Growth color contract: [`export/bud_maturation.json`](export/bud_maturation.json), mirrored in `Lily_Root.extras.ALU_budMaturation` (schema 1).
- Start with [`HANDOFF.md`](HANDOFF.md) for provenance, dimensions, animation and color integration, exact verification commands, rollback, and limitations.

The GLB contains six clips: Growth 9 s, IdleClosed 8 s, TouchResponse 2 s, Bloom 8 s, IdleOpen 8 s, and DissolveReady 1 s. It has 14 nodes, 7 mesh objects, 11,015 vertices, 19,188 rendered triangles and 8 draw calls. The 38 morph targets are: 16 each on `Petals` and `Petals_Outside` (`Closed_01`–`Closed_06`, `TipCurl`, `TipArc`, `SeamClear_01`–`SeamClear_06`, `TipUnfurl`, `GrowthBudForm`); `YoungFolded` on each leaf; and `Sprout`, `EarlyShoot`, `MidShoot`, `Sway` on `Stem`.

Seven embedded PNG maps are decoded on Blender reimport; each is at most 512 × 512. Assuming decoded RGBA8 and a complete mip chain, the textures use about 4.5 MiB at base level and 6 MiB with mips. Dense float32 POSITION/NORMAL/TANGENT morph arrays total about 2.25 MiB (2,363,472 bytes). These are memory estimates under the stated assumptions, not measured GPU allocation or an iPad frame-rate claim.

The six source clips and final behavior are:

| Clip | v13 source | Final | Behavior |
| --- | ---: | ---: | --- |
| Growth | 16 s | 9 s | A tiny sprout emerges and grows into the formed closed bud. |
| IdleClosed | 8 s | 8 s | Holds the closed flower with a subtle plant sway loop. |
| TouchResponse | 2 s | 2 s | Briefly bends in response, then settles back to the closed pose. |
| Bloom | 16 s | 8 s | Outer and inner tepals open in layers, revealing the anthers. |
| IdleOpen | 8 s | 8 s | Holds the open flower with a subtle sway loop. |
| DissolveReady | 1 s | 1 s | Holds the open pose for the next scene; the asset contains no dissolve effect. |

Every final clip boundary has zero sampled vertex delta; both idle loops also close without a positional jump. See the detailed pose and viewer reports in [`reports/`](reports/).

The GLB opens with the mature material. To show the green-to-mature Growth color, a runtime must consume the metadata and sample its absolute clip time. A stock GLTFLoader ignores this metadata; no `KHR_animation_pointer` or frontend playback change is included here.

## Review package

- [`reports/`](reports/) contains geometry, Blender reimport, viewer, pose-bounds, Growth BVH, render-comparison, and aggregate verification reports.
- [`screenshots/comparison/`](screenshots/comparison/) contains same-camera before/after samples, the metadata young/mature pair at one fixed Growth-end pose, and the [contact sheet](screenshots/comparison/comparison_sheet.png). Its rows are Growth end, Bloom start, Bloom midpoint, Bloom end, then the color-only pair. The report records the actual clip and sample times.
- [`license/`](license/) preserves the original model attribution and license notice.
- [`baseline/checksums.sha256`](baseline/checksums.sha256) records read-only v13 and v2_04m backup hashes. The original GLB and source were not replaced.

The accepted T01 clay geometry evidence is in [`screenshots/`](screenshots/): [closed front](screenshots/geometry_after_clay_detail_front_0_00.png), [Bloom at 1.01 s, front](screenshots/geometry_after_clay_detail_front_1_01.png), [Bloom at 2.04 s, three-quarter](screenshots/geometry_after_clay_detail_three_quarter_2_04.png), and full-bloom [front](screenshots/geometry_after_clay_detail_front_4_08.png), [three-quarter](screenshots/geometry_after_clay_detail_three_quarter_4_08.png), and [side](screenshots/geometry_after_clay_detail_side_4_08.png) views. These are geometry-only clay renders used to review the cup and seams; they do not show final PBR materials.

## Attribution

“White lily” by Nmn9, Blend Swap model 74582, CC BY 3.0. This model was modified by isolating and reconstructing elements, changing geometry and materials, and adding deformation and animation. See [`license/ATTRIBUTION.md`](license/ATTRIBUTION.md) and the preserved license page.

Physical iPad/Safari performance has not been measured. See [`HANDOFF.md`](HANDOFF.md) for the complete delivery record and tested commands.
