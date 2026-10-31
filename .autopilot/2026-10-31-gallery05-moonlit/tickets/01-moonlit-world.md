# 01 — Лунное пространство и настройки

**Требования:** R01–R27, R46, R49, R54, R56–R65, R68–R69
**Blocked by:** none
**Зона:** gallery environment modules, GalleryScene outer body, scene config, debug Inspector, CameraDirector gallery-only far clip
**Волна:** 1
**Status:** ready

## Что должно заработать
Галерея получает видимое многоплановое ночное облачное окружение, небольшую фиксированную луну, низкую дымку и плоскую влажную поверхность. Это новая художественная среда существующей сцены, все интеракции/контент сохраняются. Основные 10 настроек подключены через существующий Inspector, импорт, сброс, историю. Реальное ощущение облаков, а не абстрактные размытые полосы.

## Из брифа
> «Все четыре референса описывают одно непрерывное трёхмерное пространство»
> «Луна имеет фиксированное мировое положение»
> «Не упрощай её до пустого тёмного пространства ради производительности»

## Разделы спецификации
spec.md §1–4, §8–11; interfaces.md in full. Image1/4/3/2 paths in reference.md, view every original image before writing visual code.

## Приёмка
- [ ] World-fixed far/moon, middle clouds and low haze visible from multiple camera positions, upper sky dark; moon partially occluded and secondary.
- [ ] Flat nearly-black water with static subtle variation, cold lunar path; floor cannot read as platform at walk/focus angles. Leave photo reflection for02 but environment ready.
- [ ] Remove perspective floor guide lines and unnecessary GallerySpotlight; no new renderer/postprocessing/SSR/raymarch/deps.
- [ ] All settings normalized/bounded and exposed in existing Inspector including live update, reset/history/import, v1–v5 compatibility.
- [ ] Gallery-only camera clip extension via CameraDirector with cleanup, no other camera choreography change.
- [ ] Resources disposed, paused/hidden/reduced-motion respected, low decorative budget; no decor stealing raycasts.
- [ ] Meaningful tests for config migration/clamp and world geometry contracts, existing tests pass. npm run check.
- [ ] Return actual new files/interfaces and concerns, no commit (coordinator commits).
