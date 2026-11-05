const test = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const { requiredNoticePaths } = require('./verify-macos-ffmpeg.cjs')

test('keeps the already-absolute FFmpeg source archive path rooted only once', () => {
  const directory = path.resolve(os.tmpdir(), 'alu-bundled-ffmpeg')
  const archive = path.join(directory, 'ffmpeg-8.1.3.tar.xz')
  assert.deepEqual(requiredNoticePaths(directory, archive), [
    path.join(directory, 'COPYING.LGPLv2.1'),
    path.join(directory, 'LICENSE.md'),
    path.join(directory, 'THIRD-PARTY-NOTICES.md'),
    path.join(directory, 'build-info.txt'),
    archive,
  ])
})
