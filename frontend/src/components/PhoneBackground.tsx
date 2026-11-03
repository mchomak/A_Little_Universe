import { useSyncExternalStore, type CSSProperties } from 'react'
import phoneBackgroundUrl from '../../../images/phone_1.png'
import { getConfig, subscribeConfig } from '../systems/scene-config/config'
import './phone-background.css'

interface PhoneBackgroundProps {
  active?: boolean
}

/** Static DOM layer shared by the opening screens and scenes 01–04. */
export function PhoneBackground({ active = true }: PhoneBackgroundProps) {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  if (!active) return null

  const { zoom, offsetX, offsetY } = config.scenes.openingBackground
  const style: CSSProperties = {
    backgroundImage: `url("${phoneBackgroundUrl}")`,
    backgroundPosition: `${50 + offsetX * 50}% ${50 + offsetY * 50}%`,
    transform: `translate(${(zoom - 1) * offsetX * 50}%, ${(zoom - 1) * offsetY * 50}%) scale(${zoom})`,
  }

  return <div className="phone-background" aria-hidden="true"><div className="phone-background-image" style={style} /></div>
}
