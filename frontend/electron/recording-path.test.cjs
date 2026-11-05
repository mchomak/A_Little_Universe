const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getRecordingRoot } = require('./recording-path.cjs')

test('stores recording sessions in the supported Electron videos directory', () => {
  const requestedPaths = []
  const root = getRecordingRoot({ getPath: (name) => {
    requestedPaths.push(name)
    return path.join('user-data', name)
  } })

  assert.deepEqual(requestedPaths, ['videos'])
  assert.equal(root, path.join('user-data', 'videos', 'A_Little_Universe_Records'))
})
