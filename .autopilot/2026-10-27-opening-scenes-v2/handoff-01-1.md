# Handoff 01.1 — config/fonts foundation continuation

## РЕШЕНИЯ

Реализованы schema v1, defaults, per-field normalization, observable immutable store, scoped reset, presets и локальный font readiness API. `updateConfig` публикует смену лица только после загрузки. Добавлены четыре локальных TTF с OFL-лицензиями; cmap-проверки покрывают русские буквы, Ё/ё, цифры и пунктуацию. Интерфейсы: `normalizeConfig(input)`, `loadStartupConfig()`, `getConfig()`, `subscribeConfig(listener)`, `updateConfig(patch)`, `resetConfig(scope)`, `loadArtFont(id)`; `RuntimeManifest.optionalAssets`.

## ТУПИКИ

Локальных шрифтов в проекте не было. Python `fontTools` отсутствовал; зависимость не добавлялась, проверка cmap реализована для formats 4/12. Исправлена ошибка двойного применения `idDelta` для format 4. Целевые тесты: config 6, font catalog 2, startup config 2, AssetManager 8 passed.

Полный `npm run check` дал 51 passing tests, затем typecheck остановил build:
- `src/systems/scene-config/config.test.ts(53,26) TS2532: Object is possibly 'undefined'.`
- `src/systems/scene-config/config.ts(183,53) TS2345: boolean | undefined is not assignable to boolean.`
- `src/systems/scene-config/config.ts(217,45) TS2698: spread types may only be created from object types.`
- `src/systems/scene-config/config.ts(218,45) TS2769: Object.entries receives unknown.`
- `src/systems/scene-config/fontCatalog.test.ts(1,26) TS2591: cannot find name node:fs/promises; Node types are not in the app tsconfig.`

## ДАЛЬШЕ

Startup/offline integration was added but is not build-verified: AssetManager starts optional JSON loading after `ready`; Vite manifest describes `/scene-composer.json` as optional; the service worker caches a successful response and serves it offline. Continue with these exact failing TS diagnostics, make `npm run check` green without adding a dependency, then inspect generated `runtime-manifest.json` and `sw.js`. Do not redo the completed config/font/catalog work. Keep the ticket's zone and preserve scene 02–09.