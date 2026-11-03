import { useCallback, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { SceneProps } from '../../engine/sceneTypes'
import { getConfig, subscribeConfig } from '../../systems/scene-config/config'
import { createBloomTextClock, handleBloomPointerDown, isBloomGestureReady } from './bloomGesture'
import { BloomPointerContext } from './BloomPointerContext'

/** The island and lily share this event boundary, so either can start the bloom with one click. */
export function BloomGestureTarget({ state, dispatch, runtime, writingDuration, children }: SceneProps & { writingDuration?: number; children?: ReactNode }) {
  const configuredDuration = useSyncExternalStore(subscribeConfig, getConfig, getConfig).scenes.bloom.textWritingDuration
  const duration = writingDuration ?? configuredDuration
  const stateRef = useRef(state)
  const readyRef = useRef(false)
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

  const activate = useCallback((event: ThreeEvent<PointerEvent>) => {
    const native = event.nativeEvent
    handleBloomPointerDown(stateRef.current, readyRef.current, {
      button: native.button,
      isPrimary: native.isPrimary,
      stopPropagation: () => event.stopPropagation(),
    }, dispatch)
  }, [dispatch])

  return <BloomPointerContext.Provider value={activate}>{children}</BloomPointerContext.Provider>
}
