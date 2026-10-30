# Lily 004 — earlier stamens in Bloom

The prior weighted-tip growth version is preserved byte-for-byte in baseline/. In the candidate, only the Bloom scale animation of Flower_Interior changed: it starts enlarging around 3 s, reaches 30% at 6 s and 100% around 9.54 s. Previous timing was around 6.2 s, 9.54 s and 13.29 s respectively. Growth remains 9 s and Bloom remains 16 s. No physical stamens were replaced.

Khronos glTF Validator: 0 errors, 0 warnings and 4 info. Three.js GLTFLoader: all checked clip boundaries and idle loops have zero sampled vertex jump; Growth, IdleClosed, TouchResponse, IdleOpen and DissolveReady match the previous version at start/middle/end. Blender BVH checks at 3, 4, 5, 6, 8, 10 and 12 s found no petal/stamen surface overlap outside a 2.5 cm basal zone. This is a sampled test and not proof of no near contacts or collisions between samples. iPad performance remains unverified.

Preview: http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html?bloom=early1 — choose Bloom and switch Предыдущая / Новая. Reproduce from baseline/before_interior.blend using early_interior.py and Blender 5.2.