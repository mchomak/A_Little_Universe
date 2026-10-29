"""Shadow correction and conservative artistic fill of manually marked missing iris.

The synthetic region is NOT a biometric reconstruction. It is based on the
photographed visible portion and should always be identified as synthetic.
"""
from __future__ import annotations
import cv2
import numpy as np


def classify_shadow_damage(rgb, visible, shadow):
    """Flag likely occlusion, glare and non-radial structure inside shadow strokes."""
    light = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[:, :, 0].astype(np.float32)
    valid = visible >= 128
    marked = (shadow >= 128) & valid
    clean = valid & (shadow < 96)
    ref = np.array([np.median(light[r, clean[r]]) if clean[r].any() else np.median(light[r]) for r in range(len(light))], dtype=np.float32)[:, None]
    background = cv2.GaussianBlur(light, (0, 0), 8)
    radial_edge = np.abs(cv2.Sobel(light, cv2.CV_32F, 0, 1, ksize=3))
    angular_edge = np.abs(cv2.Sobel(light, cv2.CV_32F, 1, 0, ksize=3))
    cross_structure = cv2.GaussianBlur(np.maximum(radial_edge-.7*angular_edge, 0), (0, 0), 3)
    damage = marked & ((light < ref*.72) | (light > ref*1.55) | (background-light > 12) | (cross_structure > 20))
    expanded = cv2.dilate(damage.astype(np.uint8), np.ones((9, 11), np.uint8))
    return (expanded & marked).astype(np.uint8) * 255


def coherent_repair(rgb, visible, shadow, seed=42, repair_mask=None):
    """Conservatively replace marked shadow and occlusion using clean polar columns.

    Shadow is treated as potentially occluded, not claimed as recovered detail.
    A periodic, radially coherent donor field avoids stretched edge samples.
    """
    rows, cols = visible.shape
    real = visible >= 128
    shaded = (shadow >= 128) & real
    # A fractional mask sample may already contain excluded or shaded source
    # pixels through bilinear interpolation; never admit it as a donor.
    clean = (visible == 255) & (shadow == 0)
    common = clean.all(axis=0)
    doubled = np.r_[common, common]
    changes = np.diff(np.r_[False, doubled, False].astype(np.int8))
    starts, ends = np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)
    candidates = [(s, min(e-s, cols)) for s, e in zip(starts, ends) if s < cols]
    if not candidates:
        raise ValueError('No donor sector is clean across all radial bands')
    start, length = max(candidates, key=lambda item: item[1])
    if length < 8:
        raise ValueError('Clean donor sector too narrow for coherent reconstruction')
    angle = np.arange(cols, dtype=np.float32)
    phase = (2 * angle / cols + .12*np.sin(2*np.pi*angle/cols) + (seed % 360) / 360) % 1
    triangle = 1 - np.abs(2 * phase - 1)
    pos = start + 1 + (length-3) * triangle
    map_x = np.broadcast_to((pos % cols)[None, :], (rows, cols)).astype(np.float32)
    map_y = np.broadcast_to(np.arange(rows, dtype=np.float32)[:, None], (rows, cols))
    wrapped = np.concatenate([rgb, rgb[:, :1]], axis=1)
    donor = cv2.remap(wrapped, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    damaged = ~real | (shaded if repair_mask is None else ((repair_mask >= 128) & shaded))
    # Smoothstep away from damaged pixels, with a periodic angular seam.
    # Its derivative is zero at the boundary, and excluded input never leaks.
    width = max(12, cols // 28)
    extended = np.pad((~damaged).astype(np.uint8), ((0, 0), (width, width)), mode='wrap')
    if damaged.any():
        distance = cv2.distanceTransform(extended, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)[:, width:-width]
        t = np.clip(distance / width, 0, 1)
        weight = 1 - t*t*(3-2*t)
    else:
        weight = np.zeros((rows, cols), np.float32)
    result = np.clip(rgb.astype(np.float32)*(1-weight[...,None]) + donor.astype(np.float32)*weight[...,None], 0, 255).astype(np.uint8)
    confidence = np.full((rows, cols), 255, np.uint8)
    confidence[shaded] = 192
    confidence[(weight > .01) & real] = 96
    confidence[~real] = 0
    return result, confidence, weight


def radial_shadow_correction(rgb, visible, shadow, strength=.72):
    """Estimate low-frequency illumination and match clean radial luminance."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    light = lab[:, :, 0].astype(np.float32)
    marked = (shadow >= 128) & (visible >= 128)
    clean = (visible >= 160) & (shadow < 96)
    # Wrapped angular padding prevents an artificial lighting edge at 0/2pi.
    pad = max(16, rgb.shape[1] // 12)
    extended = np.pad(light, ((0, 0), (pad, pad)), mode='wrap')
    smooth = cv2.GaussianBlur(extended, (0, 0), sigmaX=max(8, rgb.shape[1]*.018), sigmaY=max(4, rgb.shape[0]*.035))[:, pad:-pad]
    ref = np.array([np.median(smooth[r, clean[r]]) if clean[r].any() else np.median(smooth[r]) for r in range(len(light))], np.float32)
    ref = cv2.GaussianBlur(ref[:, None], (1, 0), sigmaX=0, sigmaY=5)[:, 0]
    gain = np.clip((ref[:, None]+8)/(smooth+8), 1, 1.8)
    soft = cv2.GaussianBlur(marked.astype(np.float32), (0, 0), 5)
    lab[:, :, 0] = np.clip(light*(1+strength*soft*(gain-1)), 0, 255).astype(np.uint8)
    out = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    out[~marked] = rgb[~marked]
    return out


def shadow_damage_mask(rgb, visible, shadow):
    """Flag dark high-frequency losses only inside the user's shadow strokes."""
    light = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[:, :, 0].astype(np.float32)
    background = cv2.GaussianBlur(light, (0, 0), sigmaX=12, sigmaY=5)
    damage = ((light < background * .68) & (background-light > 20) &
              (shadow >= 128) & (visible >= 128)).astype(np.uint8)
    expanded = cv2.dilate(damage, np.ones((3, 3), np.uint8), iterations=1)
    return (expanded & (visible >= 128) & (shadow >= 128)).astype(np.uint8) * 255


def correct_marked_shadows(polar_rgb: np.ndarray, visible: np.ndarray,
                           shadow: np.ndarray, strength: float = 0.72,
                           max_gain: float = 1.45) -> np.ndarray:
    """Correct only marked areas; lift slowly-varying L* to radial reference.

    Color (a/b in Lab) is left unchanged. That preserves natural iris colors
    but cannot recover information destroyed by severe shadow/noise.
    """
    if not (0 <= strength <= 1):
        raise ValueError('shadow-strength must be 0..1')
    out = polar_rgb.copy()
    sel = (shadow >= 96) & (visible >= 96)
    if not sel.any() or strength <= 0:
        return out
    lab = cv2.cvtColor(polar_rgb, cv2.COLOR_RGB2LAB)
    light = lab[:, :, 0].astype(np.float32)
    # Smooth only the lighting estimate; preserve original high-frequency texture.
    sigmax = max(8, polar_rgb.shape[1] * .018)
    sigmay = max(4, polar_rgb.shape[0] * .035)
    smoothed = cv2.GaussianBlur(light, (0, 0), sigmaX=sigmax, sigmaY=sigmay,
                                borderType=cv2.BORDER_WRAP if False else cv2.BORDER_REFLECT_101)
    valid_reference = (visible >= 160) & ~sel
    row_ref = np.zeros(light.shape[0], np.float32)
    for r in range(light.shape[0]):
        v = smoothed[r][valid_reference[r]]
        row_ref[r] = np.median(v) if v.size > 12 else np.median(smoothed[r])
    row_ref = cv2.GaussianBlur(row_ref.reshape(-1, 1), (1, 0), sigmaX=0, sigmaY=7).reshape(-1)
    gain = np.clip((row_ref[:, None] + 5.0) / (smoothed + 5.0), 1.0, max_gain)
    # Soft boundary between painted shadow and normal region.
    soft = cv2.GaussianBlur(sel.astype(np.float32), (0, 0), sigmaX=5, sigmaY=3)
    corrected_light = np.clip(light * (1 + strength * soft * (gain - 1)), 0, 255)
    lab[:, :, 0] = corrected_light.astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def synthesize_missing_polar_legacy(corrected: np.ndarray, visible: np.ndarray,
                             seed: int = 42, avoid_donors: np.ndarray | None = None
                             ) -> tuple[np.ndarray, np.ndarray]:
    """Fill occluded polar pixels without EVER sampling an excluded source pixel.

    First try an approximately mirrored angle. Exclude user-marked shadow from
    donors when another trustworthy sample exists. In a narrow 2D seam strip,
    blend to the closest VALID source angularly (not the missing original).
    This avoids reintroducing eyelid skin and lashes during alpha feathering.
    """
    rows, cols = visible.shape
    real = visible >= 128
    filled = corrected.copy()
    if real.all():
        return filled, np.full((rows, cols), 255, np.uint8)
    if not np.all(real.any(axis=1)):
        raise ValueError('A radial band has no visible source pixels. Reduce mask/adjust geometry.')
    clean = real.copy()
    if avoid_donors is not None:
        clean &= avoid_donors < 96
    rng = np.random.default_rng(seed)
    angle = np.arange(cols, dtype=np.int32)
    knots = rng.normal(0, max(.4, cols/1024), 17).astype(np.float32)
    drift = np.interp(np.linspace(0,16,cols),np.arange(17),knots)
    target_angles = ((-angle) + np.rint(drift).astype(np.int32)) % cols
    seam_width = max(5, round(cols * .012))
    for r in range(rows):
        missing_idx = np.flatnonzero(~real[r])
        if not missing_idx.size:
            continue
        donor_idx = np.flatnonzero(real[r])
        clean_idx = np.flatnonzero(clean[r])
        def nearest(query, available):
            pos = np.searchsorted(available,query)
            low = available[(pos-1)%len(available)]
            high = available[pos%len(available)]
            dlo=(query-low)%cols
            dhi=(high-query)%cols
            select=dlo<=dhi
            return np.where(select, low, high), np.minimum(dlo,dhi)
        mirror_donor,_ = nearest(target_angles[missing_idx],donor_idx)
        # Prefer unshadowed source only if very close in angular position.
        # A distant clean donor would repeat the same vertical stripe for a
        # whole missing sector, destroying the radial fiber structure.
        if clean_idx.size >= max(12,cols//25):
            clean_donor,clean_distance = nearest(target_angles[missing_idx],clean_idx)
            mirror_donor = np.where(clean_distance <= max(3,round(cols*.008)),
                                    clean_donor,mirror_donor)
        neighbor_donor, distance = nearest(missing_idx,np.flatnonzero(real[r]))
        # At the true/filled boundary, match the nearby authentic texture.
        # Deep within the missing zone, use reflected source from elsewhere.
        t = np.clip(distance.astype(np.float32)/seam_width,0,1)
        t = t*t*(3-2*t)
        # A 2D seam interpolation is possible later, but this angular blend
        # is already continuous across the mask edge (without invalid input).
        left = corrected[r,neighbor_donor].astype(np.float32)
        right = corrected[r,mirror_donor].astype(np.float32)
        filled[r,missing_idx] = np.clip(left*(1-t[:,None])+right*t[:,None],0,255).astype(np.uint8)
    return filled,(real.astype(np.uint8)*255)


def synthesize_missing_polar(corrected: np.ndarray, visible: np.ndarray,
                             seed: int = 42, avoid_donors: np.ndarray | None = None
                             ) -> tuple[np.ndarray, np.ndarray]:
    """Fill from clean samples only; periodically traverse them instead of clamping.

    The result remains artistic synthesis, not recovered biometric detail.
    """
    rows, cols = visible.shape
    real = visible >= 128
    clean = real & ((avoid_donors < 96) if avoid_donors is not None else True)
    result = corrected.copy()
    common = np.flatnonzero(clean.all(axis=0))
    for r in range(rows):
        available = common if len(common) >= 2 else np.flatnonzero(clean[r])
        if not len(available):
            raise ValueError('A radial band has no clean donor pixels')
        missing = np.flatnonzero(~real[r])
        if not len(missing):
            continue
        # Traverse clean indices back and forth. No out-of-range remap and no
        # repeated boundary pixel across a whole occluded angular sector.
        phase = (missing + seed * 7) % max(1, 2 * len(available) - 2)
        index = np.where(phase < len(available), phase, 2 * len(available) - 2 - phase)
        result[r, missing] = corrected[r, available[index]]
    return result, real.astype(np.uint8) * 255
