import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import type { CanvasTexture, DirectionalLight, HemisphereLight, Texture } from 'three'
import moonAlbedoUrl from '../../assets/gallery-moonlit/lroc-color-2k.jpg'
import moonHeightUrl from '../../assets/gallery-moonlit/ldem-3-8bit.jpg'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { createGalleryCloudVolumeMaterial, getGalleryAtmosphereRevealAlpha, setGalleryAtmosphereTime, setGalleryAtmosphereView } from './cloudMaterial'
import { createMoonHaloTexture } from './worldTextures'
import { GALLERY_WORLD, getGalleryAtmosphereStepCount, getGalleryCloudDrift, getGalleryCloudMassesForLayerCounts, getGalleryCloudPosition, getGalleryCloudRadii, getGalleryCloudRenderOrder, getGalleryHazeCameraFade, getGalleryHazeMasses, getGalleryMoonScatteringLayers, type GalleryQuality } from './world'
import { WetFloor } from './WetFloor'
import { galleryMotion } from './controller'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

const ignoreRaycast = () => undefined

const scatterVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const scatterFragmentShader = `
  uniform float uIntensity;
  uniform float uRaysIntensity;
  uniform float uReveal;
  uniform vec3 uMoonColor;
  uniform float uSeed;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = dot(p, p);
    float halo = exp(-r * 2.8) * (1.0 - smoothstep(0.62, 1.0, r));
    float angle = atan(p.y, p.x);
    float radialRays = pow(max(0.0, cos(angle * 10.0 + uSeed * 0.17)), 24.0)
      * smoothstep(0.08, 0.24, r) * (1.0 - smoothstep(0.58, 0.96, r));
    float breath = 0.96 + 0.04 * sin(uTime * 0.24 + uSeed);
    // Keep the broad lunar scatter analytic and smooth; quantized UV grain
    // creates visible square cells on the large, translucent light pools.
    float alpha = min(0.18, halo * uIntensity * breath + radialRays * uRaysIntensity * 0.012) * clamp(uReveal, 0.0, 1.0);
    // Additive blending applies source alpha to RGB; keep the source color
    // unpremultiplied so the haze does not lose its energy twice.
    gl_FragColor = vec4(uMoonColor, alpha);
    #include <colorspace_fragment>
  }
`

function useMoonSurfaceTextures() {
  const [textures, setTextures] = useState<{ color: Texture; height: Texture } | null>(null)
  useEffect(() => {
    let active = true
    const loader = new TextureLoader()
    let loaded: { color: Texture; height: Texture } | null = null
    Promise.all([loader.loadAsync(moonAlbedoUrl), loader.loadAsync(moonHeightUrl)]).then(([color, height]) => {
      color.colorSpace = SRGBColorSpace
      loaded = { color, height }
      if (active) setTextures(loaded)
      else { color.dispose(); height.dispose() }
    }).catch(() => { if (active) setTextures(null) })
    return () => {
      active = false
      loaded?.color.dispose()
      loaded?.height.dispose()
    }
  }, [])
  return textures
}

export function MoonlitWorld({
  settings,
  quality,
  halo,
  reducedMotion,
}: {
  settings: GallerySettings
  quality: GalleryQuality
  halo: CanvasTexture
  reducedMotion: boolean
}) {
  const cloudMasses = useMemo(() => getGalleryCloudMassesForLayerCounts(quality, settings.cloudLayers), [quality, settings.cloudLayers])
  const cloudMeshes = useRef<(Mesh | null)[]>([])
  const hazeMeshes = useRef<(Mesh | null)[]>([])
  const diffuseHaloMesh = useRef<Mesh>(null)
  const moonHaloMesh = useRef<Mesh>(null)
  const moonFillLight = useRef<HemisphereLight>(null)
  const moonDirectionalLight = useRef<DirectionalLight>(null)
  const cameraPositionScratch = useMemo(() => new Vector3(), [])
  const massPositionScratch = useMemo(() => new Vector3(), [])
  const moonPosition = useMemo(() => [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ] as const,
    [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ])
  const lightTarget = useMemo(() => [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ] as const,
    [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ])
  const hazeMasses = useMemo(() => getGalleryHazeMasses(quality), [quality])
  const atmosphereGeometry = useMemo(() => new SphereGeometry(1, quality === 'low' ? 30 : 64, quality === 'low' ? 20 : 48), [quality])
  const cloudMaterials = useMemo(() => cloudMasses.map((mass) => {
    const layerSettings = settings.cloudLayers[mass.layer]
    const radii = getGalleryCloudRadii(mass, layerSettings, quality)
    const localRadiance = mass.layer === 'nearLow' ? 1.45 : mass.layer === 'waterline' ? 1.5 : 1
    const localSilverEdge = mass.layer === 'nearLow' ? 2 : mass.layer === 'waterline' ? 2.4 : 1
    const localDefinition = mass.layer === 'nearLow' ? 1 : mass.layer === 'waterline' ? 0.96 : 1
    return createGalleryCloudVolumeMaterial({
    kind: 'cloud',
    center: getGalleryCloudPosition(mass, layerSettings, moonPosition),
    radii,
    seed: mass.seed,
    opacity: mass.opacity * layerSettings.opacity * (mass.moonInteraction || mass.layer === 'nearLow' || mass.layer === 'waterline' ? 1 : 0.82),
    density: layerSettings.density * (mass.moonInteraction ? 1.45 : mass.layer === 'nearLow' ? 1.08 : mass.layer === 'waterline' ? 1.05 : 1),
    intensity: Math.min(2, layerSettings.brightness * localRadiance),
    softness: layerSettings.softness * localDefinition,
    coolTint: settings.cloudCoolTint,
    whiteHighlight: Math.min(1.5, settings.cloudWhiteHighlight * localSilverEdge),
    moonPosition,
    moonColor: settings.moonLightColor,
    moonLightIntensity: settings.moonLightIntensity * settings.coldLightIntensity * settings.moonCloudLightIntensity * 0.72
      * (mass.moonInteraction ? 1.35 : mass.layer === 'nearLow' ? 1.65 : mass.layer === 'waterline' ? 1.55 : 1),
    moonOcclusion: mass.moonInteraction === true,
    driftSpeed: reducedMotion ? 0 : layerSettings.driftSpeed * (mass.layer === 'nearLow' ? 1.2 : mass.layer === 'waterline' ? 1.1 : 1),
    steps: getGalleryAtmosphereStepCount(quality, mass.layer, 0),
  })
  }), [cloudMasses, moonPosition, quality, reducedMotion, settings.cloudCoolTint, settings.cloudLayers, settings.cloudWhiteHighlight, settings.coldLightIntensity, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
  const hazeMaterials = useMemo(() => hazeMasses.map((mass) => createGalleryCloudVolumeMaterial({
    kind: 'haze',
    center: [mass.position[0], mass.position[1] + settings.hazeHeight, mass.position[2]],
    radii: mass.radii,
    seed: mass.seed,
    opacity: mass.opacity * settings.hazeDensity,
    density: 1,
    intensity: 1,
    coolTint: settings.cloudCoolTint,
    whiteHighlight: settings.cloudWhiteHighlight,
    moonPosition,
    moonColor: settings.moonLightColor,
    moonLightIntensity: settings.moonLightIntensity * settings.coldLightIntensity * settings.moonCloudLightIntensity * 0.72,
    driftSpeed: reducedMotion ? 0 : settings.hazeMotionSpeed,
    steps: getGalleryAtmosphereStepCount(quality, 'haze', 0),
  })), [hazeMasses, moonPosition, quality, reducedMotion, settings.cloudCoolTint, settings.cloudWhiteHighlight, settings.coldLightIntensity, settings.hazeDensity, settings.hazeHeight, settings.hazeMotionSpeed, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
  const moonSurface = useMoonSurfaceTextures()
  const moonHaloTexture = useMemo(() => createMoonHaloTexture(), [])
  const scatteringLayers = useMemo(() => getGalleryMoonScatteringLayers(moonPosition, lightTarget), [lightTarget, moonPosition])
  const scatteringMaterials = useMemo(() => scatteringLayers.map((layer) => new ShaderMaterial({
    uniforms: {
      uIntensity: { value: layer.intensity * settings.moonScatteringIntensity },
      uRaysIntensity: { value: settings.moonGodRaysIntensity },
      uReveal: { value: 0 },
      uMoonColor: { value: new Color(settings.moonLightColor) },
      uSeed: { value: layer.seed },
      uTime: { value: 0 },
    },
    vertexShader: scatterVertexShader,
    fragmentShader: scatterFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    side: DoubleSide,
  })), [scatteringLayers, settings.moonGodRaysIntensity, settings.moonLightColor, settings.moonScatteringIntensity])
  const moonBrightness = Math.max(0, settings.moonBrightness)
  const moonMaterial = useMemo(() => new MeshStandardMaterial({
    map: moonSurface?.color ?? null,
    bumpMap: moonSurface?.height ?? null,
    bumpScale: 0.035,
    color: new Color(0.86, 0.88, 0.91),
    roughness: 1,
    metalness: 0,
    emissive: settings.moonLightColor,
    emissiveMap: moonSurface?.color ?? null,
    emissiveIntensity: Math.min(0.48, moonBrightness * 0.52),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  }), [moonBrightness, moonSurface, settings.moonLightColor])
  const haloMaterial = useMemo(() => new MeshBasicMaterial({
    map: halo,
    color: settings.moonLightColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }), [halo, moonBrightness, settings.coldLightIntensity, settings.moonHaloIntensity, settings.moonLightColor])
  const moonHaloMaterial = useMemo(() => new MeshBasicMaterial({
    map: moonHaloTexture,
    color: settings.moonLightColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }), [moonHaloTexture, settings.moonHaloIntensity, settings.moonLightColor])
  const moonLightPosition = useMemo(() => new Vector3(...moonPosition), [moonPosition])
  const moonLightTarget = useMemo(() => {
    const target = new Object3D()
    target.position.set(...lightTarget)
    return target
  }, [lightTarget])
  useEffect(() => () => atmosphereGeometry.dispose(), [atmosphereGeometry])
  useEffect(() => () => {
    moonHaloTexture.dispose()
  }, [moonHaloTexture])
  useEffect(() => () => cloudMaterials.forEach((material) => material.dispose()), [cloudMaterials])
  useFrame(({ camera }) => {
    const time = reducedMotion ? 0 : galleryMotion.time
    const cloudReveal = getGalleryAtmosphereRevealAlpha(galleryMotion.entryReveal, 'clouds')
    const moonReveal = getGalleryAtmosphereRevealAlpha(galleryMotion.entryReveal, 'moon')
    camera.getWorldPosition(cameraPositionScratch)
    setGalleryAtmosphereTime([...cloudMaterials, ...hazeMaterials, ...scatteringMaterials], time)
    cloudMaterials.forEach((material) => { material.uniforms.uMoonReveal!.value = moonReveal })
    hazeMaterials.forEach((material) => { material.uniforms.uMoonReveal!.value = moonReveal })
    scatteringMaterials.forEach((material) => { material.uniforms.uReveal!.value = moonReveal })
    moonMaterial.opacity = moonReveal
    moonMaterial.depthWrite = moonReveal >= 1
    if (moonFillLight.current) moonFillLight.current.intensity = settings.moonFillIntensity * moonReveal
    if (moonDirectionalLight.current) moonDirectionalLight.current.intensity = settings.moonLightIntensity * moonBrightness * moonReveal
    const haloBreath = 0.97 + 0.03 * Math.sin(time * 0.24)
    const diffuseHalo = diffuseHaloMesh.current?.material
    if (diffuseHalo && !Array.isArray(diffuseHalo)) diffuseHalo.opacity = Math.min(0.6, moonBrightness * settings.coldLightIntensity * settings.moonHaloIntensity * 0.28) * haloBreath * moonReveal
    const lunarHalo = moonHaloMesh.current?.material
    if (lunarHalo && !Array.isArray(lunarHalo)) lunarHalo.opacity = Math.min(0.5, settings.moonHaloIntensity * 0.4) * (0.985 + 0.015 * Math.sin(time * 0.2 + 0.6)) * moonReveal
    cloudMasses.forEach((mass, index) => {
      const layerSettings = settings.cloudLayers[mass.layer]
      const basePosition = getGalleryCloudPosition(mass, layerSettings, moonPosition)
      const motionScale = mass.layer === 'nearLow' ? 1.2 : mass.layer === 'waterline' ? 1.1 : 1
      const drift = getGalleryCloudDrift(mass, time, reducedMotion ? 0 : layerSettings.driftSpeed * motionScale, settings.cloudDriftVariation)
      const x = basePosition[0] + drift[0]
      const y = basePosition[1] + drift[1]
      const z = basePosition[2] + drift[2]
      const mesh = cloudMeshes.current[index]
      mesh?.position.set(x, y, z)
      const center = cloudMaterials[index]?.uniforms.uCenter?.value as Vector3 | undefined
      center?.set(x, y, z)
      const cameraDistance = cameraPositionScratch.distanceTo(massPositionScratch.set(x, y, z))
      const material = cloudMaterials[index]
      const fade = material ? setGalleryAtmosphereView(material, quality, mass.layer, cameraDistance, false, mass.moonInteraction, cloudReveal) : 0
      if (mesh) mesh.visible = layerSettings.density > 0 && layerSettings.opacity > 0 && layerSettings.count > 0 && fade > 0
    })
    hazeMasses.forEach((mass, index) => {
      const drift = getGalleryCloudDrift(mass, time, reducedMotion ? 0 : settings.hazeMotionSpeed * 2.5, 0.35)
      const x = mass.position[0] + drift[0]
      const y = mass.position[1] + settings.hazeHeight + drift[1]
      const z = mass.position[2] + drift[2]
      const mesh = hazeMeshes.current[index]
      mesh?.position.set(x, y, z)
      const center = hazeMaterials[index]?.uniforms.uCenter?.value as Vector3 | undefined
      center?.set(x, y, z)
      const cameraDistance = cameraPositionScratch.distanceTo(massPositionScratch.set(x, y, z))
      const material = hazeMaterials[index]
      const cameraFade = getGalleryHazeCameraFade(cameraPositionScratch, massPositionScratch, mass.radii)
      const fade = material ? setGalleryAtmosphereView(material, quality, 'haze', cameraDistance, false, false, cameraFade * cloudReveal) : 0
      if (mesh) mesh.visible = settings.hazeDensity > 0 && fade > 0
    })
  })
  useEffect(() => () => hazeMaterials.forEach((material) => material.dispose()), [hazeMaterials])
  useEffect(() => () => moonMaterial.dispose(), [moonMaterial])
  useEffect(() => () => haloMaterial.dispose(), [haloMaterial])
  useEffect(() => () => moonHaloMaterial.dispose(), [moonHaloMaterial])
  useEffect(() => () => scatteringMaterials.forEach((material) => material.dispose()), [scatteringMaterials])

  const moon = { ...GALLERY_WORLD.moon, position: moonPosition }
  const moonScale = settings.moonSize
  return <group>
    <WetFloor settings={settings} quality={quality} reducedMotion={reducedMotion} />
    {cloudMasses.map((mass, index) => <mesh
      key={mass.id}
      ref={(mesh) => { cloudMeshes.current[index] = mesh }}
      position={getGalleryCloudPosition(mass, settings.cloudLayers[mass.layer], moonPosition)}
      scale={getGalleryCloudRadii(mass, settings.cloudLayers[mass.layer], quality)}
      visible={settings.cloudLayers[mass.layer].density > 0 && settings.cloudLayers[mass.layer].count > 0}
      raycast={ignoreRaycast}
      renderOrder={getGalleryCloudRenderOrder(mass)}
      onBeforeRender={(renderer, _scene, camera) => {
        const mesh = cloudMeshes.current[index]
        if (!mesh) return
        // The current gallery's only offscreen draw is the water mirror target.
        // Recompute on every pass so reduced mirror samples never leak into the main draw.
        const reflection = renderer.getRenderTarget() !== null
        camera.getWorldPosition(cameraPositionScratch)
        mesh.getWorldPosition(massPositionScratch)
        const cameraDistance = cameraPositionScratch.distanceTo(massPositionScratch)
        const cloudReveal = getGalleryAtmosphereRevealAlpha(galleryMotion.entryReveal, 'clouds')
        setGalleryAtmosphereView(cloudMaterials[index]!, quality, mass.layer, cameraDistance, reflection, mass.moonInteraction, cloudReveal)
      }}
    >
      <primitive object={atmosphereGeometry} attach="geometry" />
      <primitive object={cloudMaterials[index]!} attach="material" />
    </mesh>)}
    {hazeMasses.map((mass, index) => <mesh
      key={mass.id}
      ref={(mesh) => { hazeMeshes.current[index] = mesh }}
      position={[mass.position[0], mass.position[1] + settings.hazeHeight, mass.position[2]]}
      scale={mass.radii}
      visible={settings.hazeDensity > 0}
      raycast={ignoreRaycast}
      renderOrder={-1}
      onBeforeRender={(renderer, _scene, camera) => {
        const mesh = hazeMeshes.current[index]
        if (!mesh) return
        const reflection = renderer.getRenderTarget() !== null
        camera.getWorldPosition(cameraPositionScratch)
        mesh.getWorldPosition(massPositionScratch)
        const cameraDistance = cameraPositionScratch.distanceTo(massPositionScratch)
        const cameraFade = getGalleryHazeCameraFade(cameraPositionScratch, massPositionScratch, mass.radii)
        const cloudReveal = getGalleryAtmosphereRevealAlpha(galleryMotion.entryReveal, 'clouds')
        setGalleryAtmosphereView(hazeMaterials[index]!, quality, 'haze', cameraDistance, reflection, false, cameraFade * cloudReveal)
      }}
    >
      <primitive object={atmosphereGeometry} attach="geometry" />
      <primitive object={hazeMaterials[index]!} attach="material" />
    </mesh>)}
    <mesh ref={moonHaloMesh} position={[moon.position[0], moon.position[1], moon.position[2] - 0.26]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
      <planeGeometry args={[moon.haloRadius * settings.moonHaloRadius * 2, moon.haloRadius * settings.moonHaloRadius * 2]} />
      <primitive object={moonHaloMaterial} attach="material" />
    </mesh>
    <mesh ref={diffuseHaloMesh} position={[moon.position[0], moon.position[1], moon.position[2] - 0.22]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
      <planeGeometry args={[moon.radius * 8, moon.radius * 8]} />
      <primitive object={haloMaterial} attach="material" />
    </mesh>
    <primitive object={moonLightTarget} />
    <hemisphereLight
      ref={moonFillLight}
      color={settings.moonLightColor}
      groundColor="#101827"
      intensity={0}
    />
    <directionalLight
      ref={moonDirectionalLight}
      position={moonLightPosition}
      target={moonLightTarget}
      color={settings.moonLightColor}
      intensity={0}
      castShadow={false}
    />
    {scatteringLayers.map((layer, index) => <mesh
      key={layer.seed}
      position={layer.position}
      rotation={[0, 0, 0]}
      scale={moonScale}
      raycast={ignoreRaycast}
      renderOrder={-1}
    >
      <planeGeometry args={[layer.size, layer.size]} />
      <primitive object={scatteringMaterials[index]!} attach="material" />
    </mesh>)}
    <mesh position={moon.position} scale={moonScale} visible={moonBrightness > 0} raycast={ignoreRaycast} renderOrder={-2}>
      <sphereGeometry args={[moon.radius, 48, 32]} />
      <primitive object={moonMaterial} attach="material" />
    </mesh>
  </group>
}
