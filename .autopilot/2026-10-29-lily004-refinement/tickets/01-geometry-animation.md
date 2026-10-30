# 01 — Геометрия бутона и живое движение
Требования: R09,R10,R11,R12,R13,R14,R15,R16,R17,R18,R28,R29,R30,R31,R32,R36,R37,R38,R39,R40,R41,R42,R43,R44,R45,R46,R47,R48.
Blocked by: none
Зона: geometry script, geometry source/export, geometry reports/screenshots (interfaces).
Волна:1
Status:ready

## Что должно заработать
Существующая04m лилия превращается в плавно деформирующийся бутон/цветок: без широких швов в закрытом/раннем раскрытии, мягкий контур, чашеобразное полное раскрытие, продольная кривизна и контролируемый передний тепал. Growth9s/Bloom8s; остальная последовательность непрерывна.

## Из брифа, дословно
«плавный продольный изгиб лепестков на Bloom ... не ограничивайся вращением лепестков как жёстких створок»
«Проверяй геометрию в закрытом, раннем, среднем, почти открытом и полном состояниях»
«Сначала оцени простое retiming, затем поправь ключи там, где ускорение вызывает механическое движение»

## Спецификация
S2,S4 motion,S5,S6. Читай interfaces/spec. Материалы не менять (кроме необходимой проверки winding/sidedness, сообщить02).
## Приёмка
- Сохранены root/anatomy/topology/parenting/units; новых крупных объектов нет.
- Closed/early не имеют широких чёрных щелей, шесть тепалов мягко изгибаются, не ригидные створки; нет knee folds из текущего04m.
- Передний тепал и нормали просмотрены с нескольких сторон.
- Growth natural curvature/unfold; simple retime сначала оценён и записан, mechanical phases исправлены.
- Dense normal/intersection/jump samples; новые morphs не ломают остальные actions.
- Background reopen/preview GLB даёт точные6 clip names/durations, endpoint continuity.
- Geometry screenshots/JSON и воспроизводимый script/commands. При неудаче честный fail report.
