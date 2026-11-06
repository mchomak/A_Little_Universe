const path = require('node:path')
const appScheme = Object.freeze({
  scheme: 'app',
  privileges: Object.freeze({ standard: true, secure: true, supportFetchAPI: true, stream: true }),
})

function resolveBundlePath(bundleRoot, requestUrl) {
  const rawPath = requestUrl.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+(\/[^?#]*)?/i)?.[1] ?? '/'
  let decodedPath
  try { decodedPath = decodeURIComponent(rawPath) } catch { throw new Error('Invalid bundle path') }
  if (decodedPath.includes('\\') || decodedPath.includes('\0')
    || decodedPath.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Bundle path is outside the application')
  }
  const url = new URL(requestUrl)
  if (url.protocol !== 'app:' || url.hostname !== 'bundle') throw new Error('Unexpected application origin')
  const root = path.resolve(bundleRoot)
  const pathname = decodedPath === '/' ? '/index.html' : decodedPath
  const file = path.resolve(root, `.${pathname}`)
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('Bundle path is outside the application')
  return file
}

function isAppOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'app:' && url.hostname === 'bundle'
      && !url.port && !url.username && !url.password
  } catch { return false }
}

function canCheckMediaPermission(origin, permission) {
  return isAppOrigin(origin) && ['media', 'display-capture'].includes(permission)
}

function canRequestMedia(origin, permission, mediaTypes = []) {
  if (!isAppOrigin(origin)) return false
  if (permission === 'display-capture') return true
  return permission === 'media' && Array.isArray(mediaTypes) && mediaTypes.length > 0
    && mediaTypes.every((type) => ['audio', 'video'].includes(type))
}

module.exports = { appScheme, canCheckMediaPermission, canRequestMedia, isAppOrigin, resolveBundlePath }
