"""Icon/text presentation, semantics and real input. CI: localhost; local fallback: explicit memory adapter.
Screenshots validate layout, not physical devices, screen readers or GPU performance.
"""
import functools,http.server,json,os,shutil,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
checks=[];errors=[];real=os.environ.get('CONDUIT_TEST_ORIGIN')=='localhost'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/?renderer=canvas&renderer3d=canvas&fresh=1&no-sw=1'
source=(ROOT/'dist/ConduitCAD.html').read_text()
memory="""for(const name of ['localStorage','sessionStorage']){const data=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size}}});}Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});"""
def ok(name,value):
 assert value,name
 checks.append({'name':name,'passed':True});print(name,flush=True)
def load(page):
 page.on('pageerror',lambda e:errors.append(str(e)))
 if real:page.goto(url)
 else:page.set_content(source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;','<script>'+memory+'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas',backend3d:'canvas'})"))
 page.wait_for_function('document.documentElement.dataset.ready==="true"')
 page.evaluate("conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer);clearTimeout(conduit.toastTimer);document.querySelector('.toast').classList.remove('show')")
def bounded(page,selector):
 return page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-.6&&r.top>=-.6&&r.right<=innerWidth+.6&&r.bottom<=innerHeight+.6;}')
def hidden_label(page,selector):return page.locator(selector+' .command-label').evaluate("e=>getComputedStyle(e).position==='absolute'&&getComputedStyle(e).display!=='none'")
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  for width,height,touch in [(1728,1000,False),(320,568,True),(390,844,True),(844,390,True),(1024,768,True)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch,device_scale_factor=1)
   page=ctx.new_page();load(page);prefix=f'{width}x{height}'
   ok(prefix+' shell has only decorative unfocusable UI SVGs',page.evaluate("[...document.querySelectorAll('svg.icon')].every(e=>e.getAttribute('aria-hidden')==='true'&&e.getAttribute('focusable')==='false')"))
   ok(prefix+' every primary command is named and has an icon',page.evaluate("[...document.querySelectorAll('.tool-dock button,.workbar button,.appbar-actions button')].every(e=>e.querySelector('.icon')&&(e.getAttribute('aria-label')||e.textContent.trim()))"))
   page.evaluate("conduit.moreDialog()")
   ok(prefix+' drawing tool catalogue retains icons and visible names',page.locator('.modal [data-tool]').evaluate_all("es=>es.length>=28&&es.every(e=>e.querySelector('.icon')&&e.querySelector('.command-label')?.textContent.trim())"))
   page.locator('.modal [data-tool="spline"]').click()
   ok(prefix+' icon tool activation retains actual drawing behavior',page.evaluate("conduit.tool==='spline'&&conduit.drawingSession.tool.id==='spline'"))
   page.evaluate("conduit.setTool('select');conduit.closeModal()")
   page.evaluate("async()=>{await conduit.newDocument('3d:extrusion-study');await conduit.model3d.ready;conduit.selectEntity(conduit.doc.entities.find(e=>e.feature3d).id);conduit.model3d.renderer.fit();}")
   page.wait_for_timeout(80)
   ok(prefix+' feature timeline selection updates immediately',page.locator('.model3d-feature.active').count()==1)
   ok(prefix+' feature glyph reflects operation, not generic body',page.locator('.model3d-feature.active [data-icon="extrude"]').count()==1)
   ok(prefix+' native document title and 3D type stay visible',page.locator('.document-tab-item.active .document-tab-name').inner_text()=='Extrusion direction study' and page.locator('.document-tab-item.active [data-icon="file-3d"]').count()==1)
   ok(prefix+' root does not overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
   for selector in ['.model3d-views','.model3d-selection-tools','.model3d-dock','.model3d-timeline']:
    ok(prefix+' bounded '+selector,bounded(page,selector))
   if touch:
    ok(prefix+' compact camera caption remains in accessibility tree',hidden_label(page,'[data-action="3d-view-top"]'))
    ok(prefix+' touch command targets remain at least 44 pixels',page.locator('.model3d-views button,.model3d-selection-tools button,.model3d-dock button,.model3d-feature').evaluate_all("es=>es.every(e=>{const r=e.getBoundingClientRect();return r.height>=43.5&&r.width>=43.5;})"))
   page.locator('[data-action="3d-nav-toggle"]').click()
   ok(prefix+' state toggle changes both glyph and label',page.locator('[data-action="3d-nav-toggle"] [data-icon="pan"]').count()==1 and page.locator('[data-action="3d-nav-toggle"]').get_attribute('aria-pressed')=='true')
   page.locator('[data-action="3d-view-top"]').click()
   ok(prefix+' compact view button executes actual camera command',page.evaluate('conduit.model3d.camera.pitch>1.5'))
   page.evaluate("window.keptButton=document.querySelector('[data-action=\"3d-nav-toggle\"]');window.keptCaption=keptButton.querySelector('.command-label');window.keptGlyph=keptButton.querySelector('.icon');for(let i=0;i<5;i++)conduit.model3d.sync();")
   ok(prefix+' unchanged sync preserves button, caption and glyph nodes',page.evaluate("keptButton===document.querySelector('[data-action=\"3d-nav-toggle\"]')&&keptCaption===keptButton.querySelector('.command-label')&&keptGlyph===keptButton.querySelector('.icon')"))
   page.evaluate("conduit.iconography.setMode('compact')")
   ok(prefix+' explicit compact preference collapses only toolbar captions',hidden_label(page,'[data-action="3d-tools"]') and page.locator('.document-tab-name').first.is_visible())
   page.evaluate("conduit.model3d.operationDialog('hole')")
   ok(prefix+' hole dialog retains visible field captions and confirmation',page.locator('.modal .field-caption').count()>2 and page.locator('.modal-foot [data-action="modal-confirm"] .command-label').evaluate("e=>getComputedStyle(e).position!=='absolute'"))
   ok(prefix+' dialog and footer stay in viewport',bounded(page,'.modal') and bounded(page,'.modal-foot'))
   ok(prefix+' geometric property icons map to diameter',page.locator('.modal .field-caption [data-icon="diameter"]').count()>0)
   page.evaluate('conduit.closeModal();conduit.iconography.guide()')
   ok(prefix+' guide covers every registered glyph',page.locator('.icon-guide-item').count()==180)
   page.locator('[data-icon-search]').fill('counterbore')
   ok(prefix+' icon guide filters by meaningful glyph name',page.locator('.icon-guide-item:visible').count()==1 and page.locator('.icon-guide-item:visible [data-icon="counterbore"]').count()==1)
   page.locator('[data-icon-label-mode]').select_option('labels')
   page.evaluate('conduit.closeModal()')
   ok(prefix+' user can retain all toolbar captions',not hidden_label(page,'[data-action="3d-view-top"]'))
   ok(prefix+' label preference persisted separately from drawing',page.evaluate("localStorage.getItem('conduit-toolbar-labels')==='labels'&&!JSON.stringify(conduit.doc).includes('conduit-toolbar-labels')"))
   page.evaluate("conduit.iconography.setMode('auto');conduit.model3d.camera.view('iso');conduit.model3d.renderer.fit();conduit.iconography.hide()")
   page.wait_for_timeout(80);page.screenshot(path=str(OUT/f'icons-{width}-3d.png'))
   page.evaluate('conduit.model3d.toolsDialog()');page.wait_for_timeout(40)
   ok(prefix+' 3D tool catalogue has operation-specific glyphs',page.locator('.model3d-searchable [data-icon="hole"]').count()==1 and page.locator('.model3d-searchable [data-icon="extrude"]').count()==1)
   page.screenshot(path=str(OUT/f'icons-{width}-tools.png'))
   page.evaluate("conduit.closeModal();conduit.model3d.setActive(false);conduit.exportDialog()")
   ok(prefix+' format icons distinguish native, binary and image outputs',page.locator('[data-export="dxf"] [data-icon="file-cad"]').count()==1 and page.locator('[data-export="dxf-binary"] [data-icon="file-code"]').count()==1 and page.locator('[data-export="png"] [data-icon="file-image"]').count()==1)
   page.evaluate('conduit.closeModal()')
   if not touch:
    # One tooltip, preserving unrelated descriptions, Escape consumed before modal cancellation.
    page.evaluate("conduit.model3d.toolsDialog();window.tipOwner=document.querySelector('.modal [data-action=\"3d-op-extrude\"]');tipOwner.setAttribute('aria-describedby','existing-help');tipOwner.focus();")
    page.keyboard.press('Tab');page.keyboard.press('Shift+Tab');page.wait_for_selector('.command-tooltip')
    ok('keyboard focus opens a named accessible tooltip',page.locator('.command-tooltip').get_attribute('role')=='tooltip' and page.locator('.command-tooltip').inner_text()=='Extrude profile')
    ok('tooltip does not replace unrelated description references',page.evaluate("tipOwner.getAttribute('aria-describedby').includes('existing-help')"))
    page.evaluate('window.tipNode=document.querySelector(".command-tooltip");window.tipGlyph=tipOwner.querySelector(".icon");conduit.iconography.prepare(conduit.modal)')
    ok('repeated decoration does not duplicate tooltips or restore the suppressed native title',page.evaluate('tipNode===document.querySelector(".command-tooltip")&&tipGlyph===tipOwner.querySelector(".icon")&&!tipOwner.hasAttribute("title")&&document.querySelectorAll(".command-tooltip").length===1'))
    page.keyboard.press('Escape')
    ok('Escape dismisses tooltip but does not cancel its parent dialog',page.locator('.command-tooltip').count()==0 and page.locator('.modal').count()==1)
    ok('tooltip restores the native title and prior description',page.evaluate("tipOwner.title==='Extrude profile'&&tipOwner.getAttribute('aria-describedby')==='existing-help'"))
    page.keyboard.press('Escape');ok('second Escape closes the parent dialog',page.locator('.modal').count()==0)
    ok('unsupported label preferences reject without changing the active mode',page.evaluate("()=>{const mode=conduit.iconography.mode;try{conduit.iconography.setMode('unknown');return false;}catch(e){return e instanceof RangeError&&conduit.iconography.mode===mode;}}"))
    ok('storage denial cannot prevent label preference changes',page.evaluate("()=>{const old=Object.getOwnPropertyDescriptor(window,'localStorage');try{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Denied','SecurityError')}});conduit.iconography.setMode('labels');return conduit.iconography.mode==='labels';}finally{Object.defineProperty(window,'localStorage',old);conduit.iconography.setMode('auto');}}"))
   ctx.close()
  ok('no uncaught iconography JavaScript errors',not errors)
  browser.close()
finally:
 server.shutdown();(OUT/'iconography-browser.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'origin':'localhost' if real else 'opaque-memory-adapter','renderer':'canvas','physicalDevice':False},indent=2))
print(json.dumps({'passed':len(checks),'errors':errors}))
