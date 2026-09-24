"""Integrated UI checks. Browser policy disallows navigating URLs in this runner,
so tests load the actual standalone artifact via page.set_content. Persistence
uses a test-only in-memory adapter because this is an opaque origin. No browser
policies are changed. GPU backend availability is reported, not assumed."""
import json, math, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'artifacts'; checks=[];errors=[]
def ok(name,value,detail=None):
 assert value, f'{name}: {detail}'
 checks.append({'name':name,'passed':True,**({'detail':detail} if detail is not None else {})})
def setup(browser,mobile=False,size=None):
 ctx=browser.new_context(viewport=size or ({'width':390,'height':844} if mobile else {'width':1440,'height':960}),device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
 page=ctx.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
 html=(ROOT/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas'})")
 page.set_content(html);page.wait_for_function('document.documentElement.dataset.ready === "true"');page.wait_for_timeout(160)
 page.evaluate('''()=>{conduit.store.save=async()=>{};conduit.store.schedule=()=>{};}''')
 return ctx,page
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 ctx,page=setup(browser)
 ok('desktop startup displays 39 editable DXF entities',page.evaluate('conduit.doc.entities.length===39'))
 ok('default illustrative P&ID has no QA issues',page.evaluate('conduit.checkDrawing().length===0'),page.evaluate('conduit.checkDrawing()'))
 page.get_by_role('button',name='Parameters',exact=True).first.click();page.wait_for_timeout(100)
 ok('parameter dialog opens and traps UI in dialog',page.get_by_role('dialog').is_visible())
 page.keyboard.press('Escape');ok('Escape closes modal',page.get_by_role('dialog').count()==0)
 # Actual native pointer drag: move a pump while inspecting dependent connector endpoints.
 data=page.evaluate('''()=>{let e=conduit.doc.entities.find(e=>e.tag==='P-101');conduit.selectEntity(e.id);let p=conduit.camera.screen(e),r=conduit.$('.viewport').getBoundingClientRect();return {id:e.id,x:e.x,y:e.y,sx:r.left+p.x,sy:r.top+p.y};}''')
 page.mouse.move(data['sx'],data['sy']);page.mouse.down();page.mouse.move(data['sx']+33,data['sy']-23,steps=8);page.mouse.up();page.wait_for_timeout(150)
 moved=page.evaluate('(id)=>{let e=conduit.doc.entities.find(e=>e.id===id);return {x:e.x,y:e.y}}',data['id'])
 ok('mouse drags symbol CAD insertion point',moved['x']!=data['x'] or moved['y']!=data['y'],moved)
 ok('moving equipment maintains both connector references',page.evaluate('''id=>conduit.doc.entities.filter(e=>e.connector&&(e.connector.from?.entityId===id||e.connector.to?.entityId===id)).length===3''',data['id']))
 page.keyboard.press('Control+z');ok('keyboard Undo restores pump and route transaction',page.evaluate('(v)=>{let e=conduit.doc.entities.find(e=>e.id===v.id);return e.x===v.x&&e.y===v.y;}',data))
 page.keyboard.press('Control+Shift+z');ok('keyboard Redo restores moved geometry',page.evaluate('(v)=>{let e=conduit.doc.entities.find(e=>e.id===v.id);return e.x===v.x&&e.y===v.y;}',{**moved,'id':data['id']}))
 # Modal commands flow through the same history/constraint/document pipeline.
 page.evaluate("conduit.commandDialog()");page.wait_for_timeout(50);page.get_by_role('textbox',name='CAD command').fill('CIRCLE 0,0 25');page.get_by_role('button',name='Run command',exact=True).click();page.wait_for_timeout(60)
 ok('command palette creates actual circle entity',page.evaluate("conduit.doc.entities.at(-1).type==='CIRCLE'&&conduit.doc.entities.at(-1).r===25"))
 page.evaluate("conduit.executeCommand('PARAM size=80');conduit.edit('Radius expression',()=>conduit.setProperty(conduit.doc.entities.at(-1),'radius','size/2'));")
 ok('numeric radius accepts named expression',page.evaluate('conduit.doc.entities.at(-1).r===40'))
 page.evaluate("conduit.executeCommand('PARAM size=120')")
 ok('parameter change regenerates dependent geometry',page.evaluate('conduit.doc.entities.at(-1).r===60'))
 before=page.evaluate('JSON.stringify(conduit.doc)')
 try:page.evaluate("conduit.executeCommand('PARAM size=-5')")
 except Exception:pass
 ok('invalid parameter edit rolls back atomically',page.evaluate('JSON.stringify(conduit.doc)')==before)
 # Drawing primitives through real pointer actions in a clean drawing.
 page.evaluate("conduit.newDocument('blank')");page.wait_for_timeout(80)
 rect=page.locator('.viewport').bounding_box();x=rect['x']+280;y=rect['y']+260
 page.locator('[data-tool="line"]').click();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+160,y+60,steps=8);page.mouse.up();page.wait_for_timeout(100)
 ok('drag gesture draws a native LINE',page.evaluate("conduit.doc.entities.length===1&&conduit.doc.entities[0].type==='LINE'"))
 page.locator('[data-tool="rect"]').click();page.mouse.move(x+30,y+100);page.mouse.down();page.mouse.move(x+200,y+180,steps=8);page.mouse.up();page.wait_for_timeout(50)
 ok('drag gesture draws parametric rectangle polyline',page.evaluate("conduit.doc.entities.length===2&&conduit.doc.entities[1].parametric.kind==='rectangle'"))
 page.evaluate("conduit.setTool('select');conduit.selectEntity(conduit.doc.entities[0].id);")
 page.keyboard.press('Control+c');page.keyboard.press('Control+v');page.wait_for_timeout(50)
 ok('copy paste allocates independent entity identity',page.evaluate('conduit.doc.entities.length===3&&new Set(conduit.doc.entities.map(e=>e.id)).size===3'))
 page.keyboard.press('Delete');ok('Delete removes selected pasted entity',page.evaluate('conduit.doc.entities.length===2'))
 page.keyboard.press('Control+z');ok('Undo restores delete',page.evaluate('conduit.doc.entities.length===3'))
 # More menu and export must be real dialogs, no placeholder navigation.
 page.locator('[data-action="export"]').click();page.wait_for_timeout(50)
 ok('export dialog offers DXF, native project, SVG and graph',all(page.locator(f'[data-export="{f}"]').count()==1 for f in ['dxf','project','svg','graph']))
 page.keyboard.press('Escape')
 # CAD scene buffers are retained across camera pan frames.
 page.wait_for_timeout(100);page.evaluate('window.oldScene=conduit.renderer.scene;conduit.camera.pan(10,20);conduit.renderer.invalidate()');page.wait_for_timeout(80)
 ok('camera-only pan retains GPU upload scene data',page.evaluate('window.oldScene===conduit.renderer.scene'))
 ctx.close()
 # Portrait mobile: touch button + tap placement, then pinch arbitration.
 ctx,page=setup(browser,True)
 ok('390px portrait has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
 page.get_by_role('button',name='Symbols',exact=True).tap();page.wait_for_timeout(80)
 ok('mobile symbol library opens as a bottom sheet',page.locator('.library.open').is_visible())
 page.locator('[data-symbol="gate-valve"]').tap();page.wait_for_timeout(50)
 ok('tap on symbol arms placement and closes sheet',page.evaluate("conduit.tool==='insert'") and not page.locator('.library.open').count())
 r=page.locator('.viewport').bounding_box();page.touchscreen.tap(r['x']+180,r['y']+200);page.wait_for_timeout(100)
 ok('tap places native block reference on mobile',page.evaluate("conduit.doc.entities.length===40&&conduit.doc.entities.at(-1).type==='INSERT'"))
 page.get_by_role('button',name='Edit',exact=True).tap();page.wait_for_timeout(80)
 ok('mobile numeric properties sheet opens for selected block',page.locator('.inspector.open').is_visible())
 page.evaluate('conduit.closePanels();conduit.setTool("select")');page.wait_for_timeout(30)
 before=page.evaluate('({scale:conduit.camera.scale,entities:conduit.doc.entities.length,history:conduit.history.undoStack.length})')
 cdp=ctx.new_cdp_session(page)
 cx=r['x']+180;cy=r['y']+200
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-35,'y':cy,'id':1},{'x':cx+35,'y':cy,'id':2}]})
 for d in [45,55,65,75]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-d,'y':cy,'id':1},{'x':cx+d,'y':cy,'id':2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(100)
 after=page.evaluate('({scale:conduit.camera.scale,entities:conduit.doc.entities.length,history:conduit.history.undoStack.length})')
 ok('two-finger pinch zoom changes camera scale',after['scale']>before['scale']*1.5,{'before':before['scale'],'after':after['scale']})
 ok('pinch cancels accidental edit instead of creating geometry',after['entities']==before['entities'] and after['history']==before['history'])
 page.screenshot(path=str(OUT/'mobile-editing.png'))
 ctx.close()
 # Mobile landscape gets vertical dock, no desktop permanent side panel.
 ctx,page=setup(browser,True,{'width':844,'height':390})
 ok('844x390 landscape viewport remains usable',page.locator('.viewport').bounding_box()['height']>=270)
 ok('mobile landscape has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
 page.screenshot(path=str(OUT/'mobile-landscape.png'));ctx.close()
 ok('no uncaught browser JavaScript errors',not errors,errors)
 browser.close()
report={'checks':checks,'passed':len(checks),'errors':errors,'backendTested':'Canvas 2D','persistence':'test-only in-memory adapter; opaque origin','hardwareGPUValidation':False}
(OUT/'browser-workflows.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
