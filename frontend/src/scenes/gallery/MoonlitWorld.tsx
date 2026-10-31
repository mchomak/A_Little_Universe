import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Color, DoubleSide, MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three'
import type { CanvasTexture, Mesh, Texture } from 'three'
import cloudAtlasUrl from '../../assets/gallery-moonlit/gallery05-moonlit-cloud-atlas-v02.png'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { applyGalleryCloudAtlasUvs, createCloudTexture, createMoonHaloTexture, createMoonTexture } from './worldTextures'
import { GALLERY_WORLD, getGalleryCloudPlanes, getGalleryCloudTextureDimensions, type GalleryCloudPlane, type GalleryQuality } from './world'
import { WetFloor } from './WetFloor'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

const ignoreRaycast = () => undefined

type CloudAtlasState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; texture: Texture }

function useCloudAtlas(): CloudAtlasState {
  const [state, setState] = useState<CloudAtlasState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    const texture = new TextureLoader().load(cloudAtlasUrl, (loaded) => {
      if (!active) {
        loaded.dispose()
        return
      }
      loaded.colorSpace = SRGBColorSpace
      setState({ status: 'ready', texture: loaded })
    }, undefined, () => {
      if (active) setState({ status: 'failed' })
    })

    return () => {
      active = false
      texture.dispose()
    }
  }, [])

  return state
}

function suppressBlueCloudFringe(material: MeshBasicMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.b = min(diffuseColor.b, diffuseColor.g * 1.16);',
    )
  }
  material.customProgramCacheKey = () => 'gallery-moonlit-cloud-blue-fringe-v1'
}

function CloudPlane({
  plane,
  material,
  useAtlasUvs,
  visible,
}: {
  plane: GalleryCloudPlane
  material: MeshBasicMaterial
  useAtlasUvs: boolean
  visible: boolean
}) {
  const mesh = useRef<Mesh>(null)

  useLayoutEffect(() => {
    if (useAtlasUvs && mesh.current) applyGalleryCloudAtlasUvs(mesh.current.geometry, plane.atlasSprite)
  }, [plane.atlasSprite, useAtlasUvs])

  return <mesh
    ref={mesh}
    position={plane.position}
    rotation={[0, plane.rotationY, 0]}
    visible={visible}
    raycast={ignoreRaycast}
    renderOrder={plane.id === 'moon-veil' ? -1 : -3}
  >
    <planeGeometry args={plane.size} />
    <primitive object={material} attach="material" />
  </mesh>
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
  const cloudPlanes = useMemo(() => getGalleryCloudPlanes(quality), [quality])
  const cloudAtlasState = useCloudAtlas()
  const cloudAtlas = cloudAtlasState.status === 'ready' ? cloudAtlasState.texture : null
  const [textureWidth, textureHeight] = getGalleryCloudTextureDimensions(quality)
  const cloudTextures = useMemo(
    () => cloudAtlasState.status === 'failed'
      ? cloudPlanes.map((plane) => createCloudTexture(plane.seed, textureWidth, textureHeight))
      : [],
    [cloudAtlasState.status, cloudPlanes, textureHeight, textureWidth],
  )
  const hazeTextureWidth = quality === 'low' ? 256 : 512
  const hazeTextureHeight = quality === 'low' ? 64 : 128
  const hazeTexture = useMemo(
    () => createCloudTexture(GALLERY_WORLD.haze.seed, hazeTextureWidth, hazeTextureHeight),
    [hazeTextureHeight, hazeTextureWidth],
  )
  const moonTexture = useMemo(() => createMoonTexture(), [])
  const moonHaloTexture = useMemo(() => createMoonHaloTexture(), [])
  const moonBrightness = Math.max(0, settings.moonBrightness)
  const moonMaterial = useMemo(() => new MeshBasicMaterial({
    map: moonTexture,
    color: new Color(moonBrightness * 0.82, moonBrightness * 0.88, moonBrightness * 1.02),
    transparent: true,
    opacity: 1,
    depthWrite: true,
    fog: false,
    toneMapped: false,
  }), [moonBrightness, moonTexture])
  const haloMaterial = useMemo(() => new MeshBasicMaterial({
    map: halo,
    color: '#d3e1f5',
    transparent: true,
    opacity: Math.min(0.6, moonBrightness * settings.coldLightIntensity * 0.38),
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }), [halo, moonBrightness, settings.coldLightIntensity])
  const moonHaloMaterial = useMemo(() => new MeshBasicMaterial({
    map: moonHaloTexture,
    color: '#d9e7fa',
    transparent: true,
    opacity: Math.min(0.82, moonBrightness * settings.coldLightIntensity * 0.8),
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }), [moonBrightness, moonHaloTexture, settings.coldLightIntensity])
  const cloudMaterials = useMemo(() => cloudPlanes.map((plane, index) => {
    const material = new MeshBasicMaterial({
      map: cloudAtlas ?? cloudTextures[index] ?? null,
      color: plane.tint,
      transparent: true,
      opacity: Math.min(1, plane.opacity * settings.cloudDensity),
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
    material.color.multiplyScalar(settings.coldLightIntensity)
    suppressBlueCloudFringe(material)
    return material
  }), [cloudAtlas, cloudPlanes, cloudTextures, settings.cloudDensity, settings.coldLightIntensity])

  useEffect(() => () => {
    cloudTextures.forEach((texture) => texture.dispose())
    hazeTexture.dispose()
  }, [cloudTextures, hazeTexture])
  useEffect(() => () => {
    moonTexture.dispose()
    moonHaloTexture.dispose()
  }, [moonHaloTexture, moonTexture])
  useEffect(() => () => cloudMaterials.forEach((material) => material.dispose()), [cloudMaterials])
  useEffect(() => () => moonMaterial.dispose(), [moonMaterial])
  useEffect(() => () => haloMaterial.dispose(), [haloMaterial])
  useEffect(() => () => moonHaloMaterial.dispose(), [moonHaloMaterial])

  const moon = GALLERY_WORLD.moon
  const moonScale = settings.moonSize
  return <group>
    <WetFloor settings={settings} />
    {cloudAtlasState.status !== 'loading' && cloudPlanes.map((plane, index) => <CloudPlane
      key={plane.id}
      plane={plane}
      material={cloudMaterials[index]!}
      useAtlasUvs={cloudAtlas !== null}
      visible={settings.cloudDensity > 0}
    />)}
    <mesh position={GALLERY_WORLD.haze.position} raycast={ignoreRaycast} renderOrder={-1}>
      <planeGeometry args={GALLERY_WORLD.haze.size} />
      <meshBasicMaterial
        map={hazeTexture}
        color="#a2b6d3"
        transparent
        opacity={Math.min(0.27, settings.hazeDensity * 0.36)}
        depthWrite={false}
        side={DoubleSide}
        fog={false}
        toneMapped={false}
      />
    </mesh>
    <mesh position={[moon.position[0], moon.position[1], moon.position[2] - 0.26]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
      <planeGeometry args={[moon.haloRadius * 2, moon.haloRadius * 2]} />
      <primitive object={moonHaloMaterial} attach="material" />
    </mesh>
    <mesh position={[moon.position[0], moon.position[1], moon.position[2] - 0.22]} scale={moonScale} raycast={ignoreRaycast} renderOrder={-2}>
      <planeGeometry args={[moon.radius * 8, moon.radius * 8]} />
      <primitive object={haloMaterial} attach="material" />
    </mesh>
    <mesh position={moon.position} scale={moonScale} visible={moonBrightness > 0} raycast={ignoreRaycast} renderOrder={-2}>
      <circleGeometry args={[moon.radius, 64]} />
      <primitive object={moonMaterial} attach="material" />
    </mesh>
  </group>
}
