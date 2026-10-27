# Проверки сцен 00 → 00.1 → 01 — 27 октября 2026

Проверена текущая реализация с новым Storyboard v2.0. Команды запущены из Windows workspace; frontend использует Node 24.11.1 / npm 11.6.2. Browser QA выполнен в эмулированных viewport. Физический iPad и Safari не использовались.

| Проверка | Результат |
|---|---|
| Frontend npm run check | Passed: ESLint с max-warnings 0, 83 теста в 23 файлах, strict typecheck app и node projects, production build. |
| Production build | Успешно; Vite вывел advisory о chunk больше 500 kB после минификации. App chunk — 687.39 kB (195.04 kB gzip); лимит не менялся. |
| Vitest runtime warning | Выведено предупреждение Three.js о deprecated CommonJS require. Тесты прошли. |
| Backend .\\.venv\\Scripts\\python.exe -m pytest -q из backend | 3 passed; backend source не изменялся. |
| Preparation viewport | В браузере проверены 768×1024 и 1024×768. Путь «Продолжить без разрешений» → «Открыть подарок» оставил ту же точку в центре. |
| Composer live controls/reset | В desktop Chrome проверены live-контролы 00.1 и reset в viewport emulation 1024×768 и 768×1024. Физические iPad/Safari не использовались. |
| Prologue browser seek | Через общий DEV seek проверены 4 с, 12 с и 21 с. Marck Script корректно отображал кириллицу; обе фразы располагались вокруг точки; после gate оставались точка и «Прикоснись к свету». |
| WebGL | WebGL2 доступен в браузере. Это не измерение производительности iPad/GPU. |
| Сцены 02–09 | Код и поведение сцен не менялись в этом ticket; остаются техническими placeholders. |

Проверка 4/12/21 с и экранов подготовки — браузерная viewport-эмуляция. Отдельно на физическом iPad необходимо проверить Safari, обе ориентации, удобство касаний и переносы, аппаратный WebGL/GPU, нагрев, производительность и автономный запуск. При тесте camera/recording нужны HTTPS или localhost и отдельное согласие.

## Ограничения и известные границы

- Физический iPad/Safari, аппаратный GPU, настоящие камера и микрофон и длительный планшетный прогон не проверялись.
- Трекер взгляда, музыкальные файлы, личные фото/портрет/письмо и защищённая передача видео не реализованы. Upload switch выключен; видеоданные не отправляются на сервер.
- Локальные записи зависят от IndexedDB и browser storage; браузер может очистить данные, последние фрагменты при закрытии страницы не гарантированы.
- Offline readiness относится к текущей сборке; browser storage может быть очищен после проверки. В development полный offline cache не заявляется.
- Vite chunk advisory и CommonJS warning Three.js остаются; WebGL context loss показывает fallback, восстановление кадра не реализовано.
