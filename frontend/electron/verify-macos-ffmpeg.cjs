const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const VERSION = '8.1.3'
const SOURCE_SHA256 = '7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3'
const root = path.resolve(__dirname, '..')

function fail(message) { throw new Error(message) }
const REQUIRED_NOTICES = ['COPYING.LGPLv2.1', 'LICENSE.md', 'THIRD-PARTY-NOTICES.md', 'build-info.txt']
function requiredNoticePaths(directory, sourceArchive = path.join(directory, `ffmpeg-${VERSION}.tar.xz`)) {
  return [...REQUIRED_NOTICES.map((notice) => path.join(directory, notice)), sourceArchive]
}

function run(binary, args) {
  try { return execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (error) { fail(`${path.basename(binary)} ${args.join(' ')} failed: ${error.stderr?.toString() ?? error.message}`) }
}

function verifyResourceDirectory(directory) {
  const ffmpeg = path.join(directory, 'ffmpeg')
  const ffprobe = path.join(directory, 'ffprobe')
  const source = path.join(directory, `ffmpeg-${VERSION}.tar.xz`)
  for (const executable of [ffmpeg, ffprobe]) {
    if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) fail(`Missing bundled executable: ${executable}`)
    fs.accessSync(executable, fs.constants.X_OK)
    run('lipo', ['-verify_arch', 'arm64', executable])
  }
  for (const noticePath of requiredNoticePaths(directory, source)) {
    if (!fs.existsSync(noticePath)) fail(`Missing bundled FFmpeg notice/source: ${noticePath}`)
  }
  const actualSourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  if (actualSourceHash !== SOURCE_SHA256) fail(`Unexpected FFmpeg source archive SHA-256: ${actualSourceHash}`)
  if (!run(ffmpeg, ['-hide_banner', '-version']).includes(`ffmpeg version ${VERSION}`)) fail(`Unexpected FFmpeg version in ${directory}`)
  if (!run(ffprobe, ['-hide_banner', '-version']).includes(`ffprobe version ${VERSION}`)) fail(`Unexpected ffprobe version in ${directory}`)
  const buildConf = run(ffmpeg, ['-hide_banner', '-buildconf'])
  if (!buildConf.includes('--disable-gpl') || !buildConf.includes('--disable-nonfree')) fail('Bundled FFmpeg is not configured with the required LGPL-only flags')
  const license = run(ffmpeg, ['-hide_banner', '-L'])
  if (/GNU General Public License/i.test(license)) fail('Bundled FFmpeg reports GPL licensing')
  return { ffmpeg, ffprobe, source }
}

if (require.main === module) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') fail('The macOS FFmpeg resource can only be verified on an Apple Silicon Mac.')
  const appPath = process.argv[2]
  const resourceDirectory = appPath
    ? path.join(path.resolve(appPath), 'Contents', 'Resources', 'ffmpeg')
    : path.join(root, 'resources', 'macos-arm64')
  const checked = verifyResourceDirectory(resourceDirectory)
  console.log(`Verified Apple arm64 FFmpeg ${VERSION} and ffprobe at ${resourceDirectory}`)
  console.log(`Executables are outside ASAR: ${checked.ffmpeg}`)
}

module.exports = { requiredNoticePaths }
