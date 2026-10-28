import { useLoader } from '@react-three/fiber'
import { useLayoutEffect, type RefObject } from 'react'
import { DoubleSide, Group, SRGBColorSpace, Texture, TextureLoader } from 'three'
import photoUrl from '../../assets/start_img.jpg'

function setPhotoColorSpace(texture: Texture) { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true }

/** The same photograph and physical frame are shared by the film and gallery. */
export function FirstMemoryCard({ photoRef, frameRef }: {
  photoRef?: RefObject<Group | null>
  frameRef?: RefObject<Group | null>
}) {
  const texture = useLoader(TextureLoader, photoUrl)
  useLayoutEffect(() => { setPhotoColorSpace(texture) }, [texture])
  return <>
    <group ref={frameRef ?? null}>
      <mesh position={[0, 0, -0.045]}><boxGeometry args={[2.23, 2.23, 0.08]} /><meshBasicMaterial color="#e7d2d8" /></mesh>
    </group>
    <group ref={photoRef ?? null}>
      <mesh><planeGeometry args={[2.15, 2.15]} /><meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} /></mesh>
    </group>
  </>
}
