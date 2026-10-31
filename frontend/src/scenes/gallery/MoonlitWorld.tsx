import { useEffect, useMemo } from 'react'
import { Color, DoubleSide, MeshBasicMaterial } from 'three'
import type { CanvasTexture } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { createCloudTexture, createMoonHaloTexture, createMoonTexture } from './worldTextures'
import { GALLERY_WORLD, getGalleryCloudPlanes, getGalleryCloudTextureDimensions, type GalleryQuality } from './world'
import { WetFloor } from './WetFloor'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

const ignoreRaycast = () => undefined

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
  const [textureWidth, textureHeight] = getGalleryCloudTextureDimensions(quality)
  const cloudTextures = useMemo(
    () => cloudPlanes.map((plane) => createCloudTexture(plane.seed, textureWidth, textureHeight)),
    [cloudPlanes, textureHeight, textureWidth],
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
      map: cloudTextures[index] ?? null,
      color: plane.tint,
      transparent: true,
      opacity: Math.min(1, plane.opacity * settings.cloudDensity),
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
    material.color.multiplyScalar(settings.coldLightIntensity)
    return material
  }), [cloudPlanes, cloudTextures, settings.cloudDensity, settings.coldLightIntensity])

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
    {cloudPlanes.map((plane, index) => <mesh
      key={plane.id}
      position={plane.position}
      rotation={[0, plane.rotationY, 0]}
      visible={settings.cloudDensity > 0}
      raycast={ignoreRaycast}
      renderOrder={plane.id === 'moon-veil' ? -1 : -3}
    >
      <planeGeometry args={plane.size} />
      <primitive object={cloudMaterials[index]!} attach="material" />
    </mesh>)}
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
