"""Production isolation, physical canvas hit targets and actual quality resolution."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(__file__).parent / 'evidence'
result = {}
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':1024,'height':768}, device_scale_factor=2,has_touch=True)
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5173/?debug')
    page.get_by_test_id('dev-scene').wait_for()
    page.get_by_test_id('dev-scene').select_option('bloom')
    page.get_by_test_id('dev-run').click()
    page.locator('.debug-toggle').click()
    box=page.locator('canvas').bounding_box()
    page.mouse.click(box['x']+box['width']/2, box['y']+box['height']*.4)
    page.wait_for_selector('main[data-scene="bloom"][data-mode="playing"]')
    result['3d_bud_touch']=True
    page.locator('.debug-toggle').click()
    page.get_by_test_id('dev-scene').select_option('prologue')
    page.get_by_test_id('dev-run').click()
    page.get_by_test_id('dev-seek').fill('16')
    page.wait_for_selector('main[data-scene="prologue"][data-mode="waiting"]')
    page.locator('.debug-toggle').click()
    box=page.locator('canvas').bounding_box()
    page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
    page.wait_for_selector('main[data-scene="growth"]')
    result['3d_seed_touch']=True
    page.get_by_test_id('pause').click()
    before=page.locator('canvas').evaluate('(e)=>e.width/e.getBoundingClientRect().width')
    page.get_by_label('Качество графики').select_option('low')
    page.wait_for_timeout(150)
    after=page.locator('canvas').evaluate('(e)=>e.width/e.getBoundingClientRect().width')
    assert before==1.5 and after==1,(before,after)
    result['quality_actual_dpr']={'standard':before,'low':after}
    prod=context.new_page()
    prod.goto('http://127.0.0.1:4173/?debug')
    prod.wait_for_selector('canvas')
    prod.get_by_test_id('start').wait_for()
    assert prod.locator('canvas').count()==1
    assert prod.locator('#developer-panel,.debug-toggle').count()==0
    assert 'Developer Mode' not in prod.locator('body').inner_text()
    prod.get_by_test_id('start').click()
    prod.wait_for_selector('main[data-scene="prologue"][data-mode="playing"]')
    result['production_no_debug_with_query']=True
    result['page_errors']=errors
    assert not errors,errors
    browser.close()
(out/'browser-extra-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False),flush=True)
