"""2D compositing preview + static photograph-based foreground layers.

These exports are references for a future Three.js eyeball mesh, NOT a rigged
3D eye. The photographic occluder is stationary and cannot rotate with gaze.
"""
from __future__ import annotations
import numpy as np
import cv2
from .geometry import Ellipse


def generate_eye_layers(rgb: np.ndarray, iris: Ellipse, pupil: Ellipse,
                        visible: np.ndarray, shadow: np.ndarray,
                        cinematic_polar: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w = rgb.shape[:2]
    yy, xx = np.indices((h, w), dtype=np.float32)
    dx, dy = xx - iris.cx, yy - iris.cy
    theta = np.mod(np.arctan2(dy,dx),2*np.pi)
    outer_radius = iris.radius_at(theta)
    radius = np.hypot(dx,dy) / np.maximum(outer_radius,1)
    # Still only an approximate photo composite; WebGL must use the native iris atlas.
    angles = np.linspace(0,2*np.pi,360,endpoint=False,dtype=np.float32)
    inner_r = np.mean(pupil.radius_at(angles))
    outer_r = np.mean(iris.radius_at(angles))
    pr = float(np.clip(inner_r/max(2.,outer_r),.04,.85))
    columns = cinematic_polar.shape[1]
    rows = cinematic_polar.shape[0]
    tx = theta * columns / (2 * np.pi)
    ty = ((radius - pr) / (1 - pr)) * (rows - 1)
    wrapped = np.concatenate([cinematic_polar, cinematic_polar[:, :1]], axis=1)
    fill = cv2.remap(wrapped, tx.astype(np.float32), ty.astype(np.float32), cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)
    iris_ring = iris.contains(xx,yy) & ~pupil.contains(xx,yy)
    visible_ring = iris_ring & (visible > 127)
    visible_disk = iris.contains(xx,yy) & (visible > 127)
    # The wide view must remain photographic: never replace its whole iris with a
    # non-concentric inverse warp, which can double edges and the original pupil.
    # Gently replace ONLY pixels user explicitly selected as shaded.
    composite = rgb.astype(np.float32).copy()
    shadow_weight = cv2.GaussianBlur(((shadow > 127) & visible_ring).astype(np.float32),
                                     (0, 0), sigmaX=6) * .65
    composite = np.clip(composite * (1 - shadow_weight[:,:,None]) +
                        fill.astype(np.float32) * shadow_weight[:,:,None], 0, 255).astype(np.uint8)
    # Source RGB outside iris and source occluders inside can be overlaid in WebGL.
    foreground = np.dstack([rgb.copy(), np.where(visible_disk, 0, 255).astype(np.uint8)])
    # Separate source eye with circle cut out. Under this cutout future 3D eyeball can rotate.
    # Foreground is photo-aligned, not a rigged 3D sclera model.
    return composite, foreground
