import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { BackSide, CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, Vector3 } from 'three'
import type { SceneProps } from '../../engine/sceneTypes'
import { TIMING } from '../../engine/filmConfig'
import { getConfig, subscribeConfig, type SceneComposerConfig } from '../../systems/scene-config/config'
import { isSceneFrameAllowed, useSceneAnimation } from '../shared/animation'
import { createGalaxyGeometry, updateGalaxyColors, type GalaxyGeometrySettings } from './generateGalaxy'
import { applyGalaxyFrameMaterials, createCoreMaterial, createFogMaterial, createGasMaterial, createStarMaterial, createSunMaterial, type GalaxyUniforms } from './shaders'
import { advanceGalaxyAmbientPhase, applyGalaxyBoundaryTransform, captureGalaxyBoundaryFrame, getGalaxyFrameValues, getGalaxyMotionPhase } from './animation'
import { getGalaxyRenderPalette } from './palette'
import { getPlanetariumHandoffProgressAtTime, getPlanetariumHandoffStartTime } from './camera'
import { createNebulaClouds } from './nebulaClouds'
import { deferGalaxyCloudDisposal } from './resourceLifecycle'
import { createBackgroundStarsMaterial, createBlackCenterMaterial, faceBlackCenterToCamera, GALAXY_RENDER_ORDER } from './rendering'
import { galleryMotion, gallerySnapshot, subscribeGallery } from '../gallery/controller'
import { GALLERY, GALLERY_MEMORIES } from '../gallery/content'
import { getPlanetariumGalaxyFade } from '../gallery/planetariumTransition'

type GalaxySceneName = 'cosmos' | 'greeting' | 'ending'
type GalaxySettings = SceneComposerConfig['scenes']['galaxy']

function structureSettings(settings: GalaxySettings, globalQuality: 'standard' | 'low'): GalaxyGeometrySettings {
  return {
    seed: settings.seed, starCount: settings.starCount, arms: settings.arms, radius: settings.radius,
    spin: settings.spin, armWidth: settings.armWidth, randomness: settings.randomness,
    randomnessPower: settings.randomnessPower, coreSize: settings.coreSize, coreDensity: settings.coreDensity,
    thickness: settings.thickness, distribution: settings.distribution, brightStarCount: settings.brightStarCount,
    backgroundStarCount: settings.backgroundStarCount, backgroundDepth: settings.backgroundDepth,
    quality: settings.quality, globalQuality, palette: getGalaxyRenderPalette(settings),
  }
}

function structureKey(settings: GalaxySettings, globalQuality: 'standard' | 'low') {
  return [settings.seed, settings.starCount, settings.arms, settings.radius, settings.spin, settings.armWidth,
    settings.randomness, settings.randomnessPower, settings.coreSize, settings.coreDensity, settings.thickness,
    settings.distribution, settings.brightStarCount, settings.backgroundStarCount, settings.backgroundDepth,
    settings.quality, globalQuality].join('|')
}

function setColor(uniforms: GalaxyUniforms, key: string, value: string) {
  const uniform = uniforms[key]
  if (uniform?.value instanceof Color) uniform.value.set(value)
}

function updateLiveUniforms(settings: GalaxySettings, dpr: number, palette: ReturnType<typeof getGalaxyRenderPalette>, materials: {
  disk: ReturnType<typeof createStarMaterial>
  bright: ReturnType<typeof createSunMaterial>
  gas: ReturnType<typeof createGasMaterial>
  core: ReturnType<typeof createCoreMaterial>
  fog: ReturnType<typeof createFogMaterial>[]
}) {
  const disk = materials.disk.uniforms
  disk.uSize!.value = settings.starSize
  disk.uTwinkle!.value = settings.twinkle
  disk.uRotationSpeed!.value = settings.rotationSpeed
  disk.uPixelRatio!.value = dpr
  disk.uProjectionScale!.value = settings.radius * 3
  disk.uMaxPointSize!.value = 48 * dpr

  const bright = materials.bright.uniforms
  bright.uSize!.value = settings.brightStarSize
  bright.uRotationSpeed!.value = settings.rotationSpeed
  bright.uPixelRatio!.value = dpr
  bright.uProjectionScale!.value = settings.radius * 3.2
  bright.uMaxPointSize!.value = 48 * dpr
  setColor(bright, 'uBrightTint', palette.hotColor)

  const gas = materials.gas.uniforms
  gas.uScale!.value = settings.nebulaScale
  gas.uDensity!.value = settings.nebulaDensity
  gas.uOpacity!.value = settings.nebulaOpacity
  gas.uIntensity!.value = settings.nebulaIntensity
  gas.uSaturation!.value = settings.nebulaSaturation
  gas.uNoiseSpeed!.value = settings.nebulaSpeed
  gas.uRadius!.value = settings.radius
  gas.uArms!.value = settings.arms
  gas.uSpin!.value = settings.spin
  gas.uRotationSpeed!.value = settings.rotationSpeed
  gas.uCoreSize!.value = settings.coreSize
  setColor(gas, 'uColorCore', palette.nebulaCoreColor)
  setColor(gas, 'uColorMid', palette.nebulaColor)
  setColor(gas, 'uColorEdge', palette.nebulaEdgeColor)
  materials.core.uniforms.uGlow!.value = settings.coreGlow
  setColor(materials.core.uniforms, 'uColor', palette.coreColor)

  for (const [index, fog] of materials.fog.entries()) {
    fog.uniforms.uDensity!.value = settings.fogDensity
    fog.uniforms.uOpacity!.value = settings.fogDensity
    fog.uniforms.uScale!.value = 1.15 + settings.fogDensity * 0.85
    fog.uniforms.uTurbulence!.value = settings.fogTurbulence
    fog.uniforms.uLayer!.value = index
    fog.uniforms.uMotion!.value = settings.nebulaSpeed + 0.008
    setColor(fog.uniforms, 'uColor', palette.nebulaColor)
  }
}

export function GalaxyExperience({ state, runtime, reducedMotion }: SceneProps) {
  const gallery = useSyncExternalStore(subscribeGallery, gallerySnapshot, gallerySnapshot)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const settings = config.scenes.galaxy
  const palette = useMemo(() => getGalaxyRenderPalette({
    palette: settings.palette, coreColor: settings.coreColor, innerColor: settings.innerColor,
    armColor: settings.armColor, nebulaColor: settings.nebulaColor,
    brightColor: settings.brightColor, backgroundColor: settings.backgroundColor,
  }), [settings.palette, settings.coreColor, settings.innerColor, settings.armColor, settings.nebulaColor, settings.brightColor, settings.backgroundColor])
  const structureSignature = structureKey(settings, config.global.quality)
  const [built, setBuilt] = useState(() => structureSettings(settings, config.global.quality))
  const galaxy = useRef<Group>(null)
  const fogGroup = useRef<Group>(null)
  const diskPoints = useRef<Points>(null)
  const brightPoints = useRef<Points>(null)
  const backgroundPoints = useRef<Points>(null)
  const blackCenter = useRef<Mesh>(null)
  const ambientPhase = useRef({ active: false, initialized: false, motionTime: 0, phaseTime: 0 })
  const camera = useThree((three) => three.camera)
  const invalidate = useThree((three) => three.invalidate)
  const dpr = useThree((three) => three.viewport.dpr)
  const cameraWorldPosition = useMemo(() => new Vector3(), [])
  const cameraWorldDirection = useMemo(() => new Vector3(), [])
  const cameraWorldRotation = useMemo(() => new Quaternion(), [])
  const galaxyOrigin = useMemo(() => new Vector3(), [])
  const galaxyIdentityRotation = useMemo(() => new Quaternion(), [])
  const planetariumStartTransform = useRef({
    position: new Vector3(),
    rotation: new Quaternion(),
    time: 0,
    captured: false,
  })
  const cosmosBoundaryFrame = useRef({
    valid: false,
    motionTime: 0,
    phaseTime: 0,
    light: 1,
    fogOpacity: 0,
    reveal: 1,
    firstStars: 1,
    position: new Vector3(),
    rotation: new Quaternion(),
  })
  const planetariumExit = state.scene === 'gallery' && gallery.phase === 'exit' && gallery.focus === GALLERY_MEMORIES.length - 1
  const planetariumRoute = planetariumExit || Boolean(state.planetariumTransition)
  const active = planetariumExit || Boolean(state.planetariumTransition) || state.scene === 'cosmos' || state.scene === 'greeting' || state.scene === 'ending'
  const scene: GalaxySceneName = state.scene === 'greeting' || state.scene === 'ending' ? state.scene : 'cosmos'
  const materials = useMemo(() => ({
    disk: createStarMaterial(), bright: createSunMaterial(), gas: createGasMaterial(), core: createCoreMaterial(),
    fog: Array.from({ length: 8 }, () => createFogMaterial()),
  }), [])
  const geometry = useMemo(() => createGalaxyGeometry(built), [built])
  const baseMaterial = useMemo(() => new MeshBasicMaterial({
    color: '#04020C', toneMapped: false, side: BackSide, depthWrite: false,
  }), [])
  const blackMaterial = useMemo(() => createBlackCenterMaterial(), [])
  const backgroundPointsMaterial = useMemo(() => createBackgroundStarsMaterial(), [])
  const clouds = useMemo(() => createNebulaClouds(built.seed, built.radius * 4.5, built.quality === 'low' ? 5 : 9), [built])
  const mountedClouds = useRef(new WeakSet<object>())
  const blackGeometry = useMemo(() => new CircleGeometry(built.radius * built.coreSize * 0.085, 64), [built])
  const gasGeometry = useMemo(() => new CircleGeometry(built.radius, 96), [built.radius])
  const coreGlowGeometry = useMemo(() => new PlaneGeometry(1, 1), [])

  useEffect(() => {
    const timer = window.setTimeout(() => setBuilt(structureSettings(getConfig().scenes.galaxy, getConfig().global.quality)), 280)
    return () => window.clearTimeout(timer)
  }, [structureSignature])

  useEffect(() => () => {
    geometry.disk.dispose(); geometry.bright.dispose(); geometry.background.dispose()
  }, [geometry])
  useEffect(() => () => {
    materials.disk.material.dispose(); materials.bright.material.dispose(); materials.gas.material.dispose(); materials.core.material.dispose()
    materials.fog.forEach((fog) => fog.material.dispose())
  }, [materials])
  useEffect(() => () => {
    baseMaterial.dispose(); blackMaterial.dispose(); backgroundPointsMaterial.dispose()
  }, [baseMaterial, blackMaterial, backgroundPointsMaterial])
  useEffect(() => () => { blackGeometry.dispose() }, [blackGeometry])
  useEffect(() => () => { gasGeometry.dispose() }, [gasGeometry])
  useEffect(() => () => { coreGlowGeometry.dispose() }, [coreGlowGeometry])
  useEffect(() => {
    const mounted = mountedClouds.current
    mounted.add(clouds)
    return () => deferGalaxyCloudDisposal(clouds, mounted)
  }, [clouds])

  const draw = useCallback((localTime: number) => {
    const time = planetariumExit ? galleryMotion.exit : localTime
    const current = getConfig().scenes.galaxy
    const planetariumCosmos = state.scene === 'cosmos' && planetariumRoute
    if (planetariumCosmos && !planetariumStartTransform.current.captured) {
      camera.getWorldPosition(cameraWorldPosition)
      camera.getWorldDirection(cameraWorldDirection)
      planetariumStartTransform.current.position.copy(cameraWorldPosition).addScaledVector(cameraWorldDirection, current.cameraStartDistance)
      camera.getWorldQuaternion(planetariumStartTransform.current.rotation)
      // Cosmos enters from Gallery at this exact scene time. During this first
      // layout pass the shared runtime may still hold the Gallery clock value.
      planetariumStartTransform.current.time = getPlanetariumHandoffStartTime(planetariumCosmos, GALLERY.exit, runtime.time)
      planetariumStartTransform.current.captured = true
    }
    const handoffDuration = Math.min(current.cameraDuration, TIMING.cosmos.duration - planetariumStartTransform.current.time)
    const handoffProgress = !planetariumRoute ? 1
      : planetariumExit ? 0
        : reducedMotion ? 1
          : handoffDuration <= 0 ? 1
            : getPlanetariumHandoffProgressAtTime(time, planetariumStartTransform.current.time, handoffDuration)
    const transitionOpacity = planetariumExit ? getPlanetariumGalaxyFade(time) : 1
    const boundary = cosmosBoundaryFrame.current
    const frame = getGalaxyFrameValues(scene, time, current, TIMING.cosmos.duration, TIMING.greeting.duration, {
      boundary,
      reducedMotion,
      revealTimeOffset: planetariumRoute ? current.galaxyRevealAt : 0,
      boundaryTransitionDuration: TIMING.transition,
      ...(ambientPhase.current.active ? {
        motionTime: ambientPhase.current.motionTime,
        phaseTime: ambientPhase.current.phaseTime,
      } : {}),
      transitionOpacity,
    })
    const { motionTime, phaseTime, light, fogOpacity, boundaryProgress } = frame
    const visibleReveal = frame.reveal
    const visibleStars = frame.firstStars
    baseMaterial.color.set(palette.backgroundColor).multiplyScalar(transitionOpacity)

    if (galaxy.current) {
      galaxy.current.scale.setScalar(current.compositionScale)
      if (planetariumExit) {
        camera.getWorldPosition(cameraWorldPosition)
        camera.getWorldDirection(cameraWorldDirection)
        galaxy.current.position.copy(cameraWorldPosition).addScaledVector(cameraWorldDirection, current.cameraStartDistance)
        camera.getWorldQuaternion(cameraWorldRotation)
        galaxy.current.quaternion.copy(cameraWorldRotation)
      } else if (planetariumCosmos) {
        galaxy.current.position.copy(planetariumStartTransform.current.position).lerp(galaxyOrigin, handoffProgress)
        galaxy.current.quaternion.copy(planetariumStartTransform.current.rotation).slerp(galaxyIdentityRotation, handoffProgress)
      } else if (scene === 'greeting' && boundary.valid) {
        applyGalaxyBoundaryTransform(boundary, galaxyOrigin, galaxyIdentityRotation, boundaryProgress, galaxy.current.position, galaxy.current.quaternion)
      } else {
        galaxy.current.position.copy(galaxyOrigin)
        galaxy.current.quaternion.copy(galaxyIdentityRotation)
        if (state.scene !== 'greeting' && state.scene !== 'ending') planetariumStartTransform.current.captured = false
      }
    }
    if (blackCenter.current) {
      blackCenter.current.visible = active && current.blackHoleEnabled
      faceBlackCenterToCamera(blackCenter.current, camera)
    }
    if (fogGroup.current) {
      fogGroup.current.visible = active && scene === 'cosmos' && current.fogDensity > 0
      fogGroup.current.children.forEach((child, index) => {
        child.visible = index < current.fogLayers
        child.position.z = 4.8 - index * (current.fogDepth / 8)
      })
    }
    const backgroundPointsMaterial = backgroundPoints.current?.material
    if (backgroundPointsMaterial instanceof PointsMaterial) {
      backgroundPointsMaterial.opacity = current.backgroundBrightness * light * visibleStars
      backgroundPointsMaterial.size = current.backgroundSize
    }
    clouds.setOpacity(current.backgroundGasBrightness * light * Math.min(1.5, current.backgroundGasDensity / 0.34))
    applyGalaxyFrameMaterials(materials, {
      motionTime, phaseTime, reveal: visibleReveal, firstStars: visibleStars,
      diskBrightness: frame.diskBrightness,
      brightBrightness: frame.brightBrightness,
      nebulaBrightness: current.nebulaBrightness,
      sceneLight: light,
      gasReveal: frame.gasReveal,
      coreReveal: visibleReveal,
      coreBrightness: frame.coreBrightness,
      coreGlow: current.coreGlow,
      twinkleSpeed: current.twinkleSpeed,
      fogOpacity,
    })
    if (diskPoints.current) {
      diskPoints.current.visible = active
      diskPoints.current.renderOrder = GALAXY_RENDER_ORDER.starPoints
    }
    if (brightPoints.current) {
      brightPoints.current.visible = active && current.brightStarCount > 0
      brightPoints.current.renderOrder = GALAXY_RENDER_ORDER.starPoints
    }
    if (backgroundPoints.current) backgroundPoints.current.visible = active && current.backgroundStarCount > 0
    if (scene === 'cosmos' && galaxy.current) {
      captureGalaxyBoundaryFrame(boundary, frame, galaxy.current.position, galaxy.current.quaternion)
    } else if (scene === 'greeting' && boundaryProgress >= 1) {
      boundary.valid = false
    } else if (scene === 'ending') {
      boundary.valid = false
    }
    invalidate()
  }, [active, baseMaterial, camera, cameraWorldDirection, cameraWorldPosition, cameraWorldRotation, clouds, galaxyIdentityRotation, galaxyOrigin, invalidate, materials, palette.backgroundColor, planetariumExit, planetariumRoute, reducedMotion, runtime, scene, state.scene])

  const sceneDraw = useCallback((time: number) => {
    const allowPlanetariumGalleryFrame = planetariumExit && runtime.scene === 'gallery'
    if (!isSceneFrameAllowed(runtime, scene, allowPlanetariumGalleryFrame)) return
    draw(time)
  }, [draw, planetariumExit, runtime, scene])

  useLayoutEffect(() => {
    updateLiveUniforms(settings, dpr, palette, materials)
    baseMaterial.color.set(palette.backgroundColor)
    sceneDraw(scene === 'ending' ? runtime.presentationTime : runtime.time)
    invalidate()
  }, [baseMaterial, dpr, invalidate, materials, palette, runtime, scene, sceneDraw, settings])
  useLayoutEffect(() => { updateGalaxyColors(geometry.disk, palette) }, [geometry, palette])

  const duration = scene === 'cosmos' ? TIMING.cosmos.duration : TIMING.greeting.duration
  useSceneAnimation(runtime, duration, sceneDraw, scene)
  useFrame(() => { if (planetariumExit) sceneDraw(galleryMotion.exit) })
  useEffect(() => {
    const ambient = ambientPhase.current
    if (state.scene === 'prologue' || state.scene === 'cosmos') {
      ambient.active = false
      ambient.initialized = false
      return
    }
    if (state.scene !== 'greeting' && state.scene !== 'ending') { ambient.active = false; return }
    if (!ambient.initialized) {
      const time = state.scene === 'ending' ? runtime.presentationTime : runtime.time
      ambient.motionTime = getGalaxyMotionPhase(state.scene, time, getConfig().scenes.galaxy, TIMING.cosmos.duration, TIMING.greeting.duration, reducedMotion)
      ambient.phaseTime = state.scene === 'ending' ? TIMING.cosmos.duration + TIMING.greeting.duration + time : TIMING.cosmos.duration + time
      ambient.initialized = true
    }
    ambient.active = true
    let previous = performance.now()
    const tick = () => {
      const now = performance.now()
      const delta = document.hidden ? 0 : Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      const next = advanceGalaxyAmbientPhase(ambient.motionTime, ambient.phaseTime, delta, getConfig().scenes.galaxy, reducedMotion)
      ambient.motionTime = next.motionTime
      ambient.phaseTime = next.phaseTime
      sceneDraw(runtime.time)
    }
    gsap.ticker.add(tick)
    tick()
    return () => { gsap.ticker.remove(tick); ambient.active = false }
  }, [reducedMotion, runtime, sceneDraw, state.scene])

  return <>
    <group ref={galaxy} visible={active}>
      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[60, 32, 16]} />
        <primitive object={baseMaterial} attach="material" />
      </mesh>
      <primitive object={clouds.group} />
      <points ref={backgroundPoints} geometry={geometry.background} material={backgroundPointsMaterial} frustumCulled={false} renderOrder={GALAXY_RENDER_ORDER.backgroundStars} />
      <mesh geometry={gasGeometry} position={[0, 0, -0.02]} frustumCulled={false} renderOrder={GALAXY_RENDER_ORDER.gas}>
        <primitive object={materials.gas.material} attach="material" />
      </mesh>
      <mesh geometry={coreGlowGeometry} scale={[built.radius * 0.9, built.radius * 0.9, 1]} position={[0, 0, 0]} frustumCulled={false} renderOrder={-1}>
        <primitive object={materials.core.material} attach="material" />
      </mesh>
      <group>
        <points ref={diskPoints} geometry={geometry.disk} material={materials.disk.material} frustumCulled={false} renderOrder={GALAXY_RENDER_ORDER.starPoints} />
        <points ref={brightPoints} geometry={geometry.bright} material={materials.bright.material} frustumCulled={false} renderOrder={GALAXY_RENDER_ORDER.starPoints} />
      </group>
      <mesh ref={blackCenter} visible={false} geometry={blackGeometry} position={[0, 0, 0.32]} material={blackMaterial} renderOrder={GALAXY_RENDER_ORDER.blackCenter} />
      <group ref={fogGroup} visible={false} renderOrder={GALAXY_RENDER_ORDER.revealFog}>
        {materials.fog.map(({ material }, index) => <mesh key={index} position={[0, 0, 4.8 - index * (settings.fogDepth / 8)]} scale={[38, 24, 1]} frustumCulled={false} renderOrder={GALAXY_RENDER_ORDER.revealFog}>
          <planeGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>)}
      </group>
    </group>
  </>
}
