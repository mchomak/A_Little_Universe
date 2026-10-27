import { useCallback } from 'react'
import type { SceneProps } from '../engine/sceneTypes'
import { ramp, smooth } from './shared/progress'
import { SeedLight } from './shared/SeedLight'

export function PrologueScene({ state, runtime, reducedMotion }: SceneProps) {
  const pose = useCallback((time: number) => {
    const waiting = state.mode === 'waiting'
    const impulse = state.mode === 'transitioning' ? Math.min(1, Math.max(0, (time - 16) / 0.3)) : 0
    const halo = smooth(ramp(time, [14, 16]))
    const breath = reducedMotion ? 0 : Math.sin((time - 16) * Math.PI / 2) * 0.065
    return {
      opacity: smooth(ramp(time, [0, 3])),
      gain: 1 + halo * 0.22 + (waiting || state.mode === 'playing' ? breath : 0) + Math.sin(impulse * Math.PI) * 2.8,
      halo, wave: reducedMotion ? 0 : impulse,
    }
  }, [reducedMotion, state.mode])
  return <SeedLight runtime={runtime} duration={20.3} pose={pose} />
}
