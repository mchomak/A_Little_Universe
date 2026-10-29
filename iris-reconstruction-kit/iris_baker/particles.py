"""Generate deterministic, texture-derived RGB linear-space particle buffers."""
from __future__ import annotations
import numpy as np
import cv2


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.asarray(c, dtype=np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055)**2.4)


def generate_particles(polar_rgb: np.ndarray, valid: np.ndarray,
                       pupil_ratio: float, amount: int, seed: int):
    """7 float32 per particle: x,y,z,r,g,b,size (RGB in LINEAR color space).

    Y points upwards in 3D. Polar tex columns increase clockwise in IMAGE space.
    """
    if amount < 100 or amount > 2_000_000:
        raise ValueError("particle count must be 100..2,000,000")
    radial, angular = polar_rgb.shape[:2]
    gray=cv2.cvtColor(polar_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)/255.0
    gx=cv2.Sobel(gray,cv2.CV_32F,1,0,ksize=3)
    gy=cv2.Sobel(gray,cv2.CV_32F,0,1,ksize=3)
    edge=np.minimum(np.sqrt(gx**2+gy**2)*0.6,1.0)
    rng=np.random.default_rng(seed)
    # More particles where photographed fibers are brighter and more structured.
    # Weighted floor keeps dark coloration represented; invalid pixels are excluded.
    weights=(0.32+0.8*gray+1.0*edge)*valid.astype(np.float32)
    # The outer rows have larger physical area per texel; incorporate radial Jacobian.
    rr=pupil_ratio+(1.0-pupil_ratio)*np.arange(radial,dtype=np.float32)/(radial-1)
    weights *= rr[:,None]
    total=float(weights.sum())
    if total < 1e-6:
        raise ValueError("No visible iris texels. Check occlusion mask and geometry.")
    indices=rng.choice(weights.size,size=amount,replace=True,p=(weights.ravel()/total))
    row=indices//angular
    col=indices%angular
    theta=(col+rng.random(amount))*2*np.pi/angular
    t=(row+rng.random(amount))/radial
    radius=pupil_ratio+(1-pupil_ratio)*t
    radius=np.minimum(radius,1.0)
    values=polar_rgb[row,col].astype(np.float32)/255.0
    lin=srgb_to_linear(values)
    x=radius*np.cos(theta)
    y=-radius*np.sin(theta)
    jitter=rng.normal(0,0.004,size=amount)
    z=(gray[row,col]-0.4)*.025+edge[row,col]*.045+jitter
    size=np.clip(0.6+gray[row,col]*1.2+edge[row,col]*0.5+rng.normal(0,.14,size=amount),0.35,2.6)
    buffer=np.stack([x,y,z,lin[:,0],lin[:,1],lin[:,2],size],axis=1).astype('<f4')
    return buffer, indices.astype(np.int32)


def make_particle_preview(buffer: np.ndarray, size: int=1024) -> np.ndarray:
    """CPU diagnostic of baked particle locations. Not a WebGL screenshot."""
    out=np.zeros((size,size,3),dtype=np.uint8)
    # Overlap blending left to browser shader; on CPU use brightest sample per pixel.
    n=min(len(buffer),90_000)
    indices=np.linspace(0,len(buffer)-1,n,dtype=np.int64)
    arr=buffer[indices]
    x=np.clip(np.rint((arr[:,0]*.46+.5)*(size-1)).astype(int),0,size-1)
    y=np.clip(np.rint((.5-arr[:,1]*.46)*(size-1)).astype(int),0,size-1)
    linear=np.clip(arr[:,3:6],0,1)
    srgb=np.where(linear<=.0031308,linear*12.92,1.055*np.power(linear,1/2.4)-.055)
    rgb=np.clip(srgb*255*1.35,0,255).astype(np.uint8)
    np.maximum.at(out,(y,x),rgb)
    # Subtle single-step halo, strictly a preview effect.
    glow=cv2.GaussianBlur(out,(0,0),sigmaX=2.2)
    return np.clip(out.astype(np.int16)+glow.astype(np.int16)//4,0,255).astype(np.uint8)
