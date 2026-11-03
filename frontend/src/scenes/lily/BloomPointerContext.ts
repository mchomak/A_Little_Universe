import { createContext, useContext } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

type BloomPointerHandler = (event: ThreeEvent<PointerEvent>) => void

const BloomPointerContext = createContext<BloomPointerHandler>(() => {})

export function useBloomPointerHandler() {
  return useContext(BloomPointerContext)
}

export { BloomPointerContext }
