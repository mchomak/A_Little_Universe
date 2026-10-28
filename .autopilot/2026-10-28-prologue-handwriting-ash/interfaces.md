# Interfaces — prologue handwriting and ash

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Film runtime и scene timeline | Единым временем, pause/seek/speed/hidden-tab поведением | Существующие `FilmRuntime` и `createSceneTimeline` | Clock, GSAP timeline lifecycle |
| Composer config | Валидированной immutable schema v2 и v1 normalization | `SceneComposerConfig`, `normalizeConfig(input: unknown)`, `getConfig()`, `updateConfig(patch)` | Диапазоны, migration и заморозку snapshot |
| Prologue DOM overlay | Надписями, layout вокруг постоянного света, доступными labels и масками reveal/fracture | `createPrologueOverlayTimeline(targets, frames, settings, reducedMotion): gsap.core.Timeline` | DOM refs, clip geometry и CSS mask details |
| Prologue particle field | Маской локального шрифта, фиксированными seed и GPU Points-атрибутами | `sampleGlyphParticlePixels`, `getParticleBirthTime`, `getFractureFront`, `resolvePrologueParticleCount` | Canvas readback, BufferGeometry и GLSL uniforms |

Тестовые швы: `getPrologueFrames`, чистые функции particle/front timing, `createSceneTimeline` с `createFilmRuntime`, существующие config normalization и DeveloperPanel. Нового общего clock или renderer seam не добавлять.

## Правила проекта для исполнителей

- Стек остаётся React + TypeScript + Vite, React Three Fiber/Three.js и существующий GSAP runtime; новых пакетов не добавлять без необходимости.
- Запуск frontend-команд из `frontend/`; `npm run check` запускает ESLint, Vitest, строгую TypeScript-проверку и production build.
- Один persistent WebGL Canvas и общий `FilmRuntime`; не создавать локальный render loop, WebGL renderer, React state на кадр или сценовый clock.
- Не трогать сцены, consent UI, upload/recording, offline-cache, scene transitions и файловые ресурсы вне области задач.
- Проектная инструкция запрещает автоматические коммиты в этой сессии; оставлять изменения незакоммиченными.
- При недостающей зависимости не устанавливать её автоматически; сообщить `BLOCKED` с причиной.

## Договор API

### Composer config v2

```ts
interface PrologueConfigV2 {
  particleCount: number
  windStrength: number
  turbulence: number
  fractureWidth: number
  fractureDuration: number
  particleDuration: number // existing 4s prologue particle travel window
  particleFadeDuration: number // ash fade lifetime; default 2.4s
  promptHandwritingDuration: number
  glow: number
  // Existing typography, layout and hold settings remain.
}

normalizeConfig(input: unknown): SceneComposerConfig // immutable v2; accepts v1 and maps compatible fields
```

### Timeline and particle math

```ts
interface PrologueOverlayTimelineTargets {
  first: HTMLParagraphElement | null
  second: HTMLParagraphElement | null
  prompt: HTMLParagraphElement | null
}

createPrologueOverlayTimeline(
  targets: PrologueOverlayTimelineTargets,
  frames: PrologueFrames,
  settings: SceneComposerConfig['scenes']['prologue'],
  reducedMotion: boolean,
): gsap.core.Timeline

sampleGlyphParticlePixels(alpha: Uint8Array, width: number, height: number, count: number, seed: number): Float32Array
getParticleBirthTime(input: { xNormalized: number; yNormalized: number; fractureWidth: number; dissolveStart: number; fractureDuration: number; seed: number }): number
getFractureFront(progress: number, yNormalized: number, fractureWidth: number, seed: number): number
resolvePrologueParticleCount(count: number, quality: QualityProfile, dpr: number, compact: boolean): number
```

`getPrologueFrames(settings)` owns derived timing and the fixed 21-second cap. `createPrologueOverlayTimeline` and particle progress remain bound through existing `useSceneTimeline`/`useSceneAnimation` to shared `runtime.time`; functions above are pure and deterministic. Exact implementation may add private helpers, but these exported test seams and the no-new-clock contract stay stable.

## From ticket 01 - Composer schema v2 and timeline compatibility

- `SceneComposerConfig` publishes immutable schema v2; `normalizeConfig(input: unknown)` accepts v1 and v2 and maps compatible legacy input.
- Composer import/export supports v1 and v2; controls edit the new prologue fields.
- `scenes.prologue.particleDuration` preserves the 4s travel window; `particleFadeDuration` is the separate 2.4s ash fade.
## From ticket 02 - Shared overlay timeline

- `createPrologueOverlayTimeline(targets, frames, settings, reducedMotion): gsap.core.Timeline` drives full-line writing, hold, prompt writing and dissolve from shared film time.
- Overlay dissolve uses `getFractureFront(progress, yNormalized, fractureWidth, seed)` so text and particles share a deterministic front.
## From ticket 03 - GPU ash field

- `getFractureFront(progress, yNormalized, fractureWidth, seed): number` is the deterministic shared dissolve edge.
- `getParticleBirthTime(input): number` and `resolvePrologueParticleCount(count, quality, dpr, compact): number` are pure, deterministic timing/device seams.
- PrologueScene uses one existing `THREE.Points` field driven by shared film time; `particleDuration` remains travel, `particleFadeDuration` controls fade.
- `getParticleFadeStart(...)` and `getParticleSceneOpacity(...)` keep fade timing independent from 4s travel and clamp the shared ash field to zero at 21s.

## From ticket 05 - Wrapped text and geometry safety

```ts
export function groupGlyphFragmentsByLine(
  fragments: readonly GlyphTextFragment[],
  lineRects: readonly GlyphTextLineRect[],
): GlyphMaskLine[]

export function getPrologueParticleVertexCount(count: number): number
```
