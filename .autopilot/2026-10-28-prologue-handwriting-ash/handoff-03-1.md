HANDOFF ? ticket 03, first repair context

???????: Initial GPU ash implementation returned DONE; the baseline full check passed with 95 tests before repair.
?????: `frontend/src/scenes/PrologueScene.tsx`, `frontend/src/scenes/prologue/particleMath.ts`, `frontend/src/scenes/prologue/particleMath.test.ts`, `frontend/src/systems/scene-config/config.ts`, `config.test.ts`.
???????: Keep `particleDuration` as the existing 4s travel window; `particleFadeDuration` is the separate 2.4s gradual fade. Preserve the 21s scene gate.
??????: The shader originally used `uFadeDuration` as the alive cutoff, killing particles after 2.4s (60% of travel); do not reuse fade duration as the travel/lifetime cutoff.
??????: Inspect current T03 files for any partial repair, make the shader allow the full 4s travel and apply the 2.4s fade independently, with any global fade needed to reach zero by the 21s gate.

Blocking review condition: Manifest+Spec found that the shader caps particle life at `uFadeDuration` 2.4s, so particles fade out at 60% of the 4s travel window. Correct the behavior and rerun focused tests plus `npm run check` from `frontend/`.
The prior repair executor hit its usage limit before returning a verified contract; the working tree may contain partial repair edits. Re-evaluate the implementation and report the final file/test contract.
