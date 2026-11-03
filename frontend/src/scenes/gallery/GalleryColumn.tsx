import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Camera, Group, Light, Mesh } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { acquireGalleryColumnMaterials, acquireGalleryColumnShaftGeometry, extendGalleryColumnShaft, getGalleryColumnPlacement, setGalleryColumnOpacity, type GalleryColumnSettings } from './columnModel'
import { GALLERY_WORLD } from './world'
import columnModelUrl from '../../assets/gallery-ionic-column/column.glb?url'

export type { GalleryColumnSettings } from './columnModel'

const IGNORE_RAYCAST = () => undefined

interface ColumnModelInstance {
  root: Group
  shaftFrontZ: number
  baseBottom: number
}

function disableColumnPicking(root: Group) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.raycast = IGNORE_RAYCAST
  })
}

function createColumnModel(scene: Group): ColumnModelInstance {
  const root = clone(scene) as Group
  const nonRenderable = [] as (Camera | Light)[]
  root.traverse((object) => {
    if (object instanceof Camera || object instanceof Light) nonRenderable.push(object)
  })
  nonRenderable.forEach((object) => object.parent?.remove(object))

  const extended = extendGalleryColumnShaft(root)
  if (!extended) throw new Error('Unable to extend the original ionic shaft and raise its capital using the GLB transforms.')
  disableColumnPicking(root)
  return { root, shaftFrontZ: extended.bounds.shaftFrontZ, baseBottom: extended.bounds.baseBottom }
}

/**
 * Original Sketchfab ionic column, attached to one photo's Memory transform.
 * Local photo face is +Z, so a positive depth puts the column behind the card.
 */
export function GalleryColumn({ visible, scale, depth, offsetX, offsetY, opacity }: GalleryColumnSettings & { opacity: RefObject<number> }) {
  const gltf = useGLTF(columnModelUrl)
  const rootRef = useRef<Group>(null)
  const model = useMemo(() => createColumnModel(gltf.scene), [gltf.scene])

  useLayoutEffect(() => acquireGalleryColumnMaterials(model.root), [model.root])
  useLayoutEffect(() => acquireGalleryColumnShaftGeometry(model.root), [model.root])

  useFrame(() => {
    const root = rootRef.current
    const parent = root?.parent
    if (!root || !parent) return

    const placement = getGalleryColumnPlacement(
      { scale, depth, offsetX, offsetY },
      parent.scale,
      GALLERY_WORLD.floor.y,
      model.shaftFrontZ,
      model.baseBottom,
    )
    root.position.set(...placement.position)
    root.scale.set(...placement.scale)
    setGalleryColumnOpacity(model.root, opacity.current)
  })

  return <group ref={rootRef} visible={visible} raycast={IGNORE_RAYCAST}>
    <primitive object={model.root} />
  </group>
}

useGLTF.preload(columnModelUrl)
