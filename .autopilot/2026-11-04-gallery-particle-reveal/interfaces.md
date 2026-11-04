# Интерфейсы реализации

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `gallery/collage` | layout дополнительных слотов, детерминированная UV/particle geometry и функции timeline | тип фото, layout, geometry builder, timeline progress | генерацию seed, ограничение input, slot timing |
| `shared/progressivePhotoReveal` | cell-resolution sampling и interpolated photo alpha | shader snippet/fragment helper, progress utility | per-pixel детали и базовую smoothstep математику |
| `GalleryScene` | загрузку выбранных texture, shader uniforms, render и lifecycle эффекта | внутренний `CollageExtraPhoto` | шейдеры, общие textures, cleanup и focus synchronization |
| `galleryCollageConfig` | параметры конкретных событий по event id | readonly lookup `getGalleryCollageConfig(eventId)` | пустые значения и default включённого режима |
| `SceneComposerConfig` / DEV | диапазоны и значения по умолчанию | `scenes.gallery.collage*` settings | merge, migration defaults и безопасную нормализацию |

## Контракт коллажа

```ts
interface CollageRevealSettings {
  particleCount: number
  particleSize: number
  noiseStrength: number
  depth: number
  glow: number
  assembleDuration: number
  revealDuration: number
  staggerDelay: number
  particleEnabled: boolean
}
```

Geometry/timeline utilities remain pure apart from the returned disposable `BufferGeometry`. The focused-photo component owns its loaded texture, shader materials, frame-loop refs and disposal. Settings are immutable values from the existing Scene Composer; changing density may rebuild the focused geometry only.

## Project rules for tickets

- Target worktree is `C:\Users\McHomak\Projects\A_Little_Universe_scene05_night`, branch `codex/scene05-night-palette`.
- Use existing React, TypeScript, Vite, Three.js and React Three Fiber dependencies. Do not install a new dependency or copy `memory-signal-threejs` source. Do not create another canvas, renderer or WebGL context.
- Preserve the persistent FilmCanvas, SceneDirector, CameraDirector, gallery focus controller, camera/light transitions and existing collage slots. Do not edit active Scene 04 behavior.
- No per-frame React state updates. Free textures, materials and geometries when the focused collage changes or unmounts. Keep reduced-motion behavior.
- Do not rewrite or merge into `main`. Keep changes on `codex/scene05-night-palette`.
- A missing dependency or unavailable browser capability is returned as `BLOCKED`, not installed or worked around by adding infrastructure.
- Run checks from `frontend` with `npm run check` for final integration. Focused unit tests may run using `npm test -- <test-file>`.
- Visual QA uses the single running Vite/FilmCanvas renderer and the local DEV route; capture focus, completed reveal, return and repeated cycles.

## Из таска 01 — базовый photo-particle эффект

- `CollageRevealSettings` — компактный набор визуальных значений, используемый GalleryScene. Пока T02 не добавил Scene Composer, ticket 01 поставляет `DEFAULT_COLLAGE_REVEAL_SETTINGS`.
- `createCollageRevealGeometry(width, height, seed, count?, settings?) -> BufferGeometry` — детерминированные targets + per-particle texture UV, start offset и phase.
- `getCollageRevealFrame(elapsedSeconds, slot, settings?, reducedMotion?)` — gather/photo resolve/particle opacity для слота; пустой слот возвращает нулевой проход.
- `progressivePhotoRevealState(progress)` и `progressivePhotoRevealGLSL` — общий progressive cell-resolution для GalleryScene и legacy restore shader; старое absolute-time API получает тот же результат.
- `GalleryScene` владеет texture loader, selected collage lifetime, shader materials и ref-driven frame loop. Points не монтируются вне focus; меняя density, T02 пересобирает только активный geometry.

## D01 ? Scene 04 adaptation

`advanceCollageRevealTimeline(...)` advances elapsed seconds with a reversible, bounded return. Photo coverage and particle opacity share an image-generic UV arrival map adapted from the current Scene 04 spatial reveal approach. The current branch does not contain its implementation; the adjacent worktree is reference only.
