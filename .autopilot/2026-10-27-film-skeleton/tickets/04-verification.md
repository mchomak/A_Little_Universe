# 04 — Проверка в браузере и документация

Требования: R01–R05, R11, R38, R44, R50–R56. Blocked by: 02,03. Волна: 3. Зона: README.md, docs/**, frontend/src/**/*.test.ts, точечные исправления по findings согласовать.

Из брифа: «Убедись, что представление можно пройти целиком, без падений приложения и бесконечных ожиданий»; «Обнови документацию … как добавлять новые сцены … заменять заглушки».

Разделы spec: Проверки, Границы, Решения по объёму.

Приёмка: независимый сквозной browser проход с accelerated dev speed и реальные controls; отсутствие dev UI и кода в prod; pause/reading/gestures/replay, landscape/portrait; no permissions/media/network requests after bootstrap, offline traversal; cleanup evidence. npm test/typecheck/lint/build. Документация актуальна по коду: архитектура, конфиг времен, adding/replacing scenes, commands/debug, честные ограничения целевого tablet/device и offline reload. Не редактировать AGENTS.md/storyboard/backend. Если browser tool недоступен, точно сообщить причину.
