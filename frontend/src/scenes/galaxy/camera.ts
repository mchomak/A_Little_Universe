import type { CameraPose } from '../shared/galleryMotion'

export function galaxyCameraPose(distance: number, angle: number, focusX: number, focusY: number): CameraPose {
  return {
    x: 0,
    y: Math.sin(angle) * distance,
    z: Math.cos(angle) * distance,
    tx: focusX,
    ty: focusY,
    tz: 0,
  }
}

export function interpolateCameraPose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const p = Math.min(1, Math.max(0, progress))
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    z: from.z + (to.z - from.z) * p,
    tx: from.tx + (to.tx - from.tx) * p,
    ty: from.ty + (to.ty - from.ty) * p,
    tz: from.tz + (to.tz - from.tz) * p,
  }
}
