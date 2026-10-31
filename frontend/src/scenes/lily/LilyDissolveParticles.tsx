import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Points } from 'three'
import type { FilmRuntime } from '../../engine/runtime'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createLilyParticleGeometry, createLilyParticleMaterial, LILY_PARTICLE_TAIL_SECONDS, updateLilyParticleSize, type LilyDissolveUniforms } from './dissolve'
import type { LilySurfaceSource } from './particleSource'

export function LilyDissolveParticles({ source, uniforms, low, runtime }: { source: LilySurfaceSource; uniforms: LilyDissolveUniforms; low: boolean; runtime: FilmRuntime }) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)
  const points = useRef<Points>(null)
  const count = low ? Math.min(9000, config.scenes.identity.particleCount) : config.scenes.identity.particleCount
  const geometry = useMemo(() => createLilyParticleGeometry(source, count), [source, count])
  const material = useMemo(() => createLilyParticleMaterial(uniforms), [uniforms])
  useLayoutEffect(() => { updateLilyParticleSize(uniforms, config.scenes.identity.particleSize, dpr) }, [uniforms, config.scenes.identity.particleSize, dpr])
  useLayoutEffect(() => {
    const sync = (time: number) => {
      if (points.current) points.current.visible = time < config.scenes.identity.dissolveDuration + LILY_PARTICLE_TAIL_SECONDS
      invalidate()
    }
    sync(runtime.time)
    return runtime.subscribeFrame(sync)
  }, [runtime, invalidate, config.scenes.identity.dissolveDuration])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
