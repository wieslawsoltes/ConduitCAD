"""Canvas pixel tests, actual file/worker import, clipping, and a native touch-library drag.
The Chromium run reports Canvas 2D; it is not a GPU hardware certification.
"""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True);checks=[];errors=[]
def ok(name,value,detail=None):
 assert value,(name,detail)
 checks.append(dict(name=name,passed=True,**({'detail':detail} if detail is not None else {})))
def setup(browser,mobile=False):
 ctx=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':960},device_scale_factor=2 if mobile else 1,has_touch=mobile,is_mobile=mobile)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 html=(ROOT/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas'})")
 page.set_content(html);page.wait_for_function('document.documentElement.dataset.ready==="true"');page.evaluate('conduit.store.save=async()=>{};conduit.store.schedule=()=>{}');return ctx,page
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 ctx,page=setup(browser)
 page.evaluate("async source=>{await conduit.openFile(new File([source],'fidelity.dxf',{type:'application/dxf'}));}",(ROOT/'tests/fixtures/fidelity.dxf').read_text())
 page.wait_for_function('conduit.doc.entities.length===37');page.wait_for_timeout(250)
 ok('37-entity independent DXF opens through real File API and import worker',page.evaluate('conduit.doc.entities.length===37'))
 page.screenshot(path=str(OUT/'dxf-fidelity-desktop.png'))
 page.evaluate('''()=>{const h=conduit.doc.entities.find(e=>e.type==='HATCH'&&e.loops.length===3);conduit.doc.entities=[{id:'behind',type:'LINE',layer:'0',color:'#0000ff',width:8,a:{x:-10,y:50},b:{x:110,y:50}},h];conduit.selection.clear();conduit.cursor=null;conduit.renderer.grid=false;conduit.camera.x=50;conduit.camera.y=50;conduit.camera.scale=4;conduit.renderer.setDocument(conduit.doc);}''');page.wait_for_timeout(100)
 def pixel(x,y):return page.evaluate('''([x,y])=>{const r=conduit.renderer,p=conduit.camera.screen({x,y});return [...r.ctx.getImageData(Math.round(p.x*r.dpr),Math.round(p.y*r.dpr),1,1).data];}''',[x,y])
 outer,hole,island=pixel(10,50),pixel(25,50),pixel(50,50)
 ok('solid hatch hides an earlier line where material exists',outer[0]>245 and outer[2]<5,outer)
 ok('hatch island hole reveals the earlier blue line',hole[2]>245 and hole[0]<5,hole)
 ok('nested island is filled again in normal style',island[0]>245 and island[2]<5,island)
 ok('hole does not select the hatch using its bounding rectangle',page.evaluate("conduit.hitTest({x:25,y:60},1)===null"))
 ok('filled interior selects the actual hatch',page.evaluate("conduit.hitTest({x:10,y:60},1)?.type==='HATCH'"))
 # Fill across all canvas edges; rulers must remain free of geometry and overlays.
 page.evaluate('''()=>{conduit.doc.entities=[{id:'full',type:'HATCH',layer:'0',color:'#ff0000',solid:true,loops:[{points:[{x:-10000,y:-10000},{x:10000,y:-10000},{x:10000,y:10000},{x:-10000,y:10000}]}]}];conduit.renderer.setDocument(conduit.doc);}''');page.wait_for_timeout(100)
 pixels=page.evaluate('''()=>{const r=conduit.renderer;return [[10,60],[60,10],[10,10],[35,35]].map(([x,y])=>[...r.ctx.getImageData(x*r.dpr,y*r.dpr,1,1).data]);}''')
 ok('ruler strips are clipped in the actual drawing context',all(v[3]==0 for v in pixels[:3]),pixels)
 ok('geometry renders immediately inside the drawing clip',pixels[3][0]>245 and pixels[3][3]==255,pixels[3])
 before=page.evaluate('conduit.doc.entities.length');page.evaluate("conduit.setTool('line')")
 box=page.locator('.viewport').bounding_box();page.mouse.click(box['x']+10,box['y']+70);page.mouse.click(box['x']+10,box['y']+110)
 ok('drawing gestures cannot begin on rulers',page.evaluate('conduit.doc.entities.length')==before)
 ctx.close();ctx,page=setup(browser,True);page.get_by_role('button',name='Symbols',exact=True).tap();page.wait_for_timeout(120)
 handle=page.locator('.symbol-card').first.locator('.symbol-drag-handle').bounding_box();view=page.locator('.viewport').bounding_box();before=page.evaluate('conduit.doc.entities.length')
 ok('library drag handle reserves touch gestures before pointerdown',page.locator('.symbol-drag-handle').first.evaluate("el=>getComputedStyle(el).touchAction==='none'"))
 session=ctx.new_cdp_session(page);x=handle['x']+handle['width']/2;y=handle['y']+handle['height']/2
 session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
 page.wait_for_timeout(80);target={'x':view['x']+150,'y':view['y']+180,'id':1}
 for i in range(1,9):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(target['x']-x)*i/8,'y':y+(target['y']-y)*i/8,'id':1}]})
 session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(180)
 ok('native touch drag places exactly one editable symbol',page.evaluate('conduit.doc.entities.length')==before+1,page.evaluate('conduit.doc.entities.length'))
 ok('zoom separator no longer consumes a button-sized gap',page.locator('.zoom-controls .separator').bounding_box()['width']<=2)
 ok('mobile portrait remains within viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.screenshot(path=str(OUT/'mobile-fidelity.png'))
 ok('no uncaught errors in import, rendering, or native touch drag',not errors,errors)
 ctx.close();browser.close()
report={'checks':checks,'passed':len(checks),'errors':errors,'backend':'Canvas 2D','hardwareGPUValidation':False};(OUT/'browser-fidelity.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
