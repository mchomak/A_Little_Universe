# 03 — Ночное окружение через сцены 02–04

**Требования:** R10, R14, R16, R18, R22, R43, R48–R62, R65–R66, R73
**Blocked by:** 01, 02
**Зона:** `frontend/src/engine/SceneDirector.tsx`, `frontend/src/scenes/GrowthScene.tsx`
**Волна:** 2
**Status:** ready

## Что должно заработать

Ночное небо остаётся тем же слоем до конца сцены 04, даже когда растущий мир перестаёт отображаться. Между ростом, раскрытием, вихрем и портретом не возникает возврата космического фона; сцена 05 получает контроль без визуальных изменений галереи.

## Из брифа, дословно

> «Сцена 03 должна визуально продолжать конец сцены 02.»
> «В начале сцены 04 сохраняется ночной атмосферный фон сцены 03.»
> «Не переписывать вихрь, портрет, проявление фотографии, рамку и камеру.»
> «НЕ ИЗМЕНЯТЬ ВИЗУАЛ ГАЛЕРЕИ.»

## Разделы спецификации

Истории 1, 6–8, Решения по реализации, Границы `SceneDirector`/`GrowthSky`.

## Критерии приёмки

- [ ] Единственный экземпляр существующего `GrowthSky` переживает нужные переходы 02–04; повторный маршрут не добавляет mesh или GSAP tween.
- [ ] 02→03 сохраняет палитру, направление света и положение облаков; закрытый бутон остаётся в существующем крупном плане.
- [ ] Сцена 04 начинается и продолжается на спокойном тёмно-синем фоне; космические туманности не возвращаются, а частицы и портрет сохраняют контраст.
- [ ] Переход к галерее передаёт управление существующей сцене 05; визуальные объекты/материалы галереи и сцены 07 не редактируются, маршрут сцены 06 не меняется.
- [ ] Прямой вход в 03/04 и обратная перемотка 02 корректно восстанавливают атмосферный mix через текущий FilmRuntime.
- [ ] With `nightEstablished`, GrowthClouds holds the settled cloud sea at final visibility and hides transient fly-through wisps across the 02?03 boundary and on direct entry to 03/04; no scene-local clock reset causes a cloud pop.
- [ ] Direct entry into early Growth after a dark-background scene clears the stale `Scene.background`, leaving the unchanged cosmic DOM image visible throughout seed formation until fall progress begins.
- [ ] One existing `GrowthSky` layer is mounted by SceneDirector continuously from Scene 02 through the end of Scene 04; GrowthScene does not create a duplicate, and the mesh/tween does not accumulate on replay.
