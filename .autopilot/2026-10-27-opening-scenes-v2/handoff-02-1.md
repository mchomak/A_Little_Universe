# Handoff 02.1 — Scene Composer continuation

СДЕЛАНО: Scene Composer controls and shared-store mapping are implemented.
СДЕЛАНО: Global, 00, 00.1 and 01 settings, per-field and per-group reset, two presets, partial JSON import and export are wired.
СДЕЛАНО: Existing play, pause, speed, seek, scene launch/restart, diagnostics, preload and preparation actions remain present.
ФАЙЛЫ: `frontend/src/debug/DeveloperPanel.tsx` — Composer UI.
ФАЙЛЫ: `frontend/src/debug/composerControls.ts` — store, preset, reset and JSON seams.
ФАЙЛЫ: `frontend/src/debug/composerControls.test.ts` — 8 focused tests, green.
ФАЙЛЫ: `frontend/src/engine/FilmCanvas.tsx` — subscribes to quality/DPR config on the existing Canvas.
РЕШЕНИЯ: Partial import requires schemaVersion 1 and updates the active store; invalid JSON, version and section shapes leave it intact.
РЕШЕНИЯ: UI DPR bound changes preserve min ≤ max; low quality caps max DPR at 1 while respecting configured minimum.
РЕШЕНИЯ: Font changes use updateConfig, which awaits the existing local font loader before publishing the selected face.
ТУПИКИ: `npm run check` currently stops at lint because sibling-zone `src/bootstrap/Preloader.tsx:19` writes a ref during render.
ТУПИКИ: An exported helper from FilmCanvas triggered react-refresh lint; helper is now private and its direct test was removed.
ДАЛЬШЕ: Run scoped ESLint on ticket 02 files and the focused test after any fixes.
ДАЛЬШЕ: After ticket 03 stabilizes, rerun `npm run check`, inspect the DEV panel in-browser, and run the Impeccable detector once.
