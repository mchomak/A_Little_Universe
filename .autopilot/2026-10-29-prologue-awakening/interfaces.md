# Границы, решённые в спецификации

Существующий React/TypeScript/R3F/GSAP стек, один canvas, без новых зависимостей по текущей диагностике.

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Film/config/light | schema, timing18, waiting clock, gate, PersistentLight, минимальный growth handoff, cues, composer | существующие getPrologueFrames/getConfig/FilmRuntime плюс единый transition duration | внутренние DOM/GPU слои света |
| Letter/dust | измерение текста, письмо, общая alpha fracture карта, glyph sampling, particles | существующий PrologueOverlay/PrologueScene и чистые sampling/math seams | raster cache, shaders |
| Atmosphere | низкоконтрастная глубина и редкие фоновые particles | PrologueAtmosphere(props SceneProps), подключается в PrologueScene | shader/buffers |

Швы: film reducer/runtime/config normalization, frame helpers, overlay timeline/layout, particleMath. Тестировать поведение, не исходные строки shaders.

## Общие правила
- Работа в C:/Users/McHomak/Projects/A_Little_Universe; команды из frontend: npm test -- <file>, npm run check.
- Dirty tree содержит чужие изменения. Не откатывать/не коммитить/не форматировать постороннее. Не устанавливать зависимости; при необходимости вернуть BLOCKED с названием.
- Нельзя менять 00/00.1, media/consents, eye lab, identity/gallery и дальнейшие сцены. Growth только минимальный light-entry handoff.
- Весь код пишут исполнители. Общие интерфейсы обновляет только оркестратор.
- Конфигурацию/filmConfig/runtime меняет только01. Исполнители02/03 читают готовые поля.
-02 владеет PersistentLight, app-light wiring/CSS, Growth entry, PrologueAtmosphere (новый файл), DeveloperPanel prologue controls и аудиопотреблением.
-03 владеет PrologueOverlay/CSS, PrologueScene, prologue/particleMath и общими glyph/fracture helpers.03 подключает готовый PrologueAtmosphere из02.
-01 фиксирует новые prologue поля и их defaults; перед02/03 добавить точный список ниже. Использовать schema v2 аддитивно, старые v1/v2 файлы продолжают импортироваться.
- FilmRuntime.time — canonical scene time. Для waiting допустим отдельный presentationTime в ТОМ ЖЕ runtime/clock, не timer сцены. time/elapsed gate остаётся18. Поведение pause/speed/visibility и test seam передать следующим исполнителям.
- Transition length должен иметь общий getter/константу, используемый reducer/clock и светом. Не дублировать duration literals.
-02 не редактирует PrologueScene.03 импортирует PrologueAtmosphere, props как SceneProps. Связь async font/layout обновляется без гонок и утечек.
- Физический iPad/Safari недоступен: эмуляция отмечается как эмуляция.

## Готовый контракт01 (проверен Manifest/Spec/Craft)
- schemaVersion2 аддитивна. prologue новые поля: coreIntensity1, innerGlowRadius16, outerGlowRadius95, phraseResponse.12, touchIntensity.55, touchDuration.85, waveStrength.14, waveRadius70, atmosphereDensity42, hazeIntensity.035, spaceDepth.35, driftSpeed.035, secondFontScale.86, textGap34, textGlow.22, particleSizeMin.6, particleSizeMax1.8, particleGlow.95, copyVariant awakening|legacy. pulseFrequency.22 (~4.5с), pulseAmplitude.035.
- getPrologueCopy(settings)->{first,second}; импорт из engine/filmConfig. Новый default COPY.prologueSecond. Legacy через copyVariant.
- frames first2–5.5, second7–10.5, hold10.5–12.5, dissolve12.5–16, duration18, prompt18 (время полностью видимого приглашения). Приглашение начинает появляться в frames.dissolve[1], т.е.16, не prompt−.65.
- FilmRuntime.presentationTime:number + subscribePresentation(listener(time)); canonical time остаётся18 в waiting. Runtime.publish(time,presentationTime=time); publishPresentation(time). Waiting продолжает ТОТ ЖЕ GSAP clock, контролирует pause/speed/visibility, не спамит canonical listeners.
- Для света/атмосферы direct subscribePresentation draw+invalidate, useSceneAnimation конечной длительности обрезает idle.
- FilmState.prologueTouchDuration? фиксируется при interact; getPrologueTouchDuration(settings?) .7–1 (default.85); filmDuration использует captured значение.
- systems/audio/prologueCues.ts getPrologueAudioCues(frames)->{time,cue}[] intro/first/second/dissolve, touch сохраняется по переходу.
- Focused29 tests, typecheck/lint прошли. Full suite пока5 stale expectations consumers/таймингов, закрываются01/02/03.
