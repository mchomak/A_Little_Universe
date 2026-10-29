# Iris Color Grading v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live, local OKLab iris grading system to the existing Iris Visual Lab, including neutral-gray recoloring, radial zones, inspection, presets, persistence and comparison evidence.

**Architecture:** Keep the persistent R3F renderer. Put bounded config and preset migration in `config.ts`, CPU reference math and the matching shader snippet in grading modules, and update shader uniforms in the existing render loop. Keep inspection and before/after as transient UI state so saved configuration is not modified.

**Tech Stack:** Existing React, TypeScript, Three.js, React Three Fiber, Vitest and Vite; no new dependency.

**Spec:** `.autopilot/2026-10-29-iris-visual-lab--wip/spec-v2.md`

## Global Constraints

- Do not modify Python, `run_017` PNG/binary assets, camera architecture or other film scenes.
- Preserve v1/v2 saved configs, JSON import/export and user presets through schema v3 migration.
- All shader input/output math is linear-sRGB; Three.js handles final output encoding.
- Correct only iris-derived layers; keep glow/emission controls independent.
- Run commands from `frontend/`: `npm test -- <file>`, `npm run check`.

## Review Focus

- Neutral low-chroma samples at outer radii receive color only when gray recoloring is enabled.
- Amber pixels at full preservation remain unchanged, including close to the transition boundary.
- Extreme but valid hue/chroma settings remain finite and gamut mapped without RGB channel clipping.
- v1/v2 imports and old local presets survive migration without losing other configuration groups.
- Inspection and Before/After do not modify camera, selection or persisted config.

---

### Task 01: OKLab reference math and shader contract

**Files:** Create/modify `frontend/src/iris-lab/gradingMath.ts`, `frontend/src/iris-lab/gradingShader.ts`; modify `frontend/src/iris-lab/gradingMath.test.ts`.

**Interfaces:** Export `linearSrgbToOklab(rgb)`, `oklabToLinearSrgb(lab)`, `gamutMapOklab(lab)`, `oklchToOklab({l,c,h})`, `linearSrgbToOklch(rgb)`, `gradeIrisColor(rgbLinear, normalizedRadius, config)`. Export GLSL uniform and function snippets with the same field names as `IrisColorGrading`.

- [ ] First add tests for neutral recoloring, zero strength identity, amber preservation, radial zones, finite bounded gamut and color conversion round trips.
- [ ] Run the focused Vitest file and observe expected failures.
- [ ] Implement CPU reference and gamut mapping; add equivalent GLSL functions with chroma reduction at fixed hue/lightness.
- [ ] Re-run focused tests and check CPU values against shader uniforms and boundaries.

### Task 02: Schema, presets and controls

**Files:** Modify `frontend/src/iris-lab/config.ts`, `config.test.ts`, `IrisLab.tsx`, `iris-lab.css`.

**Interfaces:** Use Task 01 color conversion helpers; implement schema v3 `IrisColorGrading` per spec. Keep legacy `colorGrading` migration from schema v2 and no-grading v1. New UI transient props to viewport are `previewGrading:boolean` and `albedoOnly:boolean`.

- [ ] First add migration, preset-distinction, range-validation, picker/sliders synchronization, and transient-mode behavior tests.
- [ ] Run focused Vitest files and observe expected failures.
- [ ] Implement bounded schema, five named presets, linked color controls, Before/After, inspection toggle, reset and visible values.
- [ ] Verify localStorage and JSON workflows retain v3 color settings and saved presets.

### Task 03: WebGL integration across iris-derived layers

**Files:** Modify only `frontend/src/iris-lab/EyeViewport.tsx`.

**Interfaces:** Consume `LabConfig['colorGrading']`, Task 01 GLSL snippets and `previewGrading`/`albedoOnly`. Grade base texture before output transform, plus particles and both fiber layers before their separate emissive/tint blends. Apply inspection by omitting unrelated layers/post effects without changing config. Preserve material/geometry references as uniforms change.

- [ ] Add focused assertions for normalized pupil-to-edge radius and inspector layer/post settings where test seams allow.
- [ ] Implement shader uniforms and all four material integrations; grade only RGB sources owned by iris shaders.
- [ ] Compile shaders in browser and verify no compilation/link errors.

### Task 04: Browser evidence and final verification

**Files:** Create only requested PNG evidence under `docs/verification/iris-color-grading-v2/`; update `docs/iris-visual-lab.md`.

**Interfaces:** Use existing dev route `/dev/iris-lab`; keep camera, illumination and macro framing constant during comparison.

- [ ] Capture `original.png`, `natural_blue.png`, `full_blue_recolor.png`, `cinematic_blue.png`, `before_after.png` and a separate outer-iris macro comparison.
- [ ] Verify amber texture, limbal darkening, radial details, other eye materials, persistence after reload and distinct presets.
- [ ] Run `npm run check` and confirm production build.
