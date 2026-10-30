import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, Color, MeshBasicMaterial, type Group, type Points } from 'three'
import type { SceneProps } from '../../engine/sceneTypes'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig, type SceneComposerConfig } from '../../systems/scene-config/config'
import { useSceneAnimation } from '../shared/animation'
import { createGalaxyGeometry, type GalaxyGeometrySettings } from './generateGalaxy'
import { applyGalaxyFrameMaterials, createBackgroundGasMaterial, createCoreMaterial, createFogMaterial, createGasMaterial, createStarMaterial, type GalaxyUniforms } from './shaders'
import { getGalaxyFogOpacity, getGalaxyLight, getGalaxyMotionPhase, getGalaxyRevealState } from './animation'
import { getGalaxyColors } from './palette'

type GalaxySceneName = 'cosmos' | 'greeting' | 'ending'
type GalaxySettings = SceneComposerConfig['scenes']['galaxy']

function structureSettings(settings: GalaxySettings, globalQuality: 'standard' | 'low'): GalaxyGeometrySettings {
  return {
    seed: settings.seed, starCount: settings.starCount, arms: settings.arms, radius: settings.radius,
    spin: settings.spin, armWidth: settings.armWidth, scatter: settings.scatter, coreSize: settings.coreSize,
    coreDensity: settings.coreDensity, thickness: settings.thickness, distribution: settings.distribution,
    brightStarCount: settings.brightStarCount, backgroundStarCount: settings.backgroundStarCount,
    backgroundDepth: settings.backgroundDepth, quality: settings.quality, globalQuality,
  }
}

function structureKey(settings: GalaxySettings, globalQuality: 'standard' | 'low') {
  return [settings.seed, settings.starCount, settings.arms, settings.radius, settings.spin, settings.armWidth,
    settings.scatter, settings.coreSize, settings.coreDensity, settings.thickness, settings.distribution,
    settings.brightStarCount, settings.backgroundStarCount, settings.backgroundDepth, settings.quality, globalQuality].join('|')
}

function setColor(uniforms: GalaxyUniforms, key: string, value: string) {
  const uniform = uniforms[key]
  if (uniform?.value instanceof Color) uniform.value.set(value)
}

function updateLiveUniforms(settings: GalaxySettings, dpr: number, materials: {
  disk: ReturnType<typeof createStarMaterial>
  bright: ReturnType<typeof createStarMaterial>
  background: ReturnType<typeof createStarMaterial>
  backgroundGas: ReturnType<typeof createBackgroundGasMaterial>
  gas: ReturnType<typeof createGasMaterial>
  core: ReturnType<typeof createCoreMaterial>
  fog: ReturnType<typeof createFogMaterial>[]
}) {
  const colors = getGalaxyColors(settings)
  const disk = materials.disk.uniforms
  disk.uSize!.value = settings.starSize
  disk.uBrightness!.value = settings.brightness * settings.exposure
  disk.uTwinkle!.value = settings.twinkle
  disk.uTwinkleSpeed!.value = settings.twinkleSpeed
  disk.uSpin!.value = settings.rotationSpeed
  disk.uRadius!.value = settings.radius
  disk.uCoreSize!.value = settings.coreSize
  disk.uDpr!.value = dpr
  setColor(disk, 'uCoreColor', colors.coreColor)
  setColor(disk, 'uInnerColor', colors.innerColor)
  setColor(disk, 'uArmColor', colors.armColor)

  const bright = materials.bright.uniforms
  bright.uSize!.value = settings.brightStarSize
  bright.uBrightness!.value = settings.brightStarIntensity * settings.exposure
  bright.uTwinkle!.value = settings.twinkle * 0.45
  bright.uTwinkleSpeed!.value = settings.twinkleSpeed
  bright.uSpin!.value = settings.rotationSpeed
  bright.uDpr!.value = dpr
  setColor(bright, 'uCoreColor', colors.coreColor)
  setColor(bright, 'uInnerColor', colors.innerColor)
  setColor(bright, 'uArmColor', colors.brightColor)

  const background = materials.background.uniforms
  background.uSize!.value = settings.backgroundSize
  background.uBrightness!.value = settings.backgroundBrightness
  background.uTwinkle!.value = settings.twinkle * 0.4
  background.uTwinkleSpeed!.value = settings.twinkleSpeed * 0.52
  background.uSpin!.value = settings.rotationSpeed * 0.12
  background.uDpr!.value = dpr
  background.uBackground!.value = 1
  setColor(background, 'uCoreColor', colors.innerColor)
  setColor(background, 'uInnerColor', colors.innerColor)
  setColor(background, 'uArmColor', colors.brightColor)

  const backgroundGas = materials.backgroundGas.uniforms
  backgroundGas.uDensity!.value = settings.backgroundGasDensity
  backgroundGas.uBrightness!.value = settings.backgroundGasBrightness
  backgroundGas.uTime!.value = 0
  backgroundGas.uSpeed!.value = settings.nebulaSpeed * 0.45
  setColor(backgroundGas, 'uColor', colors.nebulaColor)

  const gas = materials.gas.uniforms
  gas.uScale!.value = settings.nebulaScale
  gas.uDensity!.value = settings.nebulaDensity
  gas.uBrightness!.value = settings.nebulaBrightness
  gas.uOpacity!.value = settings.nebulaOpacity
  gas.uIntensity!.value = settings.nebulaIntensity
  gas.uSaturation!.value = settings.nebulaSaturation
  gas.uSpeed!.value = settings.nebulaSpeed
  gas.uRadius!.value = settings.radius
  gas.uArms!.value = settings.arms
  gas.uSpin!.value = settings.spin
  gas.uArmWidth!.value = settings.armWidth
  gas.uRotationSpeed!.value = settings.rotationSpeed
  setColor(gas, 'uColor', colors.nebulaColor)

  materials.core.uniforms.uGlow!.value = settings.coreGlow
  setColor(materials.core.uniforms, 'uColor', colors.coreColor)
  for (const [index, fog] of materials.fog.entries()) {
    fog.uniforms.uDensity!.value = settings.fogDensity
    fog.uniforms.uOpacity!.value = settings.fogDensity
    fog.uniforms.uScale!.value = 1.15 + settings.fogDensity * 0.85
    fog.uniforms.uTurbulence!.value = settings.fogTurbulence
    fog.uniforms.uLayer!.value = index
    fog.uniforms.uMotion!.value = settings.nebulaSpeed + 0.008
    setColor(fog.uniforms, 'uColor', colors.nebulaColor)
  }
}

export function GalaxyExperience({ state, runtime, reducedMotion }: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const settings = config.scenes.galaxy
  const structureSignature = structureKey(settings, config.global.quality)
  const [built, setBuilt] = useState(() => structureSettings(settings, config.global.quality))
  const galaxy = useRef<Group>(null)
  const fogGroup = useRef<Group>(null)
  const diskPoints = useRef<Points>(null)
  const brightPoints = useRef<Points>(null)
  const backgroundPoints = useRef<Points>(null)
  const invalidate = useThree((three) => three.invalidate)
  const dpr = useThree((three) => three.viewport.dpr)
  const active = state.scene === 'cosmos' || state.scene === 'greeting' || state.scene === 'ending'
  const scene: GalaxySceneName = state.scene === 'greeting' || state.scene === 'ending' ? state.scene : 'cosmos'
  const materials = useMemo(() => ({
    disk: createStarMaterial(), bright: createStarMaterial(), background: createStarMaterial(),
    backgroundGas: createBackgroundGasMaterial(), gas: createGasMaterial(), core: createCoreMaterial(),
    fog: Array.from({ length: 8 }, () => createFogMaterial()),
  }), [])
  const materialsRef = useRef(materials)
  const geometry = useMemo(() => createGalaxyGeometry(built), [built])
  const baseMaterial = useMemo(() => new MeshBasicMaterial({
    color: '#050812', toneMapped: false, side: BackSide, depthWrite: false,
  }), [])

  useEffect(() => {
    const timer = window.setTimeout(() => setBuilt(structureSettings(getConfig().scenes.galaxy, getConfig().global.quality)), 280)
    return () => window.clearTimeout(timer)
  }, [structureSignature])

  useEffect(() => () => {
    geometry.disk.dispose(); geometry.bright.dispose(); geometry.background.dispose()
  }, [geometry])
  useEffect(() => () => {
    materials.disk.material.dispose(); materials.bright.material.dispose(); materials.background.material.dispose()
    materials.backgroundGas.material.dispose(); materials.gas.material.dispose(); materials.core.material.dispose()
    materials.fog.forEach((fog) => fog.material.dispose())
  }, [materials])
  useEffect(() => () => baseMaterial.dispose(), [baseMaterial])

  const draw = useCallback((localTime: number) => {
    const current = getConfig().scenes.galaxy
    const revealState = getGalaxyRevealState(localTime, current)
    const reveal = scene === 'cosmos' ? revealState.galaxy : 1
    const initialStars = scene === 'cosmos' ? revealState.stars : 1
    const phaseTime = scene === 'cosmos' ? localTime
      : scene === 'greeting' ? TIMING.cosmos.duration + localTime
        : TIMING.cosmos.duration + TIMING.greeting.duration + localTime
    const motionTime = getGalaxyMotionPhase(scene, localTime, current, TIMING.cosmos.duration, TIMING.greeting.duration, reducedMotion)
    const light = getGalaxyLight(scene, localTime, current, TIMING.cosmos.duration)
    const fogOpacity = getGalaxyFogOpacity(scene, localTime, current, TIMING.cosmos.duration)

    if (galaxy.current) {
      galaxy.current.visible = active
      galaxy.current.scale.setScalar(current.compositionScale)
    }
    if (fogGroup.current) {
      fogGroup.current.visible = active && scene === 'cosmos' && current.fogDensity > 0
      fogGroup.current.children.forEach((child, index) => {
        child.visible = index < current.fogLayers
        child.position.z = 4.8 - index * (current.fogDepth / 8)
      })
    }
    applyGalaxyFrameMaterials(materialsRef.current, {
      motionTime, phaseTime, reveal, firstStars: initialStars,
      diskBrightness: current.brightness * current.exposure * light,
      brightBrightness: current.brightStarIntensity * current.exposure * light,
      backgroundBrightness: current.backgroundBrightness * light,
      gasBrightness: current.nebulaBrightness * light,
      gasReveal: current.nebulaEnabled ? Math.max(reveal, initialStars * 0.14) : 0,
      backgroundGasBrightness: current.backgroundGasBrightness * light,
      coreReveal: reveal * light, light, fogOpacity,
    })
    if (diskPoints.current) diskPoints.current.visible = active
    if (brightPoints.current) brightPoints.current.visible = active && current.brightStarCount > 0
    if (backgroundPoints.current) backgroundPoints.current.visible = active && current.backgroundStarCount > 0
    invalidate()
  }, [active, invalidate, materialsRef, reducedMotion, scene])

  useLayoutEffect(() => {
    updateLiveUniforms(settings, dpr, materials)
    baseMaterial.color.set(getGalaxyColors(settings).backgroundColor)
    draw(scene === 'ending' ? runtime.presentationTime : runtime.time)
    invalidate()
  }, [baseMaterial, dpr, draw, invalidate, materials, runtime, scene, settings])

  const duration = scene === 'cosmos' ? TIMING.cosmos.duration : TIMING.greeting.duration
  // All reveal states scrub from the film clock; the ending has no authored duration and uses only a quiet shared-renderer drift.
  useSceneAnimation(runtime, duration, draw)
  useEffect(() => {
    if (scene !== 'ending') return
    draw(runtime.presentationTime)
    return runtime.subscribePresentation(draw)
  }, [draw, runtime, scene])

  return <>
    <group ref={galaxy} visible={false}>
      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[60, 32, 16]} />
        <primitive object={baseMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0, -built.backgroundDepth * 0.52]} frustumCulled={false}>
        <planeGeometry args={[built.backgroundDepth * 2.5, built.backgroundDepth * 1.45]} />
        <primitive object={materials.backgroundGas.material} attach="material" />
      </mesh>
      <points ref={backgroundPoints} geometry={geometry.background} material={materials.background.material} frustumCulled={false} />
      <group ref={fogGroup} visible={false}>
        {materials.fog.map(({ material }, index) => <mesh key={index} position={[0, 0, 4.8 - index * (settings.fogDepth / 8)]} scale={[38, 24, 1]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>)}
      </group>
      <group position={[0, 0, 0]}>
        <mesh scale={[settings.radius * 2.45, settings.radius * 2.45, 1]} position={[0, 0, 0.08]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <primitive object={materials.gas.material} attach="material" />
        </mesh>
        <mesh scale={[settings.coreSize * 5.2, settings.coreSize * 5.2, 1]} position={[0, 0, 0.12]} frustumCulled={false}>
          <circleGeometry args={[0.5, 64]} />
          <primitive object={materials.core.material} attach="material" />
        </mesh>
        <points ref={diskPoints} geometry={geometry.disk} material={materials.disk.material} frustumCulled={false} />
        <points ref={brightPoints} geometry={geometry.bright} material={materials.bright.material} frustumCulled={false} />
      </group>
    </group>
  </>
}
