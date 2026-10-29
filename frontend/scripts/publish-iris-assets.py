"""Publish only the derived run_017 assets used by the development lab."""
import hashlib
import json
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'iris-reconstruction-kit/experiments/run_017_requirements_env'
DEST = ROOT / 'frontend/dev-assets/iris/vasilisa'
FILES = ('iris_cinematic_rgba.png', 'iris_authentic_rgba.png', 'iris_confidence.png', 'iris_particles.bin')


def main():
    metadata = json.loads((SOURCE / 'iris_metadata.json').read_text(encoding='utf-8'))
    particles = metadata['particles']
    textures = metadata['textures']
    if (metadata['schemaVersion'] != 2 or particles['strideBytes'] != 28 or
        particles['format'] != 'float32 little endian' or
        particles['layout'] != ['x', 'y', 'z', 'r_linear', 'g_linear', 'b_linear', 'size']):
        raise ValueError('run_017 metadata does not match the supported particle format')
    count = particles['count']
    if (SOURCE / FILES[3]).stat().st_size != count * 28:
        raise ValueError('particle count and binary length disagree')
    dimensions = [textures['width'], textures['height']]
    hashes = {}
    for name in FILES:
        data = (SOURCE / name).read_bytes()
        if name.endswith('.png'):
            if data[:8] != b'\x89PNG\r\n\x1a\n' or list(struct.unpack('>II', data[16:24])) != dimensions:
                raise ValueError(f'{name}: unexpected PNG dimensions or format')
        hashes[name] = hashlib.sha256(data).hexdigest()
    manifest = {
        'schemaVersion': 1, 'sourceRun': 'run_017_requirements_env',
        'textureSize': dimensions, 'textureColorSpace': 'sRGB-unpremultiplied-alpha',
        'confidenceColorSpace': 'linear-data', 'pupilRatio': textures['pupilRatio'],
        'particles': {'count': count, 'format': 'float32-le', 'strideBytes': 28,
                      'layout': particles['layout'], 'coordinates': 'iris radius 1; +x right, +y up, +z forward',
                      'colorSpace': 'linear-sRGB'},
        'files': hashes,
    }
    DEST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copyfile(SOURCE / name, DEST / name)
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Published {len(FILES)} derived files and manifest to {DEST}')


if __name__ == '__main__':
    main()
