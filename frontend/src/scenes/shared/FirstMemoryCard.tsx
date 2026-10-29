import { useLoader } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react'
import { CanvasTexture, DoubleSide, Group, SRGBColorSpace, Texture, TextureLoader, type Material } from 'three'
import photoUrl from '../../assets/start_img.jpg'

function setPhotoColorSpace(texture: Texture) { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true }

/** The same photograph and physical frame are shared by the film and gallery. */
export function FirstMemoryCard({ photoRef, frameRef, photoMaterial, rimMaterial }: {
  photoRef?: RefObject<Group | null>
  frameRef?: RefObject<Group | null>
  photoMaterial?: Material
  rimMaterial?: Material
}) {
  const texture = useLoader(TextureLoader, photoUrl)
  const glow = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = 'rgba(255,208,175,.22)'; ctx.shadowColor = 'rgba(255,189,150,.4)'
    ctx.shadowBlur = 12; ctx.lineWidth = 1.2; ctx.strokeRect(16, 16, 480, 480)
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => glow.dispose(), [glow])
  useLayoutEffect(() => { setPhotoColorSpace(texture) }, [texture])
  return <>
    <group ref={frameRef ?? null}>
      <mesh position={[0, 0, -.022]}><boxGeometry args={[2.158, 2.158, .028]} /><meshBasicMaterial color="#17141d" transparent /></mesh>
      <mesh position={[0, 0, -.003]} userData={{ memoryEdgeGlow: true }}><planeGeometry args={[2.3, 2.3]} /><meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} /></mesh>
      {([-1, 1] as const).map((side) => <group key={side}>
        <mesh position={[0, side * 1.078, -.002]}><planeGeometry args={[2.158, .005]} /><meshBasicMaterial color="#e4c7b7" toneMapped={false} transparent /></mesh>
        <mesh position={[side * 1.078, 0, -.002]}><planeGeometry args={[.005, 2.158]} /><meshBasicMaterial color="#e4c7b7" toneMapped={false} transparent /></mesh>
      </group>)}
    </group>
    <group ref={photoRef ?? null}>
      <mesh><planeGeometry args={[2.15, 2.15]} />{photoMaterial ? <primitive object={photoMaterial} attach="material" /> : <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} transparent />}</mesh>
    </group>
    {rimMaterial && <mesh position={[0, 0, -.03]}><planeGeometry args={[2.19, 2.19]} /><primitive object={rimMaterial} attach="material" /></mesh>}
  </>
}
