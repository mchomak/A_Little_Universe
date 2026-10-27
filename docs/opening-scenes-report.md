# Сцены 00 → 00.1 → 01

27 октября 2026. Подготовка теперь ведёт от лёгкого Canvas2D облака через реальные загрузку и проверку автономного кэша к трём независимым настройкам. Камера/микрофон проверяются только по действию; подарок открывается отдельным жестом, который разблокирует AudioContext и может начать согласованную локальную запись. Пролог использует одну тёплую 3D-точку, две фразы, бесконечный touch gate и общий clock для импульса 0.3 с/входа growth. Сцены 02–09 сохранены как проходимые placeholders.

## Запуск

Frontend: из `frontend/` выполнить `npm ci`, `npm run dev` и открыть `http://127.0.0.1:5173`. Проверки: `npm run check`. Production/offline: `npm run build`, `npm run preview` → `http://127.0.0.1:4173`; дождаться подтверждения подготовки перед отключением сети. Камера/запись требуют HTTPS или localhost.

Backend необязателен: из `backend/` выполнить `uv sync --frozen --extra dev`, `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`; тесты `uv run --extra dev pytest`, проверка `GET /health`. Полные Windows/pip инструкции: [README](../README.md).

## Проверки

- `npm run check`: lint, 40 tests (37 до интеграции), typecheck/build прошли. Backend pytest: 3 passed; живой `/health` на порту 8003 вернул `{"status":"ok"}`.
- Production preload: online, cached revisit, offline reload; потеря обязательного cached ресурса блокирует переход, reconnect + reload восстанавливает readiness. [Отчёт загрузки](../.autopilot/2026-10-27-opening-scenes/evidence/preload-report.json).
- Production browser: исходно выключенные согласия, отсутствие скрытой записи/DEV, реальный порядок фраз и бесконечное ожидание после 16 с; pause, resize, касание и один Canvas. Отказ камеры/микрофона не блокирует фильм. Отмена незавершённого запроса позволяет начать без ожидания; поздние tracks освобождаются. В отдельном DEV media UI проверены stop/export и фактический download 305 596 байт. [Браузерный отчёт](../.autopilot/2026-10-27-opening-scenes/evidence/browser-report.json).
- Полный DEV-проход девяти сцен с согласованной записью и offline tail: один Canvas, на финале video/audio tracks завершены, replay не начинает новую запись. Отдельные возвраты в 00/00.1 затем открывают подарок без автозаписи и без лишней паузы. [Отчёт маршрута](../.autopilot/2026-10-27-opening-scenes/evidence/route-report.json).
- Native browser APIs с синтетическими media devices: 3 chunks/600 525 байт в IndexedDB, stop/final commit, Blob export, offline и reload. Отзыв согласия сохранил финальный chunk; hard reload восстановил явно incomplete файл 251 175 байт без восстановления согласий. [Отчёт media](../.autopilot/2026-10-27-opening-scenes/evidence/media-report.json).
- Settings screenshots просмотрены в 1366×900, 768×1024, 390×844: нет horizontal overflow/pageerrors, consent switches off, upload disabled. Это headless Chromium, не физический планшет.
- Gift orchestration tests проверяют unlock до await, recording до film start, отсутствие записи без consent и продолжение при optional failure. Replay/DEV не вызывают recorder start.

Итоговая визуальная проверка принята после исправления положения фраз по S01_F02/F03. Их DOM-блоки заканчиваются на 44% высоты, выше точки на 50%; центр в landscape — 40–41%. На 768×1024 обе фразы занимают две строки, на 390×844 вторая — три: переносы растут вверх и не пересекают свет. [Измерения композиции](../.autopilot/2026-10-27-opening-scenes/evidence/composition-report.json). Финальная проверка использовала production preview на 4175; стандартная команда выше по-прежнему открывает 4173. Полные границы: [verification.md](verification.md).

## Референсы

Все восемь исходников перечислены с применением в [индексе](../references/keyframes/README.md): `S00_0_F02_ResourceLoading.png`, `S00_0_F03_LoadingComplete.png`, `S00_1_F01_PreparationScreen.png`, `S00_1_F02_CameraCheck.png`, `S01_F01_FirstLight.png`, `S01_F02_FirstMessage.png`, `S01_F03_SecondMessage.png`, `S01_F04_TouchTheLight.png`. Оригиналы в `key_frames/` не изменены; runtime их не загружает. Диагностический keyframe адаптирован к фактам: трекер не заявлен готовым.

Фактические browser screenshots для восьми кадров:

| Референс | Снимок реализации |
|---|---|
| S00_0_F02 | [Подготовка ресурсов](../.autopilot/2026-10-27-opening-scenes/evidence/loading-resources.png) |
| S00_0_F03 | [Готовность загрузки](../.autopilot/2026-10-27-opening-scenes/evidence/loading-complete.png) |
| S00_1_F01 | [Настройки](../.autopilot/2026-10-27-opening-scenes/evidence/settings-landscape.png) |
| S00_1_F02 | [Проверка камеры — синтетические media, DEV](../.autopilot/2026-10-27-opening-scenes/evidence/camera-check.png) |
| S01_F01 | [Первый свет](../.autopilot/2026-10-27-opening-scenes/evidence/prologue-first-light.png) |
| S01_F02 | [Первая фраза, финальная композиция](../.autopilot/2026-10-27-opening-scenes/evidence/prologue-first-message.png) |
| S01_F03 | [Вторая фраза, финальная композиция](../.autopilot/2026-10-27-opening-scenes/evidence/prologue-second-message.png) |
| S01_F04 | [Ожидание прикосновения](../.autopilot/2026-10-27-opening-scenes/evidence/prologue-waiting.png) |

## Изменённые файлы

| Область | Пути |
|---|---|
| Bootstrap/cache | `frontend/index.html`, `frontend/src/main.tsx`, `frontend/vite.config.ts`, `frontend/src/bootstrap/Bootstrap.tsx`, `frontend/src/bootstrap/Preloader.tsx`, `frontend/src/bootstrap/preload.css`, `frontend/src/systems/assets/AssetManager.ts`, `frontend/src/systems/assets/AssetManager.test.ts`, `frontend/src/systems/assets/README.md` |
| Подготовка/интеграция | `frontend/src/app/App.tsx`, `frontend/src/app/PreparationScreen.tsx`, `frontend/src/app/preparation.css`, `frontend/src/app/openGift.ts`, `frontend/src/app/openGift.test.ts`, `frontend/src/components/SceneOverlay.tsx`, `frontend/src/debug/DeveloperPanel.tsx` |
| Media | `frontend/src/systems/media/MediaSession.ts`, `frontend/src/systems/media/MediaSession.test.ts`, `frontend/src/systems/media/RecordingStore.ts`, `frontend/src/systems/media/README.md`, `frontend/src/components/RecordingControls.tsx`, `frontend/src/components/RecoveryPanel.tsx`, `frontend/src/components/media.css` |
| Audio | `frontend/src/systems/audio/AudioDirector.ts`, `frontend/src/systems/audio/AudioDirector.test.ts`, `frontend/src/systems/audio/useAudioDirector.ts` |
| Пролог/clock | `frontend/src/engine/film.ts`, `frontend/src/engine/film.test.ts`, `frontend/src/engine/filmConfig.ts`, `frontend/src/engine/runtime.ts`, `frontend/src/engine/runtime.test.ts`, `frontend/src/scenes/PrologueScene.tsx`, `frontend/src/scenes/shared/SeedLight.tsx`, `frontend/src/scenes/GrowthScene.tsx`, `frontend/src/components/PrologueOverlay.tsx`, `frontend/src/components/prologue.css` |
| Документация | `README.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/verification.md`, `docs/opening-scenes-report.md`, `references/keyframes/README.md` |
| Решения и память проекта | `docs/adr/0001-offline-readiness.md`, `docs/adr/0002-local-reaction-recording.md`, `docs/adr/0003-film-transition-clock.md`, `AGENTS.md` (маркированный блок implemented foundation) |
| Локальный workflow | `.gitignore`; служебные `.autopilot/README.md`, `.autopilot/dashboard.html`, `.autopilot/state.js` |

Новый run `.autopilot/2026-10-27-opening-scenes/` с отчётами, снимками и синтетическим тестовым видео остаётся локальным и исключён существующими правилами gitignore. Эти материалы не входят в runtime. Автоматические коммиты не создавались, сохранён существующий workflow с локальными изменениями. Зависимости и backend source не менялись; секреты и записи в репозиторий не добавлялись.

## Текущие границы

MediaPipe tracker, музыка и защищённый upload не подключены. Upload switch disabled с причиной; камера готовится для будущего эффекта. Нет личных фото/портрета/письма, финальной графики сцен 02–09. Записи только локальные, не гарантированы от browser eviction; после закрытия могут отсутствовать последние chunks. Экспорт сообщает о запросе download и предлагает проверить загрузки. Реальный планшет/Safari, фронтальная камера, продолжительная запись и storage eviction остаются ручной проверкой. Один Canvas сохраняется между сценами; debug отсутствует в production.
