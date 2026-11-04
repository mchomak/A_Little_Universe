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

export function isFilmStartupFailure(value: unknown): value is FilmStartupFailure {
  if (!value || typeof value !== 'object') return false
  const failure = value as { source?: unknown; reason?: unknown }
  return (failure.source === 'gift' || failure.source === 'particles') && 'reason' in failure
}
