/** Listen for context loss and restoration without tying the renderer lifecycle to React state. */
export function observeWebGLContext(
  target: EventTarget,
  onLost: () => void,
  onRestored: () => void,
) {
  const handleLost = (event: Event) => {
    event.preventDefault()
    onLost()
  }
  target.addEventListener('webglcontextlost', handleLost)
  target.addEventListener('webglcontextrestored', onRestored)
  return () => {
    target.removeEventListener('webglcontextlost', handleLost)
    target.removeEventListener('webglcontextrestored', onRestored)
  }
}
