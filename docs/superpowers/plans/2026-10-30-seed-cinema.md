# Scene 02 seed cinema implementation plan

> Execute inline with superpowers:executing-plans; review the complete change after verification.

**Goal:** Give the forming seed visible mass, an accelerating fall with delayed camera pursuit, a gold-ring impact with brief sparks and a persistent mound, then moonlight beginning 0.5 seconds after impact.

**Architecture:** Keep the persistent Canvas and canonical FilmRuntime. Pure sampled poses own timing and camera choreography; scene-local shaders/geometry own seed, particles and light. No dependencies or runtime reference images.

**Spec:** User brief of 2026-10-30 and supplied three references; storyboard scene 02. Work directly on main and commit/push as requested. Preserve the placeholder flower and 23-second scene.

- [x] Extend seed procedure tests for accelerating descent, larger seed, delayed camera, pre-impact rings, seed dissolution, spark lifetime, mound and delayed moonlight; observe failure.
- [x] Implement sampled poses and camera ownership; add procedural seed shell, orbital particles, trail, ground rings, impact sparks, mound and bounded moonlight shaders. Keep low-quality and reduced-motion paths and resource disposal.
- [x] Verify desktop/tablet landscape and portrait renders, replay/backward seek/pause, quality and reduced motion. Run frontend check and inspect console; review diff and update scene documentation.
- [ ] Commit the scoped change on main, push origin main and verify remote commit.

Review focus: no camera jump at scene 01/02 or 02/03; no growth before impact/light; floor rings use a world horizontal plane; no accumulated particles on backward seek; resize and paused quality edits preserve pose.

Verification: 200 tests / 52 files, lint, strict TypeScript and production build pass. Chrome landscape/portrait, live playback, seek, quality and reduced motion checked. Final independent reviewer found the reduced-motion 02→03 camera discontinuity; reproduced with a failing assertion, fixed and verified. Mechanical design detector reports no findings. No new dependencies. Physical iPad/Safari performance remains unverified.
