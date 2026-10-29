# Сцена 04 — handoff для ручного объединения

Worktree: `C:/Users/McHomak/Projects/A_Little_Universe_scene04_direct`

Ветка: `codex/scene04-portrait-direct`

База: `01c4d925e1a493d50120405e3cabe87c65187997`

Кодовый commit: `19edf41a32ae100f7fcad99ac889ae323c287240`. Финальный commit документации/проверок указан в сообщении Codex и выводе `git log -2 --oneline`; собственный SHA не встраивается в содержащий его commit.

Ничего не слито; push/rebase/cherry-pick не выполнялись. Ветка создана от проверенного committed HEAD. Незакоммиченные более новые эффекты сцены04/галереи/пролога основной папки не копировались. Пролог (включая IDE selection о второй фразе), 02/03, 05–09, GLB/Blender, исходные фото, permission/recording/audio не редактировались.

## До → после

34s: лилия → вихрь → имя → символы → ASCII → фото → галерея.

21s: существующая placeholder-лилия → мягкое облако → ASCII → исходное монохромное фото → подпись → галерея. Удалены только подключения имени/спирали/trails/орбит/blueSpark/соседних карточек в04; общие helpers и другие сцены сохранены.

| Время | Содержание |
|---|---|
| 0–3.5 | Уход текущей процедурной лилии, частицы из текущего sample source |
| 3.5–7.5 | Облако собирается в область фото, ASCII раскрывается из области лица |
| 7.5–10.5 | Стабильный читаемый ASCII; исходная фотографическая подложка38% сохраняет детали лица |
| 10.5–13.5 | Crossfade в точную исходную фотографию, без вертикальной шторки |
| 13.5–15 | Проявление общей рамки |
| 14.25–15.75 | «С этого всё началось» после0.75s паузы на полном фото |
| 15.75–21 | Спокойное фото/подпись; на21 автоматическая передача gallery/exploring |

Поздний интервал18.5–21 оставлен неподвижным для просмотра и совпадения с базовой галереей; это допустимая калибровка приблизительных окон брифа (D01), без дополнительного сюжетного шага.

## Изменённые файлы

| Файл | Назначение |
|---|---|
| frontend/src/engine/filmConfig.ts | Единые окна21s и название сцены04 |
| frontend/src/engine/CameraDirector.tsx | Только identity: выход из bloom-позы во фронт за3.5s |
| frontend/src/components/SceneOverlay.tsx | Только identity: длительность появления подписи из общего config |
| frontend/src/scenes/IdentityScene.tsx | Прямое source→cloud→portrait, мягкая reveal-маска, оригинальная подложка, удаление локальной лишней хореографии |
| frontend/src/scenes/shared/identityParticles.ts | Детерминированные target/seed/reveal/luminance-данные и сохранённый sample-контракт |
| frontend/src/scenes/shared/identityAscii.ts | Чистое тональное кодирование ASCII |
| frontend/src/scenes/shared/identityFrame.ts | Чистая f(t) и IDENTITY_HANDOFF |
| frontend/src/scenes/shared/identityFrame.test.ts | Новые фазы, caption/photo ordering и конечное состояние |
| frontend/src/scenes/shared/identityRuntime.test.ts | Pause/speed/seek/reset/dispose/re-entry, длительность из config |
| frontend/src/scenes/shared/identityParticles.test.ts | Детерминизм и mapping/reveal-данные |
| frontend/src/scenes/shared/identityAscii.test.ts | Тональный mapper |
| frontend/src/scenes/shared/identityAsset.test.ts | SHA обеих копий фото и отсутствие удалённой render wiring04 |
| frontend/src/engine/film.test.ts | Ожидания нового21s таймлайна |
| frontend/src/engine/filmConfig.test.ts | Монтажные окна/порядок, автоматические границы при сохранённом touch gate |
| docs/scene-04-portrait-direct.md | Подробные технические handoff и реальные проверки |
| AGENTS.md | Только существующий абзац сцены04 внутри autopilot markers обновлён по коду |
| .gitignore | Только allowlist новой папки прогона с/без--wip |
| .autopilot/README.md, state.js, dashboard.html, index.html | Реестр/состояние/дашборд текущего прогона; index hardlink fallback на Windows |
| .autopilot/2026-10-28-prologue-handwriting-ash/state.js | Архив ранее завершённого dashboard state перед новым прогоном |
| .autopilot/2026-10-29-scene04-portrait-direct/ | Бриф, требования, spec, контракт, таск, аудит, handoff и скрипты сравнения screenshots |
| docs/verification/scene04-portrait-direct/ | Реальные baseline/final/rejected-candidate PNG; новые artwork/assets не создавались |

## Проверки

- `npm ci --no-audit --no-fund` из `frontend/` — успешно, Node 24.11.1.
- Базовый `npm run check` — lint, TypeScript, build, 106 тестов в 27 файлах.
- Финальный `npm run check`, выполненный координатором на окончательном коде, — lint, TypeScript, production build и 118 тестов в 30 файлах, exit 0.
- `npm run dev -- --port 5184 --strictPort` — сервер этой worktree на http://127.0.0.1:5184/. Другие серверы не останавливались.
- Playwright, viewport 1024×768: снимки на 0/2/3.5/5/6/7/7.5/8/10/13/13.5/14/17/20/21 секунде и при входе в 05. Перед захватом ожидалось соответствующее значение DEV label и новые кадры браузера. Первые захваты до загрузки текстуры были заменены корректными.
- `prefers-reduced-motion: reduce` и низкое качество на 2/8/13.5/17 секунде: сцена не пустая, путь упрощён, canvas один. В портретном viewport 768×1024 фото и подпись не обрезаны.
- Автоматический переход 04→05 даёт `gallery / exploring` и сохраняет тот же DOM canvas. Photo ROI `[321,137,702,518]`, t21 против входа в 05: max delta 0, mean RGB delta `[0,0,0]`. Карточка при этом пересоздаётся, canvas сохраняется.
- Обратная перемотка 13.5→8 и перезапуск→8: ROI `[280,80,760,600]` совпал с первым t8, max delta 0 и mean RGB delta `[0,0,0]`. Остаточных видимых частиц и дублирования не обнаружено.
- SHA-256 runtime-фото и `images/start_img.jpg`: `BEFAD4FD1F270558EEAB25113BB169ED25479CE7B7CB3DB7812FDCE29124D899`. Фото не изменялось.
- Browser console: 0 ошибок. Сохраняются предупреждения Three.js и существующий build advisory о chunk >500 kB.
- Код-ревью: Manifest/Spec — clean после исправлений; Craft — blocking: none. Необязательные улучшения тестов отложены: независимые ожидаемые world coordinates, отдельный shader-test reduced motion и привязка hash-test к импорту. Текущее поведение проверено по коду, браузеру и хэшам файлов.

Физический iPad/Safari, GPU heap и производительность на устройстве не проверены. Снимки 46–58 из пользовательского списка не были приложены; сравнение относится к committed baseline `01c4d925`, а не к более новым незакоммиченным эффектам. Новых утверждённых keyframes нет. Эта визуальная редакция готова к ручной авторской оценке и не объявлена финальным Story Lock.

## HANDOFF 03→04

Сейчас `BloomScene` владеет существующей процедурной лилией и touch gate. После 22 секунд playback reducer автоматически входит в `identity / playing`. `SceneDirector` пересоздаёт существующий `Lily` component в 04: это placeholder-путь, а не перенос того же GLB object.

Сохраняется `LilyParticleSource.sample(index: number, count: number): [number, number, number]`. Позиции должны быть стабильны и приведены внешним адаптером к корню `IdentityScene` в film world units. Renderer копирует их в принадлежащие сцене GPU buffers и освобождает собственные ресурсы. Контракт не содержит velocities, live GPU buffers, владения внешним mesh или автоматической трансформации GLB.

Будущий producer из 03 должен сохранить тот же раскрытый mesh, подготовить или кэшировать точки поверхности, сначала отделять частицы с лепестков, затем с остальных частей, и согласовать anchor/world transform с корнем 04. Исчезновение областей того же mesh должно идти параллельно отделению частиц, некоторое время сохраняя силуэт. Сейчас GLB sampling, передача живого объекта и mesh-alpha adapter не реализованы. Для переноса того же объекта потребуется отдельная интеграция `SceneDirector`/03; финальная лилия не должна подменяться mock geometry.

Камерой всегда владеет `CameraDirector`. Базовая входная поза: position `[1.7,4.5,4]`, target `[0,.2,0]`, как в конце базовой 03. За 3.5 секунды она приходит во front `[0,0,5.6]`, target `[0,0,0]`. Окончательные pose/anchor параллельной GLB-лилии ожидают интеграции. Reduced motion использует принятый director front.

## HANDOFF 04→05

На 21 секунде: точный asset `frontend/src/assets/start_img.jpg`, parent position `[0,.08,0]`, scale `1`, rotation `0`, photo/frame alpha `1`; plane `2.15 × 2.15`, frame `2.23 × 2.23`. Camera `[0,0,5.6]`, target `[0,0,0]`; адаптация к портретному экрану остаётся у `CameraDirector`.

Владение визуальным снимком передаёт `SceneDirector` при автоматическом complete: identity unmount, gallery index 0 mount в режиме `exploring`. Совпадение с базовой 05 подтверждено пиксельно; живой Three.js object не переносится. Если новая галерея основной папки использует другую позу или коридор, это нужно отдельно сопоставить при интеграции. Файлы 05 здесь не изменялись.

## Ручное объединение позднее

Действия интеграции относятся к будущей ручной сессии и здесь не выполнялись. Сначала нужно сохранить параллельную разработку в её собственных ветках и коммитах, затем выбрать отдельную integration branch с чистым статусом. Не применять reset или stash к чужим правкам. Изучить `git diff 01c4d925..codex/scene04-portrait-direct -- frontend/src` и технический handoff, затем выполнить согласованное ручное объединение.

Вероятные конфликты:

- `filmConfig.ts`: удалённые окна name/particles/morph и duration 21.
- `CameraDirector.tsx`: окончательная поза сцены 03.
- `IdentityScene.tsx` и `identityParticles.ts`: новые незакоммиченные identity-модули основной папки.
- `SceneOverlay`/новая `GalleryOverlay`, а также process-файлы `.autopilot` и `AGENTS.md`.

Не откатывать параллельную разработку 03/05 и не восстанавливать прежние 34-секундные этапы автоматически. После разрешения конфликтов проверить все consumers `TIMING.identity`, handoff poses и владение ассетами, выполнить `npm run check` и повторить проверку браузера и устройства. Код изолирован в `19edf41`; проверочные и process-изменения следуют отдельным коммитом.
