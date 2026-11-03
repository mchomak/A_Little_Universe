import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useThree } from '@react-three/fiber'
import type { SceneProps } from '../engine/sceneTypes'
import { getGrowthSceneFrames } from '../engine/filmConfig'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { loadArtFont } from '../systems/scene-config/fontCatalog'
import { LetterLayer, makeResource, type LetterLayerOptions, type LetterResource } from './prologue/LetterLayer'
import { createPrologueDissolveStyle, rasterizeLetter } from './prologue/letterMatter'
import { resolvePrologueParticleCount } from './prologue/particleMath'
import { createBloomTextClock, getBloomTextStartDelay } from './lily/bloomGesture'

/** Renders the scene-03 invitation through the same atlas, ink shader and dust system as scene 01. */
export function BloomCalligraphyMatter(props: SceneProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const prologue = config.scenes.prologue
  const text = config.scenes.bloom
  const growthFrames = getGrowthSceneFrames(config.scenes.growth)
  const textStartDelay = getBloomTextStartDelay(config.scenes.growth.growthVortex.dissipationDuration,
    growthFrames.duration - growthFrames.model[1])
  const size = useThree((state) => state.size)
  const gl = useThree((state) => state.gl)
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const [letters, setLetters] = useState<LetterResource[]>([])
  const clock = useRef(createBloomTextClock(props.runtime.presentationTime, props.state.mode === 'waiting' ? 'waiting' : 'playing', props.state.revision))
  const fractureStart = useRef<number | null>(props.state.mode === 'waiting' ? null : 0)
  const previousMode = useRef(props.state.mode)
  const previousRevision = useRef(props.state.revision)
  useLayoutEffect(() => {
    clock.current.setState(props.state.mode === 'waiting' ? 'waiting' : 'playing', props.state.revision)
    if (previousMode.current === 'waiting' && props.state.mode === 'playing') fractureStart.current = clock.current.waitingElapsed()
    if (previousRevision.current !== props.state.revision && props.state.mode === 'waiting') fractureStart.current = null
    previousMode.current = props.state.mode
    previousRevision.current = props.state.revision
    clock.current.update(props.runtime.presentationTime, props.runtime.time)
  }, [props.runtime, props.state])

  const getTime = useCallback(() => clock.current.time(), [])
  const getFractureStart = useCallback(() => fractureStart.current, [])
  const getDissolveEnd = useCallback((start: number) => start + 2.6 + prologue.particleDuration, [prologue.particleDuration])
  const subscribeTime = useCallback((draw: () => void) => {
    const updatePresentation = (time: number) => { clock.current.update(time, props.runtime.time); draw() }
    const updateScene = (time: number) => { clock.current.update(props.runtime.presentationTime, time); draw() }
    updatePresentation(props.runtime.presentationTime)
    const unsubscribePresentation = props.runtime.subscribePresentation(updatePresentation)
    const unsubscribeFrame = props.runtime.subscribeFrame(updateScene)
    return () => { unsubscribePresentation(); unsubscribeFrame() }
  }, [props.runtime])
  const layerSettings = useMemo(() => ({
    textGlow: Math.min(prologue.textGlow, 0.16),
    particleGlow: prologue.particleGlow,
    particleFadeDuration: prologue.particleFadeDuration,
    windStrength: prologue.windStrength,
    turbulence: prologue.turbulence,
    particleTravelDuration: prologue.particleDuration,
    inkColor: text.textColor,
    particleColor: text.textColor,
  }), [prologue.textGlow, prologue.particleGlow, prologue.particleFadeDuration, prologue.windStrength, prologue.turbulence, prologue.particleDuration, text.textColor])
  const layerOptions = useMemo<LetterLayerOptions>(() => ({
    settings: layerSettings,
    write: [textStartDelay, textStartDelay + text.textWritingDuration],
    fracture: [0, 2.6],
    getTime,
    getFractureStart,
    getEmissionOffset: getFractureStart,
    getDissolveEnd,
    subscribeTime,
  }), [getDissolveEnd, getFractureStart, getTime, layerSettings, subscribeTime, text.textWritingDuration, textStartDelay])

  useLayoutEffect(() => {
    let disposed = false
    let queued = 0
    let generation = 0
    const rebuild = () => {
      const request = ++generation
      void loadArtFont(prologue.fontFamily).then(() => {
        if (disposed || request !== generation) return
        cancelAnimationFrame(queued)
        queued = requestAnimationFrame(() => {
          if (disposed || request !== generation) return
          const viewport = gl.domElement.getBoundingClientRect()
          const element = document.querySelector<HTMLElement>('[data-bloom-text]')
          if (!element) return
          const compact = size.width < 820 || window.matchMedia('(pointer:coarse)').matches
          const count = props.reducedMotion ? 0 : resolvePrologueParticleCount(text.textParticleCount, props.state.quality, dpr, compact)
          const seed = prologue.seed + 913
          const dissolveStyle = createPrologueDissolveStyle(seed, prologue.fractureWidth)
          const raster = rasterizeLetter(element, viewport, prologue.handwritingRhythm, prologue.fractureWidth, seed, dissolveStyle)
          const resource = raster ? makeResource(raster, count, seed, 0, [0, 2.6], dissolveStyle, prologue.particleSizeMin, prologue.particleSizeMax) : null
          const next = resource ? [resource] : []
          setLetters(next)
          document.querySelector<HTMLElement>('.bloom-overlay')?.setAttribute('data-matter-ready', String(next.length === 1))
          invalidate()
        })
      })
    }
    rebuild()
    window.addEventListener('resize', rebuild)
    document.fonts?.addEventListener('loadingdone', rebuild)
    return () => { disposed = true; generation++; cancelAnimationFrame(queued); window.removeEventListener('resize', rebuild); document.fonts?.removeEventListener('loadingdone', rebuild) }
  }, [dpr, gl, invalidate, prologue, props.reducedMotion, props.state.quality, size.height, size.width, text.textParticleCount, text.textPositionX, text.textPositionY, text.textSize])

  useLayoutEffect(() => () => { document.querySelector('.bloom-overlay')?.removeAttribute('data-matter-ready') }, [])
  useLayoutEffect(() => () => { for (const letter of letters) { letter.texture.dispose(); letter.geometry.dispose() } }, [letters])

  return <>{letters.map((resource) => <LetterLayer key={resource.texture.uuid} resource={resource} runtime={props.runtime} reducedMotion={props.reducedMotion} options={layerOptions} />)}</>
}
