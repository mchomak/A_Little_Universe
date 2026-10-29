"""Offline v1.3 baking: authentic/cinematic iris and static full-eye photo layers."""
from __future__ import annotations
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw
from .geometry import Ellipse, validate_geometry, polar_remap
from .image_io import load_rgb, save_rgb, save_rgba
from .particles import generate_particles, make_particle_preview
from .annotation import Annotation, save_annotation
from .reconstruction import (correct_marked_shadows, synthesize_missing_polar,
    synthesize_missing_polar_legacy, radial_shadow_correction, shadow_damage_mask, coherent_repair, classify_shadow_damage)
from .eye_layers import generate_eye_layers


def _u8(arr):
    return np.clip(arr, 0, 255).astype(np.uint8)


def square_atlas(polar: np.ndarray, ratio: float, side: int,
                 interpolation=cv2.INTER_LINEAR) -> tuple[np.ndarray, np.ndarray]:
    """Wrap angular polar atlas onto normalized centered disk (pupil remains hole)."""
    rows, cols = polar.shape[:2]
    coords = (np.arange(side, dtype=np.float32) + .5 - side/2) / (side * .47)
    xx, yy = np.meshgrid(coords, coords)
    rr = np.hypot(xx, yy)
    angle = np.mod(np.arctan2(yy, xx), 2*np.pi)
    mx = angle * cols / (2*np.pi)
    my = (rr - ratio)/(1-ratio)*(rows-1)
    wrapped = np.concatenate([polar, polar[:, :1]], axis=1)
    square = cv2.remap(wrapped, mx.astype(np.float32), my.astype(np.float32),
                       interpolation, borderMode=cv2.BORDER_CONSTANT)
    edge = np.clip((1 - rr) * side * .06, 0, 1) * np.clip((rr-ratio) * side * .06, 0, 1)
    return square, edge


def _rgba_from_atlas(polar: np.ndarray, polar_alpha: np.ndarray, ratio: float,
                     side: int) -> np.ndarray:
    square, edge = square_atlas(polar, ratio, side)
    alpha, _ = square_atlas(polar_alpha, ratio, side)
    return np.dstack([square, _u8(alpha * edge)])


def _make_sheet(output: Path):
    names = [
        ('segmentation_overlay.png', '1. Contours / photo'),
        ('annotation_preview.png', '2. Excluded(red) + shadow(blue)'),
        ('iris_authentic_preview.png', '3. Visible real iris'),
        ('iris_cinematic_preview.png', '4. Cinematic reconstructed iris'),
        ('full_eye_composite.png', '5. Full eye photo composite'),
        ('particles_preview.png', '6. Cinematic particles'),
    ]
    sheet = Image.new('RGB', (1200, 1620), (7, 11, 23))
    draw = ImageDraw.Draw(sheet)
    for k, (name, label) in enumerate(names):
        with Image.open(output / name) as src:
            img = src.convert('RGB')
            img.thumbnail((560, 476), Image.Resampling.LANCZOS)
        x = (k % 2) * 600 + (600 - img.width) // 2
        y = (k // 2) * 540 + 48 + (478 - img.height)//2
        sheet.paste(img, (x, y))
        draw.text(((k % 2)*600 + 14, (k // 2)*540 + 17), label, fill=(232, 244, 255))
    sheet.save(output / 'contact_sheet.jpg', quality=91)


def bake(image_path: Path, output: Path, pupil: Ellipse, iris: Ellipse,
         crop: tuple[int,int,int,int] | None, angular: int, radial: int,
         texture_size: int, particle_count: int, seed: int,
         geometry_method: str, occlusion_mask: Path | None = None,
         shadow_mask: Path | None = None, annotation: Annotation | None = None,
         shadow_strength: float = .72, reconstruction_mode: str = 'legacy') -> dict:
    rgb = load_rgb(image_path)
    full_h, full_w = rgb.shape[:2]
    if crop is not None:
        x, y, w, h = crop
        if min(x, y) < 0 or min(w, h) < 1 or x+w > full_w or y+h > full_h:
            raise ValueError('--crop must be within oriented original photo')
        rgb = rgb[y:y+h, x:x+w].copy()
    h, w = rgb.shape[:2]
    validate_geometry(pupil, iris, w, h)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    save_rgb(output/'input_srgb.png', rgb)
    ann = annotation or Annotation(pupil, iris, np.full((h, w), 255, np.uint8),
                                   np.zeros((h, w), np.uint8))
    if ann.visible.shape != (h, w) or ann.shadow.shape != (h, w):
        raise ValueError('Annotation masks must have processed image dimensions')
    ann.pupil, ann.iris = pupil, iris

    # Legacy/external mask: AND with editor mask, 255 = visible.
    if occlusion_mask:
        ext = cv2.cvtColor(load_rgb(occlusion_mask), cv2.COLOR_RGB2GRAY)
        if ext.shape != (h, w):
            raise ValueError('--occlusion-mask size must match processed photo')
        ann.visible = np.minimum(ann.visible, ext)
    if shadow_mask:
        ext = cv2.cvtColor(load_rgb(shadow_mask), cv2.COLOR_RGB2GRAY)
        if ext.shape != (h, w):
            raise ValueError('--shadow-mask size must match processed photo')
        ann.shadow = np.maximum(ann.shadow, ext)
    annotation_file = save_annotation(output, ann)
    preview = rgb.copy()
    excluded = ann.visible < 128
    shaded = (ann.shadow > 128) & ~excluded
    preview[excluded] = _u8(preview[excluded].astype(float)*.55 + np.array([220, 30, 45])*.45)
    preview[shaded] = _u8(preview[shaded].astype(float)*.7 + np.array([20, 145, 220])*.3)
    save_rgb(output/'annotation_preview.png', preview)

    overlay = rgb.copy()
    for e, color in ((iris,(255,193,64)), (pupil,(70,190,255))):
        theta = np.linspace(0,2*np.pi,500,endpoint=False,dtype=np.float32)
        sx,sy = e.points(theta)
        pts = np.stack([sx,sy],axis=1).astype(np.int32)
        cv2.polylines(overlay,[pts],True,color,max(2,round(max(w,h)/650)),cv2.LINE_AA)
    if max(w,h) > 1500:
        scale = 1500/max(w,h)
        overlay = cv2.resize(overlay,(round(w*scale),round(h*scale)),interpolation=cv2.INTER_AREA)
    save_rgb(output/'segmentation_overlay.png', overlay)

    mx, my = polar_remap(pupil, iris, angular, radial)
    photographed = cv2.remap(rgb,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    visible_polar = cv2.remap(ann.visible,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    shadow_polar = cv2.remap(ann.shadow,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    save_rgb(output/'iris_unwrapped.png', photographed)
    cv2.imwrite(str(output/'unwrapped_visibility.png'),visible_polar)
    cv2.imwrite(str(output/'unwrapped_shadow_mask.png'),shadow_polar)
    correction = correct_marked_shadows if reconstruction_mode == 'legacy' else radial_shadow_correction
    corrected = correction(photographed,visible_polar,shadow_polar,strength=shadow_strength)
    save_rgb(output/'iris_corrected_unwrapped.png',corrected)
    damage = shadow_damage_mask(photographed,visible_polar,shadow_polar) if reconstruction_mode in ('damage','blend') else np.zeros_like(visible_polar)
    if reconstruction_mode == 'coherent':
        damage = ((visible_polar >= 128) & (shadow_polar >= 128)).astype(np.uint8)*255
    if reconstruction_mode == 'selective':
        damage = classify_shadow_damage(photographed, visible_polar, shadow_polar)
    cv2.imwrite(str(output/'unwrapped_damage_mask.png'),damage)
    repair_visible = np.where(damage > 0, 0, visible_polar).astype(np.uint8)
    synth = synthesize_missing_polar if reconstruction_mode == 'blend' else synthesize_missing_polar_legacy
    if reconstruction_mode in ('coherent', 'selective'):
        cinematic, confidence, weight = coherent_repair(corrected, visible_polar, shadow_polar, seed, repair_mask=damage)
        cv2.imwrite(str(output/'unwrapped_synthetic_weight.png'), _u8(weight*255))
    else:
        cinematic, confidence = synth(corrected,repair_visible,seed,avoid_donors=shadow_polar)
    if reconstruction_mode not in ('legacy', 'coherent', 'selective'):
        confidence[(shadow_polar >= 128) & (visible_polar >= 128)] = 192
        confidence[damage > 0] = 96
    save_rgb(output/'iris_cinematic_unwrapped.png',cinematic)
    cv2.imwrite(str(output/'iris_confidence_unwrapped.png'),confidence)
    # Authentic export retains photographed detail; cinematic may synthesize marked defects.
    th = np.linspace(0,2*np.pi,720,endpoint=False,dtype=np.float32)
    ix,iy=iris.points(th)
    px,py=pupil.points(th)
    outer_rad = np.mean(np.hypot(ix-iris.cx,iy-iris.cy))
    inner_rad = np.mean(np.hypot(px-pupil.cx,py-pupil.cy))
    ratio=float(np.clip(inner_rad/max(2,outer_rad),.04,.85))
    auth_rgba = _rgba_from_atlas(corrected,visible_polar,ratio,texture_size)
    cinema_rgba = _rgba_from_atlas(cinematic,np.full_like(visible_polar,255),ratio,texture_size)
    confidence_rgba,_ = square_atlas(confidence,ratio,texture_size)
    save_rgba(output/'iris_authentic_rgba.png',auth_rgba)
    save_rgba(output/'iris_cinematic_rgba.png',cinema_rgba)
    save_rgba(output/'iris_rgba.png',cinema_rgba)  # backward compatible artistic alias
    cv2.imwrite(str(output/'iris_confidence.png'), confidence_rgba)
    for name, rgba in [('iris_authentic_preview.png',auth_rgba),('iris_cinematic_preview.png',cinema_rgba)]:
        black = (rgba[:,:,:3].astype(float)*(rgba[:,:,3,None].astype(float)/255)).astype(np.uint8)
        save_rgb(output/name,black)
    save_rgb(output/'iris_render_preview.png',cinema_rgba[:,:,:3] * (cinema_rgba[:,:,3,None]>0))

    full_composite, foreground = generate_eye_layers(rgb,iris,pupil,ann.visible,ann.shadow,cinematic)
    save_rgb(output/'full_eye_composite.png',full_composite)
    save_rgba(output/'full_eye_foreground_rgba.png',foreground)
    save_rgb(output/'full_eye_original.png',rgb)

    # Validity tracks source origin to prevent user-marked occlusion contaminating real particles.
    def particles_from(atlas: np.ndarray, valid: np.ndarray):
        # Ignore particularly bright near-neutral glints; may be glare.
        hi=np.max(atlas,axis=2)
        lo=np.min(atlas,axis=2)
        glare = (hi > 246) & ((hi-lo) < 25)
        usable = valid & ~glare
        return generate_particles(atlas,usable,ratio,particle_count,seed)
    buffer, indices = particles_from(cinematic,np.full_like(confidence,True,dtype=bool))
    authentic_buffer, a_indices = particles_from(corrected, visible_polar>127)
    (output/'iris_particles.bin').write_bytes(buffer.tobytes(order='C'))
    (output/'iris_authentic_particles.bin').write_bytes(authentic_buffer.tobytes(order='C'))
    np.savez_compressed(output/'iris_particles.npz',xyz=buffer[:,:3],rgb_linear=buffer[:,3:6],
                        size=buffer[:,6],polar_pixel_indices=indices)
    np.savez_compressed(output/'iris_authentic_particles.npz',xyz=authentic_buffer[:,:3],
                        rgb_linear=authentic_buffer[:,3:6],size=authentic_buffer[:,6],
                        polar_pixel_indices=a_indices)
    save_rgb(output/'particles_preview.png',make_particle_preview(buffer,texture_size))

    real_ratio = float(np.mean(visible_polar>=128))
    data={
        'schemaVersion':2,'generator':'Iris Reconstruction Kit 1.3 + experimental modes',
        'source': {'filename':str(Path(image_path).name),'width':full_w,'height':full_h,
                   'processedWidth':w,'processedHeight':h,'cropXYWH':list(crop) if crop else None,
                   'colorSpace':'8-bit sRGB after ICC conversion if possible'},
        'geometry': {'selectionMethod':geometry_method,'pupil':pupil.as_dict(),'iris':iris.as_dict(),
                     'coordinateSystem':'Processed photo pixel coords; top-left origin'},
        'annotation': {'file':annotation_file.name,'visibleFractionPolar':round(real_ratio,5),
                       'reconstructionMode':reconstruction_mode,
                       'manuallyExcludedFraction':round(1-real_ratio,5),
                       'shadowStrength':float(shadow_strength),'sourceVisibleMask':'visible_mask.png',
                       'sourceShadowMask':'shadow_mask.png'},
        'textures': {'real':'iris_authentic_rgba.png',
                     'cinematic':'iris_cinematic_rgba.png','cinematicLegacyAlias':'iris_rgba.png',
                     'synthesizedAreasShownBlackIn':'iris_confidence.png',
                     'unwrappedSource':'iris_unwrapped.png','unwrappedCinematic':'iris_cinematic_unwrapped.png',
                     'confidenceCodes': {'255':'photographed', '192':'photometrically corrected', '96':'contains synthetic contribution', '0':'synthetic excluded area'},
                     'width':texture_size,'height':texture_size,
                     'pupilRatio':ratio,'colorspace':'sRGB; unpremultiplied alpha'},
        'fullEye': {'staticComposite':'full_eye_composite.png',
                    'photoForeground':'full_eye_foreground_rgba.png',
                    'original':'full_eye_original.png',
                    'warning':'Static photograph-aligned layers; not a rigged 3D eyeball or movable eyelids.'},
        'particles': {'cinematic':'iris_particles.bin','authentic':'iris_authentic_particles.bin',
                      'count':int(particle_count),'countEach':int(particle_count),'format':'float32 little endian',
                      'strideBytes':28,'layout':['x','y','z','r_linear','g_linear','b_linear','size'],
                      'colorSpace':'linear-sRGB','normalizedCoordinates':'iris outer radius=1; +Y up',
                      'randomSeed':seed},
        'warnings': [
            'Reconstructed/hidden regions are synthetic; not an authentic iris biometric record.',
            'The authentic output contains only manually accepted visible pixels; shadow correction changes their brightness.',
            'Manual contours and masks must be checked. User-marked shadows and exclusions are not inferred automatically.',
            'Mirroring may create artificial repetition; artistic quality requires review.',
            'Full-eye layered preview is photographic and static, not a final animated eye.',
            'This package does not track gaze, identify people, or generate a real 3D eye mesh.'
        ],
    }
    (output/'iris_metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    _make_sheet(output)
    return data
