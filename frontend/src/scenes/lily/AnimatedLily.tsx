import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Material, Mesh, type Group } from 'three'
import type { SceneProps } from '../../engine/sceneTypes'
import { getBloomSceneFrames, getGrowthSceneFrames } from '../../engine/filmConfig'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { getGrowthClipTime, getSyncedBloomClipTime } from './animationTiming'
import { createProceduralLily } from './procedural/plant'
import { subscribeLilyAnimationClock } from './animationClock'
import { lilyDissolvePart, type LilySurfaceSource } from './particleSource'
import { patchLilyMaterial, setLilySurfaceBounds, updateLilyDissolve, updateLilyParticleSettings, type LilyDissolveUniforms } from './dissolve'
import { createLilyAppearanceUniforms, lilyAppearancePart, patchLilyAppearanceMaterial, updateLilyAppearance, type LilyAppearanceUniforms } from './lilyAppearance'
import { createLilyGrowthVfx, type LilyGrowthVfx } from './lilyGrowthVfx'
import { captureLilySurfaceForPreparation, createLilyParticleGeometrySetup, lilyParticlePreparation } from './lilyParticlePreparation'
import { LILY_PARTICLE_MODEL_POSITION, LILY_PARTICLE_MODEL_SCALE } from './lilyParticlePose'
import { enableGrowthObjectShadows, shouldUseGrowthShadows } from '../growth/sceneShadows'

interface LilyMaterialState {
  material: Material
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

function bindLilyMaterials(root: Group, uniforms: LilyDissolveUniforms, appearanceUniforms: LilyAppearanceUniforms) {
  const originals = new Map<Material, { compile: Material['onBeforeCompile']; key: Material['customProgramCacheKey'] }>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const part = lilyDissolvePart(object.name, materials.map((material) => material.name))
    const appearancePart = lilyAppearancePart(object.name, materials.map((material) => material.name), part)
    for (const material of materials) {
      if (originals.has(material)) continue
      originals.set(material, { compile: material.onBeforeCompile, key: material.customProgramCacheKey })
      const originalCompile = material.onBeforeCompile
      const originalKey = material.customProgramCacheKey()
      patchLilyMaterial(material, part, uniforms)
      const dissolveCompile = material.onBeforeCompile
      const dissolveKey = material.customProgramCacheKey
      material.onBeforeCompile = (...args: Parameters<Material['onBeforeCompile']>) => {
        originalCompile.call(material, ...args)
        dissolveCompile.call(material, ...args)
      }
      material.customProgramCacheKey = () => `${originalKey}:${dissolveKey()}`
      patchLilyAppearanceMaterial(material, appearancePart, appearanceUniforms)
    }
  })
  const states = [...originals.keys()].map((material) => ({
    material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
  }))
  return { states, restore() {
    for (const [material, original] of originals) {
      material.onBeforeCompile = original.compile
      material.customProgramCacheKey = original.key
      material.needsUpdate = true
    }
  } }
}

function setLilyOpacity(states: LilyMaterialState[], opacity: number) {
  const alpha = Math.min(1, Math.max(0, opacity))
  for (const state of states) {
    const transparent = state.transparent || alpha < 0.999
    state.material.opacity = state.opacity * alpha
    state.material.depthWrite = alpha < 0.999 ? false : state.depthWrite
    if (state.material.transparent !== transparent) {
      state.material.transparent = transparent
      state.material.needsUpdate = true
    }
  }
}

type AnimatedLilyProps = SceneProps & {
  onParticleSource?: (source: LilySurfaceSource) => void
  onParticleSourceError?: (error: unknown) => void
  sourceAttempt?: number
  dissolveUniforms: LilyDissolveUniforms
}

/** Own creation and disposal in an effect, including StrictMode's rehearsal mount. */
export function AnimatedLily(props: AnimatedLilyProps) {
  const [plant, setPlant] = useState<ReturnType<typeof createProceduralLily> | null>(null)
  useEffect(() => {
    const instance = createProceduralLily()
    let cancelled = false
    const publish = () => { if (!cancelled) setPlant(instance) }
    // Texture loading provides its own material fallback; still mount the plant
    // if a future optional resource rejects unexpectedly.
    void instance.ready.then(publish, publish)
    return () => { cancelled = true; instance.dispose() }
  }, [])
  return plant ? <AnimatedLilyInstance {...props} plant={plant} /> : null
}

function AnimatedLilyInstance({ state, runtime, reducedMotion, onParticleSource, onParticleSourceError, sourceAttempt = 0, dissolveUniforms, plant }: AnimatedLilyProps & { plant: ReturnType<typeof createProceduralLily> }) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const pixelRatio = useThree(({ viewport }) => viewport.dpr)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const preparationSnapshot = useSyncExternalStore(lilyParticlePreparation.subscribe, lilyParticlePreparation.getSnapshot, lilyParticlePreparation.getSnapshot)
  const screenSize = useThree(({ size }) => size)
  const model = plant.object
  const appearanceUniforms = useMemo(() => createLilyAppearanceUniforms(), [])
  const stateRef = useRef(state)
  const modelRef = useRef<Group | null>(null)
  const wrapperRef = useRef<Group | null>(null)
  const growthVfxRef = useRef<LilyGrowthVfx | null>(null)
  const materialsRef = useRef<LilyMaterialState[]>([])
  const particleSourceRef = useRef<LilySurfaceSource | null>(null)
  const growthWorldActive = shouldUseGrowthShadows(state.scene)
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => {
    if (!growthWorldActive) return
    return enableGrowthObjectShadows(model)
  }, [growthWorldActive, model])
  useLayoutEffect(() => {
    const binding = bindLilyMaterials(model, dissolveUniforms, appearanceUniforms)
    materialsRef.current = binding.states
    return () => {
      binding.restore()
      if (materialsRef.current === binding.states) materialsRef.current = []
    }
  }, [model, dissolveUniforms, appearanceUniforms])
  useEffect(() => { void plant.ready.then(() => invalidate()) }, [plant, invalidate])
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const effects = createLilyGrowthVfx(wrapper, model)
    growthVfxRef.current = effects
    return () => {
      effects.dispose()
      if (growthVfxRef.current === effects) growthVfxRef.current = null
    }
  }, [model])
  useLayoutEffect(() => {
    if (state.scene !== 'identity' || particleSourceRef.current || !onParticleSource) return
    const setup = createLilyParticleGeometrySetup({
      config, width: screenSize.width, height: screenSize.height, reducedMotion, bloomClipDuration: 1,
    })
    const prepared = lilyParticlePreparation.getForKey(setup.key)
    if (prepared?.source) {
      setLilySurfaceBounds(dissolveUniforms, prepared.source)
      particleSourceRef.current = prepared.source
      onParticleSource(prepared.source)
      return
    }
    // The preparation screen owns matching worker input until its source is
    // available; don't capture a second copy when a DEV jump enters scene 04.
    const currentPreparation = lilyParticlePreparation.getSnapshot()
    if (currentPreparation.status === 'preparing' && currentPreparation.key === setup.seedKey) return
    // An independent pose cannot change while asynchronous capture yields.
    let cancelled = false
    void captureLilySurfaceForPreparation(() => cancelled, config.scenes.growth.lilyRotation).then(({ source }) => {
      if (cancelled) return
      setLilySurfaceBounds(dissolveUniforms, source)
      particleSourceRef.current = source
      onParticleSource(source)
    }).catch((reason: unknown) => {
      if (cancelled || (reason instanceof Error && reason.name === 'AbortError')) return
      console.error('Scene 04 lily surface capture failed.', reason)
      onParticleSourceError?.(reason)
    })
    return () => { cancelled = true }
  }, [config, dissolveUniforms, onParticleSource, onParticleSourceError, preparationSnapshot, reducedMotion, screenSize.height, screenSize.width, sourceAttempt, state.scene])

  const draw = useCallback((time: number) => {
    const currentState = stateRef.current
    const modelObject = modelRef.current
    if (!modelObject) return
    const scene = currentState.scene
    const growthFrames = getGrowthSceneFrames(config.scenes.growth)
    const bloomFrames = getBloomSceneFrames(config.scenes.bloom)
    const growthDuration = 9
    const bloomDuration = 1
    let growthClipTime = 0
    let bloomClipTime = 0
    updateLilyDissolve(dissolveUniforms, scene === 'identity', time, config.scenes.identity.dissolveDuration, config.scenes.identity.edgeWidth)
    updateLilyParticleSettings(dissolveUniforms, config.scenes.identity)
    if (scene === 'growth') {
      modelObject.visible = time >= growthFrames.model[0]
      growthClipTime = getGrowthClipTime(time, growthFrames, growthDuration)
      plant.setPose(growthClipTime / growthDuration, 0)
    } else if (scene === 'bloom') {
      modelObject.visible = true
      bloomClipTime = getSyncedBloomClipTime(
        time, bloomFrames.opening, bloomDuration, reducedMotion,
        config.scenes.bloom.cameraApproachDuration, config.scenes.bloom.cameraBloomSync,
      )
      plant.setPose(1, bloomClipTime / bloomDuration)
    } else if (scene === 'identity') {
      modelObject.visible = time < config.scenes.identity.dissolveDuration
      plant.setPose(1, 1)
    } else {
      modelObject.visible = false
    }
    setLilyOpacity(materialsRef.current, 1)
    const growthProgress = scene === 'growth' ? growthClipTime / growthDuration
      : scene === 'bloom' || scene === 'identity' ? 1 : 0
    const bloomProgress = scene === 'identity' ? 1 : bloomClipTime / bloomDuration
    const flowerCenter = modelObject.getObjectByName('Flower_Interior')
    if (flowerCenter) flowerCenter.getWorldPosition(appearanceUniforms.uLilyCupCenter.value)
    updateLilyAppearance(appearanceUniforms, config.scenes.growth.lilyBudGlow, config.scenes.growth.lilyLeafMaterial,
      growthProgress, bloomProgress, config.scenes.bloom.lilyBloomPollen)
    growthVfxRef.current?.update({
      scene, time, clipTime: growthClipTime, clipDuration: growthDuration,
      frames: growthFrames, bloomFrames, bloomClipTime, bloomClipDuration: bloomDuration,
      bloomOpen: scene === 'bloom', bloomElapsed: scene === 'bloom' ? time : 0,
      pixelRatio, reducedMotion, quality: currentState.quality,
    }, config.scenes.growth, config.scenes.bloom.lilyBloomPollen)
    invalidate()
  }, [appearanceUniforms, config.scenes.bloom, config.scenes.growth, config.scenes.identity, dissolveUniforms, plant, invalidate, pixelRatio, reducedMotion])

  useLayoutEffect(() => {
    const sync = () => draw(runtime.time)
    sync()
    return subscribeLilyAnimationClock(runtime, sync)
  }, [draw, model, runtime, state.scene, state.mode, reducedMotion])

  return <group ref={wrapperRef} position={LILY_PARTICLE_MODEL_POSITION} scale={LILY_PARTICLE_MODEL_SCALE} rotation-y={config.scenes.growth.lilyRotation * Math.PI / 180}>
    <primitive ref={modelRef} object={model} dispose={null} />
  </group>
}
