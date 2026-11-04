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
## Сцена 05: галерея воспоминаний

`GalleryScene`, `MoonlitWorld` и `WetFloor` работают в общем persistent WebGL canvas и используют `galleryMotion.time`; пауза и reduced motion учитываются. Позиция камеры для рендера и выбора фото задаётся общей функцией `frontend/src/engine/galleryCameraPose.ts`.

- Источник порядка — `GALLERY_EVENT_ORDER` в `frontend/src/scenes/gallery/catalog.ts`; ID папки — стабильный ID события. `frontend/src/scenes/gallery/content.ts` собирает данные из корневых `images/<event ID>/`; подписи отдельно хранятся по ID в `frontend/src/data/galleryCaptions.json`. `GalleryMemory.image` — главное фото (может отсутствовать у placeholder-события), `images` — до четырёх фото вместе с главным.
- Поддерживаются `jpg`, `jpeg`, `png`, `webp`, `avif`. Точные имена `1`–`4` с таким расширением задают слоты; остальные имена, включая `photo_12.jpg`, естественно сортируются в свободные слоты. Берутся максимум четыре фото; если слот 1 пуст, первое доступное фото продвигается в главный слот. Папки без фото пропускаются, кроме папок с `.gallery-placeholder`; пустая подпись не рисуется.
- Функции `getFocusedGalleryCollagePhotos` и `getGalleryCollagePhotoLayout` находятся в `frontend/src/scenes/gallery/collage.ts`. По `galleryMotion.focusMix` дополнительные заполненные слоты 2–4 монтируются только для выбранного воспоминания, сохраняя номера слотов; частицы сходятся к фото до роста его прозрачности. Главное фото остаётся видимым во время прогулки.
- `GALLERY.travel` вычисляется из числа собранных воспоминаний; маршрут мира и напольные огни используют эту длину. Рябь и отражения принадлежат `waterMaterial.ts` и `planarReflection.ts`, облака и haze — `world.ts` и `cloudMaterial.ts`; данные/коллаж не меняют освещение и переходы. Дальний haze-массив в `world.ts` сохраняет opacity 0.19.
- Настройки галереи находятся в `scenes.gallery`, Scene Composer schema v19; DEV Inspector переключает A «На колоннах» и B «Между колоннами», B выбран по умолчанию.

Из `frontend/`: `npm run dev` — локальный запуск на `127.0.0.1:5173`; `npm run check` — lint, Vitest, typecheck и production build. Координатор проверил `npm run check` 2026-11-04: exit 0, 488 тестов в 97 файлах.
Прогоны и требования записываются в `.autopilot/`; требование снимается только пользователем.
<!-- autopilot:end -->
