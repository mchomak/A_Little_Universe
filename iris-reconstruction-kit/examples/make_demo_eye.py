"""Generate a purely synthetic eye close-up used ONLY to test the pipeline."""
from pathlib import Path
import numpy as np
from PIL import Image


def create(path: Path, size=900, seed=10):
    rng=np.random.default_rng(seed)
    y,x=np.mgrid[:size,:size].astype(np.float32)
    cx=cy=size/2
    dx=x-cx;dy=y-cy
    rr=np.hypot(dx,dy)
    angle=np.arctan2(dy,dx)
    pupil_r=size*.105; iris_r=size*.32
    arr=np.empty((size,size,3),dtype=np.float32)
    arr[:]=[177,192,197]
    # slightly tinted artificial 'sclera'
    arr+=(rng.normal(0,2,(size,size,1))).astype(np.float32)
    mask=(rr<=iris_r)
    # Individual fiber-like streaks in angle, with radial variations.
    fibers=(np.sin(angle*104 + rr*.13)+np.sin(angle*183+rr*.047))*.5
    fibers+=.5*np.sin(angle*330+rr*.022)
    iris_base=np.stack([45+15*fibers,103+36*fibers,157+41*fibers],axis=-1)
    collarette=np.exp(-((rr/(size*.19)-1)**2)/.035)
    iris_base+=collarette[:,:,None]*np.array([35,15,-6])
    # darker outer limbic circle
    limbal=np.clip((iris_r-rr)/(size*.018),0,1)
    iris_base*= (.46+.54*limbal[:,:,None])
    arr[mask]=iris_base[mask]
    arr[rr<=pupil_r]=[2,7,13]
    Image.fromarray(np.clip(arr,0,255).astype('uint8'),'RGB').save(path)
    return cx,cy,pupil_r,iris_r


if __name__=='__main__':
    path=Path(__file__).resolve().parent/'demo_eye.png'
    result=create(path)
    print(path)
    print('Manual circles: --pupil %.1f %.1f %.1f --iris %.1f %.1f %.1f' % (result[0],result[1],result[2],result[0],result[1],result[3]))
