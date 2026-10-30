# Scene 07 — Galaxy

`GalaxyExperience` is mounted by `SceneDirector` outside the keyed active-scene subtree. It owns one seeded GPU star disk, a separate bright-star layer, a spherical distant-star field, textured background cloud sprites, the persistent procedural disk nebula, optional reveal fog, and an optional simple black center. Scenes 08 and 09 keep the same component, geometry, and materials alive. No navigation markers, research-map UI, system objects, or source-project application UI are included.

## Source and adaptation

The procedural implementation is adapted from `syakubson/procedural-galaxy`, source commit `03cbf44dca9b0e8b864d0f11ff613f72689f7c0d` (the local reference under `_reference_sources/procedural-galaxy`). The repository contains no `LICENSE` file. The user requested direct adaptation, but that request does not establish permission from the rights holder; the reuse status has not been independently verified.

Visual modules and algorithms carried across:

- `src/galaxy.js`: deterministic arm-indexed radius distribution, radial spin, power-compressed arm scatter, flattened Gaussian bulge, per-star color knots and size variation.
- `src/rng.js`: string seed hash, Mulberry32, and cached Box–Muller Gaussian sampler.
- `src/shaders/starShader.js` and `src/shaders/sunShader.js`: rigid GPU rotation, perspective point sizing, star halo/core, twinkle, and pulsing colored suns.
- `src/background.js` and `src/shaders/nebulaShader.js`: spherical background stars, noise-driven radial gas color, three-octave FBM, arm ridges, and a shared gas/star rotation phase.
- `src/nebulaClouds.js`: three feathered procedural Canvas textures and a small shell of additive cloud sprites.
- `src/palettes.js`: original Spore (R/B/Y/V), Ember, Emerald, Ice, and Rose color values and gas gradients.

The galaxy and bright-star shaders were rotated from the source XZ disk to this scene's XY disk; the source formulas and deterministic seed streams are otherwise retained. The source's differential-rotation uniform is intentionally not used: rigid rotation keeps arms intact, and both stars and the gas ridge consume the same canonical motion phase. Its reverse-edge `smoothstep` halo expressions were rewritten with mathematically equivalent ascending edges for GLSL portability. `main.js`, the original renderer, `postfx.js`, GUI, OrbitControls, skybox image fetch, system exploration, markers, codex, and the black-hole lensing/accretion subsystem were not ported.

## Rendering and motion

The scene uses the existing FilmCanvas WebGL2 renderer and its DPR settings. It adds no renderer, requestAnimationFrame loop, compositor, bloom pass, or global renderer state. The source accumulates in a HalfFloat EffectComposer before ACES and sRGB output. This application has no matching HDR compositor, so galaxy shaders apply a local ACES filmic shoulder and the renderer's output-color-space transform per emissive draw. A soft radial core glow approximates the source's broad accumulated light; this local LDR treatment is not numerically identical to the source HDR pipeline, and brightest overlaps can differ. A browser comparison was performed at 1366×768 in Scene 07 around 15–16 seconds; the adapted composition is visually closer to the source, but exact screenshot parity is not claimed.

Star and sun rotation, twinkle, Reveal, gas noise, gas-arm phase, fog, lighting, and camera poses are all functions of the shared FilmRuntime time. There are no independent wall-clock timers for appearance or motion. The gas arm ridge is transformed with the same rigid angular phase as the star points; its speed control affects only internal noise. The shared phase continues across Scenes 07–09, and the Scene 09 ambient frame reads `presentationTime` through the existing shared runtime.

Reveal fog is separate from the permanent galaxy gas disk. The front fog uses layered soft procedural planes at different depths and dissipates from the scene timeline. The disk gas remains circular, noise-driven, and arm-shaped after the reveal. The user-requested black center is a small, plain disk drawn over the luminous core and star points, enabled by default and in the Vasilisa Cinematic preset; it can be disabled in the Inspector. It does not add a black-hole simulation or interaction.

`CameraDirector` owns camera motion. The settled camera angle defaults to `0.785` radians, approximately 45° above the disk. The Scene 07 camera can start independently of Scene 06 and then eases toward the final oblique view.

## Scene Inspector and configuration

Select `cosmos` in the DEV Scene Editor to open **Scene 07 — Galaxy**. Schema v5 accepts schema versions 1–5. Geometry rebuilds are debounced by 280 ms and dispose the previous geometries. Rebuild inputs include string seed, star count, arm count, radius, winding, arm width, randomness, randomness power, bulge size/density, thickness, distribution, bright-star count, background-star count/depth, and quality. The selected palette and custom colors update the disk's color buffer in place without regenerating positions. Other shader controls remain live uniforms; the shared camera controls stay in `CameraDirector`.

Schema v3 `spin` values were turns and still migrate to radians (`turns × 2π`). Schema v4 values already use radians; its world-unit arm width, scatter, core size, density, and thickness are converted to the normalized v5 parameter units. Numeric legacy seeds become strings. Imported v1–v4 documents without an explicit black-center flag keep the old center-free look; new defaults and the Vasilisa Cinematic preset enable the black disk.

The default geometry follows the supplied Spore values: seed `andromeda`, 32,000 Standard stars, five arms, spin 4.6 radians, width 0.16, randomness 0.065 with power 3.6, core size 0.24 of radius, core density 0.2, and thickness 0.05 of radius. The 175 bright stars, 45° camera endpoint, and gas palette are also derived from the reference setup. The distant field defaults to 5,200 mostly pale points in Standard to compensate for this app's narrower 38° vertical FOV than the source's 58° camera. It scales at 0.42 / 1 / 1.35 for Low / Standard / High and follows the shared Low quality multiplier; count, brightness, size, and depth remain independent Inspector controls. DPR remains controlled by FilmCanvas. JSON import/export is the existing Scene Composer flow, and normalized `scenes.galaxy` settings can be used in the production startup config.

Palettes preserve the source's preset colors and gas gradients. Custom colors are offered for core, inner disk, outer arms, gas, bright-star tint, and background. The custom gas edge is derived from the selected gas color; the source's three-part gas gradient is not represented as three separate custom color controls.

## Verification and limits

On 2026-10-30, `npm run check` passed: ESLint, strict TypeScript, 246 tests in 60 files, and the production build. Tests cover schema migration, Inspector controls, palette updates without geometry rebuild, deterministic generation, projected background-star density and quality scaling, fog controls, twinkle and nebula uniforms, StrictMode cloud disposal, rigid rotation and shared phase, shader edge/noise behavior, and the camera-facing black-center policy. The browser check at 1366×768 and Scene 07 time 15–16 seconds reported zero WebGL console errors. During playback shader `uTime` advanced from 15.201 to 16.595; after pausing it remained at 16.595.

The algorithms and palette values are directly adapted from the cited repository. The repository has no license file, and rights-holder permission has not been verified. The desktop comparison does not establish exact visual identity. The target renderer's LDR blending differs from the source HDR+ACES pipeline. Physical horizontal iPad/Safari performance, thermal behavior, GPU variation, and frame rate have not been measured; 60 FPS on the target device is not established.
