# 01 — Настройки распада в Scene Composer

**Требования:** R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R32, R36, R37  
**Blocked by:** нет  
**Зона:** `frontend/src/systems/scene-config/`, `frontend/src/debug/`, `frontend/src/systems/scene-config/README.md`  
**Волна:** 1  
**Status:** ready

## Что должно заработать

Scene Composer управляет новыми параметрами рукописного письма и пепельного распада, а старые config v1 продолжают загружаться с сохранением совместимых настроек. Эта схема — базовый контракт для обоих следующих тасков.

## Из брифа, дословно

> «Настройки Scene Composer: particle count, wind strength, turbulence, fracture width, glow, animation durations.»
> «Адаптацию под quality, DPR, mobile и prefers-reduced-motion.»

## Разделы спецификации

История 9–11, «Решения по реализации» 6–7, «Scene Composer».

## Критерии приёмки

- [ ] Нормализатор выдаёт immutable schema v2 и принимает существующие schema v1 JSON; валидация старых полей сохраняет остальные настройки, а удалённый возврат частиц к центру не влияет на новый эффект.
- [ ] Composer показывает и редактирует count, wind, turbulence, fracture width, glow и связанные длительности; значения импортируются, экспортируются и сбрасываются текущим API.
- [ ] Контролы имеют конечные диапазоны, корректные единицы и понятные русские подписи; режимы quality, DPR и playback остаются глобальными и не меняют поведение других сцен.
- [ ] Тесты покрывают migration v1→v2, defaults, границы/невалидные значения и обновление Composer.
- [ ] Документация Scene Composer описывает schema v2, migration и новые поля.