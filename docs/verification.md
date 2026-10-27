# Проверка placeholder-фильма — 27 октября 2026

Проверялся полный технический маршрут из девяти сцен, без финальной художественной графики и личных материалов. Окружение: Windows, Node 24.11.1 / npm 11.6.2; браузерный прогон — Chromium headless через установленный Python Playwright, software WebGL. Эмуляция viewport не заменяет физический планшет.

## Текущие frontend-проверки

| Проверка | Результат |
|---|---|
| `npm run check` | Успешно: ESLint с max-warnings 0, Vitest, production build со strict TypeScript. |
| `npm test` в составе check | 13 passed: sequence/gates, dev bounds/stale callbacks, reading/revisits/replay, runtime timing/visibility/cleanup, scene timeline cleanup, gallery camera/swipe, lily pose и прежний playback. |
| `npm run build` в составе check | Успешно; основной JS 1 234,84 КБ / 347,11 КБ gzip; CSS 8,40 КБ. Предупреждение Vite о чанке >500 КБ сохранено. |
| Dev-сервер | Доступен на `127.0.0.1:5173`; все девять сцен проверены в реальном браузере. |
| Полный маршрут | Пройден от start до ending без dev skip, через все timed transitions и оба touch gates; ускорение 4× выставлено через DEV UI. |
| Touch gates и галерея | Проверены prologue waiting, bloom waiting/playing и реальные касания 3D-точки/3D-бутона; gallery buttons, реальные pointer swipes, cancellation и выход только с последней карточки. |
| Пауза и Canvas | WebGL-снимки на паузе идентичны; тот же DOM Canvas сохранён через полный маршрут, повторные входы и replay. |
| Титры / чтение | Касание титров ставит паузу; finish требует действия. Native dialog: focus, Escape, сохранение ручной паузы после закрытия. |
| Offline после загрузки | Сеть отключена перед выходом из gallery; пройдены eye → cosmos → greeting → ending, повторная галерея/чтение и replay. Внешних запросов не обнаружено. Offline reload не проверен и не гарантируется. |
| DEV / качество | Проверены все девять jump, restart/seek и скорость; при device DPR 2 фактический Canvas DPR меняется standard 1.5 → low 1. rAF estimate не является измерением GPU FPS. |
| Responsive / reduced motion | 768×1024 и 390×844 без горизонтального overflow, controls в пределах viewport; reduced-motion clock и gates сохраняются. |
| Browser errors / visual QA | `pageerror` отсутствуют; шесть screenshots просмотрены: схематичная графика и layout отображаются. Это не художественная приёмка по keyframes. |
| Production preview | `127.0.0.1:4173/?debug`: нет DEV-панели и toggle, старт работает, `pageerror` отсутствуют. В production JS также отсутствуют маркеры Developer Mode / debug-toggle / rAF FPS. |
| Сохранность исходников | SHA256 AGENTS.md и исходного storyboard совпадают с началом этапа. |

Браузерные проверки выше не являются частью `npm run check`.

## Backend: результаты предыдущего этапа

Backend в текущем этапе не менялся и повторно не запускался. Сохранённые результаты фундамента: `uv sync --frozen --extra dev` и editable packaging прошли; `uv run --extra dev pytest` — 3 passed (HTTP health/default debug/environment config); живой Uvicorn на 8001 отвечал HTTP 200 и `{"status":"ok"}`. Это исторические проверки, не новый прогон после добавления фильма.

На предыдущем этапе также проверялись отсутствие WebGL и context-loss fallback, production без DEV и отсутствие overflow 1024×768. Для актуального кода результаты не следует расширять за пределы таблицы выше.

## Известные ограничения

- Основной bundle превышает порог Vite. Порог предупреждения не увеличивали; оптимизация должна учитывать загрузку и измерения при появлении реальных ассетов.
- Возможен upstream dev warning `THREE.Clock` из связки R3F/Three. Его не подавляют и не исправляют в node_modules; обновления зависимостей — отдельная задача.
- Физический планшет, Safari/iPad, аппаратный GPU, нагрев и настоящий touch не проверены. Headless software WebGL не даёт device performance evidence.
- Service Worker, offline reload, настоящие изображения/портрет/письмо, музыка и preload этих ресурсов не реализованы. Missing-asset recovery предстоит проверять при их добавлении.
- Tracking, camera/mic, запись, local chunks и upload отсутствуют. Permission denied, запись/recovery и upload failures пока не имеют работающих функций для проверки.
- Browser visibility покрыта runtime-тестами; системное сворачивание/возврат на реальном планшете остаётся device-проверкой. Автовосстановления текущего кадра после context loss нет.



