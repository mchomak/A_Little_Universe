# 01 — Параметры воды
Требования: R09–R15. Зона: systems/scene-config, debug/DeveloperPanel и их тесты/README. Волна: 1. Blocked by: нет.
Цитаты: «Добавь параметры в Dev Panel»; «intensity / strength of reflections», «blur of reflections», «distortion amount», «ripple speed», «normal strength», «moon highlight strength», «water opacity / wetness feel».
Спецификация: §3, §5. Критерии: все 7 контролов live/import/export/reset; schema12 мигрирует v1–v11 без потери старых явных настроек; meaningful boundary/retention tests; документация синхронизирована. Не менять проектный runtime пол/геометрию. Проверка npm run check.
