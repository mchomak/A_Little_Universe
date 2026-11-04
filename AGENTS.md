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

Локальный интерактивный 3D-фильм на React, TypeScript, Vite и Three.js. README.md описывает актуальный маршрут и запуск; художественные требования и кадры — в storyboard и `references/keyframes/README.md`.

## Команды (PowerShell из корня проекта)

| Действие | Команда |
|---|---|
| Первый запуск checkout | `Set-Location .\frontend; npm ci` |
| Запуск dev-сервера | `Set-Location .\frontend; npm run dev` |
| Проверки frontend | `Set-Location .\frontend; npm run check` |

`npm run check` запускает lint, Vitest, typecheck и production build.

## Структура и runtime

- `frontend/src/app/` — приложение и состояние фильма; `frontend/src/engine/` — постоянный `FilmCanvas`, `FilmRuntime`, камера и `SceneDirector`.
- `frontend/src/components/PhoneBackground.tsx` — DOM/CSS-фон загрузки и opening/growth/bloom/identity; профиль кадрирования хранится в `scenes.openingBackground`.
- `frontend/src/scenes/` — сцены; `frontend/src/scenes/lily/` — общий экземпляр анимированной лилии и её VFX. `frontend/src/systems/scene-config/` — Scene Composer schema v21, нормализация и store; принимаются частичные JSON v1–v21. `frontend/src/debug/` — DEV Scene Editor.
- `backend/` — необязательный FastAPI-сервис только с `/health`; фильм его не вызывает.

`SceneDirector` сохраняет один клонированный `AnimatedLily` при переходах growth → bloom → identity. В `frontend/src/scenes/lily/lilyGrowthVfx.ts` пыльца внутри цветка ориентируется на реальные вершины GLB: выбираются вершины геометрических групп, чей `materialIndex` указывает на материал с именем, содержащим `anther` или `filament`; для морфящихся мешей центроид позы пересчитывается через `Mesh.getVertexPosition` и переводится в пространство общего родителя. Внутренняя пыльца движется от чаши к этой позе, а не к фиксированной точке.
<!-- autopilot:end -->
