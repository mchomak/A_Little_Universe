"""Editable circular, elliptical or closed radial-spline iris/pupil boundaries.

A spline contour is star-shaped around its chosen centre: the user clicks a centre
and multiple boundary points in any order, and the interpolation passes through
all those points. In image coordinates (Y down), polar zero points right.
The output texture is still a front-facing CIRCLE via polar_remap().
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class Ellipse:
    cx: float
    cy: float
    rx: float
    ry: float
    angle_deg: float = 0.0
    control_points: tuple[tuple[float, float], ...] | None = None

    @classmethod
    def from_control_points(cls, cx: float, cy: float, points) -> 'Ellipse':
        points = tuple((float(x), float(y)) for x, y in points)
        if len(points) < 5:
            raise ValueError('Point contour needs at least five boundary points')
        coords = np.asarray(points, np.float64)
        radii = np.hypot(coords[:, 0] - cx, coords[:, 1] - cy)
        if np.min(radii) < 2:
            raise ValueError('Every boundary point must be >= 2 px from its centre')
        # Width/height retained for legacy consumers and relative pupil ratio.
        rx = max(2., (np.max(coords[:, 0]) - np.min(coords[:, 0])) * .5)
        ry = max(2., (np.max(coords[:, 1]) - np.min(coords[:, 1])) * .5)
        return cls(float(cx), float(cy), float(rx), float(ry), 0.0, points)

    def _polar_controls(self):
        p = np.asarray(self.control_points, dtype=np.float64)
        dx, dy = p[:, 0] - self.cx, p[:, 1] - self.cy
        a = np.mod(np.arctan2(dy, dx), 2 * np.pi)
        r = np.hypot(dx, dy)
        ix = np.argsort(a)
        a, r = a[ix], r[ix]
        gaps = np.diff(np.r_[a, a[0] + 2*np.pi])
        if np.min(gaps) < np.deg2rad(2):
            raise ValueError('Boundary control points must have distinct angles (>= 2 degrees apart)')
        # Very large angular gaps represent missing, NOT observed, boundaries.
        # We can interpolate there, but GUI should warn user visually.
        return a, r

    def radius_at(self, theta: np.ndarray) -> np.ndarray:
        """Closed cubic Hermite radius interpolator, wrapping seamlessly at 2*pi.

        Gradients are damped on unusually large gaps to avoid strong overshoot
        into invisible upper-eyelid sections.
        """
        if not self.control_points:
            # Solve ellipse ray intersection with its own centre.
            ca = np.cos(np.deg2rad(self.angle_deg))
            sa = np.sin(np.deg2rad(self.angle_deg))
            c, s = np.cos(theta), np.sin(theta)
            u = ca*c + sa*s
            v = -sa*c + ca*s
            return 1. / np.sqrt((u/self.rx)**2 + (v/self.ry)**2)
        a, r = self._polar_controls()
        n = len(a)
        extended_a = np.r_[a[-1] - 2*np.pi, a, a[0] + 2*np.pi]
        extended_r = np.r_[r[-1], r, r[0]]
        slope = (extended_r[2:] - extended_r[:-2]) / (extended_a[2:] - extended_a[:-2])
        query = (np.asarray(theta, dtype=np.float64) - a[0]) % (2*np.pi) + a[0]
        j = np.searchsorted(a, query, side='right') - 1
        right = (j + 1) % n
        x0 = a[j]
        x1 = np.where(j == n-1, a[0]+2*np.pi, a[right])
        h = x1 - x0
        t = (query-x0)/h
        t2, t3 = t*t, t*t*t
        radius = ((2*t3 - 3*t2 + 1)*r[j] + (t3-2*t2+t)*h*slope[j] +
                  (-2*t3 + 3*t2)*r[right] + (t3-t2)*h*slope[right])
        # Prevent cubic ringing from creating a spurious iris lobe.
        low = np.minimum(r[j], r[right]) * .96
        high = np.maximum(r[j], r[right]) * 1.04
        return np.clip(radius, low, high)

    def points(self, theta: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        if not self.control_points:
            ca = np.cos(np.deg2rad(self.angle_deg))
            sa = np.sin(np.deg2rad(self.angle_deg))
            u, v = self.rx*np.cos(theta), self.ry*np.sin(theta)
            return self.cx + ca*u-sa*v, self.cy+sa*u+ca*v
        radius = self.radius_at(theta)
        return self.cx+radius*np.cos(theta), self.cy+radius*np.sin(theta)

    def contains(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        if self.control_points:
            dx, dy = x-self.cx, y-self.cy
            theta = np.mod(np.arctan2(dy, dx), 2*np.pi)
            return np.hypot(dx, dy) <= self.radius_at(theta)
        ca, sa = np.cos(np.deg2rad(self.angle_deg)),np.sin(np.deg2rad(self.angle_deg))
        dx, dy = x-self.cx, y-self.cy
        u, v = ca*dx+sa*dy, -sa*dx+ca*dy
        return (u/self.rx)**2+(v/self.ry)**2 <= 1

    def as_dict(self) -> dict:
        d = dict(cx=self.cx,cy=self.cy,rx=self.rx,ry=self.ry,angle_deg=self.angle_deg)
        if self.control_points:
            d['control_points'] = [[float(x),float(y)] for x,y in self.control_points]
        return d

    @classmethod
    def from_dict(cls, data: dict) -> 'Ellipse':
        d = dict(data)
        if d.get('control_points'):
            d['control_points'] = tuple(tuple(map(float, p)) for p in d['control_points'])
        return cls(**d)


def validate_geometry(pupil: Ellipse, iris: Ellipse, width: int, height: int) -> None:
    for name, e in (('pupil',pupil),('iris',iris)):
        if min(e.rx,e.ry) < 2 or not (0 <= e.cx < width and 0 <= e.cy < height):
            raise ValueError(f'{name}: invalid radius/centre')
        if not all(np.isfinite(v) for v in (e.cx,e.cy,e.rx,e.ry,e.angle_deg)):
            raise ValueError(f'{name}: non-finite coordinate')
        if e.control_points:
            e._polar_controls()
    theta=np.linspace(0,2*np.pi,720,endpoint=False,dtype=np.float32)
    px,py=pupil.points(theta)
    if not np.all(iris.contains(px,py)):
        raise ValueError('Pupil boundary must lie entirely inside iris boundary.')
    ix,iy=iris.points(theta)
    if min(np.min(ix),np.min(iy)) < -2 or np.max(ix) > width+2 or np.max(iy)>height+2:
        raise ValueError('Iris boundary leaves the image. Reposition contour or crop photo.')


def polar_remap(pupil: Ellipse,iris: Ellipse,angular: int,radial: int):
    """Radial rubber-sheet: rows pupil->iris, columns angle. Front-facing output."""
    theta=np.arange(angular,dtype=np.float32)*(2*np.pi/angular)
    px,py=pupil.points(theta)
    ix,iy=iris.points(theta)
    t=np.linspace(0,1,radial,dtype=np.float32)[:,None]
    mx=(px[None,:]*(1-t)+ix[None,:]*t).astype(np.float32)
    my=(py[None,:]*(1-t)+iy[None,:]*t).astype(np.float32)
    return mx,my
