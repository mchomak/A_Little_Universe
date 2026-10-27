"""Local acceptance harness. Uses the already installed Python Playwright; no app dependency."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / 'evidence'
OUT.mkdir(exist_ok=True)
report = {}

def checkpoint(name, value=True):
    report[name] = value
    print(json.dumps({name: value}, ensure_ascii=False), flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=[
        '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
    ])
    context = browser.new_context(viewport={'width': 1024, 'height': 768}, has_touch=True)
    page = context.new_page()
    errors = []
    requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.goto('http://127.0.0.1:5173/?debug')
    page.get_by_test_id('dev-speed').wait_for()
    page.wait_for_selector('canvas')
    assert page.evaluate("!!document.querySelector('canvas').getContext('webgl2')")
    page.evaluate("window.__canvasBefore = document.querySelector('canvas'); window.__sequence = []; new MutationObserver(()=>{const s=document.querySelector('main').dataset.scene+':'+document.querySelector('main').dataset.mode;if(window.__sequence.at(-1)!==s)window.__sequence.push(s)}).observe(document.querySelector('main'),{attributes:true})")
    page.locator('.debug-toggle').click()
    page.screenshot(path=str(OUT / 'tablet-start.png'))
    page.get_by_test_id('start').click()
    page.locator('.debug-toggle').click()
    page.get_by_test_id('dev-speed').fill('4')
    page.locator('.debug-toggle').click()
    page.wait_for_selector('main[data-scene="prologue"][data-mode="waiting"]', timeout=15000)
    page.wait_for_timeout(350)
    assert page.locator('main').get_attribute('data-mode') == 'waiting'
    checkpoint('prologue_touch_gate')
    page.get_by_test_id('interact').click()
    page.wait_for_timeout(150)
    page.get_by_test_id('pause').click()
    first = page.locator('canvas').screenshot()
    page.wait_for_timeout(300)
    assert page.locator('canvas').screenshot() == first
    page.get_by_test_id('pause').click()
    checkpoint('pause_freezes_webgl')
    page.wait_for_selector('main[data-scene="bloom"][data-mode="waiting"]', timeout=15000)
    page.wait_for_timeout(350)
    assert page.locator('main').get_attribute('data-mode') == 'waiting'
    page.screenshot(path=str(OUT / 'tablet-bud.png'))
    page.get_by_test_id('interact').click()
    page.wait_for_selector('main[data-scene="identity"]', timeout=15000)
    page.wait_for_selector('main[data-scene="gallery"]', timeout=15000)
    checkpoint('growth_bloom_identity_auto_route')
    assert page.get_by_test_id('gallery-exit').count() == 0
    assert page.get_by_test_id('gallery-prev').is_disabled()
    page.wait_for_timeout(400)
    assert '1 / 6' in page.get_by_test_id('gallery').inner_text()
    checkpoint('gallery_no_timer_exit')
    # A real pointer swipe and its inverse, then cancelled and button-target gestures.
    page.mouse.move(100, 350)
    page.mouse.down()
    page.mouse.move(100, 230, steps=8)
    page.mouse.up()
    page.wait_for_function("document.querySelector('.gallery-count').textContent==='2 / 6'")
    page.mouse.move(100, 230)
    page.mouse.down()
    page.mouse.move(100, 350, steps=8)
    page.mouse.up()
    page.wait_for_function("document.querySelector('.gallery-count').textContent==='1 / 6'")
    page.evaluate("document.querySelector('.film-surface').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,isPrimary:true,button:0,clientX:100,clientY:350}));window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:7}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,clientX:100,clientY:200}))")
    assert '1 / 6' in page.get_by_test_id('gallery').inner_text()
    checkpoint('gallery_swipe_and_cancel')
    for _ in range(5):
        page.get_by_test_id('gallery-next').click()
    assert '6 / 6' in page.get_by_test_id('gallery').inner_text()
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / 'tablet-gallery.png'))
    assert page.get_by_test_id('gallery-next').is_disabled()
    page.get_by_test_id('gallery-prev').click()
    assert page.get_by_test_id('gallery-exit').count() == 0
    page.get_by_test_id('gallery-next').click()
    checkpoint('gallery_buttons_and_explicit_exit')
    # All required modules are already loaded; actual network is removed for rest of film.
    context.set_offline(True)
    page.get_by_test_id('gallery-exit').click()
    page.wait_for_selector('main[data-scene="cosmos"]', timeout=15000)
    page.wait_for_selector('main[data-scene="greeting"]', timeout=15000)
    checkpoint('eye_and_cosmos_auto_offline')
    page.get_by_test_id('open-reading').click()
    page.wait_for_selector('dialog[open]')
    assert page.locator('main').get_attribute('data-reading') == 'true'
    assert 'Временный текст' in page.get_by_test_id('reading').inner_text()
    assert page.get_by_test_id('close-reading').evaluate('(e)=>e===document.activeElement')
    page.keyboard.press('Escape')
    assert page.locator('main').get_attribute('data-reading') == 'false'
    assert page.get_by_test_id('open-reading').evaluate('(e)=>e===document.activeElement')
    page.get_by_test_id('pause').click()
    page.get_by_test_id('open-reading').click()
    page.get_by_test_id('close-reading').click()
    assert page.locator('main').get_attribute('data-paused') == 'true'
    page.get_by_test_id('pause').click()
    checkpoint('reading_escape_focus_manual_pause')
    page.wait_for_function("!!document.querySelector('.credits-crawl') && getComputedStyle(document.querySelector('.credits-crawl')).opacity==='1'", timeout=12000)
    page.get_by_test_id('credits-touch').click(position={'x': 30, 'y': 30})
    assert page.locator('main').get_attribute('data-paused') == 'true'
    page.wait_for_timeout(150)
    first = page.locator('.credits-crawl').get_attribute('style')
    page.wait_for_timeout(200)
    assert page.locator('.credits-crawl').get_attribute('style') == first
    page.get_by_test_id('credits-touch').click(position={'x': 30, 'y': 30})
    page.wait_for_selector('main[data-scene="greeting"][data-mode="waiting"]', timeout=20000)
    page.wait_for_timeout(350)
    assert page.locator('main').get_attribute('data-scene') == 'greeting'
    page.get_by_test_id('finish').click()
    page.wait_for_selector('main[data-scene="ending"]')
    checkpoint('credits_touch_pause_and_manual_finish')
    sequence = page.evaluate('window.__sequence')
    expected = ['prologue:playing','prologue:waiting','growth:playing','bloom:waiting','bloom:playing','identity:playing','gallery:exploring','eye:playing','cosmos:playing','greeting:playing','greeting:waiting','ending:ended']
    assert sequence == expected, sequence
    checkpoint('full_scene_sequence', sequence)
    assert page.evaluate("window.__canvasBefore === document.querySelector('canvas')")
    assert page.locator('canvas').count() == 1
    checkpoint('one_persistent_canvas')
    page.get_by_test_id('ending-reading').click()
    page.get_by_test_id('close-reading').click()
    page.wait_for_selector('main[data-scene="ending"]')
    assert page.get_by_test_id('ending-reading').evaluate('(e)=>e===document.activeElement')
    page.get_by_role('button', name='Открыть галерею', exact=True).click()
    page.get_by_test_id('gallery-exit').click()
    page.wait_for_selector('main[data-scene="ending"]')
    page.get_by_test_id('replay').click()
    page.wait_for_selector('main[data-scene="prologue"][data-mode="playing"]')
    checkpoint('ending_revisits_and_replay_offline')
    context.set_offline(False)
    # Developer jumps/restart, playhead, quality, reduced motion, and responsive layout.
    page.locator('.debug-toggle').click()
    for scene in ['prologue','growth','bloom','identity','gallery','eye','cosmos','greeting','ending']:
        page.get_by_test_id('dev-scene').select_option(scene)
        page.get_by_test_id('dev-run').click()
        page.wait_for_function('(s)=>document.querySelector("main").dataset.scene===s',arg=scene)
    page.get_by_test_id('dev-scene').select_option('identity')
    page.get_by_test_id('dev-run').click()
    page.get_by_test_id('dev-seek').fill('19')
    page.wait_for_function("document.querySelector('.identity-caption').textContent.includes('Портрет')")
    page.get_by_role('button', name='Перезапустить', exact=True).click()
    page.wait_for_function("Number(document.querySelector('[data-testid=dev-seek]').value)<3")
    checkpoint('dev_all_scene_jump_restart_seek')
    page.get_by_test_id('dev-scene').select_option('gallery')
    page.get_by_test_id('dev-run').click()
    page.locator('.debug-toggle').click()
    page.get_by_label('Качество графики').select_option('low')
    checkpoint('quality_control',page.get_by_label('Качество графики').input_value())
    for width,height in [(768,1024),(390,844)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(350)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,height)
        for testid in ['gallery-prev','gallery-next','pause']:
            b=page.get_by_test_id(testid).bounding_box()
            assert b and b['x']>=0 and b['x']+b['width']<=width and b['y']+b['height']<=height, (testid,b)
        page.screenshot(path=str(OUT / f'gallery-{width}.png'))
    page.locator('.debug-toggle').click()
    page.get_by_test_id('dev-scene').select_option('greeting')
    page.get_by_test_id('dev-run').click()
    page.locator('.debug-toggle').click()
    page.get_by_test_id('open-reading').click()
    page.screenshot(path=str(OUT / 'mobile-reading.png'))
    page.get_by_test_id('close-reading').click()
    page.emulate_media(reduced_motion='reduce')
    page.locator('.debug-toggle').click()
    page.get_by_test_id('dev-scene').select_option('growth')
    page.get_by_test_id('dev-run').click()
    page.get_by_test_id('dev-speed').fill('4')
    page.locator('.debug-toggle').click()
    page.wait_for_selector('main[data-scene="bloom"][data-mode="waiting"]',timeout=15000)
    page.get_by_test_id('interact').click()
    page.wait_for_selector('main[data-scene="identity"]',timeout=15000)
    checkpoint('reduced_motion_clock_and_gates')
    assert not errors, errors
    checkpoint('page_errors',errors)
    checkpoint('external_requests',[url for url in requests if not url.startswith(('http://127.0.0.1:5173','ws://127.0.0.1:5173','data:'))])
    browser.close()

(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
