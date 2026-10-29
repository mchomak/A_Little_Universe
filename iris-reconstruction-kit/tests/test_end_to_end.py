import json
from pathlib import Path
import numpy as np
from iris_baker.cli import main
from examples.make_demo_eye import create


def test_pipeline(tmp_path):
    path=tmp_path/'demo.png'
    cx,cy,pr,ir=create(path,size=500)
    output=tmp_path/'out'
    args=['-i',str(path),'-o',str(output), '--pupil',str(cx),str(cy),str(pr),
          '--iris',str(cx),str(cy),str(ir),'--angular','512','--radial','128',
          '--texture-size','512','--particles','2000']
    assert main(args)==0
    meta=json.loads((output/'iris_metadata.json').read_text(encoding='utf-8'))
    assert meta['particles']['count']==2000
    assert (output/'iris_particles.bin').stat().st_size==2000*28
    buf=np.fromfile(output/'iris_particles.bin',dtype='<f4').reshape((-1,7))
    assert np.isfinite(buf).all()
    assert np.max(np.hypot(buf[:,0],buf[:,1])) <=1.01
    for name in ('contact_sheet.jpg','segmentation_overlay.png','iris_rgba.png','iris_unwrapped.png','iris_particles.npz','iris_render_preview.png'):
        assert (output/name).exists()


def test_automatic_on_synthetic(tmp_path):
    from iris_baker.detection import propose_circles
    from iris_baker.image_io import load_rgb
    path=tmp_path/'demo.png'
    cx,cy,pr,ir=create(path,size=600)
    pupil,iris=propose_circles(load_rgb(path))
    assert abs(pupil.cx-cx)<10
    assert abs(pupil.cy-cy)<10
    assert abs(pupil.rx-pr)<10
    assert abs(iris.rx-ir)<12
