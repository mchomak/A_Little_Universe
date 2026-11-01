# Interfaces

Существующая поверхность остаётся `LilySurfaceSource` (`sampleSurface(index, count)`). `AnimatedLily` обновляет общие dissolve uniforms из FilmRuntime и Composer v5; `createLilyParticleMaterial` использует эти uniforms в одном GPU `Points` batch. `lilyDissolvePart` классифицирует `Petals*` как 0, `Flower_Details`/`Calyx` как 1 и stem/leaves как 2. `LilyDissolveParticles` ограничивает count профилем качества и освобождает геометрию/материал.

Config identity: `particleCount`, `particleBrightness`, `vortexRadius`, `vortexExpansion`, `swirlSpeed`, `swirlAcceleration`, `centerDissolveAt`; центральный порог — середина лепестковой фазовой шкалы по умолчанию. Все движения вычисляются от абсолютного сценического времени.

Проверки из `frontend/`: `npm run check`; focused: `npm test -- src/scenes/lily/dissolve.test.ts src/scenes/lily/particleSource.test.ts src/systems/scene-config/config.test.ts`.
