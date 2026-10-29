const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = __dirname;
const result = { errors: [], dpr: {}, quality: {}, reduced: {}, production: {} };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/?debug');
    await page.getByRole('button', { name: 'Продолжить без разрешений', exact: true }).click();
    await page.getByRole('button', { name: 'Открыть подарок', exact: true }).click();
    const cover = await page.addStyleTag({ content: '.scene-timeline{pointer-events:none!important}' });
    await page.getByTestId('pause').click();
    await cover.evaluate(element => element.remove());
    const seek = async time => {
      await page.locator('input[aria-label="Локальное время сцены"]').evaluate((input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, time);
      await page.waitForTimeout(500);
    };
    const field = async (id, value) => {
      await page.locator(`#${id}`).evaluate((input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      await page.waitForTimeout(400);
    };
    const capture = async name => {
      const style = await page.addStyleTag({ content: '#developer-panel,.debug-toggle,.scene-timeline,.cinematic-pause{visibility:hidden!important}' });
      await page.screenshot({ path: path.join(output, name + '.png') });
      await style.evaluate(element => element.remove());
    };
    const dimensions = () => page.locator('canvas[data-engine]').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    await seek(14);
    await field('composer-global-dprMax', 1);
    result.dpr.one = await dimensions();
    await field('composer-global-dprMax', 1.5);
    result.dpr.onePointFive = await dimensions();
    assert.equal(result.dpr.one.width, 1180);
    assert.equal(result.dpr.onePointFive.width, 1770);
    await page.locator('summary').filter({ hasText: 'Global' }).click();
    await page.selectOption('#inspector-quality', 'low');
    await seek(14);
    result.quality.low = await dimensions();
    assert.equal(result.quality.low.width, 1180);
    await capture('low-14');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seek(12);
    await capture('reduced-12');
    result.reduced.firstReadable = await page.locator('[data-prologue-line="first"]').getAttribute('aria-hidden');
    await seek(14);
    await capture('reduced-14');
    await seek(17.99);
    await capture('reduced-17.99');
    await page.setViewportSize({width:1024,height:768});
    await page.getByTestId('pause').click();
    await page.getByTestId('pause').click();
    result.quality.devPauseAccessible = await page.getByTestId('pause').getAttribute('aria-pressed') === 'true';
    assert.equal(result.quality.devPauseAccessible,true);
    await context.close();

    const production = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const prod = await production.newPage();
    prod.on('pageerror', error => result.errors.push(error.message));
    await prod.goto('http://127.0.0.1:4173/?debug');
    await prod.getByRole('button', { name: 'Продолжить без разрешений', exact: true }).click();
    await prod.getByRole('button', { name: 'Открыть подарок', exact: true }).click();
    await prod.waitForTimeout(4000);
    await prod.getByTestId('pause').click();
    await prod.waitForTimeout(200);
    result.production.debugElements = await prod.locator('.debug-toggle,#developer-panel,.scene-timeline').count();
    result.production.webglCanvases = await prod.locator('canvas[data-engine]').count();
    result.production.paused = await prod.getByTestId('pause').getAttribute('aria-pressed');
    const before = await prod.screenshot({ path: path.join(output, 'production-paused.png') });
    await prod.waitForTimeout(500);
    const after = await prod.screenshot();
    result.production.pauseStable = before.equals(after);
    assert.equal(result.production.debugElements, 0);
    assert.equal(result.production.webglCanvases, 1);
    assert.equal(result.production.pauseStable, true);
    assert.deepEqual(result.errors, []);
    await production.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'quality-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
