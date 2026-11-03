# Границы, решённые в спецификации

## Одна связанная реализация, без межтасковых API

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Scene Composer config | `scenes.openingBackground: { zoom, offsetX, offsetY }`, defaults, нормализацией schema и миграцией v14 | существующие `getConfig` / `updateConfig`, JSON export/import | валидацию диапазонов и clamp crop-смещения |
| Слой фона приложения | импортированным `phone_1.png`, отображением на экранах 00/00.1 и сценах 01–04, скрытием с 05 | текущие route/scene и значения общего config | `cover`, расчёт кадра и DOM/CSS |
| DEV Scene Editor | zoom/X/Y range-контролами, live preview и reset | обновлением общего Scene Composer config | рендер фона |

Общий профиль: zoom 1–3, offsetX/offsetY −1…1; defaults 1/0/0. Кадр остаётся полноэкранным без пустых краёв. Обновления — событийные, без per-frame React state.

Проверки через существующие seams: `normalizeConfig` и миграция частичных JSON; DEV controls и composer import/export; браузерный просмотр screens 00/00.1 и scenes 01–05. Runtime asset импортируется из frontend, чтобы Vite включил его в production manifest и offline cache.

## Правила проекта

- Стек: React 19.3.1, TypeScript 6, Vite 8, Three.js 0.186, React Three Fiber 9, GSAP 3.15. Новые зависимости не добавлять.
- Сохранять один persistent WebGL Canvas, общую сценическую конфигурацию, владение film state/camera/audio/scene timing. Не добавлять per-frame React updates; корректно освобождать любые созданные ресурсы.
- DEV-инструменты остаются только в development. Сохранить touch-friendly и reduced-motion поведение.
- Не менять `images/phone_1.png`, storyboard, утверждённые keyframes и фон галереи; не публиковать личные материалы и не добавлять стороннюю передачу файлов.
- Не трогать несвязанные пользовательские изменения и staged-файлы; не выполнять reset/stash/cleanup, не включать эти изменения в коммит. В этом рабочем дереве до начала задачи уже были staged-изменения, включая Composer и Scene 04. Не делать общий `git add` или commit.
- Если нужная зависимость отсутствует, вернуть `BLOCKED`; не устанавливать её самовольно.

## Команды

- Запуск: из `frontend/` — `npm run dev`.
- Полная проверка: из `frontend/` — `npm run check` (lint, Vitest, typecheck, production build).
