# Приёмка сцены 02

Изолированная ветка `codex/scene02-seed-procedure`, worktree `C:/Users/McHomak/.codex/worktrees/scene02-procedure/A_Little_Universe`, baseline8900590. Ветки не слиты. Основная рабочая папка и Blender-track не изменялись.

## Кадры

| Состояние | Время | 1024×768 | 768×1024 |
|---|---:|---|---|
| Семечко сформировано | 2.15 с | [PNG](evidence/landscape-formed.png) | [PNG](evidence/portrait-formed.png) |
| Полёт | 2.8 с | [PNG](evidence/landscape-flight.png) | [PNG](evidence/portrait-flight.png) |
| Остановка / импульс | 3.7 с | [PNG](evidence/landscape-landing.png) | [PNG](evidence/portrait-landing.png) |
| Росток / передача | 4.4 с | [PNG](evidence/landscape-handoff.png) | [PNG](evidence/portrait-handoff.png) |

Сформированное семечко занимает14 px /768 и18 px /1024: около1.8% высоты. Локальная область сбора частиц в ранней фазе шире сформированного семечка; это не дополнительная сфера. UI скрывался только временным CSS в браузере для capture; в исходники это не записано. Фон #080914. Placeholder-росток остаётся условной геометрией.

## Проверено

- `npm ci`:232 packages,0 vulnerabilities. `npm run check`: exit0,195tests/51files, lint, strictTS и productionbuild. [Полный лог](evidence/npm-check.log).
- Gate01 удерживалcanonical18 с при presentationtime>137 с; доступна единственная точка. Одно реальное click запускает прежний touch transition, затем02; второго gate нет.
- Передача света: t0DOMalpha1/частицы0, t.575DOMalpha.5, t1.15DOMalpha0. Оба источника проецируются в центр[0,0,0]. [0](evidence/transfer-0.png), [.575](evidence/transfer-0.575.png), [1.15](evidence/transfer-1.15.png). Раздвоения источника на этих кадрах нет.
- Pause/resume:2.15 удерживалось на паузе; продолжение изменяло canonicaltime. Функциональность проверялась native кнопками и существующим DEV dispatch. Replay возвращал в пролог; после реального gate и касания [кадр replay2.15](evidence/replay-formed.png) побайтово совпал с исходным landscape PNG.
- На чистой загрузке повторные DEVseek2.15/2.8/3.7/4.4/2.15/2.8 давали постоянные gl.info.memory14geometry/1texture. Выход в пролог:6geometry, старых объектов02 нет. Автоматический переход с22.8 к03: canonical0, текст «Прикоснись к бутону»,0Points,11geometry, один Canvas.
- Два viewport, поворот на паузе: world scale .03856469 landscape и .05732370 portrait; материал сохраняетopacity.86 при low/standard. Устранены найденные paused uniform-reset и stale camera sizing.
- Reduced motion +low:8seed points, trailalpha0, ringopacity0, один Canvas. Дополнительный screenshot reduced-mode завис в Chrome tool; он не сохранён, режим проверен по live состоянию.
- После чистой загрузки console errors отсутствуют. Craft final clean. G2 уточнил источник/предварительное чтение; G4 не нашёл незапрошенной runtime поверхности. Независимый G4 выполнил HTTP/tests и чтение, а UI приёмку выполнил coordinator.

## Изменённые файлы продукта

- frontend/src/scenes/GrowthScene.tsx — локальный VFX и placeholder adapter.
- frontend/src/scenes/growth/seedProcedure.ts — deterministic pose/particles, anchor и Growth contract.
- frontend/src/scenes/growth/seedProcedure.test.ts — regression tests.
- frontend/src/engine/filmConfig.ts — интервалы02 без изменения общей23s длительности.
- frontend/src/engine/CameraDirector.tsx — камера02 удерживается до4.4, прежняя конечная поза.
- frontend/src/debug/timelineModel.ts — DEV markers02.
- docs/scene-02-seed.md — настройка, контракт и проверка.
- README.md и docs/architecture.md — точный статус частично реализованной02.
- AGENTS.md — компактная память реализации внутри autopilot block.
- .autopilot/README.md,state.js,dashboard.html и запись текущей сборки — процесс/приёмка/PNG; прежний state сохранён в архиве пролога.

## Где настраивать

- TIMING.growth в frontend/src/engine/filmConfig.ts:9:formation0–2.2,fall2.2–3.45,landing3.45–4.15,handoff3.65–4.4,sprout до18,duration23.
- GrowthScene.tsx:10 — SEED_COLORS; :19 — gl_PointSize2.7; :11/:74 — trail9/5; :132/:143 — цвет ядра и кольца.
- seedProcedure.ts:91 — seed22/8; :5 — SEED_ROOT; :71 и GrowthScene.tsx:81 — seed extent; getGrowthViewportHeight() повторяет существующую фронтальную camera fit/FOV.

## Контракт интеграции

Provisional world root[0,-1.45,0], +Y вверх, identityrotation, unitsscale1. Новый GLB размещается корневым pivot в этом anchor после подтверждения ориентации/масштаба Blender-track. getGrowthHandoff(time) возвращает{anchor,stage,localTime,weight}; Growth начинается3.65, localTime=max(0,t−3.65). В4.4localTime=.75, weight=.065; полный placeholderweight1 к18. Отдельный pose.handoff0→1 описывает только визуальную передачу3.65–4.4 и не равен весу полного роста.

PersistentLight остаётся владельцем исходной точки на входе02 и передаёт её сценическому ядру в течение1.15. После этого сценой владеет GrowthScene. Согласовать окончательные GLBroot/orientation/scale, имена и длительность Growthclip и заменить placeholder нужно после handoff модели. Эта ветка модель и клипы не импортирует и не изменяет.

Физические iPad/Safari, GPU performance на целевом планшете и финальная GLB не проверены. Существуют прежние предупреждения Vite nativeconfig, ThreeCJS и Appchunk>500kB. Пустых env для этой функции нет; новых services/dependencies нет. Все запрошенные изменения кода доставлены; финальная художественная модель намеренно остаётся последующим этапом.
