# Границы, решённые в спецификации

| Единица | Владеет | Публичный шов | Прячет |
|---|---|---|---|
| DEV portrait sampler/settings | неизменный утверждённый фотошаблон | `sampleStarPortraitTargets(source, settings)`, `ParticlePortraitSettings` | фото-выборку, цвета и matte |
| Lily particle geometry / motion | соответствие уникальных частиц, видимых позиций и целевых точек, абсолютное время | существующий `createLilyParticleGeometry`, CPU-зеркало вихря; расширяемый `LilyPortraitGeometryOptions` | поиск кандидатов и маршруты |
| Lily material | общий вихрь и плавную фиксацию | существующие `createLilyParticleMaterial`, обновление uniforms | GLSL и интерполяцию |
| Scene composer | безопасные настройки сцены | существующие schema, normalize, DEV controls | версии и ограничения |

## Согласованный контракт сцены

В `scenes.identity`: `portraitStartProgress` (default .30), существующая `portraitFraction` (default .40, 0…<.5), `portraitMinTurns` (default 0) и `portraitMaxTurns` (default 2; оба 0…4), `portraitSteering` (default 1, 0…2), `portraitBraking` (default 1, .25…2), `portraitSettledBrightness` (default 1.15), `vortexSpeedMultiplier` (default .9). Нормализация гарантирует minTurns ≤ maxTurns. `particleCount` по умолчанию 80 000 для полного шаблона 32 000 с 60% остающихся частиц; диапазон допускает это значение. Существующие старые конфигурации нормализуются и не ломаются.

Геометрия получает исходные `StarPortraitPoint[]`, world-цели, источник лилии, настройки камеры как функцию времени, параметры распада и вышеперечисленного захвата. Создать **единственный** Points/BufferGeometry; назначать уникальные видимые исходные индексы без GPU readback и без геометрических обновлений в кадре. Цвет `photoColorLinear` — в существующий `aPortraitSourceColor`; передать tone/contrast/seed через совместимые атрибуты. Исходящий 0…1 `startProgress` равен фазе распада, отбор возможен только после фактического отсоединения частицы. CPU-план и GLSL используют один effective swirl speed, включая множитель.

Рабочий каталог: `C:/Users/McHomak/Projects/A_Little_Universe_scene02_03/frontend`. Node-зависимости уже установлены; не устанавливать дополнительные пакеты. Изолированные участки по таскам, каждый исполнитель не один в worktree и не откатывает чужие изменения. Проверять детерминизм и поведение на общедоступных швах; итоговая команда `npm run check`. Использовать `C:/Users/McHomak/.agents/skills/autopilot/prompts/executor.md`. Не создавать ветку, не выполнять merge, не менять распад и не добавлять новую систему частиц.

## Построено таском 01

- `scenes.identity`: `portraitStartProgress`, `portraitFraction`, `portraitMinTurns`, `portraitMaxTurns`, `portraitSteering`, `portraitBraking`, `portraitSettledBrightness`, `vortexSpeedMultiplier`; default `particleCount` 80000. Старое поле `portraitStart` сохранено для нормализации, но основной slider удалён. Рантайм подключает новые поля в тасках 02/03.

## Построено таском 02

- `LilyVisiblePortraitGeometryOptions`: `targets: readonly StarPortraitPoint[]`, `targetPositions`, `cameraBasisAtTime(time): PortraitCameraBasis`, `capture: LilyPortraitCaptureSettings`.
- `LilyPortraitCaptureSettings`: `portraitStartProgress`, `portraitFraction`, `portraitMinTurns`, `portraitMaxTurns`, `portraitSteering`, `portraitBraking`, `portraitSettledBrightness`, `vortexSpeedMultiplier`.
- Uniforms: `uLilyVortexSpeedMultiplier`, `uLilyPortraitSteering`, `uLilyPortraitBraking`, `uLilyPortraitSettledBrightness`; `aPortraitSeedData` — vec3 target seed, feature weight и capture-motion flag. CPU: `getLilyParticlePortraitPosition(route, time, source, settings, controls?)`, `getLilyParticleCaptureRiseAge`, `getLilyParticleFade`. Старый geometry option со статической камерой сохранён.
- D02: небольшая группа будущих частиц с длинным вращением получает плавное ограничение подъёма/удержание fade, одинаковое в CPU и GLSL; остальной вихрь неизменен. Реальная GLB-сцена проверяется в таске 03.
- D03: `aPortraitRoute` равен 1 для маршрутов видимого захвата и 0 для legacy/DEV. Усиление яркости начинается после прибытия и плавно нарастает 0.35 с. У положительных витков при нулевой угловой скорости/ускорении нет назначаемого маршрута. Повторный benchmark: 32k/32k, ~320 мс; 607 назначенных маршрутов проходят 1.8–2 витка.

## Построено таском 03

- `portraitIntegration.ts`: `toStarPortraitSamplingSettings`, `toLilyPortraitAppearanceSettings`, `toLilyPortraitUniformScales`, `sampleLilyPortraitTargets`, `orderLilyPortraitTargets`, `createLilyPortraitCameraBasisAtTime`, `placeLilyPortraitTargets`, `toLilyPortraitCaptureSettings` адаптируют сохранённые настройки DEV и camera timeline к общему Lily renderer.
- `LilyDissolveParticles` читает `loadParticlePortraitSettings().settings`, использует общий sampler и единственный Points. На реальном GLB Bloom endpoint с фото/matte и движущейся камерой 4:3: 32 000 назначений из 80 000, ~260 мс на этом компьютере. Физический iPad не проверен.

