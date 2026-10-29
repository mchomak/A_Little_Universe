async (page) => {
  const root = 'C:/Users/McHomak/Projects/A_Little_Universe/.autopilot/2026-10-29-prologue-awakening';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.bringToFront();
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('http://127.0.0.1:5173/?debug');
  await page.getByRole('button', { name: 'Продолжить без разрешений', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть подарок', exact: true }).click();
  const devCover = await page.addStyleTag({ content: '.scene-timeline{pointer-events:none!important}' });
  await page.getByTestId('pause').click();
  await devCover.evaluate(element => element.remove());
  await page.locator('canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('.prologue-overlay[data-matter-ready="true"]');
  const seek = async time => {
    await page.locator('input[aria-label="Локальное время сцены"]').evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, time);
    await page.waitForTimeout(500);
  };
  const clean = async () => page.addStyleTag({ content: '#developer-panel,.debug-toggle,.scene-timeline,.cinematic-pause{visibility:hidden!important}' });
  const capture = async name => {
    const style = await clean();
    await page.screenshot({ path: `${root}/${name}.png` });
    await style.evaluate(element => element.remove());
  };
  const metrics = [];
  for (const [name, width, height] of [['tablet',1180,820],['portrait',820,1180],['desktop',1440,900]]) {
    await page.setViewportSize({ width, height });
    for (const time of name === 'tablet' ? [1,4,9,12,13,14,15,16,17.99] : [4,12,14,17.99]) {
      await seek(time);
      await capture(`${name}-${time}`);
    }
    metrics.push(await page.evaluate(() => ({
      viewport:[innerWidth,innerHeight],
      canvas:document.querySelectorAll('canvas[data-engine]').length,
      light:(()=>{const r=document.querySelector('.persistent-light')?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;})(),
      text:[...document.querySelectorAll('[data-prologue-line]')].map(e=>{const r=e.getBoundingClientRect();return {line:e.dataset.prologueLine,text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})
    })));
  }
  await page.setViewportSize({width:1180,height:820});
  await seek(14);
  const style = await clean();
  const before = await page.screenshot();
  await page.screenshot({path:`${root}/seek-before.png`});
  await style.evaluate(element=>element.remove());
  for (const time of [2,15,0,9,14]) await seek(time);
  const style2 = await clean();
  const after = await page.screenshot();
  await page.screenshot({path:`${root}/seek-after.png`});
  await style2.evaluate(element=>element.remove());
  return { errors, metrics, deterministicPng:before.equals(after) };
}
