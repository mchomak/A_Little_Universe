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

A Little Universe for You is a private, tablet-first cinematic React/Three.js birthday film. Preload (00), preparation (00.1), prologue (01), scene 02 RecStudio seed formation/fall/handoff, and the particle-to-first-memory sequence (04.2–04.7) are implemented. Scene 02 plant growth remains a placeholder; scene 03 and scenes 06–09 remain navigable placeholders. The 04.1 lily is procedural. Scene 05 is an interactive gallery with the first real photo and 11 generated development placeholders; music, gaze tracking, and video upload are not connected. The active storyboard is A_Little_Universe_for_Vasilisa_Storyboard_v3.0.md; key_frames/splitting the text.png is an art reference, not a runtime texture.

### Working commands

Run frontend commands from frontend/ with Node.js ^22.12.0 or >=24:
- npm ci; npm run dev (127.0.0.1:5173); npm run preview (127.0.0.1:4173). Both Vite ports are strict; reuse or stop an existing server if a port is occupied.
- npm run check runs ESLint, Vitest, strict TypeScript and production build. Verified 2026-10-31 in this worktree: 217 tests in 55 files, ESLint, strict TypeScript and production build passed. Build still warns about deprecated Three.js CommonJS usage, Vite native config compatibility and an App chunk above 500 kB.
- Focused prologue checks: npm test -- src/engine/filmConfig.test.ts src/engine/runtime.test.ts src/components/PrologueOverlay.test.ts src/components/PersistentLight.test.ts src/scenes/PrologueScene.test.ts src/scenes/prologue/letterMatter.test.ts src/scenes/prologue/lightPose.test.ts.

The dev page was confirmed in Chrome at http://127.0.0.1:5173/; a start attempt reported port 5173 already in use because the server was already running.

Run optional backend commands from backend/:
- .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
- .venv/Scripts/python.exe -m pytest; focused: .venv/Scripts/python.exe -m pytest tests/test_health.py. Three tests passed 2026-10-27.

### Structure and key files

- frontend/ is the React/Vite app; backend/ is optional FastAPI with only GET /health; docs/ holds architecture and verification; references/keyframes/ indexes approved references.
- frontend/src/app/App.tsx owns preparation/film routing and app-lifetime media/audio services; openGift.ts handles the deliberate start gesture. bootstrap/ draws the lightweight Canvas2D preload; systems/assets/AssetManager.ts loads film modules/resources and optional startup config.
- frontend/src/engine/ owns film state, the shared GSAP clock, persistent FilmCanvas, and scene/camera directors. film.ts is the reducer; filmConfig.ts owns order, copy and timing; runtime.ts, useSceneTimeline.ts, and scenes/shared/animation.ts bind scene animation to shared film time.
- frontend/src/scenes/ contains the nine scene modules and shared geometry. Prologue work centers on scenes/PrologueScene.tsx, scenes/prologue/letterMatter.ts, particleMath.ts, PrologueAtmosphere.tsx and lightPose.ts, components/PrologueOverlay.tsx, PersistentLight.tsx and prologue.css.
- Scene 04 uses scenes/IdentityScene.tsx and shared/identityFrame.ts, identityParticles.ts, IdentityAtmosphere.tsx, FirstMemoryCard.tsx and layout.ts. The runtime photo is frontend/src/assets/start_img.jpg, copied from images/start_img.jpg.
- systems/scene-config/ owns schema, normalization, shared config and local font readiness; debug/DeveloperPanel.tsx and composerControls.ts provide the DEV-only composer. systems/media/ owns consent, tracks, recording and recovery; systems/audio/ owns cues and playback response.
- DEV Scene Editor uses SceneTimeline with the shared FilmRuntime for navigation, loop and playback speed; DeveloperPanel owns scene-scoped parameter history and temporary A/B snapshots. A/B requires a stable film checkpoint and rejects stale revisions. Review Notes live in debug/useReviewNotes.tsx; Vite's serve-only dev-review-store.ts stores JSON and PNGs under gitignored dev-reviews/. Exported Markdown is saved in that root; ZIP contains the same relative screenshot paths. The local API checks loopback and Origin. Capture uses explicit browser tab sharing to combine WebGL and DOM, hides DEV UI and waits for a fresh video frame; the user must choose the correct tab and verify its preview. Interactive checkpoints are not reconstructed through fake interactions.
- `frontend/src/iris-lab/` provides the DEV-only Iris Visual Lab at `/dev/iris-lab`. `config.ts` stores schema-v3 settings and custom presets in localStorage, migrates v1/v2 grading, and includes built-in grading presets; the current saved grading preset after reload is **Vasilisa Natural Blue**. Grading screenshots for comparison are in `docs/verification/iris-color-grading-v2/`.
- Iris grading uses linear-sRGB GPU shaders with OKLab/OKLCH conversion, gray recoloring, lightness preservation, gamut mapping and radial amber, middle-blue, outer-blue and limbal-ring zones. `EyeViewport.tsx` syncs uniforms live across the iris texture, particles and fibers; Before/After and Albedo Only inspection are transient view state, outside the saved config.
- Frontend tests are colocated as src/**/*.test.ts; backend tests are in backend/tests/. docs/architecture.md describes scene boundaries and commands.

### Architecture and prologue

Bootstrap prepares film modules and required resources before mounting the app. FilmCanvas remains mounted across scene changes; SceneDirector selects statically imported scenes and CameraDirector owns camera choreography. createFilmClock publishes exact time through FilmRuntime; runtime-bound GSAP timelines scrub from that clock and clean up their subscriptions/contexts on disposal. Keep scene updates in callbacks, refs, GPU buffers and shader uniforms rather than React state per frame. The canvas uses demand rendering and animations invalidate it.

SceneComposerConfig in this worktree is immutable schema v2 in systems/scene-config/config.ts. normalizeConfig(input) accepts v1/v2, drops unknown fields and applies v2 defaults; v1 particleSpeed/particleSpread migrate to wind/turbulence, and obsolete particleReturnFraction is ignored. loadStartupConfig() fetches optional same-origin scene-composer.json after preload; failure leaves current defaults. Font changes publish only after local font readiness. Shared APIs are getConfig, subscribeConfig, updateConfig, and resetConfig; presets are moonlit-letter and stardust.

The prologue gate is 18 seconds. getPrologueFrames(settings) defaults to phrases at 2-5.5 and 7-10.5, reading hold to 12.5, and dissolve to 16; the DOM invitation appears from 16 and waits for touch at 18. The active default copy is “Я долго думал, что тебе подарить…” followed by “И решил, что ты заслуживаешь чего-то особенного:”; getPrologueCopy resolves it through the default legacy copy variant. The overlay timeline and GPU text/particle layers use the same scene-local FilmRuntime time. FilmRuntime.time stays canonical at 18 while subscribePresentation/presentationTime continue decorative light and atmosphere through the same GSAP clock; pause, speed and document visibility apply to both. A deliberate touch captures getPrologueTouchDuration() in FilmState.prologueTouchDuration (default 0.85 s, bounded 0.7-1), preventing live edits from changing an active transition.

PrologueScene measures each complete phrase after local-font readiness. letterMatter.ts rasterizes the whole laid-out text block at 2x into an immutable RGBA atlas (ink coverage, handwriting progress, grapheme dissolve zone, soft halo); deterministic particle positions are sampled from ink pixels, and per-pixel emission times align with the same grapheme zones and seeded thresholds used by the visible dissolve. scenes/shared/dissolve/index.ts provides reusable deterministic noise, threshold, reveal, emissive-edge, particle emission/lifetime helpers and matching GLSL. GPU ink and sampled dust share each letter’s dissolve style; handwritingRhythm drives createHandwritingSchedule() during rasterization. The DOM phrases provide accessible layout/fallback and become transparent when GPU matter is ready; the invitation retains its DOM mask. Dust uses GPU drift/fade, the shared scene-local runtime time, and no per-frame React state. Defaults: 1800 requested particles, size 0.6-1.8 px, travel 2.2 s, fade 1.2 s; all letter matter clears by 16 s. Actual count scales with quality, compact/coarse-pointer layout and DPR. Letter resources and uniforms subscribe to R3F viewport.dpr, rebuild on layout/font/size changes, guard stale async work and dispose textures/geometry. Reduced motion removes dust and simplifies writing/erosion.

App.tsx owns one PersistentLight across ready, prologue and growth. lightPose.ts controls breathing, phrase response, touch glow/wave and the existing 1.15 s handoff from the central light into GrowthScene's seed; the light remains the single interactive target at the prologue waiting gate. PrologueAtmosphere adds a restrained depth/haze shader and quality-scaled distant dust, driven by presentation time. The DEV composer groups typography/rhythm/copy, light, atmosphere, dust/fracture and touch controls; schema v2 remains additive and imports older configs. Great Vibes is bundled at frontend/src/assets/typography/GreatVibes-Regular.ttf and registered in frontend/src/systems/scene-config/fontCatalog.ts; its OFL attribution is in frontend/src/assets/typography/ATTRIBUTION.md. The narrative lines use Great Vibes and the invitation remains Marck Script; Bad Script, Caveat and Cormorant Garamond are also local font assets. systems/audio/prologueCues.ts defines timed intro/phrase/dissolve slots; useAudioDirector.ts routes them and the touch cue; no prologue audio assets/buffers are registered, so playback remains silent. Keyframe PNGs remain references, not runtime backgrounds.

IdentityScene uses a GPU particle set for lily-source → spiral → name → symbol field, a glyph atlas and a detailed ASCII texture with an original-photo underlay. IdentityAtmosphere adds quality-scaled dust and haze; the first photo and its camera pose are shared with GalleryScene. LilyParticleSource.sample(index, count) supplies deterministic scene-04 positions; wire a real source through SceneDirector when replacing the mock. It carries positions only, not velocities or a live GPU buffer; see docs/architecture.md for the contract and limitations. Scene 05 uses scenes/gallery/ for local content, pinch and wheel gestures, bounded corridor travel, focus and visibility handling; CameraDirector owns camera motion and GalleryOverlay owns instruction and exit controls. The first photo is shared with scene 04, and gallery-finish hands off to scene 06 after explicit continuation. See docs/scene-05-gallery.md for content replacement and verification. Physical iPad/Safari performance, recording concurrency and offline behavior are unverified.

### Services, offline behavior and environment

App.tsx owns one MediaSession and AudioDirector outside scene lifetimes. restore() requests no permissions; prepare() is called from the explicit settings action. Recording requires separate consent and the gift gesture; ordered chunks are stored locally in IndexedDB little-universe-reactions-v1. The backend has no upload or authentication route, and the film does not call it.

Production builds emit a same-origin runtime manifest and service worker; required assets are byte-count/SHA-256 checked. Development does not establish offline readiness. Failed module imports require reload after network recovery; ordinary resource failures can be retried. Camera and recording need a secure context. Physical tablet/Safari performance and behavior remain unverified.

Environment variable names only: frontend/.env.example defines public VITE_APP_TITLE; backend/.env.example defines ALU_APP_NAME and ALU_DEBUG. Never place secrets in VITE_* values.

### Scene 02 seed formation

- RecStudio curl noise, per-particle spring attraction and damping run in a deterministic 30 Hz GPU ping-pong simulation on the shared WebGL2 renderer. Float targets require `EXT_color_buffer_float`; otherwise the scene uses its analytic fallback.
- GPU checkpoints are saved every 0.5 s. Backward seek and physics edits restore/reset and replay to film time; replay is bounded to 2.5–3.5 s formation plus a 0.95 s spark tail. Procedural targets describe an asymmetric 3D seed with surface and interior particles.
- Scene duration is 16 s. Formation defaults to 3.2 s and is bounded to 2.5–3.5 s; fall starts at formation end, leaving 8–10 s for plant growth. DEV Inspector exposes quality (2304/4096/9216), size, opacity, cloud, noise, attraction, ramp, damping, formation, free-particle fraction, colors, core glow and seed scale.
- `npm run check` passed on 2026-10-30: 209 tests in 54 files, lint, strict typecheck and production build. Chrome 4:3 checks covered formation, backward seek and fall handoff without WebGL console errors. Physical iPad/Safari performance and hardware without `EXT_color_buffer_float` remain unverified. See `docs/scene-02-seed.md`.
<!-- autopilot:end -->
