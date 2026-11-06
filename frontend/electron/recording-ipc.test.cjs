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

test('Stop & Save finalizes the closed session before returning its recording status', async () => {
  const { table, ipcMain } = handlers()
  const events = []
  const session = { id: 's', manifest: {} }
  const status = { status: 'stopped', finalization: { status: 'complete' } }
  const store = {
    finishSession: async (sessionId) => { events.push(`finish:${sessionId}`) },
    getSession: (sessionId) => { events.push(`get-session:${sessionId}`); return session },
    persist: async (recording) => { assert.equal(recording, session); events.push('persist') },
    log: async (recording, message) => { assert.equal(recording, session); events.push(`log:${message}`) },
    getStatus: async (sessionId) => { events.push(`status:${sessionId}`); return status },
  }
  const finalizer = { finalizeSession: async (recording, callbacks) => {
    assert.equal(recording, session)
    events.push('finalize')
    await callbacks.persist()
    await callbacks.log('finished')
  } }
  installRecordingHandlers(ipcMain, store, { openPath: async () => '', finalizer })

  const result = await table.get('recording:finish-session')({ senderFrame: { url: 'app://bundle/index.html' } }, { sessionId: 's' })
  assert.equal(result, status)
  assert.deepEqual(events, ['finish:s', 'get-session:s', 'finalize', 'persist', 'log:finished', 'status:s'])
})

test('marks session startup complete through the trusted IPC boundary', async () => {
  const { table, ipcMain } = handlers()
  const calls = []
  const store = { markStartupComplete: async (sessionId) => { calls.push(sessionId); return { sessionId, startupComplete: true } } }
  installRecordingHandlers(ipcMain, store, { openPath: async () => '' })
  const result = await table.get('recording:mark-startup-complete')({ senderFrame: { url: 'app://bundle/index.html' } }, { sessionId: 's' })
  assert.deepEqual(result, { sessionId: 's', startupComplete: true })
  assert.deepEqual(calls, ['s'])
})

test('discards a failed startup session without finalizing it and clears recording activity', async () => {
  const { table, ipcMain } = handlers()
  const events = []
  let finalized = false
  const store = {
    createSession: async () => ({ id: 's' }),
    discardSession: async (sessionId) => { events.push(`discard:${sessionId}`); return { sessionId, discarded: true } },
  }
  const finalizer = { finalizeSession: async () => { finalized = true } }
  installRecordingHandlers(ipcMain, store, {
    openPath: async () => '', finalizer,
    onRecordingActivity: (active) => events.push(`recording:${active}`),
  })
  const event = { senderFrame: { url: 'app://bundle/index.html' } }

  await table.get('recording:create-session')(event)
  const result = await table.get('recording:discard-session')(event, { sessionId: 's' })

  assert.deepEqual(result, { sessionId: 's', discarded: true })
  assert.deepEqual(events, ['recording:true', 'discard:s', 'recording:false'])
  assert.equal(finalized, false)
})

test('resets recording activity when failed-session discard reports an error', async () => {
  const { table, ipcMain } = handlers()
  const activity = []
  const store = { discardSession: async () => { throw new Error('could not remove session') } }
  installRecordingHandlers(ipcMain, store, {
    openPath: async () => '',
    onRecordingActivity: (active) => activity.push(active),
  })
  const event = { senderFrame: { url: 'app://bundle/index.html' } }

  await assert.rejects(table.get('recording:discard-session')(event, { sessionId: 's' }), /could not remove session/)
  assert.deepEqual(activity, [false])
})

test('exposes recovery progress and reports film/recording activity to the scheduler', async () => {
  const { table, ipcMain } = handlers()
  const activity = []
  const store = { createSession: async () => ({ id: 's' }) }
  const recovery = { status: 'paused', pending: 2, currentSessionId: null, error: null, failed: 0, retryable: false }
  const retriedRecovery = { status: 'waiting', pending: 2, currentSessionId: null, error: null, failed: 0, retryable: false }
  installRecordingHandlers(ipcMain, store, {
    openPath: async () => '',
    getRecoveryStatus: () => recovery,
    retryRecovery: () => retriedRecovery,
    onFilmActivity: (active) => activity.push(`film:${active}`),
    onRecordingActivity: (active) => activity.push(`recording:${active}`),
  })
  const event = { senderFrame: { url: 'app://bundle/index.html' } }
  await table.get('recording:create-session')(event)
  assert.deepEqual(await table.get('recording:get-recovery-status')(event), recovery)
  assert.deepEqual(await table.get('recording:retry-recovery')(event), retriedRecovery)
  await table.get('recording:set-film-active')(event, { active: true })
  assert.deepEqual(activity, ['recording:true', 'film:true'])
  assert.deepEqual(await table.get('recording:retry-recovery')(event), retriedRecovery)
})
