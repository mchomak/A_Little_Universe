# Проверки сцен 00 → 00.1 → 01 — 27 октября 2026

Реализованы загрузка, настройки, опциональная локальная запись и пролог; сцены 02–09 сохраняют технические placeholders. Среда: Windows, Node 24.11.1 / npm 11.6.2, Chromium headless с software WebGL. Эмуляция viewport и fake media не заменяют физический планшет или камеру.

| Проверка | Фактический результат |
|---|---|
| Frontend `npm run check` | ESLint max-warnings 0, 40 Vitest tests, strict TypeScript и production build прошли. До интеграции было 37 тестов; добавлены 3 проверки gift orchestration через публичные service APIs. |
| Сервисные и engine тесты | Asset readiness/retry/cache; consent/denied/late tracks, chunks/finalization/error/recovery; AudioDirector unlock/cues/pause; timing/waiting/double touch/pause/restart и прежние переходы. |
| Backend `.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q` | 3 passed, новый прогон после интеграции. |
| Живой backend `GET http://127.0.0.1:8003/health` | HTTP 200, `{"status":"ok"}`; backend не принимает записи. |
| Production preload | Online, cached revisit, offline reload прошли. Удалённый обязательный cached App при offline блокирует переход; reconnect + reload восстанавливает ресурс и readiness. [Фактический отчёт](../.autopilot/2026-10-27-opening-scenes/evidence/preload-report.json). |
| Native MediaRecorder + IndexedDB | В Chromium с синтетической камерой/микрофоном прошли запись 3 chunks/600 525 байт, ordered export, offline, reload/recovery, отказ/отмена и revoke consent/final chunk. Hard reload восстановил 251 175 байт как incomplete без восстановления согласий. Это настоящие browser APIs с fake devices, не физическая камера. [Фактический отчёт](../.autopilot/2026-10-27-opening-scenes/evidence/media-report.json). |
| Settings responsive | Screenshots 1366×900, 768×1024, 390×844 просмотрены: все switches исходно off, upload disabled, горизонтального overflow и pageerrors нет. Вертикальная прокрутка разрешена; для короткого landscape добавлена более компактная композиция. |
| Privacy integration | prepare только по выбранной опции и нажатию; gift unlock синхронно в gesture, запись перед film start лишь consent + ready. Cancellation generation защищает позднее разрешение; reload не восстанавливает согласия. Нет upload-запросов. |
| Production DEV | Проверено отсутствие DEV toggle/panel, включая `?debug`. Панель и её import защищены `import.meta.env.DEV`. |
| Production пролог и browser fallback | Проверены реальный порядок фраз, 16 с до бесконечного gate, pause/resize/touch impulse и сохранение Canvas. Camera denied, mic denied и отмена незавершённого запроса позволяют продолжить без записи; поздний capture освобождён. В отдельном DEV media UI проверен stop/export: подтверждён download 305 596 байт. Pageerrors отсутствуют. [Браузерный отчёт](../.autopilot/2026-10-27-opening-scenes/evidence/browser-report.json). |
| Полный маршрут и DEV resets | Пройдены все девять сцен с записью и offline tail, один Canvas; ending освобождает video/audio tracks. Replay/DEV00/DEV00.1 не запускают новую запись; normal gift после preparation reset не остаётся на паузе. Pageerrors отсутствуют. [Отчёт маршрута](../.autopilot/2026-10-27-opening-scenes/evidence/route-report.json). |
| Финальная композиция | После сверки S01_F02/F03 обе фразы заканчиваются на 44% высоты; landscape центр 40–41%. Browser bounds/screenshots 1024×768, 1920×1080, 768×1024, 390×844 подтверждают переносы вверх без пересечения с точкой. Независимая визуальная проверка приняла исправление. [Измерения](../.autopilot/2026-10-27-opening-scenes/evidence/composition-report.json). |

Production/browser проверки выше не входят в `npm run check`. Финальный preview проверялся на 4175; стандартный `npm run preview` использует 4173. Восемь фактических кадров и полный результат собраны в [отчёте 00–01](opening-scenes-report.md). Evidence нового run локальные/ignored, без автоматических коммитов.

## Ручные проверки и ограничения

- Физический планшет, iPad/Safari, аппаратный GPU, нагрев, настоящая фронтальная камера и микрофон не проверены. Нужны HTTPS и реальное устройство; HTTP по LAN IP обычно не даёт media permissions.
- Не проверены длительная запись, системное сворачивание приложения, нехватка диска на устройстве и browser storage eviction. Последние фрагменты после pagehide могут отсутствовать, incomplete export может не воспроизводиться.
- Runtime cache подтверждает доступность текущей сборки, но браузер может очистить хранилище позже. При недоступном cache/storage интерфейс не обещает offline reload.
- Music buffers, MediaPipe tracker, защищённый upload, личные фото/портрет/письмо и художественная версия сцен 02–09 отсутствуют. Gaze option готовит video stream для будущего эффекта, не обещает tracking.
- Vite предупреждает о JS chunk >500 КБ; порог не увеличен. Основной Three/film graph импортируется после первого лёгкого preload кадра. Это не измерение скорости на планшете.
- WebGL context loss показывает fallback; восстановление текущего кадра не реализовано. Download UI подтверждает запрос браузеру, а не сохранение файла на диске.
