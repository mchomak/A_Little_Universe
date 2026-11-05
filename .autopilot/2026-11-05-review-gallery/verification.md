# Verification

- npm run check: lint, 134 test files / 768 tests, typecheck, production build passed.
- Arch uses actual column placements, calibrated to Z=-82 in default configuration.
- Collages: 5 s assembly, 2.5 s reveal, 0.14 s slot stagger; final slot completes at 7.78 s.
- Projection and GLB column raycast tests cover two/three extras and landscape/portrait viewports.
- Manual MacBook rendering and GPU profiling were unavailable; review notes remain ready_for_review.
- Review source: codex-review_2, IDs 6c640464 and 32a4096c.

- Follow-up layout: B collage slots 2/3 sit left/right; slot 4 remains above. Configured size and 0.3 m gap are unchanged.
- npm run build passed (includes app and node typecheck); Vitest was not run for this adjustment.
- Particle portrait: local Memory Signal sampling of each focused original, up to 90,000 points from a raster capped at 300 px per edge; 5 s assembly, 3.5 s animated particle hold, and 2.5 s progressive original-photo reveal.
- Follow-up `npm run build` passed; tests were not run. User visually confirmed the result. Automated browser preview reported WebGL2 unavailable in its environment.
