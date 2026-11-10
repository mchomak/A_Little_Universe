import { expect, it } from 'vitest'
import { getCameraTimelineRevision } from './cameraPoseContinuity'

it('does not rebuild a galaxy camera timeline when the editor seeks to another frame', () => {
  expect(getCameraTimelineRevision('cosmos', 4)).toBe(getCameraTimelineRevision('cosmos', 5))
  expect(getCameraTimelineRevision('greeting', 4)).toBe(getCameraTimelineRevision('greeting', 5))
  expect(getCameraTimelineRevision('ending', 4)).toBe(getCameraTimelineRevision('ending', 5))
})

it('keeps other scene revisions in the camera timeline key', () => {
  expect(getCameraTimelineRevision('gallery', 4)).not.toBe(getCameraTimelineRevision('gallery', 5))
  expect(getCameraTimelineRevision('growth', 4)).not.toBe(getCameraTimelineRevision('growth', 5))
  expect(getCameraTimelineRevision('identity', 4)).not.toBe(getCameraTimelineRevision('identity', 5))
})
