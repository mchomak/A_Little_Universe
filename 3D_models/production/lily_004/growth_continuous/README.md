# Lily 004 — continuous growth study

Baseline: the previous nine-second version, copied byte-for-byte in baseline/ before work. The candidate/ GLB and editable blend retain its material and six clips. Growth changes only: sampled continuous growth of the stem tip, a time-varying curved wave, and corresponding position corrections for the bud and leaf pivots. The flower remains a single stem with two leaves; no branches have been added.

Blender sample of all 384 source intervals: the stem-tip height increases in each interval. Independent Three.js GLTFLoader sampling at 24 fps: 216/216 positive height increments, min 0.00306 m and max 0.00476 m. Growth ends at 9 s; Growth -> IdleClosed, other clip boundaries and idle loops have 0 sampled vertex delta. Other five clips matched previous version exactly at start, midpoint and end in Three.js. Khronos Validator: 0 errors, 0 warnings, 4 info. Physical iPad, continuous intersections and performance not verified.

Review: http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html?growth=flow1 — Предыдущая / Новая, clip Growth. Original final_qa files remain unchanged.