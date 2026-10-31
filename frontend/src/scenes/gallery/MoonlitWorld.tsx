import { useEffect, useMemo, useState } from 'react'
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import type { CanvasTexture, Texture } from 'three'
import moonAlbedoUrl from '../../assets/gallery-moonlit/lroc-color-2k.jpg'
import moonHeightUrl from '../../assets/gallery-moonlit/ldem-3-8bit.jpg'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { createGalleryAtmosphereMaterial, setGalleryAtmosphereTime } from './cloudMaterial'
import { createMoonHaloTexture } from './worldTextures'
import { GALLERY_WORLD, getGalleryCloudWisps, getGalleryHazeMasses, getGalleryMoonScatteringLayers, type GalleryQuality } from './world'
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
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = dot(p, p);
    float halo = exp(-r * 2.8) * (1.0 - smoothstep(0.62, 1.0, r));
    float grain = 0.88 + hash(floor(vUv * 34.0)) * 0.12;
    float angle = atan(p.y, p.x);
    float radialRays = pow(max(0.0, cos(angle * 10.0 + uSeed * 0.17)), 24.0)
      * smoothstep(0.08, 0.24, r) * (1.0 - smoothstep(0.58, 0.96, r));
    float alpha = min(0.18, halo * grain * uIntensity + radialRays * uRaysIntensity * 0.012);
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
  const cloudWisps = useMemo(() => getGalleryCloudWisps(quality, settings.cloudLayerCount), [quality, settings.cloudLayerCount])
  const moonPosition = useMemo(() => [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ] as const,
    [settings.moonPositionX, settings.moonPositionY, settings.moonPositionZ])
  const lightTarget = useMemo(() => [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ] as const,
    [settings.moonTargetX, settings.moonTargetY, settings.moonTargetZ])
  const hazeMasses = useMemo(() => getGalleryHazeMasses(quality), [quality])
  const atmosphereGeometry = useMemo(() => new SphereGeometry(1, quality === 'low' ? 30 : 48, quality === 'low' ? 20 : 32), [quality])
  const cloudMaterials = useMemo(() => cloudWisps.map((mass) => createGalleryAtmosphereMaterial({
    kind: 'cloud',
    seed: mass.seed,
    opacity: mass.opacity * settings.cloudDensity,
    intensity: settings.cloudIntensity,
    moonPosition,
    moonColor: settings.moonLightColor,
    moonLightIntensity: settings.moonLightIntensity * settings.coldLightIntensity * settings.moonCloudLightIntensity,
    driftSpeed: settings.cloudDriftSpeed,
  })), [cloudWisps, moonPosition, settings.cloudDensity, settings.cloudDriftSpeed, settings.cloudIntensity, settings.coldLightIntensity, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
  const hazeMaterials = useMemo(() => hazeMasses.map((mass) => createGalleryAtmosphereMaterial({
    kind: 'haze',
    seed: mass.seed,
    opacity: mass.opacity * settings.hazeDensity,
    intensity: 1,
    moonPosition,
    moonColor: settings.moonLightColor,
    moonLightIntensity: settings.moonLightIntensity * settings.coldLightIntensity * settings.moonCloudLightIntensity * 0.72,
  })), [hazeMasses, moonPosition, settings.coldLightIntensity, settings.hazeDensity, settings.moonCloudLightIntensity, settings.moonLightColor, settings.moonLightIntensity])
  const moonSurface = useMoonSurfaceTextures()
  const moonHaloTexture = useMemo(() => createMoonHaloTexture(), [])
  const scatteringLayers = useMemo(() => getGalleryMoonScatteringLayers(moonPosition, lightTarget), [lightTarget, moonPosition])
  const scatteringMaterials = useMemo(() => scatteringLayers.map((layer) => new ShaderMaterial({
    uniforms: {
      uIntensity: { value: layer.intensity * settings.moonScatteringIntensity },
      uRaysIntensity: { value: settings.moonGodRaysIntensity },
      uMoonColor: { value: new Color(settings.moonLightColor) },
      uSeed: { value: layer.seed },
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
    setGalleryAtmosphereTime(cloudMaterials, galleryMotion.time)
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
    {cloudWisps.map((mass, index) => <mesh
      key={mass.id}
      position={mass.position}
      scale={mass.radii}
      visible={settings.cloudDensity > 0}
      raycast={ignoreRaycast}
      renderOrder={-3}
    >
      <primitive object={atmosphereGeometry} attach="geometry" />
      <primitive object={cloudMaterials[index]!} attach="material" />
    </mesh>)}
    {hazeMasses.map((mass, index) => <mesh
      key={mass.id}
      position={[mass.position[0], mass.position[1] + settings.hazeHeight, mass.position[2]]}
      scale={mass.radii}
      visible={settings.hazeDensity > 0}
      raycast={ignoreRaycast}
      renderOrder={-1}
    >
      <primitive object={atmosphereGeometry} attach="geometry" />
      <primitive object={hazeMaterials[index]!} attach="material" />
    </mesh>)}
    <mesh position={[moon.position[0], moon.position[1], moon.position[2] - 0.26]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
      <planeGeometry args={[moon.haloRadius * settings.moonHaloRadius * 2, moon.haloRadius * settings.moonHaloRadius * 2]} />
      <primitive object={moonHaloMaterial} attach="material" />
    </mesh>
    <mesh position={[moon.position[0], moon.position[1], moon.position[2] - 0.22]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
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
