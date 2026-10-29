# Сцена 02 — семечко и handoff ростку

Сцена зарегистрирована под `GrowthScene` в существующем `SceneDirector`; это не отдельный Canvas и не завершённая художественная модель. Обновления привязаны к `useSceneAnimation` и общему `FilmRuntime`. Повтор, перемотка назад, пауза и смена viewport повторно вычисляют детерминированную позу по времени.

| Время сцены 02 | Кадр |
|---|---|
| 0–2,2 с | Компактные ivory / pale-pink частицы формируют вытянутое семечко в центре кадра |
| 2,2–3,45 с | Семечко плавно опускается к основанию растения; короткий след затухает к остановке |
| 3,45–4,15 с | Единственный слабый импульс малого радиуса у основания |
| 3,65–4,4 с | Перекрывающийся переход от семечка к малому ростку; веса непрерывны |
| 4,4–18 с | Placeholder постепенно растёт до исходного полного размера |
| 18–23 с | Placeholder удерживается до автоматического перехода к закрытому бутону, который ожидает отдельного касания |

Первое касание только в ожидании сцены 01 сохраняет существующий импульс 0,85 с; нового gate сцены 02 нет. Общий runtime переводит фильм в автоматическую 02, а в конце — в существующее ожидание 03.

## Настройка

`frontend/src/engine/filmConfig.ts`, объект `TIMING.growth`, задаёт `formation`, `fall`, `landing`, `handoff` и `sprout`. Полная длительность 23 с, полный placeholder к 18 с и прежнее `stem: [11, 18]` для совместимости с `poseGrowingLily` сохранены. Камера остаётся фронтальной до конца handoff в 4,4 с; затем `CameraDirector` доходит до прежней боковой позы к 23 с.

`frontend/src/scenes/growth/seedProcedure.ts` задаёт provisional root `[0, -1.45, 0]`, чистые функции фаз, высоту seed в 1% текущей высоты вида, детерминированные позиции частиц (22 standard / 8 low), тихий след, один импульс и контракт `getGrowthHandoff(time, viewportHeight?, reducedMotion?)`. Эта высота вида вычисляется по текущему размеру Canvas и существующим фронтальным настройкам `CameraDirector`, поэтому поворот во время паузы не читает устаревшую позу камеры.

`frontend/src/scenes/GrowthScene.tsx` содержит компактный radial `gl_PointCoord` fragment shader с мягким краем и точками 2,7 px, цвета `#FFF0E8` и `#F4CDD9`, маленькое ядро и кольцо. Shader uniforms имеют стабильную ссылку, так что React rerender при замене quality или reduced motion не сбрасывает текущую opacity позу до следующего кадра. BufferGeometry описана декларативно внутри R3F-дерева и освобождается при размонтировании сцены. Новые файлы геометрии, postprocessing и фоновые частицы не используются.

## Контракт будущей GLB

`getGrowthHandoff(time)` возвращает `{anchor, stage, localTime, weight}`. Anchor — world-space root `[0, -1.45, 0]`; начальное соглашение — +Y для роста, identity rotation, единица Three.js. Это соответствует основанию нынешнего schematic Lily, не утверждает окончательную нормализацию модели. Seed начинается в экранном центре (root-local Y=1,45) и заканчивает путь ровно в anchor. Отдельный `pose.handoff` плавно растёт от0 до1 в 3,65–4,4 с; `getGrowthHandoff().weight` — это вес роста: при передаче в 4,4 с он равен `0,065`, а плавно достигает1 к 18 с. В 4,4 с GLB может принять `localTime≈0,75 с` и этот начальный вес; передача перекрывается, поэтому в DEV видно небольшой росток до полного handoff. Затем тот же runtime передаёт сценическое время без события или отдельного таймера; ожидание касания бутона в сцене 03 остаётся у FilmRuntime.

На границе 01→02 одним app-level источником остаётся `PersistentLight`: он затухает по своему существующему 1,15-секундному growth transfer. Сценический центр семечка получает дополнительную opacity с противоположным весом (0→1), в той же проекции. Частицы нарастают к2,2 с; никакая вторая большая сфера не дублирует точку.

После передачи Blender-track нужно получить финальный asset, определить его named root anchor/orientation/scale и длительность clip, проверить имена клипов и масштаб в world units, затем подключить модель к значению `getGrowthHandoff`. Пока этот тест не выполнен, `[0, -1.45, 0]`, identity transform и тестовая форма — только совместимый placeholder. GLB, `.blend`, Growth/Bloom clips и keyframes этой веткой не меняются.

## Проверка

Чистая процедура покрыта в `frontend/src/scenes/growth/seedProcedure.test.ts`: точные фазовые границы, root/local positions, одни и те же samples после обратного seek, viewport высоты 3,856/5,732 для 1024×768/768×1024, low quality, reduced motion, taper и handoff values. Общие `engine/film.test.ts`, `useSceneTimeline.test.ts` и `runtime.test.ts` дополнительно проверяют неограниченное ожидание касания 01, один переход, автоматический вход в 02 и ожидание бутона 03, pause/seek/replay и отписку реального GSAP timeline.

DEV Timeline показывает четыре полезные метки: 02.1 формирование (0), 02.2 падение (2,2), 02.3 импульс (3,45), 02.4 рост и handoff (3,65). Seek 1,8 / 2,8 / 3,8 / 4,4 с показывает семечко, его полёт, остановку с передачей и уже видимый малый росток. Проверка на physical iPad/Safari отдельно не заявляется.

### Проверка в браузере

После чистой перезагрузки подтверждён один Canvas. Восемь кадров ниже сняты в landscape 1024×768 и portrait 768×1024 на отметках DEV-seek 2,15 (сформировано), 2,8 (падение), 3,7 (остановка/импульс) и 4,4 с (handoff):

| Состояние | Landscape | Portrait |
|---|---|---|
| Семечко сформировано — 2,15 с | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/landscape-formed.png) | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/portrait-formed.png) |
| Полёт — 2,8 с | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/landscape-flight.png) | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/portrait-flight.png) |
| Остановка — 3,7 с | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/landscape-landing.png) | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/portrait-landing.png) |
| Росток / handoff — 4,4 с | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/landscape-handoff.png) | [Кадр](../.autopilot/2026-10-29-seed-procedure/evidence/portrait-handoff.png) |

На свежем запуске повторные seek по всем кадрам стабилизировались на 14 geometries и 1 texture; после выхода из пролога оставалось 6 geometries, после выхода из Bloom — 11, Points не оставалось. Replay прошёл через gate 18 с одним касанием; PNG сформированного семечка совпал побайтно. Нативные pause/resume проверены. В low quality оставалось 8 частиц; при reduced motion след и alpha импульсного кольца были равны0. Дополнительный скриншот low/reduced состояния не получен из-за зависшего Chrome tool; основные восемь кадров доступны выше. Физический iPad не тестировался.
