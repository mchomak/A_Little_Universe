# Specification: scene 04 Review B

- Branch from current origin/main in a separate worktree; use the two supplied screenshots, remarks and DEV configurations.
- Extend the existing camera pullback smoothly without FOV or scale jumps to roughly two thirds of viewport height, preserving angle and facial readability.
- Shorten the pause after recognizable particle portrait settles and modestly lengthen photo reveal. Retain the existing face-to-edges reveal mask and gradual particle fade, and align all intervals to the full timeline without stalls or premature scene completion.
- Towards the end of reveal, form a thin gallery-consistent frame around the visible photograph over about three seconds, without replacing it or obscuring its contents: glowing points appear on its contour and gather into a line. Avoid excessive bloom and reuse existing systems/materials when possible. Preserve a stable final image and frame suitable for a subsequent gallery transition.
- Preserve lily geometry and animation, existing dissolve, vortex, portrait formation and photo reveal algorithms. Keep gallery navigation and positions unchanged; full 04→05 transition is outside scope. Do not mechanically shorten the overall scene.
- Verify particle portrait, camera pullback, photo reveal, then frame formation in sequence; verify scrubbing at both reported intervals, replay and npm run check. Report timing, portrait size and both remarks.
- Commit and push codex/review-scene04 without merging main; serve the site locally on a separate port and provide link. Set corrected DEV remarks ready_for_review, not done.

One worker owns scene 04 and tests; existing shared canvas, camera, timing and resource lifetimes remain authoritative. Deterministic seeking and replay are required.