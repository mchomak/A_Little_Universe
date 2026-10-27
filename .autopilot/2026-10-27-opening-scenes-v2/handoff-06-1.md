СДЕЛАНО: Schema v1 сохранена; добавлены bounded `preparation.typeScale`, `lineHeight` и `cardOpacity` с defaults 1, 1.08 и 1.
СДЕЛАНО: Composer показывает возврат частиц как фактические 0–20%; default `.75` отображается как 15%.
СДЕЛАНО: CSS vars применяются live и возвращаются к defaults через reset; успешный Canvas скрывает fallback из accessibility tree.
СДЕЛАНО: В браузере проверены 00.1 и Composer при 1024×768 и 768×1024; canvas success не содержит alert в accessibility snapshot.
ФАЙЛЫ: `frontend/src/systems/scene-config/config.ts`, `config.test.ts`, `README.md`.
ФАЙЛЫ: `frontend/src/debug/DeveloperPanel.tsx`, `DeveloperPanel.test.ts`; `frontend/src/app/PreparationScreen.tsx`, `PreparationScreen.test.ts`, `preparation.css`.
ФАЙЛЫ: `frontend/src/components/GraphicsFallback.tsx`, `GraphicsFallback.test.ts`; `frontend/src/engine/FilmCanvas.tsx`.
ФАЙЛЫ: root `README.md`, storyboard v2.0, `docs/opening-scenes-report.md`, ticket `interfaces.md`, этот handoff.
РЕШЕНИЯ: Поле `particleReturnFraction` осталось коэффициентом 0–1 от renderer cap 20%; UI переводит его в проценты множителем 20.
РЕШЕНИЯ: Type scale использует CSS `zoom`; defaults и CSS line-height сохраняют текущий вид, slider step равен 0.01 для точного default 1.08.
РЕШЕНИЯ: `GraphicsFallback({ hidden? })` удаляет alert role и задаёт `aria-hidden=true` после `FilmCanvas.onCreated`; failure fallback остаётся alert.
ТУПИКИ: Первоначально Playwright/CDP профили были заняты; Chrome DevTools позже открыл `about:blank`, и браузерные проверки выполнены.
ТУПИКИ: `fill_form` поменял DOM range values без изменения React config; живое применение проверено реальными клавишами по сфокусированным sliders.
ЗАВЕРШЕНО: `npm run check` прошёл — ESLint, оба typecheck, production build, 83 теста в 23 файлах.
ЗАВЕРШЕНО: scoped diff и `git diff --check` проверены; несвязанные пользовательские изменения исключены из коммита.
