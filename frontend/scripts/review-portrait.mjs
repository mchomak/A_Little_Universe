// Optional browser QA: node scripts/review-portrait.mjs <path-to-playwright> <output-dir>
// Uses an isolated browser, no camera/mic permissions and the existing DEV controls.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import process from 'node:process'
import console from 'node:console'
const load = createRequire(import.meta.url)
const { chromium } = load(process.argv[2] || 'playwright')
const output = path.resolve(process.argv[3] || 'artifacts/portrait-review')
fs.mkdirSync(output, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const seek = async (time, capture) => {
    await page.locator('#dev-seek').evaluate((element, value) => {
      const window = element.ownerDocument.defaultView
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(element, String(value)); element.dispatchEvent(new window.Event('input', { bubbles: true }))
    }, time)
    await page.waitForTimeout(100)
    assert.equal(await page.locator('#dev-seek').inputValue(), String(time))
    if (capture) {
      await page.addStyleTag({ content: '#developer-panel,.debug-toggle{visibility:hidden!important}' })
      await page.screenshot({ path: path.join(output, `${capture}.png`) })
      await page.locator('style').last().evaluate((element) => element.remove())
    }
  }
  try {
    await page.goto('http://127.0.0.1:5173/?debug')
    await page.locator('#dev-scene').selectOption('identity')
    await page.getByTestId('dev-run').click()
    await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    await page.waitForTimeout(600)
    for (const time of [16.9, 17.2, 18.2, 19.2, 20.8, 21.8, 22.5, 23, 24]) await seek(time, `standard-${time}`)
    await seek(20.8, 'seek-before')
    for (const time of [28, 0, 23, 17.1, 22.9, 13, 19, 20.8]) await seek(time)
    await seek(20.8, 'seek-after')
    assert.deepEqual(fs.readFileSync(path.join(output, 'seek-before.png')), fs.readFileSync(path.join(output, 'seek-after.png')))
    for (let tick = 170; tick <= 230; tick++) await seek(tick / 10)
    await seek(20.8, 'slow-seek-after')
    assert.deepEqual(fs.readFileSync(path.join(output, 'seek-before.png')), fs.readFileSync(path.join(output, 'slow-seek-after.png')))
    await page.getByTestId('dev-restart').click()
    if (await page.getByTestId('pause').getAttribute('aria-pressed') === 'false') await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    await seek(20.8, 'restart')
    assert.deepEqual(fs.readFileSync(path.join(output, 'seek-before.png')), fs.readFileSync(path.join(output, 'restart.png')))
    await page.getByLabel('Профиль качества').selectOption('low')
    await seek(20.8, 'low-landscape')
    await page.setViewportSize({ width: 768, height: 1024 })
    await seek(20.8, 'low-portrait')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seek(18.2, 'reduced-early')
    await seek(20.8, 'reduced-portrait')
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ status: 'passed', checks: ['fast/reverse/slow seek screenshots identical', 'restart screenshot identical', 'standard/low', 'landscape/portrait', 'reduced motion', 'no browser/shader errors'], output }))
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
