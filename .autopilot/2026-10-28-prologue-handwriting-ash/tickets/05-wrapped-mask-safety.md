# 05 ? Wrapped-text mask and low-count particle safety

**Requirements:** R15, R19, R28, R30  
**Blocked by:** 03, 04  
**Zone:** `frontend/src/scenes/PrologueScene.tsx`, `frontend/src/scenes/prologue/particleMath.ts`, related tests, `docs/architecture.md`, `docs/verification.md`  
**Wave:** 4  
**Status:** ready

## Verbatim brief quotes

> «из реальных непрозрачных пикселей шрифта Marck Script.»
> «Сохранение читаемости оставшегося текста: частицы не должны его перекрывать.»
> «Адаптацию под quality»
> «mobile»


## Acceptance criteria

- [ ] The particle alpha mask follows every line as the DOM actually wraps it at portrait/mobile widths; particle origins align with all visible glyphs, not a single unwrapped `fillText` line.
- [ ] When sampling or device-quality adaptation yields fewer than four particles (including zero), the scene either skips the Points object or supplies a valid `position` attribute; it never constructs invalid geometry.
- [ ] Focused tests cover multiline mask coordinates and 0?3 particle counts through public deterministic seams; `npm run check` passes.
- [ ] `docs/architecture.md` distinguishes the temporary offscreen mask Canvas2D (released immediately after pixel readback) from the Points geometry/material (released at scene/config cleanup). `docs/verification.md` removes the wrapped-text mismatch caveat once corrected and retains the physical tablet/Safari limitation.
- [ ] The single persistent WebGL canvas, shared film time, 21-second timeline, gates, consent, offline cache and other scenes remain unchanged.

## Test command

From `frontend/`: `npm run check`. A single test file uses `npm test -- <path>`.
