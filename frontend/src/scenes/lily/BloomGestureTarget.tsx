import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { SceneProps } from '../../engine/sceneTypes'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createBloomGesture, createBloomTextClock, isBloomGestureReady } from './bloomGesture'

const MODEL_POSITION: [number, number, number] = [0, -1.45, 0]
const MODEL_SCALE = 3
const MIN_DRAG_DISTANCE = 18

/** A large invisible bud target turns a deliberate pointer-drag into the bloom gate. */
export function BloomGestureTarget({ state, dispatch, runtime, writingDuration }: SceneProps & { writingDuration?: number }) {
  const configuredDuration = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.bloom.textWritingDuration
  const duration = writingDuration ?? configuredDuration
  const active = state.scene === 'bloom' && state.mode === 'waiting' && !state.paused && !state.reading
  const stateRef = useRef(state)
  const gesture = useRef(createBloomGesture({ minimumDistance: MIN_DRAG_DISTANCE }))
  const pointerRef = useRef<number | null>(null)
  const readyRef = useRef(false)
  const listeners = useRef<{ move?: (event: PointerEvent) => void; end?: (event: PointerEvent) => void; cancel?: () => void; visibility?: () => void }>({})
  const clockRef = useRef(createBloomTextClock(runtime.presentationTime, 'waiting', state.revision))
  useLayoutEffect(() => {
    stateRef.current = state
    clockRef.current.setState(state.mode === 'waiting' ? 'waiting' : 'playing', state.revision)
    clockRef.current.update(runtime.presentationTime, runtime.time)
  }, [runtime, state])

  useLayoutEffect(() => {
    const updatePresentation = (time: number) => {
      clockRef.current.update(time, runtime.time)
      readyRef.current = isBloomGestureReady(clockRef.current.waitingElapsed(), duration)
    }
    const updateScene = (time: number) => {
      clockRef.current.update(runtime.presentationTime, time)
      readyRef.current = isBloomGestureReady(clockRef.current.waitingElapsed(), duration)
    }
    updatePresentation(runtime.presentationTime)
    const unsubscribePresentation = runtime.subscribePresentation(updatePresentation)
    const unsubscribeFrame = runtime.subscribeFrame(updateScene)
    return () => { unsubscribePresentation(); unsubscribeFrame() }
  }, [runtime, duration, state.revision])

  const stopTracking = useCallback(() => {
    const current = listeners.current
    if (current.move) window.removeEventListener('pointermove', current.move, true)
    if (current.end) window.removeEventListener('pointerup', current.end, true)
    if (current.cancel) {
      window.removeEventListener('pointercancel', current.cancel, true)
      window.removeEventListener('blur', current.cancel)
    }
    if (current.visibility) document.removeEventListener('visibilitychange', current.visibility)
    pointerRef.current = null
    gesture.current.cancel()
  }, [])

  const onMove = useCallback((event: PointerEvent) => {
    if (pointerRef.current !== event.pointerId) return
    event.preventDefault()
    gesture.current.move({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY })
  }, [])
  const onEnd = useCallback((event: PointerEvent) => {
    if (pointerRef.current !== event.pointerId) return
    const accepted = gesture.current.end({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY })
    stopTracking()
    const current = stateRef.current
    if (accepted && current.scene === 'bloom' && current.mode === 'waiting' && !current.paused && !current.reading) dispatch({ type: 'interact' })
  }, [dispatch, stopTracking])
  const onCancel = useCallback(() => stopTracking(), [stopTracking])
  const onVisibility = useCallback(() => { if (document.hidden) stopTracking() }, [stopTracking])
  useLayoutEffect(() => { listeners.current = { move: onMove, end: onEnd, cancel: onCancel, visibility: onVisibility } }, [onCancel, onEnd, onMove, onVisibility])

  useLayoutEffect(() => { if (!active) stopTracking() }, [active, state.revision, stopTracking])
  useLayoutEffect(() => () => stopTracking(), [stopTracking])

  const begin = useCallback((event: ThreeEvent<PointerEvent>) => {
    const native = event.nativeEvent
    if (!active || !native.isPrimary || native.button !== 0) return
    event.stopPropagation()
    // The bloom viewport has touch-action:none; avoid preventDefault here because
    // React Three Fiber may deliver pointer-down through a passive listener.
    if (!readyRef.current) return
    if (!gesture.current.begin({ pointerId: native.pointerId, clientX: native.clientX, clientY: native.clientY }, true)) return
    pointerRef.current = native.pointerId
    window.addEventListener('pointermove', onMove, { capture: true, passive: false })
    window.addEventListener('pointerup', onEnd, true)
    window.addEventListener('pointercancel', onCancel, true)
    window.addEventListener('blur', onCancel)
    document.addEventListener('visibilitychange', onVisibility)
  }, [active, onCancel, onEnd, onMove, onVisibility])

  if (!active) return null
  return <group position={MODEL_POSITION} scale={MODEL_SCALE}>
    <mesh position={[0.1, 0.83, 0.16]} onPointerDown={begin}>
      <sphereGeometry args={[0.39, 20, 14]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} depthTest={false} />
    </mesh>
  </group>
}
