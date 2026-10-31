# Требования

Источник: `2026-10-31-brief.md`.

| ID | Из брифа (дословно) | Статус | Где |
|---|---|---|---|
| R01 | «Увеличь количество частиц, чтобы поток стал визуально плотнее и насыщеннее.» | done | 48k default, one GPU points draw; low quality caps at 12k |
| R02 | «Усиль мягкое свечение частиц через существующий bloom/emissive-механизм.» | done | Shader soft core/halo and controlled brightness; GLB edge emissive retained |
| R03 | «Сохрани жемчужно-белую, нежно-розовую и приглушённую золотистую палитру.» | done | Existing shader palette preserved |
| R04 | «Увеличь радиус вращения частиц вокруг вертикальной оси, чтобы образовалась широкая объёмная восходящая спираль.» | done | Wider orbit, rising expansion, source-radius-safe cap; desktop screenshots at 6–8s |
| R05 | «Частицы должны закручиваться **по часовой стрелке при взгляде с основной камеры**.» | done | Projected direction and actual shader turn sign are tested |
| R06 | «Когда лепестки растворились примерно на **50%**, одновременно запускается постепенный распад тычинок, пыльников и пестика.» | done | Actual Anther/Filament/Pistil materials enter phase 1 at default 50% |
| R07 | «Стебель и листья растворяются последними, с плавным перекрытием фаз.» | done | Height-based phase 2 remains last, with shared soft dissolve field |
| R08 | «Радиус вихря и степень расширения вверх.» | done | DEV controls for radius and expansion drive shader uniforms |
| R09 | «Начальная скорость вращения и ускорение.» | done | DEV speed and acceleration controls drive the shader |
| R10 | «Сохрани текущую продолжительность растворения — около 12 секунд.» | done | Default and live DEV inspector remain at 12 seconds |
| R11 | «Не меняй существующую постановку камеры и переход 03→04.» | done | Camera/transition code untouched; scene entry continuity retained |
| R12 | «Обеспечь корректную перемотку DEV timeline и повторное воспроизведение.» | done | Absolute-time shader, seek/reverse seeks and normal replay verified |

Остальные пункты брифа покрыты §1–§5 спецификации; список контрольных ограничений остаётся в исходном brief. `npm run check` passed (316 tests, lint, strict TypeScript, production build). Desktop WebGL timeline/replay checks passed with zero console errors. Physical iPad performance remains unverified.
