# Что уже построено

## Границы, решённые в спецификации

- **Gallery entry timeline** — владеет фазами fade и определением их длительности. Чистая поверхность: `getGalleryEntryRevealAlpha(elapsed, phase, index?) -> number`, `getGalleryEntryRevealDuration(entryCount) -> number`. Возвращаемая alpha — доля штатной видимости элемента, диапазон 0–1; `entryCount` отражает последовательные элементы актуальной композиции, включая отдельные опоры.
- **Gallery controller** — владеет одним elapsed `galleryMotion.entryReveal` и начинает существующий `galleryMotion.intro` только после последнего элемента последовательности и fade арки. `advanceGallery(dt, reducedMotion?)` использует тот же render loop, что и сейчас. Компоненты читают общие часы без React-state обновлений на кадр.
- **Gallery visual layers** — каждый слой перемножает alpha этапа со своей текущей штатной прозрачностью/настройкой: вода и planar reflection; clouds/haze/moon/light; фото и поддерживающие столбцы по глубине; фото без опоры получает свой шаг; арка после всех этих элементов.
- **Gallery camera** — остаётся во владении `CameraDirector` и существующего `galleryCameraPose`. Во время reveal `galleryMotion.intro` удерживается на нуле, тем самым камера и карточка Scene 04 остаются в общей стыковочной позе. Исходная кривая и длительность intro не меняются.
- **Gallery instructions** — существующая `GalleryOverlay` остаётся без правок визуального содержания. Она появляется через существующий controller после окончания reveal и текущего intro.

Шов проверки: функции alpha/длительности и `advanceGallery`/`gallerySnapshot`. Новые Canvas, render loops, clocks, таймеры браузера и per-frame React state запрещены.

## Общие правила проекта

- Стек: React 19, TypeScript 6, Vite 8, Three.js 0.186, React Three Fiber 9, GSAP 3; новые зависимости не устанавливать.
- Одна постоянная WebGL Canvas. Не менять film reducer, порядок/тайминг иных сцен, существующие controls, gallery navigation/focus, камеру или кривую движения первого фото. В этой задаче можно только задержать старт уже существующего Gallery intro до завершения reveal.
- Сохранять touch/coarse-pointer поддержку, reduced motion, паузу и остановку общего clock для скрытой вкладки. Слои должны вернуться к штатным прозрачностям; не менять Scene Composer значения.
- Удалить/освободить все добавленные GPU-ресурсы тем же способом, что и существующие материалы. Не создавать второй renderer/clock.
- Изменять только стык 04→05 и Gallery-визуальные слои; остальные сцены не менять.
- Не изменять эти незакоммиченные файлы соседней сессии и не включать их в git staging/commit: `frontend/src/components/GreetingOverlay.tsx`, `frontend/src/data/galleryCaptions.json`, `frontend/src/engine/filmConfig.ts`, `frontend/src/scenes/greeting/content.ts`.
- Остаёмся в существующем linked worktree `A_Little_Universe_main_production`, branch `main`. Все агенты работают в общей файловой системе: не откатывать чужие изменения; перед каждой правкой перечитывать текущее содержимое целевых файлов.
- Не коммитить из исполнительских субагентов. Root проверит diff и подготовит ticket commit, добавив только принадлежащие этой задаче файлы.

## Команды

- Один unit-файл: `npm test -- src/scenes/gallery/<file>.test.ts` из `frontend/`.
- Тесты: `npm test`.
- Проверка типов: `npm run typecheck`.
- Production build: `npm run build`.
- Полный проектный check (включает lint, desktop tests, unit tests и build): `npm run check`.

Если не хватает зависимости или необходимый контракт невозможно реализовать безопасно — вернуть `BLOCKED` с кратким объяснением; не устанавливать пакеты самостоятельно.

## Из таска 01 — последовательность и часы входа

- `createGalleryEntrySequence(memories, settings)` возвращает `steps` и `photoIndices`. Шаги содержат `kind`, стабильный индекс, `memoryOrder` и позицию; шаги колонн также содержат `supportIndex`. Сортировка: ближние к дальней по Z, равная глубина — слева направо. Фото без колонны — собственные шаги; первое фото Scene 04 не входит в photo fade, его опоры входят.
- Каждая последующая карточка получает индекс ближайшей к ней опоры через `photoIndices`; фотография без опоры получает индекс своего фото-шага.
- `getGalleryEntryRevealDuration(entryCount)` и `getGalleryEntryRevealAlpha(elapsed, phase, index?)` используют общий список шагов; для фазы `arch` индекс равен длине списка и арка всегда последняя.
- `advanceGallery(dt, reducedMotion?, entryCount?)` получает число шагов от текущего gallery layout в `galleryCameraPose`. Если пользователь меняет layout во время входа, таймлайн синхронно использует число элементов нового layout.

## Из таска 02 — alpha воды

- `WetFloor` читает `getGalleryEntryRevealAlpha(galleryMotion.entryReveal, 'water')` из общих часов и передаёт его в `updateGalleryWaterMaterial`.
- `updateGalleryWaterMaterial(material, settings, galleryTime, reducedMotion, entryRevealAlpha = 1)` умножает только штатный `waterOpacity` на ограниченный коэффициент этапа; текущие shader uniforms, normal map, reflection target, quality и cleanup остаются прежними.
- Вода и её planar reflection используют этот же материал и коэффициент alpha, чтобы появляться синхронно.

## Из таска 03 — alpha атмосферы и лунного света

- `getGalleryAtmosphereRevealAlpha(elapsed, phase: 'clouds' | 'moon')` оборачивает общую `getGalleryEntryRevealAlpha` с дополнительным clamp и не задаёт собственные длительности.
- `MoonlitWorld` подаёт alpha `clouds` в cloud/haze visibility fade; отдельная alpha `moon` управляет лунным диском, ореолами, scattering, источниками света и лунной подсветкой в cloud/haze шейдерах.
- Базовые Scene Composer opacities/intensities, движение атмосферы, качество шейдера, depth/cleanup остаются прежними; настройки только умножаются на текущую alpha-фазу.

## Из таска 04 — фото и отдельные опоры

- `GalleryScene` строит `createGalleryEntrySequence` по актуальному gallery settings и передаёт индекс фото и отдельные `supportIndex` в `Memory`.
- `galleryEntryItemAlpha(elapsed, index)` использует общую фазу item; `galleryEntryVisibility(introAlpha, entryAlpha)` удерживает карточку видимой после её завершённого item во время последующего штатного camera intro.
- `GalleryColumn` читает собственный индекс из одного ref-массива; shared alpha нескольких колонн запрещён. Факторы `exitMix` и distance остаются в обычной колонной alpha, focus/raycast остаются как прежде.
- Dust и floor glints используют среды `clouds` и `water`; нить каждой пары воспоминаний получает минимум alpha двух карточек на её концах и не видна раньше обоих endpoint.

## Из задачи 05 — alpha арки и переход к intro

- `GalleryScene` передаёт `entrySequence.steps.length` в `GalleryArch` как `entryIndex`; фаза `arch` использует общий entry clock и начинает только после последнего шага фото/опоры.
- `galleryArchEntryOpacity(configuredOpacity, distanceOpacity, entryRevealAlpha)` ограничивает каждое значение и перемножает их, сохраняя штатные `archOpacity` и distance fade при появлении арки.
- `advanceGallery` начинает прежнюю кривую движения камеры/портрета после полного reveal duration с аркой; memo по-прежнему показывается текущим controller после старого intro.
