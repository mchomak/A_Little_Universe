# Архитектура

## Текущий каркас

Модульный монолит: React SPA и необязательный минимальный FastAPI backend. Сцены 00/00.1/01 реализованы по текущему брифу; 02–09 сохраняют технические placeholders. Нарративный источник — [Storyboard v2.0](../A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md); главы 02–09 сохранены из [v1.1](../A_Little_Universe_for_Vasilisa_Storyboard_v1.1.md).

```text
Bootstrap (лёгкий Preloader → AssetManager → lazy App/Three → проверка SW-кэша)
App (settings → checking → ready → film; useFilm, reduced motion, gallery swipe)
  ├─ MediaSession (один stream, recorder, IndexedDB, recovery)
  ├─ AudioDirector (gesture unlock, cues, pause/speed/visibility)
  ├─ PersistentLight (один центр ready → prologue)
  ├─ PreparationScreen + повторяемый Preloader в DEV
  ├─ SceneComposerConfig (schema/defaults/store; optional startup JSON)
  ├─ FilmCanvas (один постоянный WebGL2 Canvas)
  │   ├─ CameraDirector (единственный владелец камеры)
  │   └─ SceneDirector → один из девяти статически импортированных модулей
  ├─ SceneOverlay → prompts / gallery / GreetingOverlay / ending
  ├─ ReadingPanel (modal dialog)
  ├─ RecordingControls + RecoveryPanel (DOM вне Canvas, вне lifetime сцен)
  └─ DeveloperPanel (lazy import и UI только в DEV)

useFilm → filmReducer + createFilmClock → FilmRuntime
                                  └─ точное время → paused scene/camera/DOM timelines
FastAPI → GET /health → {"status":"ok"} (фильм его не вызывает)
```

`FilmCanvas` не имеет ключа сцены и остаётся смонтированным при переходах, replay и dev seek. `SceneDirector` меняет только содержимое по `scene:revision`; все девять модулей импортированы заранее. Камера, renderer и контекст принадлежат engine, не scene-модулям. Фон и общий свет заданы в `SceneDirector`.

## Конфигурация и Scene Composer

SceneComposerConfig публикует immutable schema v2 в `systems/scene-config/config.ts`; `normalizeConfig` по-прежнему принимает schema v1 и переносит совместимые поля, не пропуская неизвестные значения. Компоненты подписываются на общий store; DEV Composer меняет тот же объект и использует существующие film controls. Production читает optional same-origin `/scene-composer.json` после успешной готовности AssetManager. Его отсутствие, ошибка сети или malformed JSON не блокирует фильм. Локальные art-font assets входят в production manifest; смена face ждёт `document.fonts` load/check, затем обновляет config. Composer не создаёт второй clock, renderer или Canvas.

Для пролога schema v2 управляет локальным шрифтом и композицией текста, count, wind, turbulence, шириной и длительностью шумного фронта, длительностью travel и отдельным затуханием частиц, быстрым письмом prompt и glow. Текущие defaults: 1 800 точек, wind 1,15, turbulence 0,3, fracture width 0,08, fracture 2,6 с, travel 4 с, fade 2,4 с, prompt writing 0,65 с и glow 0,45. Старые JSON остаются читаемыми; старый возврат частиц к центру не применяется.

## Пролог: текст и пепельный распад

Четырёхкадровый art-direction reference — `key_frames/splitting the text.png`; он задаёт визуальную последовательность письма и распада, но не включается в runtime assets и не отображается как изображение фильма.

`PrologueOverlay` держит фразы и touch prompt в доступном DOM-слое вокруг неизменной центральной точки. Цельная строка раскрывается горизонтальной CSS-маской, а не отдельными глифами. Prompt использует тот же выбранный каталоговый script font и короткое письмо в финальном окне. `createPrologueOverlayTimeline` строит paused GSAP timeline, а `useSceneTimeline` привязывает его к общему `FilmRuntime`: pause, seek, playback speed, replay и hidden-tab pause используют то же время. `getPrologueFrames` сохраняет 21-секундный пролог, текущие окна фраз, удержание и touch gate.

`PrologueScene` остаётся внутри смонтированного `FilmCanvas` и добавляет один `THREE.Points` с `BufferGeometry` и `ShaderMaterial`. Временный offscreen Canvas2D растрирует локальный выбранный шрифт; сразу после `getImageData()` его backing store освобождается сбросом размеров, поэтому он не живёт до выхода из сцены. Canvas служит только readback-источником координат, а не вторым видимым Canvas или animation loop. Переносы DOM-текста измеряются по фактическим line fragments браузера и растрируются построчно с соответствующими origins. Particle birth, noisy fracture front, seed, движение вверх-влево, разделение на мелкую пыль и fade вычисляются детерминированно из текста и общего времени. Шейдер двигает точки весь 4-секундный travel, затухает каждую частицу на последних 2,4 секунды и гасит общий слой к 21-секундному gate. `BufferGeometry` очищается при пересборке на config change, а текущие geometry и declarative `ShaderMaterial` освобождаются R3F при выходе из сцены.

Low quality, высокий DPR и компактные/coarse-pointer экраны снижают количество точек; `prefers-reduced-motion` показывает текст сразу и скрывает пепельный слой, не меняя gate или переход. Цвета, consent flow, offline cache и код сцен 02–09 этим изменением не меняются.

## Управление фильмом

`engine/filmConfig.ts` содержит порядок, длительности и cues, копирайт и шесть placeholder-воспоминаний. `film.ts` определяет `FilmState`, действия и чистый reducer. `mode` (`ready`, `playing`, `transitioning`, `waiting`, `exploring`, `ended`) отделён от ручной `paused` и модального `reading`. `revision` меняется при переходе, replay, restart и seek; устаревшие callbacks reducer игнорирует.

| Сцена | Поведение при обычной скорости |
|---|---|
| prologue | 21 с, затем бесконечное ожидание касания точки/keyboard activation. Текущие default окна: свет 0–3, первая фраза 3–7, вторая 10–14,8, совместное удержание до 16, dissolve 16–21. Touch запускает 0,3 с transition по общим часам, затем growth. |
| `growth` | 23 с автоматически; затем закрытый бутон. |
| `bloom` | Неограниченное ожидание касания бутона/кнопки; после него 22 с раскрытия и созерцания. |
| `identity` | 34 с: схематичные частицы, имя в DOM, пустые карточки портрета и фотографии. |
| `gallery` | Без таймера. Шесть карточек, кнопки, вертикальный swipe и касание карточки. Продолжение истории доступно на последней карточке. |
| `eye` | 18 с; указатель слегка наклоняет радужку, последние 3 с — приближение камеры. Камера устройства не используется. |
| `cosmos` | 26 с: радужка, спираль частиц, схематичный букет. |
| `greeting` | 50 с показа поздравления/титров, затем ожидание кнопки «Завершить». Чтение доступно без таймера в modal dialog. |
| `ending` | Повтор фильма, повторный вход в галерею и чтение. Закрытие повторного просмотра возвращает сюда. |

Пауза не сбрасывает playhead. Чтение замораживает часы независимо от ручной паузы; закрытие сохраняет её прежнее значение. Повтор начинает пролог сразу, сбрасывая film state, и не начинает запись заново. Browser reload возвращает подготовку и сбрасывает согласия; записи живут отдельно в IndexedDB. History API и URL-маршруты сцен не используются; browser Back не является переходом между сценами.

## Часы и cleanup

`useFilm` создаёт один `createFilmClock` на revision. GSAP меняет скалярное время; `FilmRuntime` публикует его подписчикам каждый animation update. React получает `timeline-update` примерно раз в 100 мс и точное конечное время перед `timeline-complete`. Частицы и Three objects меняются через refs/буферы, без React state для каждого кадра.

`useSceneTimeline` в runtime-режиме строит **paused** GSAP timeline, сразу устанавливает текущее время и scrubs его по runtime. Сцена, камера и титры используют общие часы, а не несколько независимо идущих таймеров. `useSceneAnimation` адаптирует функцию `draw(time)` к этому механизму. Смена revision отменяет старые подписки и GSAP context; `context.revert()` откатывает изменения. Hook также сохраняет прежний standalone-режим для старой foundation-сцены, которая не входит в маршрут фильма.

Часы останавливаются при `paused`, `reading`, режиме вне `playing`/`transitioning` и `document.hidden`. Waiting pulse использует тот же runtime и тоже останавливается. В галерее film clock неподвижен, поэтому `createGalleryMove` имеет отдельный короткий tween фокуса: он синхронизирован с паузой, чтением, скоростью и visibility. При следующем фокусе предыдущий tween удаляется, текущая позиция сохраняется. Его duration берётся из `TIMING.camera.gallery`.

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

Личные фото, портрет и письмо сейчас отсутствуют. Подключать только предоставленные материалы; `COPY` и `MEMORIES` — точки замены временного текста и карточек. `AssetManager` проверяет и предварительно декодирует указанные images/audio/models/files; новый runtime asset должен входить в обязательный или optional manifest. Runtime-ассеты размещать в build-доступной frontend-директории, ограничивать разрешение/память. Не включать всю папку референсов в bundle. Сложные shader/particle-системы вводить по требованиям конкретного кадра и измерениям планшета.

## Сеть, звук и optional media

Первый Canvas2D кадр рисуется до импорта Three. `AssetManager.prepare/retry` сообщает завершённые реальные единицы, проверяет HTTP/content/digest и доступную декодировку; cache verification является отдельным неизмеряемым этапом. Vite выпускает версионированные runtime manifest и Service Worker. Offline readiness требует читаемых ответов всех mandatory ресурсов текущей сборки, а не только регистрации SW. Отсутствующий ресурс блокирует обязательную готовность; cache/storage failure разрешает продолжить уже загруженный фильм с явным ограничением offline reload. Неудачный ES-module import браузер мемоизирует: после восстановления сети требуется reload. SW не кэширует камеры, записи или API.

App владеет одним `MediaSession` и одним `AudioDirector` вне scene lifetime. Отложенный cleanup отменяется повторным StrictMode effect setup; фактическое размонтирование освобождает services. `restore()` вызывается один раз и не запрашивает permissions. Согласия только в памяти, исходно false. Settings continue — единственное место `prepare()`; отмена/смена опций инвалидирует generation, поздний getUserMedia освобождает tracks. Один video stream переиспользуется, audio добавляется лишь при recording consent. Прежде чем объявить readiness, проверяются live video/audio и MIME. MediaPipe пока нет: UI прямо сообщает о будущем трекере.

Gift click вызывает `AudioDirector.unlock()` до первого await. Затем `MediaSession.start()` разрешён только consent + prepared recording status; optional failures не блокируют film start. DEV/replay не вызывают start recorder. Audio cues подключены к shared runtime, pause/speed/visibility; музыкальные buffers не предоставлены, fake playing отсутствует.

IndexedDB `little-universe-reactions-v1` хранит sessions и ordered chunks. Recorder запрашивает фрагменты каждые 4 с; последовательная transaction queue ограничена 8 pending chunks / 32 МиБ. Stop ждёт финального dataavailable и всех commit перед complete. Ошибка storage, recorder или pagehide оставляет recovery/incomplete, а не fake saved. Финал завершает запись и сбрасывает optional consent, освобождая все tracks; DEV jump/restart тоже сбрасывает согласия и не начинает запись. DOM controls/recovery остаются доступными во всех сценах. Export собирает долговременные chunks, сообщает только о запросе браузерного download. Delete требует отдельного подтверждения. Сеть для локальной записи не используется. Хранилище может быть очищено браузером, последние фрагменты при закрытии не гарантированы.

Backend содержит только health/configuration. Upload disabled с причиной, upload-запросов нет. Камера, запись и будущая передача — три независимых решения; кадры камеры для трекера не отправляются. Проверки и device limitations: [verification.md](verification.md).
