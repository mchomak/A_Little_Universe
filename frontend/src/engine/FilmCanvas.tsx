import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraDirector } from './CameraDirector'
import { SceneDirector } from './SceneDirector'
import { GraphicsBoundary } from '../components/GraphicsBoundary'
import { GraphicsFallback } from '../components/GraphicsFallback'
import type { SceneProps } from './sceneTypes'

export function FilmCanvas(props: SceneProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [lost, setLost] = useState(false)

  useEffect(() => {
    if (!canvas) return
    const onLost = (event: Event) => {
      event.preventDefault()
      setLost(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [canvas])

  if (lost) return <GraphicsFallback />

  return (
    <GraphicsBoundary>
      <Canvas
        frameloop="demand"
        dpr={props.state.quality === 'low' ? 1 : [1, 1.5]}
        camera={{ position: [0, 0, 5.6], fov: 38, near: 0.05, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        onCreated={({ gl }) => setCanvas(gl.domElement)}
        fallback={<GraphicsFallback />}
      >
        <CameraDirector {...props} />
        <SceneDirector {...props} />
      </Canvas>
    </GraphicsBoundary>
  )
}
