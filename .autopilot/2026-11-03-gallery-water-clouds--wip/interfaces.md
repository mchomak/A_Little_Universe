# Границы и правила

Стек React/TypeScript/R3F/Three.js/GSAP; без новых зависимостей. Один persistent canvas и существующий galleryMotion clock. `cd frontend; npm run check`; один тест: `npm test -- src/scenes/gallery/waterMaterial.test.ts`.

Вода владеет WetFloor.tsx, waterMaterial.ts, planarReflection.ts, GalleryScene.tsx, Scene Composer config/тесты и DeveloperPanel/controls, docs/scene-05-gallery.md и scene-config README. Облака владеют MoonlitWorld.tsx, world.ts, cloudMaterial.ts и их тестами. Не редактировать чужую зону и не отменять чужие изменения. Облачные настройки не меняются без сообщения координатору. При нехватке зависимости вернуть BLOCKED.

Публичные настройки остаются в SceneComposerConfig.scenes.gallery, диапазоны синхронны с нормализацией и Inspector, старые профили совместимы. Пауза и reduced motion используют текущий clock. Метрики до/после сравнивать при одинаковом размере окна/камере/качестве; GPU ресурсы освобождать.

Дополнение: таск 03 владеет колоннами, камерой и водным материалом; таск 04 — облаками, их конфигурацией и UI. Пересечения согласовываются через координатора. Скорость 0 сохраняется как остановка; старые профили не ломаются.
