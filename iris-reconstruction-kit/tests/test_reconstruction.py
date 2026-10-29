import json
import cv2
import numpy as np
from pathlib import Path
from iris_baker.annotation import initial_annotation, save_annotation, load_annotation
from iris_baker.geometry import Ellipse
from iris_baker.reconstruction import correct_marked_shadows, synthesize_missing_polar
from iris_baker.cli import main
from examples.make_demo_eye import create


def test_reflected_fill_keeps_true_pixels():
    row, col = 48, 192
    source = np.empty((row,col,3),np.uint8)
    source[:,:,0]=np.arange(col,dtype=np.uint8)[None,:]
    source[:,:,1]=90
    source[:,:,2]=120
    real=np.full((row,col),255,np.uint8)
    real[:,col//2:]=0
    restored, confidence=synthesize_missing_polar(source,real,seed=4)
    assert np.array_equal(restored[:,:col//2],source[:,:col//2])
    assert (confidence[:,col//2:]==0).all()
    assert (confidence[:,:col//2]==255).all()
    assert np.any(restored[:,col//2:]!=source[:,col//2:])


def test_shadow_only_marked_pixels():
    src=np.full((64,128,3),155,np.uint8)
    src[:,30:60,:]=80
    visible=np.full((64,128),255,np.uint8)
    shadow=np.zeros((64,128),np.uint8)
    shadow[:,30:60]=255
    out=correct_marked_shadows(src,visible,shadow,strength=.9)
    assert out[:,40:50].mean()>src[:,40:50].mean()
    assert np.array_equal(src[:,80:],out[:,80:])


def test_masks_saved_and_reused(tmp_path):
    path=tmp_path/'demo_eye.png'
    cx,cy,pr,ir=create(path,size=500)
    ann=initial_annotation((500,500),Ellipse(cx,cy,pr,pr),Ellipse(cx,cy,ir,ir))
    ann.visible[0:250]=0
    ann.shadow[250:300]=255
    p=save_annotation(tmp_path/'labels',ann)
    loaded=load_annotation(p,(500,500))
    np.testing.assert_array_equal(loaded.visible,ann.visible)
    out=tmp_path/'result'
    assert main(['-i',str(path),'-o',str(out),'--annotation',str(p),
                 '--angular','512','--radial','128','--texture-size','512',
                 '--particles','1000'])==0
    meta=json.loads((out/'iris_metadata.json').read_text(encoding='utf-8'))
    assert meta['schemaVersion']==2
    assert meta['annotation']['visibleFractionPolar'] < 1
    assert (out/'full_eye_composite.png').exists()
    assert (out/'iris_confidence.png').exists()
    assert (out/'iris_authentic_particles.bin').stat().st_size == 1000*28
    auth=cv2.imread(str(out/'iris_authentic_rgba.png'), cv2.IMREAD_UNCHANGED)
    cine=cv2.imread(str(out/'iris_cinematic_rgba.png'), cv2.IMREAD_UNCHANGED)
    # Synthetic variant has additional non-transparent iris pixels.
    assert np.count_nonzero(cine[:,:,3]) > np.count_nonzero(auth[:,:,3])

def test_excluded_shadow_donors_never_contaminate_fill():
    source = np.full((24, 256, 3), 120, np.uint8)
    visible = np.full((24, 256), 255, np.uint8)
    visible[:, 128:] = 0
    shadow = np.zeros_like(visible)
    shadow[:, :100] = 255
    source[:, :100] = (2, 2, 2)
    result, _ = synthesize_missing_polar(source, visible, seed=42, avoid_donors=shadow)
    assert result[:, 145:245].min() >= 110

def test_fill_donor_trajectory_is_consistent_across_radial_rows():
    rows, cols = 32, 256
    source = np.tile(np.arange(cols, dtype=np.uint8)[None, :, None], (rows, 1, 3))
    visible = np.full((rows, cols), 255, np.uint8)
    visible[:, 150:] = 0
    visible[::2, 20:30] = 0
    out, _ = synthesize_missing_polar(source, visible, seed=42)
    assert np.mean(np.abs(out[0, 170:240].astype(float) - out[1, 170:240])) < 2
    assert np.std(out[:, 170:240].astype(float)) > 5

def test_damage_is_confined_to_manual_shadow_and_visible_mask():
    from iris_baker.reconstruction import shadow_damage_mask
    img = np.full((64, 128, 3), 140, np.uint8)
    img[:, 45:49] = 5
    visible = np.full((64, 128), 255, np.uint8)
    visible[:20] = 0
    shadow = np.zeros_like(visible)
    shadow[:, 30:60] = 255
    damage = shadow_damage_mask(img, visible, shadow)
    assert damage[25:55, 45:49].any()
    assert not damage[visible < 128].any()
    assert not damage[shadow < 128].any()

def test_coherent_repair_never_blends_excluded_pixels_and_wraps():
    from iris_baker.reconstruction import coherent_repair
    rows, cols = 64, 256
    x = np.arange(cols)
    source = np.tile((100 + 30*np.sin(2*np.pi*x*5/cols)).astype(np.uint8)[None,:,None], (rows,1,3))
    visible = np.full((rows, cols), 255, np.uint8)
    visible[:, 150:220] = 0
    source[:, 150:220] = 255
    shadow = np.zeros_like(visible)
    shadow[:, 120:150] = 255
    source[:, 120:150] = 0
    result, confidence, weights = coherent_repair(source, visible, shadow, seed=42)
    assert result[:,150:220].max() < 180
    assert np.all(confidence[:,150:220] == 0)
    assert np.all(weights[:,150:220] == 1)
    assert abs(result[:,0].astype(float).mean()-result[:,-1].astype(float).mean()) < 12
    assert np.abs(np.diff(result.astype(float), axis=1))[:,150:220].max() < 35

def test_coherent_synthesis_preserves_variation_in_each_angular_sector():
    from iris_baker.reconstruction import coherent_repair
    rows, cols = 32, 512
    source = np.tile(np.arange(cols, dtype=np.uint8)[None, :, None], (rows, 1, 3))
    visible = np.zeros((rows, cols), np.uint8)
    visible[:, 20:150] = 255
    shadow = np.zeros_like(visible)
    out, _, _ = coherent_repair(source, visible, shadow)
    # Broad low-variation angular stretches reveal donor-coordinate stagnation.
    segments = [out[:, x:x+32, 0].std() for x in range(160, 480, 16)]
    assert min(segments) > 2

def test_repair_weight_has_no_jump_at_exclusion_boundary():
    from iris_baker.reconstruction import coherent_repair
    source = np.full((64, 512, 3), 120, np.uint8)
    visible = np.full((64, 512), 255, np.uint8)
    visible[:, 250:350] = 0
    _, _, weight = coherent_repair(source, visible, np.zeros_like(visible))
    assert weight[:, 249].min() > .98
    assert weight[:, 350].min() > .98

def test_selective_shadow_damage_finds_dark_and_glare_without_marking_clean_pixels():
    from iris_baker.reconstruction import classify_shadow_damage
    image = np.full((64, 256, 3), 120, np.uint8)
    visible = np.full((64, 256), 255, np.uint8)
    shadow = np.zeros_like(visible)
    shadow[:, 50:180] = 255
    image[:, 75:80] = 20
    image[:, 150:155] = 240
    damage = classify_shadow_damage(image, visible, shadow)
    assert damage[:, 75:80].all() and damage[:, 150:155].all()
    assert not damage[:, 105:120].any()
    assert not damage[:, :50].any()

def test_cli_refuses_output_over_annotation_files(tmp_path):
    import hashlib
    path = tmp_path/'demo_eye.png'
    cx, cy, pr, ir = create(path, size=500)
    ann = initial_annotation((500,500), Ellipse(cx,cy,pr,pr), Ellipse(cx,cy,ir,ir))
    labels = tmp_path/'labels'
    annotation = save_annotation(labels, ann)
    names = ('annotation.json', 'visible_mask.png', 'shadow_mask.png')
    before = {n:hashlib.sha256((labels/n).read_bytes()).digest() for n in names}
    rc = main(['-i',str(path),'-o',str(labels),'--annotation',str(annotation),
               '--angular','256','--radial','64','--texture-size','256','--particles','100'])
    assert rc == 2
    assert before == {n:hashlib.sha256((labels/n).read_bytes()).digest() for n in names}

def test_coherent_donors_exclude_interpolated_mask_edges():
    from iris_baker.reconstruction import coherent_repair
    rgb = np.full((32,256,3), 100, np.uint8)
    visible = np.zeros((32,256), np.uint8)
    visible[:,20:100] = 255
    visible[:,100:180] = 200
    rgb[:,100:180] = 250
    shadow = np.zeros_like(visible)
    result, _, _ = coherent_repair(rgb, visible, shadow)
    assert result[:,180:].max() <= 105

def test_repaired_sectors_do_not_repeat_identically_half_a_turn_apart():
    from iris_baker.reconstruction import coherent_repair
    rows, cols = 32, 512
    source = np.tile(np.arange(cols, dtype=np.uint8)[None,:,None], (rows,1,3))
    visible = np.zeros((rows,cols), np.uint8)
    visible[:,20:150] = 255
    result, _, _ = coherent_repair(source, visible, np.zeros_like(visible))
    assert abs(float(result[:,190].mean()) - float(result[:,446].mean())) > 5
