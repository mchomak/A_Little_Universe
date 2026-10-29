from __future__ import annotations
from io import BytesIO
from pathlib import Path
import warnings
import numpy as np
from PIL import Image, ImageCms, ImageOps


SUPPORTED = {".heic", ".heif", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}


def load_rgb(path: Path) -> np.ndarray:
    path = Path(path).expanduser()
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Input image not found: {path}")
    if path.suffix.lower() not in SUPPORTED:
        raise ValueError(f"Unsupported extension {path.suffix}; supported: {', '.join(sorted(SUPPORTED))}")
    if path.suffix.lower() in {".heic", ".heif"}:
        try:
            from pillow_heif import register_heif_opener
        except ImportError as exc:
            raise RuntimeError("HEIC support is missing: install `pip install pillow-heif`.") from exc
        register_heif_opener(thumbnails=False)
    with Image.open(path) as original:
        original.load()
        img = ImageOps.exif_transpose(original)
        icc = img.info.get("icc_profile")
        if icc:
            try:
                src = ImageCms.ImageCmsProfile(BytesIO(icc))
                dest = ImageCms.createProfile("sRGB")
                img = ImageCms.profileToProfile(img, src, dest, outputMode="RGB")
            except Exception as exc:
                warnings.warn(f"ICC conversion failed; falling back to RGB: {exc}")
                img = img.convert("RGB")
        else:
            img = img.convert("RGB")
        # Conversion normalizes decoded images to an 8-bit, standard RGB processing pipeline.
        return np.asarray(img, dtype=np.uint8).copy()


def save_rgb(path: Path, rgb: np.ndarray, **kwargs) -> None:
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(path, **kwargs)


def save_rgba(path: Path, rgba: np.ndarray) -> None:
    Image.fromarray(rgba.astype(np.uint8), "RGBA").save(path)
