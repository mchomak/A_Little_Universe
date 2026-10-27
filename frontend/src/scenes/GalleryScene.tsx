import type { SceneProps } from '../engine/sceneTypes'
import { MEMORIES } from '../engine/filmConfig'
import { galleryPosition } from './shared/layout'
import { PlaceholderCard, Spark } from './shared/Primitives'

export function GalleryScene({ state, dispatch }: SceneProps) {
  const [x, y, z] = galleryPosition(state.galleryIndex)
  return <>
    {MEMORIES.map((memory) => <group key={memory.id} position={galleryPosition(memory.index)}>
      <PlaceholderCard active={state.galleryIndex === memory.index} onClick={(event) => { event.stopPropagation(); dispatch({ type: 'gallery-focus', index: memory.index }) }} />
      {/* A simple row of marks identifies cards spatially; exact numbers/captions are in DOM. */}
      {Array.from({ length: memory.index + 1 }, (_, mark) => <mesh key={mark} position={[-0.25 + mark * 0.1, -0.64, 0.012]}><circleGeometry args={[0.018, 8]} /><meshBasicMaterial color="#FFF0E8" /></mesh>)}
    </group>)}
    <Spark position={[x + 1.35, y - 0.35, z + 0.1]} />
  </>
}
