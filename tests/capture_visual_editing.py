"""Actual production-workbench captures. Same explicit origin/storage scope as render_support.
Run with xvfb-run -a python tests/capture_visual_editing.py on Linux.
No screenshot painting or placeholder UI is used.
"""
from playwright.sync_api import sync_playwright
from render_support import Harness, launch, OUT

h = Harness()
def wait(page):
    page.wait_for_function('!!conduit.model3d.visual.session?.preview')
    page.wait_for_timeout(60)
def set_field(page, name, value):
    loc = page.locator(f'[data-visual-field="{name}"]')
    loc.scroll_into_view_if_needed()
    loc.click()
    entry = page.locator('.visual3d-entry input')
    entry.fill(str(value))
    entry.press('Enter')
    wait(page)
try:
    with sync_playwright() as p:
        browser = launch(p)
        context = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = context.new_page()
        page.set_default_timeout(12000)
        h.load(page, 'webgl2')
        page.evaluate("async()=>{await conduit.newDocument('blank');conduit.edit('Name drawing',()=>conduit.doc.name='Visual modeling — editable fixture');await conduit.action('mode-3d');await conduit.model3d.ready;conduit.model3d.camera.view('iso');await conduit.action('3d-op-box')}")
        wait(page)
        for key, value in [('width', 120), ('depth', 90), ('height', 32), ('x', 0), ('y', 0), ('z', 0)]:
            set_field(page, key, value)
        page.locator('[data-visual-command=fit]').click()
        page.wait_for_timeout(100)
        page.screenshot(path=str(OUT/'visual3d-showcase-primitive.png'))
        page.locator('[data-visual-command=apply]').click()
        page.wait_for_timeout(100)
        page.evaluate("async()=>{await conduit.action('3d-fit');conduit.model3d.selectionMode='face';conduit.model3d.camera.height*=1.25;conduit.model3d.changedView()}")
        page.wait_for_timeout(80)
        hit = page.evaluate("()=>{const p=conduit.model3d.camera.project({x:70,y:50,z:32}),r=conduit.model3d.host.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y}}")
        page.mouse.click(hit['x'],hit['y'])
        page.wait_for_timeout(50)
        page.evaluate("conduit.action('3d-op-hole')")
        wait(page)
        page.locator('[data-visual-command=options]').click()
        page.locator('[data-visual-option=holeType]').select_option('1')
        page.locator('[data-visual-option=through]').select_option('0')
        page.locator('[data-visual-command=options-close]').click()
        wait(page)
        for key,value in [('counterDiameter',36),('diameter',20),('depth',26),('counterDepth',8),('u',10),('v',5)]:
            set_field(page,key,value)
        page.locator('[data-visual-command=fit]').click()
        page.wait_for_timeout(2800)
        page.screenshot(path=str(OUT/'visual3d-showcase-desktop.png'))
        page.locator('[data-visual-field=diameter]').click()
        page.wait_for_timeout(70)
        page.screenshot(path=str(OUT/'visual3d-showcase-exact.png'))
        page.locator('.visual3d-entry input').press('Escape')
        page.locator('[data-visual-command=options]').click()
        page.wait_for_timeout(70)
        page.screenshot(path=str(OUT/'visual3d-showcase-options.png'))
        context.close()
        browser.close()
finally:
    h.close()
