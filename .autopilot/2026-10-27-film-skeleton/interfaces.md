# Контракты

Источник границ — spec.md, раздел «Границы и швы». Прочитать его полностью перед реализацией. Публичные типы и действия описаны там; изменения согласовывать через orchestrator.

Существующие зависимости закреплены в frontend/package.json; ничего не устанавливать. Backend, AGENTS.md, storyboard, keyframes и lockfile не менять. Не создавать коммиты — результат остаётся в working tree по текущему workflow проекта.
Рабочая папка C:/Users/McHomak/Projects/A_Little_Universe. Frontend команды из frontend/: npm test; npm test -- src/engine/film.test.ts; npm run typecheck; npm run lint; npm run build; npm run dev.

Время в секундах; сцены: prologue, growth, bloom, identity, gallery, eye, cosmos, greeting, ending. Единственный Canvas. Жизненный цикл через scoped GSAP context + subscribeFrame cleanup; camera только в CameraDirector. DOM текст синхронизируется с общим elapsed. Никаких внешних шрифтов/изображений/запросов устройств.

Проверки логики через filmReducer, cleanup через runtime/hook lifecycle; не создавать тесты, зеркалящие геометрию. Использовать TDD для критических рисков. После задачи вернуть STATUS, FILES (пути), TESTS (команда/результат/предыдущее число), INTERFACES (сигнатуры), REQUIREMENTS, CONCERNS, BLOCKERS — до 25 строк, без кода/диффа.

## Ticket 01: implemented
- filmReducer(state,action,allowDev=false), initialFilmState; state quality standard|low and returnToEnding.
- useFilm() returns {state,dispatch,runtime}; speed 0.25..4.
- createFilmRuntime(); FilmRuntime {readonly time, subscribeFrame(listener):unsubscribe}.
- useSceneTimeline(build,{runtime,reducedMotion?}) drives paused timeline from shared runtime; old Foundation API retained.
- SCENES record {id,label,duration,entryMode}; TIMING per-scene cue intervals, transition, camera.
- COPY flat: prologueFirst, prologueSecond, seedPrompt, flowerPrompt, name, portrait, photo, photoCaption, greetingTitle, greetingWish, letterTitle, letter, credits, ending.
- MEMORIES array {id,index,title,caption,placeholder:true}; SceneId exported from filmConfig.

## Tickets 02/03: implemented
- SceneProps = {state, dispatch, runtime, reducedMotion}; FilmCanvas/CameraDirector/SceneDirector.
- Nine static scene modules, one persistent Canvas; galleryPosition(index), scoped gallery camera timeline.
- App data-scene/data-mode/data-reading/data-paused; DEV ?debug and button, no production panel.
- createGalleryGesture step callback; reading native dialog with focus restoration; quality standard|low.
- Timing repair: growth11..18; matching reduced seed/cloud fall; prologue first3..8, second8.7..14.7.
