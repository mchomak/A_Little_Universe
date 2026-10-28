import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Vector3, type Camera, type ShaderMaterial } from 'three'
import type { SceneProps } from '../engine/sceneTypes'
import { getPrologueFrames } from '../engine/filmConfig'
import { useSceneAnimation } from './shared/animation'
import {
  getParticleBirthTime,
  getParticleFadeStart,
  getParticleSceneOpacity,
  getPrologueParticleVertexCount,
  groupGlyphFragmentsByLine,
  resolvePrologueParticleCount,
  type GlyphTextFragment,
} from './prologue/particleMath'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { loadArtFont } from '../systems/scene-config/fontCatalog'

const particleVertexShader = `
attribute vec3 aVelocity;
attribute float aBirth;
attribute float aSize;
attribute float aKind;
attribute float aTint;
uniform float uTime;
uniform float uTravelDuration;
uniform float uFadeStart;
uniform float uWindStrength;
uniform float uTurbulence;
uniform float uGlow;
uniform float uOpacity;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  float age = uTime - aBirth;
  float travelProgress = clamp(age / max(0.1, uTravelDuration), 0.0, 1.0);
  float split = smoothstep(0.05, 0.3, age);
  float parentFade = 1.0 - smoothstep(0.1, 0.34, age);
  float ashAppear = smoothstep(0.12, 0.34, age);
  float roleAlpha = aKind < 0.5 ? parentFade : ashAppear;
  float fade = 1.0 - smoothstep(uFadeStart, uTravelDuration, age);
  float alive = step(0.0, age) * step(age, uTravelDuration);
  vec2 baseDrift = vec2(-0.44, 0.24) * uWindStrength * uTravelDuration * travelProgress;
  vec2 variation = vec2(-abs(aVelocity.x), abs(aVelocity.y)) * uTurbulence * 0.2 * uTravelDuration * travelProgress;
  vec2 ashSplit = vec2(-abs(aVelocity.x), abs(aVelocity.y)) * uTurbulence * split * 0.035;
  vec3 particle = position + vec3(baseDrift + variation + ashSplit, 0.0);
  vec4 viewPosition = modelViewMatrix * vec4(particle, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = (0.9 + aSize * 1.6 + uGlow * 0.24) * uPixelRatio * (5.6 / max(1.0, -viewPosition.z));
  vAlpha = alive * roleAlpha * fade * aTint * uOpacity;
}`

const particleFragmentShader = `
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord - 0.5) * 2.0;
  float softness = exp(-radius * radius * 4.2) * (1.0 - smoothstep(0.2, 1.0, radius));
  float alpha = softness * vAlpha;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vec3(1.0), alpha);
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

interface GlyphLineBounds {
  element: HTMLElement
  elementRect: DOMRect
}

interface GlyphSampleOptions {
  canvasRect: DOMRect
  camera: Camera
  count: number
  seed: number
  fractureWidth: number
  fractureDuration: number
  dissolveStart: number
}

function createEmptyParticleGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3))
  return geometry
}

function getGlyphTextFragments(element: HTMLElement): GlyphTextFragment[] {
  const fragments: GlyphTextFragment[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let node = walker.nextNode()

  while (node) {
    const value = node.textContent ?? ''
    for (let offset = 0; offset < value.length;) {
      const codePoint = value.codePointAt(offset)
      if (codePoint === undefined) break
      const text = String.fromCodePoint(codePoint)
      range.setStart(node, offset)
      range.setEnd(node, offset + text.length)
      const rect = range.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        fragments.push({ text, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
      }
      offset += text.length
    }
    node = walker.nextNode()
  }

  range.detach()
  return fragments
}

function buildGlyphParticleGeometry(options: GlyphSampleOptions): BufferGeometry {
  const { canvasRect, camera, count, seed, fractureWidth, fractureDuration, dissolveStart } = options
  const geometry = createEmptyParticleGeometry()
  const requestedParticleCount = getPrologueParticleVertexCount(count)
  if (requestedParticleCount < 4) return geometry
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
  context.textAlign = 'left'

  const lines: GlyphLineBounds[] = []
  for (const line of document.querySelectorAll<HTMLElement>('[data-prologue-line]')) {
    const text = line.textContent?.trim()
    if (!text) continue
    const elementRect = line.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(line)
    const lineRects = Array.from(range.getClientRects()).filter(({ width, height }) => width > 0 && height > 0)
    range.detach()
    if (lineRects.length === 0) continue
    const style = getComputedStyle(line)
    const fontSize = Number.parseFloat(style.fontSize) || 48
    context.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const glyphLines = groupGlyphFragmentsByLine(
      getGlyphTextFragments(line),
      lineRects.map(({ left, top, right, bottom }) => ({ left, top, right, bottom })),
    )
    for (const glyphLine of glyphLines) {
      const metrics = context.measureText(glyphLine.text)
      const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.75
      const baseline = glyphLine.top - canvasRect.top + ascent
      context.fillText(glyphLine.text, glyphLine.left - canvasRect.left, baseline)
    }
    if (glyphLines.length === 0) continue
    lines.push({ element: line, elementRect })
  }

  let alpha: Uint8Array
  try {
    const pixels = context.getImageData(0, 0, width, height).data
    alpha = new Uint8Array(width * height)
    for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = pixels[pixel * 4 + 3] ?? 0
  } finally {
    maskCanvas.width = 0
    maskCanvas.height = 0
  }
  const shardCount = alpha.some((value) => value > 0) && lines.length > 0 ? requestedParticleCount / 4 : 0
  const particleCount = shardCount * 4
  const sampled = sampleGlyphParticlePixels(alpha, width, height, shardCount, seed)

  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const birthTimes = new Float32Array(particleCount)
  const sizes = new Float32Array(particleCount)
  const kinds = new Float32Array(particleCount)
  const tints = new Float32Array(particleCount)
  const random = createSeededRandom(seed ^ 0x4f1bbcdc)

  for (let shard = 0; shard < shardCount; shard++) {
    const pixelX = (sampled[shard * 2] ?? 0) / scale
    const pixelY = (sampled[shard * 2 + 1] ?? 0) / scale
    const screenX = canvasRect.left + pixelX
    const screenY = canvasRect.top + pixelY
    const line = lines.find(({ elementRect }) => screenX >= elementRect.left && screenX <= elementRect.right && screenY >= elementRect.top && screenY <= elementRect.bottom) ?? lines[0]
    if (!line) continue
    const lineX = (screenX - line.elementRect.left) / Math.max(1, line.elementRect.width)
    const lineY = (screenY - line.elementRect.top) / Math.max(1, line.elementRect.height)
    const lineSeed = line.element.dataset.prologueLine === 'first' ? 37 : 71
    const birthTime = getParticleBirthTime({
      xNormalized: lineX, yNormalized: lineY, fractureWidth, dissolveStart, fractureDuration, seed: lineSeed,
    })
    const point = screenToWorld(screenX, screenY, canvasRect, camera)

    for (let child = 0; child < 4; child++) {
      const index = shard * 4 + child
      positions.set([point.x, point.y, point.z], index * 3)
      velocities.set([random() * 2 - 1, random() * 2 - 1, 0], index * 3)
      birthTimes[index] = birthTime
      kinds[index] = child === 0 ? 0 : 1
      sizes[index] = child === 0 ? 0.8 + random() * 0.35 : 0.18 + random() * 0.38
      tints[index] = child === 0 ? 0.55 + random() * 0.12 : 0.34 + random() * 0.2
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aVelocity', new Float32BufferAttribute(velocities, 3))
  geometry.setAttribute('aBirth', new Float32BufferAttribute(birthTimes, 1))
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aKind', new Float32BufferAttribute(kinds, 1))
  geometry.setAttribute('aTint', new Float32BufferAttribute(tints, 1))
  if (particleCount > 0) geometry.computeBoundingSphere()
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
  const geometry = useMemo(() => createEmptyParticleGeometry(), [])
  const material = useRef<ShaderMaterial>(null)
  const camera = useThree((three) => three.camera)
  const gl = useThree((three) => three.gl)
  const size = useThree((three) => three.size)
  const invalidate = useThree((three) => three.invalidate)
  const pixelRatio = useThree((three) => three.gl.getPixelRatio())
  const compact = size.width < 820 || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true)
  const particleCount = reducedMotion ? 0 : resolvePrologueParticleCount(prologue.particleCount, state.quality, pixelRatio, compact)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uTravelDuration: { value: frames.particleTravelDuration },
    uFadeStart: { value: getParticleFadeStart(frames.particleTravelDuration, prologue.particleFadeDuration) },
    uWindStrength: { value: prologue.windStrength },
    uTurbulence: { value: prologue.turbulence },
    uGlow: { value: prologue.glow },
    uOpacity: { value: 0 },
    uPixelRatio: { value: pixelRatio },
  }), [frames.particleTravelDuration, pixelRatio, prologue.glow, prologue.particleFadeDuration, prologue.turbulence, prologue.windStrength])

  useLayoutEffect(() => {
    let disposed = false
    void loadArtFont(prologue.fontFamily).then(() => {
      if (disposed) return
      const canvasRect = gl.domElement.getBoundingClientRect()
      const next = buildGlyphParticleGeometry({
        canvasRect,
        camera,
        count: particleCount,
        seed: prologue.seed,
        fractureWidth: prologue.fractureWidth,
        fractureDuration: prologue.fractureDuration,
        dissolveStart: frames.dissolve[0],
      })
      geometry.copy(next)
      next.dispose()
      invalidate()
    })
    return () => {
      disposed = true
      geometry.dispose()
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3))
      geometry.deleteAttribute('aVelocity')
      geometry.deleteAttribute('aBirth')
      geometry.deleteAttribute('aSize')
      geometry.deleteAttribute('aKind')
      geometry.deleteAttribute('aTint')
    }
  }, [camera, frames.dissolve, frames.particleTravelDuration, geometry, gl, invalidate, particleCount, prologue, size.height, size.width])

  const draw = useCallback((time: number) => {
    const shader = material.current
    if (!shader) return
    const live = shader.uniforms as typeof uniforms
    live.uTime.value = time
    live.uTravelDuration.value = Math.max(0.1, frames.particleTravelDuration)
    live.uFadeStart.value = getParticleFadeStart(frames.particleTravelDuration, prologue.particleFadeDuration)
    live.uWindStrength.value = prologue.windStrength
    live.uTurbulence.value = prologue.turbulence
    live.uGlow.value = prologue.glow
    live.uOpacity.value = getParticleSceneOpacity(
      time,
      frames.dissolve[0],
      frames.duration,
      prologue.particleFadeDuration,
      reducedMotion,
    )
    live.uPixelRatio.value = pixelRatio
  }, [frames, pixelRatio, prologue.glow, prologue.particleFadeDuration, prologue.turbulence, prologue.windStrength, reducedMotion])
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
