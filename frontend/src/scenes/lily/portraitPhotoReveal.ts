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
