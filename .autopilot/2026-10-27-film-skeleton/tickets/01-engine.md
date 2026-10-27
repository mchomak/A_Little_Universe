# 01 — Сценарный движок и единые часы

Требования: R07–R09, R11–R15, R26, R29, R45, R51–R53. Blocked by: нет. Волна: 1. Зона: frontend/src/engine/filmConfig.ts, film.ts, runtime.ts, useFilm.ts, useSceneTimeline.ts, их тесты.

Из брифа: «простой типизированный конечный автомат состояний»; «Используй GSAP Timeline»; «остановка на интерактивных этапах»; «невозможность случайно пропустить галерею».

Разделы spec: Сценарий и приёмка, Границы и швы, Проверки. Реализовать точные сцены/контракт actions из spec; добавить quality в state и set-quality при необходимости. Не ломать старую FoundationScene до интеграции: useSceneTimeline поддерживает старую сигнатуру или перенести старый hook в совместимый adapter, но никаких правок вне зоны.

Приёмка:
- Чистый reducer тестируется без WebGL: полный маршрут, неподвижные gates, explicit finish, replay, developer jump/seek, stale revision, invalid indexes/nonfinite values/speed, reading pauses without losing manual pause.
- GSAP clock синхронизирует runtime.time каждый update, state до 10Гц; замораживается при ручной паузе, чтении и hidden; speed/seek обратимы; callback старой сцены не может сдвинуть новую.
- useSceneTimeline позволяет новому коду build + {runtime} (доп. reducedMotion при необходимости), создаёт paused timeline и scrubs от общего runtime. Cleanup unsubscribe/context.revert, тестировать реальные timeline/runtime cleanup без mirror mocks.
- Фразы сценария, cues и времена в конфиге; MEMORIES 6 placeholders без личных событий, COPY для 2 прологов, flower prompt, имени/фото, финала и временного письма. TIMING также camera/gallery/transition duration. Описать итоговые exports в возврате.
- Никаких новых зависимостей, globals/browser debug store, permissions/API calls. Получить green npm test + typecheck/lint доступных файлов.
