# 04.3 — particle name

Scope: Storyboard v2.0, scene 04 at 8–13 seconds; visual reference
`key_frames/S04_F03_VasilisaName.png`. The lettering remains «ВАСИЛИСА».

## Choreography

- Before/at 8s, retain the existing vortex, its particle identities and legacy
  name targets. `aNameFace` supplies a separate, contour-weighted target for 04.3.
- Three streams have independent delays (0–0.38s) and 0.68–0.96s flights.
  Analytic easing, curved approaches and a small damped overshoot use absolute
  film time; they do not depend on previous frames or simulation history.
- The name reaches its final composition by 9.4s and holds until 13s (3.6s).
  One restrained highlight travels left to right during 9.4–10.9s.
- 40% of the name samples emphasize contours; the rest fill the letter faces.
  Depth is at most ±0.128 world units during the hold. Approximately 2.2% of
  points carry larger halos and fine rays. Background dust is reduced to 22%
  brightness and its motion/twinkle slows during the hold.
- The former blue guide particle and its local halo have been removed from the
  film. Reduced motion still removes flight arcs, overshoot and the moving
  highlight.
- The existing viewport fit keeps the complete name on one line in both tablet
  orientations. Name point sizes account for renderer DPR and the lower particle
  budget. The main particle counts remain 16,000 / 7,000.
- Name styling fades into the existing 04.4 morph over 13–17s. Subsequent portrait,
  photograph, gallery timings and targets remain unchanged. No renderer, global
  clock, camera director, dependency or production debug control was added.

## Verification — 2026-10-28

- `cd frontend; npm run check`: ESLint, 110 tests in 28 files, strict TypeScript
  and production build passed. Existing Three.js CommonJS deprecation and large
  application chunk warnings remain.
- Tests cover stream staggering, bounded overshoot, settling/hold and one-way
  highlight timing. A shared-clock test seeks forward and backward across the
  name and its neighboring shot boundaries.
- Headless Chromium against the running Vite server: inspected 7.9, 8, 8.4, 8.8,
  9.4, 10.2, 12.8, 13 and 17s at 1366×1024; portrait at 834×1194; low quality
  and reduced motion. No JavaScript/WebGL console errors occurred.
- Returning to 10.2s through backward/forward seek, and restarting then seeking
  to 10.2s, produced identical scene pixels. Debug controls/footer were hidden
  for comparison to exclude hover/focus decoration.
- Real-time playback from 7.8s continued through 13.2s, then paused successfully.
- Physical iPad/Safari performance and appearance still require device review.

## Visual acceptance

1. Play 7.5–9.4s: the existing spiral flows into several delayed streams without
   a position jump at 8s. Particles decelerate, slightly overshoot, then settle.
2. Inspect 9.4–13s: all eight letters read clearly; counters stay open; depth and
   bright accents do not blur the silhouette. Background activity remains quieter
   than the name. The whole word fits landscape and portrait tablet screens.
3. Play 9.4–10.9s: exactly one gentle light wave crosses from «В» to the last «А».
   It does not repeat during the remaining hold.
4. Confirm that no separate blue guide dot or halo appears around the lettering.
5. Seek 12.8 → 8.4 → 10.2, pause/resume, restart and repeat; the same time must
   reproduce the same composition and highlight phase.
6. Cross 13s into the existing symbol morph and inspect 17s: no flash, abrupt
   rescaling, surviving name halo or change in the portrait timing.
