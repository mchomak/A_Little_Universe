СДЕЛАНО: 21-секундный пролог до бесконечного touch gate; переход 0,3 с сохранён.
Рукописное раскрытие двух полных фраз; glyph-mask dissolve, deterministic seed, один Points draw path.
Pause/seek/replay/reduced-motion и внутренние config glow/pulse PersistentLight; npm run check подтверждён root: 72 tests green.
ФАЙЛЫ: frontend/src/components/PersistentLight.tsx (+ test); PrologueOverlay.tsx; PrologueScene.tsx (+ test).
frontend/src/engine/film.ts (+ test); runtime.ts (+ test); filmConfig.ts (+ test).
prologue.css восстановлен к исходному состоянию; чужие изменения не тронуты.
РЕШЕНИЯ: gate зафиксирован на 21 с, seek bound и schema timings в одном TIMING; переход 0,3 с остаётся.
Frame settings укладываются в фиксированный gate; перед sampling ожидается готовность шрифта; маска строится по отрисованным глифам.
Return share: normalized config scaled to 0–20% (default 0.75 → 15%); low quality halves particle count.
ТУПИКИ: overlay CSS selector на .persistent-light для pulse отозван после ownership review; config читает сам PersistentLight.
Изменение prologue.css восстановлено; overlay target удалён, touch принимает только общий light.
Большой interphrase interval сжимает окно второй фразы, сохраняя минимум 0,5 с на reveal.
ДАЛЬШЕ: root уже подтвердил npm run check green; code action завершён.
Visual browser pass не сделан: порт 5173 занят; CUA IAB visibility недоступна subagent.
Если нужна визуальная сверка, открыть локальный app в root context и scrub prologue 0–21 с.
