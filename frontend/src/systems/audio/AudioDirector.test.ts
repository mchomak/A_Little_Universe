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

it('routes music through a separate adjustable master on the unlocked shared context', async () => {
  const sfxSource = { buffer: null, playbackRate: { value: 1 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }
  const makeGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })
  const sfxGain = makeGain()
  const musicMaster = makeGain()
  const firstChannelGain = makeGain()
  const secondChannelGain = makeGain()
  const replacementChannelGain = makeGain()
  const gains = [sfxGain, musicMaster, firstChannelGain, secondChannelGain, replacementChannelGain]
  const mediaSources = new Map<HTMLMediaElement, { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }>()
  const firstElement = {} as HTMLMediaElement
  const secondElement = {} as HTMLMediaElement
  const context = {
    state: 'suspended',
    resume: vi.fn(async () => { context.state = 'running' }),
    suspend: vi.fn(async () => { context.state = 'suspended' }),
    close: vi.fn(async () => { context.state = 'closed' }),
    createGain: vi.fn(() => gains[context.createGain.mock.calls.length - 1]),
    createBufferSource: vi.fn(() => sfxSource),
    createMediaElementSource: vi.fn((element: HTMLMediaElement) => {
      const source = { connect: vi.fn(), disconnect: vi.fn() }
      mediaSources.set(element, source)
      return source
    }),
    destination: {},
  }
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const audio = new AudioDirector(createContext)
  audio.setBuffer('prologue-intro', {} as AudioBuffer)

  expect(audio.createMusicChannel(firstElement)).toBeNull()
  expect(context.createMediaElementSource).not.toHaveBeenCalled()
  expect(await audio.unlock()).toBe(true)
  expect(audio.cue('prologue-intro')).toBe(true)
  audio.setMusicVolume(0.4)
  const firstChannel = audio.createMusicChannel(firstElement)
  const repeatedFirstChannel = audio.createMusicChannel(firstElement)
  const secondChannel = audio.createMusicChannel(secondElement)

  expect(firstChannel).not.toBeNull()
  expect(repeatedFirstChannel).toBe(firstChannel)
  expect(secondChannel).not.toBeNull()
  expect(createContext).toHaveBeenCalledOnce()
  expect(context.createGain).toHaveBeenCalledTimes(4)
  expect(context.createMediaElementSource).toHaveBeenCalledTimes(2)
  expect(sfxSource.connect).toHaveBeenCalledWith(sfxGain)
  expect(mediaSources.get(firstElement)!.connect).toHaveBeenCalledWith(firstChannel!.gain)
  expect(mediaSources.get(secondElement)!.connect).toHaveBeenCalledWith(secondChannel!.gain)
  expect(firstChannel!.gain).toBe(firstChannelGain)
  expect(secondChannel!.gain).toBe(secondChannelGain)
  expect(firstChannelGain.connect).toHaveBeenCalledWith(musicMaster)
  expect(secondChannelGain.connect).toHaveBeenCalledWith(musicMaster)
  expect(sfxGain.connect).toHaveBeenCalledWith(context.destination)
  expect(musicMaster.connect).toHaveBeenCalledWith(context.destination)
  expect(sfxGain.gain.value).toBe(0.65)
  expect(musicMaster.gain.value).toBe(0.4)

  audio.stop()
  expect(sfxSource.stop).toHaveBeenCalledOnce()
  expect(mediaSources.get(firstElement)!.disconnect).not.toHaveBeenCalled()
  expect(mediaSources.get(secondElement)!.disconnect).not.toHaveBeenCalled()
  firstChannel!.dispose()
  firstChannel!.dispose()
  expect(mediaSources.get(firstElement)!.disconnect).toHaveBeenCalledOnce()
  expect(mediaSources.get(firstElement)!.disconnect).toHaveBeenCalledWith(firstChannelGain)
  expect(mediaSources.get(secondElement)!.disconnect).not.toHaveBeenCalled()
  expect(firstChannelGain.disconnect).toHaveBeenCalledOnce()
  expect(secondChannelGain.disconnect).not.toHaveBeenCalled()

  const replacementChannel = audio.createMusicChannel(firstElement)
  expect(replacementChannel).not.toBeNull()
  expect(replacementChannel).not.toBe(firstChannel)
  expect(context.createMediaElementSource).toHaveBeenCalledTimes(2)
  expect(mediaSources.get(firstElement)!.connect).toHaveBeenCalledWith(replacementChannel!.gain)
  expect(replacementChannel!.gain).toBe(replacementChannelGain)

  await audio.dispose()
  expect(secondChannelGain.disconnect).toHaveBeenCalledOnce()
  expect(replacementChannelGain.disconnect).toHaveBeenCalledOnce()
  expect(musicMaster.disconnect).toHaveBeenCalledOnce()
  expect(context.close).toHaveBeenCalledOnce()
})
