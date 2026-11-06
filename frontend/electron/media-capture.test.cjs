const test = require('node:test')
const assert = require('node:assert/strict')
const { createAppWindowCaptureHandler } = require('./media-capture.cjs')

test('selects the native source id of the exact requesting app window, even with duplicate titles', async () => {
  const frame = { parent: null, isDestroyed: () => false }
  const contents = { getURL: () => 'app://bundle/index.html', isDestroyed: () => false }
  const window = { getMediaSourceId: () => 'window:mac-window-17:0', isDestroyed: () => false }
  const sources = [
    { id: 'window:other-app-42:0', name: 'A Little Universe for You' },
    { id: 'window:mac-window-17:0', name: 'A Little Universe for You' },
  ]
  const getSources = async (options) => {
    assert.deepEqual(options, { types: ['window'], thumbnailSize: { width: 1, height: 1 } })
    return sources
  }
  const handler = createAppWindowCaptureHandler({
    isAppOrigin: (value) => { try { const url = new URL(value); return url.protocol === 'app:' && url.hostname === 'bundle' } catch { return false } },
    getWebContents: (requestFrame) => requestFrame === frame ? contents : undefined,
    getWindow: (requestContents) => requestContents === contents ? window : undefined,
    getSources,
  })

  let selected
  await handler({ frame, securityOrigin: 'app://bundle', videoRequested: true }, (value) => { selected = value })
  assert.deepEqual(selected, { video: sources[1] })
})

test('rejects screen capture requests from non-app or nested frames', async () => {
  const parentFrame = { parent: null, isDestroyed: () => false }
  const nestedFrame = { parent: parentFrame, isDestroyed: () => false }
  let sourceLookups = 0
  const handler = createAppWindowCaptureHandler({
    isAppOrigin: (value) => { try { const url = new URL(value); return url.protocol === 'app:' && url.hostname === 'bundle' } catch { return false } },
    getWebContents: () => ({ getURL: () => 'app://bundle/index.html', isDestroyed: () => false }),
    getWindow: () => ({ getMediaSourceId: () => 'window:1:0', isDestroyed: () => false }),
    getSources: async () => { sourceLookups += 1; return [{ id: 'window:1:0' }] },
  })

  for (const request of [
    { frame: parentFrame, securityOrigin: 'https://example.com', videoRequested: true },
    { frame: nestedFrame, securityOrigin: 'app://bundle', videoRequested: true },
    { frame: parentFrame, securityOrigin: 'app://bundle', videoRequested: false },
  ]) {
    let selected = 'unset'
    await handler(request, (value) => { selected = value })
    assert.equal(selected, null)
  }
  assert.equal(sourceLookups, 0)
})
