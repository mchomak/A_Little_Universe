# 03 — Isolated DEV portrait comparison and tuning lab

**Requirements:** R01–R16, R31–R43, R48–R52, R57–R58, R62, R64–R65, R08.1, R15.1, R42.1–R42.2, R43.1
**Blocked by:** 01, 02
**Zone:** `frontend/src/main.tsx`, `frontend/src/particle-portrait-lab/`
**Wave:** 2
**Status:** done

## What must work

Create a lazy DEV-only `/dev/particle-portrait` page with a static 4:3 preview on `#080914`. Use the existing photo/matte and consume the public sampler and shared particle appearance seams from tickets 01/02. Render the photo comparison and particles in the same fixed composition; toggle between them without reload. The portrait is completely landed at initial load, with no vortex, camera movement or assembly animation. It preserves the photo's aspect ratio.

Add a compact control panel grouped into particles, detail, color and composition. Settings update immediately; only sampler-affecting changes rebuild the point geometry, appearance uses uniforms, and composition uses group transform. Store validated, versioned settings locally, provide sensible defaults and explicit storage/image/WebGL failure feedback, and export/copy the same JSON shape with a selectable fallback if clipboard access fails. Keep the panel collapsible/scrollable on narrow layouts while maintaining a usable landscape 4:3 preview.

Use one R3F Canvas with FilmCanvas's renderer context options and the exact shared particle material. Do not mount or alter the ordinary film route from this lab.

## From the brief, verbatim

> «Создай отдельный DEV-route, например `/dev/particle-portrait`»
> «Отображай статичный портрет из частиц без вихря, движения камеры и анимации сборки.»
> «Добавь возможность переключаться между оригинальной фотографией и звёздным портретом для сравнения узнаваемости.»
> «Настройки работают в реальном времени и экспортируются в JSON.»
> «Изолируй DEV-страницу от обычного пользовательского просмотра сайта.»

## Spec sections

§1–§5; user stories 1, 3, 5, and 6; initial values/ranges; error/interruption behavior; module boundary table; clarifications R13.1, R13.2, R15.1, R22.1, R42.1–R42.2, R43.1.

## Acceptance criteria

- [x] `main.tsx` renders this lazy route only when `import.meta.env.DEV` is true; production routing contains no reachable lab UI.
- [x] Horizontal 4:3 preview at tablet-sized viewport stays centered on the unchanged photo ratio against `#080914`; the source-photo and star modes align exactly and toggle instantly.
- [x] The default static star portrait uses the shared material and real photo-derived targets, has no moving camera/particles, and supports internal facial detail, hair/shadows and midtones rather than only an outline.
- [x] All required controls update live; versioned defaults/normalization and localStorage fallback work; reload restores saved settings; JSON copy/read-only fallback is truthful; geometry is rebuilt only for sampling inputs, not per frame.
- [x] Focused tests cover settings validation/storage fallback and JSON export. Browser check confirms route isolation and no WebGL errors.
- [x] Existing Scene 04 source files and timeline are not changed by the lab integration.

## Testing

From `frontend/`, run the focused lab tests and `npm run build`. Do not run the full suite. Read `C:\Users\McHomak\.agents\skills\autopilot\prompts\executor.md` before editing.

## Must not

Do not implement portrait assembly, photo transition, vortex, lily dissolve changes, scene 04 trajectory changes, route protection/auth, or any production viewer link. Do not install packages.
