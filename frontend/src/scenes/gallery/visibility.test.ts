import { expect, it, vi } from 'vitest'
import { wakeOnVisible } from './visibility'
it('wakes a visible demand canvas and removes the listener on disposal', () => {
  const source = new EventTarget() as EventTarget & { hidden: boolean }; source.hidden = true
  const invalidate = vi.fn(); const dispose = wakeOnVisible(source as unknown as Document, invalidate)
  source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).not.toHaveBeenCalled()
  source.hidden = false; source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
  dispose(); source.dispatchEvent(new Event('visibilitychange')); expect(invalidate).toHaveBeenCalledTimes(1)
})
