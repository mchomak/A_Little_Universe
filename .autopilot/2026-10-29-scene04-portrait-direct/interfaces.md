# Границы, решённые в спецификации

IdentityFrame владеет чистой фазой f(t), использует существующий TIMING.identity; exposes identityFrame(time). Identity renderer owns GPU data/materials/ASCII but not camera/global clock/asset bytes. LilyParticleSource exposes stable local samples, optional handoff additive; external ownership stays external. CameraDirector owns camera, только identity branch. SceneOverlay owns caption, только identity copy/timing. Runtime and film reducer reuse current APIs unchanged except test expectations. Tests at these public seams; no new global abstraction.

## Среда
Worktree C:/Users/McHomak/Projects/A_Little_Universe_scene04_direct; branch codex/scene04-portrait-direct; base 01c4d925e1a493d50120405e3cabe87c65187997. Все операции только здесь. Main грязный — не читать/копировать/менять другие worktrees. React/TS/Vite/R3F/Three/GSAP существующих locked версий; Node 24.11.1. npm ci выполнен coordinator; зависимости уже стоят. Не добавлять dependencies; отсутствующая — BLOCKED.

## Команды
Из frontend/: npm test -- <file>; npm run check (lint/Vitest/typecheck/build). Baseline 106 tests/27 files. Dev запуск на отдельном свободном порту 5184 с --strictPort, не занимать 5173 сервера других работ. Browser checks coordinator.

## Нельзя менять
GrowthScene/BloomScene/GalleryScene/другие сцены, их визуальные shared primitives, GLB/.blend/assets bytes, privacy/media/audio общую логику, README/storyboard, глобальный runtime. Shared CameraDirector/filmConfig/SceneOverlay: исключительно identity branch/timing/label. FirstMemoryCard сохраняет общий API и точную photo treatment. Не удалять общие Vortex helpers, если не нужно: отключить их от IdentityScene/Atmosphere. Git commits делает coordinator, не worker.

## Известное
В baseline sample source — mock с дисковыми positions; real mesh не передан. Identity рендерит тот же текущий procedural Lily как placeholder. На boundary 04→05 объект remount, но asset/transform/camera согласуются. Концептуальные refs доступны key_frames/S04_F01/F05/F06/F07. Реальные 46–58 screenshots не прикреплены. Арт не генерировать.

## Из таска 01 — фактический контракт
- LilyParticleSource.sample(index: number, count: number): [number, number, number] возвращает stable identity-root coordinates in film world units; IdentityScene accepts optional particleSource. createIdentityParticleData copies samples into owned buffers; scene disposes owned GPU resources, not external objects.
- identityFrame(time) and IDENTITY_HANDOFF own absolute phases and final transform. Photo is the unchanged frontend/src/assets/start_img.jpg, SHA-256 BEFAD4FD1F270558EEAB25113BB169ED25479CE7B7CB3DB7812FDCE29124D899.
- TIMING.identity21s: dissolve0–3.5, gather3.5–7.5, portrait7.5–10.5, photo10.5–13.5, frame13.5–15, caption14.25–15.75, hold to21. Standard/low; reduced-motion direct path.
- Scene03→04 exact GLB same-object dissolve remains pending; source interface carries positions only. CameraDirector owns poses. At04→05 card [0,.08,0], scale1, rotation0, alpha1, camera[0,0,5.6] target0; existing scene/revision remount visually matches.
