/** Wake a demand-rendered scene when the browser makes it visible again. */
export function wakeOnVisible(visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>, invalidate: () => void) {
  const wake = () => { if (!visibility.hidden) invalidate() }
  visibility.addEventListener('visibilitychange', wake)
  return () => visibility.removeEventListener('visibilitychange', wake)
}
