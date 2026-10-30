# Lily 004 — restored growth

The candidate is derived from final_qa/source/lily_004_final.blend and retains its materials. Its Growth clip runs 9 seconds. Growth is based on iteration_02/scripts/stage01_growth.py (delayed bud and sequential folding leaves) and stage1c_stem_and_leaves.py (travelling stem bend and attached head/leaf corrections). Only Growth tracks were retimed. Other clip durations remain 8/2/16/8/1 seconds.

- candidate/lily_004_growth9.glb — viewable candidate
- candidate/lily_004_growth9.blend — editable candidate
- baseline/lily_004_final_before_growth.glb and .blend — byte-verified pre-change copies
- restore_growth.py — reproducible authoring script; requires the two iteration_02 scripts named above and Blender 5.2.

Khronos validator: zero errors, zero warnings, four informational items. In Three.js GLTFLoader the sampled Growth end to IdleClosed start vertex delta was 0; other clip boundaries and idle loops were also 0. Original versus new non-Growth clips checked at start/middle/end had maximum deviation 0.00001855 metres. On the test page the stem was bent at 4.5 seconds and the bud visibly developed later. No physical iPad/Safari or continuous collision/performance check was performed. Previous final_qa reports describe the older baseline, not this candidate.

Test page: http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html — select Final, Growth; Original retains the earlier 16-second growth. Switch comparison uses absolute time.