# Инженерные решения

Исходные решения приняты 26 октября 2026; обновление для placeholder-фильма — 27 октября. Пересмотр — по измерениям и требованиям конкретных сцен.

| Решение | Причина и граница |
|---|---|
| React 19 + Fiber 9 + Three.js + Drei, Vite SPA | Существующий совместимый стек, без SSR, WebGPU и тяжёлого UI framework. Точные версии в package.json и package-lock.json. |
| Один постоянный WebGL2 Canvas | Renderer и камера сохраняются при сценах/replay/seek; сцены заменяют только содержимое. |
| Девять статически импортированных сцен | Весь placeholder-маршрут доступен после загрузки без последующих scene downloads. Реальные ассеты ещё не подключены. |
| Явный reducer и revision | Разделяет автоматическое время, касание, exploration, reading и ending; устаревшее completion не перескакивает новую сцену. |
| Один clock, scrubbed timelines | FilmRuntime публикует точное время scene/camera/DOM-подписчикам; React получает ограниченную частоту обновлений. Timeline каждой сцены paused и scrubs общий playhead. |
| Отдельный gallery focus tween | Exploration clock не идёт, но переход между карточками должен двигать камеру. Tween имеет собственные cleanup и pause/visibility/speed sync. |
| Централизованная камера | CameraDirector управляет существующей R3F-камерой, aspect ratio и хореографией; scene-модули не создают камер/OrbitControls. |
| GSAP context и demand rendering | Timeline cleanup через revert и unsubscribe; кадр запрашивается invalidate. Нет React state для отдельных частиц. |
| Явное качество и reduced motion | Standard DPR 1–1.5 / low DPR 1 и меньше частиц. Reduced motion сокращает движение, сохраняя clock и gates. Это не обещание измеренного планшетного FPS. |
| Локальная геометрия и системные шрифты | Нет внешних HDRI, CDN-шрифтов, подменённых фото и фиктивного preload. Художественные ассеты потребуют реальной загрузки/error handling. |
| Developer Mode только в DEV | Vite guard исключает lazy import и UI в production. Панель открывается DEV или ?debug и показывает rAF estimate, не WebGL FPS. |
| Сервисы только для текущих потребителей | Добавлены preload/cache, AudioDirector и MediaSession для сцен 00–01. Uploader/MediaPipe отсутствуют до реальной защищённой инфраструктуры и художественной задачи. |
| Минимальный FastAPI без CORS | Только health и Pydantic-конфигурация, без БД/хранилища/upload. Frontend его не вызывает; origins задавать при появлении HTTP-потребителя. |
| Lockfiles npm и uv | npm ci и uv sync --frozen --extra dev воспроизводят зависимости; обновления — отдельная задача. |
| Keyframes вне сборки | Оригиналы и review state остаются в references; runtime получает только выбранные оптимизированные ассеты. |
| Проверяемая готовность автономного кэша | Native Cache API + generated SW без новой зависимости. Readiness требует чтения обязательных ответов текущей версии и проверки manifest/digest; storage limitations показываются явно. Неудачный module import восстанавливается reload. |
| Session-scoped media и долговременные chunks | Один stream/recorder вне сцен; prepare не пишет, gift gesture может start только после отдельного согласия. Последовательные IndexedDB commits, bounded queue, incomplete recovery и явные export/delete. Reload не восстанавливает согласия и не начинает запись. |
| Импульс пролога принадлежит film clock | `transitioning` на 0.3 с в reducer/runtime вместо отдельного таймера. Поэтому pause/speed/visibility/restart и stale revision guards действуют и на касание/вход growth. |

Python-конфигурация: `ALU_APP_NAME` и `ALU_DEBUG` читаются из environment и проверяются Pydantic. `.env` подхватывает Uvicorn только с `--env-file`; debug выключен по умолчанию. `python-dotenv` нужен для этого режима Uvicorn, `httpx2` — dev dependency тестового клиента Starlette. Backend не изменялся при добавлении фильма.

Подробности границ и lifecycle: [architecture.md](architecture.md). Фактические проверки и ограничения: [verification.md](verification.md).
