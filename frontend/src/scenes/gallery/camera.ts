/** Temporary focus dolly; the underlying corridor position is never changed. */
export function focusCamera(base: readonly [number, number, number], target: readonly [number, number, number], mix: number) {
  const dx = target[0] - base[0], dy = target[1] - base[1], dz = target[2] - base[2]
  const distance = Math.hypot(dx, dy, dz) || 1
  const amount = Math.min(12, Math.max(0, distance - 4.8)) * Math.max(0, Math.min(1, mix))
  return { x: base[0] + dx / distance * amount, y: base[1] + dy / distance * amount, z: base[2] + dz / distance * amount, distance: distance - amount }
}
