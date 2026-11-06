# T01 — Актуальный каталог и Planetarium под аркой

## Требования
R01–R09, R25–R26.

## Спецификация
Spec: sections «Решение», stories 1–5, «Решения по реализации» (catalog, poster, layout).

## Владелец
frontend/src/scenes/gallery/, frontend/src/scenes/GalleryScene.tsx, frontend/src/engine/galleryCameraPose.ts и derived poster asset в images/2026_01_Country_House_New_Year/. This ticket owns galleryCameraPose.ts only; T02 must not edit it.

## Приёмка
- В каталоге точно по одному событию для каждой из 16 фактических папок и отдельно initial start photo; Country House third, Planetarium last.
- Удалить phantom 2026_04_Artems_Birthday; корректно включить 2026_04_Theater_Night.
- Создать из существующего MP4 статичный poster для Country House, не менять исходный видеофайл.
- Planetarium стоит по центру под последней аркой, без отдельной опорной колонны, смотрит вдоль прохода; расстояние blur/focus и выбор фото работают как у остальных.
- Фото rectangle для последующего перехода захватывается в новой позиции; поведение остальных фотографий не меняется.
- Не открывать браузер, не снимать скриншоты, не запускать unit/visual tests. Source edits должен делать autopilot_code_worker.
