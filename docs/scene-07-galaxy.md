# Scene 07 — Galaxy

Scene 07's `GalaxyExperience` is mounted by `SceneDirector` outside the keyed active scene. It creates one deterministic seeded star disk, a sparse bright-star set, a deep background-star set, a noisy gas layer in the disk, separate far-background gas, a luminous core and up to eight noisy reveal-fog planes. Scene 08 and Scene 09 keep that same component, geometry and materials alive. The bouquet and exploration map are not part of this scene.

The point vertex shader handles differential rotation, radial reveal, point size and twinkle. The fragment shaders create soft star cores and uneven noise-based gas and fog edges. Galaxy visibility, fog dissipation, light levels and camera targets are functions of scene-local FilmRuntime time; rewinding restores the same frame. The shader path works through the existing R3F renderer and output color-space conversion; this feature adds no compositor or bloom pass.

`CameraDirector` starts the scene on a close standalone cosmic frame. If Scene 06's eye is present, it keeps that current camera pose as the opening and continues the pullback. It eases toward the configured three-quarter view using only the existing shared camera and clock. Scene 07 starts distant stars first; the main disk expands from its dense center, while fog in front of the galaxy thins separately from the gas that remains in the disk and background. Scene 08 and Scene 09 retain the same art, with light and motion reduced for the greeting and closing.

## Scene Inspector

Select Scene 07 (`cosmos`) in DEV Scene Editor. Its `Galaxy Geometry` fields are debounced by 280 ms: seed, star count, arm count, radius, spin, arm width, scatter, core size/density, thickness, distribution, bright stars, background star count/depth and quality. Geometry is disposed when rebuilt. Live fields drive shader uniforms: star size/brightness/twinkle, background stars, both gas layers, Reveal Fog, colors, exposure, core glow, rotation, reveal timing and camera composition. `Low`, `Standard` and `High` scale point count; the project-wide quality setting applies another count reduction. DPR remains owned by FilmCanvas.

Choose one of the independent `Vasilisa`, `Spore`, `Ember`, `Emerald`, `Ice` or `Rose` color interpretations, or `Custom`. Editing a color automatically selects `Custom`. The `Vasilisa Cinematic` preset is available in the Scene Composer's shared presets. JSON uses the regular Scene Composer import/export flow, and the normalized `scenes.galaxy` fields are production-ready in `/scene-composer.json`.

Scene 09 remains in the film's `ended` state. The shared FilmClock advances only `runtime.presentationTime` for this ambient hold, so shader motion can continue while canonical film time remains stopped. Pause and document visibility pause this same clock. There is no separate RAF loop. Scene 09 has no authored seek duration; ordinary Timeline seek is available in Scene 07 and Scene 08.

## Source and limits

The supplied public reference repository contains no license file. No implementation code or shader text was copied. The scene independently implements the broad ideas of a seeded spiral, GPU point motion, procedural gas, background stars and cinematic fog. Its palette names and colors are original interpretations, not a claim to reproduce the reference's exact palette values. A side-by-side visual comparison to the original demo and performance measurement on an iPad remain outstanding; do not infer a 60 FPS target result from desktop tests.

The star distribution is a deterministic Gaussian-scattered arm model rather than the source's exact mathematics. Gas uses layered procedural noise and spiral modulation, not volumetric ray marching. Fog is several world-space shader planes with slight depth parallax, not volumetric simulation. These choices avoid transferring unlicensed code while keeping shader cost bounded on WebGL2.

Verification includes deterministic geometry and animation/camera tests plus the regular frontend typecheck, lint, full suite and production build. Physical iPad/Safari behavior, thermal performance and GPU variation remain unverified.
