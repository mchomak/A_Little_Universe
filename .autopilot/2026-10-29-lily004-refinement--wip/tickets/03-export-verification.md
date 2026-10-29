# 03 — Финальный экспорт, сравнение и сдача
Требования: R01,R02,R03,R04,R05,R06,R07,R08,R17,R35,R36,R40,R41,R42,R43,R44,R45,R49,R50,R51,R52,R53,R54,R55,R56,R57,R58,R59,R60,R61.
Blocked by:01,02
Зона: final blend/GLB, verification/render scripts, final reports/comparison screenshots, README,HANDOFF,license copies.
Волна:2
Status:ready

## Что должно заработать
Материалы02 применяются к geometry-stage01, получается новый именованный candidate GLB. Автор видит воспроизводимое сравнение old/new и точный безопасный контракт подключения.
## Из брифа, дословно
«Проверь экспорт повторным импортом/рендером»
«непрерывность Growth→IdleClosed→TouchResponse→Bloom→IdleOpen»
«конец Growth, начало Bloom, середина Bloom, конец Bloom; отдельно покажи материал бутона до и после окрашивания»
«Не делай вид, что результат готов, если Blender или экспорт не удалось проверить. Не сливай свою ветку с работой над кодом самостоятельно».
## Спецификация
S1,S6,S7 plus all exported contracts. Use existing standalone viewer for GLTFLoader checks; no new WebGL scene or site edits.
## Приёмка
- Assemble source/lily_004_refined.blend/export/lily_004_refined.glb only from01+02, primary/baselines unchanged SHA.
- Reopen blend/reimport GLB/render, actual Three load;6 names/durations, no missing textures/NaN, root/hierarchy/dimensions compare.
- Vertex boundaries/loops/crossfades, sampled Bloom normals/intersections; fail findings cannot disappear.
- BEFORE/AFTER comparison4 checkpoints same camera/light; young/mature material pair with metadata annotation. Front tepal/seams extra views.
- Final JSON, changed files/commands/problems, README + HANDOFF exact path/SHA/bytes/axes/root/dims/clips/color/incompatibilities/rollback/attribution.
- No merge/runtime edits. iPad/Safari not tested disclosed.
