# Interfaces and work contracts

## Границы, решённые в спецификации
## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Config model/store | типами schema v1, defaults, проверенным активным значением, preset/reset | 
ormalizeConfig(input: unknown): SceneComposerConfig`; `loadStartupConfig(): Promise<void>`; `getConfig()`; `subscribeConfig(listener)`; `updateConfig(patch)`; `resetConfig(scope)` | глубокую проверку диапазонов/типов, unknown-field handling, детали загрузки optional JSON |
| Font catalog | локально собранными художественными faces и readiness | `loadArtFont(id): Promise<boolean>` и список допустимых font IDs | font URLs, CSS face names и проверку доступных глифов |
| Film runtime / scene clock | единственным временем, скоростью, паузой, revision и seek/replay | текущее scene time/revision и команды film control | GSAP tick, stale callback guard и правила перехода/gate |
| Persistent light view | видимостью и центральной 2D-проекцией точки на переходе ready→prologue | состояние/фаза светового объекта и визуальный hit target для действующего wait gate | CSS/внутреннюю пульсацию, reduced-motion и безопасное скрытие при передаче сцены 02 |
| Prologue renderer | glyph measurements, детерминированным particle position/size/color и один общий points объект | принимает normalized prologue config + scene time + revision, отображает заданный кадр | sampling buffers, seed PRNG, GPU geometry/material и cleanup |
| Scene Composer UI | группировкой настроек, контролами, file import/export, presets и restart/seek | меняет config store и вызывает существующие film controls | сериализацию, валидацию значения и production-only startup behavior |
| Preparation / preload views | визуальным представлением 00 и 00.1 | читают config; отдают существующие действия пользователя | реальный preload progress, consent/media API, запись/восстановление и status capabilities |

Тестовые швы: чистые 
ormalizeConfig`/partial merge для JSON; чистая функция кадра/времени и gate для prologue runtime; наблюдаемый config store/font readiness для live switch. UI и слой ввода не копируют бизнес-логику. Поведение сцены проверяется через общий film runtime/scene time; прямой доступ к внутренним буферам частиц тестам не нужен.
## Project rules for every ticket

- Project root: `C:\Users\McHomak\Projects\A_Little_Universe`.
- Existing stack and lockfile-pinned versions only: React, TypeScript, Vite, Three.js / R3F, GSAP. Do not add or upgrade dependencies for this task; if a required capability is absent, report `BLOCKED` rather than installing a package.
- Preserve the existing single persistent WebGL canvas, scene/camera directors, shared film reducer/runtime, AssetManager and offline-ready path. Scene changes use the current runtime and clean up on revision/unmount.
- Strict product scope: implement and tune scenes 00, 00.1 and 01 plus the necessary shared configuration/loading/render infrastructure. Do not edit or change visual/functional behavior of scenes 02–09.
- Do not make automatic permission requests, start recording outside existing affirmative opt-in, or claim gaze tracking/upload capability that is not connected. Do not change backend or media ownership.
- Frontend is `frontend/` and requires Node `^22.12.0` or `>=24`. `npm ci`; `npm run check` (lint, Vitest, typechecked production build); focused tests via `npm test -- src/...test.ts`; `npm run dev`; `npm run preview`.
- If backend files remain untouched, do not alter backend. Existing optional backend validation is `.venv/Scripts/python.exe -m pytest` from `backend/`.
- Keep changes inside the ticket's Zone. Tests belong beside the module they cover unless the ticket explicitly owns a separate test folder. Do not stage or commit changes automatically.
- Keep all scene times seekable from shared film time, use deterministic inputs where particles or glyph reveals are involved, and dispose transient GPU/listener resources.

## Agreed interfaces between tickets

- Configuration model/store and font catalog: ticket 01 implements the signatures and type boundaries copied above. Later tickets consume them and must not fork defaults, parsing, or font readiness.
- Composer panel: ticket 02 preserves the current `DeveloperPanel` prop contract (`state`, `dispatch`, `reducedMotion`, `onPreload`, `onPermissions`) so ticket 03 can move/mount it at the app route boundary without coordinating component changes.
- Persistent light view: ticket 03 owns the single light view spanning ready→prologue. Ticket 04 consumes it and removes the duplicate prologue seed; its touch action reaches the existing reducer/gate.
- Prologue timing: ticket 04 uses schema-backed frame timings and updates `film.ts`, shared runtime gate, and prologue visuals consistently. The 0.3 s existing touch transition into scene 02 remains unchanged.
- Scene 00/00.1 presentation: ticket 03 reads config for visual treatment only; it must not alter actual resource progress, permission policy, consent, recorder, recovery or unavailable-feature status.
## Из таска 01 — config/font foundation

- `SceneComposerConfig` is schema v1; `normalizeConfig(input: unknown) -> SceneComposerConfig` applies validated known fields over defaults. Unknown/malformed fields do not throw.
- `loadStartupConfig() -> Promise<void>` reads the optional same-origin `/scene-composer.json`; missing/invalid resource falls back to defaults. `getConfig()`, `subscribeConfig(listener)`, `updateConfig(patch) -> Promise<SceneComposerConfig>`, and `resetConfig(scope) -> Promise<SceneComposerConfig>` form the active store contract.
- `loadArtFont(id) -> Promise<boolean>` resolves local art-font readiness before the config store publishes a font change. Available ids: Marck Script, Bad Script, Caveat, Cormorant Garamond; validated glyph coverage is Cyrillic including Ё/ё.
- `RuntimeManifest.optionalAssets` marks optional startup config for offline resource handling. Keep it optional so failure does not block actual preload.
- Assets/store/font files from ticket 01 are uncommitted until repair, review and full checks pass. Ticket 01 is in repair; continue inside its Zone.
## Ticket 02 — Scene Composer controls

- `setComposerField(path, value)` updates a single schema-backed field.
- `importComposerJson(source)` validates/imports partial schema v1 JSON; invalid documents preserve active config.
- `exportComposerJson()` serializes the active config.
- `resetComposerField(path)`, `resetComposerScope(scope)`, and `applyComposerPreset(id)` expose scoped reset and preset controls.
- `FilmCanvas` consumes global quality/DPR values using the existing renderer.

## Ticket 03 — preparation and persistent light

- `PersistentLightPhase = 'hidden' | 'ready' | 'prologue'`.
- `PersistentLight({ phase, interactive?, reducedMotion?, onActivate? })` is the single app-level center light view.
- Preparation and preload views read scene presentation parameters from the active config store while preserving real preload progress and existing consent/media owners.
