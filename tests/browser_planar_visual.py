"""Default 2D visual editing and 3D inspection with real browser pointer/form input.
Production standalone; explicitly declared memory storage on opaque local origin.
CI selects localhost. Test fixture setup is direct; edits and downloads are real UI.
"""
import json, os, math
from playwright.sync_api import sync_playwright
from render_support import Harness, launch, OUT, NATIVE, bounded
checks=[];errors=[];h=Harness();BACKEND=os.environ.get('PLANAR_TEST_BACKEND','canvas')
def ok(name,value):
 assert value,name
 checks.append({'name':name,'passed':True});print(name,flush=True)
def ev(p,s,arg=None):return p.evaluate(s,arg)
def wait(p):
 p.wait_for_timeout(40)
 p.wait_for_function("(!conduit.visual2d?.active||!conduit.visual2d.frame)&&(!conduit.model3d.inspection?.active||!conduit.model3d.inspection.frame)",timeout=15000)
def action(p,a):ev(p,'a=>conduit.action(a)',a);wait(p)
def field(p,key,value,accept=True):
 # Open actual matching field buttons; large control collections use the searchable value panel.
 loc=p.locator(f'.planar-fields [data-planar-field="{key}"]')
 if not loc.count():
  if p.locator('.planar-options').is_hidden():p.locator('[data-planar-command=options]').click()
  p.locator('.planar-value-search').fill('')
  loc=p.locator(f'.planar-options [data-planar-field="{key}"]')
 loc.scroll_into_view_if_needed();loc.click();inp=p.locator('.planar-entry label').locator('input,textarea,select')
 if inp.evaluate('e=>e.tagName')=='SELECT':
  opts=ev(p,'key=>conduit.visual2d.session.field(key).options',key);inp.select_option(str(opts.index(value)))
 else:inp.fill(str(value))
 wait(p)
 if accept:p.locator('.planar-entry [type=submit]').click();wait(p)
def apply(p):
 p.locator('[data-planar-command=apply]').click();wait(p)
 assert not ev(p,'conduit.visual2d.active'),p.locator('.planar-error').inner_text()
def cancel(p):
 if ev(p,'conduit.visual2d.active'):p.locator('[data-planar-command=cancel]').click();wait(p)
def fixture(p,entities,selected=None,extra=None):
 cancel(p)
 ev(p,"args=>{const w=conduit;w.model3d.inspection.cancel();w.model3d.visual.cancel();w.closeModal();w.visual2d.panel.close();w.model3d.setActive(false);w.setTool('select');w.doc.entities=args.entities;w.doc.constraints=[];w.doc.parameters.Width='100';Object.assign(w.doc,args.extra||{});w.selection=new Set(args.selected||args.entities.map(e=>e.id));w.history.clear();w.touch();w.camera.x=50;w.camera.y=25;w.camera.scale=2;w.updateUI();w.renderer.invalidate();}",{'entities':entities,'selected':selected,'extra':extra});wait(p)
def start(p,op='geometry'):
 action(p,'2d-visual-'+op);p.wait_for_function('conduit.visual2d.session && conduit.visual2d.session.preview');wait(p)
def drag(p,key,dx,dy,touch=False):
 data=ev(p,"key=>{const h=conduit.visual2d.hitHandles.find(h=>h.id===key),r=conduit.$('.viewport').getBoundingClientRect();if(!h)throw new Error('Missing handle '+key);return{x:r.x+h.x,y:r.y+h.y,scale:conduit.camera.scale}}",key)
 x,y=data['x'],data['y'];ex,ey=x+dx*data['scale'],y-dy*data['scale']
 if touch:
  cdp=p.context.new_cdp_session(p)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
  for i in range(1,6):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(ex-x)*i/5,'y':y+(ey-y)*i/5,'id':1}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cdp.detach()
 else:p.mouse.move(x,y);p.mouse.down();p.mouse.move(ex,ey,steps=5);p.mouse.up()
 wait(p)
def pt(x,y,z=None):return {'x':x,'y':y,**({'z':z} if z is not None else {})}
def line(id='edge',a=None,b=None):return {'id':id,'type':'LINE','layer':'0','a':a or pt(0,0),'b':b or pt(100,0)}
def circle(id='round'):return {'id':id,'type':'CIRCLE','layer':'0','c':pt(50,30),'r':25}
def unchanged(p,before):return ev(p,'JSON.stringify(conduit.doc)')==before
def download(p,name):
 for fmt,suffix in [('dxf','ascii'),('dxf-binary','binary')]:
  with p.expect_download() as d:ev(p,'fmt=>conduit.doExport(fmt)',fmt)
  path=OUT/f'planar-{BACKEND}-{name}-{suffix}.dxf';d.value.save_as(str(path));ok(name+' actual '+suffix+' DXF download',path.stat().st_size>100)
def panelVisible(p):return p.locator('.inspect3d-panel').is_visible()
def mesh(p):
 cancel(p);action(p,'3d-example:primitives');ev(p,"()=>{const m=conduit.model3d;m.renderer.section=null;const e=conduit.doc.entities.find(e=>e.type==='MESH'&&!e.model3dConsumed);conduit.selection=new Set([e.id]);m.camera.view('iso');m.renderer.fit();conduit.updateSelection();}");wait(p)
def picked_point(p):
 return ev(p,"()=>{const m=conduit.model3d,r=m.host.getBoundingClientRect();for(let y=130;y<m.camera.pixelHeight-140;y+=12)for(let x=80;x<m.camera.width-80;x+=12){const hit=m.renderer.pick(x,y,{mode:'body'});if(hit)return{x:r.x+x,y:r.y+y,point:hit.point};}throw new Error('No geometry to pick');}")
try:
 with sync_playwright() as driver:
  browser=launch(driver);ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));h.load(p,BACKEND)
  ev(p,"async()=>{await conduit.newDocument('blank');conduit.model3d.setActive(false)}")
  ok('default planar and spatial inspection need no compatibility flags',ev(p,'conduit.options.drawingInteraction===undefined&&conduit.options.modelingInteraction===undefined'))
  fixture(p,[line()]);before=ev(p,'JSON.stringify(conduit.doc)');start(p)
  ok('2D native edit is non-modal',p.locator('.modal').count()==0 and p.locator('.planar-controls').is_visible())
  ok('preview and real document are different objects',ev(p,'conduit.visual2d.session.preview!==conduit.doc&&conduit.renderer.doc!==conduit.doc'))
  drag(p,'end',20,10)
  ok('actual endpoint pointer drag changes native preview',ev(p,"Math.abs(conduit.visual2d.session.preview.entities[0].b.x-120)<.01&&Math.abs(conduit.visual2d.session.preview.entities[0].b.y-10)<.01"))
  ok('drag is isolated from real document/history',unchanged(p,before) and ev(p,'conduit.history.undoStack.length===0'))
  p.locator('[data-planar-command=undo]').click();wait(p);ok('Undo draft restores preview endpoint',ev(p,'conduit.visual2d.session.preview.entities[0].b.x===100'))
  p.locator('[data-planar-command=redo]').click();wait(p);ok('Redo draft replays endpoint',ev(p,'Math.abs(conduit.visual2d.session.preview.entities[0].b.x-120)<.01'))
  field(p,'length','Width * 1.5');ok('length expression evaluated live',ev(p,'conduit.visual2d.session.value("length")===150'))
  field(p,'angle','30');p.screenshot(path=str(OUT/f'planar-{BACKEND}-desktop.png'));apply(p)
  ok('Apply is one real history transaction',ev(p,'conduit.history.undoStack.length===1'))
  ok('length formula persists on native LINE',ev(p,"conduit.doc.entities[0].parametric.length==='Width * 1.5'"))
  action(p,'undo');ok('drawing undo restores original native geometry',ev(p,'conduit.doc.entities[0].b.x===100&&conduit.doc.entities[0].b.y===0'));action(p,'redo')
  download(p,'line')
  start(p);n=ev(p,'conduit.history.undoStack.length');apply(p);ok('unchanged geometry apply produces no undo record',ev(p,'conduit.history.undoStack.length')==n)
  fixture(p,[circle()]);before=ev(p,'JSON.stringify(conduit.doc)');start(p);field(p,'radius','Width / 2',False)
  ok('numeric typing creates actual native circle preview',ev(p,'conduit.visual2d.session.preview.entities[0].r===50'))
  p.locator('.planar-entry input').fill('-20');wait(p)
  ok('invalid radius clears preview and disables Apply',ev(p,'!conduit.visual2d.session.preview') and p.locator('[data-planar-command=apply]').is_disabled())
  ok('invalid exact input is marked and source unchanged',p.locator('.planar-entry input').get_attribute('aria-invalid')=='true' and unchanged(p,before))
  p.locator('.planar-entry input').fill('1'*16001);wait(p);ok('oversized input cannot apply a stale valid value',p.locator('[data-planar-command=apply]').is_disabled());p.locator('.planar-entry [type=submit]').click();wait(p);ok('Keep value rejects oversized input',p.locator('.planar-entry').is_visible() and unchanged(p,before));p.locator('.planar-entry [data-planar-command=entry-cancel]').click();wait(p);ok('Revert value restores last exact state',ev(p,'conduit.visual2d.session.preview.entities[0].r===25'))
  field(p,'radius','Width/2');drag(p,'radius',10,0);ok('radius drag retains named expression',ev(p,'conduit.visual2d.session.parameters.radius.includes("Width")&&conduit.visual2d.session.value("radius")===60'))
  apply(p);download(p,'circle')
  # 3 point arc angles and exact ellipse dimensions are native, not polyline substitutes.
  for e,f,v,key in [({'id':'arc','type':'ARC','c':pt(40,25),'r':25,'start':0,'end':math.pi,'layer':'0'},'start','45','start'),({'id':'ellipse','type':'ELLIPSE','c':pt(40,25),'major':pt(35,0),'ratio':.5,'start':0,'end':2*math.pi,'layer':'0'},'minorRadius','25','ratio')]:
   fixture(p,[e]);start(p);field(p,f,v);ok(e['type']+' has valid native preview',ev(p,'!!conduit.visual2d.session.preview'));apply(p);ok(e['type']+' retains native type',ev(p,'conduit.doc.entities[0].type')==e['type'])
  # Invalid angle gestures must not permit keyboard Apply of the preceding valid radius.
  fixture(p,[{'id':'arc','type':'ARC','c':pt(40,25),'r':25,'start':0,'end':math.pi,'layer':'0'}]);before=ev(p,'JSON.stringify(conduit.doc)');start(p);field(p,'radius','30');drag(p,'start',-30,0)
  ok('angle handle at its center invalidates the complete draft',ev(p,'!conduit.visual2d.session.preview') and p.locator('[data-planar-command=apply]').is_disabled())
  p.locator('.viewport').focus();p.keyboard.press('Enter');wait(p);ok('keyboard Apply cannot resurrect a pre-error geometry preview',unchanged(p,before) and ev(p,'conduit.visual2d.active'));cancel(p)
  # Spline, faces and polyline/control editing
  for e,f,val in [({'id':'s','type':'SPLINE','degree':2,'knots':[0,0,0,1,1,1],'weights':[1,.8,1],'controlPoints':[pt(0,0),pt(50,50),pt(100,0)],'layer':'0'},'v1y','70'),({'id':'p','type':'LWPOLYLINE','points':[pt(0,0),pt(80,0),pt(80,60),pt(0,60)],'closed':True,'layer':'0'},'v1b','0.2'),({'id':'h','type':'HATCH','solid':True,'loops':[{'points':[pt(0,0),pt(100,0),pt(100,60),pt(0,60)],'closed':True}],'layer':'0'},'h0v2y','80')]:
   fixture(p,[e]);start(p);field(p,f,val);ok(e['type']+' exact native controls preview',ev(p,'!!conduit.visual2d.session.preview'));apply(p);ok(e['type']+' is not flattened',ev(p,'conduit.doc.entities[0].type')==e['type'])
   if e['type']=='SPLINE':ok('rational spline weights retained',ev(p,'conduit.doc.entities[0].weights[1]===.8'))
   download(p,e['type'].lower())
  # Text editing is visible on the model before Apply.
  for typ in ['TEXT','MTEXT']:
   fixture(p,[{'id':'text','type':typ,'p':pt(0,20),'text':'Original','height':12,'mtextWidth':100,'layer':'0'}]);before=ev(p,'JSON.stringify(conduit.doc)');start(p);field(p,'text','Flow label\nSecond line' if typ=='MTEXT' else 'Flow label',False)
   ok(typ+' typing updates preview not document',ev(p,'conduit.visual2d.session.preview.entities[0].text.includes("Flow label")') and unchanged(p,before))
   p.locator('.planar-entry [type=submit]').click();field(p,'height',16);apply(p);ok(typ+' keeps native text and height',ev(p,'conduit.doc.entities[0].height===16'));download(p,typ.lower())
  # Real dimension creation, native text and offset handles
  fixture(p,[]);ev(p,"conduit.executeCommand('DIMHORIZONTAL 0,0 100,40 0,80')");start(p);field(p,'offset','100');field(p,'dimtxt',8);field(p,'text','<> mm');drag(p,'textMidpoint',5,5)
  ok('managed dimension picture regenerates without flattening',ev(p,'!!conduit.visual2d.session.preview&&conduit.visual2d.session.preview.entities[0].type==="DIMENSION"'));apply(p);download(p,'dimension')
  # Existing driving relation is edited rather than fought by the solver.
  fixture(p,[line()],extra={'constraints':[{'id':'len','type':'length','entityId':'edge','value':'100'}]});start(p);field(p,'length','Width*2');ok('driving constraint updated only in preview',ev(p,'conduit.visual2d.session.preview.constraints[0].value==="Width*2"&&conduit.doc.constraints[0].value==="100"'));apply(p)
  ok('solver-produced line length is 200',ev(p,'Math.abs(Math.hypot(conduit.doc.entities[0].b.x-conduit.doc.entities[0].a.x,conduit.doc.entities[0].b.y-conduit.doc.entities[0].a.y)-200)<1e-6'))
  # Shared block editor uses its existing independent draft and history.
  fixture(p,[{'id':'ins','type':'INSERT','block':'Test','x':0,'y':0,'sx':1,'sy':1,'rotation':0,'layer':'0'}],extra={'blocks':{'Test':{'name':'Test','base':pt(0,0),'entities':[line('block-edge')],'ports':[]}}})
  ev(p,"conduit.beginBlockEdit('Test');conduit.selection=new Set(['block-edge']);conduit.updateSelection()");start(p);field(p,'length',150);apply(p)
  ok('visual edit works inside isolated block geometry',ev(p,'conduit.doc.entities[0].b.x===150'))
  ev(p,'conduit.saveBlockEdit(true)');ok('shared definition updates after parent Save',ev(p,"conduit.doc.blocks.Test.entities[0].b.x===150"))
  action(p,'planar-example');ok('visual workshop opens an independent native drawing',ev(p,'conduit.doc.name==="Visual drafting workshop"&&conduit.doc.entities.length===15'))
  ev(p,"conduit.selectEntity('adjustable-bar');conduit.renderer.fit()");start(p);field(p,'dynamic:Length',110);drag(p,'dyn:Length',10*math.cos(math.pi/12),10*math.sin(math.pi/12));apply(p)
  ok('native dynamic grip edits through rotated block coordinates',ev(p,'conduit.selected()[0].dynamicParameters.Length===120'))
  # Transform and modify commands are previews, not parameter dialogs.
  for op,f,v in [('move','dx',25),('rotate','angle',45),('scale','factor',2),('offset','amount',15)]:
   fixture(p,[line()]);before=ev(p,'JSON.stringify(conduit.doc)');start(p,op);field(p,f,v);field(p,'copy',True)
   ok(op+' native copy preview isolated',unchanged(p,before) and ev(p,'conduit.visual2d.session.preview.entities.length===2'));apply(p);ok(op+' Apply creates unique stable native IDs',ev(p,'conduit.doc.entities.length===2&&new Set(conduit.doc.entities.map(e=>e.id)).size===2'))
  fixture(p,[line('a'),line('b',pt(0,0),pt(0,100))]);start(p,'fillet');field(p,'radius',15);apply(p);ok('fillet produces native ARC and trimmed lines',ev(p,'conduit.doc.entities.length===3&&conduit.doc.entities.at(-1).type==="ARC"'));download(p,'fillet')
  # Palettes and precise creation are non-modal.
  fixture(p,[]);action(p,'more');ok('More is a non-modal drawing palette',p.locator('.planar-tool-panel').is_visible() and p.locator('.modal').count()==0)
  p.locator('.planar-tool-panel [data-drawing-search]').fill('ellipse');ok('search filters actual tools',p.locator('.planar-tool-panel [data-tool-search]:visible').count()>=1)
  p.locator('.planar-tool-panel [data-drawing-search]').fill('polygon');p.locator('.planar-tool-panel [data-tool=polygon]').click();wait(p)
  ok('polygon options remain non-modal',p.locator('[data-draw-setting=sides]').is_visible() and p.locator('.modal').count()==0)
  p.locator('[data-draw-setting=sides]').fill('2');p.locator('[data-draw-setting=sides]').press('Tab');wait(p)
  ok('invalid tool options block placement',ev(p,'!!conduit.drawingOptionsError'))
  p.locator('[data-draw-setting=sides]').fill('6');p.locator('[data-draw-setting=sides]').press('Tab');p.locator('[data-planar-panel-close]').click();action(p,'draw-exact-point')
  for xy in ['0,0','50,0']:p.locator('.planar-point-form input').fill(xy);p.locator('.planar-point-form button').click();wait(p)
  ok('non-modal exact point input creates native polygon',ev(p,'conduit.doc.entities.length===1&&conduit.doc.entities[0].points.length===6'));ev(p,'conduit.visual2d.panel.close();conduit.setTool("select")')
  # Cancel/source changes/document switches/export never commit unfinished edits.
  fixture(p,[line()]);start(p);field(p,'length',190);before=ev(p,'JSON.stringify(conduit.doc)');cancel(p);ok('Cancel restores source bytes',unchanged(p,before))
  start(p);field(p,'length',180);action(p,'export');ok('Export closes draft and serializes accepted geometry only',ev(p,'!conduit.visual2d.active&&conduit.doc.entities[0].b.x===100'));ev(p,'conduit.closeModal()')
  start(p);field(p,'length',175);ev(p,'conduit.doc.name="Concurrent edit"');p.locator('[data-planar-command=apply]').click();wait(p);ok('concurrent unversioned change prevents commit',ev(p,'conduit.doc.entities[0].b.x===100'));cancel(p)
  start(p);ev(p,"async()=>await conduit.newDocument('blank')");wait(p);ok('document switch discards planar draft',ev(p,'!conduit.visual2d.active&&conduit.doc.entities.length===0'))
  # 3D section controls, surface picking, exact measurement and materials
  mesh(p);ok('requested spatial backend executes',ev(p,'conduit.model3d.renderer.backend').lower().startswith(BACKEND));before=ev(p,'JSON.stringify(conduit.doc)');action(p,'3d-section')
  ok('section is non-modal with real clipping',p.locator('.modal').count()==0 and ev(p,'!!conduit.model3d.renderer.section'))
  p.locator('[data-inspect-offset]').fill('10');p.locator('[data-inspect-offset]').press('Tab');wait(p);ok('exact section offset changes renderer only',ev(p,'conduit.model3d.renderer.section.offset===10') and unchanged(p,before))
  p.locator('[data-inspect-offset]').fill('broken(');wait(p);ok('invalid plane clears draft clipping and disables Apply',p.locator('[data-inspect-command=apply]').is_disabled() and ev(p,'conduit.model3d.renderer.section===null'))
  p.locator('[data-inspect-offset]').fill('10');wait(p)
  p.locator('[data-inspect-command=collapse]').click();data=ev(p,"()=>{const v=conduit.model3d.inspection,c=conduit.model3d.camera,r=conduit.model3d.host.getBoundingClientRect(),q=c.project({x:v.handle.point.x+v.normal.x*5,y:v.handle.point.y+v.normal.y*5,z:v.handle.point.z+v.normal.z*5});return{x:r.x+v.handle.x,y:r.y+v.handle.y,dx:q.x-v.handle.raw.x,dy:q.y-v.handle.raw.y}}")
  p.mouse.move(data['x'],data['y']);p.mouse.down();p.mouse.move(data['x']+data['dx'],data['y']+data['dy'],steps=6);p.mouse.up();wait(p)
  ok('actual section handle moves plane',ev(p,'Math.abs(conduit.model3d.renderer.section.offset-15)<.01'))
  p.screenshot(path=str(OUT/f'planar-{BACKEND}-section.png'));p.locator('[data-inspect-command=cancel]').click();ok('section Cancel restores original unclipped view',ev(p,'conduit.model3d.renderer.section===null'))
  action(p,'3d-section');p.locator('[data-inspect-offset]').fill('10');p.locator('[data-inspect-offset]').press('Tab');wait(p);p.locator('[data-inspect-command=section-lines]').click();wait(p)
  ok('section output is native WCS LINE geometry',ev(p,'!conduit.model3d.inspection.active&&conduit.selected().every(e=>e.type==="LINE"&&Math.abs(e.a.z-10)<1e-6)'))
  download(p,'section');ev(p,'conduit.model3d.renderer.section=null')
  action(p,'3d-measure');ok('measurement interface leaves canvas interactive',p.locator('.modal').count()==0 and panelVisible(p))
  p.locator('[data-inspect-command=pick1]').click();ok('Point 2 cannot invent a first point',ev(p,'conduit.model3d.inspection.pickIndex===0'))
  p.locator('[data-inspect-command=collapse]').click();hit=picked_point(p);p.mouse.click(hit['x'],hit['y']);wait(p);ok('actual surface picking captures WCS point',ev(p,'conduit.model3d.inspection.points.length===1&&conduit.model3d.inspection.points[0].z!==undefined'))
  p.locator('[data-inspect-command=options]').click();p.locator('.inspect3d-panel summary').click()
  for key,value in [('0:x',0),('0:y',0),('0:z',0),('1:x',3),('1:y',4),('1:z',12)]:p.locator(f'[data-inspect-point="{key}"]').fill(str(value))
  wait(p);ok('exact measurement is 3-4-12 distance 13',ev(p,'Math.abs(conduit.model3d.inspection.measurement.distance-13)<1e-10'))
  p.locator('[data-inspect-command=guide-line]').click();wait(p);ok('measured guide Apply creates native spatial line',ev(p,'conduit.selected()[0].type==="LINE"&&conduit.selected()[0].b.z===12'));download(p,'measurement')
  mesh(p);before=ev(p,'JSON.stringify(conduit.doc)');n=ev(p,'conduit.history.undoStack.length');action(p,'3d-appearance')
  ok('appearance panel non-modal',p.locator('.modal').count()==0 and panelVisible(p))
  p.locator('[data-inspect-preset=copper]').click();wait(p);ok('material preset previews isolated document',ev(p,'conduit.model3d.previewDocument!==conduit.doc&&!!conduit.model3d.previewDocument') and unchanged(p,before))
  p.locator('[data-inspect-material=roughness]').fill('0.18+0.12');wait(p);ok('material expression evaluates live',ev(p,'conduit.model3d.inspection.material.roughness===.3'))
  p.locator('[data-inspect-material=opacity]').fill('2');wait(p);ok('invalid material clears preview and disables Apply',ev(p,'!conduit.model3d.previewDocument') and p.locator('[data-inspect-command=apply]').is_disabled())
  p.locator('[data-inspect-material=opacity]').fill('.65');wait(p);p.screenshot(path=str(OUT/f'planar-{BACKEND}-appearance.png'));p.locator('[data-inspect-command=apply]').click();wait(p)
  ok('material commits exact values and one undo record',ev(p,'conduit.selected()[0].appearance3d.roughness===.3&&conduit.selected()[0].opacity===.65') and ev(p,'conduit.history.undoStack.length')==n+1)
  action(p,'undo');ok('material undo restores native source',ev(p,'!conduit.selected()[0]?.appearance3d||conduit.selected()[0].opacity!==.65'))
  # Repeated updates retain control nodes and do not introduce persistent CAD mutations.
  action(p,'3d-appearance');ev(p,'window.materialInput=conduit.model3d.inspection.root.querySelector("[data-inspect-material=roughness]")');p.locator('[data-inspect-range=roughness]').focus();p.keyboard.press('Home');p.keyboard.press('ArrowRight');wait(p)
  ok('material refresh preserves exact input node',ev(p,'window.materialInput===conduit.model3d.inspection.root.querySelector("[data-inspect-material=roughness]")'))
  p.locator('[data-inspect-command=cancel]').click();action(p,'mode-draw');ok('2D mode remains independent after spatial inspection',ev(p,'conduit.viewMode==="2d"&&!conduit.model3d.inspection.active'))
  ok('no uncaught desktop page errors',not errors)
  ctx.close()
  # Mobile layouts, real touch dragging, two-finger takeover, keyboard focus, resize.
  for width,height in [(320,568),(390,844),(844,390),(1024,768)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,device_scale_factor=1,accept_downloads=True);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));h.load(p,BACKEND);ev(p,"async()=>await conduit.newDocument('blank')")
   fixture(p,[circle()]);ev(p,'conduit.camera.scale=1;conduit.camera.x=50;conduit.camera.y=30;conduit.renderer.invalidate()');start(p);prefix=f'{width}×{height}'
   ok(prefix+' planar ribbon in viewport',bounded(p,'.planar-controls'))
   for selector in ['[data-planar-command=apply]','[data-planar-command=cancel]']:
    ok(prefix+' '+selector+' 44px and visible',bounded(p,selector) and p.locator(selector).bounding_box()['height']>=43.5)
   field(p,'radius','30',False);ok(prefix+' inline input readable and bounded',bounded(p,'.planar-entry') and p.locator('.planar-entry input').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=16'))
   p.locator('.planar-entry [type=submit]').click();wait(p);drag(p,'radius',10,0,True)
   ok(prefix+' actual touch radius drag',ev(p,'conduit.visual2d.session.value("radius")===40'))
   if width==390:p.screenshot(path=str(OUT/f'planar-{BACKEND}-mobile.png'))
   # Keyboard interaction operates on actual focusable handle target.
   p.locator('[data-planar-handle=radius]').focus();p.keyboard.press('ArrowRight');wait(p);ok(prefix+' keyboard handle nudge',ev(p,'conduit.visual2d.session.value("radius")===41'))
   if width==390:
    snapshot=ev(p,'JSON.stringify(conduit.visual2d.session.snapshot())');source=ev(p,'JSON.stringify(conduit.doc)')
    target=ev(p,"()=>{const h=conduit.visual2d.hitHandles.find(h=>h.id==='radius'),r=conduit.$('.viewport').getBoundingClientRect();return{x:r.x+h.x,y:r.y+h.y}}")
    cdp=ctx.new_cdp_session(p);first={**target,'id':1};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[first]});first['x']+=18;cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[first]});wait(p)
    second={'id':2,'x':first['x']-80,'y':first['y']+40};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[first,second]});wait(p)
    ok('two-finger takeover reverts only the unfinished 2D handle gesture',ev(p,'!conduit.visual2d.drag&&JSON.stringify(conduit.visual2d.session.snapshot())')==snapshot)
    second['y']+=15;cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[first,second]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[first]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});wait(p)
    ok('pinch and remaining-finger release cannot commit 2D geometry',unchanged(p,source) and ev(p,'conduit.visual2d.active'));cdp.detach()
    field(p,'radius','40',False);ev(p,"Object.defineProperty(visualViewport,'height',{configurable:true,value:440});visualViewport.dispatchEvent(new Event('resize'))");p.wait_for_timeout(150)
    ok('keyboard-sized viewport retains visible exact input and Apply',bounded(p,'.planar-entry') and bounded(p,'[data-planar-command=apply]'))
    p.keyboard.press('Escape');ev(p,"delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))");wait(p)
   before=ev(p,'JSON.stringify(conduit.doc)');cancel(p);ok(prefix+' cancel touch preview restores source',unchanged(p,before))
   action(p,'more');ok(prefix+' nonmodal tool palette bounded',bounded(p,'.planar-tool-panel'));p.locator('[data-planar-panel-close]').click()
   mesh(p)
   for mode,a in [('section','3d-section'),('measure','3d-measure'),('appearance','3d-appearance')]:
    action(p,a);ok(prefix+' '+mode+' panel bounded',bounded(p,'.inspect3d-panel'));ok(prefix+' '+mode+' confirmation bounded',bounded(p,'[data-inspect-command=apply]'))
    p.locator('[data-inspect-command=collapse]').click();ok(prefix+' '+mode+' collapsed view keeps confirmation',p.locator('.inspect3d-panel').is_hidden() and bounded(p,'.inspect3d-controls'))
    p.locator('[data-inspect-command=cancel]').click()
   ctx.close()
  ok('no uncaught page errors across all viewports',not errors);browser.close()
finally:
 h.close();(OUT/f'planar-visual-{BACKEND}.json').write_text(json.dumps({'backend':BACKEND,'nativeOrigin':NATIVE,'memoryStorageAdapter':not NATIVE,'physicalDevice':False,'checks':checks,'pageErrors':errors},indent=2))
print(json.dumps({'passed':len(checks),'pageErrors':errors,'backend':BACKEND}))
