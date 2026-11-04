import type { BlueEyeSettings } from './config'

export type IrisMaskName = 'iris' | 'pupil'
export type IrisMaskAction = 'center' | 'radius-x' | 'radius-y'
export type IrisMaskHandle = `${IrisMaskName}-${IrisMaskAction}`
export type IrisMaskHandleSet<Name extends IrisMaskName> = { [Handle in `${Name}-${IrisMaskAction}`]: NormalizedPoint }

export type NormalizedPoint = { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Convert pointer positions on the source photograph into an editable ellipse mask. */
export function moveIrisMaskHandle(settings: BlueEyeSettings, handle: IrisMaskHandle, point: NormalizedPoint): BlueEyeSettings {
  const name: IrisMaskName = handle.startsWith('iris-') ? 'iris' : 'pupil'
  const action = handle.slice(name.length + 1) as IrisMaskAction
  const prefix = name === 'iris' ? 'iris' : 'pupil'
  const centerXKey = `${prefix}CenterX` as const
  const centerYKey = `${prefix}CenterY` as const
  const radiusXKey = `${prefix}RadiusX` as const
  const radiusYKey = `${prefix}RadiusY` as const
  const rotationKey = `${prefix}Rotation` as const

  if (action === 'center') return { ...settings, [centerXKey]: clamp(point.x, 0, 1), [centerYKey]: clamp(point.y, 0, 1) }

  const dx = point.x - settings[centerXKey]
  const dy = point.y - settings[centerYKey]
  const cosine = Math.cos(settings[rotationKey])
  const sine = Math.sin(settings[rotationKey])
  const projected = action === 'radius-x' ? dx * cosine + dy * sine : -dx * sine + dy * cosine
  return action === 'radius-x'
    ? { ...settings, [radiusXKey]: clamp(projected, 0.01, 0.5) }
    : { ...settings, [radiusYKey]: clamp(projected, 0.01, 0.5) }
}

/** Return the three draggable handles in normalized coordinates for an SVG mask editor. */
export function irisMaskHandles<Name extends IrisMaskName>(settings: BlueEyeSettings, name: Name): IrisMaskHandleSet<Name> {
  const centerX = name === 'iris' ? settings.irisCenterX : settings.pupilCenterX
  const centerY = name === 'iris' ? settings.irisCenterY : settings.pupilCenterY
  const radiusX = name === 'iris' ? settings.irisRadiusX : settings.pupilRadiusX
  const radiusY = name === 'iris' ? settings.irisRadiusY : settings.pupilRadiusY
  const rotation = name === 'iris' ? settings.irisRotation : settings.pupilRotation
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  return {
    [`${name}-center`]: { x: centerX, y: centerY },
    [`${name}-radius-x`]: { x: centerX + radiusX * cosine, y: centerY + radiusX * sine },
    [`${name}-radius-y`]: { x: centerX - radiusY * sine, y: centerY + radiusY * cosine },
  } as IrisMaskHandleSet<Name>
}
