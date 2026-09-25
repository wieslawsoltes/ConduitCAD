"""Native DXF worker import, actual downloads and paper-viewport pixel regression tests."""
import functools, http.server, json, os, shutil, threading
from pathlib import Path
import ezdxf
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[]
LOCALHOST=os.environ.get("CONDUIT_TEST_ORIGIN") == "localhost"
def boot(page):
    if LOCALHOST:
        page.goto(f'http://127.0.0.1:{server.server_port}/?fresh=1&renderer=canvas')
    else:
        html=(ROOT/"dist/ConduitCAD.html").read_text().replace("mountWorkbench(document.getElementById('app'))", "mountWorkbench(document.getElementById('app'),{backend:'canvas'})")
        page.set_content(html)
    page.wait_for_function('document.documentElement.dataset.ready === "true"')
    if not LOCALHOST:
        page.evaluate("conduit.store.save=async()=>{};conduit.store.schedule=()=>{}")
def ok(name,value,detail=None):
    assert value,(name,detail)
    checks.append({'name':name,'passed':True,**({'detail':detail} if detail is not None else {})})
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(10000)
        boot(page)
        page.evaluate("async text=>{await conduit.openFile(new File([text],'interop.dxf'));}",(ROOT/'tests/fixtures/interop.dxf').read_text())
        page.wait_for_function('conduit.doc.entities.length===22');page.wait_for_timeout(150)
        ok('independent file imported through File/Blob worker',page.evaluate('conduit.doc.entities.length===22'))
        ok('import does not silently install 223 symbol masters',page.evaluate('Object.keys(conduit.doc.blocks).length<30'))
        ok('all four native layouts available in UI',page.locator('.layout-select option').count()==4)
        page.get_by_role('button',name='Export',exact=True).click()
        ok('binary export control exists',page.locator('[data-export="dxf-binary"]').count()==1)
        page.locator('#dxf-mode').select_option('preserve')
        ok('preserving mode disables version conversion',page.locator('#dxf-version').is_disabled())
        with page.expect_download() as info:page.locator('[data-export="dxf-binary"]').click()
        path=OUT/'browser-preserved-binary.dxf';info.value.save_as(str(path));data=path.read_bytes()
        ok('real browser download uses binary DXF signature',data.startswith(b'AutoCAD Binary DXF\r\n\x1a\0'))
        d=ezdxf.readfile(path);audit=d.audit();ok('download opens independently without audit repairs',not audit.errors and not audit.fixes)
        ok('download retains foreign XRECORD payload',d.rootdict.get('ACME_DATA') is not None)
        # Import the downloaded binary with the real File API, not only our own Node reader.
        page.evaluate("async values=>{await conduit.openFile(new File([new Uint8Array(values)],'interop-binary.dxf'));}",list(data))
        ok('binary download reimports through the worker without duplicate paper entities',page.evaluate('conduit.doc.entities.length===22 && conduit.doc.layouts.length===4'))
        page.evaluate('conduit.closeModal()')
        page.locator('.layout-select').select_option('Sheet B')
        page.wait_for_function('conduit.doc.activeLayout === "Sheet B" && !conduit.renderer.sceneDirty')
        ok('paper layout is actively rendered',page.evaluate('conduit.doc.activeLayout === "Sheet B" && conduit.renderer.scene.paths.some(p=>p.clips?.length)'))
        ok('paper layout label follows the selected sheet',page.locator('.view-label').inner_text()=='PAPER SPACE / Sheet B')
        page.screenshot(path=str(OUT/'interop-paper-layout.png'))
        ok('native dimension blocks do not expose stale raw grips',page.evaluate("conduit.grips(conduit.doc.entities.find(e=>e.type==='DIMENSION')).length===0"))
        # Isolated paper-space scene establishes precise, deterministic pixel probes.
        page.evaluate('''()=>{
            const d=conduit.doc;d.entities=[
             {id:'model',type:'LINE',layer:'0',layout:'Model',a:{x:-100,y:20},b:{x:100,y:20},color:'#0000ff',width:6},
             {id:'hidden',type:'LINE',layer:'Frozen',layout:'Model',a:{x:-100,y:0},b:{x:100,y:0},color:'#ff0000',width:6},
             {id:'vp',type:'VIEWPORT',layer:'0',layout:'Sheet B',c:{x:100,y:100},viewportWidth:80,viewportHeight:60,viewHeight:60,viewportId:2,viewDirection:{x:0,y:0,z:1},viewCenter:{x:0,y:0},viewTarget:{x:0,y:0},frozenLayers:['Frozen'],clipHandle:'CLIP'},
             {id:'clip',type:'LWPOLYLINE',layer:'0',layout:'Sheet B',closed:true,points:[{x:60,y:70},{x:140,y:70},{x:110,y:130},{x:90,y:130}],_dxf:{handle:'CLIP'}}
            ];conduit.selection.clear();conduit.cursor=null;conduit.renderer.grid=false;conduit.camera.x=100;conduit.camera.y=100;conduit.camera.scale=4;conduit.renderer.setDocument(d);
        }''');page.wait_for_timeout(120)
        def pixel(x,y):return page.evaluate('''([x,y])=>{const r=conduit.renderer,p=conduit.camera.screen({x,y});return [...r.ctx.getImageData(Math.round(p.x*r.dpr),Math.round(p.y*r.dpr),1,1).data];}''',[x,y])
        v=pixel(100,120);ok('viewport model stroke visible inside polygon',v[2]>245 and v[3]>245,v)
        v=pixel(135,120);ok('nonrectangular clip removes stroke inside rectangle but outside polygon',v[3]==0,v)
        v=pixel(40,120);ok('viewport rectangle removes out-of-frame model geometry',v[3]==0,v)
        v=pixel(100,100);ok('frozen layer does not draw into viewport',v[3]==0,v)
        ok('clipped-away geometry cannot be picked',page.evaluate('conduit.hitTest({x:135,y:120},1) === null'))
        ok('visible viewport geometry can be picked',page.evaluate('conduit.hitTest({x:100,y:120},1)?.id === "vp"'))
        with page.expect_download() as info:page.evaluate("conduit.doExport('svg')")
        path=OUT/'browser-paper.svg';info.value.save_as(str(path));ok('SVG download contains real clip paths','<clipPath' in path.read_text())
        # Native masking must cover only its normalized-image polygon.
        page.evaluate('''()=>{conduit.doc.activeLayout='Model';conduit.doc.entities=[
            {id:'line',type:'LINE',layer:'0',color:'#0000ff',width:8,a:{x:0,y:100},b:{x:200,y:100}},
            {id:'mask',type:'WIPEOUT',layer:'0',p:{x:80,y:80},uPixel:{x:40,y:0},vPixel:{x:0,y:40},imageSize:{x:1,y:1},boundaryType:2,boundary:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5},{x:-.5,y:.5}]}];conduit.renderer.setDocument(conduit.doc);}''');page.wait_for_timeout(120)
        v=pixel(100,100);ok('WIPEOUT covers earlier line with background mask',v[0]>240 and v[1]>240 and v[2]>240,v)
        v=pixel(60,100);ok('WIPEOUT leaves outside geometry visible',v[2]>245 and v[0]<5,v)
        context.close()
        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
        page=mobile.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        boot(page)
        page.get_by_role('button',name='Export',exact=True).tap()
        ok('mobile binary export remains reachable',page.locator('[data-export="dxf-binary"]').is_visible())
        ok('mobile export avoids horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.screenshot(path=str(OUT/'interop-mobile-export.png'))
        with page.expect_download() as info:page.locator('[data-export="dxf-binary"]').tap()
        path=OUT/'browser-mobile-binary.dxf';info.value.save_as(str(path));audit=ezdxf.readfile(path).audit()
        ok('touch-initiated binary download independently audits without repairs',not audit.errors and not audit.fixes)
        ok('no uncaught browser errors',not errors,errors)
        mobile.close();browser.close()
finally:server.shutdown();server.server_close();thread.join(timeout=3)
report={'checks':checks,'passed':len(checks),'errors':errors,'backend':'Canvas 2D','physicalDevice':False,'origin':'localhost' if LOCALHOST else 'opaque standalone with test-only memory store','downloads':'real browser downloads, independently parsed'}
(OUT/'browser-interop.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
