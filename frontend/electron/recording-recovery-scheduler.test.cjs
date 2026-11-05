const test = require('node:test')
const assert = require('node:assert/strict')
const { RecordingRecoveryScheduler } = require('./recording-recovery-scheduler.cjs')

function deferred() {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

test('defers crash recovery while film is active and runs queued sessions sequentially with a pause', async () => {
  const firstGate = deferred()
  const calls = []
  let active = 0
  let maxActive = 0
  const scheduler = new RecordingRecoveryScheduler({
    delayMs: 1,
    quietPeriodMs: 1,
    recover: async (sessionId) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      calls.push(sessionId)
      if (sessionId === 'one') await firstGate.promise
      active -= 1
    },
  })
  scheduler.setBusy('film', true)
  scheduler.enqueue(['one', 'two'])
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(calls, [])
  assert.equal(scheduler.getStatus().status, 'paused')

  scheduler.setBusy('film', false)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(calls, ['one'])
  scheduler.setBusy('film', true)
  firstGate.resolve()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(calls, ['one'])
  assert.equal(scheduler.getStatus().status, 'paused')
  assert.equal(maxActive, 1)

  scheduler.setBusy('film', false)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(calls, ['one', 'two'])
  assert.equal(scheduler.getStatus().status, 'idle')
  assert.equal(maxActive, 1)
})

test('aborts recovery as soon as recording becomes active and retries the same session afterward', async () => {
  const attempts = []
  const scheduler = new RecordingRecoveryScheduler({
    delayMs: 1,
    quietPeriodMs: 1,
    recover: async (sessionId, { signal } = {}) => {
      attempts.push({ sessionId, signal })
      if (attempts.length === 1) {
        await new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
        })
      }
    },
  })
  scheduler.enqueue(['pending'])
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(attempts.length, 1)

  scheduler.setBusy('recording', true)
  assert.equal(attempts[0].signal?.aborted, true, 'active ffmpeg work must be told to stop immediately')
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(scheduler.getStatus(), { status: 'paused', pending: 1, currentSessionId: null, error: null, failed: 0, retryable: false })

  scheduler.setBusy('recording', false)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(attempts.map(({ sessionId }) => sessionId), ['pending', 'pending'])
  assert.equal(scheduler.getStatus().status, 'idle')
})

test('keeps an errored recovery retryable without an automatic retry loop', async () => {
  let attempts = 0
  const scheduler = new RecordingRecoveryScheduler({
    delayMs: 1,
    quietPeriodMs: 1,
    recover: async () => {
      attempts += 1
      return attempts === 1 ? { status: 'error', errors: ['temporary ffmpeg failure'] } : { status: 'complete' }
    },
  })

  scheduler.enqueue(['retry-me'])
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(attempts, 1)
  assert.deepEqual(scheduler.getStatus(), {
    status: 'error', pending: 1, currentSessionId: null, error: 'temporary ffmpeg failure', failed: 1, retryable: true,
  })

  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(attempts, 1, 'a failed session must wait for explicit retry')
  scheduler.retryFailed()
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(attempts, 2)
  assert.deepEqual(scheduler.getStatus(), {
    status: 'idle', pending: 0, currentSessionId: null, error: null, failed: 0, retryable: false,
  })
})

test('keeps a thrown transient recovery error until an explicit retry succeeds', async () => {
  let attempts = 0
  const scheduler = new RecordingRecoveryScheduler({
    delayMs: 1,
    quietPeriodMs: 1,
    recover: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('temporary process failure')
      return { status: 'complete' }
    },
  })
  scheduler.enqueue(['throw-once'])
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(scheduler.getStatus().retryable, true)
  assert.equal(scheduler.getStatus().error, 'temporary process failure')
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(attempts, 1)

  scheduler.retryFailed()
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(attempts, 2)
  assert.equal(scheduler.getStatus().status, 'idle')
})

test('treats resolved partial finalization as a failed, manually retryable recovery', async () => {
  const attempts = []
  const scheduler = new RecordingRecoveryScheduler({
    delayMs: 1,
    quietPeriodMs: 1,
    recover: async (sessionId) => {
      attempts.push(sessionId)
      return attempts.length === 1
        ? { status: 'partial', errors: ['one source was unavailable'] }
        : { status: 'complete' }
    },
  })
  scheduler.enqueue(['partial-session'])
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(scheduler.getStatus().status, 'error')
  assert.equal(scheduler.getStatus().retryable, true)
  assert.equal(scheduler.getStatus().error, 'one source was unavailable')
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.deepEqual(attempts, ['partial-session'])

  scheduler.retryFailed()
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.deepEqual(attempts, ['partial-session', 'partial-session'])
  assert.equal(scheduler.getStatus().status, 'idle')
})
