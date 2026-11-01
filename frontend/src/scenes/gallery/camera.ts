/** Temporary focus dolly; the underlying corridor position is never changed. */
export function focusCamera(base: readonly [number, number, number], target: readonly [number, number, number], mix: number, frontYaw?: number) {
  const blend = Math.max(0, Math.min(1, mix))
  if (frontYaw !== undefined) {
    const x = target[0] + Math.sin(frontYaw) * 4.8
    const y = target[1] + 0.12
    const z = target[2] + Math.cos(frontYaw) * 4.8
    const amount = blend
    const cx = base[0] + (x - base[0]) * amount
    const cy = base[1] + (y - base[1]) * amount
    const cz = base[2] + (z - base[2]) * amount
    return { x: cx, y: cy, z: cz, distance: Math.hypot(cx - target[0], cy - target[1], cz - target[2]) }
  }
  const dx = target[0] - base[0], dy = target[1] - base[1], dz = target[2] - base[2]
  const distance = Math.hypot(dx, dy, dz) || 1
  const amount = Math.min(12, Math.max(0, distance - 4.8)) * blend
  return { x: base[0] + dx / distance * amount, y: base[1] + dy / distance * amount, z: base[2] + dz / distance * amount, distance: distance - amount }
}

export const GALLERY_CAMERA_FAR = 220

/** Extends the shared projection for the gallery's distant moon, then restores its exact prior range. */
export function extendGalleryFarPlane(camera: { far: number; updateProjectionMatrix: () => void }): () => void {
  const previousFar = camera.far
  camera.far = Math.max(previousFar, GALLERY_CAMERA_FAR)
  camera.updateProjectionMatrix()
  return () => {
    camera.far = previousFar
    camera.updateProjectionMatrix()
  }
}

/** Applies the gallery-only projection extension and returns an effect-cleanup callback. */
export function configureCameraFarPlane(
  camera: { far: number; updateProjectionMatrix: () => void },
  scene: string,
): () => void {
  return scene === 'gallery' ? extendGalleryFarPlane(camera) : () => undefined
}
