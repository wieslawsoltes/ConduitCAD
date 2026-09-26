"""Actual 3D authoring forms, face picking and touch navigation.
Local default uses the inherited explicit in-memory storage adapter; CI uses localhost.
No physical-device, native Autodesk or hardware-performance qualification is implied.
"""
import functools, http.server, json, os, shutil, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[];native=os.environ.get('CONDUIT_TEST_ORIGIN')=='localhost'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'dist/ConduitCAD.html').read_text()
memory="""for(const name of ['localStorage','sessionStorage']){const data=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size}}});}Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});"""
def ok(name,value):
 assert value,name
 checks.append({'name':name,'passed':True});print(name,flush=True)
def load(page):
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 if native:page.goto(f'http://127.0.0.1:{server.server_port}/?fresh=1&no-sw=1&renderer=canvas&renderer3d=canvas')
 else:page.set_content(source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;','<script>'+memory+'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas',backend3d:'canvas'})"))
 page.wait_for_function('document.documentElement.dataset.ready==="true"')
 page.evaluate("conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer);conduit.newDocument('blank')")
 action(page,'mode-3d');page.wait_for_function('!!conduit.model3d.renderer.backend')
def action(page,a):page.evaluate('(a)=>conduit.action(a)',a);page.wait_for_timeout(25)
def field(page,n,v):page.locator(f'[data-model-field="{n}"]').fill(str(v))
def choice(page,n,v):page.locator(f'[data-model-field="{n}"]').select_option(str(v))
def apply(page):
 page.locator('[data-action="modal-confirm"]').click();page.wait_for_timeout(50)
 assert page.locator('.modal').count()==0,page.locator('.error-text').all_text_contents()
def create_box(page):
 action(page,'3d-op-box');field(page,'width',60);field(page,'depth',40);field(page,'height',20);apply(page)
 page.evaluate('window.plateId=conduit.doc.entities.at(-1).id')
def face_pick(page):
 action(page,'3d-pick:face');page.evaluate("conduit.model3d.camera.view('top');conduit.model3d.renderer.fit();conduit.model3d.renderer.draw();conduit.selection.clear();conduit.updateSelection()")
 point=page.evaluate("()=>{const p=conduit.model3d.camera.project({x:30,y:20,z:20}),r=conduit.model3d.host.getBoundingClientRect();return {x:r.x+p.x,y:r.y+p.y}}")
 page.mouse.click(point['x'],point['y']);page.wait_for_timeout(30)
 ok('canvas face pick selects a planar top face',page.evaluate('conduit.model3d.hit?.face===1&&conduit.selection.has(plateId)'))
def bounded(page,selector):
 return page.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-.5&&r.top>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5}')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=context.new_page();load(page);create_box(page);face_pick(page)
  ok('face mode has no body translation handles',page.evaluate('conduit.model3d.gizmo().length===0'))
  ok('face actions are discoverable without opening a catalogue',page.locator('.model3d-context [data-action="3d-op-hole"]').is_visible() and page.locator('.model3d-context [data-action="3d-face-profile"]').is_visible())
  page.locator('.model3d-context [data-action="3d-op-hole"]').click()
  ok('hole form inherits the picked face and local center',page.locator('[data-model-field=face]').input_value()=='1' and abs(float(page.locator('[data-model-field=u]').input_value()))<1e-5)
  ok('simple through hole hides unused recess and blind fields',page.locator('[data-model-row=depth]').is_hidden() and page.locator('[data-model-row=counterDiameter]').is_hidden())
  choice(page,'holeType',1);choice(page,'through',0);field(page,'diameter',8);field(page,'depth',12);field(page,'counterDiameter',16)
  ok('counterbore and distance controls show only relevant fields',page.locator('[data-model-row=counterDepth]').is_visible() and page.locator('[data-model-row=sinkAngle]').is_hidden() and page.locator('[data-model-row=depth]').is_visible())
  page.evaluate('window.before=JSON.stringify(conduit.doc);window.oldCamera=conduit.model3d.camera.snapshot()')
  page.locator('[data-action="3d-preview"]').click();page.wait_for_timeout(60)
  ok('hole preview is a noncommitting evaluated result',page.evaluate('conduit.model3d.previewDocument.entities.length===2&&JSON.stringify(conduit.doc)===before'))
  field(page,'diameter',9)
  ok('changing a field invalidates old preview and restores camera',page.evaluate('!conduit.model3d.previewDocument&&JSON.stringify(conduit.doc)===before&&JSON.stringify(conduit.model3d.camera.snapshot())===JSON.stringify(oldCamera)'))
  page.locator('[data-action="3d-preview"]').click();field(page,'diameter',-5);page.locator('[data-action="3d-preview"]').click()
  ok('invalid preview removes old geometry and reports failure',page.evaluate('!conduit.model3d.previewDocument&&JSON.stringify(conduit.doc)===before') and bool(page.locator('.error-text').inner_text()))
  field(page,'diameter',8);apply(page)
  ok('hole Apply commits one attached native mesh feature',page.evaluate('conduit.doc.entities.length===2&&conduit.doc.entities[1].feature3d.kind==="hole"&&conduit.doc.entities[1].feature3d.attachment.face===1'))
  ok('hole creation preserves current camera',page.evaluate('JSON.stringify(conduit.model3d.camera.snapshot())===JSON.stringify(oldCamera)'))
  action(page,'3d-undo');ok('undo removes hole and restores stock visibility',page.evaluate('conduit.doc.entities.length===1&&!conduit.doc.entities[0].model3dConsumed'))
  action(page,'3d-redo');ok('redo restores executable hole history',page.evaluate('conduit.doc.entities.length===2&&conduit.doc.entities[1].feature3d.kind==="hole"'))
  action(page,'3d-select:'+page.evaluate('plateId'));action(page,'3d-edit');field(page,'height',30);apply(page)
  ok('upstream form edit regenerates the attached hole',page.evaluate('Math.max(...conduit.doc.entities[1].points.map(p=>p.z))===30'))
  action(page,'3d-select:'+page.evaluate('conduit.doc.entities[1].id'));action(page,'3d-edit');choice(page,'holeType',2);choice(page,'through',1)
  ok('countersink changes relevant form controls',page.locator('[data-model-row=sinkAngle]').is_visible() and page.locator('[data-model-row=counterDepth]').is_hidden())
  apply(page);page.evaluate("conduit.model3d.camera.view('iso');conduit.model3d.renderer.fit()")
  page.screenshot(path=str(OUT/'authoring3d-counterbore-desktop.png'))
  # Native face profile snapshot, then actual Join extrusion form.
  page.evaluate("conduit.newDocument('blank')");action(page,'mode-3d');create_box(page);face_pick(page)
  action(page,'3d-look-face');ok('look-at-face is orthographic and points along the selected normal',page.evaluate('!conduit.model3d.camera.perspective&&conduit.model3d.camera.pitch>1.5'))
  page.locator('.model3d-context [data-action="3d-face-profile"]').click();field(page,'width',30);field(page,'height',20);apply(page)
  ok('face sketch creates a native elevated OCS polyline',page.evaluate('conduit.doc.entities.at(-1).type==="LWPOLYLINE"&&conduit.doc.entities.at(-1).elevation===20'))
  page.locator('.model3d-context [data-action="3d-op-extrude"]').click()
  ok('new extrusion defaults to profile normal',page.locator('[data-model-field=useNormal]').input_value()=='1' and page.locator('[data-model-row=nx]').is_hidden())
  choice(page,'operation',1);field(page,'height',10)
  ok('Join shows the body selector',page.locator('[data-model-target-row]').is_visible())
  page.locator('[data-model-target]').select_option(page.evaluate('plateId'));apply(page)
  ok('Join produces one native feature retaining both inputs',page.evaluate('conduit.doc.entities.length===3&&conduit.doc.entities[2].feature3d.inputs.length===2&&Math.max(...conduit.doc.entities[2].points.map(p=>p.z))===30'))
  # Imported expression-valued choices remain choices, not silently reset literals.
  page.evaluate("conduit.doc.parameters={JoinMode:'1',NormalMode:'1'};const f=conduit.doc.entities[2].feature3d;f.parameters.operation='JoinMode';f.parameters.useNormal='NormalMode'")
  action(page,'3d-edit')
  ok('expression-valued choices retain the original expression',page.locator('[data-model-field=operation]').input_value()=='JoinMode' and page.locator('[data-model-target-row]').is_visible() and page.locator('[data-model-row=nx]').is_hidden())
  apply(page)
  ok('Apply preserves expression-driven operation and its target',page.evaluate('conduit.doc.entities[2].feature3d.parameters.operation==="JoinMode"&&conduit.doc.entities[2].feature3d.inputs.length===2'))
  # Timeline refresh does not replace focused buttons on autosave-style sync.
  page.evaluate('window.timelineButton=document.querySelector(".model3d-feature");timelineButton.focus();window.timelineScroll=document.querySelector(".model3d-timeline").scrollLeft;conduit.model3d.sync()')
  ok('unchanged timeline sync preserves button identity and keyboard focus',page.evaluate('document.activeElement===timelineButton&&document.querySelector(".model3d-feature")===timelineButton'))
  page.keyboard.press('End');ok('timeline End moves focus without activating a different body',page.evaluate('document.activeElement===document.querySelector(".model3d-timeline").lastElementChild'))
  action(page,'3d-2d');page.evaluate("conduit.executeCommand('LINE 0,0 25,20')");ok('2D drawing remains editable beside 3D features',page.evaluate('!conduit.model3d.active&&conduit.doc.entities.at(-1).type==="LINE"'))
  action(page,'mode-3d');action(page,'3d-example:extrusion-study');action(page,'3d-select:'+page.evaluate('conduit.doc.entities[3].id'));action(page,'3d-edit')
  ok('symmetric extent is editable through named controls',page.locator('[data-model-field=extent]').input_value()=='1')
  choice(page,'extent',2);field(page,'height',25);field(page,'distance2',10);apply(page)
  ok('two-side extrusion form produces independent opposite extents',page.evaluate('Math.min(...conduit.doc.entities[3].points.map(p=>p.z))===-10&&Math.max(...conduit.doc.entities[3].points.map(p=>p.z))===25'))
  action(page,'3d-pick:body');action(page,'3d-visibility');ok('body visibility is an undoable edit',page.evaluate('conduit.doc.entities[3].hidden'));action(page,'3d-undo');ok('undo restores body visibility',page.evaluate('!conduit.doc.entities[3].hidden'))
  context.close()
  for width,height in [(320,568),(390,844),(844,390),(820,1180)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,device_scale_factor=1);page=ctx.new_page();load(page);create_box(page);tag=f'{width}x{height}'
   ok(tag+' reclaims space reserved for the hidden fixed 2D dock',page.locator('.statusbar').evaluate('e=>parseFloat(getComputedStyle(e).marginBottom)===0'))
   for selector in ['.model3d-selection-tools','.model3d-dock','.model3d-timeline']:
    ok(tag+' '+selector+' is bounded',bounded(page,selector))
   ok(tag+' context actions have touch-sized targets',page.locator('.model3d-context').evaluate('e=>[...e.querySelectorAll("button")].every(b=>b.getBoundingClientRect().height>=44)'))
   action(page,'3d-op-hole');ok(tag+' dialog and confirmation stay within visual viewport',bounded(page,'.modal') and bounded(page,'[data-action="modal-confirm"]'))
   ok(tag+' opening a form does not force the touch keyboard',page.evaluate('!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)'))
   choice(page,'holeType',2);field(page,'diameter',8);field(page,'counterDiameter',16);field(page,'sinkAngle',90);page.screenshot(path=str(OUT/f'authoring3d-{width}-hole-form.png'));apply(page)
   ok(tag+' hole can be completed in a touch-sized form',page.evaluate('conduit.doc.entities.at(-1).feature3d.kind==="hole"'))
   action(page,'3d-pick:face');ok(tag+' selection toggle exposes pressed state',page.locator('.model3d-selection-tools [data-action="3d-pick:face"]').get_attribute('aria-pressed')=='true')
   action(page,'3d-nav-toggle');ok(tag+' navigation toggles directly to Pan',page.evaluate('conduit.model3d.navigation==="pan"'))
   ok(tag+' gesture hint follows navigation and selection mode',page.locator('.model3d-hint').inner_text().startswith('Drag to pan') and 'select face' in page.locator('.viewport3d').get_attribute('aria-label'))
   action(page,'3d-clear');page.evaluate("conduit.model3d.camera.view('iso');conduit.model3d.renderer.fit()")
   rect=page.locator('.viewport3d').bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2;before=page.evaluate('JSON.stringify(conduit.doc)');distance=page.evaluate('conduit.model3d.camera.height');cdp=ctx.new_cdp_session(page)
   def touch(kind,pts):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i+1}for i,(x,y)in enumerate(pts)]})
   touch('touchStart',[(cx-20,cy),(cx+20,cy)]);touch('touchMove',[(cx-40,cy+4),(cx+40,cy+4)]);touch('touchEnd',[]);page.wait_for_timeout(50)
   ok(tag+' two-finger gesture reaches canvas without edits',page.evaluate('conduit.model3d.camera.height')<distance and page.evaluate('JSON.stringify(conduit.doc)')==before)
   page.screenshot(path=str(OUT/f'authoring3d-{width}-workspace.png'))
   action(page,'3d-2d');ok(tag+' 2D dock and its reserved space return',page.locator('.tool-dock').is_visible() and (width>height or page.locator('.statusbar').evaluate('e=>parseFloat(getComputedStyle(e).marginBottom)>0')))
   ctx.close()
  ok('no uncaught authoring JavaScript errors',not errors);browser.close()
finally:
 server.shutdown();(OUT/'browser-authoring3d.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'origin':'localhost' if native else 'opaque with explicit storage adapter','renderer':'canvas software depth','physicalDevice':False},indent=2))
print(json.dumps({'passed':len(checks),'errors':errors}))
