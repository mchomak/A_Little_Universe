# Selective integration audit

## Baselines

- origin/main: 6748e24c096720dd7f961200b436eefcd38642b1
- local main (preservation baseline): d631793166e150c19730fafba497387b97f499d2, 68 commits ahead of origin/main, ancestor chain preserved by fast-forward
- codex/review-scene02: febf5faded5dc067c86d0361ab799389ba57f118; merge-base with local main: 6748e24c096720dd7f961200b436eefcd38642b1
- codex/review-scene04: 8159cfcec84ba2c99de9c0fab9d2a66ecba381f1; merge-base with local main: 6748e24c096720dd7f961200b436eefcd38642b1
- codex/review-gallery: e42b67654e78ec6941bbbbd9fbcf538c5ee0567d; merge-base with local main: d631793166e150c19730fafba497387b97f499d2

Review A/B/C were untracked in the original worktree, not tracked in main. Source worktrees were clean, with active local dev servers; no source worktree was modified. Scene02 source review commits a0f6b75 and febf5fa change background, clouds and light, not seed formation/fall/impact; excluded under the narrower request. Earlier source history includes stale unrelated revisions. Scene04 source commits 66dc587 and 8159cfc contain obsolete fixed-timeline reveal; adapted camera, current arrival-driven reveal and frame only. Gallery source review commits a48a28a, e40a6d1 and 01abc5d were adapted on the newer local baseline, retaining photos, ordering and saved settings.

## Checks

- Base local main: npm run check, 751 tests, lint, typecheck and production build passed.
- Integration: npm run check, 776 tests, lint, typecheck and production build passed. Gallery targeted suite 112 tests passed; portrait targeted suite 18 tests passed before final frame change, and frame fix tests passed separately.
- Production HTTP 200: entry, start_img, lily GLB, approved portrait binary, arch GLB, column GLB, phone background.
- Browser: ordinary production playback progressed through growth, lily dissolution, portrait/photo/frame to gallery without console errors; DEV scene02 impact seek, gallery focus, three extra images, particles and repeat focus checked; portrait end and DEV seeking checked. These checks ran on Windows browser, not target MacBook M2. A two-extra-photo collage was covered by layout tests, not separately inspected visually.
- User source worktree retains its original uncommitted files. Scene02 had no in-scope hunk and therefore no artificial commit.

## Code changes against local main

M	frontend/src/debug/DeveloperPanel.test.ts
M	frontend/src/debug/DeveloperPanel.tsx
M	frontend/src/debug/composerControls.test.ts
M	frontend/src/debug/composerControls.ts
M	frontend/src/debug/scenePresetModel.test.ts
M	frontend/src/engine/CameraDirector.tsx
M	frontend/src/engine/galleryCameraPose.test.ts
M	frontend/src/engine/galleryCameraPose.ts
M	frontend/src/engine/identityCamera.test.ts
M	frontend/src/engine/identityCamera.ts
M	frontend/src/scenes/GalleryScene.tsx
M	frontend/src/scenes/gallery/GalleryArch.tsx
A	frontend/src/scenes/gallery/archPlacement.test.ts
A	frontend/src/scenes/gallery/archPlacement.ts
M	frontend/src/scenes/gallery/camera.test.ts
M	frontend/src/scenes/gallery/camera.ts
M	frontend/src/scenes/gallery/collage.test.ts
M	frontend/src/scenes/gallery/collage.ts
M	frontend/src/scenes/gallery/columnModel.test.ts
M	frontend/src/scenes/gallery/frameParticles.ts
A	frontend/src/scenes/gallery/galleryCameraFit.test.ts
A	frontend/src/scenes/gallery/galleryCameraFit.ts
M	frontend/src/scenes/gallery/visibility.test.ts
M	frontend/src/scenes/gallery/visibility.ts
M	frontend/src/scenes/lily/LilyPortraitPhotoReveal.tsx
A	frontend/src/scenes/lily/portraitFrame.test.ts
A	frontend/src/scenes/lily/portraitFrame.ts
M	frontend/src/scenes/lily/portraitIntegration.test.ts
M	frontend/src/scenes/lily/portraitIntegration.ts
M	frontend/src/scenes/lily/portraitPhotoReveal.test.ts
M	frontend/src/scenes/lily/portraitPhotoReveal.ts
M	frontend/src/systems/scene-config/README.md
M	frontend/src/systems/scene-config/config.test.ts
M	frontend/src/systems/scene-config/config.ts

Independent acceptance identified saved archPositionZ being ignored; b191f80 restores it as a relative offset and the finding was independently rechecked. No unrelated scene or asset file changed. Identity/gallery camera and shared frame particles received scoped changes; saved configurations retain explicit values.
