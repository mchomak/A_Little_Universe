# Границы, решённые в спецификации

| Единица | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Geometry/animation | mesh/morph/action/NLA | geometry-stage blend + names/TRS/boundary report | методы сглаживания и деформации |
| Materials/color | PBR/текстуры/Blender curve/metadata | final blend, GLB, bud_maturation.json | запекание карт |
| Verification | импорт/GLB clips/вершины/сравнения | JSON, изображения, отчёт, HANDOFF | временные камеры/свет и управление исходным viewer |

## Среда и область
Worktree C:/Users/McHomak/.codex/worktrees/lily004-refinement/A_Little_Universe, codex/lily004-refinement.
Primary C:/Users/McHomak/Projects/A_Little_Universe НЕ МЕНЯТЬ.
Проектный output ROOT = worktree/3D_models/production/lily_004/refinement_03.
Blender C:/Program Files/Blender Foundation/Blender 5.2/blender.exe, 5.2.3LTS. bpy подтверждён.
Host Python C:/Users/McHomak/AppData/Roaming/uv/python/cpython-3.14.6-windows-x86_64-none/python.exe.
Three0.186.1 main frontend/node_modules. Не устанавливать missing deps; BLOCKED с фактами.
Source INPUT = copied iteration_02/versions/lily_004_v2_04m_bloom.blend.
Baseline = ROOT/baseline/lily_004_animated.glb (v13), lily_004_v13_final.blend, live_v2_04m_unsaved.blend. SHA записаны, файлы read-only. Disk04m и unsaved имеют одинаковые геометрию/actions/materials/packed bytes; различны UI/frame/relative paths.
14 nodes,7 mesh objects,6 materials,10357 source vertices,19188 triangles. Petals:6 islands33x15=495 each,2970 vertices per inner/outer surface.
Имена root/objects/materials/parent hierarchy и units/pivot сохраняются; изменение morph inventory перечислять.
No frontend/src/UI/playback/camera/VFX edits, no extra flowers/effects, no live Blender edits by workers. Use background processes. No git stage/commit by workers. Do not revert other work.
Current live Blender remains untouched after authorized copy backup.

## Выходы и CLI
01 owns scripts/refine_geometry_animation.py, source/lily_004_geometry.blend, export/lily_004_geometry.glb, reports/geometry*, screenshots/geometry*. Это refinement existing tepal grids, не новая модель.
02 owns scripts/refine_materials.py, textures/*, source/lily_004_material_study.blend, export/lily_004_material_study.glb, export/bud_maturation.json, reports/material*, screenshots/material*. Author script on baseline independently; it must apply to geometry-stage blend without changing positions/actions/root hierarchy.
03 assembles source/lily_004_refined.blend and export/lily_004_refined.glb by applying02 script to01 source. Owns scripts/verify*, scripts/render*, reports/final*, screenshots/comparison*, HANDOFF.md, README.md, ATTRIBUTION copy. No changes to01/02 code without coordinator repair dispatch.
Each script callable using Blender --background INPUT --python SCRIPT -- [declared output args]; report exact commands and args. Outputs reproducible and refuse writes to baseline/primary paths.
Geometry/motion end state contracts: Growth9 / IdleClosed8 / TouchResponse2 / Bloom8 / IdleOpen8 / DissolveReady1.24fps. Preserve frame offsets if convenient; exported clip times zero-based. Endpoint weights consistent including every new correction key.
Color extras root property ALU_budMaturation schema version1. JSON identical semantic content. Include materials, clip Growth/duration9, linear-sRGB factor keyframes/curve. No unsupported pointer dependency. Mature base GLB; material curve Blender source; runtime deterministic absolute clip-time sampling required. NonGrowth chooses mature. Exact schema and samples agreed in02 report before03.
Tests through actual exported GLB; existing viewer can be reused with request interception candidate GLB, no website code changes. Physical iPad/Safari unavailable; report limitation. Test cameras/lights only transient, never in asset.
Keep embedded/packed textures and include source license/attribution in final handoff; no frontend credits edit.

## Из таска02 — промежуточный контракт (handoff1)
refine_materials.py: Blender --background INPUT --python SCRIPT -- --output-root refinement_03 --name NAME.
Пишет source/lily_004_NAME.blend, export/lily_004_NAME.glb, export/bud_maturation.json и reports/material_NAME.json.
ALU_budMaturation schema1 на Lily_Root; sidecar семантически одинаков; absolute Growth t0/4.5/6.75/9, piecewise-linear factors linear-sRGB; mature factor1 baked maps; nonGrowth mature; crossfade0.25s linear. Фактические значения в JSON, не дублировать в коде. GLB default mature, без pointer dependency.
Read-only checker: hostPython scripts/check_material_contract.py GLB --json JSON → PASS2curves/7PNG≤512.
Blender import images lazy: для проверки декодирования читать pixels, не только Image.has_data.

## Уточнение02: stock viewer adapter
Только diagnostic tooling в3D/refinement_03/scripts: неизменённые копии production scripts/viewer.html+viewer.js (сохранить их исходный hash) и local HTTP asset adapter. Virtual routes original HTML/JS, /export/lily_004_animated.glb→CLI asset, /frontend/node_modules/three/*→CLI installed Three root. Bind127.0.0.1 only, read-only allowlisted paths, no directory listing, no primary/frontend writes. Root использует CUA существующего IAB; workers не запускают новых MCP browsers. Viewer сцена/UI/camera/light остаются побайтно исходными.03 может запускать software headless checks в отдельном ephemeral profile, не пользовательском.

## Из таска02 — завершённый контракт
CLI author: Blender --background baseline/live_v2_04m_unsaved.blend --python scripts/refine_materials.py -- --output-root refinement_03 --name material_study.
Checks: hostPython check_material_contract.py GLB --json sidecar; Blender --background --factory-startup --python check_material_reimport.py -- --glb GLB --report REPORT.
Petals/Petals_Outside complementary one-sided, shared leaf material double-sided;7 PNG≤512,6materials; all metallic0. Source/export checks preserve geometry+actions. Material study retains source16s geometry timing; material curve is9s for final geometry assembly01.
Viewer adapter: material_viewer_adapter.py --asset GLB --three-root DIR --port N. Current5182/scripts/viewer.html?asset=final, session13442. Stock HTML/JS byte-identical, original GLB virtual route delivers selectedCLIasset; dependency routes read installedThree. Unit3/readiness13 passed.
Coordinator CUA IAB tab2 inspected mature open default and above-angle: right leaf visible green, no black petal backside; young/mature/open PNGs personally viewed. Actual final model shape still belongs01.

##02 — проверенные исправления
CLI прежний; report не может перекрывать входнойGLB/readonlybaseline/primary; preview восстанавливает исходные Cycles device/samples/denoising до save. Полный color contract проверяет crossfade0.25/clamp/absolute/reverse. Root:9unit tests,contract2curves7PNG, Blender reimport6materials7decodedimages; Craft re-reviewclean. Readiness13checks restored on127.0.0.1:5182; root-ownedsession47870.

