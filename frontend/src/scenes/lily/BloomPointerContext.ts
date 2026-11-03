import { createContext, useContext } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

type BloomPointerHandler = (event: ThreeEvent<PointerEvent>) => void

interface BloomPointerContextValue {
  onPointerDown: BloomPointerHandler
  getElapsed: () => number
}

const BloomPointerContext = createContext<BloomPointerContextValue>({ onPointerDown: () => {}, getElapsed: () => 0 })

export function useBloomPointerHandler() {
  return useContext(BloomPointerContext).onPointerDown
}

export function useBloomElapsedTime() {
  return useContext(BloomPointerContext).getElapsed
}

export { BloomPointerContext }
