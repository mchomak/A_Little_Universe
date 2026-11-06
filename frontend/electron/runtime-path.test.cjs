const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { appScheme, canCheckMediaPermission, canRequestMedia, isAppOrigin, resolveBundlePath } = require('./runtime-path.cjs')

test('recognizes Electron origins by scheme and hostname instead of opaque URL.origin', () => {
  assert.equal(new URL('app://bundle/index.html').origin, 'null')
  assert.equal(isAppOrigin('app://bundle'), true)
  assert.equal(isAppOrigin('app://bundle/index.html'), true)
  assert.equal(isAppOrigin('https://bundle/index.html'), false)
  assert.equal(isAppOrigin('app://other/index.html'), false)
  assert.equal(isAppOrigin('app://bundle.attacker/index.html'), false)
  assert.equal(isAppOrigin('app://bundle:1234/index.html'), false)
  assert.equal(isAppOrigin('app://user@bundle/index.html'), false)
  assert.equal(isAppOrigin('invalid'), false)
})

test('grants media checks and requests only to the bundled app with supported types', () => {
  assert.equal(canCheckMediaPermission('app://bundle', 'media'), true)
  assert.equal(canCheckMediaPermission('app://bundle/index.html', 'display-capture'), true)
  assert.equal(canCheckMediaPermission('app://bundle', 'notifications'), false)
  assert.equal(canCheckMediaPermission('https://bundle', 'media'), false)
  assert.equal(canRequestMedia('app://bundle', 'media', ['audio', 'video']), true)
  assert.equal(canRequestMedia('app://bundle', 'media', []), false)
  assert.equal(canRequestMedia('app://bundle', 'media', ['geolocation']), false)
  assert.equal(canRequestMedia('app://bundle', 'display-capture'), true)
  assert.equal(canRequestMedia('app://attacker', 'display-capture'), false)
})

test('marks the local app scheme as secure for fetch and streamed media', () => {
  assert.deepEqual(appScheme.privileges, {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
  })
})

test('maps the app origin root to the bundled entry document', () => {
  assert.equal(resolveBundlePath('C:/app/dist', 'app://bundle/'), path.resolve('C:/app/dist/index.html'))
})

test('keeps requests within the bundle and ignores query parameters', () => {
  assert.equal(resolveBundlePath('C:/app/dist', 'app://bundle/assets/film.glb?v=1'), path.resolve('C:/app/dist/assets/film.glb'))
})

test('rejects other origins and path traversal', () => {
  assert.throws(() => resolveBundlePath('C:/app/dist', 'https://example.com/index.html'), /origin/)
  assert.throws(() => resolveBundlePath('C:/app/dist', 'app://other/index.html'), /origin/)
  assert.throws(() => resolveBundlePath('C:/app/dist', 'app://bundle/%2e%2e/package.json'), /outside/)
})
