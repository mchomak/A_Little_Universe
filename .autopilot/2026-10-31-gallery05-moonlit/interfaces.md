# Границы, решённые в спецификации

- Existing gallery controller, visibility, gestures and content own navigation/identity. Existing API unchanged.
- CameraDirector owns camera/projection; gallery focus uses existing focusCamera with photo-normal yaw.
- GalleryScene owns current Memory and event gates; environment is isolated under gallery/ with world-fixed objects and settings props. Environment never writes camera/controller.
- SceneComposerConfig owns normalized gallery art defaults and Inspector serialization; no parallel settings store.
- Tests call public normalization, gallery controller, camera pose and deterministic reflection/layout helpers. Shader appearance is judged by actual-render screenshots.

## Общие правила
Worktree C:/Users/McHomak/.codex/worktrees/gallery05-moonlit/A_Little_Universe only. Branch codex/gallery05-moonlit, base 07c10ae. No changes/main merges/push. Not alone in codebase; don't revert other edits. React19/Three0.186/R3F9 already installed via npm ci. No new production deps. Frontend npm run check (lint + 285 baseline tests + strict types/build); focused npm test -- path. Node >=24. Run dev with npm run dev -- --port 5186 (strict port), reuse only matching worktree server.

## Art settings contract (additive schema v5)
scenes.gallery fields: frameIntensity=1 [0,2], particleCount=220 [0,600], moonBrightness=0.8 [0,2], moonSize=1 [0.4,1.8], cloudDensity=0.85 [0,1.8], hazeDensity=0.7 [0,1.8], reflectionStrength=0.24 [0,0.6], reflectionBlur=0.8 [0.3,1], threadOpacity=0.38 [0,0.8], coldLightIntensity=0.8 [0,1.8]. Implement units/clamps in config and existing Inspector reset/import/history. Low quality scales counts/texture complexity; no second settings panel. Later artistic tuning may adjust defaults with render evidence.

## Таски
01 owns environment+configuration integration, GalleryScene outer body, CameraDirector far clip only, tests for new config/world geometry. 02 starts after01 and owns Memory frames/photo reflections, dust/threads refinement, artistic browser fixes, docs/reference hygiene and regression verification. No overlapping concurrent project writes.

## Existing invariants
wallYaw .72 rad fixed inward, focusCamera gets matching yaw. Preserve if visually adequate. memoryPosition/content arrays unchanged. FirstMemoryCard shared scene04 must not be edited for scene05. GallerySpotlight current but removable for moonlight. galleryFocusOpacity preserves min .2 contextual opacity and galleryDistanceOpacity fades32–40; don't regress. Intro4.4/exit3.2 stay. useFrame guards paused/hidden; galleryMotion.time is animation clock. Decor raycast disabled. Camera starts far100: moon farther than route must be visible by gallery-only far extension in owner, restored on scene leave.

## Из таска01 — окружение и настройки
- `SceneComposerConfig.scenes.gallery` — десять bounded art fields из контракта выше; additive schema v5. DEV importer/history/reset поддерживают gallery; A/B остаётся недоступным для interactive checkpoint.
- `MoonlitWorld({settings, quality, halo})` включает world-fixed clouds/moon/low haze и `WetFloor({settings})`. GalleryScene уже подписан на config и монтирует окружение. Камера и controller окружению недоступны.
- `GALLERY_WORLD`, `getGalleryCloudPlanes(quality)`, `getGalleryCloudTextureDimensions(quality)` задают детерминированное окружение; луна фиксирована, cloud groups снаружи corridor/за концом маршрута.
- CameraDirector применяет gallery-only far220 и возвращает исходный far; `sceneLighting` сохраняет прежний свет других сцен.
- Текстуры луны/halo имеют отдельный lifetime от зависящих от quality cloud textures. Большие cloud planes renderOrder -3, moon/halo -2, единственный veil -1, фото0.
- Новый fullcheck включает неинтегрированные helpers02:305 tests/72files. Фото-отражения/светящиеся рамки/нити ещё не подключены; их владелец02.
