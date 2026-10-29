# Scene 04 portrait-direct handoff

This branch reshapes scene 04 from a flower dissolve into the first personal portrait in the existing film. The timing and deterministic frame values live in `frontend/src/engine/filmConfig.ts` and `frontend/src/scenes/shared/identityFrame.ts`; scene motion still follows the shared `FilmRuntime` through `useSceneAnimation`.

## Implemented sequence

| Scene time | Visual state |
|---|---|
| 0–3.5 s | The existing procedural lily fades while deterministically sampled particles move from its current sample source into a loose, bounded cloud around the future photo plane. |
| 3.5–7.5 s | The cloud gathers into the exact square photo coordinates. ASCII marks first emerge around the face and hair, then spread over the image. |
| 7.5–10.5 s | The full, stable ASCII portrait holds. The companion particles calm and fade. |
| 10.5–13.5 s | The unchanged original photograph crossfades under the ASCII glyphs. The photo reaches full opacity at 13.5 s. |
| 13.5–15 s | The existing photo frame settles in. |
| 14.25–15.75 s | After a 0.75 s viewing pause, “С этого всё началось” fades in and stays visible. |
| 15.75–21 s | The centered photograph and caption rest before the automatic gallery handoff at 21 s. |

The sampled particle field is deterministic by particle index and source pixel. Normal motion passes through source → cloud → photo-plane targets; reduced motion uses a direct restrained source-to-photo morph over the same dissolve and gather windows. Neither mode adds a spin phase. ASCII uses the exact photo crop, gives brighter subject tones denser pale glyphs, suppresses the near-white backdrop, and reveals radially from the face area. A 38% unmasked preview from the original monochrome photo anchors facial features under ASCII from 7–10.5 s and fades as the full image crossfades in. The final monochrome photograph uses the existing unaltered `frontend/src/assets/start_img.jpg` texture and `FirstMemoryCard`.

## Boundary 03 → 04

Today, BloomScene owns the existing procedural placeholder lily and the one deliberate touch gate. Once its 22-second playback completes, the film reducer enters scene 04 automatically in `playing` mode. IdentityScene renders the same existing `Lily` component as a placeholder, then fades it while consuming `LilyParticleSource.sample(index, count)` scene-local positions. This is a continuous visual placeholder sequence, not a shared GLB object: SceneDirector unmounts one scene and mounts another, and no model or surface samples currently cross that boundary.

The preserved `LilyParticleSource` shape is an injection contract, not an integrated GLB adapter: the optional `IdentityScene` prop is `particleSource?: LilyParticleSource`, with `sample(index: number, count: number): [number, number, number]`. Each sample is an identity-scene root coordinate in film world units, matching the current mock point space; a future GLB source must apply the model's world transform before returning it. `createIdentityParticleData` queries the source once while building typed arrays and copies the returned positions into the owned `BufferGeometry`. The source owns no GPU buffers or per-frame state; IdentityScene disposes its geometry on cleanup. SceneDirector currently supplies the deterministic mock by default because scene 03 does not yet publish GLB samples. No GLB object transfer, alpha dissolve, or surface sampling adapter is integrated.

For final integration, scene 03 remains owner of the open GLB through the handoff. Prepare/cache stable surface samples for exposed petals first and remaining flower parts next, inject them through this prop, then fade the same scene-03 mesh while particles leave its surface, holding its silhouette briefly. No actual GLB sampling, mesh alpha, or live object transfer is included here.

CameraDirector retains camera ownership. Scene 03 finishes on its `flowerTop` pose (`position [1.7, 4.5, 4]`, target `[0, 0.2, 0]`); scene 04 starts from that same pose and settles to the director's front pose over 3.5 s (`position [0, 0, 5.6]`, target `[0, 0, 0]`). The same-pose boundary avoids a designed camera jump while preserving the established camera director seam. The final model's exact anchor and camera still need integration with the parallel scene-03 work.

## Boundary 04 → 05

At 21 s the identity frame resolves to the gallery's first-card pose: the unmodified `start_img.jpg` photo and its existing frame are fully opaque; card parent position is `[0, 0.08, 0]`, scale `1`, rotation `0`; photo plane is `2.15 × 2.15`, with the `2.23 × 2.23` frame behind it. CameraDirector is at `[0, 0, 5.6]`, looking at `[0, 0, 0]`. GalleryScene places its first card at the same world location and uses the same FirstMemoryCard and image asset. It starts at index zero in viewer-driven `exploring` mode, with no new interaction gate.

The texture file was not modified. SHA-256 for `frontend/src/assets/start_img.jpg` and `images/start_img.jpg` is `BEFAD4FD1F270558EEAB25113BB169ED25479CE7B7CB3DB7812FDCE29124D899`; a regression test checks both copies. SceneDirector remounts the card at the scene boundary, so this is a matched visual handoff, not a claim that the same Three.js object survives. GalleryScene itself was intentionally left unchanged.

## Verification and limits

The root-run `npm run check` passed lint, TypeScript, 118 tests in 30 files, and production build. The existing Three.js CommonJS deprecation warning and Vite chunk-size advisory above 500 kB remain. Runtime tests cover pause, seek, restart, disposal, and re-entry.

Browser verification used 1024×768 and 768×1024 viewports at low quality with reduced motion. At 13.5 s the photo is fully visible; caption opacity is 0 at 14 s and 1 at 17 s. Automatic entry into the gallery retains the single canvas. Pixel comparison of ROI `[321,137,702,518]` between scene 04 at 21 s and scene 05 entry has max/mean delta 0. Reverse seek from 13.5 s to 8 s and restart at 8 s also match in ROI `[280,80,760,600]` with delta 0. Screenshots are under `docs/verification/scene04-portrait-direct/after/`. The prompt's named 46–58 screenshots were not attached; physical iPad/Safari behavior and performance remain unverified.

## Branch and manual integration

Worktree: `C:/Users/McHomak/Projects/A_Little_Universe_scene04_direct`
Branch: `codex/scene04-portrait-direct`
Base commit: `01c4d925e1a493d50120405e3cabe87c65187997`
Source implementation commit: `19edf41a32ae100f7fcad99ac889ae323c287240`
Documentation follow-up commit: supplied separately by the coordinator.

This branch is not merged. Future manual integration should compare the scene-03 branch at the same files first. Likely shared conflicts are `frontend/src/engine/filmConfig.ts`, `frontend/src/engine/CameraDirector.tsx`, `frontend/src/scenes/IdentityScene.tsx`, and `frontend/src/scenes/shared/identityParticles.ts`, plus the additive `.gitignore` and this documentation. Keep the new 21-second identity timing, retain scene 03's flower touch gate, and route the final camera/mesh pose through CameraDirector and the source adapter rather than adding another renderer or animation clock.
