import {
  AdditiveBlending, AnimationClip, BufferAttribute, BufferGeometry, Color, Group,
  InterpolateDiscrete, InterpolateSmooth, Matrix4, Mesh, Points, ShaderMaterial,
  StreamDrawUsage, Vector3, type Object3D,
} from 'three'
import type { GrowthSceneFrames } from '../../engine/filmConfig'
import type { SceneId } from '../../engine/film'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import type { Quality } from '../../engine/film'

const IMPULSE_POINTS = 14
const PARTICLE_CAPACITY = 240
const CORE_POINTS = 2
const TOTAL_POINTS = IMPULSE_POINTS + CORE_POINTS + PARTICLE_CAPACITY
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

export type LilyGrowthVfxSettings = SceneComposerConfig['scenes']['growth']

export interface LilyGrowthVfxFrame {
  scene: SceneId
  time: number
  clipTime: number
  clipDuration: number
  frames: GrowthSceneFrames
  pixelRatio: number
  reducedMotion: boolean
  quality: Quality
}

export interface LilyGrowthVfxEnvelope {
  core: number
  activity: number
  progress: number
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

export function getGrowthVfxParticleLimit(count: number, quality: Quality): number {
  const requested = clamp(count, 0, PARTICLE_CAPACITY)
  return Math.round(requested * (quality === 'low' ? 0.5 : 1))
}

type GrowthParticleSource = 'stem' | 'leafA' | 'leafB' | 'bud'

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
  update(frame: LilyGrowthVfxFrame, settings: LilyGrowthVfxSettings): void
  dispose(): void
  /** Stable typed arrays are exposed for runtime verification and diagnostics. */
  readonly geometry: BufferGeometry
}

const vertexShader = /* glsl */`
  attribute float aSize;
  attribute float aOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uPixelRatio;
  void main() {
    vColor = color;
    vOpacity = aOpacity;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPixelRatio);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uBrightness;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float halo = exp(-radius * radius * 5.2) * (1.0 - smoothstep(0.72, 1.0, radius));
    float core = exp(-radius * radius * 24.0);
    float alpha = vOpacity * (halo * 0.72 + core * 0.36);
    gl_FragColor = vec4(vColor * uBrightness, alpha);
  }
`

function unit(seed: number) {
  const value = Math.sin(seed * 127.1 + 19.19) * 43758.5453
  return value - Math.floor(value)
}

interface ParticleSeed {
  source: GrowthParticleSource
  phase: number
  birthTime: number
  life: number
  size: number
  angle: number
  drift: number
  color: Color
}

function createParticleSeeds(clip: AnimationClip): ParticleSeed[] {
  return Array.from({ length: PARTICLE_CAPACITY }, (_, index) => {
    const selector = unit(index + 10)
    const source = selector < 0.68 ? 'stem' : selector < 0.79 ? 'leafA' : selector < 0.9 ? 'leafB' : 'bud'
    const phase = unit(index + 300)
    const phaseThreshold = 0.04 + phase * 0.84
    return {
      source,
      // These thresholds are measured against each zone's actual posed activation,
      // never against an independent wall clock or guessed clip-time window.
      phase: phaseThreshold,
      birthTime: getGrowthVfxBirthTime(clip, source, phaseThreshold),
      life: 0.55 + unit(index + 600) * 0.8,
      size: 0.65 + unit(index + 900) * 0.9,
      angle: unit(index + 1200) * Math.PI * 2,
      drift: 0.35 + unit(index + 1500) * 0.65,
      color: new Color(source === 'bud'
        ? (index % 3 === 0 ? '#EDC4D3' : index % 3 === 1 ? '#FFF4E8' : '#D6C18D')
        : (index % 3 === 0 ? '#FFF5EA' : index % 3 === 1 ? '#DCE4B9' : '#D8C994')),
    }
  })
}

function findMesh(root: Object3D, name: string): Mesh | null {
  const found = root.getObjectByName(name)
  return found instanceof Mesh ? found : null
}

function writePoint(positions: Float32Array, sizes: Float32Array, opacities: Float32Array, colors: Float32Array, index: number,
  point: Vector3, size: number, opacity: number, color: Color) {
  const offset = index * 3
  positions[offset] = point.x; positions[offset + 1] = point.y; positions[offset + 2] = point.z
  sizes[index] = size; opacities[index] = opacity
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
  sumX: Float64Array; sumY: Float64Array; sumZ: Float64Array; count: Uint16Array; point: Vector3
  posed: Float32Array; parentInverse: Matrix4; meshToLocal: Matrix4
}): number {
  if (!mesh) return 0
  const attribute = mesh.geometry.getAttribute('position')
  if (!attribute) return 0
  const bins = positions.length
  const { sumX, sumY, sumZ, count, point, posed, parentInverse, meshToLocal } = binsData
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
  let first = 0
  while (first < bins && !count[first]) first++
  if (first === bins) return 0
  for (let bin = 0; bin < first; bin++) positions[bin]!.copy(positions[first]!)
  let previous = first
  for (let bin = first + 1; bin < bins; bin++) {
    if (count[bin]) { previous = bin; continue }
    let next = bin + 1
    while (next < bins && !count[next]) next++
    if (next < bins) positions[bin]!.lerpVectors(positions[previous]!, positions[next]!, (bin - previous) / (next - previous))
    else positions[bin]!.copy(positions[previous]!)
  }
  return filled > 2 ? bins : 0
}

function sampleCurve(curve: Vector3[], progress: number, out: Vector3) {
  const scaled = clamp(progress) * (curve.length - 1)
  const index = Math.min(curve.length - 2, Math.floor(scaled))
  return out.lerpVectors(curve[index]!, curve[index + 1]!, scaled - index)
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
  const colors = new Float32Array(TOTAL_POINTS * 3)
  geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(StreamDrawUsage))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1).setUsage(StreamDrawUsage))
  geometry.setAttribute('aOpacity', new BufferAttribute(opacities, 1).setUsage(StreamDrawUsage))
  geometry.setAttribute('color', new BufferAttribute(colors, 3).setUsage(StreamDrawUsage))
  geometry.setDrawRange(0, TOTAL_POINTS)
  const material = new ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending,
    toneMapped: false, vertexColors: true,
    uniforms: { uPixelRatio: { value: 1 }, uBrightness: { value: 1 } },
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
  const curve = Array.from({ length: 32 }, () => new Vector3())
  const stemVertexCount = stem?.geometry.getAttribute('position')?.count ?? 0
  const binsData = {
    sumX: new Float64Array(curve.length), sumY: new Float64Array(curve.length), sumZ: new Float64Array(curve.length),
    count: new Uint16Array(curve.length), point: new Vector3(), posed: new Float32Array(stemVertexCount * 3),
    parentInverse: new Matrix4(), meshToLocal: new Matrix4(),
  }
  const seeds = createParticleSeeds(growthClip)
  const particleScratch = Array.from({ length: PARTICLE_CAPACITY }, () => [new Vector3(), new Vector3(), new Vector3()] as [Vector3, Vector3, Vector3])
  const baseColor = new Color('#F5D9A4').lerp(new Color('#FFF4E8'), 0.18)
  const pearl = new Color('#FFF4E8')
  const pulseColor = new Color('#F4DFB8')
  const anchor = new Vector3()
  const tangent = new Vector3()
  const pathPoint = new Vector3()
  const pathAhead = new Vector3()
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

  const update = (frame: LilyGrowthVfxFrame, settings: LilyGrowthVfxSettings) => {
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
    writePoint(positions, sizes, opacities, colors, IMPULSE_POINTS, anchor, 23, coreOpacity * settings.vfxCoreIntensity * 0.42, baseColor)
    writePoint(positions, sizes, opacities, colors, IMPULSE_POINTS + 1, anchor, 8.5, coreOpacity * settings.vfxCoreIntensity, pearl)

    const curveCount = frame.scene === 'growth' ? getStemCurve(stem, parent, curve, binsData) : 0
    const active = frame.scene === 'growth' && !frame.reducedMotion ? envelope.activity : 0
    const pulseProgress = envelope.progress
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
    for (let index = 0; index < IMPULSE_POINTS; index++) {
      const trail = index / (IMPULSE_POINTS - 1)
      const along = Math.max(0, pulseProgress - pulseWidth * trail)
      const opacity = active * settings.vfxPulseBrightness * (1 - trail) ** 1.45
      if (curveCount && opacity > 0.001) {
        sampleCurve(curve, along, pathPoint)
        sampleCurve(curve, Math.min(1, along + 0.02), pathAhead)
        const fringe = Math.sin(index * 1.72 + frame.clipTime * 2.3) * 0.004
        pathPoint.x += fringe; pathPoint.z -= fringe * 0.7
      } else pathPoint.set(0, -1000, 0)
      writePoint(positions, sizes, opacities, colors, index, pathPoint, 3.6 + (1 - trail) * 3.2, opacity, pulseColor)
    }

    const lifeSeconds = Math.max(0.25, 0.98 / settings.vfxParticleSpeed)
    const particleLimit = getGrowthVfxParticleLimit(settings.vfxParticleCount, frame.quality)
    for (let index = 0; index < PARTICLE_CAPACITY; index++) {
      const seed = seeds[index]!
      const slot = IMPULSE_POINTS + CORE_POINTS + index
      const zoneActivation = seed.source === 'stem' ? pulseProgress
        : seed.source === 'bud' ? getBudGrowthActivation(head?.scale.x ?? 0)
          : leafActivation[seed.source === 'leafA' ? 0 : 1]!
      const age = frame.clipTime - seed.birthTime
      const life = lifeSeconds * seed.life
      let opacity = active * smooth(age / 0.16) * (1 - smooth((age - life + 0.12) / 0.28))
      if (age < 0 || age > life || zoneActivation < seed.phase || index >= particleLimit) opacity = 0
      let sampled = false
      const surface = particleSurface
      if (opacity > 0.002) {
        if (seed.source === 'stem' && curveCount) {
          const emitterProgress = clamp(seed.phase + 0.018 + age * 0.018)
          sampleCurve(curve, emitterProgress, particleCenter)
          sampleCurve(curve, Math.min(1, emitterProgress + 0.035), pathAhead)
          tangent.subVectors(pathAhead, particleCenter).normalize()
          const radius = 0.018 + seed.drift * 0.018
          const angle = seed.angle + age * settings.vfxParticleSpeed * 1.45
          surface.copy(particleCenter).addScaledVector(tangent, age * settings.vfxParticleSpeed * 0.035)
          surface.x += Math.cos(angle) * radius
          surface.z += Math.sin(angle) * radius
          sampled = true
        } else if (seed.source === 'leafA' || seed.source === 'leafB') {
          const leafIndex = seed.source === 'leafA' ? 0 : 1
          const leaf = leaves[leafIndex]
          sampled = sampleMeshSurface(leaf, index, parent, surface, particleScratch[index]!)
          if (sampled) {
            const angle = seed.angle + age * settings.vfxParticleSpeed
            const direction = leafDirections[leafIndex]!
            const perpendicular = leafPerpendicular[leafIndex]!
            secondPerpendicular.crossVectors(direction, perpendicular).normalize()
            surface.addScaledVector(direction, age * settings.vfxParticleSpeed * 0.09)
            surface.addScaledVector(perpendicular, Math.cos(angle) * 0.018)
            surface.addScaledVector(secondPerpendicular, Math.sin(angle) * 0.018)
            const arrival = getGrowthZonePulse(pulseProgress, leafZoneProgress[leafIndex]!, pulseWidth * 0.55, leafActivation[leafIndex]!)
            opacity *= 1 + arrival * 1.2
          }
        } else {
          sampled = sampleMeshSurface(bud, index + 400, parent, surface, particleScratch[index]!)
          if (sampled) {
            // A small orbit follows the animated bud surface for a moment, then lifts away.
            const angle = seed.angle + age * settings.vfxParticleSpeed * 0.75
            const radius = 0.012 + age * 0.012
            surface.addScaledVector(budDirection, age * 0.025)
            surface.addScaledVector(budPerpendicular, Math.cos(angle) * radius)
            surface.addScaledVector(secondPerpendicular, Math.sin(angle) * radius)
            const arrival = getGrowthZonePulse(pulseProgress, budZoneProgress, pulseWidth * 0.55, getBudGrowthActivation(head?.scale.x ?? 0))
            opacity *= 1 + arrival * 1.2
          }
        }
      }
      if (!sampled) { surface.set(0, -1000, 0); opacity = 0 }
      const size = settings.vfxParticleSize * seed.size
      writePoint(positions, sizes, opacities, colors, slot, surface, size, opacity * settings.vfxParticleBrightness, seed.color)
    }
    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.aSize!.needsUpdate = true
    geometry.attributes.aOpacity!.needsUpdate = true
    geometry.attributes.color!.needsUpdate = true
    material.uniforms.uPixelRatio!.value = frame.pixelRatio
    material.uniforms.uBrightness!.value = 1
  }

  return {
    geometry,
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
