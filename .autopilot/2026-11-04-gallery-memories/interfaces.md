# Интерфейс

GalleryMemory: image — главное фото, images — до четырёх фото включая главное, caption — из JSON, id — стабильный ID события; координаты и порядок существующего focus-контроллера остаются согласованными. Файлы сценария 05 не меняют освещение и переходы.


## From T01 ? gallery data

- `GALLERY_EVENT_ORDER: readonly string[]` ? the explicit brief order, keyed by stable folder IDs.
- `createGalleryEventMemories(eventOrder, assets, captions, palettes, placeholderEvents?) -> GalleryMemory[]`.
- `GalleryMemory.id` is the event folder ID; `images` contains available numbered/fallback photos; `image` may be absent for a placeholder event; `caption` is read by ID and omitted when empty.
- Empty folders are skipped; folders with non-photo files but no supported stills can be represented through `placeholderEvents`.


## From T02 ? scene and collage

- `getGalleryCollagePhotos(images) -> GalleryCollagePhoto[]` returns only available additional images for slots 2?4.
- `getGalleryCollagePhotoLayout(slot, side, mainWidth, mainHeight, aspect) -> GalleryCollagePhotoLayout` places a photo relative to the main image and wall side.
- The scene uses the selected `GalleryMemory.images` with the existing `galleryMotion.focusMix`; the main image stays visible during travel, and extra photos reveal through target-position particles before their textures appear.
- Gallery route and environment coverage derive from the dynamic `GALLERY.travel` length; existing haze opacity remains 0.19.
- `getFocusedGalleryCollagePhotos(images, memoryOrder, focusedOrder) -> GalleryCollagePhoto[]` exposes only populated additional slots for the currently focused memory.
