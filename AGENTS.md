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

Локальный интерактивный 3D-фильм на React, TypeScript, Vite, Three.js, React Three Fiber и GSAP. Подробные художественные требования — в storyboard v3.0 и approved keyframes; текущие состояния и сетап — в README.md.

## Scene Composer и DEV Scene Editor

`frontend/src/systems/scene-config/config.ts` — источник defaults, нормализации и store `SceneComposerConfig` v26; он принимает схемы 1–26 и экспортирует v26. Store владеет только конфигурацией: сцены, runtime, камера и film clock остаются в своих существующих модулях. Справка и допустимые диапазоны: `frontend/src/systems/scene-config/README.md`.

Полный JSON импорт проходит через `frontend/src/debug/composerControls.ts` и UI `DeveloperPanel.tsx`: проверить JSON, версию/форму, собрать legacy cloud migration patch, нормализовать кандидат и загрузить изменённый шрифт; только после успешных проверок выполняется один `updateConfig`. Не менять порядок на частичные store updates. UI-контролы и подписи редактируются отдельно от serialized keys/defaults.

Пресет — отдельный envelope `formatVersion: 1` с `configSchemaVersion`, `scope` и только `scene`; допустимые scopes: `preload`, `prologue`, `growth`, `bloom`, `identity`, `gallery`, `galaxy` (cosmos использует `galaxy`). Модель в `frontend/src/debug/scenePresetModel.ts` захватывает/патчит только `scenes.<scope>`; новые снимки не содержат общего `openingBackground`. Устаревшее поле `openingBackground` можно разобрать для совместимости, но импорт сцены его не применяет. `parseScenePreset` сверяет scope, известную версию и, если передан `normalizeConfig`, известные значения и диапазоны; недостающие поля остаются текущими при merge и последующей нормализации. JSON пресета не является полным Composer JSON.

Границы кода: `scenePresetModel.ts` — формат, проверка и scoped patch; `scenePresetStorage.ts` — локальное хранилище и seeds; `scenePresetApi.ts` — валидация/transport; `ScenePresetControls.tsx` — DEV UI. Выбранный UI scope передаётся отдельно при save/import. Выбор пресета применяет его через текущий store/undo history; сохранение совпадающего имени просит заменить существующий пресет. Импорт/экспорт JSON работает только с текущей сценой. DEV-панель: `frontend/src/debug/DeveloperPanel.tsx`; growth/cloud controls общие для сцен 02–03 и показываются один раз в секции роста. Greeting не имеет config/preset scope. Качество, скорость, DPR и crop фона остаются в «Общих настройках».

В Vite dev и preview пресеты идут через локальный `__scene-presets` API; файлы — `frontend/scene-presets/<scope>/<id>.json`. Packaged Electron (`app://bundle`) использует `localStorage` с ключами по scope `a-little-universe.scene-presets.v1.<scope>` и встроенные seeds из `scene-presets/index.json`. Seed-файлы — входные данные фильма. Тесты пресетов используют временное/in-memory storage и не пишут в настоящие seed-файлы.

## Сцены и важные точки интеграции

- `images/phone_1.png` — DOM/CSS-фон загрузки 00 и сцен 01–04; он скрывается в галерее 05. Общий профиль `scenes.openingBackground.{zoom,offsetX,offsetY}`: zoom 1–3, offsets −1…1, default 1/0/0. Локальный preview DEV-панели: `http://127.0.0.1:4173/?debug`.
- Подготовка частиц сцены 04 начинается на экране 00.1 и учитывает текущие конфигурацию/размеры film surface. Менеджер `LilyParticlePreparationManager` разделяет повторно используемую поверхность и геометрию worker; геометрия кэшируется только при совпадении полного ключа. Старт фильма ждёт актуальную геометрию.
- Портрет использует оригинал `frontend/src/assets/start_img.jpg`. Для UV/камерного совпадения использовать `frontend/src/scenes/lily/portraitIntegration.ts` (`createLilyPortraitCameraBasisAtTime`, `placeLilyPortraitTargets`) в `LilyDissolveParticles`/`SceneDirector`; проявление привязано к фактической посадке последней частицы.
- `AnimatedLily` — один GLB для сцен 02–04. VFX-настройки — `scenes.growth.{lilyBudGlow,lilyLeafMaterial,growthVortex}` и `scenes.bloom.lilyBloomPollen`; их runtime анимируется по film time.
- Галерея 05 использует общие `FilmCanvas`, камеру и `galleryMotion.time`; камера карточек/фото берётся из `frontend/src/engine/galleryCameraPose.ts`. Reveal дополнительных фото: `frontend/src/scenes/shared/progressivePhotoReveal.ts` и `frontend/src/scenes/gallery/collage.ts`; reveal только для фокусной памяти, слот ждёт текстуру. События — `frontend/src/scenes/gallery/catalog.ts`, подписи — `frontend/src/data/galleryCaptions.json`, фото — `images/<event ID>/`. Учитывать reduced motion, повторную смену фокуса и освобождение GPU-ресурсов.
- Переход из последней карточки `2026_10_Planetarium` в Galaxy использует live texture `1.jpg` и `PlanetariumTransitionOverlay` внутри `SceneDirector` с общей камерой/канвой. Транзитный флаг устанавливается только `galleryExit()` в explore у конца галереи при interaction `walk`; DEV-jump в cosmos оставляет обычный маршрут. Сохранять один renderer/camera и существующие слои Galaxy.

## Команды из корня проекта (PowerShell 5)

| Действие | Команда |
|---|---|
| Новый checkout | `Set-Location .\frontend; npm ci` |
| Dev server | `Set-Location .\frontend; npm run dev` → `http://127.0.0.1:5173` |
| Production preview | `Set-Location .\frontend; npm run build; npm run preview` → `http://127.0.0.1:4173` |
| TypeScript | `Set-Location .\frontend; npm run typecheck` |
| Целевые Vitest | `Set-Location .\frontend; npm run test -- <path>` (`test` запускает `vitest run`) |
| Desktop tests | `Set-Location .\frontend; npm run test:desktop` |
| Полная проверка | `Set-Location .\frontend; npm run check` |

Все команды ниже запускаются из корня проекта. Для изменений используйте `npm run test -- <path>`; доступные проверки: `npm run check`, `npm run test:desktop` и `npm run build` (последняя также выполняет typecheck). Сейчас `npm run check` останавливается на 17 lint errors и 3 warnings в несвязанных `frontend/src/scenes/GalleryScene.tsx`, `frontend/src/scenes/gallery/MoonlitWorld.tsx` и `frontend/src/scenes/gallery/planetariumTransition.tsx`.
<!-- autopilot:end -->


