import {
  AdditiveBlending, AnimationClip, BufferAttribute, BufferGeometry, Color, Group,
  InterpolateDiscrete, InterpolateSmooth, Matrix4, Mesh, Points, ShaderMaterial,
  StreamDrawUsage, Vector3, type Object3D,
} from 'three'
import type { BloomSceneFrames, GrowthSceneFrames } from '../../engine/filmConfig'
import type { SceneId } from '../../engine/film'
import type { LilyBloomPollenSettings, LilyGrowthVortexSettings, SceneComposerConfig } from '../../systems/scene-config/config'
import type { Quality } from '../../engine/film'

const IMPULSE_POINTS = 28
const PARTICLE_CAPACITY = 528
const CORE_POINTS = 2
const VORTEX_CAPACITY = 1600
const POLLEN_CAPACITY = 600
const CUP_GLOW_POINTS = 1
const MAGIC_PARTICLE_OFFSET = IMPULSE_POINTS + CORE_POINTS + PARTICLE_CAPACITY
const CUP_GLOW_INDEX = MAGIC_PARTICLE_OFFSET + VORTEX_CAPACITY + POLLEN_CAPACITY
const TOTAL_POINTS = CUP_GLOW_INDEX + CUP_GLOW_POINTS
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

export type LilyGrowthVfxSettings = SceneComposerConfig['scenes']['growth']

export interface LilyGrowthVfxFrame {
  scene: SceneId
  time: number
  clipTime: number
  clipDuration: number
  frames: GrowthSceneFrames
  bloomFrames: BloomSceneFrames
  bloomClipTime: number
  bloomClipDuration: number
  bloomOpen: boolean
  bloomElapsed: number
  pixelRatio: number
  reducedMotion: boolean
  quality: Quality
}

export interface LilyGrowthVfxEnvelope {
  core: number
  activity: number
  progress: number
}

export interface GrowthVortexParticleSeed {
  angle: number
  angularSpeed: number
  radius: number
  height: number
  verticalPhase: number
  spread: number
  lift: number
}

interface GrowthVortexSeed extends GrowthVortexParticleSeed {
  birthProgress: number
  size: number
  brightness: number
  palette: number
  glow: number
}

export interface BloomPollenParticleSeed {
  phase: number
  brightness: number
  radius: number
  depth: number
  drift: number
  size: number
  angle: number
}

export function getGrowthVortexDissipationAge(frame: LilyGrowthVfxFrame): number {
  const settleDuration = Math.max(0, frame.frames.duration - frame.frames.model[1])
  if (frame.scene === 'growth') return Math.max(0, frame.time - frame.frames.model[1])
  if (frame.scene === 'bloom') return settleDuration + Math.max(0, Number.isFinite(frame.bloomElapsed) ? frame.bloomElapsed : 0)
  return 0
}

export function getGrowthVortexElapsed(frame: LilyGrowthVfxFrame, seed: { birthProgress: number }): number {
  if (frame.scene === 'growth') return Math.max(0, frame.clipTime - seed.birthProgress * frame.clipDuration)
  if (frame.scene === 'bloom') return Math.max(0, frame.clipDuration * (1 - seed.birthProgress)
    + (Number.isFinite(frame.bloomElapsed) ? frame.bloomElapsed : 0))
  return 0
}

export function getGrowthVortexSizeScale(dissipationProgress: number): number {
  return 1 - 0.72 * smooth(dissipationProgress)
}

/** Most grains expire naturally; a small seeded subset is reborn near the end of the held-open beat. */
export function getBloomPollenAge(seed: BloomPollenParticleSeed, bloomClipTime: number, bloomClipDuration: number,
  postOpenAge: number, contemplateDuration: number, lifetime: number): { age: number; terminalTail: boolean } {
  const duration = Math.max(0.001, Number.isFinite(bloomClipDuration) ? bloomClipDuration : 0.001)
  const contemplativeTime = Math.max(0, Number.isFinite(contemplateDuration) ? contemplateDuration : 0)
  const lifespan = Math.max(0.001, Number.isFinite(lifetime) ? lifetime : 0.001)
  const firstAge = Math.max(0, bloomClipTime - seed.phase * duration) + Math.max(0, postOpenAge)
  if (seed.phase < 0.84 || contemplativeTime <= 0) return { age: firstAge, terminalTail: false }
  const tailBirth = Math.max(seed.phase * contemplativeTime, contemplativeTime - lifespan * 0.35)
  const tailAge = postOpenAge - tailBirth
  return tailAge >= 0 ? { age: tailAge, terminalTail: true } : { age: firstAge, terminalTail: false }
}

/** Positive X moving toward positive Z is clockwise from above (+Y). */
export function getGrowthVortexPosition(seed: GrowthVortexParticleSeed, elapsed: number, dissipation: number,
  anchor: Vector3, settings: LilyGrowthVortexSettings, out: Vector3, worldScale = 1, motionScale = 1): Vector3 {
  const scale = Math.max(0.001, Number.isFinite(worldScale) ? worldScale : 1)
  const motion = clamp(motionScale, 0, 1)
  const dissipationProgress = clamp(dissipation)
  const motionElapsed = Math.max(0, elapsed) * motion
  const angle = seed.angle + motionElapsed * settings.rotationSpeed * seed.angularSpeed
  const radius = (settings.orbitRadius * (0.72 + seed.radius * 0.56)
    + settings.dissipationSpread * dissipationProgress * seed.spread) / scale
  const verticalSpread = settings.verticalSpread / scale
  const lift = settings.dissipationSpread * dissipationProgress * seed.lift / scale
  const helixRise = motionElapsed * settings.rotationSpeed * seed.angularSpeed / (Math.PI * 2) * verticalSpread * 0.12
  out.set(
    anchor.x + Math.cos(angle) * radius,
    anchor.y + seed.height * verticalSpread + Math.sin(angle * settings.spiralTightness + seed.verticalPhase) * verticalSpread * 0.18 + lift + helixRise,
    anchor.z + Math.sin(angle) * radius,
  )
  return out
}

/** Seeded onset plus a smooth end means a seek never depends on accumulated particles. */
export function getGrowthVortexOpacity(progress: number, birthProgress: number, dissipationAge: number, dissipationDuration: number): number {
  if (progress < birthProgress) return 0
  const birth = smooth((progress - birthProgress) / 0.035)
  const duration = Math.max(0.001, dissipationDuration)
  return birth * (1 - smooth(Math.max(0, dissipationAge) / duration))
}

/** Pollen peaks before the final held-open pose, where only recent grains linger. */
export function getBloomPollenOpacity(seed: BloomPollenParticleSeed, openProgress: number, age: number, settings: LilyBloomPollenSettings): number {
  if (!settings.enabled || openProgress < seed.phase || age < 0 || age >= settings.lifetime) return 0
  const fadeIn = smooth((openProgress - seed.phase) / 0.055) * smooth(age / Math.min(0.38, settings.lifetime * 0.25))
  const fadeOut = 1 - smooth((age - settings.lifetime * 0.68) / Math.max(0.05, settings.lifetime * 0.32))
  const bloomPeak = smooth(openProgress / 0.72) * (1 - 0.72 * smooth((openProgress - 0.9) / 0.1))
  return clamp(fadeIn * fadeOut * bloomPeak * seed.brightness * settings.glowIntensity, 0, 1)
}

export function getBloomPollenPosition(seed: BloomPollenParticleSeed, age: number, anchor: Vector3,
  settings: LilyBloomPollenSettings, out: Vector3, worldScale = 1, motionScale = 1): Vector3 {
  const scale = Math.max(0.001, Number.isFinite(worldScale) ? worldScale : 1)
  const spread = settings.spreadRadius / scale
  const radius = spread * seed.radius
  const motionAge = Math.max(0, age) * clamp(motionScale, 0, 1)
  const drift = motionAge * settings.riseSpeed / scale
  out.set(
    anchor.x + Math.cos(seed.angle) * radius + Math.sin(motionAge * 0.63 + seed.angle) * spread * seed.drift * 0.2,
    anchor.y + seed.depth * spread * 0.22 + drift,
    anchor.z + Math.sin(seed.angle) * radius + Math.cos(motionAge * 0.49 + seed.angle) * spread * seed.drift * 0.16,
  )
  return out
}

export function getGrowthVortexParticleLimit(count: number, quality: Quality, reducedMotion = false): number {
  return Math.round(clamp(count, 0, VORTEX_CAPACITY) * (quality === 'low' ? 0.5 : 1) * (reducedMotion ? 0.55 : 1))
}

export function getBloomPollenParticleLimit(count: number, quality: Quality, reducedMotion = false): number {
  return Math.round(clamp(count, 0, POLLEN_CAPACITY) * (quality === 'low' ? 0.65 : 1) * (reducedMotion ? 0.55 : 1))
}

/** GLB leaf pivots scale from zero while their YoungFolded morph weight falls toward zero. */
export function getLeafGrowthActivation(pivotScale: number, youngFoldedWeight: number): number {
  return clamp(pivotScale) * (1 - clamp(youngFoldedWeight))
}

/** The GLB head root grows from its authored near-zero scale as the bud forms. */
export function getBudGrowthActivation(headScale: number): number {
  return clamp(headScale)
}

/** A local shimmer is strongest while a posed zone is actively taking shape. */
export function getGrowthZoneBurst(activation: number): number {
  const amount = clamp(activation)
  return 4 * amount * (1 - amount)
}

/** Briefly brightens local particles when the moving pulse reaches a growing zone. */
export function getGrowthZonePulse(progress: number, zoneProgress: number, width: number, activation: number): number {
  const distance = (clamp(progress) - clamp(zoneProgress)) / Math.max(0.015, width)
  return Math.exp(-distance * distance * 4) * getGrowthZoneBurst(activation)
}

/** Re-times the pulse inside the clip while keeping both endpoints phase-locked for replay and scrubbing. */
export function getLilyGrowthPulseProgress(progress: number, speed: number): number {
  const normalizedProgress = clamp(progress)
  const normalizedSpeed = clamp(speed, 0.4, 2)
  return normalizedProgress ** (1 / normalizedSpeed)
}

/** Starts the glow softly and prevents early trail samples from stacking at the stem base. */
export function getLilyGrowthPulseReveal(progress: number, width: number): number {
  return smooth(clamp(progress) / clamp(width, 0.025, 0.3))
}

/** Keeps every live pulse sample on the stem segment that has already grown. */
export function getLilyGrowthPulseTrailProgress(progress: number, width: number, trail: number): number {
  const head = clamp(progress)
  const span = Math.min(head, clamp(width, 0.025, 0.3))
  return Math.max(0, head - span * clamp(trail))
}

/** A rounded exponential falloff keeps the end of the trail from reading as a row of lit dots. */
export function getLilyGrowthPulseTrailWeight(trail: number, fade: number): number {
  const amount = clamp(trail)
  const falloff = Math.exp(-amount * (1 + clamp(fade, 0.35, 3) * 0.55))
  return falloff * (1 - smooth(amount))
}

export function getGrowthVfxParticleLimit(count: number, quality: Quality): number {
  const requested = clamp(count, 0, PARTICLE_CAPACITY)
  return Math.round(requested * (quality === 'low' ? 0.5 : 1))
}

export type GrowthParticleSource = 'stem' | 'leafA' | 'leafB' | 'bud'

function createActivationReader(clip: AnimationClip, source: GrowthParticleSource): (time: number) => number {
  const read = (node: string, property: 'scale' | 'morphTargetInfluences', component: number) => {
    const track = clip.tracks.find(candidate => candidate.name.startsWith(`${node}.`) && candidate.name.includes(property))
    if (!track) return () => 0
    const result = new Float32Array(track.getValueSize())
    const interpolant = track.getInterpolation() === InterpolateDiscrete
      ? track.InterpolantFactoryMethodDiscrete(result)
      : track.getInterpolation() === InterpolateSmooth
        ? track.InterpolantFactoryMethodSmooth(result)
        : track.InterpolantFactoryMethodLinear(result)
    return (time: number) => Number(interpolant.evaluate(clamp(time, 0, clip.duration))[component] ?? 0)
  }
  if (source === 'stem') {
    const folded = read('Stem', 'morphTargetInfluences', 0)
    return time => clamp(1 - folded(time))
  }
  if (source === 'leafA' || source === 'leafB') {
    const node = source === 'leafA' ? 'Leaf_A' : 'Leaf_B'
    const pivotScale = read(`${node}_Pivot`, 'scale', 1)
    const youngFolded = read(node, 'morphTargetInfluences', 0)
    return time => clamp(pivotScale(time)) * (1 - clamp(youngFolded(time)))
  }
  const headScale = read('Head_Root', 'scale', 0)
  return time => clamp(headScale(time))
}

/** Finds each birth moment from the actual GLB morph or scale channel. */
export function getGrowthVfxBirthTime(clip: AnimationClip, source: GrowthParticleSource, activationThreshold: number): number {
  const activation = createActivationReader(clip, source)
  const threshold = clamp(activationThreshold)
  if (activation(0) >= threshold) return 0
  if (activation(clip.duration) < threshold) return clip.duration
  let low = 0, high = clip.duration
  for (let iteration = 0; iteration < 22; iteration++) {
    const middle = (low + high) * 0.5
    if (activation(middle) >= threshold) high = middle
    else low = middle
  }
  return high
}

/** Pure scene envelope; all animation progress comes from the already-seeked GLB clip. */
export function getLilyGrowthVfxEnvelope(scene: SceneId, time: number, clipTime: number, clipDuration: number, frames: GrowthSceneFrames): LilyGrowthVfxEnvelope {
  const progress = clamp(clipTime / Math.max(0.001, clipDuration))
  if (scene === 'bloom') return { core: 0.34, activity: 0, progress: 1 }
  if (scene !== 'growth') return { core: 0, activity: 0, progress }
  const sprout = smooth((time - frames.model[0]) / 0.9)
  const settle = smooth((time - (frames.model[1] - 0.8)) / 1.7)
  const activity = smooth((time - frames.model[0]) / 0.7) * (1 - smooth((time - frames.model[1] - 0.05) / 1.1))
  return { core: 0.26 + 0.74 * sprout * (1 - 0.89 * settle), activity: clamp(activity), progress }
}

export interface LilyGrowthVfx {
  update(frame: LilyGrowthVfxFrame, settings: LilyGrowthVfxSettings, pollenSettings: LilyBloomPollenSettings): void
  dispose(): void
  /** Stable typed arrays are exposed for runtime verification and diagnostics. */
  readonly geometry: BufferGeometry
  /** Growth-only particle material is exposed for live DEV diagnostics. */
  readonly material: ShaderMaterial
  /** Stable per-particle organ labels aligned with the particle tail of the buffers. */
  readonly particleSources: readonly GrowthParticleSource[]
}

const vertexShader = /* glsl */`
  attribute float aSize;
  attribute float aOpacity;
  attribute float aGlow;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vGlow;
  uniform float uPixelRatio;
  void main() {
    vColor = color;
    vOpacity = aOpacity;
    vGlow = aGlow;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPixelRatio);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vOpacity;
  varying float vGlow;
  uniform float uBrightness;
  uniform float uGlowStrength;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float halo = exp(-radius * radius * 5.2) * (1.0 - smoothstep(0.72, 1.0, radius));
    float core = exp(-radius * radius * 24.0);
    float glow = uGlowStrength * vGlow;
    float alpha = vOpacity * (halo * (0.72 + glow * 0.52) + core * (0.36 + glow * 0.13));
    gl_FragColor = vec4(vColor * uBrightness * (1.0 + glow * 0.28), alpha);
  }
`

function unit(seed: number) {
  const value = Math.sin(seed * 127.1 + 19.19) * 43758.5453
  return value - Math.floor(value)
}

interface ParticleSeed {
  source: GrowthParticleSource
  phase: number
  pathPosition: number
  densitySample: number
  birthTime: number
  life: number
  size: number
  speed: number
  opacity: number
  brightness: number
  glow: number
  angle: number
  drift: number
  color: Color
}

function createParticleSeeds(clip: AnimationClip): ParticleSeed[] {
  return Array.from({ length: PARTICLE_CAPACITY }, (_, index) => {
    const selector = unit(index + 10)
    const source = selector < 0.5 ? 'stem' : selector < 0.65 ? 'leafA' : selector < 0.8 ? 'leafB' : 'bud'
    const phase = unit(index + 300)
    const phaseThreshold = 0.04 + phase * 0.84
    const tier = unit(index + 1800)
    const brightness = tier < 0.7 ? 0.8 + unit(index + 1900) * 0.2
      : tier < 0.965 ? 1.04 + unit(index + 2000) * 0.16
        : 1.36 + unit(index + 2100) * 0.24
    return {
      source,
      // These thresholds are measured against each zone's actual posed activation,
      // never against an independent wall clock or guessed clip-time window.
      phase: phaseThreshold,
      // Separate the spatial sample from its activation threshold. At early stages,
      // only recently activated seeds are alive; using phase for both would pin the
      // whole visible stem stream to the newest tip of the short posed curve.
      pathPosition: unit(index + 2700),
      // A second stable sample thins only the earliest stem stream without creating
      // frame-to-frame randomness or biasing the retained points toward either end.
      densitySample: unit(index + 3600),
      birthTime: getGrowthVfxBirthTime(clip, source, phaseThreshold),
      life: 0.72 + unit(index + 600) * 0.56,
      size: unit(index + 900),
      speed: 0.8 + unit(index + 1500) * 0.4,
      opacity: 0.72 + unit(index + 1600) * 0.28,
      brightness,
      glow: tier < 0.7 ? 0.18 + unit(index + 2200) * 0.28
        : tier < 0.965 ? 0.55 + unit(index + 2300) * 0.25
          : 1.05 + unit(index + 2400) * 0.25,
      angle: unit(index + 1200) * Math.PI * 2,
      drift: 0.35 + unit(index + 1500) * 0.65,
      color: new Color(source === 'bud'
        ? (index % 3 === 0 ? '#EDC4D3' : index % 3 === 1 ? '#FFF4E8' : '#D6C18D')
        : (index % 3 === 0 ? '#FFF5EA' : index % 3 === 1 ? '#DCE4B9' : '#D8C994')),
    }
  })
}

function createGrowthVortexSeeds(): GrowthVortexSeed[] {
  return Array.from({ length: VORTEX_CAPACITY }, (_, index) => ({
    angle: unit(index + 5100) * Math.PI * 2,
    angularSpeed: 0.65 + unit(index + 5200) * 0.7,
    radius: unit(index + 5300),
    height: (unit(index + 5400) - 0.5) * 0.76,
    verticalPhase: unit(index + 5500) * Math.PI * 2,
    spread: 0.45 + unit(index + 5600) * 0.8,
    lift: 0.45 + unit(index + 5700) * 0.8,
    birthProgress: 0.035 + unit(index + 5800) * 0.82,
    size: unit(index + 5900),
    brightness: 0.58 + unit(index + 6000) * 0.62,
    palette: unit(index + 6100),
    glow: 0.38 + unit(index + 6200) * 0.84,
  }))
}

function createBloomPollenSeeds(): BloomPollenParticleSeed[] {
  return Array.from({ length: POLLEN_CAPACITY }, (_, index) => ({
    phase: 0.08 + unit(index + 7100) * 0.82,
    brightness: 0.58 + unit(index + 7200) * 0.42,
    radius: Math.sqrt(unit(index + 7300)) * 0.78,
    depth: unit(index + 7400) * 2 - 1,
    drift: 0.35 + unit(index + 7500) * 0.65,
    size: unit(index + 7600),
    angle: unit(index + 7700) * Math.PI * 2,
  }))
}

function findMesh(root: Object3D, name: string): Mesh | null {
  const found = root.getObjectByName(name)
  return found instanceof Mesh ? found : null
}

function writePoint(positions: Float32Array, sizes: Float32Array, opacities: Float32Array, colors: Float32Array, glows: Float32Array, index: number,
  point: Vector3, size: number, opacity: number, color: Color, glow = 0) {
  const offset = index * 3
  positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z
  sizes[index] = size; opacities[index] = opacity; glows[index] = glow
  colors[offset] = color.r; colors[offset + 1] = color.g; colors[offset + 2] = color.b
}

function sampleMeshSurface(mesh: Mesh | null | undefined, sample: number, parent: Group, out: Vector3, scratch: [Vector3, Vector3, Vector3]): boolean {
  if (!mesh) return false
  const position = mesh.geometry.getAttribute('position')
  if (!position || position.count === 0) return false
  const index = mesh.geometry.getIndex()
  const triangleCount = Math.floor((index?.count ?? position.count) / 3)
  if (!triangleCount) return false
  const tri = Math.floor(unit(sample * 7.17 + 42) * triangleCount) * 3
  const ids = [index ? index.getX(tri) : tri, index ? index.getX(tri + 1) : tri + 1, index ? index.getX(tri + 2) : tri + 2]
  const u = Math.sqrt(unit(sample * 13.1 + 5)), v = unit(sample * 17.7 + 7)
  const wa = 1 - u, wb = u * (1 - v), wc = u * v
  const [a, b, c] = scratch
  mesh.getVertexPosition(ids[0]!, a); mesh.getVertexPosition(ids[1]!, b); mesh.getVertexPosition(ids[2]!, c)
  out.set(a.x * wa + b.x * wb + c.x * wc, a.y * wa + b.y * wb + c.y * wc, a.z * wa + b.z * wb + c.z * wc)
  mesh.localToWorld(out)
  parent.worldToLocal(out)
  return true
}

function getStemCurve(mesh: Mesh | null, parent: Group, positions: Vector3[], binsData: {
  sumX: Float64Array; sumY: Float64Array; sumZ: Float64Array; count: Uint16Array; radius: Float32Array; point: Vector3
  posed: Float32Array; parentInverse: Matrix4; meshToLocal: Matrix4
}): number {
  if (!mesh) return 0
  const attribute = mesh.geometry.getAttribute('position')
  if (!attribute) return 0
  const bins = positions.length
  const { sumX, sumY, sumZ, count, radius, point, posed, parentInverse, meshToLocal } = binsData
  sumX.fill(0); sumY.fill(0); sumZ.fill(0); count.fill(0)
  mesh.updateWorldMatrix(true, false)
  parent.updateWorldMatrix(true, false)
  parentInverse.copy(parent.matrixWorld).invert()
  meshToLocal.multiplyMatrices(parentInverse, mesh.matrixWorld)
  let minY = Infinity, maxY = -Infinity
  // Morph targets are evaluated by getVertexPosition, so the curve is the posed stem.
  for (let index = 0; index < attribute.count; index++) {
    mesh.getVertexPosition(index, point)
    point.applyMatrix4(meshToLocal)
    const offset = index * 3
    posed[offset] = point.x; posed[offset + 1] = point.y; posed[offset + 2] = point.z
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minY) || maxY - minY < 0.008) return 0
  const height = maxY - minY
  for (let index = 0; index < attribute.count; index++) {
    const offset = index * 3
    point.set(posed[offset]!, posed[offset + 1]!, posed[offset + 2]!)
    const normalized = clamp((point.y - minY) / height)
    const bin = Math.min(bins - 1, Math.floor(normalized * bins))
    sumX[bin] = sumX[bin]! + point.x
    sumY[bin] = sumY[bin]! + point.y
    sumZ[bin] = sumZ[bin]! + point.z
    count[bin] = count[bin]! + 1
  }
  let filled = 0
  for (let bin = 0; bin < bins; bin++) {
    if (count[bin]) {
      positions[bin]!.set(sumX[bin]! / count[bin]!, sumY[bin]! / count[bin]!, sumZ[bin]! / count[bin]!)
      filled++
    }
  }
  // Keep the posed tube radius with the centerline so the light can sit on the
  // camera-facing stem surface instead of disappearing inside the GLB mesh.
  radius.fill(0)
  for (let index = 0; index < attribute.count; index++) {
    const offset = index * 3
    point.set(posed[offset]!, posed[offset + 1]!, posed[offset + 2]!)
    const normalized = clamp((point.y - minY) / height)
    const bin = Math.min(bins - 1, Math.floor(normalized * bins))
    const center = positions[bin]!
    radius[bin] = Math.max(radius[bin]!, Math.hypot(point.x - center.x, point.z - center.z))
  }
  let first = 0
  while (first < bins && !count[first]) first++
  if (first === bins) return 0
  for (let bin = 0; bin < first; bin++) { positions[bin]!.copy(positions[first]!); radius[bin] = radius[first]! }
  let previous = first
  for (let bin = first + 1; bin < bins; bin++) {
    if (count[bin]) { previous = bin; continue }
    let next = bin + 1
    while (next < bins && !count[next]) next++
    if (next < bins) {
      const ratio = (bin - previous) / (next - previous)
      positions[bin]!.lerpVectors(positions[previous]!, positions[next]!, ratio)
      radius[bin] = radius[previous]! + (radius[next]! - radius[previous]!) * ratio
    } else { positions[bin]!.copy(positions[previous]!); radius[bin] = radius[previous]! }
  }
  return filled > 2 ? bins : 0
}

function sampleRadius(radius: Float32Array, progress: number): number {
  const scaled = clamp(progress) * (radius.length - 1)
  const index = Math.min(radius.length - 2, Math.floor(scaled))
  return radius[index]! + (radius[index + 1]! - radius[index]!) * (scaled - index)
}

function sampleCurve(curve: Vector3[], progress: number, out: Vector3) {
  const scaled = clamp(progress) * (curve.length - 1)
  const index = Math.min(curve.length - 2, Math.floor(scaled))
  return out.lerpVectors(curve[index]!, curve[index + 1]!, scaled - index)
}

function sampleCurveSmooth(curve: Vector3[], progress: number, out: Vector3) {
  const scaled = clamp(progress) * (curve.length - 1)
  const index = Math.min(curve.length - 2, Math.floor(scaled))
  const t = scaled - index
  const t2 = t * t
  const t3 = t2 * t
  const p0 = curve[Math.max(0, index - 1)]!
  const p1 = curve[index]!
  const p2 = curve[index + 1]!
  const p3 = curve[Math.min(curve.length - 1, index + 2)]!
  const interpolate = (a: number, b: number, c: number, d: number) => 0.5 * (
    2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3
  )
  return out.set(
    interpolate(p0.x, p1.x, p2.x, p3.x),
    interpolate(p0.y, p1.y, p2.y, p3.y),
    interpolate(p0.z, p1.z, p2.z, p3.z),
  )
}

function findCurveProgress(point: Vector3, curve: Vector3[]): number {
  let nearest = 0, nearestDistance = Infinity
  for (let index = 0; index < curve.length; index++) {
    const distance = curve[index]!.distanceToSquared(point)
    if (distance < nearestDistance) { nearestDistance = distance; nearest = index }
  }
  return nearest / Math.max(1, curve.length - 1)
}

export function createLilyGrowthVfx(parent: Group, model: Group, growthClip: AnimationClip): LilyGrowthVfx {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(TOTAL_POINTS * 3)
  const sizes = new Float32Array(TOTAL_POINTS)
  const opacities = new Float32Array(TOTAL_POINTS)
  const glows = new Float32Array(TOTAL_POINTS)
  const colors = new Float32Array(TOTAL_POINTS * 3)
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(StreamDrawUsage))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1).setUsage(StreamDrawUsage))
  geometry.setAttribute('aOpacity', new BufferAttribute(opacities, 1).setUsage(StreamDrawUsage))
  geometry.setAttribute('aGlow', new BufferAttribute(glows, 1).setUsage(StreamDrawUsage))
  geometry.setAttribute('color', new BufferAttribute(colors, 3).setUsage(StreamDrawUsage))
  geometry.setDrawRange(0, TOTAL_POINTS)
  const material = new ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending,
    toneMapped: false, vertexColors: true,
    uniforms: { uPixelRatio: { value: 1 }, uBrightness: { value: 1 }, uGlowStrength: { value: 1 } },
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  const effects = new Group()
  effects.add(points)
  parent.add(effects)
  const base = model.getObjectByName('VFX_StemBase') ?? model.getObjectByName('Lily_Root')
  const stem = findMesh(model, 'Stem')
  const leaves = [findMesh(model, 'Leaf_A'), findMesh(model, 'Leaf_B')]
  const leafPivots = [model.getObjectByName('Leaf_A_Pivot'), model.getObjectByName('Leaf_B_Pivot')]
  const leafAxisSigns = leaves.map(leaf => {
    const positions = leaf?.geometry.getAttribute('position')
    if (!positions) return -1
    let minY = Infinity, maxY = -Infinity
    for (let index = 0; index < positions.count; index++) {
      const y = positions.getY(index)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return Math.abs(minY) > Math.abs(maxY) ? -1 : 1
  })
  const bud = findMesh(model, 'Petals') ?? findMesh(model, 'Calyx')
  const head = model.getObjectByName('Head_Root')
  const cup = model.getObjectByName('Flower_Interior')
  const anthers: Object3D[] = []
  model.traverse(object => {
    if (object instanceof Mesh && /anther|filament/i.test(object.name)) anthers.push(object)
  })
  const curve = Array.from({ length: 32 }, () => new Vector3())
  const stemVertexCount = stem?.geometry.getAttribute('position')?.count ?? 0
  const binsData = {
    sumX: new Float64Array(curve.length), sumY: new Float64Array(curve.length), sumZ: new Float64Array(curve.length),
    count: new Uint16Array(curve.length), radius: new Float32Array(curve.length), point: new Vector3(), posed: new Float32Array(stemVertexCount * 3),
    parentInverse: new Matrix4(), meshToLocal: new Matrix4(),
  }
  const seeds = createParticleSeeds(growthClip)
  const vortexSeeds = createGrowthVortexSeeds()
  const pollenSeeds = createBloomPollenSeeds()
  const particleSources = Object.freeze(seeds.map(seed => seed.source))
  const particleScratch = Array.from({ length: PARTICLE_CAPACITY }, () => [new Vector3(), new Vector3(), new Vector3()] as [Vector3, Vector3, Vector3])
  const baseColor = new Color('#F5D9A4').lerp(new Color('#FFF4E8'), 0.18)
  const pearl = new Color('#FFF4E8')
  const pulseColor = new Color('#F4DFB8')
  const tintColor = new Color('#FFF4E8')
  const particleColor = new Color()
  const vortexColor = new Color()
  const vortexPearl = new Color('#FFF6EB')
  const vortexChampagne = new Color('#EBD4A7')
  const vortexRose = new Color('#F5DFE8')
  const pollenGold = new Color('#E9CE91')
  const pollenPearl = new Color('#FFF2DF')
  const cupGlowColor = new Color('#F7E4BC')
  const anchor = new Vector3()
  const cupAnchor = new Vector3()
  const antherAnchor = new Vector3()
  const worldScale = new Vector3()
  const pathPoint = new Vector3()
  const particleCenter = new Vector3()
  const particleSurface = new Vector3()
  const localAxisPoint = new Vector3()
  const localAxisOrigin = new Vector3()
  const leafDirections = [new Vector3(), new Vector3()] as const
  const budDirection = new Vector3()
  const leafPerpendicular = [new Vector3(), new Vector3()] as const
  const budPerpendicular = new Vector3()
  const axisReference = new Vector3(1, 0, 0)
  const secondPerpendicular = new Vector3()
  const leafActivation = [0, 0]
  let disposed = false

  const update = (frame: LilyGrowthVfxFrame, settings: LilyGrowthVfxSettings, pollenSettings: LilyBloomPollenSettings) => {
    if (disposed) return
    parent.updateWorldMatrix(true, false)
    model.updateWorldMatrix(true, true)
    const envelope = getLilyGrowthVfxEnvelope(frame.scene, frame.time, frame.clipTime, frame.clipDuration, frame.frames)
    const settle = smooth((frame.time - (frame.frames.model[1] - 0.8)) / 1.7)
    const breathing = 1 + 0.08 * Math.sin(frame.time * 2.15) * (1 - settle)
    const coreOpacity = frame.scene === 'bloom' ? 0.34 : envelope.core * breathing
    if (base) {
      base.getWorldPosition(anchor)
      parent.worldToLocal(anchor)
    } else anchor.set(0, 0, 0)
    writePoint(positions, sizes, opacities, colors, glows, IMPULSE_POINTS, anchor, 23, coreOpacity * settings.vfxCoreIntensity * 0.42, baseColor)
    writePoint(positions, sizes, opacities, colors, glows, IMPULSE_POINTS + 1, anchor, 8.5, coreOpacity * settings.vfxCoreIntensity, pearl)

    const curveCount = frame.scene === 'growth' ? getStemCurve(stem, parent, curve, binsData) : 0
    const active = frame.scene === 'growth' && !frame.reducedMotion ? envelope.activity : 0
    const growthProgress = envelope.progress
    const pulseProgress = getLilyGrowthPulseProgress(growthProgress, settings.vfxPulseSpeed)
    for (let index = 0; index < leaves.length; index++) {
      const pivot = leafPivots[index]
      const leaf = leaves[index]
      const scale = pivot?.scale.y ?? 0
      const youngFolded = leaf?.morphTargetInfluences?.[0] ?? 1
      leafActivation[index] = getLeafGrowthActivation(scale, youngFolded)
      const direction = leafDirections[index]!
      if (leaf) {
        leaf.localToWorld(localAxisOrigin.set(0, 0, 0))
        leaf.localToWorld(localAxisPoint.set(0, leafAxisSigns[index]!, 0))
        parent.worldToLocal(localAxisOrigin); parent.worldToLocal(localAxisPoint)
        direction.subVectors(localAxisPoint, localAxisOrigin).normalize()
      } else direction.set(0, 1, 0)
      const perpendicular = leafPerpendicular[index]!
      perpendicular.crossVectors(direction, axisReference)
      if (perpendicular.lengthSq() < 0.0001) perpendicular.set(0, 0, 1)
      perpendicular.normalize()
    }
    if (head) {
      head.localToWorld(localAxisOrigin.set(0, 0, 0))
      head.localToWorld(localAxisPoint.set(0, 1, 0))
      parent.worldToLocal(localAxisOrigin); parent.worldToLocal(localAxisPoint)
      budDirection.subVectors(localAxisPoint, localAxisOrigin).normalize()
    } else budDirection.set(0, 1, 0)
    budPerpendicular.crossVectors(budDirection, axisReference)
    if (budPerpendicular.lengthSq() < 0.0001) budPerpendicular.set(0, 0, 1)
    budPerpendicular.normalize()
    secondPerpendicular.crossVectors(budDirection, budPerpendicular).normalize()
    const leafZoneProgress = [0, 0]
    let budZoneProgress = 0
    if (curveCount) {
      for (let index = 0; index < leafPivots.length; index++) {
        const pivot = leafPivots[index]
        if (!pivot) continue
        pivot.getWorldPosition(localAxisOrigin)
        parent.worldToLocal(localAxisOrigin)
        leafZoneProgress[index] = findCurveProgress(localAxisOrigin, curve)
      }
      if (head) {
        head.getWorldPosition(localAxisOrigin)
        parent.worldToLocal(localAxisOrigin)
        budZoneProgress = findCurveProgress(localAxisOrigin, curve)
      }
    }
    const pulseWidth = clamp(settings.vfxPulseWidth, 0.025, 0.3)
    const pulseReveal = getLilyGrowthPulseReveal(pulseProgress, pulseWidth)
    pulseColor.set(settings.vfxPulseColor)
    for (let index = 0; index < IMPULSE_POINTS; index++) {
      const trail = index / (IMPULSE_POINTS - 1)
      const along = getLilyGrowthPulseTrailProgress(pulseProgress, pulseWidth, trail)
      let zoneBoost = 0
      for (let leafIndex = 0; leafIndex < leafZoneProgress.length; leafIndex++) {
        zoneBoost += settings.vfxPulseLeafBoost * getGrowthZonePulse(along, leafZoneProgress[leafIndex]!, pulseWidth * 0.8, leafActivation[leafIndex]!)
      }
      zoneBoost += settings.vfxPulseBudBoost * getGrowthZonePulse(along, budZoneProgress, pulseWidth * 0.8, getBudGrowthActivation(head?.scale.x ?? 0))
      const opacity = active * Number(settings.vfxPulseEnabled) * settings.vfxPulseBrightness
        * pulseReveal * getLilyGrowthPulseTrailWeight(trail, settings.vfxPulseTrailFade)
        * 0.18 * (1 + zoneBoost * 0.45)
      if (curveCount && opacity > 0.001) {
        sampleCurveSmooth(curve, along, pathPoint)
        pathPoint.z += sampleRadius(binsData.radius, along) * 1.08
      } else pathPoint.set(0, -1000, 0)
      writePoint(positions, sizes, opacities, colors, glows, index, pathPoint, 6 + (1 - trail) * 3.2, opacity, pulseColor, 0.72)
    }

    const particleLimit = getGrowthVfxParticleLimit(settings.vfxParticleCount, frame.quality)
    tintColor.set(settings.vfxParticleTint)
    const earlyStemFlow = 1 - smooth(growthProgress / 0.45)
    const earlyStemDensity = 0.16 + 0.84 * (1 - earlyStemFlow) ** 2
    const stemActivation = stem?.morphTargetInfluences?.[0] === undefined
      ? growthProgress : clamp(1 - stem.morphTargetInfluences[0])
    for (let index = 0; index < PARTICLE_CAPACITY; index++) {
      const seed = seeds[index]!
      const slot = IMPULSE_POINTS + CORE_POINTS + index
      const zoneActivation = seed.source === 'stem' ? stemActivation
        : seed.source === 'bud' ? getBudGrowthActivation(head?.scale.x ?? 0)
          : leafActivation[seed.source === 'leafA' ? 0 : 1]!
      const age = frame.clipTime - seed.birthTime
      const life = settings.vfxParticleLifetime * seed.life
      const fadeInDuration = Math.min(0.18, life * 0.3)
      const fadeOutStart = life * 0.64
      const fadeOutDuration = Math.max(0.08, life - fadeOutStart)
      let opacity = active * smooth(age / fadeInDuration) * (1 - smooth((age - fadeOutStart) / fadeOutDuration))
      if (age < 0 || age > life || zoneActivation < seed.phase || index >= particleLimit) opacity = 0
      const earlyDensityReveal = seed.source === 'stem' && earlyStemFlow > 0
        ? smooth((earlyStemDensity - seed.densitySample + 0.08) / 0.16)
        : 1
      let sampled = false
      const surface = particleSurface
      const travel = age * settings.vfxParticleSpeed * seed.speed
      if (opacity > 0.002) {
        if (seed.source === 'stem' && curveCount) {
          const trailProgress = clamp(1 - age / life)
          const emitterProgress = clamp(seed.pathPosition * 0.92 + trailProgress * 0.08 + travel * 0.045)
          sampleCurve(curve, emitterProgress, particleCenter)
          const radius = (0.014 + seed.drift * 0.014 + settings.vfxParticleSpread * (0.022 + seed.drift * 0.014))
            * (1 - earlyStemFlow * 0.3)
          const angle = seed.angle + travel * 1.45
          surface.copy(particleCenter)
          surface.x += Math.cos(angle) * radius
          surface.z += Math.sin(angle) * radius
          surface.y += (unit(index + 3000) - 0.5) * settings.vfxParticleSpread * 0.05 * earlyStemFlow
          sampled = true
        } else if (seed.source === 'leafA' || seed.source === 'leafB') {
          const leafIndex = seed.source === 'leafA' ? 0 : 1
          const leaf = leaves[leafIndex]
          sampled = sampleMeshSurface(leaf, index, parent, surface, particleScratch[index]!)
          if (sampled) {
            const angle = seed.angle + travel
            const direction = leafDirections[leafIndex]!
            const perpendicular = leafPerpendicular[leafIndex]!
            secondPerpendicular.crossVectors(direction, perpendicular).normalize()
            surface.addScaledVector(direction, travel * 0.09)
            const radius = 0.008 + settings.vfxParticleSpread * 0.032
            surface.addScaledVector(perpendicular, Math.cos(angle) * radius)
            surface.addScaledVector(secondPerpendicular, Math.sin(angle) * radius)
            const arrival = getGrowthZonePulse(growthProgress, leafZoneProgress[leafIndex]!, pulseWidth * 0.55, leafActivation[leafIndex]!)
            opacity *= 1 + arrival * 1.2
          }
        } else {
          sampled = sampleMeshSurface(bud, index + 400, parent, surface, particleScratch[index]!)
          if (sampled) {
            // A small orbit follows the animated bud surface for a moment, then lifts away.
            const angle = seed.angle + travel * 0.75
            const radius = 0.009 + settings.vfxParticleSpread * 0.026 + age * 0.008
            surface.addScaledVector(budDirection, age * 0.025)
            surface.addScaledVector(budPerpendicular, Math.cos(angle) * radius)
            surface.addScaledVector(secondPerpendicular, Math.sin(angle) * radius)
            const arrival = getGrowthZonePulse(growthProgress, budZoneProgress, pulseWidth * 0.55, getBudGrowthActivation(head?.scale.x ?? 0))
            opacity *= 1 + arrival * 1.2
          }
        }
      }
      if (!sampled) { surface.set(0, -1000, 0); opacity = 0 }
      const size = settings.vfxParticleSize * (1 - settings.vfxParticleSizeVariation * 0.5 + seed.size * settings.vfxParticleSizeVariation)
      const sparkleSize = seed.glow > 1 ? 1 + (seed.glow - 1) * 0.24 : 1
      const effectiveGlow = seed.glow * (seed.source === 'stem' ? 1 - earlyStemFlow * 0.22 : 1)
      const glowSize = 1 + effectiveGlow * settings.vfxParticleGlow * 0.55
      particleColor.copy(seed.color).multiply(tintColor)
      const earlySoftening = seed.source === 'stem' ? 1 - earlyStemFlow * 0.25 : 1
      writePoint(positions, sizes, opacities, colors, glows, slot, surface, size * sparkleSize * glowSize,
        opacity * earlyDensityReveal * earlySoftening * seed.opacity * seed.brightness * settings.vfxParticleBrightness, particleColor, effectiveGlow)
    }

    const vortexSettings = settings.growthVortex
    const vortexCount = getGrowthVortexParticleLimit(vortexSettings.particleCount, frame.quality, frame.reducedMotion)
    const vortexProgress = frame.scene === 'growth' ? growthProgress : frame.scene === 'bloom' ? 1 : 0
    const dissipationAge = getGrowthVortexDissipationAge(frame)
    const dissipationProgress = clamp(dissipationAge / Math.max(0.001, vortexSettings.dissipationDuration))
    if (head) {
      head.getWorldPosition(anchor)
      parent.worldToLocal(anchor)
    } else anchor.set(0, 0, 0)
    parent.getWorldScale(worldScale)
    const scaleY = Math.max(0.001, worldScale.y)
    vortexColor.set(vortexSettings.color)
    const vortexEnabled = vortexSettings.enabled && (frame.scene === 'growth' || frame.scene === 'bloom')
    for (let index = 0; index < VORTEX_CAPACITY; index++) {
      const seed = vortexSeeds[index]!
      const slot = MAGIC_PARTICLE_OFFSET + index
      const visible = vortexEnabled && index < vortexCount
      const opacity = visible
        ? getGrowthVortexOpacity(vortexProgress, seed.birthProgress, dissipationAge, vortexSettings.dissipationDuration)
        : 0
      const elapsed = getGrowthVortexElapsed(frame, seed)
      getGrowthVortexPosition(seed, elapsed, dissipationProgress, anchor, vortexSettings, pathPoint, scaleY, frame.reducedMotion ? 0.3 : 1)
      const palette = seed.palette < 0.63 ? vortexChampagne : seed.palette < 0.86 ? vortexPearl : vortexRose
      particleColor.copy(vortexColor).lerp(palette, seed.palette < 0.63 ? 0.24 : 0.58)
      const size = vortexSettings.particleSize * (1 - vortexSettings.sizeVariation * 0.5 + seed.size * vortexSettings.sizeVariation)
      writePoint(positions, sizes, opacities, colors, glows, slot, pathPoint, size * getGrowthVortexSizeScale(dissipationProgress),
        opacity * seed.brightness * vortexSettings.brightness * 0.34,
        particleColor, seed.glow * (0.5 + vortexSettings.brightness * 0.28))
    }

    const pollenCount = getBloomPollenParticleLimit(pollenSettings.particleCount, frame.quality, frame.reducedMotion)
    const openProgress = clamp(frame.bloomClipTime / Math.max(0.001, frame.bloomClipDuration))
    const pollenEnabled = frame.scene === 'bloom' && frame.bloomOpen && pollenSettings.enabled
    if (cup) cup.getWorldPosition(cupAnchor)
    else if (head) head.getWorldPosition(cupAnchor)
    else cupAnchor.set(0, 0, 0)
    antherAnchor.set(0, 0, 0)
    if (anthers.length) {
      for (const anther of anthers) {
        anther.getWorldPosition(pathPoint)
        antherAnchor.add(pathPoint)
      }
      antherAnchor.multiplyScalar(1 / anthers.length)
      cupAnchor.lerp(antherAnchor, 0.34)
    }
    parent.worldToLocal(cupAnchor)
    const postOpenAge = Math.max(0, frame.time - frame.bloomFrames.opening[1])
    const handoffFade = 1 - smooth((frame.time - (frame.bloomFrames.duration - 1.4)) / 1.4)
    const pollenBase = MAGIC_PARTICLE_OFFSET + VORTEX_CAPACITY
    for (let index = 0; index < POLLEN_CAPACITY; index++) {
      const seed = pollenSeeds[index]!
      const slot = pollenBase + index
      const ageSample = getBloomPollenAge(seed, frame.bloomClipTime, frame.bloomClipDuration, postOpenAge,
        frame.bloomFrames.contemplate[1] - frame.bloomFrames.contemplate[0], pollenSettings.lifetime)
      const handoffOpacity = ageSample.terminalTail
        ? 1 - 0.55 * smooth((frame.time - (frame.bloomFrames.duration - 1.4)) / 1.4)
        : handoffFade
      const opacity = pollenEnabled && index < pollenCount
        ? getBloomPollenOpacity(seed, openProgress, ageSample.age, pollenSettings) * handoffOpacity
        : 0
      getBloomPollenPosition(seed, ageSample.age, cupAnchor, pollenSettings, pathPoint, scaleY, frame.reducedMotion ? 0.35 : 1)
      particleColor.copy(pollenGold).lerp(pollenPearl, seed.brightness * 0.54)
      writePoint(positions, sizes, opacities, colors, glows, slot, pathPoint,
        pollenSettings.particleSize * (0.78 + seed.size * 0.36), opacity,
        particleColor, 0.35 + pollenSettings.glowIntensity * 0.4)
    }
    const cupGlowAlpha = pollenEnabled
      ? 0.11 * pollenSettings.innerCupGlow * smooth(openProgress / 0.72)
        * (1 - 0.58 * smooth((openProgress - 0.9) / 0.1)) * handoffFade
      : 0
    writePoint(positions, sizes, opacities, colors, glows, CUP_GLOW_INDEX, cupAnchor,
      14 + pollenSettings.innerCupGlow * 16, cupGlowAlpha, cupGlowColor, 0.72)

    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.aSize!.needsUpdate = true
    geometry.attributes.aOpacity!.needsUpdate = true
    geometry.attributes.aGlow!.needsUpdate = true
    geometry.attributes.color!.needsUpdate = true
    material.uniforms.uPixelRatio!.value = frame.pixelRatio
    material.uniforms.uBrightness!.value = 1
    material.uniforms.uGlowStrength!.value = settings.vfxParticleGlow
  }

  return {
    geometry,
    material,
    particleSources,
    update,
    dispose() {
      if (disposed) return
      disposed = true
      parent.remove(effects)
      geometry.dispose()
      material.dispose()
    },
  }
}
