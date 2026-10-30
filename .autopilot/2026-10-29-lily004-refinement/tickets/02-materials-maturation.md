# 02 — PBR и переносимый контракт созревания
Требования: R19,R20,R21,R22,R23,R24,R25,R26,R27,R33,R34,R35,R43,R44,R45,R46,R47,R48.
Blocked by:none (материальный study на том же исходнике; сборка final в03)
Зона: material script, textures, material-study blend/export, bud_maturation.json, material reports/screenshots.
Волна:1
Status:ready

## Что должно заработать
Текущая лилия получает читаемый без VFX жемчужно-белый satin PBR, мягкий blush/lavender, продольные прожилки/roughness, приглушённую зелень обоих листьев, тёплые аккуратные пыльники. Молодой бутон зелёный, вторая половина9s Growth созревает к mature; Blender preview и deterministic metadata contract.
## Из брифа, дословно
«жемчужно-белые с нежно-розовыми/лавандовыми полутонами»
«правый лист не должен пропадать полностью при обычном освещении»
«если GLB-анимация свойств материала непереносима, предложи надёжный вариант ... явно задокументируй контракт для runtime, не меняя код самостоятельно»
## Спецификация
S3,S4 color,S6. Study независим от01. Script принимает любой совместимый geometry-stage input, не меняет mesh/TRS/геометрические actions.
## Приёмка
- Portable PBR exported фактически, внутренняя/внешняя стороны согласованы; no black backside/neon/alpha.
- Roughness/color/veins мягкие, листья readable, shape unchanged.
- Packed+embedded maps, budget и отсутствие пропавших textures подтверждены.
- Blender material curve под прямой установкой кадра; extras root ALU_budMaturation+JSON version1, sample linear-sRGB absolute clip time.
- Без pointer-plugin стандартный GLB зрелый, runtime limitation честно; nonGrowth/crossfade reset определены.
- Study GLB реимпортирован, изображения young/mature + материал report. Финальная9s длительность приходит от01; study может retime только material curve на canonical frame1..217.
- Script safe paths/output flags, final assembly documented03.

D01: завершить stock viewer adapter из interfaces; root проверяет материалы в обычном UI этого неизменённого viewer. Не запускать новые MCP browsers.
