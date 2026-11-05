import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import archModelUrl from '../../assets/gallery-arch/classical_archway_design.glb?url'
import type { SceneComposerConfig } from '../../systems/scene-config/config'
import { GALLERY_MEMORIES } from './content'
import { GALLERY_WORLD } from './world'
import { acquireGalleryArchMaterials, centerGalleryArchAtFloor, setGalleryArchOpacity } from './archModel'
import { getGalleryArchPosition } from './archPlacement'
import { galleryArchDistanceOpacity } from './visibility'

type GallerySettings = SceneComposerConfig['scenes']['gallery']

export function GalleryArch({ settings }: { settings: GallerySettings }) {
  const gltf = useGLTF(archModelUrl)
  const placement = useRef<Group>(null)
  const layout = settings.galleryLayoutVariant === 'between-columns' ? settings.galleryLayoutB : settings.galleryLayoutA
  const archPosition = useMemo(() => getGalleryArchPosition(
    GALLERY_MEMORIES,
    settings.galleryWidth,
    settings.galleryLayoutVariant,
    layout,
    settings.archPositionX,
    settings.archPositionY,
    GALLERY_WORLD.floor.y,
    {
      columnScale: settings.columnScale,
      columnDepth: settings.columnDepth,
      columnOffsetX: settings.columnOffsetX,
      columnOffsetY: settings.columnOffsetY,
    },
    settings.archPositionZ,
  ), [
    settings.archPositionZ,
    settings.columnDepth,
    settings.columnOffsetX,
    settings.columnOffsetY,
    settings.columnScale,
    layout,
    settings.archPositionX,
    settings.archPositionY,
    settings.galleryLayoutVariant,
    settings.galleryWidth,
  ])
  const model = useMemo(() => {
    const root = clone(gltf.scene) as Group
    const bounds = centerGalleryArchAtFloor(root)
    if (!bounds) throw new Error('The gallery arch GLB does not contain visible geometry.')
    root.traverse((object) => { object.frustumCulled = true })
    return { root, bounds }
  }, [gltf.scene])

  useLayoutEffect(() => acquireGalleryArchMaterials(model.root), [model])
  useFrame(({ camera }) => {
    const group = placement.current
    if (!group) return
    group.position.set(...archPosition)
    group.rotation.set(0, settings.archRotationY, 0)
    group.scale.setScalar(settings.archScale)
    const distance = camera.position.distanceTo(group.position)
    setGalleryArchOpacity(model.root, settings.archOpacity * galleryArchDistanceOpacity(distance))
  })

  return <group ref={placement} visible={settings.archVisible}>
    <primitive object={model.root} />
  </group>
}

useGLTF.preload(archModelUrl)
