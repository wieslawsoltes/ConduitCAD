"""Document lifecycle, recovery, shared block drafts and touch UI. Real IndexedDB in CI."""
import functools
import http.server
import json
import os
import shutil
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
checks, errors = [], []
real_origin = os.environ.get('CONDUIT_TEST_ORIGIN') == 'localhost'


def ok(name, value):
    assert value, name
    checks.append({'name': name, 'passed': True})
    print(name, flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/?renderer=canvas&no-sw=1'
source = (ROOT / 'dist/ConduitCAD.html').read_text()
# At opaque origins, run the real fallback store against explicit memory-backed Web Storage.
# No claim of IndexedDB validation is made by this local mode.
MEMORY = """(seed=>{
  for(const name of ['localStorage','sessionStorage']){
    const data=new Map(Object.entries(seed[name]||{}));
    const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),key:i=>[...data.keys()][i],clear:()=>data.clear(),get length(){return data.size}};
    Object.defineProperty(window,name,{configurable:true,value:storage});
  }
  Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
})(SEED);
"""


def load(page, fresh=False):
    if real_origin:
        page.goto(url + ('&fresh=1' if fresh else ''))
    else:
        seed = {} if fresh else page.evaluate("()=>Object.fromEntries(['localStorage','sessionStorage'].map(name=>[name,Object.fromEntries(Array.from({length:window[name].length},(_,i)=>{const k=window[name].key(i);return [k,window[name].getItem(k)]}))]))")
        # Same test process but a new document/global, with explicitly carried storage contents.
        page.goto('about:blank')
        script = MEMORY.replace('SEED', json.dumps(seed))
        page.set_content(source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;', '<script>' + script + 'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))", "mountWorkbench(document.getElementById('app'),{backend:'canvas'})"))
    try:
        page.wait_for_function('document.documentElement.dataset.ready === "true"')
    except Exception:
        print('STARTUP DIAGNOSTICS ' + json.dumps(page.evaluate("async()=>({ready:document.documentElement.dataset.ready,error:window.appError||null,mounted:!!window.conduit,key:window.conduit?.documents?.key,locks:await navigator.locks?.query?.(),text:document.body.innerText.slice(-2000)})")), flush=True)
        raise
    page.evaluate('conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer)')


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
        desktop = browser.new_context(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
        page = desktop.new_page()
        page.on('pageerror', lambda error: errors.append(getattr(error, 'stack', str(error))))
        page.on('dialog', lambda dialog: dialog.accept())
        load(page, fresh=True)
        ok('first drawing has one accessible selected document tab', page.locator('.document-tabs [role=tab][aria-selected=true]').count() == 1)
        first = page.evaluate('conduit.documents.activeId')
        page.evaluate("conduit.executeCommand('LINE 0,0 100,0');conduit.camera.x=41;conduit.camera.y=62;conduit.camera.scale=1.7;conduit.category='Electrical';conduit.gridSnap=false;conduit.selection=new Set([conduit.doc.entities.at(-1).id]);conduit.updateUI()")
        original_count = page.evaluate('conduit.doc.entities.length')
        page.locator('.document-new').click()
        page.locator('[data-demo=blank]').click()
        second = page.evaluate('conduit.documents.activeId')
        ok('New creates another tab without removing the previous drawing', page.evaluate('conduit.documents.sessions.length') == 2)
        ok('new drawing has independent empty undo history', page.evaluate('!conduit.history.canUndo && conduit.doc.entities.length===0'))
        page.evaluate("conduit.executeCommand('LINE 0,0 60,0');conduit.camera.x=700;conduit.camera.y=400;conduit.camera.scale=2.5;conduit.currentLayer='Electrical';conduit.inspectorTab='layers';conduit.setTool('arc');conduit.executeCommand('NEXT 0,0');conduit.executeCommand('NEXT 10,10');conduit.updateUI()")
        page.locator(f'[role=tab][data-document-id="{first}"]').click()
        ok('first tab retains its geometry and selection', page.evaluate(f'conduit.doc.entities.length==={original_count} && conduit.selection.size===1'))
        ok('view, library category and snapping restore independently', page.evaluate("conduit.camera.x===41 && conduit.camera.y===62 && conduit.camera.scale===1.7 && conduit.category==='Electrical' && !conduit.gridSnap"))
        page.evaluate('conduit.history.undo()')
        ok('undo only edits the active drawing', page.evaluate(f'conduit.doc.entities.length==={original_count - 1}'))
        page.locator(f'[role=tab][data-document-id="{second}"]').click()
        ok('other drawing and its independent undo history are intact', page.evaluate('conduit.doc.entities.length===1 && conduit.history.canUndo'))
        ok('accepted native command points resume on return to a tab', page.evaluate("conduit.tool==='arc' && conduit.drawingSession.points.length===2"))
        ok('second camera and active layer restore', page.evaluate("conduit.camera.x===700 && conduit.camera.scale===2.5 && conduit.currentLayer==='Electrical' && conduit.inspectorTab==='layers'"))
        page.evaluate("conduit.executeCommand('NEXT 20,0')")
        ok('resumed command completes in its owning document', page.evaluate("conduit.doc.entities.at(-1).type==='ARC' && conduit.doc.entities.length===2"))
        ok('single renderer retains only three canvas layers regardless of tab count', page.locator('.viewport canvas').count() == 3)
        # Keyboard manual activation preserves the active expensive CAD scene until Enter.
        page.locator(f'[role=tab][data-document-id="{second}"]').focus()
        page.keyboard.press('Home')
        ok('arrow/home navigation focuses tabs without activating expensive scenes', page.evaluate(f'conduit.documents.activeId==="{second}" && document.activeElement.dataset.documentId==="{first}"'))
        page.keyboard.press('Enter')
        ok('Enter activates a focused document tab', page.evaluate(f'conduit.documents.activeId==="{first}"'))
        # Independent block editing and scratch testing in each document.
        page.evaluate("""()=>{
          conduit.setTool('select');conduit.inspectorTab='properties';
          conduit.edit('Create shared test block',()=>{conduit.doc.blocks.Shared={name:'Shared',base:{x:0,y:0},entities:[{id:'edge',type:'LINE',layer:'0',a:{x:0,y:0},b:{x:100,y:0}}],ports:[]};conduit.doc.entities.push({id:'ref',type:'INSERT',block:'Shared',layer:'0',x:0,y:0,sx:1,sy:1});});
          conduit.beginBlockEdit('Shared');conduit.executeCommand('LINE 0,10 100,10');
        }""")
        ok('block editor is isolated inside its document tab', page.evaluate("!!conduit.blockSession && conduit.doc.entities.length===2"))
        page.locator(f'[role=tab][data-document-id="{second}"]').click()
        ok('switching away suspends the block authoring bar and draft', page.evaluate('!conduit.blockSession') and page.locator('.block-editor-bar').count() == 0)
        page.locator(f'[role=tab][data-document-id="{first}"]').click()
        ok('switching back restores block draft and its private history', page.evaluate('!!conduit.blockSession && conduit.doc.entities.length===2 && conduit.history.canUndo'))
        page.locator('[data-action=block-test]').click()
        page.locator(f'[role=tab][data-document-id="{second}"]').click()
        page.locator(f'[role=tab][data-document-id="{first}"]').click()
        ok('Test Block scratch state survives a document switch', page.evaluate('conduit.blockSession.testing===true'))
        page.locator('[data-action=block-test-close]').click()
        ok('returning from Test Block recovers the original draft', page.evaluate('!conduit.blockSession.testing && conduit.doc.entities.length===2'))
        page.locator('[data-action=block-save-close]').click()
        ok('shared master save is confined to its owning drawing', page.evaluate("conduit.doc.blocks.Shared.entities.length===2 && !conduit.blockSession"))
        page.evaluate("conduit.selection=new Set(['ref']);conduit.copySelection()")
        page.locator(f'[role=tab][data-document-id="{second}"]').click()
        page.evaluate("conduit.setTool('select');conduit.edit('Destination block',()=>{conduit.doc.blocks.Shared={name:'Shared',entities:[{type:'POINT',id:'point',p:{x:0,y:0}}],ports:[]}});conduit.pasteSelection()")
        ok('cross-document paste never overwrites colliding block definitions', page.evaluate("conduit.doc.blocks.Shared.entities[0].type==='POINT' && conduit.selected()[0].block==='Shared_copy1' && conduit.doc.blocks.Shared_copy1.entities.length===2"))
        page.locator(f'[role=tab][data-document-id="{first}"]').click()
        page.evaluate("conduit.beginBlockEdit('Shared');conduit.executeCommand('LINE 0,20 100,20')")
        # Save/reload exercises actual database persistence in CI; fallback serialization locally.
        page.evaluate('conduit.saveAllDocuments()')
        ok('save all marks every captured document revision as saved', page.evaluate('!conduit.documents.dirty'))
        page.evaluate("conduit.camera.x=55;conduit.camera.y=66;conduit.camera.scale=3;conduit.saveAllDocuments()")
        load(page)
        ok('reload restores every open drawing and active tab order', page.evaluate(f'conduit.documents.sessions.length===2 && conduit.documents.sessions[0].id==="{first}" && conduit.documents.activeId==="{first}"'))
        ok('reload restores an uncommitted block draft without changing its master', page.evaluate('!!conduit.blockSession && conduit.doc.entities.length===3 && conduit.blockSession.parentDocument.blocks.Shared.entities.length===2'))
        ok('recovered draft has restored camera and clean new undo history', page.evaluate('conduit.camera.x===55 && conduit.camera.scale===3 && !conduit.history.canUndo'))
        page.evaluate('conduit.cancelBlockEdit()')
        # Closing must not throw away state when a checkpoint fails.
        page.evaluate("conduit.edit('Rename',()=>conduit.doc.name='Unsaved drawing')")
        page.locator(f'.document-tab-close[data-document-id="{first}"]').click()
        ok('unsaved close presents explicit save, discard and cancel choices', page.locator('.document-close-actions button').count() == 3)
        page.locator('.document-close-actions [data-action=modal-close]').click()
        ok('Cancel close leaves the same document active', page.evaluate(f'conduit.documents.activeId==="{first}"'))
        page.evaluate("()=>{window.originalCheckpoint=conduit.store.saveWorkspace.bind(conduit.store);conduit.store.saveWorkspace=async()=>{throw new Error('Injected quota failure')};} ")
        page.locator(f'.document-tab-close[data-document-id="{first}"]').click()
        page.locator(f'[data-action="document-close-save:{first}"]').click()
        page.wait_for_function('!!conduit.documents.error')
        ok('failed save-and-close retains the drawing and dirty status', page.evaluate(f'conduit.documents.sessions.length===2 && conduit.documents.activeId==="{first}" && conduit.documents.dirty'))
        ok('save failure keeps the close dialog available for retry', page.locator('.document-close-actions').count() == 1)
        page.evaluate('()=>{conduit.store.saveWorkspace=originalCheckpoint;}')
        page.locator(f'[data-action="document-close-save:{first}"]').click()
        page.wait_for_function('conduit.documents.sessions.length===1')
        ok('successful save-and-close selects the surviving tab', page.evaluate(f'conduit.documents.activeId==="{second}"'))
        page.locator('[data-action=document-list]').click()
        page.locator('.document-recent summary').click()
        page.locator(f'[data-action="document-reopen:{first}"]').click()
        # Reopening reads IndexedDB asynchronously; click completion is not read completion.
        page.wait_for_function('(id)=>conduit.documents.activeId===id', arg=first)
        ok('recently closed saved drawing can be reopened without losing its geometry', page.evaluate(f'conduit.documents.activeId==="{first}" && conduit.doc.name==="Unsaved drawing"'))
        page.locator('[data-action=document-list]').click()
        page.locator('#document-search').fill('not-found-name')
        ok('document switcher filters without deleting hidden sessions', page.locator('.document-list section:visible').count() == 0 and page.evaluate('conduit.documents.sessions.length') == 2)
        page.locator('#document-search').fill('')
        page.locator(f'[data-action="document-duplicate:{first}"]').click()
        duplicate = page.evaluate('conduit.documents.activeId')
        ok('Duplicate opens an independent drawing rather than shared mutable model data', page.evaluate(f'conduit.documents.sessions.length===3 && conduit.documents.activeId!=="{first}" && conduit.doc!==conduit.documents.get("{first}").document'))
        # Real File input batches use worker-based DXF import and project JSON validation.
        page.locator('.file-input').set_input_files([
            {'name': 'batch-one.dxf', 'mimeType': 'application/dxf', 'buffer': b'0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n10\n21\n0\n0\nENDSEC\n0\nEOF\n'},
            {'name': 'broken.json', 'mimeType': 'application/json', 'buffer': b'{not json'},
            {'name': 'batch-two.dxf', 'mimeType': 'application/dxf', 'buffer': b'0\nSECTION\n2\nENTITIES\n0\nCIRCLE\n8\n0\n10\n0\n20\n0\n40\n10\n0\nENDSEC\n0\nEOF\n'}
        ])
        page.evaluate('conduit.documentImportQueue')
        ok('batch imports are ordered and invalid files do not discard successful tabs', page.evaluate("conduit.documents.sessions.slice(-2).map(s=>s.document.name).join()==='batch-one,batch-two' && conduit.documents.sessions.length===5"))
        ok('file-import tabs retain native DXF entity types', page.evaluate("conduit.documents.sessions.at(-2).document.entities[0].type==='LINE' && conduit.doc.entities[0].type==='CIRCLE'"))
        page.locator('[data-action=document-list]').click()
        page.locator(f'[data-action="document-reorder:{duplicate}"]').click()
        ok('reordering tabs preserves active drawing identity', page.evaluate(f'conduit.documents.sessions[1].id==="{duplicate}" && conduit.doc.name==="batch-two"'))
        page.locator('[data-action=modal-close]').click()
        page.evaluate('conduit.saveAllDocuments()')
        with page.expect_download() as download:
            page.evaluate("conduit.doExport('project')")
        path = OUT / 'workspace-active-download.conduit.json'
        download.value.save_as(path)
        ok('export downloads only the active document, not a workspace wrapper', json.loads(path.read_text())['entities'][0]['type'] == 'CIRCLE')
        page.screenshot(path=str(OUT / 'workspace-desktop.png'))
        # Pointer-coarse mobile contexts are tested separately, not just CSS resize.
        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        phone = mobile.new_page(); phone.on('pageerror', lambda e: errors.append(getattr(e, 'stack', str(e)))); phone.on('dialog', lambda d:d.accept())
        load(phone, fresh=True)
        phone.evaluate("async()=>{await conduit.newDocument('blank');await conduit.newDocument('electrical');conduit.renderer.fit();conduit.toastTimer&&clearTimeout(conduit.toastTimer);document.querySelector('.toast').classList.remove('show');}")
        ok('mobile tabs and document management have at least 44px targets', phone.evaluate("[...document.querySelectorAll('.document-bar button')].every(b=>b.getBoundingClientRect().height>=44)"))
        ok('mobile workspace has no horizontal document overflow', phone.evaluate('document.documentElement.scrollWidth===innerWidth'))
        ok('mobile removes redundant workspace mode bar for canvas space', phone.locator('.workbar').is_hidden())
        ok('portrait canvas retains useful height with document tabs visible', phone.locator('.viewport').bounding_box()['height'] > 530)
        phone.locator('.tool-dock [data-action=toggle-library]').tap()
        ok('mobile library opens with reachable sheet expansion handle', phone.locator('.library.open .sheet-handle').is_visible())
        before = phone.locator('.library').bounding_box()['height']
        phone.locator('.library .sheet-handle').tap()
        ok('sheet expansion increases usable symbol-library height', phone.locator('.library').bounding_box()['height'] > before)
        phone.locator('.library .panel-heading [data-action=toggle-library]').tap()
        ok('hidden sheets cannot receive keyboard focus', phone.evaluate('document.querySelector(".library").inert'))
        phone.locator('[data-action=document-list]').tap()
        ok('mobile document switcher lists all open drawings', phone.locator('.document-list section').count() == 3)
        ok('mobile document switcher fits its visual viewport', phone.locator('.modal').bounding_box()['width'] <= 390)
        phone.screenshot(path=str(OUT / 'workspace-mobile-switcher.png'))
        phone.locator('[data-action=modal-close]').tap()
        phone.locator('.document-tabs [role=tab]').first.tap()
        ok('touch activates another document tab', phone.evaluate('conduit.documents.activeId===conduit.documents.sessions[0].id'))
        phone.evaluate("conduit.renderer.fit();document.querySelector('.toast').classList.remove('show')")
        phone.screenshot(path=str(OUT / 'workspace-mobile.png'))
        phone.set_viewport_size({'width': 844, 'height': 390})
        phone.wait_for_timeout(100)
        ok('landscape uses a compact scrollable tool rail with reachable symbol controls', phone.locator('.tool-dock [data-action=toggle-library]').is_visible())
        ok('landscape tabs and canvas remain within horizontal viewport', phone.evaluate('document.documentElement.scrollWidth===innerWidth') and phone.locator('.viewport').bounding_box()['height'] > 180)
        phone.locator('.tool-dock [data-action=toggle-inspector]').tap()
        ok('landscape properties use a side sheet without replacing the document tab bar', phone.locator('.inspector').bounding_box()['width'] <= 370 and phone.locator('.document-bar').is_visible())
        phone.screenshot(path=str(OUT / 'workspace-landscape.png'))
        phone.evaluate('conduit.closePanels()')
        phone.set_viewport_size({'width': 320, 'height': 640})
        phone.wait_for_timeout(100)
        ok('narrow 320px mobile layout stays within viewport', phone.evaluate('document.documentElement.scrollWidth===innerWidth'))
        ok('narrow mobile primary tools retain 44px targets', phone.evaluate("[...document.querySelectorAll('.tool-dock button')].filter(b=>b.offsetParent!==null).every(b=>b.getBoundingClientRect().width>=44)"))
        # Deterministic keyboard simulation tests VisualViewport handling, not a real device IME.
        phone.locator('[data-action=document-list]').tap()
        phone.locator('#document-search').focus()
        phone.wait_for_timeout(60)
        ok('delayed modal autofocus does not steal an already-focused text field', phone.evaluate("document.activeElement.id==='document-search'"))
        phone.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>330});visualViewport.dispatchEvent(new Event('resize'))")
        ok('visual keyboard resize constrains the mobile modal height', phone.locator('.modal').bounding_box()['height'] <= 330)
        ok('keyboard mode hides canvas-only tool chrome', phone.locator('.tool-dock').is_hidden())
        phone.evaluate("delete visualViewport.height;document.activeElement.blur();visualViewport.dispatchEvent(new Event('resize'))")
        phone.locator('[data-action=modal-close]').tap()
        ok('no uncaught JavaScript errors', not errors)
        if real_origin:
            ok('CI storage path actually uses IndexedDB', page.evaluate('async()=>!!(await conduit.store.ready)'))
            page.evaluate('conduit.saveAllDocuments()')
            original_key = page.evaluate('conduit.documents.key')
            other = page.context.new_page()
            other.on('pageerror', lambda e: errors.append(getattr(e, 'stack', str(e))))
            other.add_init_script('sessionStorage.setItem("conduit-workspace-id",' + json.dumps(original_key) + ')')
            load(other)
            other_key = other.evaluate('conduit.documents.key')
            ok('duplicated browser page forks a live recovery namespace', other_key != original_key)
            ok('forked page recovers the same open drawing set without clearing its source', other.evaluate('conduit.documents.sessions.length') == page.evaluate('conduit.documents.sessions.length'))
            other.evaluate("async()=>{conduit.edit('Independent window rename',()=>conduit.doc.name='Other browser window');await conduit.saveAllDocuments();}")
            ok('independent page saves do not overwrite the original recovery records', page.evaluate("async()=>{const saved=await conduit.store.loadWorkspace(conduit.documents.key);return saved.records.find(r=>r.id===saved.manifest.activeId).document.name==='batch-two';}"))
            nested = page.context.new_page()
            nested.on('pageerror', lambda e: errors.append(getattr(e, 'stack', str(e))))
            nested.add_init_script('sessionStorage.setItem("conduit-workspace-id",' + json.dumps(other_key) + ')')
            load(nested)
            ok('duplicating an already-forked browser page still acquires a new namespace', nested.evaluate('conduit.documents.key') not in [original_key, other_key])
            nested.evaluate('conduit.dispose()'); nested.close()
            other.evaluate('conduit.dispose()'); other.close()
            ok('all real-origin document pages complete without JavaScript exceptions', not errors)

        browser.close()
finally:
    server.shutdown()
    (OUT / 'browser-documents.json').write_text(json.dumps({ 'checks':checks, 'passed':len(checks), 'errors':errors, 'backend':'Canvas 2D', 'physicalDevice':False, 'origin':'localhost' if real_origin else 'standalone opaque origin', 'storage':'real IndexedDB' if real_origin else 'real fallback serializer over test memory Web Storage', 'keyboard':'synthetic VisualViewport event' }, indent=2))
print(json.dumps({'passed':len(checks),'errors':errors}))
