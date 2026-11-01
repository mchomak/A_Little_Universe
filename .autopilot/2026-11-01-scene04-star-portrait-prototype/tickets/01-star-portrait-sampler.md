# 01 — Deterministic feature-aware portrait sampler

**Requirements:** R17–R26, R45–R47, R50–R51, R59–R60, R21.1, R22.1
**Blocked by:** none
**Zone:** `frontend/src/scenes/lily/starPortraitTargets.ts` and its colocated test only
**Wave:** 1
**Status:** done

## What must work

Build the reusable pure sampler from the original photo and matte. Return a stable set of normalized coordinates, tone, local contrast/feature weight, deterministic seed, and source RGB in linear sRGB. Preserve internal tonal fill while allocating more samples to high-detail areas and the subject matte boundary. Dark in-subject hair/shadows must retain samples; flat areas should be sparse. Do not create a regular visible dot matrix. Stay dependency-free and bounded for a 32k iPad preview.

Keep this algorithm separate from `portraitTargets.ts`: do not alter the existing Scene 04 target-selection logic.

## From the brief, verbatim

> «Нужен не pixel-art и не прямоугольная матрица точек, а feature-aware luminous particle portrait»
> «Повышай плотность частиц на важных деталях: глаза, нос, губы, контур лица, волосы, руки и другие видимые особенности фотографии.»
> «Сохраняй внутреннюю детализацию и полутона лица. Не ограничивай портрет только светящимися контурами»
> «Генерируй позиции детерминированно: при одинаковых настройках портрет должен выглядеть одинаково.»

## Spec sections

§2 (portrait distribution and color inputs), §4 (sampler seam/performance), user stories 2 and 4, G2 clarifications R21.1/R22.1.

## Acceptance criteria

- [ ] `sampleStarPortraitTargets(source, settings)` matches `interfaces.md`, validates dimensions/buffers, caps count, and returns finite in-bounds UV/tone/weight/color fields.
- [ ] Equal photo, matte, settings and seed produce byte-for-byte equal point results; different seed changes sampling without introducing a visible rectangular lattice.
- [ ] Matte/background threshold excludes unwanted source background; interior subject midtones and dark hair/shadow areas still produce points; high-detail/matte-edge regions outsample and out-rank flat regions.
- [ ] A small deterministic fixture tests the above behaviors and the route can later reuse the returned UV/color data without importing Three.js or camera/vortex code.
- [ ] No file in the existing Scene 04 animation/target path is edited.

## Testing

From `frontend/`, run `npm test -- src/scenes/lily/starPortraitTargets.test.ts` (or the exact focused runner syntax if repository scripts require it). Do not run a full suite. Read `C:\Users\McHomak\.agents\skills\autopilot\prompts\executor.md` before editing.

## Must not

Do not edit shared shader, UI, `portraitTargets.ts`, vortex motion, the lily dissolve, camera, or timeline. Do not add packages or ML.
