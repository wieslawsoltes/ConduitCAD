"""Shared mobile surfaces on phones, tablets, landscape and desktop. No physical-device claim.
CI uses localhost and real IndexedDB. The opaque-origin mode uses explicit in-memory Web Storage.
"""
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
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/?renderer=canvas&no-sw=1&fresh=1'
source=(ROOT/'dist/ConduitCAD.html').read_text()
memory='''for(const name of ['localStorage','sessionStorage']){const data=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size}}});}Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});'''
def ok(name,condition):
    assert condition,name
    checks.append({'name':name,'passed':True})
    print(name,flush=True)
def load(page):
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    if real_origin:page.goto(url)
    else:page.set_content(source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;','<script>'+memory+'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas'})"))
    page.wait_for_function('document.documentElement.dataset.ready==="true"')
    page.evaluate("conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer);clearTimeout(conduit.toastTimer);document.querySelector('.toast').classList.remove('show')")
def fit(page,selector):
    return page.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5}')
def dialog(page,action):
    page.evaluate('(action)=>conduit.action(action)',action)
    page.wait_for_selector('.modal')
    page.wait_for_timeout(50)

def check_dialog(page,label):
    ok(label+' dialog stays inside viewport',fit(page,'.modal'))
    ok(label+' form body does not overflow horizontally',page.locator('.modal-body').evaluate('(e)=>e.scrollWidth<=e.clientWidth+2'))
    ok(label+' modal makes underlying workspace inert',page.evaluate("conduit.$('.app').inert"))
    ok(label+' header and close remain reachable',fit(page,'.modal-head'))
    ok(label+' visible controls meet touch height',page.locator('.modal').evaluate("e=>[...e.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select')].filter(b=>b.getClientRects().length&&!b.closest('[hidden]')).every(b=>b.getBoundingClientRect().height>=43.5)"))
    page.locator('.modal-head [data-action=modal-close]').tap()
    ok(label+' closing restores non-modal workspace',page.evaluate("!conduit.$('.app').inert"))
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(844,390),(820,1180),(1024,768)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
        page=ctx.new_page();load(page)
        label=f'{width}x{height}'
        ok(label+' uses compact touch workspace',page.evaluate('conduit.isMobile()'))
        ok(label+' root has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        ok(label+' tool rail/dock is in viewport',fit(page,'.tool-dock'))
        ok(label+' canvas has useful height',page.locator('.viewport').bounding_box()['height']>220)
        page.evaluate("async()=>{for(let i=0;i<7;i++)await conduit.newDocument('blank');conduit.doc.name='Long multilingual engineering drawing — насосная станция';conduit.updateUI();}")
        page.wait_for_timeout(80)
        ok(label+' new active document tab is revealed',page.evaluate("()=>{const a=conduit.$('.document-tabs').getBoundingClientRect(),b=conduit.$('.document-tab-item.active').getBoundingClientRect();return b.left>=a.left-1&&b.right<=a.right+1;}"))
        ok(label+' document chrome has 44px targets',page.evaluate("[...conduit.$('.document-bar').querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=43.5)"))
        # A dirty/save-status re-render must not jump to a different part of the tab strip.
        page.evaluate("conduit.$('.document-tabs').scrollLeft=0;conduit.documentChanged()")
        page.wait_for_timeout(40)
        ok(label+' save status does not hijack tab scrolling',page.evaluate("conduit.$('.document-tabs').scrollLeft===0"))
        dialog(page,'document-list')
        ok(label+' opening chooser does not summon input focus',page.locator('.modal-head h2').evaluate('e=>e===document.activeElement'))
        ok(label+' document footer is outside scrolling body',page.locator('.modal-foot .document-list-footer').count()==1)
        check_dialog(page,label+' documents')
        page.evaluate("conduit.activateDocument(conduit.documents.sessions[0].id);conduit.renderer.fit();")
        page.wait_for_timeout(50)
        for action in ['more','export','parameters','solver-report','blocks','help','line-styles','precision']:
            dialog(page,action)
            check_dialog(page,label+' '+action)
        # Every inspector view uses the same safe scroll container.
        for view in ['properties','layers','qa']:
            page.evaluate('(view)=>{conduit.inspectorTab=view;conduit.openPanel("inspector");}',view)
            ok(label+' '+view+' sheet is bounded',fit(page,'.inspector.open'))
            ok(label+' '+view+' tab exposes selected state',page.locator(f'[data-inspector={view}]').get_attribute('aria-selected')=='true')
            page.evaluate('conduit.closePanels()')
        page.evaluate('conduit.openPanel("library")')
        ok(label+' library is bounded',fit(page,'.library.open'))
        if height>540:
            before=page.locator('.library').bounding_box()['height']
            page.locator('.library .sheet-handle').tap()
            ok(label+' sheet expands below actual chrome',page.locator('.library').bounding_box()['height']>=before and fit(page,'.library.open'))
        page.evaluate('conduit.closePanels()')
        page.evaluate("clearTimeout(conduit.toastTimer);conduit.$('.toast').classList.remove('show');")
        page.screenshot(path=str(OUT/f'mobile-ui-{width}-workspace.png'))
        ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=ctx.new_page();load(page)
    # Search covers quick tools and editing actions, not just the newer native tools.
    dialog(page,'more');page.locator('[data-drawing-search]').fill('block editor')
    ok('tool search includes shared block editing',page.locator('.modal [data-action=blocks]').is_visible())
    ok('tool search hides unrelated basic tools',page.locator('.modal [data-action=tool-line]').is_hidden())
    page.locator('[data-drawing-search]').fill('not-a-tool')
    ok('empty search has useful status',page.locator('.drawing-search-status').inner_text().startswith('No matching'))
    page.locator('[data-drawing-search]').fill('');page.screenshot(path=str(OUT/'mobile-ui-tools.png'))
    page.evaluate('conduit.closeModal()')
    # Dense specialist editors use the same mobile dialog contract, not just simple pickers.
    page.evaluate("conduit.executeCommand('LINE 0,0 100,0');conduit.selection=new Set([conduit.doc.entities.at(-1).id]);")
    dialog(page,'constraint');check_dialog(page,'constraint authoring')
    dialog(page,'calculated-text');check_dialog(page,'calculated annotation')
    page.evaluate("conduit.executeCommand('RECT 0 0 100 50');conduit.selection=new Set([conduit.doc.entities.at(-1).id]);")
    dialog(page,'native-vertices');check_dialog(page,'exact vertex editor')
    page.evaluate("conduit.action('dynamic-demo');conduit.beginBlockEdit(conduit.selected()[0].block);conduit.closePanels();")
    for action in ['block-settings','block-author','block-attribute','block-port','block-save-as']:
        dialog(page,action);check_dialog(page,action)
    ok('block editing chrome stays inside phone viewport',fit(page,'.block-editor-bar'))
    page.locator('.block-editor-bar>div').evaluate('e=>e.scrollLeft=e.scrollWidth')
    ok('all block actions remain horizontally reachable',page.locator('.block-editor-bar>div').evaluate('e=>e.scrollLeft>0'))
    page.evaluate("conduit.cancelBlockEdit();conduit.closePanels();conduit.doc.parameters={Width:'100',Height:'Width/2'};")
    dialog(page,'parameters')
    ok('parameter cards keep full expression font size',page.locator('.param-expression').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=16'))
    page.locator('.param-expression').first.fill('120');page.locator('.param-expression').first.dispatch_event('input')
    ok('mobile parameter form calculates without truncating values',page.locator('.param-row output').last.inner_text()=='60')
    ok('parameter remove buttons are 44 by 44',page.locator('.remove-param').first.evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44}'))
    page.screenshot(path=str(OUT/'mobile-ui-parameters.png'))
    page.locator('[data-action=modal-confirm]').tap();page.wait_for_function('conduit.doc.parameters.Width==="120"')
    ok('touch Apply preserves parameter expressions',page.evaluate('conduit.doc.parameters.Height==="Width/2"'))
    page.evaluate("conduit.openPanel('inspector')");page.locator('[data-inspector=layers]').tap()
    ok('touch inspector switching updates accessible tab selection',page.locator('[data-inspector=layers]').get_attribute('aria-selected')=='true')
    page.evaluate('conduit.closePanels()')
    page.evaluate("conduit.newDocument('blank')")
    first_id=page.evaluate('conduit.documents.sessions[0].id')
    dialog(page,'document-list')
    page.locator(f'[data-action="document-rename:{first_id}"]').tap()
    page.locator('[data-field=name]').fill('Touch renamed drawing')
    page.locator('[data-action=modal-confirm]').tap()
    page.wait_for_function('conduit.doc.name==="Touch renamed drawing"')
    ok('document manager renames drawing through history',page.evaluate('conduit.history.canUndo'))
    page.evaluate('conduit.history.undo()')
    ok('document rename can be undone',page.evaluate('conduit.doc.name!=="Touch renamed drawing"'))
    dialog(page,'document-list')
    page.locator(f'[data-action="document-reorder-right:{first_id}"]').tap()
    ok('touch document manager moves tabs right without changing identity',page.evaluate('(id)=>conduit.documents.sessions[1].id===id&&conduit.documents.activeId===id',first_id))
    page.evaluate('conduit.closeModal()')
    # Native tool registry is the same registry used by actual drawing sessions.
    ids=page.evaluate("()=>{conduit.moreDialog();return [...conduit.modal.querySelectorAll('[data-tool]')].map(e=>e.dataset.tool)}")
    page.evaluate('conduit.closeModal()')
    for tool in ids:
        page.evaluate('(tool)=>conduit.setTool(tool)',tool)
        ok('mobile active controls fit: '+tool,fit(page,'.drawing-session-controls'))
        ok('mobile active controls hide redundant zoom: '+tool,page.locator('.zoom-controls').is_hidden())
    page.evaluate("conduit.setTool('spline')")
    page.locator('[data-action=draw-exact-point]').tap()
    page.locator('[data-field=point]').fill('@25,10')
    page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>340});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,get:()=>24});visualViewport.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(80)
    ok('keyboard fits modal including viewport offset',page.locator('.modal').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=24&&r.bottom<=364;}'))
    ok('keyboard leaves exact coordinate expression intact',page.locator('[data-field=point]').input_value()=='@25,10')
    ok('keyboard keeps Apply and Cancel visible',fit(page,'.modal-foot'))
    ok('keyboard hides only drawing chrome',page.locator('.tool-dock').is_hidden())
    page.screenshot(path=str(OUT/'mobile-ui-keyboard.png'))
    page.evaluate("delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'))")
    page.locator('[data-action=modal-confirm]').tap()
    page.wait_for_function('conduit.draft.length===1')
    ok('exact entry applies once after keyboard resize',page.evaluate('conduit.draft[0].x===25&&conduit.draft[0].y===10'))
    page.evaluate("conduit.setTool('select')")
    # Confirmation is serialized even for touch double activation.
    page.evaluate("()=>{window.applied=0;conduit.openModal('Apply once','<input id=once value=1><div class=error-text></div>',{confirm:'Apply',onConfirm:async()=>{await new Promise(r=>setTimeout(r,70));window.applied++}});}")
    page.evaluate('Promise.all([conduit.modalConfirm(),conduit.modalConfirm()])')
    ok('double submit performs exactly one transaction',page.evaluate('applied===1'))
    page.locator('#once').focus();page.keyboard.press('Tab')
    page.keyboard.press('Tab');page.keyboard.press('Tab')
    ok('modal focus cycles without leaking into canvas',page.evaluate('conduit.modal.contains(document.activeElement)'))
    page.evaluate('conduit.closeModal()')
    page.evaluate("conduit.openPanel('library')")
    page.screenshot(path=str(OUT/'mobile-ui-library.png'));page.evaluate('conduit.closePanels()')
    # Long form plus tables, including all columns/controls, remain accessible via an explicit scroll region.
    page.evaluate("()=>{conduit.openModal('Exact controls','<table class=keyboard-table><tr>'+Array.from({length:8},(_,i)=>'<th>Coordinate '+i+'</th>').join('')+'</tr><tr>'+Array.from({length:8},(_,i)=>'<td><input aria-label=\"Coordinate '+i+'\" value=\"123456.789\"></td>').join('')+'</tr></table>',{confirm:'Apply'});}")
    ok('wide table has a labeled horizontal scrolling region',page.locator('.touch-table-region[role=region]').count()==1)
    ok('wide table does not cause dialog overflow',page.locator('.modal-body').evaluate('e=>e.scrollWidth<=e.clientWidth+2'))
    page.locator('.touch-table-region').evaluate('e=>e.scrollLeft=e.scrollWidth')
    ok('last table column can be reached by scrolling',page.locator('.touch-table-region').evaluate('e=>e.scrollLeft>0'))
    page.evaluate('conduit.closeModal()');ctx.close()
    # Desktop keeps permanent panels and manual activation; touch focus policy is not imposed on mouse UI.
    desk=browser.new_page(viewport={'width':1440,'height':960});load(desk)
    ok('desktop does not use compact mode',desk.evaluate('!conduit.isMobile()'))
    ok('desktop retains permanent library and inspector',desk.locator('.library').is_visible() and desk.locator('.inspector').is_visible())
    desk.evaluate('conduit.commandDialog()');desk.wait_for_timeout(60)
    ok('desktop command dialog focuses its input',desk.locator('#cad-command').evaluate('e=>e===document.activeElement'))
    ok('no uncaught JavaScript exceptions',not errors)
    browser.close()
finally:
 server.shutdown()
 (OUT/'browser-mobile-ui.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'origin':'localhost' if real_origin else 'opaque origin with explicit memory Web Storage','backend':'Canvas 2D','physicalDevice':False,'keyboard':'synthetic VisualViewport metrics'},indent=2))
print(json.dumps({'passed':len(checks),'errors':errors}))
