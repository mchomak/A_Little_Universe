import { describe, expect, it } from 'vitest'
import { filmDuration, filmReducer, initialFilmState, type FilmAction, type FilmState } from './film'
import { getGrowthSceneFrames, MEMORIES } from './filmConfig'
import { resetConfig, updateConfig } from '../systems/scene-config/config'
import { GALLERY } from '../scenes/gallery/content'

const complete = (state: FilmState) => filmReducer(
  filmReducer(state, { type: 'timeline-update', time: filmDuration(state), revision: state.revision }),
  { type: 'timeline-complete', revision: state.revision },
)

it('keeps the prologue playing through eighteen seconds and gives the touch its own 0.85-second passage', () => {
  let state = filmReducer(initialFilmState, { type: 'start' })
  expect(filmDuration(state)).toBe(18)

  state = filmReducer(state, { type: 'timeline-update', time: 17.999, revision: state.revision })
  expect(state.mode).toBe('playing')
  expect(filmReducer(state, { type: 'timeline-complete', revision: state.revision })).toBe(state)

  state = filmReducer(state, { type: 'timeline-update', time: 18, revision: state.revision })
  state = filmReducer(state, { type: 'timeline-complete', revision: state.revision })
  expect([state.mode, state.elapsed]).toEqual(['waiting', 18])

  state = filmReducer(state, { type: 'interact' })
  expect([state.mode, state.elapsed, filmDuration(state)]).toEqual(['transitioning', 18, 18.85])
})

it('captures touch duration once so editing the composer cannot change an active handoff', async () => {
  await resetConfig('all')
  await updateConfig({ scenes: { prologue: { touchDuration: 1 } } })
  try {
    const waiting = complete(filmReducer(initialFilmState, { type: 'start' }))
    const transition = filmReducer(waiting, { type: 'interact' })
    expect(filmDuration(transition)).toBe(19)
    await updateConfig({ scenes: { prologue: { touchDuration: 0.7 } } })
    expect(filmDuration(transition)).toBe(19)
    expect(filmDuration(filmReducer(waiting, { type: 'interact' }))).toBe(18.7)
  } finally {
    await resetConfig('all')
  }
})

it('starts Bloom automatically after the growth settle and keeps configured clip durations inside the scene endpoint', async () => {
  await resetConfig('all')
  try {
    let growth = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'growth' }, true)
    await updateConfig({ scenes: { growth: { formationDuration: 3.5, flowerGrowthDuration: 7 } } })
    expect(filmDuration(growth)).toBe(21.1)
    growth = filmReducer(growth, { type: 'dev-seek', time: 999 }, true)
    expect(growth.elapsed).toBe(21.1)
    expect(getGrowthSceneFrames().duration - getGrowthSceneFrames().model[1]).toBeCloseTo(1.9)
    growth = filmReducer(growth, { type: 'timeline-complete', revision: growth.revision })
    expect([growth.scene, growth.mode, growth.elapsed]).toEqual(['bloom', 'playing', 0])

    await updateConfig({ scenes: { bloom: { flowerBloomDuration: 12 } } })
    expect(filmDuration(growth)).toBe(18)
    growth = filmReducer(growth, { type: 'timeline-update', time: 0.5, revision: growth.revision })
    expect([growth.scene, growth.mode, growth.elapsed, filmDuration(growth)]).toEqual(['bloom', 'playing', 0.5, 18])
    growth = filmReducer(growth, { type: 'timeline-update', time: 18, revision: growth.revision })
    growth = filmReducer(growth, { type: 'timeline-complete', revision: growth.revision })
    expect(growth.scene).toBe('identity')
  } finally {
    await resetConfig('all')
  }
})

it('extends the active Identity clock for a long portrait route and rejects its stale endpoint', () => {
  const identity: FilmState = { ...initialFilmState, scene: 'identity', mode: 'playing' }
  expect(filmDuration(identity)).toBe(25)
  const extended = filmReducer(identity, {
    type: 'extend-identity-duration', duration: 40, time: 12.3, revision: identity.revision,
  })

  expect(filmDuration(extended)).toBe(40)
  expect(extended.elapsed).toBe(12.3)
  expect(extended.revision).toBe(identity.revision + 1)
  expect(filmReducer(extended, { type: 'timeline-update', time: 34, revision: identity.revision })).toBe(extended)
  expect(filmReducer(extended, { type: 'timeline-complete', revision: identity.revision })).toBe(extended)

  const nearEnd = filmReducer(extended, { type: 'timeline-update', time: 39.99, revision: extended.revision })
  expect(nearEnd.scene).toBe('identity')
  const complete = filmReducer(filmReducer(nearEnd, {
    type: 'timeline-update', time: 40, revision: extended.revision,
  }), { type: 'timeline-complete', revision: extended.revision })
  expect(complete.scene).toBe('gallery')
  expect(filmDuration(complete)).toBe(0)
})

it('bounds DEV seek by the dynamic Identity endpoint', () => {
  let identity = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'identity' }, true)
  identity = filmReducer(identity, {
    type: 'extend-identity-duration', duration: 48, time: 0, revision: identity.revision,
  })

  identity = filmReducer(identity, { type: 'dev-seek', time: 46 }, true)
  expect(identity.elapsed).toBe(46)
  identity = filmReducer(identity, { type: 'dev-seek', time: 999 }, true)
  expect(identity.elapsed).toBe(48)
})

it('keeps the film clock moving past its endpoint while new Identity geometry is pending', () => {
  let identity = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'identity' }, true)
  identity = filmReducer(identity, {
    type: 'set-identity-preparation-pending', pending: true, time: 0, revision: identity.revision,
  })
  expect(identity.identityPreparationPending).toBe(true)

  const firstEndpoint = filmDuration(identity)
  identity = filmReducer(identity, {
    type: 'timeline-update', time: firstEndpoint, revision: identity.revision,
  })
  expect(identity.scene).toBe('identity')
  expect(identity.elapsed).toBe(firstEndpoint)
  expect(filmDuration(identity)).toBeGreaterThan(firstEndpoint)
  expect(identity.revision).toBeGreaterThan(1)

  const nextEndpoint = filmDuration(identity)
  identity = filmReducer(identity, {
    type: 'timeline-update', time: nextEndpoint, revision: identity.revision,
  })
  expect(identity.scene).toBe('identity')
  expect(identity.elapsed).toBe(nextEndpoint)
  expect(filmDuration(identity)).toBeGreaterThan(nextEndpoint)

  identity = filmReducer(identity, {
    type: 'set-identity-duration', duration: 45, time: nextEndpoint, revision: identity.revision,
  })
  expect(identity.identityPreparationPending).toBe(false)
  expect(filmDuration(identity)).toBe(45)
  expect(identity.elapsed).toBe(nextEndpoint)
})

describe('film navigation', () => {
  it('waits indefinitely, accepts one touch and runs a pausable impulse before growth', () => {
    let state = complete(filmReducer(initialFilmState, { type: 'start' }))
    expect(filmReducer(state, { type: 'timeline-update', time: 900, revision: state.revision })).toBe(state)
    state = filmReducer(state, { type: 'toggle-pause' })
    expect(filmReducer(state, { type: 'interact' })).toBe(state)
    state = filmReducer(state, { type: 'toggle-pause' })
    state = filmReducer(state, { type: 'interact' })
    expect([state.scene, state.mode, state.elapsed]).toEqual(['prologue', 'transitioning', 18])
    expect(filmReducer(state, { type: 'interact' })).toBe(state)
    const revision = state.revision
    state = filmReducer(state, { type: 'timeline-update', time: 18.4, revision })
    expect(filmReducer(state, { type: 'timeline-complete', revision })).toBe(state)
    state = filmReducer(state, { type: 'toggle-pause' })
    expect(filmReducer(state, { type: 'timeline-update', time: 18.85, revision })).toBe(state)
    state = filmReducer(state, { type: 'toggle-pause' })
    state = filmReducer(state, { type: 'timeline-update', time: 18.85, revision })
    state = filmReducer(state, { type: 'timeline-complete', revision })
    expect([state.scene, state.elapsed]).toEqual(['growth', 0])
    expect(filmReducer(state, { type: 'timeline-complete', revision })).toBe(state)
  })
  it('seeks within the automatic Bloom playback', () => {
    let state = complete(filmReducer(initialFilmState, { type: 'start' }))
    state = filmReducer(state, { type: 'dev-seek', time: 4 }, true)
    expect([state.mode, state.elapsed]).toEqual(['playing', 4])
    state = filmReducer(state, { type: 'dev-jump', scene: 'bloom' }, true)
    state = filmReducer(state, { type: 'dev-seek', time: 22 }, true)
    expect([state.mode, state.elapsed]).toEqual(['playing', 22])
    state = complete(state)
    expect(state.scene).toBe('identity')
  })
  it('allows deliberate developer navigation, bounded seeking and speed, and rejects stale or invalid input', () => {
    const eyeJump = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'eye' } as unknown as FilmAction, true)
    expect(eyeJump).toBe(initialFilmState)
    let state = filmReducer(initialFilmState, { type: 'dev-jump', scene: 'cosmos' }, true)
    expect([state.scene, state.elapsed, state.mode]).toEqual(['cosmos', 0, 'playing'])
    expect(filmReducer(state, { type: 'dev-jump', scene: 'cosmos' })).toBe(state)
    expect(filmReducer(state, { type: 'timeline-complete', revision: state.revision })).toBe(state)
    const oldRevision = state.revision
    state = filmReducer(state, { type: 'dev-seek', time: 9 }, true)
    expect(state.elapsed).toBe(9)
    expect(state.revision).toBeGreaterThan(oldRevision)
    for (const action of [
      { type: 'timeline-update', time: 18, revision: oldRevision },
      { type: 'timeline-complete', revision: oldRevision },
      { type: 'timeline-update', time: Infinity, revision: state.revision },
      { type: 'dev-seek', time: NaN }, { type: 'set-speed', speed: 0 },
      { type: 'set-speed', speed: -1 }, { type: 'set-speed', speed: Infinity },
      { type: 'set-speed', speed: 1000 },
    ] satisfies FilmAction[]) expect(filmReducer(state, action, true)).toBe(state)
    state = filmReducer(state, { type: 'set-speed', speed: 4 })
    expect(state.speed).toBe(4)
    state = filmReducer(state, { type: 'dev-seek', time: 999 }, true)
    expect(state.elapsed).toBe(26)
    state = filmReducer(state, { type: 'dev-seek', time: -9 }, true)
    expect(state.elapsed).toBe(0)
    state = filmReducer(state, { type: 'dev-jump', scene: 'gallery' }, true)
    for (const index of [-1, 6, NaN, Infinity, 1.5]) expect(filmReducer(state, { type: 'gallery-focus', index })).toBe(state)
    expect(filmReducer(state, { type: 'gallery-step', direction: -1 })).toBe(state)
    state = filmReducer(state, { type: 'gallery-step', direction: 1 })
    expect(state.galleryIndex).toBe(Math.min(1, MEMORIES.length - 1))
    state = filmReducer(state, { type: 'set-quality', quality: 'low' })
    expect(state.quality).toBe('low')
    state = filmReducer(state, { type: 'dev-skip' }, true)
    expect(state.scene).toBe('cosmos')
    state = filmReducer(state, { type: 'dev-restart' }, true)
    expect([state.scene, state.elapsed, state.paused]).toEqual(['cosmos', 0, false])
  })
  it('freezes reading independently of manual pause and returns revisits to ending', () => {
    let state: FilmState = { ...initialFilmState, scene: 'greeting', mode: 'playing', elapsed: 21 }
    state = filmReducer(state, { type: 'toggle-pause' })
    expect(state.paused).toBe(true)
    state = filmReducer(state, { type: 'open-reading' })
    expect(state.reading).toBe(true)
    expect(filmReducer(state, { type: 'timeline-update', time: 40, revision: state.revision })).toBe(state)
    state = filmReducer(state, { type: 'close-reading' })
    expect([state.reading, state.paused, state.elapsed]).toEqual([false, true, 21])
    state = filmReducer(state, { type: 'toggle-pause' })
    expect(state.paused).toBe(false)
    state = filmReducer(state, { type: 'open-reading' })
    state = filmReducer(state, { type: 'close-reading' })
    expect(state.paused).toBe(false)
    const ending: FilmState = { ...state, scene: 'ending', mode: 'ended' }
    state = filmReducer(ending, { type: 'open-reading' })
    expect([state.scene, state.reading, state.returnToEnding]).toEqual(['greeting', true, true])
    state = filmReducer(state, { type: 'close-reading' })
    expect([state.scene, state.mode]).toEqual(['ending', 'ended'])
    state = filmReducer(state, { type: 'open-gallery' })
    expect([state.scene, state.galleryIndex, state.returnToEnding]).toEqual(['gallery', 0, true])
    state = filmReducer(state, { type: 'gallery-exit' })
    expect(state.scene).toBe('ending')
    state = filmReducer({ ...state, paused: true, reading: true, galleryIndex: 5 }, { type: 'replay' })
    expect(state).toEqual({ ...initialFilmState, mode: 'playing', revision: state.revision })
  })
  it('runs the full film while preserving touch, gallery and finish gates', () => {
    let state = filmReducer(initialFilmState, { type: 'start' })
    expect(state.mode).toBe('playing')
    state = complete(state)
    expect([state.scene, state.mode, state.elapsed]).toEqual(['prologue', 'waiting', 18])
    expect(complete(state)).toBe(state)
    state = filmReducer(state, { type: 'interact' })
    state = filmReducer(state, { type: 'timeline-update', time: 18.85, revision: state.revision })
    state = filmReducer(state, { type: 'timeline-complete', revision: state.revision })
    expect(state.scene).toBe('growth')
    state = complete(state)
    expect([state.scene, state.mode, state.elapsed]).toEqual(['bloom', 'playing', 0])
    state = complete(state)
    expect(state.scene).toBe('identity')
    state = complete(state)
    expect([state.scene, state.mode]).toEqual(['gallery', 'exploring'])
    expect(complete(state)).toBe(state)
    if (MEMORIES.length > 1) expect(filmReducer(state, { type: 'gallery-exit' })).toBe(state)
    state = filmReducer(state, { type: 'gallery-focus', index: MEMORIES.length - 1 })
    expect(state.galleryIndex).toBe(MEMORIES.length - 1)
    expect(complete(state)).toBe(state)
    state = filmReducer(state, { type: 'gallery-exit' })
    expect([state.scene, state.elapsed, state.planetariumTransition]).toEqual(['cosmos', GALLERY.exit, true])
    state = complete(state)
    expect(state.scene).toBe('greeting')
    expect(filmReducer(state, { type: 'finish' })).toBe(state)
    state = complete(state)
    expect([state.scene, state.mode, state.elapsed]).toEqual(['greeting', 'waiting', 300])
    expect(complete(state)).toBe(state)
    state = filmReducer(state, { type: 'finish' })
    expect([state.scene, state.mode]).toEqual(['ending', 'ended'])
  })

  it('replays only the letter from the ending and returns to the same ending after the crawl', () => {
    const ending: FilmState = { ...initialFilmState, scene: 'ending', mode: 'ended', elapsed: 0 }
    const replay = filmReducer({ ...ending, paused: true }, { type: 'replay-letter' })
    expect([replay.scene, replay.mode, replay.elapsed, replay.returnToEnding]).toEqual(['greeting', 'playing', 0, true])
    expect(replay.paused).toBe(false)
    const replaySeek = filmReducer(replay, { type: 'dev-seek', time: 12 }, true)
    expect([replaySeek.scene, replaySeek.mode, replaySeek.elapsed, replaySeek.returnToEnding]).toEqual(['greeting', 'playing', 12, true])
    const finished = filmReducer(replay, { type: 'greeting-complete' })
    expect([finished.scene, finished.mode, finished.returnToEnding]).toEqual(['ending', 'ended', false])
  })

  it('keeps greeting waiting for the independently controlled letter crawl', () => {
    const greeting: FilmState = { ...initialFilmState, scene: 'greeting', mode: 'playing', elapsed: 0 }
    const waiting = complete(greeting)
    expect([waiting.scene, waiting.mode]).toEqual(['greeting', 'waiting'])
    expect(filmReducer(waiting, { type: 'timeline-update', time: 40, revision: waiting.revision })).toBe(waiting)
    expect(filmReducer(waiting, { type: 'greeting-complete' }).scene).toBe('ending')
  })

  it('does not leave the greeting while the global film is paused or the letter is open', () => {
    const paused: FilmState = { ...initialFilmState, scene: 'greeting', mode: 'playing', paused: true }
    const reading: FilmState = { ...paused, paused: false, reading: true }
    expect(filmReducer(paused, { type: 'greeting-complete' })).toBe(paused)
    expect(filmReducer(reading, { type: 'greeting-complete' })).toBe(reading)
  })
})

it('completes a gallery after the scene-owned exit sequence without depending on the old selected index', () => {
  const state = { ...initialFilmState, scene: 'gallery' as const, mode: 'exploring' as const, galleryIndex: 0 }
  expect(filmReducer(state, { type: 'gallery-finish' }).scene).toBe('cosmos')
  expect(filmReducer({ ...state, returnToEnding: true }, { type: 'gallery-finish' }).scene).toBe('ending')
  expect(filmReducer(initialFilmState, { type: 'gallery-finish' })).toBe(initialFilmState)
})
