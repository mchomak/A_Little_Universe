# 03 — GPU-пепел из пикселей текста

**Требования:** R04, R05, R06, R07, R08, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R28, R29, R30, R31, R32, R42, R43, R44  
**Blocked by:** 01  
**Зона:** `frontend/src/scenes/PrologueScene.tsx`, `frontend/src/scenes/prologue/`, `frontend/src/systems/scene-config/config.ts`, related unit tests
**Волна:** 2  
**Status:** ready

## Что должно заработать

Существующая PrologueScene преобразует непрозрачные пиксели локального Marck Script в стабильный points-buffer. По мере прохождения шумного фронта крупные фрагменты рождаются на месте букв, улетают вверх-влево, распадаются на мелкую светлую пыль и постепенно пропадают.

## Из брифа, дословно

> «splitting the text.png посомтри и сделай максимально приблеженно к референсу.»
> «Генерацию частиц из реальных непрозрачных пикселей шрифта Marck Script.»
> «Движение частиц вверх-влево с небольшими индивидуальными отклонениями, затуханием и эффектом мелкого пепла.»
> «GPU-анимацию через THREE.Points, BufferGeometry, ShaderMaterial.»
> «Сохранение читаемости оставшегося текста: частицы не должны его перекрывать.»

## Разделы спецификации

Истории 4–8 и 10–11, «Решения по реализации» 2–6/8/9, «Scene Composer», «Границы и швы» — Prologue particle field.

## Критерии приёмки

- [ ] В стандартной конфигурации частичная выборка берётся из фактических непрозрачных пикселей Marck Script и совпадает с расположением видимого текста; список частиц и времена их рождения детерминированы seed.
- [ ] Частица рождается при приходе фронта к её пикселю; тесты отдельно проверяют левую/правую границу, шум и повторный seek через `createSceneTimeline`/`createFilmRuntime`.
- [ ] Каждый крупный фрагмент превращается в несколько меньших; все получают основной дрейф вверх-влево, ограниченную turbulence и плавный fade без огня, взрыва или ярких искр.
- [ ] Пыль остаётся за фронтом и не пересекает ещё читаемую правую часть текста.
- [ ] Эффект использует один существующий `THREE.Points` + `BufferGeometry` + `ShaderMaterial`; новых видимых Canvas, renderer или render loop нет.
- [ ] Смена сцены/конфигурации освобождает geometry и material; low quality, DPR, mobile/coarse pointer и reduced-motion снижают или отключают слой по спецификации.
- [ ] PrologueScene consumes v2 `particleDuration` and `particleFadeDuration`; after renderer migration, remove obsolete internal speed/spread/return aliases from the v2 schema while preserving schema v1 JSON normalization.
