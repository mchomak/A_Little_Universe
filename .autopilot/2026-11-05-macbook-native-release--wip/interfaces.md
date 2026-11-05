# Границы, решённые в спецификации

- Desktop shell: доверенный локальный origin, окно, macOS разрешения и безопасный IPC; не менять сцены.
- Recorder: сеанс и независимые потоки, запись на диск; интерфейсы start/stop/status.
- Media finalizer: проверка, сборка и восстановление по manifest, без удаления исходников.
- Film integration: подтверждение и остановка, DEV Recording; жизненный цикл выше таймлайна.

## Правила
Рабочий каталог — корень worktree. React/TypeScript/Vite/Three; `cd frontend; npm ci; npm run check`, один тест `npm test -- <path>`. Сцены, анимации, модели, шейдеры и пресеты не менять без необходимости. Ветка codex/macbook-native-release. Каждый из трёх этапов — отдельный коммит координатором. Зависимости, необходимые для Electron и упаковки, разрешено установить и зафиксировать.

## Этап A — реализовано
- `app://bundle` — привилегированный локальный origin; `isAppOrigin(url)` проверяет scheme и host для разрешений и навигации.
- Упакованные ресурсы проверяются по манифесту напрямую, без Service Worker; продакшн в браузере сохраняет прежний путь.
- DEV пресеты в Electron используют persistent localStorage и встроенный индекс; обычный Vite API сохранён.
- Команды `npm run desktop:dev`, `npm run test:desktop`, `npm run build:mac:dir`; macOS сборка требует macOS.

## Этап B — реализовано
- `window.desktopRecording` предоставляет ограниченный IPC к `RecordingDiskStore` по идентификатору сеанса; renderer не выбирает произвольные пути.
- `RecordingDiskStore.createSession`, `openSegment`, `appendChunk`, `closeSegment`, `finishSession` управляют файловой сессией, журналом и manifest.
- `DesktopRecordingSession` запускается только после согласия; независимые MediaRecorder пишут на диск, ротация не привязана к фильму, Stop дренирует очередь.
- При перегрузке источник останавливается, неполный сегмент помечается ошибкой; оригинальные данные остаются на диске.
