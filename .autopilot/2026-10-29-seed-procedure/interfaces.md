# Спецификация — процедурное начало 02

## Поведение и визуальная приёмка
После существующего неограниченного gate 01 и подтверждения касания автоматически запускается 02. Второго gate нет. Фон #080914. Одна точка передаётся между app-level DOM PersistentLight и локальным seed VFX без двух ярких ядер. На старте world origin проецируется в центр пролога; camera director удерживает фронтальную позу до завершения seed handoff, затем продолжает существующий маршрут 02 к прежней конечной позе 03. Сцену 03 и её камеру не изменяем.

Начальные интервалы: seed formation 0–2.2 s, fall 2.2–3.45 s, один слабый landing pulse 3.45–4.15 s; переход к ростку 3.65–4.4 s. Это настраиваемые константы, согласованные с DEV кадрами. Общие 23 s сцены и переход к ожиданию бутона сохраняются. Ранний рост placeholder начинается после приземления; затем доходит до прежнего fully-grown вида к 18 s, удерживается до 23 s. Финальный GLB не подключается.

Семечко: небольшая детерминированная вытянутая группа ivory-white / pale-pink локальных точек, силуэт около 1–2% высоты viewport; не крупная сфера. Формируется из той же исходной искры, опускается спокойно по smooth траектории к plant root. Возможен короткий ограниченный след, исчезающий после остановки. Только один маленький мягкий импульс; без земли, сеток, фоновых звёзд, орбит, галактики, взрыва и новых тяжёлых ассетов/postprocessing. Изображения пользователя служат направлением формы и палитры; размер и один импульс определяет текст.

## Границы и швы
Seed procedure owns pure phase/pose/particle sampling and immutable tunable constants; exposes seed stage, progress, root anchor, local growth time/weight. All samples depend only on explicit scene time, quality and reduced motion. No unseeded randomness or accumulated simulation. Rendering consumes the pose in existing useSceneAnimation/FilmRuntime with refs/buffers; no second canvas, rAF, uncontrolled timers, per-particle React state or global film actions.

Plant anchor initially matches the existing placeholder world base [0,-1.45,0], with local +Y growth, identity rotation, units in Three world space. It is a provisional integration contract, not a fitted final-model transform. Pixel positions forbidden; derive seed extent from current perspective viewport at anchor and aspect-safe scene coordinates. Rotation/resizing while paused recomputes the pose. Small adapter maps pure Growth handoff to the existing procedural placeholder, without changing its materials or scene03. Final GLB importer will consume root anchor and stage/local time after model handoff; do not import/rewrite/reconfigure any Blender/GLB/clips/keyframe file.

PersistentLight keeps current prologue behavior and fades at the existing shared transfer boundary. Seed VFX uses complementary transfer weight at the same projected center before any fall. Gain continuity checked at 01 end/02 start and transfer midpoint; only one seed core, no always-visible blue Spark in early 02. Existing global lights/canvas untouched. No changes to copy, scenes04–09, permissions/preparation/recording or app architecture.

## Interruption, quality, resources
Pause/resume and tab visibility follow canonical runtime; seek, reset, replay, scene navigation recreate identical time samples even when traversed backward. Runtime subscriptions and GSAP contexts clean up through existing hook, declarative R3F resources dispose on unmount; manually constructed resources explicitly dispose. No transient scene lights/listeners survive exit. Low quality reduces counts; reduced motion keeps a quiet continuous comprehensible descent and growth handoff, disables trail and pulse, no step teleport or flashes. Reduced camera remains existing front view. Geometry bounded and inexpensive.

## Verification and delivery
Run npm run check (lint, Vitest, strict TS and production build), add meaningful seam tests for deterministic phases, landing/root, complementary ownership, gate01 + one activation + automatic02 + unchanged waiting03, seek/replay and cleanup. Browser inspect DEV states formed/in-flight/landing/handoff in landscape1024x768 and portrait768x1024 (browser emulation only). Check actual pause/resume, reset/replay, scene exit, no extra gates and no light jump. Capture screenshots of four states, compare 01→02 boundary and include reproducible exact seek times. Use existing DEV editor/debug hooks, no production debug surface. Document concrete changed paths, tuning locations, integration anchor/transform/Growth trigger/light ownership, remaining final GLB reconciliation and precise unperformed checks. No branch merge. No physical iPad claim.

## Допущения и вне рамок
Existing schematic Lily remains explicitly a development placeholder, bloom/materials unchanged. Model normalization, size, exact root and actual clip length await Blender-track handoff. No unrelated IDE selection change to prologue timing: user specifically excludes copy/prologue artistic edits in this task. No new dependencies. No speculative infrastructure. Isolated branch/worktree from preexisting frontend snapshot8900590; main dirty files untouched.

## Проверенный контекст перед изменениями
Прочитаны README.md, docs/architecture.md, storyboard02, GrowthScene/BloomScene, runtime/useSceneTimeline, filmConfig/film gate, SceneDirector, FilmCanvas, CameraDirector, PersistentLight/lightPose и lilyPose/Primitives. Фактический API: useSceneAnimation(runtime, duration, draw), SceneProps{state,dispatch,runtime,reducedMotion}; root [0,-1.45,0] и 23 s/18 s — существующие значения, сохранённые для совместимости. Удержание камеры — локальная адаптация существующей CameraDirector choreography ради совпадения центральных источников, без новой камеры. База8900590 — обнаруженный сохранённый снимок уже имеющейся локальной foundation; commit не создавался этой сборкой.


## Фактический контракт
getSeedPose(time, viewportHeight, reducedMotion); getGrowthHandoff(time, viewportHeight?, reducedMotion?) -> {anchor, stage, localTime, weight}. В4.4localTime=.75,weight=.065; root[0,-1.45,0], +Y, identity/unit. No new globalfilm state or events. Browser evidence and exact tuning locations: acceptance.md.
