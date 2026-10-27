import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Vector3, type Camera, type ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { getPrologueFrames, getPrologueParticleOpacity } from '../engine/filmConfig'
import { useSceneAnimation } from './shared/animation'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { loadArtFont } from '../systems/scene-config/fontCatalog'

const particleVertexShader = `
attribute vec3 aVelocity;
attribute float aReturning;
attribute float aSize;
attribute vec3 aTint;
uniform float uProgress;
uniform float uSpeed;
uniform float uSpread;
uniform float uGlow;
uniform float uOpacity;
uniform vec3 uReturnPoint;
varying float vAlpha;
varying vec3 vTint;
void main() {
  float progress = clamp(uProgress, 0.0, 1.0);
  float eased = progress * progress * (3.0 - 2.0 * progress);
  vec3 scattered = position + aVelocity * uSpeed * uSpread * progress;
  vec3 particle = mix(scattered, uReturnPoint, eased * aReturning);
  vec4 viewPosition = modelViewMatrix * vec4(particle, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = (2.2 + aSize * 2.2 + uGlow * 1.2) * (5.6 / max(1.0, -viewPosition.z));
  vAlpha = (0.58 + aSize * 0.3) * uOpacity;
  vTint = aTint;
}`

const particleFragmentShader = `
varying float vAlpha;
varying vec3 vTint;
void main() {
  float radius = length(gl_PointCoord - 0.5) * 2.0;
  float softness = exp(-radius * radius * 4.8) * (1.0 - smoothstep(0.28, 1.0, radius));
  float alpha = softness * vAlpha;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vTint, alpha);
  #include <colorspace_fragment>
}`

/** Returns CSS-pixel centers selected only from nontransparent glyph-mask pixels. */
// eslint-disable-next-line react-refresh/only-export-components -- exported as the deterministic renderer test seam.
export function sampleGlyphParticlePixels(alpha: Uint8Array, width: number, height: number, count: number, seed: number): Float32Array {
  const particleCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  const positions = new Float32Array(particleCount * 2)
  const candidates: number[] = []
  const pixelCount = Math.min(alpha.length, Math.max(0, Math.floor(width * height)))
  for (let index = 0; index < pixelCount; index++) if ((alpha[index] ?? 0) > 0) candidates.push(index)
  if (width < 1 || candidates.length === 0) return positions

  const random = createSeededRandom(seed)
  for (let index = 0; index < particleCount; index++) {
    const pixel = candidates[Math.floor(random() * candidates.length)] ?? candidates[0] ?? 0
    positions[index * 2] = pixel % width + 0.5
    positions[index * 2 + 1] = Math.floor(pixel / width) + 0.5
  }
  return positions
}

function createSeededRandom(seed: number) {
  let value = Number.isFinite(seed) ? Math.trunc(seed) | 0 : 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

interface GlyphSampleOptions {
  canvasRect: DOMRect
  camera: Camera
  count: number
  seed: number
  returnFraction: number
  quality: 'standard' | 'low'
}

function buildGlyphParticleGeometry(options: GlyphSampleOptions): BufferGeometry {
  const { canvasRect, camera, count, seed, returnFraction, quality } = options
  const geometry = new BufferGeometry()
  const scale = 2
  const maskCanvas = document.createElement('canvas')
  const width = Math.max(1, Math.ceil(canvasRect.width * scale))
  const height = Math.max(1, Math.ceil(canvasRect.height * scale))
  maskCanvas.width = width
  maskCanvas.height = height
  const context = maskCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    maskCanvas.width = 0
    maskCanvas.height = 0
    return geometry
  }
  context.scale(scale, scale)
  context.fillStyle = '#fff'
  context.textBaseline = 'alphabetic'

  const lines = document.querySelectorAll<HTMLElement>('[data-prologue-line]')
  for (const line of lines) {
    const style = getComputedStyle(line)
    const fontSize = Number.parseFloat(style.fontSize) || 48
    const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.3
    context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    for (const glyph of line.querySelectorAll<HTMLElement>('[data-glyph]')) {
      const value = glyph.dataset.glyph ?? glyph.textContent ?? ''
      if (!value.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(glyph)
      const rect = range.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      const baseline = rect.top - canvasRect.top + (lineHeight - fontSize) / 2 + fontSize * 0.81
      context.fillText(value, rect.left - canvasRect.left, baseline)
      range.detach()
    }
  }

  const pixels = context.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)
  for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = pixels[pixel * 4 + 3] ?? 0
  maskCanvas.width = 0
  maskCanvas.height = 0
  const particleCount = alpha.some((value) => value > 0)
    ? quality === 'low' ? Math.floor(count * 0.5) : count
    : 0
  const sampled = sampleGlyphParticlePixels(alpha, width, height, particleCount, seed)

  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const returns = new Float32Array(particleCount)
  const sizes = new Float32Array(particleCount)
  const tints = new Float32Array(particleCount * 3)
  const light = document.querySelector<HTMLElement>('.persistent-light-core')?.getBoundingClientRect()
  const lightX = light ? light.left + light.width / 2 : canvasRect.left + canvasRect.width / 2
  const lightY = light ? light.top + light.height / 2 : canvasRect.top + canvasRect.height / 2
  const returnPoint = screenToWorld(lightX, lightY, canvasRect, camera)
  const random = createSeededRandom(seed ^ 0x4f1bbcdc)
  // The config field is normalized; the artwork caps returns at the brief's 20% ceiling.
  const returningCount = Math.round(particleCount * Math.min(0.2, Math.max(0, returnFraction * 0.2)))
  const ivory = new Color('#fff0e8')
  const white = new Color('#ffffff')
  const lilac = new Color('#cfc4ff')

  for (let index = 0; index < particleCount; index++) {
    const x = canvasRect.left + (sampled[index * 2] ?? 0) / scale
    const y = canvasRect.top + (sampled[index * 2 + 1] ?? 0) / scale
    const point = screenToWorld(x, y, canvasRect, camera)
    positions.set([point.x, point.y, point.z], index * 3)
    const angle = random() * Math.PI * 2
    const magnitude = 0.18 + random() * 0.9
    velocities.set([Math.cos(angle) * magnitude, Math.sin(angle) * magnitude, (random() - 0.5) * 0.18], index * 3)
    returns[index] = index < returningCount ? 1 : 0
    sizes[index] = random()
    const tint = ivory.clone().lerp(random() < 0.74 ? white : lilac, 0.15 + random() * 0.68)
    tints.set([tint.r, tint.g, tint.b], index * 3)
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aVelocity', new Float32BufferAttribute(velocities, 3))
  geometry.setAttribute('aReturning', new Float32BufferAttribute(returns, 1))
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aTint', new Float32BufferAttribute(tints, 3))
  geometry.userData.returnPoint = returnPoint
  geometry.computeBoundingSphere()
  return geometry
}

function screenToWorld(x: number, y: number, rect: DOMRect, camera: Camera): Vector3 {
  camera.updateMatrixWorld()
  const point = new Vector3(
    ((x - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
    1 - ((y - rect.top) / Math.max(rect.height, 1)) * 2,
    0.5,
  ).unproject(camera)
  const direction = point.sub(camera.position).normalize()
  const distance = -camera.position.z / (direction.z || -1)
  return camera.position.clone().add(direction.multiplyScalar(distance))
}

export function PrologueScene({ runtime, state, reducedMotion }: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const prologue = config.scenes.prologue
  const frames = useMemo(() => getPrologueFrames(prologue), [prologue])
  const geometry = useMemo(() => new BufferGeometry(), [])
  const material = useRef<ShaderMaterial>(null)
  const camera = useThree((three) => three.camera)
  const gl = useThree((three) => three.gl)
  const size = useThree((three) => three.size)
  const invalidate = useThree((three) => three.invalidate)
  const uniforms = useMemo(() => ({
    uProgress: { value: 0 }, uSpeed: { value: prologue.particleSpeed }, uSpread: { value: prologue.particleSpread },
    uGlow: { value: prologue.glow }, uOpacity: { value: 0 }, uReturnPoint: { value: new Vector3() },
  }), [prologue.glow, prologue.particleSpeed, prologue.particleSpread])

  useLayoutEffect(() => {
    let disposed = false
    void loadArtFont(prologue.fontFamily).then(() => {
      if (disposed) return
      const canvasRect = gl.domElement.getBoundingClientRect()
      const next = buildGlyphParticleGeometry({
        canvasRect, camera, count: prologue.particleCount, seed: prologue.seed,
        returnFraction: prologue.particleReturnFraction, quality: state.quality,
      })
      const returnPoint = next.userData.returnPoint as Vector3 | undefined
      if (returnPoint) uniforms.uReturnPoint.value.copy(returnPoint)
      geometry.copy(next)
      next.dispose()
      invalidate()
    })
    return () => {
      disposed = true
      geometry.dispose()
      geometry.deleteAttribute('position')
      geometry.deleteAttribute('aVelocity')
      geometry.deleteAttribute('aReturning')
      geometry.deleteAttribute('aSize')
      geometry.deleteAttribute('aTint')
    }
  }, [camera, geometry, gl, invalidate, prologue, size.height, size.width, state.quality, uniforms])

  const draw = useCallback((time: number) => {
    const shader = material.current
    if (!shader) return
    const progress = Math.max(0, Math.min(1, (time - frames.dissolve[0]) / Math.max(0.1, frames.particleTravelDuration)))
    const live = shader.uniforms as typeof uniforms
    live.uProgress.value = progress
    live.uOpacity.value = getPrologueParticleOpacity(time, frames, reducedMotion)
    live.uSpeed.value = prologue.particleSpeed
    live.uSpread.value = prologue.particleSpread
    live.uGlow.value = prologue.glow
  }, [frames, prologue.glow, prologue.particleSpeed, prologue.particleSpread, reducedMotion])
  useSceneAnimation(runtime, frames.duration, draw)

  return <points geometry={geometry} frustumCulled={false} renderOrder={3}>
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexShader={particleVertexShader}
      fragmentShader={particleFragmentShader}
      transparent
      depthWrite={false}
      depthTest={false}
      toneMapped={false}
      blending={AdditiveBlending}
    />
  </points>
}
