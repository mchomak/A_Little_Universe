export type FilmStartupFailureSource = 'gift' | 'particles'

export interface FilmStartupFailure {
  source: FilmStartupFailureSource
  reason: unknown
}

export interface FilmStartupError {
  source: FilmStartupFailureSource
  message: string
  seedKey?: string
}

function tagFailure(source: FilmStartupFailureSource, promise: Promise<unknown>) {
  return promise.catch((reason: unknown) => {
    throw { source, reason } satisfies FilmStartupFailure
  })
}

/** Preserve which prerequisite failed while both startup operations run concurrently. */
export function awaitFilmStartup(gift: Promise<unknown>, particles: Promise<unknown>): Promise<void> {
  return Promise.all([tagFailure('gift', gift), tagFailure('particles', particles)]).then(() => undefined)
}

export interface PreparedFilmStart {
  startGift(): Promise<unknown>
  prepareParticles(): Promise<unknown>
  stopRecording(): Promise<unknown>
  isCurrent(): boolean
  onReady(): void
}

/** Starts gesture-sensitive work immediately, then mounts only after both prerequisites settle. */
export async function startPreparedFilm({ startGift, prepareParticles, stopRecording, isCurrent, onReady }: PreparedFilmStart): Promise<void> {
  let giftPromise: Promise<unknown>
  try { giftPromise = startGift() } catch (reason) { giftPromise = Promise.reject(reason) }
  let particlePromise: Promise<unknown>
  try { particlePromise = prepareParticles() } catch (reason) { particlePromise = Promise.reject(reason) }
  try {
    await awaitFilmStartup(giftPromise, particlePromise)
  } catch (failure) {
    if (isCurrent()) {
      try { await stopRecording() } catch { /* Preserve the original startup failure. */ }
    }
    throw failure
  }
  if (isCurrent()) onReady()
}

export function isFilmStartupFailure(value: unknown): value is FilmStartupFailure {
  if (!value || typeof value !== 'object') return false
  const failure = value as { source?: unknown; reason?: unknown }
  return (failure.source === 'gift' || failure.source === 'particles') && 'reason' in failure
}
