import { expect, it, vi } from 'vitest'
import { observeWebGLContext } from './webglContextEvents'

it('prevents context loss from forcing teardown and reports restoration', () => {
  const canvas = new EventTarget()
  const onLost = vi.fn()
  const onRestored = vi.fn()
  const cleanup = observeWebGLContext(canvas, onLost, onRestored)
  const lost = new Event('webglcontextlost', { cancelable: true })

  canvas.dispatchEvent(lost)
  canvas.dispatchEvent(new Event('webglcontextrestored'))

  expect(lost.defaultPrevented).toBe(true)
  expect(onLost).toHaveBeenCalledOnce()
  expect(onRestored).toHaveBeenCalledOnce()

  cleanup()
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  canvas.dispatchEvent(new Event('webglcontextrestored'))
  expect(onLost).toHaveBeenCalledOnce()
  expect(onRestored).toHaveBeenCalledOnce()
})
