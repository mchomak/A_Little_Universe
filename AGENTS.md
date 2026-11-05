# AGENTS.md — A Little Universe for You

Keep this file compact. Current project status, setup, and architecture are in [README.md](README.md). Narrative, shot order, timing, and creative direction are in the [storyboard](A_Little_Universe_for_Vasilisa_Storyboard_v3.0.md). Approved keyframes are indexed in [references/keyframes/README.md](references/keyframes/README.md).

## Durable project rules

- The target is local presentation on a roughly 15-inch MacBook with Apple M2 at the highest practical display quality and screen resolution.
- Before scene work, read the relevant storyboard section and approved keyframes. Do not invent personal photos, facts, or story beats; label temporary assets as development placeholders.
- Use the existing React, TypeScript, Vite, Three.js, React Three Fiber, and GSAP stack. Avoid unnecessary dependencies, speculative services, and unrelated refactors.
- Preserve the persistent WebGL canvas and shared ownership of film state, camera, audio, and scene timing. Avoid per-frame React state updates; dispose GPU, audio, and media resources correctly.
- Recording and upload require separate explicit consent. Keep camera tracking on-device, provide a fallback when optional device features are unavailable, and never put secrets in `VITE_*` variables.
- Keep developer tools hidden by default; allow the Scene Editor with `?debug` only on localhost production previews. Keep the presentation accessible, touch-friendly where relevant, and compatible with reduced motion.
- Inspect relevant files before changing them, make the smallest coherent edit, run relevant checks before claiming completion, and report checks that could not be run.

Current user instructions take priority over this file. Keep scene-by-scene implementation details and task-specific requirements in the README, storyboard, or the active task prompt.

<!-- autopilot:start -->
# A Little Universe for You

Локальный интерактивный 3D-фильм на React, TypeScript, Vite и Three.js.

## Фон и кадрирование

`images/phone_1.png` — DOM/CSS-фон загрузки 00 и сцен 01–04; при входе в галерею 05 он скрывается. Начальный кадр увеличен, во время падения семени видимая область плавно движется вниз и сохраняет положение в сценах 03–04. `cover` заполняет экран без пустых краёв. DEV Scene Editor в development или в локальном production preview (`http://127.0.0.1:4173/?debug`) меняет общий профиль `scenes.openingBackground.{zoom, offsetX, offsetY}`; в секции «00–04 · Кадрирование фона» доступны живой предпросмотр и сброс. Масштаб: 1–3, смещения: −1…1, по умолчанию: 1/0/0.

Схема Scene Composer v24 принимает JSON v1–v24; старые файлы сцен 02 и 05 мигрируются с сохранением известных настроек, а Lily appearance/pollen остаются совместимы со всеми предыдущими версиями. Экспортируется версия 24.

## Пресеты Scene Editor

В локальной DEV-панели выберите сцену, введите имя и нажмите «Сохранить». Чтобы повторно использовать настройки, выберите пресет по имени в списке; применение доступно через undo/redo. Повторное сохранение под тем же именем попросит подтверждение замены. JSON пресетов хранятся в `frontend/scene-presets/<scope>/<id>.json`; для 00–04 снимок также содержит общий фон. `cosmos` использует scope `galaxy`.

## Подготовка частиц сцены 04

Предварительная подготовка запускается на экране 00.1 и перезапускается при изменении влияющих на неё настроек или размеров film surface; начало фильма ждёт геометрию для текущего ключа. `LilyParticlePreparationManager` хранит захваченную поверхность отдельно от геометрии worker: поверхность повторно используется при актуальной сигнатуре позы, геометрия — только при точном совпадении ключа конфигурации, размеров, `reducedMotion` и источника. DEV-баннер показывает только подготовку и ошибку; при состояниях idle и ready он скрыт.

Пределы `scenes.identity`: `particleCount` 1 000–100 000; `portraitStartProgress` 0–100%; `portraitDuration` 2–16 с, расчёт ограничивает её остатком времени сцены, но не ниже 2 с; `portraitFraction` 0–45%; min/max turns 0–4 (max повышается до min при обратном порядке); `portraitSteering` 0–2, `portraitBraking` 0,25–2, `portraitSettledBrightness` 1–2.

## Портретная фотография сцены 04

Используется существующий отслеживаемый оригинал `frontend/src/assets/start_img.jpg`. Плоскость фото и частицы должны совпадать по UV и камере через `portraitIntegration.ts` (`createLilyPortraitCameraBasisAtTime`, `placeLilyPortraitTargets`); точки интеграции — `LilyDissolveParticles` и `SceneDirector` в общей WebGL-канве. Проявление рассчитывается от фактической посадки последней портретной частицы, начинается от лица после отдельной паузы и завершается точным совпадением с оригиналом. `identityRestoration.ts` — исторический ориентир; фиксированный тайминг и ранние фронты старого алгоритма не подходят.

## Рост и раскрытие лилии

`AnimatedLily` остаётся одним экземпляром GLB для сцен 02–04; appearance uniforms совмещаются с dissolve shader. Рост, bloom, вихрь и пыльца обновляются по film time, с posed anchors цветка и тычинок. Настройки `scenes.growth.{lilyBudGlow,lilyLeafMaterial,growthVortex}` и `scenes.bloom.lilyBloomPollen` доступны в DEV Scene Editor и сохраняются в отдельном локальном черновике без сброса остальных полей.

## Команды (PowerShell 5, из корня проекта)

| Действие | Команда |
|---|---|
| Первый запуск нового checkout | `Set-Location .\frontend; npm ci` |
| Запуск (http://127.0.0.1:5173) | `Set-Location .\frontend; npm run dev` |
| Проверка в отдельном терминале | `Set-Location .\frontend; npm run check` |

`npm run check` выполняет lint, Vitest, typecheck и production build.


## Scene 05: gallery of memories

`GalleryScene`, `MoonlitWorld` and `WetFloor` share the persistent WebGL canvas and use `galleryMotion.time`; camera pose for rendering and photo selection comes from `frontend/src/engine/galleryCameraPose.ts`. Event order is defined by `GALLERY_EVENT_ORDER` in `frontend/src/scenes/gallery/catalog.ts`; data comes from `images/<event ID>/`, with captions in `frontend/src/data/galleryCaptions.json`. Empty folders are omitted unless they contain `.gallery-placeholder`; each memory can show up to four images. Gallery configuration is stored in `scenes.gallery`, with independent layouts A and B and the B layout selected by default. Gallery data and collages do not own film timing or lighting.

The final arch follows the last real column shaft centers through `getGalleryColumnPlacement`, keeping a 13.69m default gap; the 12-photo B layout retains its historical Z=-82 placement. Gallery length and column depth, scale, and X offset move the arch with the colonnade; legacy `archPositionZ` does not override this anchor.
## Как здесь работает Autopilot

Сборки фиксируются в `.autopilot/`; прогресс — в `.autopilot/dashboard.html`. Требование из manifest снимается только пользователем. Продолжение прогона: «продолжи автопилот».

## Подводные камни

В Windows `.autopilot/sync.py` не запускает dashboard-сервер: он вызывает POSIX `ps`. `python .autopilot/sync.py --no-serve` обновляет снимок страницы без сервера.

## Scene 05 photo particle reveal

Additional photos mount only for the focused memory and reveal through the shared progressive photo shader after particle assembly. Defaults are 5s assembly and 2.5s reveal; wait for each texture before starting and clean up on focus changes. Layout A places extras beside the main image; B stacks them above it to stay clear of the columns and floor. Preserve source aspect ratios, 90% default photo scale, and a 0.3m gap. Camera fitting uses loaded photo aspects and the actual collage bounds; the selected collage stays visible through the focus dolly. Keep particles on the selected collage and use the shared WebGL renderer.

Gallery collage settings live under `scenes.gallery` in Scene Composer schema v24. Defaults: particle density 90,000 (2,400–90,000; Memory Signal raster capped at 300 px per edge), assembly 5s, animated particle hold 3.5s, reveal 2.5s, photo scale 0.9, and photo gap 0.3m. Focused extra photos use the local Memory Signal pixel sampler and the shared Scene 04 progressive reveal. Existing particle size, noise, depth, glow, and stagger controls remain in `frontend/src/debug/DeveloperPanel.tsx`. Per-memory opt-out uses stable event IDs in `frontend/src/scenes/gallery/galleryCollageConfig.ts`.
<!-- autopilot:end -->


