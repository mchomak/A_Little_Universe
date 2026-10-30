import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  FloatType,
  GLSL3,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  Vector4,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { createSeedInitialState, createSeedTargets } from './seedTargets'
import {
  recstudioVelocityShader,
  simulationCopyShader,
  simulationPositionShader,
  simulationVertexShader,
} from './recstudioParticleShaders'

export const PARTICLE_FIXED_STEP = 1 / 30
export const PARTICLE_CHECKPOINT_INTERVAL = 15
const PARTICLE_SEED = 0x51eed02
const PARTICLE_TAIL_SECONDS = 0.95
const MAX_FORMATION_SECONDS = 3.5

export type SeedSimulationSettings = SceneComposerConfig['scenes']['growth']

/** Changes to the force field rebuild canonical history; visual-only edits preserve it. */
export function requiresSimulationReset(previous: SeedSimulationSettings, next: SeedSimulationSettings): boolean {
  return getPhysicsSignature(previous) !== getPhysicsSignature(next)
}

function getPhysicsSignature(settings: SeedSimulationSettings) {
  return [settings.cloudRadius, settings.freeParticleFraction, settings.noiseStrength,
    settings.attractionStrength, settings.attractionRampDuration, settings.morphDamping,
    settings.formationDuration].join(':')
}

export interface ReplayPlan {
  restoreStep: number | null
  targetStep: number
}

/** Forward time stays incremental; a backward scrub restores its nearest prior state. */
export function getReplayPlan(currentStep: number, targetStep: number, checkpoints: readonly number[]): ReplayPlan {
  const target = Math.max(0, Math.floor(targetStep))
  if (target >= currentStep) return { restoreStep: null, targetStep: target }
  const restoreStep = checkpoints.reduce((best, step) => step <= target && step > best ? step : best, 0)
  return { restoreStep, targetStep: target }
}

/** Executes the same restore/copy/step/checkpoint order used by the GPU backend. */
export function replaySimulationSteps(
  currentStep: number,
  targetStep: number,
  checkpoints: readonly number[],
  actions: {
    restore(step: number): void
    step(step: number): void
    checkpoint(step: number): void
  },
  checkpointInterval = PARTICLE_CHECKPOINT_INTERVAL,
): number {
  const plan = getReplayPlan(currentStep, targetStep, checkpoints)
  let activeStep = currentStep
  if (plan.restoreStep !== null) {
    actions.restore(plan.restoreStep)
    activeStep = plan.restoreStep
  }
  while (activeStep < plan.targetStep) {
    activeStep += 1
    actions.step(activeStep)
    if (activeStep % checkpointInterval === 0) actions.checkpoint(activeStep)
  }
  return activeStep
}

/** Slow early attraction preserves the free cloud, then eases into full spring force. */
export function getMorphInfluence(time: number, rampDuration: number): number {
  const progress = clamp01(time / Math.max(0.1, rampDuration))
  return smooth(progress * progress)
}

interface PingPong {
  targets: [WebGLRenderTarget, WebGLRenderTarget]
  index: 0 | 1
  get texture(): Texture
  get writeTarget(): WebGLRenderTarget
  swap(): void
  dispose(): void
}

function createPingPong(size: number): PingPong {
  const options = {
    type: FloatType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  } as const
  const targets: [WebGLRenderTarget, WebGLRenderTarget] = [
    new WebGLRenderTarget(size, size, options),
    new WebGLRenderTarget(size, size, options),
  ]
  return {
    targets,
    index: 0,
    get texture() { return targets[this.index].texture },
    get writeTarget() { return targets[this.index === 0 ? 1 : 0] },
    swap() { this.index = this.index === 0 ? 1 : 0 },
    dispose() { targets.forEach(target => target.dispose()) },
  }
}

function createFloatTexture(data: Float32Array, size: number): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, FloatType)
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.flipY = false
  texture.unpackAlignment = 1
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}

interface Checkpoint {
  step: number
  position: WebGLRenderTarget
  velocity: WebGLRenderTarget
}

/**
 * RecStudio's GPGPU integration on the film's one shared renderer. State is
 * seeded, fixed-step, checkpointed on the GPU, and replayed after backward seek.
 */
export class RecStudioParticleSimulation {
  readonly count: number
  readonly side: number
  private readonly renderer: WebGLRenderer
  private readonly position: PingPong
  private readonly velocity: PingPong
  private readonly targetTexture: DataTexture
  private readonly initialPositionTexture: DataTexture
  private readonly initialVelocityTexture: DataTexture
  private readonly velocityMaterial: RawShaderMaterial
  private readonly positionMaterial: RawShaderMaterial
  private readonly copyMaterial: RawShaderMaterial
  private readonly simulationScene: Scene
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quadGeometry = new PlaneGeometry(2, 2)
  private readonly quad: Mesh
  private readonly checkpoints = new Map<number, Checkpoint>()
  private stepIndex = 0
  private disposed = false
  private settings: SeedSimulationSettings

  constructor(renderer: WebGLRenderer, side: number, settings: SeedSimulationSettings) {
    this.renderer = renderer
    this.side = side
    this.count = side * side
    this.settings = settings

    const gl = renderer.getContext()
    if (!renderer.capabilities.isWebGL2 || !gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('Float render targets are unavailable; the growth scene will use its analytic fallback.')
    }

    const initial = createSeedInitialState(this.count, PARTICLE_SEED, settings.cloudRadius)
    this.initialPositionTexture = createFloatTexture(initial.positions, side)
    this.initialVelocityTexture = createFloatTexture(initial.velocities, side)
    this.targetTexture = createFloatTexture(createSeedTargets(this.count, PARTICLE_SEED, settings.freeParticleFraction), side)
    this.position = createPingPong(side)
    this.velocity = createPingPong(side)
    this.velocityMaterial = this.makeMaterial(recstudioVelocityShader, {
      uPosition: { value: null }, uVelocity: { value: null }, uTarget: { value: this.targetTexture },
      uDt: { value: PARTICLE_FIXED_STEP }, uTime: { value: 0 }, uMorph: { value: 0 },
      uNoiseStrength: { value: settings.noiseStrength }, uSpring: { value: settings.attractionStrength },
      uDamping: { value: 0.48 }, uMorphDamping: { value: settings.morphDamping },
      uCloudRadius: { value: settings.cloudRadius },
    })
    this.positionMaterial = this.makeMaterial(simulationPositionShader, {
      uPosition: { value: null }, uVelocity: { value: null }, uDt: { value: PARTICLE_FIXED_STEP },
    })
    this.copyMaterial = this.makeMaterial(simulationCopyShader, { uSource: { value: null } })
    this.simulationScene = new Scene()
    this.quad = new Mesh(this.quadGeometry, this.velocityMaterial)
    this.simulationScene.add(this.quad)

    try {
      this.seedInitialState()
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  get positionTexture(): Texture { return this.position.texture }
  get velocityTexture(): Texture { return this.velocity.texture }
  get targetTextureView(): Texture { return this.targetTexture }
  get currentStep(): number { return this.stepIndex }

  /** Update live inspector parameters and invalidate old checkpoints when motion changes. */
  configure(settings: SeedSimulationSettings) {
    const changed = requiresSimulationReset(this.settings, settings)
    if (changed) {
      this.disposeCheckpoints()
      if (settings.cloudRadius !== this.settings.cloudRadius) {
        const nextInitial = createSeedInitialState(this.count, PARTICLE_SEED, settings.cloudRadius)
        setTextureData(this.initialPositionTexture, nextInitial.positions)
        setTextureData(this.initialVelocityTexture, nextInitial.velocities)
        this.initialPositionTexture.needsUpdate = true
        this.initialVelocityTexture.needsUpdate = true
      }
      if (settings.freeParticleFraction !== this.settings.freeParticleFraction) {
        setTextureData(this.targetTexture, createSeedTargets(this.count, PARTICLE_SEED, settings.freeParticleFraction))
        this.targetTexture.needsUpdate = true
      }
    }
    this.settings = settings
    const uniforms = this.velocityMaterial.uniforms
    uniforms.uNoiseStrength!.value = settings.noiseStrength
    uniforms.uSpring!.value = settings.attractionStrength
    uniforms.uMorphDamping!.value = settings.morphDamping
    uniforms.uCloudRadius!.value = settings.cloudRadius
    uniforms.uTarget!.value = this.targetTexture
    return changed
  }

  /** Reconstruct a canonical sample, bounded to the short formation and spark tail. */
  advance(time: number, settings: SeedSimulationSettings) {
    if (this.disposed) return
    if (this.configure(settings)) this.seedInitialState()
    const formationDuration = Math.max(2.5, Math.min(MAX_FORMATION_SECONDS, settings.formationDuration))
    const boundedTime = Math.max(0, Math.min(time, formationDuration + PARTICLE_TAIL_SECONDS))
    const targetStep = Math.floor(boundedTime / PARTICLE_FIXED_STEP + 1e-6)
    this.stepIndex = replaySimulationSteps(this.stepIndex, targetStep, [0, ...this.checkpoints.keys()], {
      restore: step => this.restoreStep(step),
      step: step => {
        this.step(step * PARTICLE_FIXED_STEP, settings)
        this.stepIndex = step
      },
      checkpoint: () => this.saveCheckpoint(),
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.disposeCheckpoints()
    this.position?.dispose()
    this.velocity?.dispose()
    this.targetTexture?.dispose()
    this.initialPositionTexture?.dispose()
    this.initialVelocityTexture?.dispose()
    this.quadGeometry?.dispose()
    this.velocityMaterial?.dispose()
    this.positionMaterial?.dispose()
    this.copyMaterial?.dispose()
    this.simulationScene?.clear()
  }

  private makeMaterial(fragmentShader: string, uniforms: Record<string, { value: unknown }>) {
    return new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: simulationVertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  }

  private seedInitialState() {
    this.position.index = 0
    this.velocity.index = 0
    for (const target of this.position.targets) this.blit(this.initialPositionTexture, target)
    for (const target of this.velocity.targets) this.blit(this.initialVelocityTexture, target)
    this.stepIndex = 0
  }

  private step(time: number, settings: SeedSimulationSettings) {
    this.velocityMaterial.uniforms.uPosition!.value = this.position.texture
    this.velocityMaterial.uniforms.uVelocity!.value = this.velocity.texture
    this.velocityMaterial.uniforms.uTime!.value = time
    const ramp = Math.min(settings.attractionRampDuration, settings.formationDuration * 0.88)
    this.velocityMaterial.uniforms.uMorph!.value = getMorphInfluence(time, ramp)
    this.quad.material = this.velocityMaterial
    this.blit(undefined, this.velocity.writeTarget)
    this.velocity.swap()

    this.positionMaterial.uniforms.uPosition!.value = this.position.texture
    this.positionMaterial.uniforms.uVelocity!.value = this.velocity.texture
    this.positionMaterial.uniforms.uDt!.value = PARTICLE_FIXED_STEP
    this.quad.material = this.positionMaterial
    this.blit(undefined, this.position.writeTarget)
    this.position.swap()
  }

  private saveCheckpoint() {
    if (this.checkpoints.has(this.stepIndex)) return
    const checkpoint = {
      step: this.stepIndex,
      position: new WebGLRenderTarget(this.side, this.side, targetOptions),
      velocity: new WebGLRenderTarget(this.side, this.side, targetOptions),
    }
    this.blit(this.position.texture, checkpoint.position)
    this.blit(this.velocity.texture, checkpoint.velocity)
    this.checkpoints.set(checkpoint.step, checkpoint)
  }

  private restoreStep(step: number) {
    const checkpoint = this.checkpoints.get(step)
    if (checkpoint) {
      this.position.index = 0
      this.velocity.index = 0
      for (const target of this.position.targets) this.blit(checkpoint.position.texture, target)
      for (const target of this.velocity.targets) this.blit(checkpoint.velocity.texture, target)
      this.stepIndex = step
    } else this.seedInitialState()
  }

  private disposeCheckpoints() {
    for (const checkpoint of this.checkpoints.values()) {
      checkpoint.position.dispose()
      checkpoint.velocity.dispose()
    }
    this.checkpoints.clear()
  }

  private blit(source: Texture | undefined, target: WebGLRenderTarget) {
    if (source) this.copyMaterial.uniforms.uSource!.value = source
    this.quad.material = source ? this.copyMaterial : this.quad.material
    withRendererState(this.renderer, () => {
      this.renderer.setRenderTarget(target)
      this.renderer.setViewport(0, 0, this.side, this.side)
      this.renderer.setScissorTest(false)
      this.renderer.render(this.simulationScene, this.camera)
    })
  }
}

const targetOptions = {
  type: FloatType,
  format: RGBAFormat,
  minFilter: NearestFilter,
  magFilter: NearestFilter,
  wrapS: ClampToEdgeWrapping,
  wrapT: ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
  generateMipmaps: false,
} as const

/** Restore every renderer setting this private pass can disturb. */
function withRendererState(renderer: WebGLRenderer, render: () => void) {
  const previousTarget = renderer.getRenderTarget()
  const previousFace = renderer.getActiveCubeFace()
  const previousMip = renderer.getActiveMipmapLevel()
  const previousViewport = renderer.getViewport(new Vector4())
  const previousScissor = renderer.getScissor(new Vector4())
  const previousScissorTest = renderer.getScissorTest()
  const previousClearColor = renderer.getClearColor(new Color())
  const previousClearAlpha = renderer.getClearAlpha()
  const previousAutoClear = renderer.autoClear
  const previousXrEnabled = renderer.xr.enabled
  try {
    renderer.autoClear = false
    renderer.xr.enabled = false
    render()
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousMip)
    renderer.setViewport(previousViewport)
    renderer.setScissor(previousScissor)
    renderer.setScissorTest(previousScissorTest)
    renderer.setClearColor(previousClearColor, previousClearAlpha)
    renderer.autoClear = previousAutoClear
    renderer.xr.enabled = previousXrEnabled
  }
}

function clamp01(value: number) { return Math.min(1, Math.max(0, value)) }
function smooth(value: number) { return value * value * (3 - 2 * value) }

function setTextureData(texture: DataTexture, nextData: Float32Array) {
  const data = texture.image.data
  if (!(data instanceof Float32Array) || data.length !== nextData.length) {
    throw new Error('Particle texture data could not be updated for this GPU simulation.')
  }
  data.set(nextData)
}

