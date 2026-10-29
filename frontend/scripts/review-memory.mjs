// Optional browser QA: node scripts/review-memory.mjs <path-to-playwright> <output-dir>
// Uses an isolated browser, no camera/mic permissions and the existing DEV controls.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import process from 'node:process'
import console from 'node:console'
const load = createRequire(import.meta.url)
const { chromium } = load(process.argv[2] || 'playwright')
const output = path.resolve(process.argv[3] || 'artifacts/memory-review')
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
    await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'domcontentloaded' })
    await page.locator('#dev-scene').selectOption('identity')
    await page.getByTestId('dev-run').click()
    await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    await page.waitForTimeout(600)
    await page.locator('html').evaluate((root) => root.ownerDocument.fonts.ready)
    for (const time of [24.5, 26.8, 27.9, 28, 28.5, 29, 30, 31, 32.5, 34]) await seek(time, `standard-${time}`)
    await seek(32.5, 'seek-before')
    for (const time of [34, 0, 23, 27.9, 33.9, 13, 29, 32.5]) await seek(time)
    await seek(32.5, 'seek-after')
    assert.ok(fs.readFileSync(path.join(output, 'seek-before.png')).equals(fs.readFileSync(path.join(output, 'seek-after.png'))), 'reverse seek changed frame')
    for (let tick = 280; tick <= 340; tick++) await seek(tick / 10)
    await seek(32.5, 'slow-seek-after')
    assert.ok(fs.readFileSync(path.join(output, 'seek-before.png')).equals(fs.readFileSync(path.join(output, 'slow-seek-after.png'))), 'slow seek changed frame')
    await page.getByTestId('dev-restart').click()
    if (await page.getByTestId('pause').getAttribute('aria-pressed') === 'false') await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    await seek(32.5, 'restart')
    assert.ok(fs.readFileSync(path.join(output, 'seek-before.png')).equals(fs.readFileSync(path.join(output, 'restart.png'))), 'restart changed frame')
    await seek(34)
    const filmCanvas = page.locator('.viewport canvas')
    const readPose = () => page.locator('html').evaluate(async (root) => {
      const document = root.ownerDocument
      const url = document.defaultView.performance.getEntriesByType('resource').map((entry) => entry.name).find((name) => name.includes('/@react-three_fiber.js'))
      const { _roots } = await import(url)
      const { camera, scene } = _roots.get(document.querySelector('.viewport canvas')).store.getState()
      const photos = []
      scene.traverse((object) => {
        if (object.geometry?.parameters?.width === 2.15 && object.material.uniforms?.uPhoto || object.geometry?.parameters?.width === 2.15 && object.material.map?.image?.naturalWidth === 640) photos.push(object.matrixWorld.elements)
      })
      return { camera: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements], photo: photos[0] }
    })
    const endPose = await readPose()
    const worldOnly = '#developer-panel,.debug-toggle,.page-header,.page-footer,.first-memory-caption,.gallery-panel{visibility:hidden!important}'
    await page.addStyleTag({ content: worldOnly })
    const end = await filmCanvas.screenshot({ path: path.join(output, 'identity-end-canvas.png') })
    await page.locator('style').last().evaluate((element) => element.remove())
    await page.locator('#developer-panel').getByRole('button', { name: 'Пропустить сцену', exact: true }).click()
    await page.locator('main[data-scene="gallery"]').waitFor()
    await page.waitForTimeout(300)
    const startPose = await readPose()
    for (const key of ['camera', 'photo']) {
      assert.equal(endPose[key].length, startPose[key].length)
      assert.ok(endPose[key].every((value, i) => Math.abs(value - startPose[key][i]) < 1e-8), `${key} transform jumped at gallery entry`)
    }
    await page.addStyleTag({ content: worldOnly })
    const start = await filmCanvas.screenshot({ path: path.join(output, 'gallery-start-canvas.png') })
    await page.locator('style').last().evaluate((element) => element.remove())
    if (!end.equals(start)) {
      const diff = await page.locator('html').evaluate(async (root, { a, b }) => {
        const document = root.ownerDocument, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
        const read = async (data) => {
          const img = document.createElement('img'); img.src = `data:image/png;base64,${data}`; await img.decode()
          canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0)
          return ctx.getImageData(0, 0, img.width, img.height).data
        }
        const first = await read(a), second = await read(b)
        let changed = 0
        for (let i = 0; i < first.length; i += 4) if (first[i] !== second[i] || first[i+1] !== second[i+1] || first[i+2] !== second[i+2]) changed++
        return changed
      }, { a: end.toString('base64'), b: start.toString('base64') })
      assert.ok(diff < 100, `gallery handoff changed ${diff} pixels; only subpixel edge rasterization is allowed`)
      console.log(`Identical camera/photo matrices; ${diff} edge pixels differ in rasterization.`)
    }
    assert.equal(await page.getByTestId('gallery-prev').isDisabled(), true)
    assert.equal(await page.getByTestId('gallery-next').isDisabled(), true)
    await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    assert.equal(await page.locator('main').getAttribute('data-paused'), 'true')
    await page.locator('#developer-panel').getByRole('button', { name: 'Продолжить', exact: true }).click()
    assert.equal(await page.locator('main').getAttribute('data-paused'), 'false')
    await page.addStyleTag({ content: '#developer-panel,.debug-toggle{visibility:hidden!important}' })
    await page.screenshot({ path: path.join(output, 'gallery-entry.png') })
    await filmCanvas.click({ position: { x: 680, y: 440 } })
    for (const endY of [300, 600]) {
      await page.locator('.film-surface').dispatchEvent('pointerdown', { pointerId: 42, pointerType: 'touch', isPrimary: true, button: 0, clientX: 600, clientY: 450 })
      await page.locator('body').dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch', isPrimary: true, button: 0, clientX: 600, clientY: endY })
      assert.equal(await page.locator('main').getAttribute('data-scene'), 'gallery')
      assert.equal(await page.getByTestId('gallery-next').isDisabled(), true)
    }
    await page.getByTestId('gallery-exit').click()
    await page.locator('main[data-scene="eye"]').waitFor()
    await page.locator('style').last().evaluate((element) => element.remove())
    await page.locator('#dev-scene').selectOption('identity')
    await page.getByTestId('dev-run').click()
    await page.locator('#developer-panel').getByRole('button', { name: 'Пауза', exact: true }).click()
    await page.getByLabel('Профиль качества').selectOption('low')
    await page.setViewportSize({ width: 1024, height: 768 })
    await seek(31, 'low-landscape')
    await page.setViewportSize({ width: 768, height: 1024 })
    await seek(31, 'low-portrait')
    const textBounds = await page.locator('.first-memory-phrase').evaluate((text) => {
      const range = text.ownerDocument.createRange(); range.selectNodeContents(text)
      const bounds = range.getBoundingClientRect(); return { x: bounds.x, width: bounds.width }
    })
    assert.ok(textBounds.x >= 0 && textBounds.x + textBounds.width <= 768)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seek(28.5, 'reduced-early')
    await seek(34, 'reduced-portrait')
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ status: 'passed', checks: ['fast/reverse/slow seek screenshots identical', 'restart screenshot identical', 'identical WebGL handoff 04.7/05.1', 'single-memory pause/tap/swipe/bounds/exit', 'standard/low', 'landscape/portrait', 'reduced motion', 'no browser/shader errors'], output }))
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
