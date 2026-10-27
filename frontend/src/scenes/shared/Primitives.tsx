import { useMemo, type RefObject } from 'react'
import { DoubleSide, type Group } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

export function Spark({ position = [0.45, 0.25, 0.4] }: { position?: [number, number, number] }) {
  return <mesh position={position}><sphereGeometry args={[0.024, 12, 8]} /><meshBasicMaterial color="#54B4F0" /></mesh>
}

/** Deliberately schematic flower; final petal art can replace this group. */
export function Lily({ groupRef, onClick }: { groupRef?: RefObject<Group | null>; onClick?: (event: ThreeEvent<MouseEvent>) => void }) {
  return <group ref={groupRef ?? null} onClick={onClick ?? (() => {})}>
    <group name="stem" position={[0, -1.45, 0]}>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.023, 0.04, 1.4, 8]} /><meshStandardMaterial color="#839A88" roughness={0.7} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.2, 0.5 + side * 0.15, 0]} rotation={[0, 0, side * -0.7]} scale={[0.13, 0.38, 0.045]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#839A88" /></mesh>)}
    </group>
    <group name="head">
      {Array.from({ length: 6 }, (_, index) => <group key={index} rotation={[0, index * Math.PI / 3, 0]}>
        <group name={`petal-${index}`} rotation={[0.12, 0, 0]}>
          <mesh position={[0, 0.4, 0.075]} scale={[0.18, 0.58, 0.07]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={index % 2 ? '#FFF0E8' : '#F4CDD9'} roughness={0.5} metalness={0.08} side={DoubleSide} /></mesh>
        </group>
      </group>)}
      <mesh name="heart" scale={0.08}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#FFF0E8" /></mesh>
    </group>
  </group>
}

/** Blank geometry only: no invented image, face, or personal content. */
export function PlaceholderCard({ portrait = false, active = false, onClick }: { portrait?: boolean; active?: boolean; onClick?: (event: ThreeEvent<MouseEvent>) => void }) {
  const width = portrait ? 1.45 : 2.35
  const height = portrait ? 1.9 : 1.65
  return <group onClick={onClick ?? (() => {})}>
    <mesh position={[0, 0, -0.035]}><boxGeometry args={[width + 0.075, height + 0.075, 0.055]} /><meshBasicMaterial color={active ? '#F4CDD9' : '#686277'} /></mesh>
    <mesh><planeGeometry args={[width, height]} /><meshBasicMaterial color={portrait ? '#252132' : '#242936'} side={DoubleSide} /></mesh>
    <mesh position={[0, 0, 0.008]} rotation={[0, 0, Math.PI / 4]}><ringGeometry args={[0.2, 0.21, 4]} /><meshBasicMaterial color={portrait ? '#B9A4E8' : '#9AA9BB'} /></mesh>
    <mesh position={[0, -height * 0.33, 0.008]}><planeGeometry args={[width * 0.5, 0.012]} /><meshBasicMaterial color="#686277" /></mesh>
  </group>
}

export function ParticleCloud({ low, spiral = false }: { low: boolean; spiral?: boolean }) {
  const positions = useMemo(() => {
    const count = low ? 90 : 240
    const data = new Float32Array(count * 3)
    for (let index = 0; index < count; index++) {
      const ratio = (index + 1) / count
      const angle = index * 2.39996
      const radius = spiral ? 0.3 + ratio * 3.7 : Math.sqrt(ratio) * 1.5
      const theta = spiral ? ratio * 17 + index % 3 * Math.PI * 2 / 3 : angle
      data[index * 3] = Math.cos(theta) * radius
      data[index * 3 + 1] = Math.sin(theta) * radius * (spiral ? 0.48 : 0.8)
      data[index * 3 + 2] = Math.sin(angle * 1.7) * (spiral ? 0.45 : 0.6)
    }
    return data
  }, [low, spiral])
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#FFF0E8" size={0.025} sizeAttenuation transparent opacity={0.8} depthWrite={false} /></points>
}

export function Iris() {
  return <group>
    <mesh><ringGeometry args={[0.32, 0.92, 64]} /><meshBasicMaterial color="#29668E" side={DoubleSide} /></mesh>
    <mesh position={[0, 0, 0.006]}><ringGeometry args={[0.39, 0.88, 48, 1, 0, Math.PI * 1.85]} /><meshBasicMaterial color="#54B4F0" wireframe transparent opacity={0.55} /></mesh>
    <mesh position={[0, 0, 0.012]}><ringGeometry args={[0.31, 0.34, 48]} /><meshBasicMaterial color="#B9A4E8" /></mesh>
    <mesh position={[0, 0, 0.015]}><circleGeometry args={[0.31, 48]} /><meshBasicMaterial color="#080914" /></mesh>
  </group>
}
