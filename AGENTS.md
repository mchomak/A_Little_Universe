# AGENTS.md — A Little Universe for You

Project-level instructions for Codex. Keep this file compact: task-specific requirements belong in the current user prompt; the storyboard and approved keyframes define the creative direction. This file defines durable context, engineering constraints, and working style.

## 1. Project context

**A Little Universe for You** is a private, cinematic, interactive 3D birthday experience for Vasilisa, intended primarily for a tablet. It is not a conventional multi-page website or a business product.

The authoritative narrative and planned shot order are in the Markdown storyboard supplied at the project root (later it may be copied or referenced from `docs/storyboard.md`). Approved keyframes will be stored under `references/keyframes/`; they are art-direction references, not automatically usable 3D assets.

The experience includes a glowing seed; a pink-white lily that grows and opens on touch; particle morphing into Vasilisa's name and a portrait; a navigable 3D memory gallery; a stylized blue eye with optional gaze tracking; an iris-to-galaxy transition; a cosmic lily-and-peony bouquet; and closing birthday greetings and credits. A small blue particle is a recurring visual motif.

**Current priority:** establish a stable technical foundation and a fully navigable placeholder version of the entire film. Implement and polish artistic scenes only when explicitly requested and their references are available.

## 2. Scope and non-goals

In scope over the life of the project:
- immersive scenes, authored camera choreography and controlled transitions;
- touch input, interaction gates, a gallery the viewer explores at their own pace;
- responsive tablet-first design and a development-only scene debugger;
- preloading/offline resilience and optional local reaction recording;
- optional camera-based artistic eye tracking and consent-based video upload.

Out of scope unless explicitly requested:
- accounts, payments, CMS, dashboard, CRM, analytics trackers, generalized game engine;
- face identification or biometric identity recognition;
- live streaming, background recording, or cloud capture without affirmative consent;
- production-grade implementation of every scene during initial scaffolding;
- databases, microservices or infrastructure added only for speculative future needs.

## 3. Preferred stack

Use compatible current stable releases; check peer dependencies instead of guessing exact versions. Avoid unnecessary dependencies.

### Frontend and visuals
- React + TypeScript + Vite (client-side SPA; Next.js is not required for this project).
- Three.js + React Three Fiber; Drei when it simplifies a concrete problem.
- GSAP for cinematic timelines and controlled camera/scene transitions.
- Custom GLSL shaders and GPU-oriented particle techniques for demanding visuals, introduced when a shot requires them.
- Postprocessing selectively, after measuring performance on the tablet.
- CSS for a small accessible UI layer; no heavyweight UI framework by default.

### Device features and resilience
- MediaPipe Face Landmarker for **approximate artistic** gaze response when activated.
- Browser getUserMedia / MediaRecorder for optional capture of reaction video/audio.
- Service Worker / Workbox or vite-plugin-pwa when implementing offline caching.
- IndexedDB and/or OPFS for local video chunks when implemented; provide explicit export and recovery paths.

### Backend and development
- Python + FastAPI + Pydantic + pytest for future consent-controlled video-upload APIs.
- Object/file storage only when actual upload functionality is implemented; no PostgreSQL requirement for initial scaffold.
- `.env.example` committed, real secrets in untracked `.env` files.
- Docker/Compose only where it improves the local or deployment workflow.

## 4. Architecture principles

Build a **modular monolith**, not microservices. Preserve clear boundaries between:
- app/UI overlays;
- film state and interaction gates;
- camera and audio direction;
- Three.js scene objects, shaders and particle systems;
- asset loading and caching;
- optional camera/tracking/recording;
- backend upload/storage.

Important invariants:
- Prefer a **single persistent WebGL canvas** for the film; do not allocate an independent renderer per scene without a demonstrated need.
- Keep film control explicit: auto-timed scenes versus waiting-for-touch versus viewer-driven exploration.
- Avoid React state updates for individual particles or on every animation frame; prefer GPU buffers, shaders, refs and render-loop updates.
- Scene modules should not arbitrarily overwrite global camera/audio/renderer settings; use shared directors or controlled ownership.
- Scene transitions and resources must clean up correctly; do not leak render loops, listeners, camera tracks, audio nodes or WebGL objects.
- The visual experience must remain functional if gaze tracking, mic, recording, upload or internet becomes unavailable after loading.
- Keyframes constrain art direction; translate them into feasible scene geometry, lighting and camera movements, not static screenshots masquerading as 3D.

Design today's code so future additions are possible without speculative infrastructure. Extensible does not mean abstract everything now.

## 5. Storyboard and creative fidelity

Before a scene task, read its segment of the storyboard and the relevant approved keyframes. Preserve timing, story beats, color, typography, subject identity, camera trajectory and emotional pacing unless the user explicitly changes them.

Do not generate arbitrary filler stories, photos, personal facts, or altered facial features. For absent personal photos and art assets use clearly labeled development placeholders; never pretend they are final.

The blue particle motif is a continuous, subtle narrative cue, not an instruction to make every frame predominantly blue.

When artistic feasibility conflicts with a static reference, identify the trade-off and offer a technically achievable rendition instead of silently changing the approved look.

## 6. Permissions, privacy, security

- Camera-based eye interaction, recording reaction audio/video and uploading the recording are **separate** optional decisions.
- No audio/video recording or remote upload without explicit affirmative consent; do not pre-check recording or upload by default.
- Request browser permissions from a deliberate user action, preferably before the film begins. If refused, provide graceful fallbacks.
- No hidden recording, no data collection outside the specified purpose, no identity inference from camera imagery.
- Keep face tracking on-device. Do not upload camera frames merely to drive eye animation.
- Make recording status visible and stopping/deleting/exporting understandable.
- Treat locally recorded chunks as recoverable but not indestructible; browser storage may be evicted. Never claim a file was saved/uploaded until verified.
- Protect upload URLs and stored videos; never expose secrets or raw recordings publicly.
- Validate untrusted input on API boundaries and avoid exposing internal errors to users.

## 7. UI/UX freedom

The user intentionally gives Codex creative freedom on ordinary UI details **within** the approved storyboard and keyframes.

- The tablet is the primary device; preserve horizontal cinematic composition and adapt to portrait/mobile.
- Keep presentation overlays minimal. Never cover the primary animation with unnecessary labels.
- Keep interactive prompts discoverable, accessible and usable by touch.
- Let meaningful text and gallery memories wait for the viewer; do not auto-skip them.
- Provide reduced-motion/fallback behavior where practical without erasing the intended experience.
- Build developer tools behind development-only access. Do not ship visible debug UI in production.

Do **not** treat exact spacing, incidental component placement or unspecified micro-interactions as fixed. Make strong, cohesive decisions yourself. Do treat approved art direction, story beats and keyframes as constraints.

## 8. Work style

### Understand before changing
Before a meaningful implementation:
1. inspect relevant repository files;
2. understand the existing structure and conventions;
3. identify the smallest coherent change;
4. define how the result will be verified.

For multi-step work, state a short implementation plan, then execute it. Do not repeatedly ask for confirmation on routine technical choices.

### Ask only when it matters
Do not block on minor decisions that can be safely inferred.

Make a reasonable choice and continue for:
- exact button labels;
- spacing;
- component library choices;
- ordinary folder structure details;
- common implementation details.

Ask or explicitly flag the issue when ambiguity could materially cause:
- data loss or loss of an irreplaceable reaction recording;
- a privacy/security weakness or unintended recording;
- a major architectural rewrite;
- incompatible browser/device behavior;
- divergence from approved artistic direction.

### Simplicity first
- Build only what the current task needs.
- Prefer straightforward code over clever abstractions.
- Do not add services, queues, caches, event buses, repositories, factories, or generic frameworks without a concrete reason.
- If a simpler implementation is equally correct and maintainable, use it.

### Surgical edits
When working in an existing codebase:
- do not refactor unrelated code;
- preserve existing conventions unless they conflict with the task;
- remove only dead code created by your own changes;
- mention unrelated problems instead of opportunistically rewriting them.

## 9. Assets and reference hygiene

- Keep approved reference keyframes in `references/keyframes/`; organize by scene and maintain an index or README with shot IDs, review state and intended use.
- Do not silently overwrite approved references or replace originals. Use clear new filenames for revisions.
- Keep runtime assets in a build-accessible frontend asset location. Reference files at repository root are not automatically URL-addressable by Vite.
- Do not automatically include every reference image in the production bundle.
- Prefer appropriately compressed, resolution-limited textures and audio. Measure bundle and GPU memory cost.
- Preserve an explicit distinction between `placeholder`, `draft`, and `approved`.

## 10. Validation, error handling and tests

Validate both UI boundaries and authoritative backend boundaries where applicable.

High-priority testing:
- scene sequence and state transitions;
- timed transitions versus explicit touch gates;
- replay, pause, gallery navigation and browser back/reload behavior;
- missing-asset and offline fallback paths;
- permission denied or camera unavailable;
- no recording/upload without explicit consent;
- start/stop recording and recovery of local chunks;
- disposal of GPU/audio/media resources;
- tablet performance and layout.

For bug fixes, reproduce the bug with a test when practical, then fix it. Tests should focus on risk, not line-count coverage. Human visual review against keyframes is essential but does not replace build and functional checks.

## 11. Verification before completion

Before saying a task is complete, run relevant available checks, such as:
- frontend lint and type-check;
- frontend production build;
- tests for state transitions and critical logic;
- backend tests and `/health` route (if backend exists);
- startup using the documented commands;
- manual browser/device checks where relevant and possible.

If a check cannot be run, say exactly which and why. Do not report success based only on visual inspection when behavior is objectively testable.

## 12. Definition of done

A change is done when:
- it fulfills the currently requested behavior and its acceptance criteria;
- it does not knowingly break existing scenes or timeline rules;
- relevant tests/checks pass, or blockers are explicitly documented;
- performance and resource cleanup are considered for added visual features;
- consent and privacy invariants remain intact;
- the project builds/runs using the documented workflow;
- documentation is updated for durable architectural changes;
- no secrets, unintended debug exposure, misleading fake-success states or unexplained temporary mocks remain.

Explicitly authorized **placeholder scenes** are allowed in scaffold stages, but must be documented as such and never represented as finished film art.

## 13. Keep project context lean

This file contains durable rules only. Do not paste the full storyboard or each task's instructions into it.

Priority order when instructions conflict:
1. the user's explicit current task;
2. approved creative requirements and project-specific technical docs;
3. this `AGENTS.md`;
4. general conventions.

When the task introduces a durable rule that will matter across future work, update this file only if explicitly asked or if the repository workflow clearly expects it. Preserve established working principles and avoid unrelated rewrites.

<!-- autopilot:start -->
## Current implementation
A Little Universe for You is a private, tablet-first cinematic React/Three.js birthday experience. The preload (00), preparation (00.1), and prologue (01) are implemented; scenes 02–09 remain navigable procedural placeholders. Personal photos, portrait, music, gaze tracking, and upload are not connected. The current storyboard is A_Little_Universe_for_Vasilisa_Storyboard_v2.0.md.

### Working commands
Run frontend commands from frontend/ (Node.js ^22.12.0 or >=24); Vite binds 127.0.0.1 and both ports are strict:
- npm ci; npm run dev (127.0.0.1:5173); npm run preview (127.0.0.1:4173).
- npm run check runs ESLint, Vitest, strict TypeScript and production build. Verified 2026-10-27: 83 tests in 23 files, lint/typecheck/build passed.
- Focused test: npm test -- src/systems/scene-config/config.test.ts.
Run optional backend commands from backend/:
- .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000.
- .venv/Scripts/python.exe -m pytest; focused test: .venv/Scripts/python.exe -m pytest tests/test_health.py. Verified 2026-10-27: 3 tests passed.

### Structure and key files
- Top-level: frontend/ (React/Vite), backend/ (optional FastAPI), docs/ (architecture, verification and decisions), references/keyframes/ (keyframe index); runtime scenes live in frontend/src/scenes/.
- README.md covers commands and workflows; docs/architecture.md covers scene and module boundaries.
- frontend/src/app/ coordinates preparation, film route, and app-lifetime services; frontend/src/app/openGift.ts handles the deliberate start gesture.
- frontend/src/bootstrap/ paints the lightweight Canvas2D preload; frontend/src/systems/assets/AssetManager.ts owns module/resource readiness.
- frontend/src/engine/ owns film state, timing, the persistent Canvas, and scene/camera directors. frontend/src/engine/film.ts is the reducer; frontend/src/engine/filmConfig.ts holds order, copy, timing and prologue frame math; frontend/src/engine/runtime.ts is the shared GSAP clock.
- frontend/src/scenes/ contains nine scene modules and shared procedural geometry/animation; frontend/src/components/ contains DOM overlays, gallery, reading, recording and recovery UI; frontend/src/debug/ contains the DEV-only composer.
- frontend/src/systems/scene-config/ owns schema/defaults/store and local font readiness; frontend/src/systems/media/ owns consent, shared tracks, recording and recovery; frontend/src/systems/audio/ owns cues and playback response.
- Main edit points: frontend/src/app/App.tsx, frontend/src/engine/FilmCanvas.tsx, frontend/src/engine/SceneDirector.tsx and frontend/src/engine/CameraDirector.tsx, frontend/src/scenes/PrologueScene.tsx, frontend/src/components/PersistentLight.tsx, frontend/src/debug/composerControls.ts.
- frontend/vite.config.ts builds the production offline manifest and service worker. backend/app/main.py exposes only GET /health; backend/app/config.py reads backend settings. Tests live beside frontend modules as *.test.ts and in backend/tests/.

### Architecture and durable interfaces
Bootstrap loads film modules and required resources before mounting App/Three. FilmCanvas stays mounted across scene changes; SceneDirector selects among statically imported scenes, while CameraDirector owns camera choreography. Scenes receive shared film time and use the common runtime/revision for seek, pause, replay and cleanup; do not add scene-local clocks. After onCreated confirms an initialized WebGL canvas, FilmCanvas marks the fallback aria-hidden and removes its role=alert; failed initialization leaves the accessible alert visible. Prologue waits at its touch gate after 21 seconds; activation runs a 0.3-second shared transition into growth. The single PersistentLight spans ready and prologue, and owns its configured glow/pulse treatment.

SceneComposerConfig is immutable schema v1 in frontend/src/systems/scene-config/config.ts. normalizeConfig(input: unknown) returns validated fields over defaults and drops unknown fields; loadStartupConfig() fetches an optional same-origin startup JSON after preload; failure leaves defaults active. getConfig(), subscribeConfig(), updateConfig(patch), and resetConfig(scope) are the shared store API; font changes wait for local face readiness before publication. frontend/src/systems/scene-config/fontCatalog.ts exposes loadArtFont(id): Promise<boolean> for Marck Script, Bad Script, Caveat, and Cormorant Garamond, with checked Cyrillic glyph coverage. frontend/src/debug/composerControls.ts owns setComposerField, importComposerJson, exportComposerJson, resetComposerField, resetComposerScope, and applyComposerPreset. Its panel is DEV-only; production configuration comes from the optional JSON resource. For 00.1, schema v1 preparation fields are typeScale (0.9–1.1, default 1), lineHeight (0.9–1.5, default 1.08), and cardOpacity (0.85–1, default 1). Composer displays prologue particleReturnFraction as an effective 0–20%; schema v1 stores a 0–1 coefficient applied to the 20% renderer cap (default 0.75 displays as 15%). Schema sections are global, preload, preparation, and prologue; presets are moonlit-letter and stardust.

frontend/src/engine/filmConfig.ts exports getPrologueFrames(settings) and createHandwritingSchedule(text, duration, rhythm); frontend/src/scenes/PrologueScene.tsx exports deterministic sampleGlyphParticlePixels(alpha, width, height, count, seed). Prologue timings are bounded by the fixed 21-second gate. Scene UI reads config but does not own preload progress or media/consent state.

frontend/src/app/App.tsx owns one MediaSession and AudioDirector outside scene lifetimes. MediaSession.prepare() requests only selected optional permissions; restore() requests none. Recording starts only after explicit opt-in and the separate gift gesture; it commits ordered chunks to IndexedDB database little-universe-reactions-v1 about every four seconds and drains the final queue on stop. Browser eviction or abrupt closure can lose data. Audio unlocks on the gift gesture; no music buffers are registered.

Production builds create a same-origin runtime manifest and service worker; required cached assets are checked by byte count and SHA-256. Development does not establish offline readiness. Failed module imports require reload after network restoration; ordinary resource failures can be retried. Worker upgrades may require closing old tabs. Camera and recording need a secure context; physical tablet/Safari behavior remains unverified.

### Environment and tests
Environment variable names only: frontend/.env.example defines VITE_APP_TITLE (public, bundled); backend/.env.example defines ALU_APP_NAME and ALU_DEBUG. Never put secrets in VITE_* values.
Frontend tests use Vitest and are colocated in frontend/src/**/*.test.ts; backend tests use pytest in backend/tests/. Run one file with the commands above. The optional backend is a health-only API and is not called by the film. There is no upload or authentication endpoint.
<!-- autopilot:end -->
