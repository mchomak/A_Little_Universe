const { test } = require('node:test')
const assert = require('node:assert/strict')
const { requestRecordingPermissions } = require('./permission-setup.cjs')

test('requests undetermined permissions once and leaves existing decisions untouched', async () => {
  const status = { camera: 'not-determined', microphone: 'denied' }
  const requests = []
  const result = await requestRecordingPermissions({
    getMediaAccessStatus: (kind) => status[kind],
    askForMediaAccess: async (kind) => { requests.push(kind); status[kind] = 'granted'; return true },
  })
  assert.deepEqual(requests, ['camera'])
  assert.deepEqual(result, { camera: 'granted', microphone: 'denied' })
})
