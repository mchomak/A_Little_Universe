import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import phoneBackgroundUrl from '../../../images/phone_1.png'
import { getGrowthSceneFrames } from '../engine/filmConfig'
import type { FilmRuntime } from '../engine/runtime'
import type { SceneId } from '../engine/film'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import { getPhoneBackgroundPanPercent, getPhoneBackgroundProgress } from './phoneBackgroundMotion'
import './phone-background.css'

const CAMERA_TRAVEL_OVERSCAN_ZOOM = 0.8

interface PhoneBackgroundProps {
  active?: boolean
  scene?: SceneId
  runtime?: FilmRuntime
  reducedMotion?: boolean
}

/** Static DOM layer shared by the opening screens and scenes 01–04. */
export function PhoneBackground({ active = true, scene, runtime, reducedMotion = false }: PhoneBackgroundProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  const image = useRef<HTMLDivElement>(null)
  const { zoom: profileZoom, offsetX, offsetY } = config.scenes.openingBackground
  const zoom = profileZoom + CAMERA_TRAVEL_OVERSCAN_ZOOM

  useEffect(() => {
    const element = image.current
    if (!active || !element) return

    const update = (time: number) => {
      const isGrowth = scene === 'growth'
      const progress = reducedMotion ? 0
        : isGrowth ? getPhoneBackgroundProgress(time, getGrowthSceneFrames(config.scenes.growth).fall)
          : scene === 'bloom' || scene === 'identity' ? 1 : 0
      element.style.setProperty('--background-pan-y', `${getPhoneBackgroundPanPercent(progress, zoom, offsetY)}%`)
    }

    update(scene === 'growth' ? runtime?.time ?? 0 : 0)
    if (scene !== 'growth' || !runtime || reducedMotion) return
    return runtime.subscribeFrame(update)
  }, [active, config.scenes.growth, offsetY, reducedMotion, runtime, scene, zoom])

  if (!active) return null

  const style: CSSProperties & { '--background-pan-y': string } = {
    backgroundImage: `url("${phoneBackgroundUrl}")`,
    backgroundPosition: `${50 + offsetX * 50}% ${50 + offsetY * 50}%`,
    transform: `translate(${(zoom - 1) * offsetX * 50}%, var(--background-pan-y, 0%)) scale(${zoom})`,
    '--background-pan-y': '0%',
    filter: scene === 'growth' ? 'brightness(0.48) saturate(0.72)' : 'none',
    transition: reducedMotion ? 'none' : 'filter 700ms ease-in-out',
  }

  return <div className="phone-background" aria-hidden="true"><div ref={image} className="phone-background-image" style={style} /></div>
}
