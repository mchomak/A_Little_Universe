const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const electronBinary = require('electron')

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const vite = spawn(npm, ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' })
let desktop
let stopping = false

async function waitForVite() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}`)
    try {
      const response = await fetch('http://127.0.0.1:5173/')
      if (response.ok) return
    } catch { /* Wait for the local development server. */ }
    await delay(250)
  }
  throw new Error('Timed out waiting for the local Vite server')
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  vite.kill()
  if (desktop && desktop.exitCode === null) desktop.kill()
  process.exitCode = code
}

process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

waitForVite().then(() => {
  desktop = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, ALU_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  })
  desktop.on('error', (error) => { console.error(error); stop(1) })
  desktop.on('exit', (code) => stop(code ?? 1))
}).catch((error) => {
  console.error(error.message)
  stop(1)
})

vite.on('error', (error) => { console.error(error); stop(1) })
