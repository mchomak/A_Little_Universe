# AGENTS.md — A Little Universe for You

Keep this file compact. Current project status, setup, and architecture are in [README.md](README.md). Narrative, shot order, timing, and creative direction are in the [storyboard](A_Little_Universe_for_Vasilisa_Storyboard_v3.0.md). Approved keyframes are indexed in [references/keyframes/README.md](references/keyframes/README.md).

## Durable project rules

- The target is local presentation on a MacBook with Apple M2 at the highest practical display quality. Do not spend effort on dedicated iPad adaptation unless explicitly requested.
- Before scene work, read the relevant storyboard section and approved keyframes. Do not invent personal photos, facts, or story beats; label temporary assets as development placeholders.
- Use the existing React, TypeScript, Vite, Three.js, React Three Fiber, and GSAP stack. Avoid unnecessary dependencies, speculative services, and unrelated refactors.
- Preserve the persistent WebGL canvas and shared ownership of film state, camera, audio, and scene timing. Avoid per-frame React state updates; dispose GPU, audio, and media resources correctly.
- Recording and upload require separate explicit consent. Keep camera tracking on-device, provide a fallback when optional device features are unavailable, and never put secrets in `VITE_*` variables.
- Keep developer tools development-only. Keep the presentation accessible, touch-friendly where relevant, and compatible with reduced motion.
- Inspect relevant files before changing them, make the smallest coherent edit, run relevant checks before claiming completion, and report checks that could not be run.

Current user instructions take priority over this file. Keep scene-by-scene implementation details and task-specific requirements in the README, storyboard, or the active task prompt.

<!-- autopilot:start -->
## Сцена 05: вода и облака

`GalleryScene` → `MoonlitWorld` → `WetFloor` используют общий canvas, renderer и `galleryMotion.time`; пауза и reduced motion сохраняются.
`gallery/waterMaterial.ts` управляет рябью и лунной дорожкой; `gallery/planarReflection.ts` владеет зеркальным проходом и восстановлением renderer/visibility. Тёмные подложки фото исключены из отражений, размытие остаётся общим с фотографиями.
`gallery/world.ts` задаёт квоты и дистанционное качество облаков, `gallery/cloudMaterial.ts` — raymarch; максимум 29 масс standard / 17 low, отражённый проход дешевле основного.
Настройки воды и облаков остаются в `scenes.gallery` (schema v16) и существующем DEV Inspector; подробности — `docs/scene-05-gallery.md`.
В этом worktree: `Set-Location .\frontend; npm run dev -- --port 5199`; открыть `http://127.0.0.1:5199/?debug`.
Проверка из `frontend`: `npm run check` (lint, Vitest, typecheck, production build).
Прогоны и требования записаны в `.autopilot/`; требование снимается только пользователем.
<!-- autopilot:end -->
