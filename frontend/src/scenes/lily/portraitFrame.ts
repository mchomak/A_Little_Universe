import { Float32BufferAttribute } from 'three'
import type { BufferGeometry } from 'three'
import type { ParticlePortraitSettings } from '../../particle-portrait-lab/config'
import { createFrameParticleGeometry } from '../gallery/frameParticles'
import type { PortraitCameraBasis } from './portraitTargets'

const PORTRAIT_FRAME_MARGIN = 0.075
const PORTRAIT_FRAME_SPACING = 0.105
const PORTRAIT_FRAME_DEPTH = -0.04

/** Reuse the gallery frame's restrained particle geometry and register it to the portrait UV plane. */
export function createLilyPortraitFrameGeometry(
  basis: PortraitCameraBasis,
  photoAspect: number,
  settings: Pick<ParticlePortraitSettings, 'scale'>,
): BufferGeometry {
  const safeAspect = Number.isFinite(photoAspect) && photoAspect > 0 ? photoAspect : 1
  const fitWidth = safeAspect <= basis.aspect ? basis.visibleHeight * safeAspect : basis.visibleWidth
  const width = fitWidth * settings.scale
  const height = width / safeAspect
  const geometry = createFrameParticleGeometry(width, height, 41, { frameIntensity: 0.8 },
    PORTRAIT_FRAME_SPACING, PORTRAIT_FRAME_MARGIN)
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal2d')
  const phases = geometry.getAttribute('phase')
  const worldPositions = new Float32Array(positions.count * 3)
  const startPositions = new Float32Array(positions.count * 3)
  const delays = new Float32Array(positions.count)

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    let nx = normals.getX(index)
    let ny = normals.getY(index)
    if (nx === 0 && ny === 0) {
      const length = Math.max(0.001, Math.hypot(x, y))
      nx = x / length
      ny = y / length
    }
    const delay = (phases.getX(index) / (Math.PI * 2))
    delays[index] = delay
    const world = project(basis, x, y, PORTRAIT_FRAME_DEPTH)
    const scatter = 0.45 + delay * 0.4
    const start = [
      world[0] + basis.right[0] * nx * scatter + basis.up[0] * ny * scatter - basis.forward[0] * 0.45,
      world[1] + basis.right[1] * nx * scatter + basis.up[1] * ny * scatter - basis.forward[1] * 0.45,
      world[2] + basis.right[2] * nx * scatter + basis.up[2] * ny * scatter - basis.forward[2] * 0.45,
    ]
    worldPositions.set(world, index * 3)
    startPositions.set(start, index * 3)
  }

  geometry.setAttribute('position', new Float32BufferAttribute(worldPositions, 3))
  geometry.setAttribute('aStartPosition', new Float32BufferAttribute(startPositions, 3))
  geometry.setAttribute('aAssemblyDelay', new Float32BufferAttribute(delays, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function project(basis: PortraitCameraBasis, x: number, y: number, depth: number): [number, number, number] {
  return [
    basis.center[0] + basis.right[0] * x + basis.up[0] * y + basis.forward[0] * depth,
    basis.center[1] + basis.right[1] * x + basis.up[1] * y + basis.forward[1] * depth,
    basis.center[2] + basis.right[2] * x + basis.up[2] * y + basis.forward[2] * depth,
  ]
}
