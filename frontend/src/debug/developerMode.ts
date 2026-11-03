/** Developer controls are always available in Vite dev and opt in locally in a production preview. */
export function isDeveloperMode() {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  const isLocalHost = window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
    || window.location.hostname === '::1'
    || window.location.hostname === '[::1]'
  return isLocalHost && new URLSearchParams(window.location.search).has('debug')
}
