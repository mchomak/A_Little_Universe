class RecordingRecoveryScheduler {
  constructor({ recover, delayMs = 20_000, quietPeriodMs = 5_000, onChange = () => undefined, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    if (typeof recover !== 'function') throw new Error('A recovery operation is required')
    this.recover = recover
    this.delayMs = delayMs
    this.quietPeriodMs = quietPeriodMs
    this.onChange = onChange
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.pending = []
    this.failed = new Map()
    this.busyReasons = new Set()
    this.timer = null
    this.running = false
    this.controller = null
    this.status = 'idle'
    this.currentSessionId = null
    this.lastError = null
  }

  getStatus() {
    return {
      status: this.status,
      pending: this.pending.length + this.failed.size,
      currentSessionId: this.currentSessionId,
      error: this.lastError,
      failed: this.failed.size,
      retryable: this.failed.size > 0,
    }
  }

  publish(status = this.status) {
    this.status = status
    this.onChange(this.getStatus())
  }

  isBusy() { return this.busyReasons.size > 0 }

  enqueue(sessionIds) {
    const known = new Set(this.pending)
    for (const sessionId of this.failed.keys()) known.add(sessionId)
    if (this.currentSessionId) known.add(this.currentSessionId)
    for (const sessionId of sessionIds) {
      if (typeof sessionId === 'string' && !known.has(sessionId)) {
        known.add(sessionId)
        this.pending.push(sessionId)
      }
    }
    if (this.pending.length) {
      if (this.isBusy()) this.publish('paused')
      else this.schedule(this.delayMs)
    }
    else this.publish(this.failed.size ? 'error' : 'idle')
    return this.getStatus()
  }

  retryFailed() {
    if (!this.failed.size) return this.getStatus()
    const failedSessionIds = [...this.failed.keys()]
    this.failed.clear()
    this.lastError = null
    const queued = new Set(this.pending)
    this.pending.unshift(...failedSessionIds.filter((sessionId) => !queued.has(sessionId)))
    if (this.isBusy()) this.publish('paused')
    else this.schedule(this.delayMs)
    return this.getStatus()
  }

  setBusy(reason, active) {
    if (active) this.busyReasons.add(reason)
    else this.busyReasons.delete(reason)
    if (this.isBusy()) {
      if (this.timer) { this.clearTimer(this.timer); this.timer = null }
      if (this.running) {
        this.publish('paused')
        this.controller?.abort()
      } else if (this.pending.length) this.publish('paused')
    } else if (this.pending.length && !this.running) this.schedule(this.delayMs)
  }

  schedule(delayMs) {
    if (this.running || this.isBusy() || !this.pending.length || this.timer) return
    this.publish('waiting')
    this.timer = this.setTimer(() => {
      this.timer = null
      void this.drain()
    }, delayMs)
  }

  async drain() {
    if (this.running || this.isBusy() || !this.pending.length) return
    this.running = true
    const sessionId = this.pending.shift()
    const controller = new AbortController()
    this.controller = controller
    this.currentSessionId = sessionId
    if (!this.failed.size) this.lastError = null
    this.publish('recovering')
    try {
      const result = await this.recover(sessionId, { signal: controller.signal })
      const finalizationStatus = result?.finalization?.status ?? result?.status
      if (finalizationStatus === 'error' || finalizationStatus === 'partial') {
        const errors = result.errors ?? result.finalization?.errors
        const detail = Array.isArray(errors) ? errors.filter(Boolean).join('; ') : ''
        throw new Error(detail || `Finalization ended with ${finalizationStatus} status`)
      }
    }
    catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        if (!this.pending.includes(sessionId)) this.pending.unshift(sessionId)
      } else {
        this.lastError = error instanceof Error ? error.message : String(error)
        this.failed.set(sessionId, this.lastError)
      }
    }
    this.running = false
    this.controller = null
    this.currentSessionId = null
    if (this.isBusy() && this.pending.length) this.publish('paused')
    else if (this.pending.length) this.schedule(this.quietPeriodMs)
    else this.publish(this.failed.size ? 'error' : 'idle')
  }
}

module.exports = { RecordingRecoveryScheduler }
