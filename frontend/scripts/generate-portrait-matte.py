"""Rebuild the 04.5 alpha matte, never the photograph (Python + opencv/numpy).

Seeds describe foreground/background in this specific, unchanged 640px photo.
GrabCut finds photographic boundaries; the seeds do not define the final edge.
Run from any directory: python frontend/scripts/generate-portrait-matte.py
"""
from pathlib import Path
import hashlib
import cv2
import numpy as np

root = Path(__file__).resolve().parents[2]
source = root / "images/start_img.jpg"
assert hashlib.sha256(source.read_bytes()).hexdigest() == "befad4fd1f270558eeab25113bb169ed25479ce7b7cb3db7812fdce29124d899"
image = cv2.imread(str(source))
mask = np.full(image.shape[:2], cv2.GC_PR_BGD, np.uint8)
outline = np.array([(110, 0), (184, 0), (216, 115), (219, 201),
                    (272, 125), (421, 78), (466, 100), (477, 179),
                    (509, 268), (514, 390), (600, 419), (639, 469),
                    (639, 639), (145, 639), (161, 479), (171, 336), (133, 219)])
cv2.fillPoly(mask, [outline], cv2.GC_PR_FGD)
# Certain interior samples, away from silhouette and facial edges.
cv2.line(mask, (143, 0), (185, 248), cv2.GC_FGD, 28)
cv2.ellipse(mask, (342, 269), (100, 128), 0, 0, 360, cv2.GC_FGD, -1)
cv2.ellipse(mask, (437, 280), (22, 88), -8, 0, 360, cv2.GC_FGD, -1)
cv2.ellipse(mask, (376, 536), (130, 100), 0, 0, 360, cv2.GC_FGD, -1)
cv2.line(mask, (508, 445), (631, 565), cv2.GC_FGD, 36)
mask[:, :100] = cv2.GC_BGD
mask[:65, 220:] = cv2.GC_BGD
mask[:390, 530:] = cv2.GC_BGD
cv2.setRNGSeed(45)
cv2.grabCut(image, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 7, cv2.GC_INIT_WITH_MASK)
alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# Soft coverage retains hair wisps; final fraying is seeded per glyph on the GPU.
alpha = cv2.GaussianBlur(alpha, (0, 0), 2.2)
alpha = cv2.resize(alpha, (320, 320), interpolation=cv2.INTER_AREA)
target = root / "frontend/src/assets/start_img.matte.png"
cv2.imwrite(str(target), alpha, [cv2.IMWRITE_PNG_COMPRESSION, 9])
print(f"Wrote alpha only: {target} ({target.stat().st_size} bytes)")
