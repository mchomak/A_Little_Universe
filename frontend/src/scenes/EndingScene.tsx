import type { SceneProps } from '../engine/sceneTypes'
import { ParticleCloud, Spark } from './shared/Primitives'

export function EndingScene({ state }: SceneProps) {
  return <><group position={[0, 0, -0.5]} rotation={[0, 0, 0.4]}><ParticleCloud low={state.quality === 'low'} spiral /></group><Spark position={[2.1, -0.8, 0]} /></>
}
