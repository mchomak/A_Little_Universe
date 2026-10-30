# Архитектура

## Текущий каркас

Модульный монолит: React SPA и необязательный минимальный FastAPI backend. Сцены 00/00.1/01 реализованы по текущему брифу; сцена 02 формирует и опускает семечко, затем передаёт его схематичному началу роста, а дальнейший рост лилии остаётся placeholder. Сцена 04 содержит художественную последовательность с исходной фотографией; 03 и 05–09 сохраняют технические placeholders. См. [контракт и проверку сцены 02](scene-02-seed.md). Нарративный источник — [Storyboard v2.0](../A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md); главы 02–09 сохранены из [v1.1](../A_Little_Universe_for_Vasilisa_Storyboard_v1.1.md).

```text
Bootstrap (лёгкий Preloader → AssetManager → lazy App/Three → проверка SW-кэша)
App (settings → checking → ready → film; useFilm, reduced motion, gallery swipe)
  ├─ MediaSession (один stream, recorder, IndexedDB, recovery)
  ├─ AudioDirector (gesture unlock, cues, pause/speed/visibility)
  ├─ PersistentLight (один центр ready → prologue → handoff в growth)
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

SceneComposerConfig публикует immutable schema v3 в `systems/scene-config/config.ts`; `normalizeConfig` принимает schema v1/v2/v3 и сохраняет совместимые значения, не пропуская неизвестные поля. Компоненты подписываются на общий store; DEV Composer меняет тот же объект и использует существующие film controls. Production читает optional same-origin `/scene-composer.json` после успешной готовности AssetManager. Его отсутствие, ошибка сети или malformed JSON не блокирует фильм. Локальные art-font assets входят в production manifest; смена face ждёт `document.fonts` load/check, затем обновляет config. Composer не создаёт второй clock, renderer или Canvas.

Для пролога schema v2 аддитивно содержит Light, Atmosphere, Typography, Dissolve и Interaction. Старые v1/v2 JSON получают defaults новых полей; presets, reset и import/export сохраняются. Яркость ядра, ореола, текста и пыли регулируется раздельно. Defaults: Marck Script, первая фраза 48 px, вторая ×0,86; 1 800 световых частиц до quality/DPR scaling; wind 1,15, turbulence 0,3, fracture 1,5 с, travel 2,2 с, fade 1,2 с; дыхание 0,22 Гц и амплитуда 0,035; touch 0,85 с. `copyVariant: 'awakening' | 'legacy'` сохраняет новую и прежнюю редакции второй фразы.

Schema v3 добавляет единую графическую систему галактики для сцен 07–09 и поле `scenes.galaxy`. Seed, число и форма звёзд, качество, радиус и глубина диска меняют детерминированную геометрию после 280 мс без новых правок; цвета, мерцание, газ, fog, свет и движение меняются через uniforms. `Vasilisa Cinematic` и пять самостоятельных цветовых интерпретаций доступны через palette selector; пользовательские цвета переводят палитру в `custom`. В SceneDirector галактика смонтирована вне keyed сцены и сохраняет геометрию и материалы между переходами. CameraDirector ведёт единственную камеру от начального обзора к общему трёхчетвертному кадру.

Scene 09 сохраняет режим `ended`, поэтому его атмосферное время публикуется существующим FilmClock в `runtime.presentationTime`; каноническое время сцены и reducer не продвигаются. Это использует общий GSAP clock и общий renderer, уважает pause/visibility и не добавляет отдельный ticker. Из-за бессрочного финального режима его кадр нельзя перематывать через обычный Timeline; детерминированный seek применяется к сценам 07–08.

## Пролог: пробуждение света и световая пыль

Референс `key_frames/splitting the text.png` остаётся художественным ориентиром, не runtime-текстурой. Текущий бриф уточняет рукописную типографику, минималистичную глубину и 18-секундную режиссуру.

`PrologueOverlay` владеет доступным текстом и измеряемой DOM-композицией вокруг света, а также touch prompt. После готовности GPU-слоя DOM-фразы остаются семантическим и измерительным источником без дублирования видимых пикселей. `PrologueScene` растрирует реальные строки выбранного локального шрифта через `prologue/letterMatter.ts` и создаёт для каждой фразы общую texture-карту: alpha штрихов, локальное время письма, карта разрушения и мягкое свечение. Shader ink и выборка GPU-пыли читают одну карту, поэтому исчезновение участков и рождение независимых частиц согласованы. Ритм письма используется фактически. Points двигаются аналитически вверх-влево с инерцией и слабым органическим полем; индивидуально затухают и уменьшаются. К 16 с остатки света уходят, затем появляется приглашение.

Canvas2D используется только при пересборке ресурсов, не как второй видимый Canvas или отдельный clock. Готовность шрифта, фактические переносы DOM и resize/layout учитываются перед выборкой; поздние результаты после cleanup игнорируются. Texture/BufferGeometry и подписки освобождаются. Low quality, DPR и компактные/coarse-pointer экраны снижают плотность пыли; reduced motion сохраняет читаемые фразы и мягкое исчезновение без активной пыли.

`PersistentLight` остаётся одним app-level DOM-объектом. Его маленькое ivory ядро, внутреннее нелинейное свечение, почти неразличимое внешнее рассеивание и одноразовая тонкая волна получают позу из чистого `prologue/lightPose.ts`. `runtime.subscribePresentation` обновляет CSS-параметры без React rerender на кадре и без независимой CSS-анимации пролога. Native button даёт невидимый touch radius 60–80 CSS px и keyboard activation только на gate. Пауза доступна над canvas. На границе 02 app-свет остаётся в том же центре viewport и за 1,15 с передаёт видимость существующему growing seed; прежний дублирующий `SeedLight` в GrowthScene удалён. Другую режиссуру сцены 02 это не меняет.

`PrologueAtmosphere` добавляет одну процедурную плоскость низкого контраста и редкие points в тот же renderer. Основные цвета передаются как Three Color с корректным linear→sRGB преобразованием; новые фоновые текстуры и postprocessing не нужны. Глубина проявляется после первых секунд, количество пылинок зависит от качества; дрейф управляется presentation time общих часов. Reduced motion отключает эти частицы. Камера пролога остаётся неподвижной.

## Управление фильмом

`engine/filmConfig.ts` содержит порядок, длительности и cues, копирайт и шесть воспоминаний: первая фотография настоящая, остальные временные. `film.ts` определяет `FilmState`, действия и чистый reducer. `mode` (`ready`, `playing`, `transitioning`, `waiting`, `exploring`, `ended`) отделён от ручной `paused` и модального `reading`. `revision` меняется при переходе, replay, restart и seek; устаревшие callbacks reducer игнорирует.

| Сцена | Поведение при обычной скорости |
|---|---|
| prologue | 18 с, затем бесконечное ожидание касания/keyboard activation. Default окна: свет 0–2, первая фраза 2–5,5, вторая 7–10,5, удержание 10,5–12,5, dissolve 12,5–16, приглашение 16–18. Touch запускает настраиваемый transition 0,7–1 с (default 0,85), затем growth. |
| `growth` | 23 с автоматически; затем закрытый бутон. |
| `bloom` | Неограниченное ожидание касания бутона/кнопки; после него 22 с раскрытия и созерцания. |
| `identity` | 34 с: GPU-частицы → имя → ASCII-портрет → исходная фотография. В 28–34 с — сборка подписи, тонкая кромка и отъезд камеры к галерее. |
| `gallery` | Без таймера. В навигацию входят только предоставленные воспоминания: сейчас одна реальная фотография. Касание и swipe сохраняют допустимые границы; «Назад»/«Вперёд» отключены, если соседней фотографии нет. Продолжение доступно на последней имеющейся фотографии. |
| `eye` | 18 с; указатель слегка наклоняет радужку, последние 3 с — приближение камеры. Камера устройства не используется. |
| `cosmos` | 26 с: радужка, спираль частиц, схематичный букет. |
| `greeting` | 50 с показа поздравления/титров, затем ожидание кнопки «Завершить». Чтение доступно без таймера в modal dialog. |
| `ending` | Повтор фильма, повторный вход в галерею и чтение. Закрытие повторного просмотра возвращает сюда. |

Пауза не сбрасывает playhead. Чтение замораживает часы независимо от ручной паузы; закрытие сохраняет её прежнее значение. Повтор начинает пролог сразу, сбрасывая film state, и не начинает запись заново. Browser reload возвращает подготовку и сбрасывает согласия; записи живут отдельно в IndexedDB. History API и URL-маршруты сцен не используются; browser Back не является переходом между сценами.

## Часы и cleanup

`useFilm` создаёт один `createFilmClock` на revision. GSAP меняет скалярное время; `FilmRuntime` публикует его подписчикам каждый animation update. React получает `timeline-update` примерно раз в 100 мс и точное конечное время перед `timeline-complete`. Частицы и Three objects меняются через refs/буферы, без React state для каждого кадра.

`useSceneTimeline` в runtime-режиме строит **paused** GSAP timeline, сразу устанавливает текущее время и scrubs его по runtime. Сцена, камера и титры используют общие часы, а не несколько независимо идущих таймеров. `useSceneAnimation` адаптирует функцию `draw(time)` к этому механизму. Смена revision отменяет старые подписки и GSAP context; `context.revert()` откатывает изменения. Hook также сохраняет прежний standalone-режим для старой foundation-сцены, которая не входит в маршрут фильма.

Общий clock останавливается при `paused`, `reading` и `document.hidden`. В обычных сценах он работает в `playing`/`transitioning`; в ожидании пролога canonical `runtime.time` и reducer elapsed удерживаются на 18 с, а управляемый `presentationTime` продолжает декоративное дыхание через тот же GSAP clock. `subscribeFrame` обслуживает каноническое время, `subscribePresentation` — свет и атмосферу, включая waiting; отдельного таймера сцены нет. Pause/speed/visibility управляют обоими представлениями; seek/replay заново устанавливает детерминированную позу. Длительность touch фиксируется при действии в `FilmState.prologueTouchDuration`, поэтому live-изменение Composer не обрывает текущий переход. В галерее film clock неподвижен, поэтому `createGalleryMove` имеет отдельный короткий tween фокуса: он синхронизирован с паузой, чтением, скоростью и visibility. При следующем фокусе предыдущий tween удаляется, текущая позиция сохраняется. Его duration берётся из `TIMING.camera.gallery`.

GSAP contexts, runtime subscriptions, visibility listeners, gesture listeners и debug rAF отменяются при cleanup. R3F освобождает декларативные geometry/material при размонтировании. `FilmCanvas` снимает listener потери контекста. Ошибка и context loss показывают fallback с перезагрузкой; восстановление текущего кадра после context loss не реализовано.

Стык 04.7→05.1 задаёт `scenes/shared/firstMemoryFrame.ts`: общие конечные scale/rotation фотографии и camera pose. `CameraDirector` удерживает позу до 31 с, затем отъезжает к 34 с; прямой вход в галерею и фокус первого фото используют эту же конечную позу (в reduced motion — фронтальную). `FirstMemoryCard` и `FirstMemorySpace` общие для обеих сцен; объём на входе галереи удерживает фазу 34 с при остановленных exploration-часах. `FirstMemoryCaption` собирает подпись из 360 Canvas2D-частиц штрихов имени, затем показывает DOM-текст локальным Cormorant Garamond. Общий runtime управляет формированием и seek; дополнительных часов/WebGL-контекстов нет. Подробнее и контрольные снимки: [04.7](scene-04-7-vfx.md).

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

Первая фотография подключена, остальные фото и письмо пока отсутствуют. Подключать только предоставленные материалы; `COPY` и `MEMORIES` — точки замены временного текста и карточек. `AssetManager` проверяет и предварительно декодирует указанные images/audio/models/files; новый runtime asset должен входить в обязательный или optional manifest. Runtime-ассеты размещать в build-доступной frontend-директории, ограничивать разрешение/память. Не включать всю папку референсов в bundle. Сложные shader/particle-системы вводить по требованиям конкретного кадра и измерениям планшета.

### Передача частиц лилии в сцену 04

`scenes/shared/identityParticles.ts` задаёт `LilyParticleSource`: `sample(index, count)` синхронно возвращает конечную тройку `[x, y, z]` для индекса от `0` до `count - 1`. Координаты находятся в локальной системе сцены 04 (ось X вправо, Y вверх, Z к зрителю; начало совпадает с центром сцены), а не в пикселях или пространстве камеры. Для модели с собственным transform следует заранее преобразовать позиции в систему сцены. Передать источник через optional `particleSource` в `IdentityScene` вместо `mockLilyParticles`; сейчас `SceneDirector` использует значение по умолчанию, поэтому подключение потребует передать этот prop при выборе identity.

Источник должен детерминированно выдавать один и тот же снимок для каждой пары `index/count` при seek/replay; geometry строится один раз при изменении ссылки источника или качества (16 000 точек standard, 7 000 low). Если доступно другое количество частиц, адаптер должен детерминированно выбрать или повторно распределить их для запрошенного `count`. Передаются только позиции: скорость, размер, цвет и живой GPU-буфер лилии контракт пока не переносит. Рендерер строит атрибуты один раз и интерполирует позиции на общих часах; для непрерывного переноса скорости или GPU-состояния потребуется расширить контракт и отдельно проверить cleanup. Изменение содержимого того же объекта не пересоздаёт буфер: для нового снимка нужна новая стабильная ссылка.

Кадр 04.2 использует `shared/identityVortex.ts`: стабильные атрибуты импульса и орбиты, аналитический GPU-захват частиц на общем film time. `IdentityTrails.tsx` выбирает быстрые частицы из той же геометрии и вычисляет короткие следы по той же GLSL-функции. Новых часов или интегрируемой симуляции нет; на 8 с поза становится источником прежнего morph к имени. Атмосфера имеет quality-scaled слои и общий шум 4 КиБ; все добавленные geometry/material/texture освобождаются. Границы VFX-хвоста, бюджеты и проверка: [кадр 04.2](scene-04-2-vfx.md).

## Сеть, звук и optional media

Первый Canvas2D кадр рисуется до импорта Three. `AssetManager.prepare/retry` сообщает завершённые реальные единицы, проверяет HTTP/content/digest и доступную декодировку; cache verification является отдельным неизмеряемым этапом. Vite выпускает версионированные runtime manifest и Service Worker. Offline readiness требует читаемых ответов всех mandatory ресурсов текущей сборки, а не только регистрации SW. Отсутствующий ресурс блокирует обязательную готовность; cache/storage failure разрешает продолжить уже загруженный фильм с явным ограничением offline reload. Неудачный ES-module import браузер мемоизирует: после восстановления сети требуется reload. SW не кэширует камеры, записи или API.

App владеет одним `MediaSession` и одним `AudioDirector` вне scene lifetime. Отложенный cleanup отменяется повторным StrictMode effect setup; фактическое размонтирование освобождает services. `restore()` вызывается один раз и не запрашивает permissions. Согласия только в памяти, исходно false. Settings continue — единственное место `prepare()`; отмена/смена опций инвалидирует generation, поздний getUserMedia освобождает tracks. Один video stream переиспользуется, audio добавляется лишь при recording consent. Прежде чем объявить readiness, проверяются live video/audio и MIME. MediaPipe пока нет: UI прямо сообщает о будущем трекере.

Gift click вызывает `AudioDirector.unlock()` до первого await. Затем `MediaSession.start()` разрешён только consent + prepared recording status; optional failures не блокируют film start. DEV/replay не вызывают start recorder. Audio cues подключены к shared runtime, pause/speed/visibility; `getPrologueAudioCues(getPrologueFrames(config))` задаёт intro, first, second и dissolve по актуальным окнам, а touch воспроизводится на revision перехода. Музыкальные buffers не предоставлены: подготовлены слоты тихой атмосферы, мягких фортепианных акцентов и почти неслышной воздушной текстуры, fake playing отсутствует.

IndexedDB `little-universe-reactions-v1` хранит sessions и ordered chunks. Recorder запрашивает фрагменты каждые 4 с; последовательная transaction queue ограничена 8 pending chunks / 32 МиБ. Stop ждёт финального dataavailable и всех commit перед complete. Ошибка storage, recorder или pagehide оставляет recovery/incomplete, а не fake saved. Финал завершает запись и сбрасывает optional consent, освобождая все tracks; DEV jump/restart тоже сбрасывает согласия и не начинает запись. DOM controls/recovery остаются доступными во всех сценах. Export собирает долговременные chunks, сообщает только о запросе браузерного download. Delete требует отдельного подтверждения. Сеть для локальной записи не используется. Хранилище может быть очищено браузером, последние фрагменты при закрытии не гарантированы.

Backend содержит только health/configuration. Upload disabled с причиной, upload-запросов нет. Камера, запись и будущая передача — три независимых решения; кадры камеры для трекера не отправляются. Проверки и device limitations: [verification.md](verification.md).

