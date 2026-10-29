import json
from pathlib import Path
import cv2
import numpy as np
from iris_baker.annotation import initial_annotation,save_annotation,load_annotation
from iris_baker.geometry import Ellipse, polar_remap,validate_geometry
from iris_baker.reconstruction import synthesize_missing_polar


def test_closed_point_contour_and_round_normalization():
    c = (120, 110)
    angles = np.arange(16)*2*np.pi/16
    r = 67*(1+.08*np.cos(3*angles))
    points = list(zip(c[0]+r*np.cos(angles),c[1]+.83*r*np.sin(angles)))
    # Shuffle input to make sure the user may click points in any order.
    points = points[::2] + points[1::2]
    outer = Ellipse.from_control_points(*c, points)
    p=Ellipse(120,110,14,12)
    validate_geometry(p,outer,280,280)
    test_angles = np.mod(np.arctan2(np.asarray(points)[:,1]-c[1],
                                    np.asarray(points)[:,0]-c[0]),2*np.pi)
    x,y = outer.points(test_angles)
    assert np.max(np.abs(x-np.asarray(points)[:,0])) < 1.e-4
    assert np.max(np.abs(y-np.asarray(points)[:,1])) < 1.e-4
    assert abs(outer.radius_at(np.array([0.0]))[0]-outer.radius_at(np.array([2*np.pi]))[0]) < 1e-6
    mx,my=polar_remap(p,outer,360,64)
    assert mx.shape==(64,360)
    assert np.isfinite(mx).all() and np.isfinite(my).all()


def test_annotations_backward_compatible_and_contour_roundtrip(tmp_path):
    a=initial_annotation((200,200),Ellipse(90,90,12,10),Ellipse(91,92,68,60))
    fn=save_annotation(tmp_path/'ann',a)
    data=json.loads(fn.read_text())
    assert data['schemaVersion']==2
    data['schemaVersion']=1
    fn.write_text(json.dumps(data))
    loaded=load_annotation(fn,(200,200))
    assert loaded.iris.control_points is None
    xx=np.linspace(0,2*np.pi,8,endpoint=False)
    loaded.iris=Ellipse.from_control_points(91,92,list(zip(91+68*np.cos(xx),92+60*np.sin(xx))))
    fn=save_annotation(tmp_path/'ann',loaded)
    reread=load_annotation(fn,(200,200))
    assert len(reread.iris.control_points)==8
    assert reread.iris.as_dict()==loaded.iris.as_dict()


def test_reconstruction_does_not_bleed_excluded_orange_skin():
    height,width=48,512
    src=np.full((height,width,3),[70,110,126],np.uint8)
    visible=np.full((height,width),255,np.uint8)
    visible[:,width//2:]=0
    # Orange-brown skin exists only inside excluded part.
    src[:,width//2:]=[240,50,15]
    out,confidence=synthesize_missing_polar(src,visible,seed=6)
    assert np.array_equal(out[:,:width//2],src[:,:width//2])
    assert (out[:,width//2:,0] < 150).all()
    assert np.all(confidence[:,width//2:]==0)
    # The first pixel after the seam is close to its valid neighbor.
    assert np.abs(out[4,256].astype(int)-out[4,255].astype(int)).max() <= 1
