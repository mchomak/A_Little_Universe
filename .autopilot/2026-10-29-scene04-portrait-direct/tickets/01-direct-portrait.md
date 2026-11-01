# 01 — Прямое превращение лилии в портрет
Требования: R01–R42 (все). Blocked by: none. Волна: 1. Status: ready.
Зона: frontend scene04 + минимальные identity-only engine/config/overlay; docs/scene-04-portrait-direct.md; .gitignore только unignore нового run.

## Что должно заработать
Весь один связный монтаж сцены 04: 21s dissolve→cloud→ASCII→точное фото→подпись→автогалерея. Полная spec.md — короткая и относится целиком к этому таску. Обязательно прочитать interfaces.md и spec.md до изменений.

## Дословно
«Переработай ТОЛЬКО сцену 04»
«Правильная логика — от абстрактного облака к лицу, а не “сначала квадрат, затем лицо”.»
«Не создавай новую фальшивую лилию.»
«Не делай merge, rebase или cherry-pick результата в основную ветку.»

## Приёмка
- Нет имени, орбит, отдельного vortex, blue Spark, соседних фото; сохраняется узнаваемость оригинала.
- TIMING.identity единый источник фаз, 21s; auto transition и существующий bloom gate не изменены.
- Deterministic geometry/frames/mask at t; cloud smoothly gathered in photo plane, soft early matrix edge, portrait stable at 7.5–10.5.
- Photo точно оригинал; crossfade завершён 13.5, caption >13.5; final first card/camera совпадают с baseline gallery.
- Рабочий текущий Lily placeholder, optional additive source adapter with explicit ownership/anchor/release details for future GLB; не менять 03/05 и не заявлять GLB готовым.
- Low/reduced motion/resize, cleanup, shared clock; tests stage timing/removals/auto entry/exit/pause/seek/reset/dispose/reenter/photo hashes.
- npm run check проходит; worker запускает focused tests и full check, сообщает commands/results. Не править unrelated failures.
- docs/scene-04-portrait-direct.md описывает фактический timeline, ограничения, source and both exact handoffs, merge-conflict guidance без выполнения merge.

## План/исключение калибровки
T1, один плотный таск вместо двух: таймлайн и renderer используют одни файлы и не демонстрируют осмысленного результата порознь. Review и browser acceptance отдельно; новые публичные системы не нужны.
