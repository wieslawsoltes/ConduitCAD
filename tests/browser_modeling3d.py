"""Real workbench interactions in 2D/3D. Local opaque-origin storage is explicitly emulated.
Set CONDUIT_TEST_ORIGIN=localhost in CI for native IndexedDB and actual downloads.
No physical-device, B-rep, or complete product parity claim.
"""
import functools
import http.server
import json
import os
import shutil
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[];real_origin=os.environ.get('CONDUIT_TEST_ORIGIN')=='localhost'
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'dist/ConduitCAD.html').read_text()
memory="""for(const name of ['localStorage','sessionStorage']){const data=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size}}});}Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});"""
def ok(label,value):
    assert value,label
    checks.append({'name':label,'passed':True});print(label,flush=True)
def load(page):
    page.on('pageerror',lambda e:errors.append(getattr(e,'stack',str(e))))
    page.on('dialog',lambda d:d.accept())
    if real_origin:page.goto(f'http://127.0.0.1:{server.server_port}/?fresh=1&no-sw=1&renderer=canvas&renderer3d=canvas')
    else:page.set_content(source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;','<script>'+memory+'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas',backend3d:'canvas'})"))
    page.wait_for_function('document.documentElement.dataset.ready==="true"')
    page.evaluate("conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer);clearTimeout(conduit.toastTimer);conduit.$('.toast').classList.remove('show')")
def action(page,a):
    page.evaluate('(a)=>conduit.action(a)',a)
    page.wait_for_timeout(30)
def field(page,n,value):page.locator(f'[data-model-field="{n}"]').fill(str(value))
def apply(page):
    page.locator('[data-action="modal-confirm"]').click()
    page.wait_for_timeout(40)
    assert page.locator('.modal').count()==0,(page.locator('.error-text').all_text_contents(),page.locator('[data-model-field]').evaluate_all('els=>els.map(e=>[e.dataset.modelField,e.value])'))
def bounded(page,selector):
    return page.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5}')
def select_last(page):page.evaluate("conduit.selection=new Set([conduit.doc.entities.at(-1).id]);conduit.updateSelection();conduit.model3d.sync()")
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=ctx.new_page();load(page)
    ok('2D editor is initial mode',page.locator('.viewport').is_visible() and page.locator('.model3d-stage').is_hidden())
    action(page,'new');page.locator('#template-search').fill('3d mounting');ok('new drawing chooser finds 3D industry examples',page.locator('[data-demo="3d:bracket"]').is_visible())
    page.locator('[data-demo="3d:bracket"]').click();page.wait_for_function('conduit.model3d.active&&conduit.model3d.renderer.backend');page.wait_for_timeout(150)
    ok('new example opens a new document instead of replacing 2D drawing',page.evaluate('conduit.documents.sessions.length===2&&conduit.doc.metadata.modeling.example==="bracket"'))
    ok('3D uses separate canvas and hides 2D drawing dock',page.locator('.viewport3d').is_visible() and page.locator('.tool-dock').is_hidden())
    ok('3D mode has one selected mode tab',page.locator('.workbar .tab.active').count()==1 and page.locator('[data-action="mode-3d"]').get_attribute('aria-pressed')=='true')
    ok('bracket has six editable features and native mesh triangles',page.evaluate('conduit.doc.entities.filter(e=>e.feature3d).length===6&&conduit.model3d.renderer.scene.triangles.length>100'))
    page.screenshot(path=str(OUT/'modeling3d-bracket-desktop.png'))
    for example in ['flange','vessel','transition','conduit','fixture','shaft','enclosure','manifold','primitives']:
        action(page,'3d-example:'+example)
        ok(example+' opens with its expected metadata',page.evaluate('(id)=>conduit.doc.metadata.modeling.example===id',example))
        ok(example+' tessellates without unsupported spatial diagnostics',page.evaluate('conduit.model3d.renderer.scene.diagnostics.length===0&&conduit.model3d.renderer.scene.triangles.length>0'))
        ok(example+' retains editable feature history',page.locator('.model3d-feature').count()>0)
    page.screenshot(path=str(OUT/'modeling3d-playground.png'))
    # Independent history and camera for each tab, including 2D draft state.
    page.evaluate("conduit.model3d.camera.orbit(40,20);conduit.model3d.saveView();window.saved3d=conduit.model3d.camera.snapshot();window.modelTab=conduit.documents.activeId;conduit.activateDocument(conduit.documents.sessions[0].id)")
    ok('returning to 2D document restores the original editor',page.locator('.viewport').is_visible() and page.locator('.tool-dock').is_visible())
    page.evaluate("conduit.executeCommand('LINE 0,0 80,30');window.lineId=conduit.doc.entities.at(-1).id;window.draftHistory=conduit.history.entries?.length;conduit.activateDocument(window.modelTab)")
    ok('3D document switching restores orbit state',page.evaluate('JSON.stringify(conduit.model3d.camera.snapshot())===JSON.stringify(saved3d)'))
    page.evaluate("conduit.newDocument('blank')");action(page,'mode-3d')
    # Actual form editing and preview lifecycle.
    action(page,'3d-op-box');field(page,'width',40);field(page,'depth',30);field(page,'height',20)
    page.evaluate('window.before=JSON.stringify(conduit.doc);window.cameraBefore=conduit.model3d.camera.snapshot()')
    page.locator('[data-action="3d-preview"]').click();page.wait_for_timeout(50)
    ok('preview adds geometry only to transient display',page.evaluate('JSON.stringify(conduit.doc)===window.before&&conduit.model3d.previewDocument.entities.length===1'))
    page.locator('[data-action="modal-close"]').first.click()
    ok('cancel clears preview and restores camera',page.evaluate('!conduit.model3d.previewDocument&&JSON.stringify(conduit.doc)===window.before&&JSON.stringify(conduit.model3d.camera.snapshot())===JSON.stringify(cameraBefore)'))
    action(page,'3d-op-box');field(page,'width',40);field(page,'depth',30);field(page,'height',20);apply(page)
    ok('Apply creates native MESH and a feature definition',page.evaluate('conduit.doc.entities.length===1&&conduit.doc.entities[0].type==="MESH"&&conduit.doc.entities[0].feature3d.kind==="box"'))
    action(page,'3d-op-transform');field(page,'dz',25);field(page,'dx',10);apply(page)
    ok('transform result retains source dependency and Z',page.evaluate('conduit.doc.entities[1].feature3d.inputs[0]===conduit.doc.entities[0].id&&conduit.doc.entities[1].points[0].z===25'))
    page.evaluate("conduit.selection=new Set([conduit.doc.entities[0].id]);conduit.updateSelection()")
    action(page,'3d-edit');field(page,'width',60);apply(page)
    ok('editing parent regenerates transformed child',page.evaluate('Math.max(...conduit.doc.entities[1].points.map(p=>p.x))===70'))
    action(page,'3d-undo');ok('one undo restores parent and downstream result',page.evaluate('Math.max(...conduit.doc.entities[1].points.map(p=>p.x))===50'))
    action(page,'3d-redo');ok('redo restores regenerated child',page.evaluate('Math.max(...conduit.doc.entities[1].points.map(p=>p.x))===70'))
    page.evaluate("window.before=JSON.stringify(conduit.doc);conduit.selection=new Set([conduit.doc.entities[0].id]);conduit.updateSelection()")
    action(page,'3d-edit');field(page,'width',-10);page.locator('[data-action="modal-confirm"]').click();page.wait_for_timeout(80)
    ok('invalid model parameter reports validation failure',page.locator('.error-text').inner_text().strip()!='')
    ok('failed parent edit changes neither geometry nor feature history',page.evaluate('JSON.stringify(conduit.doc)===window.before'))
    page.evaluate('conduit.closeModal()');select_last(page)
    # Native pointing / picking, not just inspector calls.
    page.evaluate("conduit.model3d.camera.view('top');conduit.model3d.renderer.fit();conduit.model3d.renderer.draw();conduit.selection.clear();conduit.updateSelection()")
    pos=page.evaluate("()=>{const p=conduit.model3d.camera.project({x:35,y:15,z:45}),r=conduit.model3d.host.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}}")
    page.mouse.click(pos['x'],pos['y']);ok('canvas depth pick selects front mesh result',page.evaluate('conduit.selection.has(conduit.doc.entities[1].id)'))
    # Move via an actual axis handle and verify one new history feature.
    page.evaluate("conduit.model3d.camera.view('iso');conduit.model3d.renderer.fit();conduit.model3d.renderer.draw()")
    handle=page.evaluate("()=>{const g=conduit.model3d.gizmo()[0],r=conduit.model3d.host.getBoundingClientRect();return {x:r.left+g.b.x,y:r.top+g.b.y}}")
    page.mouse.move(handle['x'],handle['y']);page.mouse.down();page.mouse.move(handle['x']+45,handle['y'],steps=6);page.mouse.up();page.wait_for_timeout(80)
    ok('axis drag commits one dependent transform',page.evaluate('conduit.doc.entities.length===3&&conduit.doc.entities[2].feature3d.kind==="transform"'))
    action(page,'3d-undo');ok('axis move undo removes only the transform',page.evaluate('conduit.doc.entities.length===2'));select_last(page)
    action(page,'3d-vertex');field(page,'index',6);field(page,'xyz','70, 30, 55');apply(page)
    ok('exact vertex editing keeps XYZ and explicitly detaches feature',page.evaluate('conduit.doc.entities[1].points[6].z===55&&!conduit.doc.entities[1].feature3d'))
    action(page,'3d-undo');ok('vertex edit undo restores executable feature definition',page.evaluate('conduit.doc.entities[1].feature3d.kind==="transform"'));select_last(page)
    action(page,'3d-op-offset-face');field(page,'face',1);field(page,'distance',5);apply(page)
    ok('press pull creates a regenerating face operation',page.evaluate('conduit.doc.entities.at(-1).feature3d.kind==="offset-face"&&Math.max(...conduit.doc.entities.at(-1).points.map(p=>p.z))===50'))
    action(page,'3d-section');field(page,'offset',35);page.locator('#model3d-section-lines').check();apply(page)
    ok('section analysis emits native LINE intersections',page.evaluate('conduit.doc.entities.some(e=>e.type==="LINE"&&e.a.z===35&&e.b.z===35)'))
    ok('section plane is active in spatial renderer',page.evaluate('conduit.model3d.renderer.section.offset===35'))
    page.evaluate('conduit.model3d.renderer.section=null;conduit.model3d.renderer.invalidate()')
    action(page,'3d-sketch');page.locator('#model3d-plane').select_option('XZ');field(page,'origin','0,0,20');apply(page)
    ok('plane profile is native OCS geometry with elevation',page.evaluate('conduit.doc.entities.at(-1).type==="LWPOLYLINE"&&conduit.doc.entities.at(-1).elevation===20&&conduit.doc.entities.at(-1).extrusion.y===-1'))
    action(page,'3d-op-extrude');field(page,'nx',0);field(page,'ny',-1);field(page,'nz',0);field(page,'height',15);apply(page)
    ok('tilted profile extrudes along explicit spatial direction',page.evaluate('conduit.doc.entities.at(-1).type==="MESH"&&conduit.doc.entities.at(-1).points.some(p=>p.y< -20)'))
    action(page,'3d-path');page.locator('#model3d-path').fill('0, 0, 0\n0, 10, 30\n40, 30, 60');apply(page)
    ok('3D path is a native spatial POLYLINE',page.evaluate('conduit.doc.entities.at(-1).flags===8&&conduit.doc.entities.at(-1).points[2].z===60'))
    action(page,'3d-2d');page.evaluate("conduit.executeCommand('CIRCLE 10 20 5')")
    ok('2D circle authoring still works in a mixed 3D drawing',page.evaluate('!conduit.model3d.active&&conduit.doc.entities.at(-1).type==="CIRCLE"'))
    action(page,'mode-3d');ok('returning to 3D keeps all spatial bodies',page.evaluate('conduit.model3d.renderer.scene.triangles.length>=24'))
    # Download native DXF, then independent parse/audit of saved bytes.
    if real_origin:
        with page.expect_download() as download:page.evaluate("conduit.doExport('dxf-binary')")
        path=OUT/'modeling3d-browser-download.dxf';download.value.save_as(path)
        import ezdxf
        d=ezdxf.readfile(path);audit=d.audit()
        ok('actual browser binary DXF download opens without repairs',not audit.errors and not audit.fixes)
        ok('download contains native MESH and 3D polyline',len(d.modelspace().query('MESH'))>=3 and any(e.is_3d_polyline for e in d.modelspace().query('POLYLINE')))
    ctx.close()
    # Real touch input and responsive controls across portrait / landscape / tablet.
    for width,height in [(320,568),(390,844),(844,390),(820,1180)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True);page=ctx.new_page();load(page);action(page,'3d-example:fixture');tag=f'{width}x{height}'
        ok(tag+' entire app stays inside horizontal viewport',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        ok(tag+' 3D tool dock remains visible and scrollable',bounded(page,'.model3d-dock'))
        ok(tag+' 3D history strip remains bounded',bounded(page,'.model3d-timeline'))
        ok(tag+' old 2D dock does not occlude 3D tools',page.locator('.tool-dock').is_hidden())
        ok(tag+' buttons have 44px touch height',page.locator('.model3d-dock').evaluate('e=>[...e.querySelectorAll("button")].every(b=>b.getBoundingClientRect().height>=44)'))
        page.evaluate("conduit.$('.toast').classList.remove('show');clearTimeout(conduit.toastTimer)")
        for a in ['3d-tools','3d-examples','3d-op-box','3d-view-options','3d-sketch','3d-path','3d-section','3d-measure']:
            action(page,a)
            ok(tag+' '+a+' dialog fits',bounded(page,'.modal'))
            ok(tag+' '+a+' body avoids horizontal overflow',page.locator('.modal-body').evaluate('e=>e.scrollWidth<=e.clientWidth+2'))
            ok(tag+' '+a+' retains close action',bounded(page,'.modal-head'))
            page.locator('.modal-head [data-action="modal-close"]').tap()
        # Native CDP two-finger gesture must navigate without generating a body or transform.
        rect=page.locator('.viewport3d').bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
        before=page.evaluate('JSON.stringify(conduit.doc)');height_before=page.evaluate('conduit.model3d.camera.height')
        cdp=ctx.new_cdp_session(page)
        def touch(kind,points):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i+1,'radiusX':3,'radiusY':3}for i,(x,y)in enumerate(points)]})
        touch('touchStart',[(cx-25,cy),(cx+25,cy)]);touch('touchMove',[(cx-50,cy+8),(cx+50,cy+8)]);touch('touchEnd',[]);page.wait_for_timeout(60)
        ok(tag+' two-finger gesture zooms without document edits',page.evaluate('conduit.model3d.camera.height')<height_before and page.evaluate('JSON.stringify(conduit.doc)')==before)
        page.screenshot(path=str(OUT/f'modeling3d-mobile-{width}.png'))
        action(page,'3d-bodies');ok(tag+' body inspector opens within viewport',bounded(page,'.inspector.open'));page.evaluate('conduit.closePanels()')
        action(page,'3d-2d');ok(tag+' switch back restores touch drawing dock',page.locator('.tool-dock').is_visible());ctx.close()
    ok('no uncaught 3D workbench JavaScript exceptions',not errors)
    browser.close()
finally:
    server.shutdown();(OUT/'browser-modeling3d.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'errors':errors,'origin':'localhost' if real_origin else 'opaque with explicit storage emulation','physicalDevice':False,'renderer':'canvas-software-depth'},indent=2))
print(json.dumps({'passed':len(checks),'errors':errors}))
