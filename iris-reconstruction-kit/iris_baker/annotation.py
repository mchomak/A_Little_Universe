"""Persist manually reviewed geometry, occlusion and shadow strokes in source pixels.

Masks have the same dimensions as the input image AFTER --crop.
Visible mask: white=usable iris, black=occlusion. Shadow mask: white=marked shadow.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import json
import cv2
import numpy as np
from .geometry import Ellipse


@dataclass
class Annotation:
    pupil: Ellipse | None
    iris: Ellipse | None
    visible: np.ndarray
    shadow: np.ndarray


def initial_annotation(shape: tuple[int, int], pupil=None, iris=None) -> Annotation:
    h, w = shape
    return Annotation(pupil, iris, np.full((h, w), 255, np.uint8), np.zeros((h, w), np.uint8))


def save_annotation(output: Path, ann: Annotation) -> Path:
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    if ann.pupil is None or ann.iris is None:
        raise ValueError("Both contours are required before saving annotations")
    cv2.imwrite(str(output / 'visible_mask.png'), ann.visible)
    cv2.imwrite(str(output / 'shadow_mask.png'), ann.shadow)
    record = {
        'schemaVersion': 2, 'imageSize': [int(ann.visible.shape[1]), int(ann.visible.shape[0])],
        'pupil': ann.pupil.as_dict(), 'iris': ann.iris.as_dict(),
        'visibleMask': 'visible_mask.png', 'shadowMask': 'shadow_mask.png',
        'maskMeaning': 'visible=255 means photograph usable, shadow=255 means illumination correction suggested',
    }
    target = output / 'annotation.json'
    target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return target


def load_annotation(path: Path, shape: tuple[int, int]) -> Annotation:
    path = Path(path)
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('schemaVersion') not in (1, 2) or data.get('imageSize') != [shape[1], shape[0]]:
        raise ValueError('Annotation dimensions/version mismatch (must use SAME input and --crop).')
    masks = []
    for key in ('visibleMask', 'shadowMask'):
        # Deliberately reject absolute / parent-directory relative references.
        filename = Path(data[key])
        if filename.is_absolute() or '..' in filename.parts:
            raise ValueError(f'Invalid mask path in annotation: {filename}')
        mask = cv2.imread(str(path.parent / filename), cv2.IMREAD_GRAYSCALE)
        if mask is None or mask.shape != shape:
            raise ValueError(f'Invalid {key}: expected image dimensions {shape}')
        masks.append(mask)
    return Annotation(Ellipse.from_dict(data['pupil']), Ellipse.from_dict(data['iris']), *masks)
