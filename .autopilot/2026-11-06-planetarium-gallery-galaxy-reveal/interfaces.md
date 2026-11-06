# Границы и интерфейсы

## Gallery catalog and layout
- Владение: соответствие актуальных папок каталогу и placement каждого event memory.
- Существующая поверхность: GALLERY_EVENT_ORDER, GALLERY_EVENT_PHOTO_FILES, GALLERY_MEMORIES, memoryPosition(...), galleryColumnPositions(...).
- Изменение: добавить финальный Planetarium anchor под аркой и убрать поддержку для его карточки; не менять раскладку других memories.
- Позиция Planetarium вычисляется одним общим arch-aware helper в gallery/archPlacement.ts; тот же helper используют GalleryScene и engine/galleryCameraPose.ts, чтобы рендер и камера фокусировались на одном anchor.
- T01 владеет engine/galleryCameraPose.ts только для подключения shared placement helper. T02 не меняет этот файл.
- Не владеет: film state, camera timing, Galaxy geometry.
- Проверка шва: memoryPosition и GALLERY_MEMORIES через существующие unit-level tests; тесты не запускать по запросу пользователя.

## Film routing and CameraDirector
- Владение: scene list, обычный route и общий camera pose.
- Существующая поверхность: SceneId, SCENE_ORDER, filmReducer, CameraDirector.
- Изменение: user-visible route omits Eye; final gallery path enters cosmos directly; debug jump to cosmos remains available.
- Не владеет: image texture, overlay blur shader, Galaxy star geometry.

## PlanetariumTransitionOverlay
- Владение: texture handoff, fullscreen crop, blur, opacity and fade order.
- Существующая поверхность: registerPlanetariumPhotoTexture, capturePlanetariumPhotoRect, PlanetariumTransitionOverlay.
- Изменение: source photo pixel mask/blur progress is special-route-only; no duplicated renderer or independent clock.
- Не владеет: permanent camera route and galaxy animation.

## GalaxyExperience
- Владение: existing Galaxy points, galaxy layers, palette, reveal and spin.
- Существующая поверхность: getGalaxyRevealState, existing point materials and shared film clock.
- Изменение: during the Planetarium route only, existing point layers may sample the live photo to restrict opacity in screen UV; ordinary cosmos/greeting/ending materials and Dev config remain unchanged.
- Не владеет: photo catalog and photo lifecycle.

## Stable test seam
Use the existing pure catalog/placement functions and reveal-state function. No new public API is required. Run only the user-requested typecheck and production build; do not run browser or visual validation.
