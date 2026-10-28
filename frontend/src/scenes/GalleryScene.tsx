import type { SceneProps } from '../engine/sceneTypes'
import { MEMORIES } from '../engine/filmConfig'
import { galleryPosition } from './shared/layout'
import { FirstMemoryCard } from './shared/FirstMemoryCard'
import { PlaceholderCard, Spark } from './shared/Primitives'

export function GalleryScene({ state, dispatch }: SceneProps) {
  const [x, y, z] = galleryPosition(state.galleryIndex)
  return <>
    {MEMORIES.map((memory) => <group key={memory.id} position={galleryPosition(memory.index)}
      onClick={(event) => { event.stopPropagation(); dispatch({ type: 'gallery-focus', index: memory.index }) }}>
      {memory.index === 0 ? <FirstMemoryCard /> : <PlaceholderCard active={state.galleryIndex === memory.index} />}
    </group>)}
    <Spark position={[x + 1.35, y - 0.35, z + 0.1]} />
  </>
}
