import { expect, it, vi } from 'vitest'
import { createFilmRuntime } from '../../engine/runtime'
import { subscribeLilyAnimationClock } from './animationClock'

it('does not subscribe static reduced-motion IdleClosed to presentation ticks', () => {
  const runtime = createFilmRuntime()
  const draw = vi.fn()
  const unsubscribe = subscribeLilyAnimationClock(runtime, draw, true, true)

  runtime.publishPresentation(1)
  runtime.publishPresentation(2)
  expect(draw).not.toHaveBeenCalled()
  runtime.publish(0)
  expect(draw).toHaveBeenCalledTimes(1)
  unsubscribe()
  runtime.publish(0)
  expect(draw).toHaveBeenCalledTimes(1)
})

it('keeps the animated IdleClosed presentation loop when motion is allowed', () => {
  const runtime = createFilmRuntime()
  const draw = vi.fn()
  const unsubscribe = subscribeLilyAnimationClock(runtime, draw, true, false)

  runtime.publishPresentation(2)
  expect(draw).toHaveBeenCalledTimes(1)
  unsubscribe()
})
