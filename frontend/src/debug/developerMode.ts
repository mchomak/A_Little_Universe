/** Developer controls are always available in Vite dev and opt in locally in a production preview. */
export function isDeveloperMode(development = import.meta.env.DEV,
  location?: Pick<Location, 'protocol' | 'hostname' | 'search'>) {
  if (development) return true
  const currentLocation = location ?? (typeof window === 'undefined' ? undefined : window.location)
  if (!currentLocation) return false
  if (currentLocation.protocol === 'app:' && currentLocation.hostname === 'bundle') return true
  const isLocalHost = currentLocation.hostname === 'localhost'
    || currentLocation.hostname === '127.0.0.1'
    || currentLocation.hostname === '::1'
    || currentLocation.hostname === '[::1]'
  return isLocalHost && new URLSearchParams(currentLocation.search).has('debug')
}
