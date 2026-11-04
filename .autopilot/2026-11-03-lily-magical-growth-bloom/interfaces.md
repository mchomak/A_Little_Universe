# Что уже построено

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Existing Scene Config / DEV Editor | четырьмя группами настроек | typed config, normalization/store/import/export/reset | clamp/defaults/storage |
| Lily runtime material layer | клоны GLB-материалов, общие stable uniforms | compose material patch + update from scene pose/time/config | GLSL detail, resource cleanup |
| Lily magical particle layer | growth vortex/pollen, posed anchors, deterministic time | integration in persistent AnimatedLily using scene/runtime/config | seeded trajectories, point resources, tails |
Швы тестов: existing config public boundaries; pure time/anchor evaluator used by rendering; shader-patch composition. Persistent film runtime owns timing/camera/state; particles only read them.


## Общие правила проекта
Worktree: C:/Users/McHomak/.codex/worktrees/lily-magical-growth-bloom/A_Little_Universe. Branch: codex/lily-magical-growth-bloom. Другие worktree запрещено менять. Не откатывать чужие изменения; работа ведётся вместе с другими агентами, зоны — по таскам.
React/TypeScript/Vite/Three/R3F/GSAP; новых зависимостей не добавлять. npm ci уже запущен координатором. Команды из frontend: npm run check, npm test -- src/systems/scene-config/config.test.ts. Проверить npm scripts перед выбором точной single-file команды.
Не менять GLB, animation clips, камеру, глобальный свет, scene04–09. dissolve.ts read-only reference; compose существующий onBeforeCompile hook в отдельном material helper.
SceneDirector держит один AnimatedLily без scene key. FilmRuntime и subscribeLilyAnimationClock — владельцы времени; callbacks должны работать paused/seek/DEV config edits/replay. Все новые shader/callback refs требуют cleanup. Все GPU/shared useGLTF ресурсы имеют существующего владельца; dispose только собственные клоны.
Актуальный origin/main ddeff58 имеет config v20; новые поля должны импортировать существующие версии, bump schema v21. В main присутствуют эффекты частиц роста и импульса стебля: сохранить их независимо и без переписывания.
При отсутствии зависимости верни BLOCKED, не устанавливай новую сам.

## Обнаружено в GLB и runtime
- Growth анимирует transforms+morphs, не bones. Head_Root (Lily_Root/Head_Root) и Flower_Interior имеют совпадающую мировую точку. Head Y проходит -1.396→1.019, scale .003→3 за сцену 5.1→14.1; world X/Z тоже меняются. Для Growth Vortex использовать его реально обновлённую matrixWorld ПОСЛЕ player.seek/updateWorldMatrix — это активная верхняя зона, без fixed-height approximation.
- Bloom cup origin около (.27,1.019,.54). Flower_Interior содержит Flower_Details, anthers/filaments идут материалами Anther_SoftGold/Filament_Ivory. При необходимости deformed sampling: Mesh.getVertexPosition(index,target) уже учитывает morphs; scene04 full sampling helper не копировать на каждый кадр.
- FilmRuntime presentationTime продолжает идти в waiting, time остаётся0. Оба freeze на paused/hold. createBloomTextClock показывает wait-origin + carried elapsed и reset по revision; DEV seek создаёт новый runtime clock и revision. После interaction время bloom уже seekable. Абсолютная particle identity/time — без delta-интеграции.
- Предварительный конфиг согласован: growth.lilyBudGlow(enabled,intensity,color,rimStrength,bloomBoost); growth.lilyLeafMaterial(translucencyStrength,edgeLightIntensity,colorVariation); growth.growthVortex(enabled,particleCount,particleSize,sizeVariation,brightness,orbitRadius,rotationSpeed,verticalSpread,spiralTightness,dissipationDuration,dissipationSpread,color); bloom.lilyBloomPollen(enabled,particleCount,particleSize,glowIntensity,riseSpeed,spreadRadius,lifetime,innerCupGlow). Все пути ниже config.scenes. Финальный контракт таска01 имеет приоритет над предварительным.


## Из таска 03 — две группы bloom pollen

- `BloomPollenGroup = 'inner' | 'outer'` разделяет парящие в чаше и обходящие лепестки частицы.
- `getBloomPollenParticleLimit(count, quality, reducedMotion?, group?)` делит общий count budget между группами, сохраняя суммарный лимит.
- `getBloomPollenOpacity(seed, openProgress, age, settings, group?)` задаёт детерминированное позднее проявление и время затухания группы.
- `getBloomPollenPosition(seed, age, anchor, settings, out, worldScale?, motionScale?, group?, innerAnchor?)` вычисляет позу абсолютного времени: ограниченное парение внутри чаши либо восходящий обход и боковое рассеивание снаружи.
- Тестовый шов: эти же evaluator-функции, используемые persistent Lily VFX update; без накопленной delta-интеграции.

## Из таска 05 — нижняя спираль и внутренний дрейф

- `getGrowthVortexPosition(seed, elapsed, dissipation, anchor, settings, out, worldScale?, motionScale?, growthProgress?, flowerHeight?, budAnchor = anchor)` сохраняет начало у точки роста и вычисляет source частицы относительно текущего posed head anchor и её `birthProgress`; источник остаётся ниже бутона и масштабируется вместе с растением. Значение `budAnchor` по умолчанию сохраняет прежние вызовы тестового шва.
- Inner bloom pollen использует тот же `getBloomPollenPosition` test seam, остаётся привязанной к posed anther anchor и строит индивидуальную ограниченную траекторию из seed + absolute age, без общего orbit phase.
- Новых настроек или публичных конфигурационных полей нет; параметры DEV продолжают влиять на бюджет, радиус, скорость, reduced motion и seek через существующий update path.
