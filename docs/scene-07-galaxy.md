# Scene 07 — Galaxy

`GalaxyExperience` is mounted by `SceneDirector` outside the keyed active-scene subtree. It builds a deterministic seeded GPU star disk, bright stars, a distant star field, a luminous core, procedural disk and background gas, and layered reveal fog. Scene 08 and Scene 09 keep the same component, geometry, and materials alive; no second galaxy is created. Navigation markers, research-map UI, and the source project's exploration systems are not included.

This is an independent implementation of broad procedural-galaxy concepts. The supplied reference repository has no license file, so no implementation source or shader text was copied. Palette names and colors are original interpretations.

## Rendering and motion

Star points use custom shaders for differential rotation, radial reveal, size, twinkle, and sparse seed-driven warm and cool color accents. Separate gas shaders use layered procedural noise and spiral modulation; the existing arm-width setting also widens the gas arm signal. The Vasilisa Cinematic defaults use a larger pearly gold core with a soft halo, more visible violet arms, and brighter colored stars while retaining the dark gaps between arms. The core has a radial alpha falloff, and reveal fog uses feathered world-space shader planes with slight depth parallax. The feature uses the existing R3F renderer and output color-space conversion; it adds no compositor or bloom pass. The gas and fog are not volumetric ray-marched effects.

All animation is derived from the shared FilmRuntime. Stars and disk gas receive the same `motionTime`, `rotationSpeed`, radial differential, and rotation direction, keeping their spiral structure aligned. `nebulaSpeed` changes only the gas's internal noise motion. A continuous phase accumulator carries galaxy rotation across Scenes 07, 08, and 09. Scene 09 ambient motion follows shared `presentationTime` while canonical film time remains ended; pause and document visibility still control the shared clock. There is no independent animation loop.

Reveal, fog dissipation, lighting, and camera movement are deterministic functions of scene time. Distant stars appear first, then the disk becomes visible from its center; foreground reveal fog thins independently from the gas that remains in the galaxy. Scene 08 and 09 keep the galaxy subdued behind the greeting and closing.

`CameraDirector` owns the shared camera. Scene 07 can start from its own cosmic pose or continue from the current Scene 06 eye pose. Its configured final angle defaults to `0.785` radians, approximately 45° above the disk. The camera pulls back toward this three-quarter view through the existing camera director and shared clock.

## Scene Inspector and configuration

Select Scene 07 (`cosmos`) in DEV Scene Editor. Scene Composer schema v4 stores the galaxy configuration; `normalizeConfig` accepts schemas v1–v4. Geometry controls are debounced by 280 ms and rebuild seeded buffers: seed, star count, arm count, radius, spin, arm width, scatter, core size/density, thickness, distribution, bright stars, background-star count/depth, and quality. Rebuilt geometry is disposed. Arm width also updates the live gas-arm shader. Color, brightness, twinkle, gas/fog, motion, reveal, camera, and composition controls update live through uniforms or the shared camera.

Schema-v3 galaxy `spin` values represented turns. During migration to schema v4, those values are converted to radians (`turns × 2π`); schema-v4 values are already radians. The v4 default spin is `4.6` radians. Do not reinterpret current v4 settings as turns.

`Low`, `Standard`, and `High` scale point count; global project quality applies an additional count reduction, while DPR remains owned by FilmCanvas. Choose `Vasilisa`, `Spore`, `Ember`, `Emerald`, `Ice`, `Rose`, or `Custom`; editing a palette color selects `Custom`. `Vasilisa Cinematic` is included in the shared presets. Standard Scene Composer JSON import/export applies, and normalized `scenes.galaxy` values can be moved into `/scene-composer.json`.

## Verification and limits

On 2026-10-30, `npm run check` passed with 239 tests in 59 files, ESLint, strict TypeScript, and production build. The Scene 07 regression tests cover schema-v3 spin migration, deterministic geometry and inner-core distribution, 45° camera pose, reveal and animation, shader edge fades, gas arm width, seed-driven star color accents, gas/star shared phase and rotation direction, and shared runtime timing.

The final desktop browser/WebGL check rendered without shader compilation errors, and playback advanced the shared shader motion phase. The render remains visibly different from the supplied screenshot, so visual parity is not established. Physical iPad/Safari rendering, thermal behavior, GPU variation, and frame rate have not been measured; 60 FPS on the target device is not established. The star distribution is a deterministic Gaussian-scattered arm model rather than the reference's exact mathematics. Gas uses procedural noise and spiral modulation, while fog uses layered shader planes rather than volumetric simulation.
