# Lily 004 — weighted tip growth

The previous version is preserved byte-for-byte in baseline/. The new nine-second Growth starts with a straighter shoot, develops a tip-only downward bend, then straightens as the bud grows. The head and leaf pivots are corrected to follow the stem. This is an authored deformation, not a physics simulation.

Khronos glTF Validator: 0 errors, 0 warnings, 4 informational notices. Three.js GLTFLoader: all 216 sampled tip-height increments at 24 fps were positive; Growth to IdleClosed and other sampled clip boundaries and idle loops show zero vertex delta. The five non-Growth clips matched the previous version in start/mid/end samples. Mid-growth the tip is slightly lower than the adjacent upper stem; it rises again toward the mature bud. Full intersection checks, physical iPad and performance remain unverified.

Preview: http://127.0.0.1:5192/3D_models/production/lily_004/scripts/viewer.html?growth=weighted2 — choose Growth and switch Предыдущая / Новая. `weighted_tip.py` reproduces the candidate from baseline/growth_tip_before.blend with Blender 5.2.