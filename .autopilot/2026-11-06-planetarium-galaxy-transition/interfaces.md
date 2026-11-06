# Interfaces и правила исполнения

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Gallery controller | Фокус последнего изображения и существующий exit progress | Текущий snapshot и progress выхода | Размещение и поведение остальных фотографий |
| Film reducer | Специальный маршрут из завершённой галереи и его сброс | Scene ID, elapsed и один entry flag | Условия остальных сцен и DEV-команд |
| Planetarium transition overlay | Текстура, экранное совпадение/кадрирование, небольшой zoom, градиент и opacity | Один fullscreen render layer в общем canvas | Размеры и материалы галерейных карточек |
| GalaxyExperience | Существующие звёзды, газ, рукава, ядро и reveal phase | Рендер галактики для текущей scene/time | GPU-геометрию, материалы и шейдеры |
| CameraDirector | Общая камера и переход к конечному ракурсу | Текущий CameraPose | Любую вторую камеру или renderer |

Единственный шов поведения — film state + gallery snapshot: специальный маршрут срабатывает только после подтверждения в конце последнего события, а обычный DEV-jump в cosmos остаётся штатным.

- `FilmState.planetariumTransition?: boolean` — маркер только специального маршрута; GalaxyExperience использует его для локального сдвига reveal, обычные переходы и DEV-навигация остаются без сдвига.

## Контекст проекта, который executor не должен угадывать

- Проект: React 19, TypeScript 6, Vite 8, Three.js 0.186, React Three Fiber 9, GSAP 3.15.
- Общий FilmCanvas, SceneDirector, CameraDirector и FilmRuntime уже владеют canvas, camera, timeline и временем. Не создавать второй renderer, requestAnimationFrame loop, новую particle system или параллельную сцену Galaxy.
- Галерея импортирует локальные изображения через Vite glob и каталог событий. Planetarium — последний event; `1.jpg` занимает основной слот. Опираться на существующий URL из реестра.
- GalaxyExperience уже сохраняет GPU-ресурсы, reveal, вращение и газ; Scene 08/09 используют те же слои. Не менять палитру, композиционные настройки или Dev Panel.
- Источник художественных требований: storyboard v3.0, завершение сцены 05 и сцена 07. K05-04 — утверждённый кадр выхода галереи; отдельного утверждённого кадра Galaxy в индексе нет.
- Не менять поведение других фото и обычного DEV-перехода в cosmos. Специальный маршрут создаётся только из подтверждённого выхода последней галерейной памяти.
- Подмена должна визуально совпадать с текущей карточкой по экранному центру/размеру/crop, затем переходить в fullscreen. Звёзды начинаются во время выхода; time продолжает существующую Galaxy timeline без reset/double render. Нижний градиент темнеет до растворения фото.
- Не запускать browser, Playwright, Puppeteer, screenshots или визуальные циклы. Пользователь выполнит художественную проверку сам.

## Команды проверки

PowerShell, из корня проекта:

- `Set-Location .\frontend; npm run typecheck`
- `Set-Location .\frontend; npm run build`

Проверки не должны запускать browser automation или screenshot capture. Tests и lint в этой задаче не требуются.

## Порядок и границы изменений

- Текущий checkout пользователя содержит чужие рабочие изменения. Все правки находятся в отдельном worktree `C:\Users\McHomak\Projects\A_Little_Universe_planetarium_transition` на новой ветке от локального `main`.
- Не переключать, не очищать, не stash/reset-ить исходный checkout и соседний main worktree.
- Не добавлять зависимости, новые настройки Dev Panel, новые runtime services или assets.
- Для повторного открытия и DEV seek использовать явное состояние маршрута, которое сбрасывается при обычном переходе; прямой DEV-jump в cosmos начинает стандартный timeline.
- Все изменения проекта должны быть готовы до технических проверок; не коммитить до зелёных TypeScript и build.
