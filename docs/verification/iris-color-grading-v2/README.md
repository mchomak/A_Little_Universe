# Iris Color Grading v2 visual verification

Captured from the running local Iris Visual Lab at 1365x768 in a foreground Chrome tab. The color-comparison views use the same Macro Iris camera (distance 1.55, FOV 38) and Color Inspection / Albedo Only mode, so the iris texture is shown without lighting, bloom, particles, fibers, or cornea reflections.

- `original.png`, `natural_blue.png`, `full_blue_recolor.png`, and `cinematic_blue.png`: the four requested palette states.
- `before_after.png`: Original and Vasilisa Natural Blue side by side at the same camera.
- `macro_outer_comparison.png`: Before and Full Blue Recolor after at distance 1.3, focused on the outer iris.
- `natural_blue_full_eye.png` and `cinematic_blue_full_eye.png`: full rendering with lighting, particles, fibers, and cornea layers enabled.

The source texture and run_017 binary were not edited. These are browser screenshots of the WebGL preview only.
