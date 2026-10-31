# 02 — Тёплые воспоминания, отражения и проверка

**Требования:** R03–R05, R19–R22, R25–R55, R56–R76
**Blocked by:** 01 для GalleryScene integration; новые независимые reflection/thread modules и frameParticles могут готовиться параллельно после стабилизации settings contract
**Зона:** GalleryScene Memory/Dust/frame systems, photo reflection helpers, threads, tests, docs/scene-05-gallery.md, references/keyframes/scene-05-moonlit
**Волна:** 1 — независимые helpers; integration после review/commit01
**Status:** ready

Пересмотр плана 2026-10-31: outer environment уже интегрирован, typecheck/47 focused checks зелёные. Пока01 исправляет художественную среду в своих модулях,02 готовит только новые helper-файлы и frameParticles. GalleryScene не трогает до отдельного GO; общих записей между исполнителями нет. Это сокращает простой без изменения контракта или области результата.

## Что должно заработать
Тёплые светящиеся рамки, спокойные редкие крупинки, несколько world-space нитей связывают фотографии в одной холодной лунной среде. Под каждым фото мягкие размытые отражения изображения и растянутые пятна рамки учитывают реальный transform. Проверенные focus/gating/visibility/return работают без регрессий.

## Из брифа
> «Рамки должны выглядеть светящимися даже на неподвижном кадре»
> «Отражения должны корректно учитывать положение и ориентацию фотографий в пространстве»
> «Не заменяй целые файлы их старыми версиями»
> «Не считай визуальную задачу завершённой только потому, что сборка прошла успешно»

## Разделы спецификации
spec.md §1–2, §4–12; interfaces.md in full, references in reference.md.

## Приёмка
- [ ] Pearl/champagne continuous contour, narrow soft halo, rare perimeter particles + corners; mild focus intensification and smooth return. Natural photos unchanged; first shared card not modified.
- [ ] Per-photo blurred weak reflection + frame warm footprint consistent with yaw/position, intro, focus visibility and distance, no sharp inverted copies. Water retains lunar reflection.
- [ ] Few thin soft spatial curves with rare points and haze fade, outside photo/caption; fade in focus. Remove floor guide remnants. Rare warm air dust several depths, slow GPU movement and no blue guide/stars.
- [ ] Stable inward wall orientation, normal focus and saved return unchanged or corrected through existing shared mechanism with meaningful regressions. No neighboring random disappearance, no background picks in focus.
- [ ] Respect art settings, low quality, pause/hidden/reduced-motion, cleanup and noninteractive decor.
- [ ] Copy all four approved originals without overwriting into shot-ID reference paths, create index approval/source/intended-use. Never add references to runtime bundle. Update scene docs with actual systems/settings/reuse/tradeoffs.
- [ ] npm run check. Root captures/reviews actual browser checkpoints, forwards concrete visual fixes as needed. Do not claim iPad physical performance.
- [ ] Return contract <=25 lines, no code/diff; no commit (coordinator commits).
