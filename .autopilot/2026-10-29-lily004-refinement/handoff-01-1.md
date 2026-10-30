# T01 geometry recovery handoff

## Last known state
- Authoring ran from tracked, read-only `baseline/live_v2_04m_unsaved.blend`; it saved `source/lily_004_geometry.blend`, `export/lily_004_geometry.glb`, `reports/geometry_refinement.json`, and study renders. Those generated artifacts are intermediate, not accepted.
- `verify_geometry.py --open-profile-only` passed: 44 clip-owner duration entries; cup depth 0.149224 m (limit 0.135), front reach 0.205524 m (max 0.21), front edge roll 0.019655 m (min 0.015), all 2,688 paired faces opposite-wound, GrowthBudForm attachment/tip deltas exactly 0.
- Full dense verification completed but failed: `reports/geometry_quality.json`; 410 frames, curvature peak 0.003820 m, max frame step 0.009965 m, paired-surface delta 0, normal alignment min −1.0000003, no normal flips, no inter-island intersections, 5 boundary checks passed. Failures: GrowthBudForm endpoint assertion (verifier logic bug; report shows weight exactly 0 at frame 217) and 687,228 fan-triangulated tiny triangles (min 2.94e−13 m²; diagnose with Blender's actual loop-triangle tessellation before deciding whether geometry is defective).
- Latest visual review still flags hard flat-cut/pointed tepal tips and a broad vertical foreground shield. Open profile is fuller, but the surface reads as broad flat panels. Refine cross-sectional camber and a longitudinal lip while preserving six-island anatomy, root, and closed seam.

## РЕШЕНИЯ
- Preserve source topology (each tepal grid 33×15; six islands), object hierarchy, root, and all existing clips. Bloom change smooths existing `SeamClear_*` deltas and sculpts existing `TipCurl` (mid-cup lift, edge roll, front-tip return/pullback).
- Added paired `GrowthBudForm`: 8% coherent radial contraction at mid-length, rows 0/32 pinned, weighted only in Growth (1.0 at start, 1.0 through 5.4s, 0.78 at 7.15s, 0.35 at 8s, exactly 0 at 9s); other clip curves are 0. Both tepal surfaces remain synchronized.
- Existing Growth evidence includes `Stem` Sprout/EarlyShoot/MidShoot keys and both `YoungFolded` leaf morphs; head scale also grows. Growth and Bloom durations are 9s/8s; all six clip names/durations retained.

## ТУПИКИ
- Earlier smoother-only pass removed the knee but did not make the full-open cup/front tepal visibly adequate; the current TipCurl correction improves the numeric profile but still misses the visual review.
- Summed quad-vector area falsely reported many degenerate faces. Fan-triangulated area is still inconclusive: sampled Blender polygon areas are >1.8e−6 m², while the fan split finds tiny triangles. Compare `mesh.loop_triangles` and exported triangulation.
- Growth endpoint failure in `growth_evidence()` compares every Growth sample against 1.0 because expected weight is derived from the start row; only Growth start should expect 1.0. The actual end weight in the report is 0.0.

## ДАЛЬШЕ
1. Fix endpoint assertion; use `mesh.calc_loop_triangles()` for per-triangle degeneracy/normals and keep real intersections/folds visible.
2. Iterate open tip surface profile and closeups; retain sealed early poses and exact boundary endpoints. Use focused renders (`--render-mode focused`) to avoid rerendering unchanged baseline/contact sheets.
3. Run full dense verification, inspect/reopen GLB in background Blender, then send focused renders/report to root for review. Do not claim T01 green until visual and geometry checks pass.

## Reproduction commands
Run from repository root in PowerShell. Author command uses the tracked baseline, never the ignored iteration source:
```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background '3D_models/production/lily_004/refinement_03/baseline/live_v2_04m_unsaved.blend' --python '3D_models/production/lily_004/refinement_03/scripts/refine_geometry_animation.py' -- --output-root '3D_models/production/lily_004/refinement_03' --render-mode focused
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background '3D_models/production/lily_004/refinement_03/source/lily_004_geometry.blend' --python '3D_models/production/lily_004/refinement_03/scripts/verify_geometry.py' -- --output-root '3D_models/production/lily_004/refinement_03' --report 'reports/geometry_quality.json'
```
Profile-only green command already run:
```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background '3D_models/production/lily_004/refinement_03/source/lily_004_geometry.blend' --python '3D_models/production/lily_004/refinement_03/scripts/verify_geometry.py' -- --output-root '3D_models/production/lily_004/refinement_03' --report 'reports/geometry_profile_post.json' --open-profile-only
```

## Координатор: изменённый подход продолжения
Первый контекст дважды завершился transport Bad Request; это свежий retry с явным красным dense test, не утверждение зелёного handoff. Проверить active GrowthBudForm endpoint, native/exported triangulation и scale-aware area semantics. Затем сделать видимую мягкость профилей: rounded terminal contour вместо плоского среза, мягкий cross-section camber/edge roll, foreground longitudinal lip вместо вертикального щитка. Закрытые target/корневые ряды/анатомия сохраняются. Последние изображения ещё не приняты.
