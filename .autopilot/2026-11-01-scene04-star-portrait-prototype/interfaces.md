# Interfaces — Scene 04 particle portrait

Implementation worktree: `C:\Users\McHomak\Projects\A_Little_Universe_scene02_03`, branch `codex/scene02-03-continuity`.

## Product boundary

- React + TypeScript + Vite + React Three Fiber + Three.js. Do not install dependencies.
- Keep the new route DEV-only and lazy-loaded from `frontend/src/main.tsx`.
- Keep the production film route and Scene 04 motion/portrait targeting/timeline unchanged. Shared shader changes must be additive and render-identical under existing defaults.
- Use the existing runtime assets `frontend/src/assets/start_img.jpg` and `frontend/src/assets/start_img.matte.png`.
- Preview is one R3F `<Canvas>` using the same WebGLRenderer context options as `FilmCanvas` (`frameloop="demand"`, antialias, alpha, default power preference) and the existing `createLilyParticleMaterial()`. The original photo is an aligned DOM comparison layer. No separate postprocessing renderer or bloom dependency.
- Use a fixed camera; no particle or camera animation. Keep the existing point core/halo appearance. The route owns only its separate DEV Canvas lifecycle.
- Run frontend work from `frontend/`, Node.js >=22.12. `npm run build` is the required end-to-end build check. Add and run focused tests for new sampler/shader/UI seams; do not run the full suite unless requested or a focused check indicates a need.
- Do not install packages. Return `BLOCKED` if a dependency is missing.

## Public seams

### Target sampler (`frontend/src/scenes/lily/starPortraitTargets.ts`)

```ts
export type StarPortraitSource = {
  width: number
  height: number
  photoRgba: Uint8ClampedArray
  matteRgba: Uint8ClampedArray
}

export type StarPortraitSamplingSettings = {
  count: number
  detailBoost: number
  fillDensity: number
  contrast: number
  backgroundThreshold: number
  irregularity: number
  seed?: number
}

export type StarPortraitPoint = {
  u: number
  v: number
  tone: number
  contrast: number
  featureWeight: number
  seed: number
  photoColorLinear: readonly [number, number, number]
}

export function sampleStarPortraitTargets(
  source: StarPortraitSource,
  settings: StarPortraitSamplingSettings,
): StarPortraitPoint[]
```

The sampler owns input validation, matte-aware feature/fill weighting and deterministic irregular sampling. It is pure and does not import React, Three.js, the camera, or Scene 04 animation code.

### Shared particle appearance (`frontend/src/scenes/lily/dissolve.ts`)

Add an exported `LilyPortraitAppearanceSettings` with `photoColorMix`, `opacity`, `glow`, `minSize`, and `maxSize`, plus `updateLilyPortraitAppearance(uniforms, settings): void`. The existing `createLilyParticleMaterial(uniforms)` call shape stays valid. New uniforms default to a neutral appearance that preserves the current Scene 04 output. The common particle geometry supplies a neutral white source-color attribute when a caller does not provide photo color; the DEV geometry supplies sampled linear-sRGB colors.

### DEV lab (`frontend/src/particle-portrait-lab/`)

- `ParticlePortraitSettings` is a versioned JSON shape containing count, size min/max, brightness, opacity, glow, detail boost, fill density, contrast, background threshold, irregularity, photo color mix, portrait scale, x/y offsets.
- Defaults/ranges are copied from spec § «Начальные значения и границы» and clamped at the control boundary; `minSize <= maxSize` always holds.
- Sampler-only values rebuild the `BufferGeometry` on change, never from the render loop. Appearance values update material uniforms; composition values update a parent group transform. Dispose replaced geometry and material resources.
- Persist validated settings in namespaced localStorage, falling back to documented defaults/in-memory operation if storage fails. Export the versioned JSON from the same schema; clipboard rejection exposes a selectable readonly text field and never claims copy success.
- Route a source-asset failure and a WebGL failure to explicit unavailable states.

## Ownership by ticket

| Ticket | Owns | Public contract / dependency |
|---|---|---|
| 01 | `scenes/lily/starPortraitTargets.ts` and its colocated sampler test | Defines the pure sampler seam above; no production caller until 03. |
| 02 | `scenes/lily/dissolve.ts` and `dissolve.test.ts` | Adds optional shared appearance controls and neutral source-color attribute; existing callers stay visually unchanged. |
| 03 | `main.tsx`, new `particle-portrait-lab/` files and their colocated tests | Consumes 01 + 02; implements DEV route, one fixed Canvas preview, photo toggle, controls, persistence and JSON copy. |

The projects user-memory file is not changed in these tickets; durable reuse guidance is recorded after acceptance.

## Built seams returned by tickets 01 and 02

- `sampleStarPortraitTargets(source, settings): StarPortraitPoint[]` is implemented in ticket 01; source RGB is returned as `photoColorLinear` for the material's photo-color path.
- `LilyPortraitAppearanceSettings` and `updateLilyPortraitAppearance(uniforms, settings)` are implemented in ticket 02.
- The shared geometry binds `aPortraitSourceColor`; its default is neutral white. Existing Scene 04 appearance uniforms default to photo mix `0`, opacity `1`, glow `1`, point-size min/max `1/6`.
- Ticket 03 must use these seams directly. Do not add a parallel sampler/material/shader.
