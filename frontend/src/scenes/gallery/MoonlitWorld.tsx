import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import type { CanvasTexture, Texture } from 'three'
import moonAlbedoUrl from '../../assets/gallery-moonlit/lroc-color-2k.jpg'
import moonHeightUrl from '../../assets/gallery-moonlit/ldem-3-8bit.jpg'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { createGalleryCloudVolumeMaterial, setGalleryAtmosphereTime } from './cloudMaterial'
import { createMoonHaloTexture } from './worldTextures'
import { GALLERY_WORLD, getGalleryCloudDrift, getGalleryCloudMassesForCount, getGalleryCloudRegionAmount, getGalleryHazeMasses, getGalleryMoonScatteringLayers, type GalleryQuality } from './world'
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
    float alpha = min(0.18, halo * uIntensity * breath + radialRays * uRaysIntensity * 0.012);
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
}: {
  settings: GallerySettings
  quality: GalleryQuality
  halo: CanvasTexture
}) {
  const cloudMasses = useMemo(() => getGalleryCloudMassesForCount(quality, settings.cloudLayerCount), [quality, settings.cloudLayerCount])
  const cloudMeshes = useRef<(Mesh | null)[]>([])
  const hazeMeshes = useRef<(Mesh | null)[]>([])
  const diffuseHaloMesh = useRef<Mesh>(null)
  const moonHaloMesh = useRef<Mesh>(null)
  const moonPosition = useMemo(() => [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ] as const,
    [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ])
  const lightTarget = useMemo(() => [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ] as const,
    [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ])
  const hazeMasses = useMemo(() => getGalleryHazeMasses(quality), [quality])
  const atmosphereGeometry = useMemo(() => new SphereGeometry(1, quality === 'low' ? 30 : 48, quality === 'low' ? 20 : 32), [quality])
  const cloudMaterials = useMemo(() => cloudMasses.map((mass) => {
    const radii = mass.radii.map((radius) => radius * settings.cloudScale) as [number, number, number]
    return createGalleryCloudVolumeMaterial({
    kind: 'cloud',
    center: mass.position,
    radii,
    seed: mass.seed,
    opacity: mass.opacity * settings.cloudOpacity * getGalleryCloudRegionAmount(mass.region, {
      foreground: settings.cloudForegroundAmount,
      background: settings.cloudBackgroundAmount,
      nearFloor: settings.cloudNearFloorAmount,
    }) * 0.82,
    density: settings.cloudDensity,
    intensity: settings.cloudIntensity,
    coolTint: settings.cloudCoolTint,
    whiteHighlight: settings.cloudWhiteHighlight,
    moonPosition,
    moonColor: settings.moonLightColor,
    moonLightIntensity: settings.moonLightIntensity * settings.coldLightIntensity * settings.moonCloudLightIntensity * 0.72,
    driftSpeed: settings.cloudDriftSpeed,
    steps: quality === 'low' ? 5 : 8,
  })
  }), [cloudMasses, moonPosition, quality, settings.cloudBackgroundAmount, settings.cloudCoolTint, settings.cloudDensity, settings.cloudDriftSpeed, settings.cloudForegroundAmount, settings.cloudIntensity, settings.cloudNearFloorAmount, settings.cloudOpacity, settings.cloudScale, settings.cloudWhiteHighlight, settings.coldLightIntensity, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
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
    driftSpeed: settings.hazeMotionSpeed,
    steps: quality === 'low' ? 4 : 6,
  })), [hazeMasses, moonPosition, quality, settings.cloudCoolTint, settings.cloudWhiteHighlight, settings.coldLightIntensity, settings.hazeDensity, settings.hazeHeight, settings.hazeMotionSpeed, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
  const moonSurface = useMoonSurfaceTextures()
  const moonHaloTexture = useMemo(() => createMoonHaloTexture(), [])
  const scatteringLayers = useMemo(() => getGalleryMoonScatteringLayers(moonPosition, lightTarget), [lightTarget, moonPosition])
  const scatteringMaterials = useMemo(() => scatteringLayers.map((layer) => new ShaderMaterial({
    uniforms: {
      uIntensity: { value: layer.intensity * settings.moonScatteringIntensity },
      uRaysIntensity: { value: settings.moonGodRaysIntensity },
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
    fog: false,
  }), [moonBrightness, moonSurface, settings.moonLightColor])
  const haloMaterial = useMemo(() => new MeshBasicMaterial({
    map: halo,
    color: settings.moonLightColor,
    transparent: true,
    opacity: Math.min(0.6, moonBrightness * settings.coldLightIntensity * settings.moonHaloIntensity * 0.28),
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }), [halo, moonBrightness, settings.coldLightIntensity, settings.moonHaloIntensity, settings.moonLightColor])
  const moonHaloMaterial = useMemo(() => new MeshBasicMaterial({
    map: moonHaloTexture,
    color: settings.moonLightColor,
    transparent: true,
    opacity: Math.min(0.5, settings.moonHaloIntensity * 0.4),
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
  useFrame(() => {
    const time = galleryMotion.time
    setGalleryAtmosphereTime([...cloudMaterials, ...hazeMaterials, ...scatteringMaterials], time)
    const haloBreath = 0.97 + 0.03 * Math.sin(time * 0.24)
    const diffuseHalo = diffuseHaloMesh.current?.material
    if (diffuseHalo && !Array.isArray(diffuseHalo)) diffuseHalo.opacity = Math.min(0.6, moonBrightness * settings.coldLightIntensity * settings.moonHaloIntensity * 0.28) * haloBreath
    const lunarHalo = moonHaloMesh.current?.material
    if (lunarHalo && !Array.isArray(lunarHalo)) lunarHalo.opacity = Math.min(0.5, settings.moonHaloIntensity * 0.4) * (0.985 + 0.015 * Math.sin(time * 0.2 + 0.6))
    cloudMasses.forEach((mass, index) => {
      const drift = getGalleryCloudDrift(mass, time, settings.cloudDriftSpeed, settings.cloudDriftVariation)
      const x = mass.position[0] + drift[0]
      const y = mass.position[1] + drift[1]
      const z = mass.position[2] + drift[2]
      cloudMeshes.current[index]?.position.set(x, y, z)
      const center = cloudMaterials[index]?.uniforms.uCenter?.value as Vector3 | undefined
      center?.set(x, y, z)
    })
    hazeMasses.forEach((mass, index) => {
      const drift = getGalleryCloudDrift(mass, time, settings.hazeMotionSpeed * 2.5, 0.35)
      const x = mass.position[0] + drift[0]
      const y = mass.position[1] + settings.hazeHeight + drift[1]
      const z = mass.position[2] + drift[2]
      hazeMeshes.current[index]?.position.set(x, y, z)
      const center = hazeMaterials[index]?.uniforms.uCenter?.value as Vector3 | undefined
      center?.set(x, y, z)
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
    <WetFloor settings={settings} />
    {cloudMasses.map((mass, index) => <mesh
      key={mass.id}
      ref={(mesh) => { cloudMeshes.current[index] = mesh }}
      position={mass.position}
      scale={mass.radii.map((radius) => radius * settings.cloudScale) as [number, number, number]}
      visible={settings.cloudDensity > 0}
      raycast={ignoreRaycast}
      renderOrder={-3}
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
      color={settings.moonLightColor}
      groundColor="#101827"
      intensity={settings.moonFillIntensity}
    />
    <directionalLight
      position={moonLightPosition}
      target={moonLightTarget}
      color={settings.moonLightColor}
      intensity={settings.moonLightIntensity * moonBrightness}
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
