# 02 — Optional portrait appearance on the shared particle material

**Requirements:** R13, R27–R30, R32–R34, R44, R53–R56, R61, R63, R13.1–R13.2, R27.1
**Blocked by:** none
**Zone:** `frontend/src/scenes/lily/dissolve.ts`, `frontend/src/scenes/lily/dissolve.test.ts`
**Wave:** 1
**Status:** done

## What must work

Extend the current point-sprite material with optional controls for source-color mixing, opacity, soft glow and min/max point size, plus a neutral source-color vertex attribute for callers that omit photo colors. Preserve `createLilyParticleMaterial(uniforms)` and all existing defaults so Scene 04 keeps its current particle look, timing, vortex, trajectories, portrait timing, and lily dissolve. Keep points discrete and the current additive core/halo style. No new renderer, postprocessing, or dependency.

Expose the appearance setter and types in `interfaces.md`; Scene 04's current callsites must not require an edit. The DEV Canvas will provide sampled photo colors and its controls through this seam.

## From the brief, verbatim

> «Используй ту же систему рендеринга частиц, материалы и свечение, что уже применяются в вихре сцены 04.»
> «Используй жемчужно-белые, мягкие розовые и слегка золотистые оттенки с возможностью частично сохранять исходные цвета фотографии.»
> «Частицы должны оставаться отдельными светящимися точками. Не превращай их в сплошное изображение при увеличении плотности или bloom.»
> «Не изменяй текущий распад лилии. Не меняй существующий вихрь, скорости и траектории частиц. Не меняй таймлайн сцены 04.»

## Spec sections

§1 and §2 (same material/glow, palette, discrete stars), §3 (appearance controls), §4–§5 (reuse and Scene 04 invariants), user stories 2/4, clarifications R13.1/R13.2/R27.1.

## Acceptance criteria

- [ ] Existing `createLilyParticleMaterial(uniforms)` users compile unchanged; neutral defaults preserve the prior shader look and current Scene 04 path.
- [ ] A focused regression test exercises default uniforms/material output expectations and proves optional values can independently update photo mix, point opacity, glow, and bounded point size.
- [ ] With DEV controls enabled, photo RGB mixes with `#FFF4E8`, `#F3CBD9`, and `#D7B77A`; additive point cores and restrained halo remain separate at the allowed 32k cap.
- [ ] Shader stays in the current shared material and fixed canvas renderer configuration; no second particle shader, postprocessing pipeline, or dependency is introduced.
- [ ] Existing vortex, lily breakup, motion constants, portrait timing and stage logic remain untouched; current targeted dissolve tests pass.

## Testing

From `frontend/`, run `npm test -- src/scenes/lily/dissolve.test.ts`. Do not run the full suite. Read `C:\Users\McHomak\.agents\skills\autopilot\prompts\executor.md` before editing.

## Must not

Do not edit `LilyDissolveParticles.tsx`, `IdentityScene.tsx`, the vortex/portrait sampler, route/UI, timeline, or particle trajectories. Do not add package dependencies.
