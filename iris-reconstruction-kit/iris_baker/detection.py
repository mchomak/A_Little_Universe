"""Conservative circle proposals. No claims of biometric-grade segmentation.

Hough finds candidates; a dark pupil score and a concentric outer ring score
filter the output. All unreviewed results must remain marked 'automatic'.
"""
from __future__ import annotations
import cv2
import numpy as np
from .geometry import Ellipse


def _sample_ring(gray: np.ndarray, x: float, y: float, r: float, n=160):
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
    xs = np.clip(np.rint(x + r * np.cos(angles)).astype(int), 0, gray.shape[1]-1)
    ys = np.clip(np.rint(y + r * np.sin(angles)).astype(int), 0, gray.shape[0]-1)
    return gray[ys, xs]


def propose_circles(rgb: np.ndarray) -> tuple[Ellipse, Ellipse]:
    """Attempts automatic pupil/iris localization on photos cropped to a SINGLE eye.

    Raises if no credible proposal is found. Automatic boundaries must be reviewed.
    """
    h0, w0 = rgb.shape[:2]
    scale = min(1.0, 900 / max(h0, w0))
    w, h = max(1, round(w0*scale)), max(1, round(h0*scale))
    small = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA) if scale < 1 else rgb
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    gray = cv2.createCLAHE(clipLimit=2, tileGridSize=(8,8)).apply(gray)
    smooth = cv2.medianBlur(gray, 7)
    short = min(h, w)
    p_min = max(5, int(short*.025))
    p_max = max(p_min + 3, int(short*.22))
    candidates = []
    # Dark connected-component candidates: robust when an actual pupil is too
    # uniform for the Hough edge detector (e.g. dark central disk).
    src_gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    for threshold in (20, 30, 42, 55):
        binary = (src_gray < threshold).astype(np.uint8)
        count, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, 8)
        for k in range(1, count):
            x0,y0,ww,hh,area = map(int, stats[k])
            if min(ww,hh) < p_min*1.2 or x0 < 2 or y0 < 2 or x0+ww >= w-2 or y0+hh >= h-2:
                continue
            radius = np.sqrt(area/np.pi)
            aspect = max(ww,hh)/max(1,min(ww,hh))
            fill = area/max(1,ww*hh)
            if p_min <= radius <= p_max and aspect < 1.7 and fill > 0.48:
                cx,cy = centroids[k]
                candidates.append([float(cx),float(cy),float(radius)])
    for threshold in (26, 20):
        res = cv2.HoughCircles(smooth, cv2.HOUGH_GRADIENT, dp=1.3,
                              minDist=max(20, short*.12), param1=110,
                              param2=threshold, minRadius=p_min, maxRadius=p_max)
        if res is not None:
            candidates.extend(res[0].tolist())
    # Darkness is measured on the original image, not CLAHE-enhanced pixels.
    scores=[]
    full_gray = cv2.cvtColor(small,cv2.COLOR_RGB2GRAY)
    for x, y, r in candidates:
        if x-r < 1 or x+r >= w-1 or y-r < 1 or y+r >= h-1:
            continue
        # Restrict score to a local patch; avoid creating large masks per candidate.
        a,b = max(0,int(y-r)), min(h,int(y+r+1))
        c,d = max(0,int(x-r)), min(w,int(x+r+1))
        patch = small[a:b,c:d]
        subgray = cv2.cvtColor(patch, cv2.COLOR_RGB2GRAY)
        cy,cx = np.ogrid[a:b,c:d]
        inside = (cx-x)**2+(cy-y)**2 < (.7*r)**2
        if not np.any(inside):
            continue
        center_darkness = float(np.mean(subgray[inside]))
        surrounding = _sample_ring(full_gray, x,y,r*1.35)
        contrast = float(np.mean(surrounding))-center_darkness
        center_penalty = np.hypot(x-w/2,y-h/2)/max(w,h)
        score = contrast*.9 - center_darkness*.9 - 24*center_penalty
        candidates_score = (score, x, y, r)
        scores.append(candidates_score)
    if not scores:
        raise ValueError("No pupil circle found automatically. Use --interactive or --pupil/--iris.")
    scores.sort(reverse=True)
    _, px, py, pr = scores[0]
    # Find limbus by radial color and edge transitions centered near selected pupil.
    rgb_smooth = cv2.GaussianBlur(small, (5,5), 0)
    g = cv2.cvtColor(rgb_smooth, cv2.COLOR_RGB2GRAY)
    rmin = max(pr*1.65, pr+7)
    rmax = min(short*.49, max(pr*5.0, rmin+7), px-2, py-2, w-px-3, h-py-3)
    if rmax <= rmin+4:
        raise ValueError("Insufficient space around pupil to estimate iris; use manual settings.")
    radius_vals = np.linspace(rmin, rmax, 110)
    curve = np.array([np.mean(_sample_ring(g, px, py, r)) for r in radius_vals])
    curve_smooth = np.convolve(curve, np.ones(7)/7, mode="same")
    # Limbus can brighten OR darken relative to iris; use the strongest edge.
    changes = np.abs(curve_smooth[:-3]-curve_smooth[3:])
    changes[:5]=0
    changes[-5:]=0
    index=int(np.argmax(changes))
    radius=float(radius_vals[index+1])
    if changes[index] < 1.5:
        raise ValueError("No reliable outer iris boundary found. Try --interactive.")
    inv = 1.0/scale
    pupil = Ellipse(px*inv,py*inv,pr*inv,pr*inv)
    iris = Ellipse(px*inv,py*inv,radius*inv,radius*inv)
    return pupil, iris
