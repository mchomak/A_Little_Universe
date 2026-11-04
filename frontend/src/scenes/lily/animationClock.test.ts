import { expect, it, vi } from 'vitest'
import { createFilmRuntime } from '../../engine/runtime'
import { subscribeLilyAnimationClock } from './animationClock'

it('drives the lily from scene time instead of a separate presentation clock', () => {
  const runtime = createFilmRuntime()
  const draw = vi.fn()
  const unsubscribe = subscribeLilyAnimationClock(runtime, draw)

  runtime.publishPresentation(1)
  runtime.publishPresentation(2)
  expect(draw).not.toHaveBeenCalled()
  runtime.publish(2)
  expect(draw).toHaveBeenCalledWith(2)
  unsubscribe()
  runtime.publish(3)
  expect(draw).toHaveBeenCalledTimes(1)
})
