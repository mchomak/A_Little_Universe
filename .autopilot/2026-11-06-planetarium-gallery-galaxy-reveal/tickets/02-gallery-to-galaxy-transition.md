# T02 — Прямой переход Gallery → Galaxy

## Требования
R10–R24, R27–R42.

## Спецификация
Spec: stories 6–11, «Решения по реализации» (route, transition shader, existing star layers, shared time).

## Владелец
frontend/src/engine/film.ts, filmConfig.ts, CameraDirector.tsx, SceneDirector.tsx, frontend/src/scenes/gallery/planetariumTransition.tsx, frontend/src/scenes/galaxy/. Использовать финальный anchor из T01; не переделывать gallery layout и не менять galleryCameraPose.ts.

## Приёмка
- Eye нельзя выбрать или увидеть в обычном runtime и Dev scene navigation; галерея переходит непосредственно в cosmos.
- Galaxy остаётся доступна для Dev-jump; обычный Dev-jump не получает special-route offset.
- Во время gallery exit и cosmos transition камера, photo blur/zoom/fade и Galaxy reveal идут на общем времени без пустого/чёрного кадра и без галереи позади.
- За photo overlay видны только Galaxy background/star layers; под фото нет колонн, облаков или пола.
- Существующие Galaxy point layers временно отображаются на светлых screen UV Planetarium photo и постепенно выходят из маски; count и geometry Galaxy не удваиваются.
- Фото полностью растворено до конца формирования; обычная Scene 07 продолжается без camera/reveal reset, затем работает поздравление.
- Прямые Dev jumps в cosmos, повторный запуск и другие сцены сохраняют прежнее поведение.
- Не открывать браузер, не снимать скриншоты, не запускать unit/visual tests. Source edits должен делать autopilot_code_worker. После принятия изменений координатор запускает только typecheck и production build, создаёт коммит в новой ветке и выполняет fast-forward push в origin/main без force.
