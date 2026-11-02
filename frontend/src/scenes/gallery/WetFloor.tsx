import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh } from 'three'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { GALLERY_WORLD, type GalleryQuality } from './world'
import { galleryMotion } from './controller'
import { createGalleryPlanarReflectionPass } from './planarReflection'
import { createGalleryWaterMaterial, createGalleryWaterNormalTexture, updateGalleryWaterCamera, updateGalleryWaterMaterial } from './waterMaterial'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

export function WetFloor({
  settings,
  quality,
  reducedMotion,
}: {
  settings: GallerySettings
  quality: GalleryQuality
  reducedMotion: boolean
}) {
  const floor = useRef<Mesh>(null)
  const { gl } = useThree()
  const supportsFloatColorBuffer = gl.capabilities.isWebGL2 && gl.extensions.has('EXT_color_buffer_float')
  const reflectionPass = useMemo(() => createGalleryPlanarReflectionPass({
    quality,
    supportsFloatColorBuffer,
  }), [quality, supportsFloatColorBuffer])
  const normalTexture = useMemo(() => createGalleryWaterNormalTexture(quality === 'low' ? 128 : 512), [quality])
  const waterMaterial = useMemo(() => createGalleryWaterMaterial(
    reflectionPass.target.texture,
    normalTexture,
    reflectionPass.textureMatrix,
  ), [normalTexture, reflectionPass])

  useEffect(() => () => {
    reflectionPass.dispose()
    normalTexture.dispose()
    waterMaterial.dispose()
  }, [normalTexture, reflectionPass, waterMaterial])

  useLayoutEffect(() => {
    updateGalleryWaterMaterial(waterMaterial, settings, galleryMotion.time, reducedMotion)
    const mesh = floor.current
    if (!mesh) return
    const previousOnBeforeRender = mesh.onBeforeRender
    const renderReflection: Mesh['onBeforeRender'] = (renderer, scene, camera) => {
      if (!floor.current) return
      updateGalleryWaterCamera(waterMaterial, camera)
      reflectionPass.render(renderer, scene, camera, mesh)
    }
    mesh.onBeforeRender = renderReflection
    return () => {
      if (mesh.onBeforeRender === renderReflection) mesh.onBeforeRender = previousOnBeforeRender
    }
  }, [reflectionPass, reducedMotion, settings, waterMaterial])

  useFrame(() => {
    updateGalleryWaterMaterial(waterMaterial, settings, galleryMotion.time, reducedMotion)
  })

  return <mesh
    ref={floor}
    position={[0, GALLERY_WORLD.floor.y, GALLERY_WORLD.floor.centerZ]}
    rotation={[-Math.PI / 2, 0, 0]}
    raycast={() => undefined}
    renderOrder={-1}
  >
    <planeGeometry args={[GALLERY_WORLD.floor.width, GALLERY_WORLD.floor.depth]} />
    <primitive object={waterMaterial} attach="material" />
  </mesh>
}
