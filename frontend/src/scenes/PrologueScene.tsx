import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import type { SceneProps } from '../engine/sceneTypes'
import { getPrologueFrames } from '../engine/filmConfig'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { loadArtFont } from '../systems/scene-config/fontCatalog'
import { PrologueAtmosphere } from './prologue/PrologueAtmosphere'
import { LetterLayer, makeResource, type LetterResource } from './prologue/LetterLayer'
import { createPrologueDissolveStyle, rasterizeLetter } from './prologue/letterMatter'
import { resolvePrologueParticleCount } from './prologue/particleMath'

// eslint-disable-next-line react-refresh/only-export-components -- retained public deterministic sampling seam.
export { sampleGlyphParticlePixels } from './prologue/letterMatter'

export function PrologueScene(props: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.prologue
  const frames = useMemo(() => getPrologueFrames(config), [config])
  const size = useThree((state) => state.size), gl = useThree((state) => state.gl), invalidate = useThree((state) => state.invalidate)
  const dpr = useThree((state) => state.viewport.dpr)
  const [letters, setLetters] = useState<LetterResource[]>([])

  useLayoutEffect(() => {
    let disposed = false, queued = 0, generation = 0
    const rebuild = () => {
      const request = ++generation
      void loadArtFont(config.fontFamily).then(() => {
        if (disposed || request !== generation) return
        cancelAnimationFrame(queued)
        queued = requestAnimationFrame(() => {
          if (disposed || request !== generation) return
          const viewport = gl.domElement.getBoundingClientRect()
          const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-prologue-line]'))
          if (elements.length !== 2) return
          const compact = size.width < 820 || window.matchMedia('(pointer:coarse)').matches
          const count = props.reducedMotion ? 0 : resolvePrologueParticleCount(config.particleCount, props.state.quality, dpr, compact)
          const next = elements.flatMap((element, index) => {
            const seed = config.seed + index * 71
            const dissolveStyle = createPrologueDissolveStyle(seed, config.fractureWidth)
            const raster = rasterizeLetter(element, viewport, config.handwritingRhythm, config.fractureWidth, seed, dissolveStyle)
            const fracture = index === 0 ? frames.firstDissolve : frames.secondDissolve
            return raster ? [makeResource(raster, Math.floor(count / 2), seed, index, fracture, dissolveStyle, config.particleSizeMin, config.particleSizeMax)] : []
          })
          setLetters(next)
          document.querySelector<HTMLElement>('.prologue-overlay')?.setAttribute('data-matter-ready', String(next.length === 2))
          invalidate()
        })
      })
    }
    rebuild()
    window.addEventListener('prologue-layout', rebuild)
    return () => { disposed = true; generation++; cancelAnimationFrame(queued); window.removeEventListener('prologue-layout', rebuild) }
  }, [config, frames, gl, dpr, invalidate, props.reducedMotion, props.state.quality, size.width, size.height])

  useLayoutEffect(() => () => { document.querySelector('.prologue-overlay')?.removeAttribute('data-matter-ready') }, [])
  useLayoutEffect(() => () => { for (const letter of letters) { letter.texture.dispose(); letter.geometry.dispose() } }, [letters])
  return <><PrologueAtmosphere {...props} />{letters.map((resource) => <LetterLayer key={`${resource.index}:${resource.texture.uuid}`} resource={resource} runtime={props.runtime} reducedMotion={props.reducedMotion} />)}</>
}
