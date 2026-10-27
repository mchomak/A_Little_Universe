# A Little Universe for You

Приватное интерактивное 3D-поздравление для Василисы. **Сейчас реализован полный проходимый технический прототип из девяти сцен.** Семечко, лилия, частицы, карточки фотографий, глаз и космический букет показаны схематично; фото, портрет и письмо явно обозначены placeholders. Это ещё не готовая художественная версия.

Художественный источник — [Storyboard v1.1](A_Little_Universe_for_Vasilisa_Storyboard_v1.1.md). Референсы хранятся по [правилам keyframes](references/keyframes/README.md); личные фотографии и музыка не добавлены.

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

Нажать «Открыть подарок». Пролог ждёт касания точки после первых фраз; выросший бутон также ждёт касания. В галерее доступны кнопки, вертикальные свайпы и касания карточек; история продолжается с последней карточки. Глаз реагирует на указатель без камеры устройства. Титры можно остановить касанием или открыть «Читать без движения»; завершение требует кнопки. В финале доступны повтор, галерея и чтение.

Пауза сохраняет позицию, скрытая вкладка останавливает часы. Доступны обычное/низкое качество и системное уменьшенное движение. Перезагрузка страницы возвращает стартовый экран; browser Back не переключает сцены.

Панель разработчика открывается кнопкой **DEV** или по **http://127.0.0.1:5173/?debug**. Только в development: все девять сцен, restart/skip, скорость 0.25–4×, playhead, имитация касания и навигация галереи. Счётчик показывает приблизительную частоту `requestAnimationFrame`, а не GPU/WebGL FPS. Developer Mode отсутствует в production, включая `?debug`.

## Проверки и production build

```powershell
cd frontend
npm run check
npm run preview
```

`check` выполняет ESLint, Vitest и production build со strict TypeScript. Отдельно доступны `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Сборка — `frontend/dist/`; preview — **http://127.0.0.1:4173**. Preview предназначен для локальной проверки статической сборки.

На macOS/Linux frontend запускается теми же `npm ci` / `npm run dev` из `frontend/`.

Для планшета в доверенной локальной сети: `npm run dev -- --host 0.0.0.0`, затем `http://<IP-компьютера>:5173`; при необходимости разрешить доступ в Windows Firewall. Физический планшет/Safari пока не проверены. Будущим функциям камеры и записи потребуется HTTPS или localhost.

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
  app/             React-оболочка и CSS
  engine/          film state/config/runtime, один Canvas, scene/camera directors
  scenes/          девять сцен и общие схематичные примитивы/анимации
  components/      prompts, галерея, титры, чтение, graphics fallback
  debug/           диагностика только в development
  assets/          место для будущих runtime-ассетов
  shaders/         место для GLSL, импорт через ?raw
  systems/         место для общих GPU-систем
backend/           конфигурация, GET /health, тесты, pyproject.toml, uv.lock
docs/              архитектура, решения, проверки, дальнейшие этапы
references/        арт-референсы вне runtime bundle
```

`engine/filmConfig.ts` задаёт порядок/cues, `film.ts` — gates и переходы, `runtime.ts` — общие GSAP-часы. `SceneDirector` статически импортирует все сцены; каждая использует один постоянный Canvas. Сцены анимируют refs, camera choreography принадлежит `CameraDirector`. Подробные инструкции по добавлению сцен и замене artwork: [архитектура](docs/architecture.md).

## Границы прототипа

Нет настоящих фото/портрета/письма, музыки, tracking, записи, upload или Service Worker. Никаких запросов camera/mic permissions. Текущему маршруту нужны только загруженные локальные модули и геометрия, без внешних ассетов и API. Браузерный проход с отключением сети после загрузки проверен; **offline reload не гарантируется**.

Tracking, запись и отправка будут тремя отдельными optional решениями с независимым согласием. Они пока не реализованы. Для художественной версии нужны утверждённые keyframes и предоставленные личные материалы.

Подробнее: [архитектура](docs/architecture.md), [дорожная карта](docs/development-roadmap.md), [решения](docs/decisions.md), [результаты проверок и ограничения](docs/verification.md).
