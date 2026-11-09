import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CameraDirector } from './CameraDirector'
import { SceneDirector } from './SceneDirector'
import { GraphicsBoundary } from '../components/GraphicsBoundary'
import { GraphicsFallback } from '../components/GraphicsFallback'
import type { SceneProps } from './sceneTypes'
import { getConfig, subscribeConfig, type SceneComposerConfig } from '../systems/scene-config/config'
import { observeWebGLContext } from './webglContextEvents'

function WebGLContextEvents({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const canvas = useThree(({ gl }) => gl.domElement)
  const invalidate = useThree(({ invalidate }) => invalidate)
  useEffect(() => observeWebGLContext(canvas, onLost, () => {
    onRestored()
    invalidate()
  }), [canvas, invalidate, onLost, onRestored])
  return null
}

function getFilmCanvasDprBounds(config: SceneComposerConfig, quality: 'standard' | 'low'): [number, number] {
  const min = config.global.dprMin
  const max = config.global.dprMax
  return [min, quality === 'low' ? Math.max(min, Math.min(max, 1)) : max]
}

export function FilmCanvas(props: SceneProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [lost, setLost] = useState(false)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const previousFilmQuality = useRef(props.state.quality)
  const [filmQualityOverride, setFilmQualityOverride] = useState<'standard' | 'low' | null>(null)
  useEffect(() => {
    if (previousFilmQuality.current !== props.state.quality) {
      previousFilmQuality.current = props.state.quality
      setFilmQualityOverride(props.state.quality)
    }
  }, [props.state.quality])
  const dpr = getFilmCanvasDprBounds(config, filmQualityOverride ?? config.global.quality)
  const handleContextLost = useCallback(() => setLost(true), [])
  const handleContextRestored = useCallback(() => setLost(false), [])

  return (
    <div className="film-canvas-shell">
      <GraphicsBoundary>
        <Canvas
          frameloop="demand"
          dpr={dpr}
          camera={{ position: [0, 0, 5.6], fov: 38, near: 0.05, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
          onCreated={({ gl }) => setCanvas(gl.domElement)}
          fallback={<GraphicsFallback hidden={canvas !== null} />}
        >
          <WebGLContextEvents onLost={handleContextLost} onRestored={handleContextRestored} />
          <CameraDirector {...props} />
          <SceneDirector {...props} />
        </Canvas>
      </GraphicsBoundary>
      {lost && <div className="graphics-fallback-overlay"><GraphicsFallback /></div>}
    </div>
  )
}
