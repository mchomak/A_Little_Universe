# Архитектура

## Текущий каркас

Модульный монолит: React SPA и необязательный минимальный FastAPI backend. Девять сцен — явно обозначенные технические placeholders. Они проверяют маршрут и взаимодействия, а не заменяют утверждённые keyframes. Нарративный источник: [Storyboard v1.1](../A_Little_Universe_for_Vasilisa_Storyboard_v1.1.md).

```text
App (DOM, useFilm, reduced motion, gallery swipe)
  ├─ FilmCanvas (один постоянный WebGL2 Canvas)
  │   ├─ CameraDirector (единственный владелец камеры)
  │   └─ SceneDirector → один из девяти статически импортированных модулей
  ├─ SceneOverlay → prompts / gallery / GreetingOverlay / ending
  ├─ ReadingPanel (modal dialog)
  └─ DeveloperPanel (lazy import и UI только в DEV)

useFilm → filmReducer + createFilmClock → FilmRuntime
                                  └─ точное время → paused scene/camera/DOM timelines
FastAPI → GET /health → {"status":"ok"} (фильм его не вызывает)
```

`FilmCanvas` не имеет ключа сцены и остаётся смонтированным при переходах, replay и dev seek. `SceneDirector` меняет только содержимое по `scene:revision`; все девять модулей импортированы заранее. Камера, renderer и контекст принадлежат engine, не scene-модулям. Фон и общий свет заданы в `SceneDirector`.

## Управление фильмом

`engine/filmConfig.ts` содержит порядок, длительности и cues, копирайт и шесть placeholder-воспоминаний. `film.ts` определяет `FilmState`, действия и чистый reducer. `mode` (`ready`, `playing`, `waiting`, `exploring`, `ended`) отделён от ручной `paused` и модального `reading`. `revision` меняется при переходе, replay, restart и seek; устаревшие callbacks reducer игнорирует.

| Сцена | Поведение при обычной скорости |
|---|---|
| `prologue` | Стартовая кнопка запускает 16 с, затем ожидание касания точки или DOM-кнопки. |
| `growth` | 23 с автоматически; затем закрытый бутон. |
| `bloom` | Неограниченное ожидание касания бутона/кнопки; после него 22 с раскрытия и созерцания. |
| `identity` | 34 с: схематичные частицы, имя в DOM, пустые карточки портрета и фотографии. |
| `gallery` | Без таймера. Шесть карточек, кнопки, вертикальный swipe и касание карточки. Продолжение истории доступно на последней карточке. |
| `eye` | 18 с; указатель слегка наклоняет радужку, последние 3 с — приближение камеры. Камера устройства не используется. |
| `cosmos` | 26 с: радужка, спираль частиц, схематичный букет. |
| `greeting` | 50 с показа поздравления/титров, затем ожидание кнопки «Завершить». Чтение доступно без таймера в modal dialog. |
| `ending` | Повтор фильма, повторный вход в галерею и чтение. Закрытие повторного просмотра возвращает сюда. |

Пауза не сбрасывает playhead. Чтение замораживает часы независимо от ручной паузы; закрытие сохраняет её прежнее значение. Повтор начинает пролог сразу, сбрасывая настройки к исходным. Все состояния находятся в памяти: browser reload возвращает стартовый экран. History API и URL-маршруты сцен не используются; browser Back не является переходом между сценами.

## Часы и cleanup

`useFilm` создаёт один `createFilmClock` на revision. GSAP меняет скалярное время; `FilmRuntime` публикует его подписчикам каждый animation update. React получает `timeline-update` примерно раз в 100 мс и точное конечное время перед `timeline-complete`. Частицы и Three objects меняются через refs/буферы, без React state для каждого кадра.

`useSceneTimeline` в runtime-режиме строит **paused** GSAP timeline, сразу устанавливает текущее время и scrubs его по runtime. Сцена, камера и титры используют общие часы, а не несколько независимо идущих таймеров. `useSceneAnimation` адаптирует функцию `draw(time)` к этому механизму. Смена revision отменяет старые подписки и GSAP context; `context.revert()` откатывает изменения. Hook также сохраняет прежний standalone-режим для старой foundation-сцены, которая не входит в маршрут фильма.

Часы останавливаются при `paused`, `reading`, режиме вне `playing` и `document.hidden`. В галерее film clock неподвижен, поэтому `createGalleryMove` имеет отдельный короткий tween фокуса: он синхронизирован с паузой, чтением, скоростью и visibility. При следующем фокусе предыдущий tween удаляется, текущая позиция сохраняется. Его duration берётся из `TIMING.camera.gallery`.

GSAP contexts, runtime subscriptions, visibility listeners, gesture listeners и debug rAF отменяются при cleanup. R3F освобождает декларативные geometry/material при размонтировании. `FilmCanvas` снимает listener потери контекста. Ошибка и context loss показывают fallback с перезагрузкой; восстановление текущего кадра после context loss не реализовано.

## Качество и уменьшенное движение

Canvas использует `frameloop="demand"`; анимации вызывают `invalidate()`. `standard` ограничивает DPR диапазоном 1–1.5, `low` — значением 1. Общие облака содержат 240 либо 90 точек соответственно. Low не является автоматически измеренным профилем устройства. Postprocessing, внешние HDRI и shadow maps не добавлены.

`prefers-reduced-motion` отслеживается в браузере: отключает основную хореографию камеры, переход камеры галереи становится мгновенным, сокращаются движения геометрии/частиц и вместо прокрутки титров используется статичный вариант. Длительности, очередность и ручные gates сохраняются; это не полная остановка всех visual updates. Письмо можно открыть отдельно для неподвижного чтения.

## Как добавить сцену

1. Сверить её сегмент сценария и утверждённые keyframes. Ввести `SceneId`, порядок, duration/cues и entry mode в `film.ts` / `filmConfig.ts`; явно определить reducer-переходы и interaction gate.
2. Создать scene-модуль с `SceneProps` и статически включить его в `SceneDirector`. Возвращать Three objects без нового Canvas/renderer и без разрешений устройств.
3. Строить локальную анимацию через runtime и `useSceneTimeline` / `useSceneAnimation`; менять refs и GPU-буферы. Не использовать локальный таймер для автоматического перехода: completion принадлежит film clock/reducer.
4. Изменять композицию камеры через `CameraDirector`. Добавить доступный DOM-prompt/оверлей в `components`, если нужен input или текст.
5. Проверить reducer sequence/gates, pause/reading/visibility, seek/replay и cleanup; выполнить `npm run check` и браузерный проход без dev-пропусков.

## Как заменить placeholder художественным материалом

Сначала утвердить референсы в `references/keyframes/`, сохранив оригиналы и статус draft/approved. Заменять геометрию внутри scene-модуля или `scenes/shared/Primitives.tsx`, сохраняя интерфейс `SceneProps`, cues, gates и единственный Canvas. Текущая лилия управляется именованными группами `stem`, `head`, `petal-0`…`petal-5`; при смене модели адаптировать `lilyPose`, а не полагаться на случайную иерархию объекта.

Личные фото, портрет и письмо сейчас отсутствуют. Подключать только предоставленные материалы; `COPY` и `MEMORIES` — явные точки замены временного текста и списка карточек, но готового загрузчика изображений ещё нет. Runtime-ассеты размещать в build-доступной frontend-директории, ограничивать разрешение/память и предусматривать реальные загрузку, ошибки и retry. Не включать всю папку референсов в bundle. Сложные shader/particle-системы вводить по требованиям конкретного кадра и измерениям планшета.

## Сеть, звук и optional media

Текущий маршрут использует локальную геометрию, системные шрифты и статические модули. Он не делает API-запросов, не требует внешних изображений/моделей/аудио и не запрашивает camera/mic permissions. Это не persistent offline cache: Service Worker и offline reload отсутствуют. Результат проверки отключения сети после загрузки указан отдельно в [verification.md](verification.md).

Audio director, загрузчик художественных ассетов, MediaPipe, getUserMedia, MediaRecorder, local chunks и upload не реализованы. Будущие tracking, запись и отправка требуют трёх независимых согласий. Tracking остаётся на устройстве; отказ любой optional возможности должен сохранять фильм. Backend сейчас содержит только health/configuration и не принимает видео. Не добавлять фиктивные проценты preload или сообщения об успешном сохранении.
