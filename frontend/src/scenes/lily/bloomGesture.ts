export interface PointerSample {
  pointerId: number
  clientX: number
  clientY: number
}

export interface BloomGestureOptions {
  minimumDistance?: number
}

/** Recognizes a single primary pointer drag that starts inside the lily's broad hit area. */
export function createBloomGesture({ minimumDistance = 18 }: BloomGestureOptions = {}) {
  const threshold = Number.isFinite(minimumDistance) ? Math.max(1, minimumDistance) : 18
  let start: PointerSample | null = null
  let dragged = false

  return {
    begin(point: PointerSample, enabled: boolean) {
      start = enabled ? { ...point } : null
      dragged = false
      return start !== null
    },
    move(point: PointerSample) {
      if (!start || start.pointerId !== point.pointerId) return false
      dragged ||= Math.hypot(point.clientX - start.clientX, point.clientY - start.clientY) >= threshold
      return dragged
    },
    end(point: PointerSample) {
      if (!start || start.pointerId !== point.pointerId) return false
      dragged ||= Math.hypot(point.clientX - start.clientX, point.clientY - start.clientY) >= threshold
      const accepted = dragged
      start = null
      dragged = false
      return accepted
    },
    cancel() {
      start = null
      dragged = false
    },
  }
}

export function isBloomGestureReady(waitingElapsed: number, writingDuration: number) {
  return Number.isFinite(waitingElapsed) && Number.isFinite(writingDuration)
    && waitingElapsed >= Math.max(0, writingDuration)
}

export interface BloomTextClock {
  update(presentationTime: number, sceneTime: number): void
  setState(mode: 'waiting' | 'playing', revision: number): void
  time(): number
  waitingElapsed(): number
}

/** Maps the indefinite presentation clock onto the bloom-local effect clock. */
export function createBloomTextClock(presentationTime: number, initialMode: 'waiting' | 'playing', initialRevision: number): BloomTextClock {
  let mode = initialMode
  let revision = initialRevision
  let latestPresentation = Number.isFinite(presentationTime) ? presentationTime : 0
  let latestScene = 0
  let origin = latestPresentation
  let carriedWait = 0
  return {
    update(nextPresentation, sceneTime) {
      if (Number.isFinite(nextPresentation)) latestPresentation = nextPresentation
      if (Number.isFinite(sceneTime)) latestScene = sceneTime
    },
    setState(nextMode, nextRevision) {
      if (nextRevision !== revision && nextMode === 'waiting') {
        revision = nextRevision
        mode = nextMode
        origin = latestPresentation
        carriedWait = 0
      } else if (mode === 'waiting' && nextMode === 'playing') {
        carriedWait = Math.max(0, latestPresentation - origin)
        mode = nextMode
        revision = nextRevision
      } else {
        mode = nextMode
        revision = nextRevision
      }
    },
    time() {
      return mode === 'waiting' ? Math.max(0, latestPresentation - origin) : carriedWait + latestScene
    },
    waitingElapsed() {
      return mode === 'waiting' ? Math.max(0, latestPresentation - origin) : carriedWait
    },
  }
}
