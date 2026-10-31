# 01 — Параметры и объёмный вихрь

**Требования:** R01–R05, R08–R10
**Blocked by:** —
**Зона:** scene 04 particle shader / DEV config
**Волна:** 1

## Приёмка

- Число GPU-точек увеличено без новых draw systems или CPU simulation; low quality имеет ограничение.
- Мягкое свечение, небольшие размер/яркость акценты и исходная палитра не дают крупных пересвеченных пятен.
- Широкая трёхмерная спираль вращается по часовой стрелке, ускоряется и поднимается, оставаясь читаемой в кадре.
- DEV-панель редактирует настройки движения/яркости; runtime uniforms соответствуют конфигу на seek/replay.
- GLSL компилируется в браузере; тесты покрывают направление и ограничения траектории/яркости.

**Status:** done. Focused tests pass; full `npm run check` passes. Desktop WebGL was visually checked at t=0/6/8/12, including a DEV radius slider change and a normal playback rewind/replay. Physical iPad/Safari remains unverified.
