# Implementation contract

Use the shared film clock for the GLB field, particle trajectory and camera. Default dissolve is about 12 seconds; particles are sampled from the animated surface and move without CPU simulation. Preserve 03/04 shared camera pose. Expose the existing entry pose and new pullback/rise/duration through scene composer. Keep quality caps and dispose GPU resources. Verify direct seeks both ways and natural playback.
