"""Compare all visual-style passes across executed APIs. REQUIRE_WEBGPU=1 makes GPU absence fatal.
Local opaque origins may execute Canvas/WebGL2; they never count fallback as WebGPU success.
"""
import base64,hashlib,json,os,io
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from render_support import Harness,launch,frame,NATIVE,OUT
h=Harness();checks=[];errors=[];reports=[];images={};captures={}
def ok(name,value):
 assert value,name
 checks.append({'name':name,'passed':True});print(name,flush=True)
def get_image(page):
 data=base64.b64decode(frame(page));return np.array(Image.open(io.BytesIO(data)).convert('RGB')),data
def changed(a,b):return int((np.max(np.abs(a.astype(float)-b.astype(float)),axis=2)>4).sum())
try:
 with sync_playwright() as p:
  browser=launch(p)
  for requested in ['canvas','webgl2','webgpu']:
   context=browser.new_context(viewport={'width':1000,'height':760},device_scale_factor=1);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));h.load(page,requested)
   status=page.evaluate("()=>{const r=conduit.model3d.renderer;return {backend:r.backend,reasons:r.fallbackReasons,adapter:r.adapterInfo,secure:isSecureContext,gpuAvailable:!!navigator.gpu,browser:navigator.userAgent,sampleCount:r.gpu?4:r.glRenderer?.samples||1,glRenderer:r.gl?.getParameter(r.gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||r.gl.RENDERER)}}")
   executed=status['backend'].lower().startswith(requested);status.update(requested=requested,executed=executed,physicalDevice=False);reports.append(status)
   if not executed:
    ok(requested+' unavailable is reported, never passed as substituted rendering',requested=='webgpu' and not status['gpuAvailable'] and os.environ.get('REQUIRE_WEBGPU')!='1')
    context.close();continue
   page.evaluate("()=>{const r=conduit.model3d.renderer;r.setSelection([]);r.setDisplaySettings({grid:false,quality:'high'});r.camera.view('iso');r.fit();r.draw();window.originalCamera=r.camera.snapshot();window.originalUploads=r.uploads;}")
   styles=page.evaluate("()=>{conduit.model3d.viewDialog();const values=[...document.querySelectorAll('#model3d-style option')].map(e=>e.value);conduit.closeModal();return values}")
   per_mode={};hashes=[]
   for style in styles:
    page.evaluate('(style)=>conduit.model3d.renderer.setDisplaySettings({style})',style)
    image,data=get_image(page);images[requested,style]=image;captures[requested,style]=data
    (OUT/f'render-{requested}-{style}.png').write_bytes(data)
    digest=hashlib.sha256(data).hexdigest();hashes.append(digest)
    backend_errors=page.evaluate('({gl:conduit.model3d.renderer.gl?.getError()||0,gpu:conduit.model3d.renderer.gpu?.errors||[],backend:conduit.model3d.renderer.backend})')
    ok(f'{requested} {style} shader/passes complete without API errors',not backend_errors['gl'] and not backend_errors['gpu'] and backend_errors['backend']==status['backend'])
    ok(f'{requested} {style} renders nonempty geometry',int((image.max(2)-image.min(2)>18).sum())>100)
    per_mode[style]={'sha256':digest,'width':image.shape[1],'height':image.shape[0]}
   ok(requested+' all style switches preserve geometry uploads',page.evaluate('conduit.model3d.renderer.uploads===originalUploads'))
   ok(requested+' all sixteen styles produce distinct rendered images',len(set(hashes))==16)
   page.evaluate("()=>{const r=conduit.model3d.renderer;r.style='realistic';r.setDisplaySettings({ground:true,grid:false,shadows:false,ambientOcclusion:false});r.draw()}")
   plain,_=get_image(page)
   page.evaluate('conduit.model3d.renderer.setDisplaySettings({shadows:true})');shadow,data=get_image(page);(OUT/f'render-{requested}-shadows.png').write_bytes(data)
   ok(requested+' shadow map changes actual pixels',changed(plain,shadow)>100)
   page.evaluate('conduit.model3d.renderer.setDisplaySettings({shadows:false,ambientOcclusion:true,aoRadius:.2,aoStrength:1.2})');ao,data=get_image(page);(OUT/f'render-{requested}-ao.png').write_bytes(data)
   ok(requested+' screen-space occlusion changes actual pixels',changed(plain,ao)>100)
   page.evaluate("()=>{const r=conduit.model3d.renderer;r.setDisplaySettings({shadows:false,ambientOcclusion:false,ground:false,style:'shaded',capHatch:true});r.section={normal:{x:0,y:0,z:1},offset:12}}")
   cap,data=get_image(page);(OUT/f'render-{requested}-section.png').write_bytes(data)
   ok(requested+' section fill is emitted for closed contours',page.evaluate('conduit.model3d.renderer.stats.capTriangles>0'))
   page.evaluate('conduit.model3d.renderer.setDisplaySettings({sectionCaps:false})');uncapped,_=get_image(page)
   ok(requested+' cap setting changes the cut image',changed(cap,uncapped)>100)
   page.evaluate("()=>{const r=conduit.model3d.renderer;r.section=null;r.setDisplaySettings({sectionCaps:true,style:'shaded'});window.transparentFixture=structuredClone(conduit.doc);transparentFixture.entities=transparentFixture.entities.filter(e=>e.type==='MESH');for(const e of transparentFixture.entities){e.opacity=.3;e.appearance3d={opacity:.3,roughness:.4,metallic:0}}r.setDocument(transparentFixture)}")
   forward,_=get_image(page);page.evaluate('transparentFixture.entities.reverse();conduit.model3d.renderer.setDocument(transparentFixture)');reverse,_=get_image(page)
   ok(requested+' weighted transparency is submission-order independent',changed(forward,reverse)<5)
   page.evaluate('conduit.model3d.renderer.setDocument(conduit.doc);conduit.model3d.renderer.camera.perspective=true;conduit.model3d.renderer.camera.distance=5')
   _,data=get_image(page)
   ok(requested+' perspective near-plane crossings remain bounded and error-free',page.evaluate('(conduit.model3d.renderer.gl?.getError()||0)===0&&(conduit.model3d.renderer.gpu?.errors.length||0)===0'))
   page.evaluate('Object.assign(conduit.model3d.renderer.camera,originalCamera);conduit.model3d.renderer.style="shaded";conduit.model3d.renderer.draw();window.geometryCount=conduit.model3d.renderer.uploads;conduit.model3d.camera.orbit(20,8);conduit.model3d.renderer.draw()')
   ok(requested+' camera-only redraws do not reupload or retessellate',page.evaluate('conduit.model3d.renderer.uploads===geometryCount'))
   if requested=='webgl2':
    page.evaluate("window.contextLoss=conduit.model3d.renderer.gl.getExtension('WEBGL_lose_context');contextLoss.loseContext()")
    page.wait_for_function('conduit.model3d.renderer.gl.isContextLost()');page.evaluate('contextLoss.restoreContext()');page.wait_for_function('!conduit.model3d.renderer.gl.isContextLost()');page.wait_for_timeout(100);frame(page)
    ok('WebGL2 recreates all resources after context restoration',page.evaluate('conduit.model3d.renderer.gl.getError()===0&&conduit.model3d.renderer.backend==="WebGL2"'))
   if requested=='webgpu':
    page.evaluate('conduit.model3d.renderer.device.destroy()');page.wait_for_function('!conduit.model3d.renderer.device&&conduit.model3d.renderer.backend!==null');frame(page)
    ok('WebGPU device loss falls back to working WebGL2',page.evaluate('conduit.model3d.renderer.backend==="WebGL2"'))
   status['modes']=per_mode;status['stats']=page.evaluate('conduit.model3d.renderer.stats')
   if requested=='webgl2':
    page.evaluate("()=>{const r=conduit.model3d.renderer;window.beforeFallbackDoc=JSON.stringify(conduit.doc);window.beforeFallbackStyle=r.style;r.glRenderer.resize=()=>{throw new Error('Simulated attachment failure for lifecycle regression')};r.resize()}")
    page.evaluate('conduit.model3d.renderer.ready');fallback_image,_=get_image(page)
    ok('simulated attachment allocation failure reports a working Canvas fallback',page.evaluate('conduit.model3d.renderer.backend.startsWith("Canvas")&&conduit.model3d.renderer.fallbackReasons.some(s=>s.includes("Simulated attachment failure"))'))
    ok('resource fallback retains native document and visual style',page.evaluate('JSON.stringify(conduit.doc)===beforeFallbackDoc&&conduit.model3d.renderer.style===beforeFallbackStyle'))
    ok('resource fallback draws actual geometry',int((fallback_image.max(2)-fallback_image.min(2)>18).sum())>100)
    status['forcedResourceFailure']={'simulated':True,'fallback':page.evaluate('conduit.model3d.renderer.backend')}
   context.close()
  # Compare actual pixels, not just successful draw calls. Different rasterizers get a 2px edge tolerance.
  for report in reports:
   requested=report['requested']
   if requested=='canvas' or not report['executed']:continue
   comparison={}
   for style in report['modes']:
    a=images['canvas',style].astype(float);b=images[requested,style].astype(float)
    ok(f'{requested} {style} has identical output dimensions',a.shape==b.shape)
    mean=float(np.abs(a-b).mean());mask_a=(np.abs(a-np.array([240,245,245])).max(2)>18);mask_b=(np.abs(b-np.array([240,245,245])).max(2)>18)
    expanded_a=mask_a.copy();expanded_b=mask_b.copy()
    for y in range(-2,3):
     for x in range(-2,3):expanded_a|=np.roll(np.roll(mask_a,y,axis=0),x,axis=1);expanded_b|=np.roll(np.roll(mask_b,y,axis=0),x,axis=1)
    recall=float((mask_a&expanded_b).sum()/max(1,mask_a.sum()));precision=float((mask_b&expanded_a).sum()/max(1,mask_b.sum()));score=2*recall*precision/max(.0001,recall+precision)
    comparison[style]={'meanAbsoluteChannelError':mean,'maskF1TwoPixelTolerance':score}
    ok(f'{requested} {style} matches software reference within declared AA tolerance',mean<5 and score>.94)
   report['comparison']=comparison
  ok('no uncaught rendering errors',not errors);browser.close()
finally:
 h.close();(OUT/'render-backends.json').write_text(json.dumps({'reports':reports,'checks':checks,'errors':errors,'origin':'localhost'if NATIVE else'opaque with explicit memory storage adapter','reference':'Canvas depth renderer; per-style mean channel error <5 and 2px foreground-mask F1 >.94','physicalDevice':False},indent=2))
print(f'{len(checks)} rendering backend assertions passed.')
