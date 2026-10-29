/**
 * Minimal Three.js loader for binary asset from iris-baker.
 * This is a snippet: adapt baseURL and integrate into existing SceneDirector/Canvas.
 * DOES NOT create a second renderer or handle camera/gaze tracking.
 */
import * as THREE from 'three';

export async function loadIrisParticles(baseURL = '/assets/iris') {
  const response = await fetch(`${baseURL}/iris_particles.bin`);
  if (!response.ok) throw new Error(`Iris particles fetch failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength % 28 !== 0) throw new Error('Invalid iris_particles.bin stride');
  const buffer = new THREE.InterleavedBuffer(new Float32Array(bytes), 7);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute('aSize', new THREE.InterleavedBufferAttribute(buffer, 1, 6));

  // Simple inspection rendering. aSize is unused by PointsMaterial; write
  // ShaderMaterial for per-particle size, additive effects and transformations.
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.008,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

export async function loadIrisTexture(baseURL = '/assets/iris') {
  const tex = await new THREE.TextureLoader().loadAsync(`${baseURL}/iris_rgba.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
