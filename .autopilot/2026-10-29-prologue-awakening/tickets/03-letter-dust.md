# 03 — Письмо превращается в световую пыль
Требования: R23–R46,R48–R50,R69–R70,R72–R80,R85–R94. Общее R01–R06.
Blocked by:01
Зона: PrologueOverlay/prologue.css, PrologueScene, prologue glyph/fracture/particle helpers, их тесты.
Волна:2

Из брифа: «частицы должны рождаться из реальной геометрии маски букв»; «непрерывное превращение одной формы в другую»; «У правой части фразы не должно возникать ощущения, будто её заранее перекрывают тёмной текстурой».

Спецификация: Typography, Dissolve, Interaction и тайминг, Composer, Validation, уточнения G2.

Приёмка:
- Marck Script и новые exact phrases, legacy copy config, первая крупнее выше точки, вторая компактнее ниже, responsive измеренная композиция без halo overlap. Prompt около точки16–18.
- Реальное локальное сглаженное stroke-segment reveal с rhythm; не общий wipe по контейнеру, не typewriter. Многострочность и font readiness, resize поддержаны.
- Общая распределённая детерминированная fracture alpha field для DOM/glyph mask и births. Мелкие краевые разрывы/единичная пыль до основной массы, слабое неоднородное свечение; без шумного glitch.
- Alpha-weighted sampling реальных штрихов с корректным baseline и синхронным layout; достаточное число уникальных sample positions. Световая материя непрерывно переходит в dust, индивидуальные sizes/inertia/fade/shrink, вверх-влево и органическое restrained поле. Без sweep cut/чёрного прямоугольника/огня/конфетти.
- Existing GPU Points, appropriate blending, не heavy per-frame raster/geometry; LUT/cache если маска требует raster. Все обновления timeline determinism, cleanup late font promises/resize/listeners/geometries. Reduced motion читабелен без активной пыли.
- Вся пыль уходит к16 (учесть настроечные bounds); prompt16–18,18 gate. Fields01 реально потребляются.
- Подключить готовый PrologueAtmosphere из02 в PrologueScene; до его готовности договориться напрямую с02, не создавать дубликат.
- Meaningful math/layout/timeline/sample tests и typecheck. Визуальный browser QA будет оркестратором, затем исправления по кадрам. Ничего не коммитить.
