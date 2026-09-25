"""Real workbench catalogue, starter, safe migration and mobile touch regressions.
Browser execution is Canvas 2D with an in-memory persistence adapter at an opaque origin.
"""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
def ok(name,value,detail=None):
    print(name, value, flush=True)
    assert value,(name,detail)
    checks.append(dict(name=name,passed=True,**({'detail':detail} if detail is not None else {})))
def setup(browser,mobile=False):
    context=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},device_scale_factor=2 if mobile else 1,has_touch=mobile,is_mobile=mobile)
    page=context.new_page();page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas'})"))
    page.wait_for_function('document.documentElement.dataset.ready==="true"');page.wait_for_timeout(150)
    page.evaluate('conduit.store.save=async()=>{};conduit.store.schedule=()=>{}')
    return context,page
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    ctx,page=setup(browser)
    ok('native category selector exposes eleven categories plus All and Custom',page.locator('#symbol-category option').count()==13)
    ok('P&ID library contains all 45 masters',page.locator('.symbol-card').count()==45)
    for category,count in [('Electrical',44),('Flow',22),('Instrumentation',17),('Hydraulics',20),('Pneumatics',19),('HVAC',14),('Water',12),('Automation',12),('Fire',8),('Network',10)]:
        page.locator('#symbol-category').select_option(category)
        ok(category+' category has its complete master set',page.locator('.symbol-card').count()==count)
    page.locator('#symbol-search').fill('ISO-1219-1')
    ok('family search returns hydraulic and pneumatic masters across categories',page.locator('.symbol-card').count()==39)
    page.locator('#symbol-search').fill('hyd-cylinder')
    ok('new category search exposes actual native block thumbnails',page.locator('[data-symbol="hyd-cylinder"] svg path').count()>2)
    # Library previews for imported/lean documents must not auto-install all definitions.
    page.evaluate("()=>{conduit.doc.blocks={};conduit.doc.entities=[];conduit.renderer.setDocument(conduit.doc);conduit.renderLibrary();}")
    ok('browsing missing masters does not mutate an imported document',page.evaluate('Object.keys(conduit.doc.blocks).length===0'))
    page.locator('[data-symbol="hyd-cylinder"]').click()
    view=page.locator('.viewport').bounding_box();page.mouse.click(view['x']+150,view['y']+140)
    ok('placement lazily installs exactly the selected master',page.evaluate('Object.keys(conduit.doc.blocks).length===1 && conduit.doc.entities[0].type==="INSERT" && conduit.doc.entities[0].block==="CC_HYD_CYLINDER"'))
    ok('hydraulic insertion uses the hydraulic layer',page.evaluate('conduit.doc.entities[0].layer==="Hydraulics"'))
    page.evaluate('conduit.newDialog()')
    ok('new drawing dialog exposes twenty starters and Blank',page.locator('[data-demo]').count()==21)
    page.locator('#template-search').fill('hydraulic')
    ok('industry search filters the actual starter buttons',page.locator('.template-card:visible').count()==1)
    page.locator('[data-demo="hydraulic-actuator"]').click();page.wait_for_function('conduit.doc.metadata.templateId==="hydraulic-actuator"')
    ok('starter selection creates routed editable hydraulic entities',page.evaluate('conduit.doc.entities.filter(e=>e.type==="INSERT").length===5 && conduit.doc.entities.filter(e=>e.connector).every(e=>e.connector.status==="routed")'))
    ok('starter selects appropriate symbol category and line style',page.evaluate('conduit.category==="Hydraulics" && conduit.lineStyle==="hydraulic"'))
    page.screenshot(path=str(OUT/'symbols-desktop.png'))
    # Existing saved revisions must remain unchanged until an explicit confirmation.
    page.evaluate("async()=>{await conduit.newDocument('pid');const b=conduit.doc.blocks.CC_GATE_VALVE;b.symbol.geometryRevision=1;b.entities[0].a.x=-75;conduit.renderLibrary();}")
    ok('rendering an older saved master does not overwrite it',page.evaluate('conduit.doc.blocks.CC_GATE_VALVE.entities[0].a.x===-75'))
    page.get_by_role('button',name='Conventions & library updates',exact=True).click()
    ok('guide identifies references as not normative certification', 'do not certify' in page.get_by_role('dialog').inner_text())
    page.get_by_role('button',name='Update used definitions',exact=True).click();page.wait_for_timeout(100)
    ok('confirmed migration updates the used definition',page.evaluate('conduit.doc.blocks.CC_GATE_VALVE.symbol.geometryRevision===3 && conduit.doc.blocks.CC_GATE_VALVE.entities[0].a.x===-45'))
    page.keyboard.press('Control+z')
    ok('one Undo restores the saved geometry and its revision',page.evaluate('conduit.doc.blocks.CC_GATE_VALVE.symbol.geometryRevision===1 && conduit.doc.blocks.CC_GATE_VALVE.entities[0].a.x===-75'))
    # Failure to persist must not replace the current project.
    page.evaluate("()=>{conduit.store.save=async()=>{throw new Error('test quota')}}")
    name=page.evaluate('conduit.doc.name');page.evaluate("async()=>{await conduit.newDocument('network')}")
    ok('storage failure keeps previous drawing open in its own tab',page.evaluate('(name)=>conduit.documents.sessions.some(s=>s.document.name===name)',name))
    ctx.close();ctx,page=setup(browser,True)
    page.get_by_role('button',name='Symbols',exact=True).tap();page.locator('#symbol-category').select_option('Pneumatics')
    ok('mobile category selector is a 44px touch target',page.locator('#symbol-category').bounding_box()['height']>=44)
    page.locator('#symbol-search').fill('pneu-cylinder-spring');page.wait_for_timeout(100)
    handle=page.locator('.symbol-card .symbol-drag-handle').first.bounding_box();view=page.locator('.viewport').bounding_box();before=page.evaluate('conduit.doc.entities.length')
    x=handle['x']+handle['width']/2;y=handle['y']+handle['height']/2;tx=view['x']+145;ty=view['y']+150
    session=ctx.new_cdp_session(page);session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
    for i in range(1,11):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(tx-x)*i/10,'y':y+(ty-y)*i/10,'id':1}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(180)
    ok('native touch drag places exactly one new pneumatic master',page.evaluate('conduit.doc.entities.length')==before+1 and page.evaluate('conduit.doc.entities.at(-1).block==="CC_PNEU_CYLINDER_SPRING"'))
    # Use a fresh input session for the separate layout checks; do not mix CDP
    # contact identities with Playwright touchscreen contact identities.
    ctx.close();ctx,page=setup(browser,True)
    page.get_by_role('button',name='Symbols',exact=True).tap()
    page.locator('#symbol-search').fill('');page.locator('#symbol-category').select_option('Instrumentation');page.screenshot(path=str(OUT/'symbols-mobile.png'))
    ok('expanded mobile library has no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.evaluate('conduit.newDialog()');page.locator('#template-search').fill('water');page.screenshot(path=str(OUT/'symbols-mobile-starters.png'))
    ok('mobile industry selector remains within the viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ok('industry selector retains multiple water-related matches',page.locator('.template-card:visible').count()>=3)
    page.keyboard.press('Escape');page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(120)
    ok('landscape symbol library has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ok('no uncaught errors in catalogue, starters, migration or touch',not errors,errors)
    ctx.close();browser.close()
result=dict(checks=checks,passed=len(checks),errors=errors,backend='Canvas 2D',physicalDevice=False,persistence='test-only memory adapter')
(OUT/'browser-symbols.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
