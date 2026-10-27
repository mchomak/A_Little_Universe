import { expect, it, vi } from 'vitest'
import { AudioDirector } from './AudioDirector'

it('honors a pause received during unlock before reporting readiness and does not queue paused cues', async () => {
  let finishResume: (() => void) | undefined
  const context = {
    state: 'suspended',
    resume: vi.fn(() => new Promise<void>((resolve) => { finishResume = () => { context.state = 'running'; resolve() } })),
    suspend: vi.fn(async () => { context.state = 'suspended' }),
    close: vi.fn(async () => { context.state = 'closed' }),
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: vi.fn(), destination: {},
  }
  const audio = new AudioDirector(() => context as unknown as AudioContext)
  audio.setBuffer('prologue-intro', {} as AudioBuffer)
  const unlocking = audio.unlock()
  audio.pause()
  finishResume?.()
  expect(await unlocking).toBe(true)
  expect(context.state).toBe('suspended')
  expect(audio.cue('prologue-intro')).toBe(false)
  expect(context.createBufferSource).not.toHaveBeenCalled()
  await audio.dispose()
})

it('creates audio only on unlock, remains silent without a buffer and owns cue routing and disposal', async () => {
  const source = { buffer: null, playbackRate: { value: 1 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
  const context = { state: 'suspended', resume: vi.fn(async () => { context.state = 'running' }), suspend: vi.fn(async () => { context.state = 'suspended' }), close: vi.fn(async () => { context.state = 'closed' }), createGain: vi.fn(() => gain), createBufferSource: vi.fn(() => source), destination: {} }
  const factory = vi.fn(() => context as unknown as AudioContext)
  const audio = new AudioDirector(factory)
  audio.resume()
  expect(audio.cue('prologue-intro')).toBe(false)
  expect(factory).not.toHaveBeenCalled()
  expect(await audio.unlock()).toBe(true)
  expect(factory).toHaveBeenCalledTimes(1)
  expect(audio.cue('prologue-intro')).toBe(false)
  expect(source.start).not.toHaveBeenCalled()
  audio.setBuffer('prologue-touch', {} as AudioBuffer)
  expect(audio.cue('prologue-touch')).toBe(true)
  expect(source.connect).toHaveBeenCalledWith(gain)
  expect(gain.connect).toHaveBeenCalledWith(context.destination)
  expect(source.start).toHaveBeenCalledOnce()
  audio.setSpeed(2)
  expect(source.playbackRate.value).toBe(2)
  audio.pause()
  expect(context.suspend).toHaveBeenCalledOnce()
  audio.resume()
  expect(context.resume).toHaveBeenCalledTimes(2)
  await audio.dispose()
  await audio.dispose()
  expect(source.stop).toHaveBeenCalledOnce()
  expect(source.disconnect).toHaveBeenCalledOnce()
  expect(gain.disconnect).toHaveBeenCalledOnce()
  expect(context.close).toHaveBeenCalledOnce()
  expect(await audio.unlock()).toBe(false)
})

it('resumes correctly when pause is still pending and never reopens a disposed context', async () => {
  let finishSuspend: (() => void) | undefined
  const context = {
    state: 'running', resume: vi.fn(async () => { context.state = 'running' }),
    suspend: vi.fn(() => new Promise<void>((resolve) => { finishSuspend = () => { context.state = 'suspended'; resolve() } })),
    close: vi.fn(async () => { context.state = 'closed' }),
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }), destination: {},
  }
  const audio = new AudioDirector(() => context as unknown as AudioContext)
  expect(await audio.unlock()).toBe(true)
  audio.pause()
  audio.resume()
  finishSuspend?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(context.state).toBe('running')
  audio.pause()
  await audio.dispose()
  finishSuspend?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(context.resume).toHaveBeenCalledTimes(2)
})
