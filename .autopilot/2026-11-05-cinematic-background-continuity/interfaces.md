# Интерфейсы и правила реализации

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `FilmRuntime` | актуальное время и scrub/replay фильма | подписку на текущий frame/time | wall-clock и внутреннюю модель времени |
| `PhoneBackground` | DOM-изображение космоса и кроп 00–04 | текущую нормализованную позу фона | DOM-разметку и вычисление CSS crop |
| `SceneDirector` | выбор сцены и устойчивость общего окружения | общий фон для временного диапазона 02–04 | правила сохранения scene instances |
| `GrowthSky` | градиент ночной атмосферы и opacity uniform | атмосферную opacity из нормализованного падения | shader-код и цветовые переходы |
| `GrowthClouds` | существующие облачные фрагменты, позиции и ресурсы | uniforms видимости/цвета и world-space transforms | геометрию, noise и disposal |
| `GrowthMoonlight` | направленный свет острова и лилии | существующую анимированную интенсивность | расположение и внутренние light uniforms |

Шов поведения: нормализованный прогресс уже существующего падения и существующие функции движения/видимости облаков. Не добавлять отдельную систему времени. Обновлять shader/uniform напрямую из FilmRuntime; не вызывать React state на каждом кадре.

Компонентный контракт: `GrowthSky({ runtime: FilmRuntime, fallRange: [startFrame, endFrame], nightEstablished: boolean })`. Он подписывается на текущие frame updates и обновляет opacity uniform напрямую через существующий normalized-progress helper; React state и wall-clock не участвуют. `nightEstablished` true при прямом входе в bloom/identity и после завершённого падения, false во время формирования/падения семени. При переносе владельца sky этот контракт сохраняется.

## Стек и версии

- Node.js `^22.12.0 || >=24.0.0`.
- React `19.3.1`, TypeScript `6.0.3`, Vite `8.3.5`.
- Three.js `0.186.1`, React Three Fiber `9.8.2`, GSAP `3.15.0`.
- Никаких новых зависимостей и новых runtime-фонов/изображений.

## Команды

- Установка уже существующего lockfile: `Set-Location frontend; npm ci`.
- Локальный сервер: `Set-Location frontend; npm run dev` (`http://127.0.0.1:5173`).
- Проверка: `Set-Location frontend; npm run check` (lint, Vitest, typecheck и production build).
- Production build отдельно: `Set-Location frontend; npm run build`.

Неустановленную зависимость не добавлять. Вернуть `BLOCKED` с именем недостающего пакета.

## Что нельзя менять

- Не редактировать материалы сцены 05, её фотографии, воду, колонны, луну или освещение; не менять Galaxy/сцену 07 и маршрут сцены 06.
- Не менять seed particles, анимацию/камеру, GLB Lily 004, рост, листья, bloom, вихрь, портрет, проявление фото, рамку и камеру сцены 04.
- Не менять DEV-пресеты семени, роста и галереи, версию Scene Composer, настройки пользователя или `start_img.jpg`.
- Не переносить код из старых Scene 02 веток, не создавать новый worktree, не перезаписывать чужие незакоммиченные изменения.
- Не добавлять тяжёлые зависимости, новые изображения, отдельный renderer или volume cloud system.

## Lifecycle и DEV

- Background progress должен браться из текущего `FilmRuntime` времени и действующих fall frames, не из wall-clock/absolute seconds.
- Прямой вход в 03/04 задаёт уже завершённое ночное состояние; перемотка/повтор к началу сбрасывает fade и opacity детерминированно.
- Сохранять единственный persistent WebGL canvas. Не накапливать mesh/tween; освобождать geometry/material на unmount.
- Существующие seams: `phoneBackgroundMotion.test.ts`, `growthClouds.test.ts`, `sceneContinuity.test.ts`.
- Проверять локально в браузере на debug timeline `/?debug`; не менять DEV-пресеты.

## Из таска 01 — кроссфейд космоса

- `GrowthSky({ runtime: FilmRuntime, fallRange: readonly [number, number], nightEstablished: boolean })` подписывается на FilmRuntime, рассчитывает opacity shader из `getPhoneBackgroundProgress(time, fallRange)` и снимает подписку при cleanup.
- `getPhoneBackgroundProgress(time, fallRange)` остаётся существующим общим helper для crop и normalized progress; его контракт не изменён.
- Браузерное подтверждение финальной смешанной картинки выполняется после интеграции таска 03 и визуального прохода таска 04.

## Ticket 02/03 cloud continuity

`GrowthClouds({ runtime, nightEstablished })` reads normalized fall progress from the shared `FilmRuntime` while falling. When `nightEstablished` is true, it holds the settled cloud sea at its final visibility and suppresses fly-through wisps, regardless of a scene-local clock reset. `GrowthScene` wires the same established-night state to `GrowthSky` and `GrowthClouds`; direct entry into scenes 03/04 uses the established state. Keep the existing cloud meshes and positions persistent across 02?03.

## Scene background restoration

`SceneDirector` owns the `THREE.Scene.background` handoff. When entering opening/Growth states, it clears any retained dark scene color so the transparent film canvas reveals the existing `PhoneBackground` until normalized fall progress establishes the night shader. Direct entry and replay must not retain a color from Scene 05 or another dark scene.

## GrowthSky lifecycle

`SceneDirector` mounts the existing single `GrowthSky` over scenes 02?04 because `GrowthScene` unmounts during late identity. `GrowthScene` must not render a second sky. The persistent instance receives the shared `runtime`, fall range, and `nightEstablished` state and keeps the same WebGL canvas.

## Moonlight levels

`moonlight.ts` owns the existing post-impact key/fill level curve. Keep the short impact pulse and overhead key curve unchanged; the side-reflected fill stays smooth and peaks at or below 25% of the overhead key. `GrowthMoonlight` orients the existing fill from the island side without lighting the scene background. `GrowthMoonlight.test.ts` covers the bounded fill relationship.
