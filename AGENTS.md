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

Схема Scene Composer v15 принимает JSON v1–v15; отсутствующие поля кропа получают значения по умолчанию, экспортируется версия 15.

## Команды (PowerShell 5, из корня проекта)

| Действие | Команда |
|---|---|
| Первый запуск нового checkout | `Set-Location .\frontend; npm ci` |
| Запуск (http://127.0.0.1:5173) | `Set-Location .\frontend; npm run dev` |
| Проверка в отдельном терминале | `Set-Location .\frontend; npm run check` |

`npm run check` выполняет lint, Vitest, typecheck и production build.

## Как здесь работает Autopilot

Сборки фиксируются в `.autopilot/`; прогресс — в `.autopilot/dashboard.html`. Требование из manifest снимается только пользователем. Продолжение прогона: «продолжи автопилот».

## Подводные камни

В Windows `.autopilot/sync.py` не запускает dashboard-сервер: он вызывает POSIX `ps`. `python .autopilot/sync.py --no-serve` обновляет снимок страницы без сервера.
<!-- autopilot:end -->
