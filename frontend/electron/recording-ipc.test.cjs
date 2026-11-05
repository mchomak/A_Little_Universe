const test = require('node:test')
const assert = require('node:assert/strict')
const { CHANNELS, installRecordingHandlers } = require('./recording-ipc.cjs')

function handlers() {
  const table = new Map()
  return { table, ipcMain: { handle: (channel, fn) => table.set(channel, fn), removeHandler: (channel) => table.delete(channel) } }
}

test('limits every recording IPC call to the bundled application origin', async () => {
  const { table, ipcMain } = handlers()
  let created = false
  const store = { createSession: async () => { created = true } }
  installRecordingHandlers(ipcMain, store, { openPath: async () => '' })
  assert.deepEqual([...table.keys()], CHANNELS)
  assert.throws(() => table.get('recording:create-session')({ senderFrame: { url: 'https://film.example/' } }), /limited to the bundled application/)
  assert.equal(created, false)
  await table.get('recording:create-session')({ senderFrame: { url: 'app://bundle/index.html' } })
  assert.equal(created, true)
})

test('passes exact bounded chunk bytes into the disk store', async () => {
  const { table, ipcMain } = handlers()
  let chunk
  const store = { appendChunk: async (...args) => { chunk = args } }
  installRecordingHandlers(ipcMain, store, { openPath: async () => '' })
  const bytes = Uint8Array.from([1, 2, 3, 4])
  await table.get('recording:append-chunk')({ senderFrame: { url: 'app://bundle/index.html' } }, { sessionId: 's', source: 'screen', sequence: 1, bytes })
  assert.deepEqual([...chunk[3]], [1, 2, 3, 4])
})
