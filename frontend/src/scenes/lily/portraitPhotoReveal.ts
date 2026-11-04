/** Returns the latest assigned route landing using the braking value consumed by the particle shader. */
export function getLilyPortraitPhotoLastArrivalTime(
  portraitMotion: ArrayLike<number>,
  portraitRoutes: ArrayLike<number>,
  braking: number,
) {
  const safeBraking = Number.isFinite(braking) ? Math.min(2, Math.max(0.25, braking)) : 1
  const count = Math.min(portraitRoutes.length, Math.floor(portraitMotion.length / 4))
  let latestArrival = 0

  for (let index = 0; index < count; index += 1) {
    if ((portraitRoutes[index] ?? 0) <= 0.5) continue
    const offset = index * 4
    const launch = portraitMotion[offset] ?? 0
    const travel = portraitMotion[offset + 1] ?? 0
    if (!Number.isFinite(launch) || !Number.isFinite(travel)) continue
    latestArrival = Math.max(latestArrival, launch + Math.max(0.05, travel * safeBraking))
  }

  return latestArrival
}

export const LILY_PORTRAIT_PHOTO_PAUSE_SECONDS = 0.85
export const LILY_PORTRAIT_PHOTO_REVEAL_SECONDS = 3.2
export const LILY_PORTRAIT_PHOTO_FINAL_HOLD_SECONDS = 1.25

/** An absolute-time reveal clock stays reversible under pause, seek, resize and replay. */
export function getLilyPortraitPhotoRevealProgress(
  time: number,
  lastArrival: number,
  pause = LILY_PORTRAIT_PHOTO_PAUSE_SECONDS,
  duration = LILY_PORTRAIT_PHOTO_REVEAL_SECONDS,
) {
  const sceneTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const arrival = Number.isFinite(lastArrival) ? Math.max(0, lastArrival) : 0
  const pauseDuration = Number.isFinite(pause) ? Math.max(0, pause) : LILY_PORTRAIT_PHOTO_PAUSE_SECONDS
  const revealDuration = Number.isFinite(duration) ? Math.max(0, duration) : LILY_PORTRAIT_PHOTO_REVEAL_SECONDS
  const revealStart = arrival + pauseDuration
  if (sceneTime <= revealStart) return 0
  if (revealDuration === 0) return 1
  return Math.min(1, Math.max(0, (sceneTime - revealStart) / revealDuration))
}
