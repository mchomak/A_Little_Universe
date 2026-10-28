# A Little Universe for You

Приватное интерактивное 3D-поздравление для Василисы. **Реализована последовательность загрузка → настройки → пролог → касание света**, с проверяемым автономным кэшем и необязательной локальной записью реакции. Сцена 04 содержит переход от процедурного источника частиц к имени, ASCII-портрету и первой фотографии. Временная лилия и сцены 02–03 и 05–09 остаются техническими placeholders.

Текущий сценарный источник — [Storyboard v2.0](A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md); [v1.1](A_Little_Universe_for_Vasilisa_Storyboard_v1.1.md) оставлен исходником глав 02–09. Референсы хранятся по [правилам keyframes](references/keyframes/README.md); первая фотография подключена из `images/start_img.jpg`, остальные фотографии и музыка не добавлены.

## Требования

- Node.js **22.12+ в ветке 22** или **24+**, npm (проверено на Node 24.11.1 / npm 11.6.2).
- Современный браузер с **WebGL2** и аппаратным ускорением. WebGPU не требуется.
- Только для необязательного backend: Python **3.12+** и [uv](https://docs.astral.sh/uv/getting-started/installation/). Есть вариант без uv ниже.

## Быстрый запуск — Windows PowerShell

Из корня проекта:

```powershell
cd frontend
npm ci
# Необязательно: название уже имеет значение по умолчанию.
Copy-Item .env.example .env
npm run dev
```

Открыть **http://127.0.0.1:5173**. Не закрывать терминал сервера. Если порт занят, задать другой: `npm run dev -- --port 5174` (Vite использует strictPort).

Дождаться реальной загрузки, выбрать настройки и нажать «Продолжить». Все три согласия исходно выключены; «Продолжить без разрешений» доступно всегда. Камера/микрофон запрашиваются только после выбранных опций и осознанного нажатия. Проверка не записывает. Трекер взгляда ещё не подключён; подготовка камеры не означает, что глаз уже отслеживает взгляд. Отправка автору недоступна, потому что защищённый upload backend не реализован.

Нажать «Открыть подарок»: этот отдельный жест разблокирует AudioContext и запускает запись только при отдельном согласии и успешной проверке камеры/микрофона. Музыкальных файлов пока нет. Пролог длится 21 секунду: точка остаётся в центре, две фразы проявляются по глифам, затем распадаются в частицы; после gate остаются точка и инструкция «Прикоснись к свету». Касание или keyboard activation запускает текущий переход 0,3 с в сцену 02. Выросший бутон тоже ждёт касания. Галерея управляется кнопками, вертикальными свайпами и касаниями; история продолжается с последней карточки. Титры можно остановить или открыть «Читать без движения». В финале доступны повтор, галерея и чтение; повтор не начинает новую запись.

Во время записи видны индикатор и остановка. Фрагменты сохраняются в IndexedDB каждые примерно 4 с (точный интервал зависит от браузера). Финал завершает запись. Панель «Записи на этом устройстве» позволяет скачать или явно удалить сохранённое, в том числе после reload. Браузер может очистить своё хранилище; при закрытии последние фрагменты могут потеряться. Сообщение о запросе скачивания не подтверждает появление файла на диске.

Пауза сохраняет позицию, скрытая вкладка останавливает часы и звук. Уменьшенное движение учитывается системно; качество сцен 02–09 меняется в нижней панели. Reload запускает подготовку заново и сбрасывает согласия, сохраняя доступ к прежним локальным записям. Browser Back не переключает сцены.

DEV-панель Scene Composer открывается кнопкой DEV или по адресу http://127.0.0.1:5173/?debug и доступна только в development. В ней есть общие параметры и художественные controls сцен 00, 00.1 и 01, пресеты, reset, JSON import/export и общие playback controls. Для сцен 02–09 остаются только существующие controls воспроизведения/перехода. Панель не выдаёт разрешения и не начинает запись. Счётчик показывает приблизительную частоту requestAnimationFrame, а не GPU/WebGL FPS. В production панель и её import отсутствуют, в том числе при ?debug.

## Scene Composer и production configuration

Defaults и schema v1 находятся в общем config store. Scene Composer доступен только в DEV; настройки production подаются отдельно частичным JSON-файлом по same-origin пути /scene-composer.json. При локальной сборке файл можно разместить в frontend/public/scene-composer.json, чтобы Vite отдавал его из корня сайта. Отсутствующий, некорректный или недоступный optional-файл сохраняет defaults и не блокирует preload; неизвестные поля игнорируются, некорректные значения получают default, неподдерживаемая версия безопасно сбрасывается.

Config может содержать global playback speed, quality и DPR; параметры preload/preparation; и настройку пролога. Группа 00.1 включает live-настройки масштаба заголовка, его межстрочного интервала и непрозрачности поверхностей; defaults `1`, `1.08` и `1` сохраняют текущий вид. В поле JSON `scenes.prologue.particleReturnFraction` хранится коэффициент `0–1` от лимита рендера `20%`: default `0.75` означает `15%`. Composer показывает фактическую долю `0–20%`. Остальные defaults — Marck Script для пролога, 21-секундный gate, 1 800 частиц в standard quality и локальные шрифты Marck Script, Bad Script, Caveat и Cormorant Garamond. Шрифты входят в сборку и проходят проверку набора глифов, включая Ё/ё. Подробный пример JSON, поля и диапазоны — в [справке Scene Composer](frontend/src/systems/scene-config/README.md).

## Проверки и production build

```powershell
cd frontend
npm run check
npm run preview
```

`check` выполняет ESLint, Vitest и production build со strict TypeScript. Отдельно доступны `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Сборка — `frontend/dist/`; preview — **http://127.0.0.1:4173**. Preview предназначен для локальной проверки статической сборки.

На macOS/Linux frontend запускается теми же `npm ci` / `npm run dev` из `frontend/`.

Для планшета в доверенной локальной сети: `npm run dev -- --host 0.0.0.0`, затем `http://<IP-компьютера>:5173`; при необходимости разрешить доступ в Windows Firewall. Камере и записи нужен HTTPS или localhost: обычный HTTP по локальному IP подходит только для фильма без камеры. Физический планшет/Safari пока не проверены.

Для проверки offline выполнить production build и открыть preview, дождаться проверки кэша, затем отключить сеть и перезагрузить. Готовность подтверждается чтением и проверкой всех обязательных файлов текущей сборки, а не фактом установки Service Worker. При ограничениях storage интерфейс честно разрешает продолжить загруженный фильм без гарантии offline reload. В development полный автономный кэш не заявляется. После обновления сборки старым вкладкам может понадобиться закрытие и повторное открытие.

## Необязательный backend

Backend не нужен для просмотра фильма. В отдельном терминале из корня:

```powershell
cd backend
uv sync --frozen --extra dev
# Необязательно: безопасные значения уже заданы.
Copy-Item .env.example .env
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --env-file .env
```

Проверка: `Invoke-RestMethod http://127.0.0.1:8000/health` → `{"status":"ok"}`. OpenAPI: **http://127.0.0.1:8000/docs**. Если порт занят, выбрать свободный, например `--port 8001`, и изменить адрес проверки.

Файлы `.env` копировать один раз, сохраняя собственные настройки. Если `.env` не создавался, убрать `--env-file .env`. `VITE_*` — публичные значения; секреты туда не помещать.

На macOS/Linux из `backend/`:

```sh
uv sync --frozen --extra dev
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend без uv, Windows, из `backend/`:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
.\.venv\Scripts\python.exe -m pytest
```

На macOS/Linux: `python3 -m venv .venv`, затем `.venv/bin/python -m pip install -e '.[dev]'` и `.venv/bin/python -m uvicorn app.main:app --reload`. Точные версии воспроизводит `uv.lock`; pip следует диапазонам `pyproject.toml`. Backend-тесты через uv: `uv run --extra dev pytest`.

## Структура и расширение

```text
frontend/src/
  app/             настройки/проверка/готовность/фильм, координация сервисов, CSS
  bootstrap/       лёгкий Canvas2D preload до импорта Three
  engine/          film state/config/runtime, один Canvas, scene/camera directors
  scenes/          девять сцен и общие схематичные примитивы/анимации
  components/      prompts, галерея, титры, чтение, graphics fallback
  debug/           диагностика только в development
  assets/          место для будущих runtime-ассетов
  shaders/         место для GLSL, импорт через ?raw
  systems/         assets/cache, audio director, media session/IndexedDB
backend/           конфигурация, GET /health, тесты, pyproject.toml, uv.lock
docs/              архитектура, решения, проверки, дальнейшие этапы
references/        арт-референсы вне runtime bundle
```

`engine/filmConfig.ts` задаёт порядок/cues, `film.ts` — gates и переходы, `runtime.ts` — общие GSAP-часы. `SceneDirector` статически импортирует все сцены; каждая использует один постоянный Canvas. Сцены анимируют refs, camera choreography принадлежит `CameraDirector`. Подробные инструкции по добавлению сцен и замене artwork: [архитектура](docs/architecture.md).

## Границы прототипа

Первая фотография и созданный из неё ASCII-портрет подключены в сцене 04 и галерее; остальные фотографии, письмо, музыка, MediaPipe-трекер и защищённая отправка отсутствуют. Backend содержит только `/health`; frontend не отправляет ему видео или camera frames. Отказ optional функций сохраняет фильм. Лилия и сцены 02–03, 05–09 остаются временными материалами.

Подробнее: [отчёт сцен 00–01](docs/opening-scenes-report.md), [VFX кадра 04.2 и визуальная проверка](docs/scene-04-2-vfx.md), [архитектура](docs/architecture.md), [дорожная карта](docs/development-roadmap.md), [решения](docs/decisions.md), [проверки и ограничения](docs/verification.md).
