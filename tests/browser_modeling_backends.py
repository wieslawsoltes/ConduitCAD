"""Execute actual 3D GPU APIs when advertised, record software adapter identity, compare pixels.
Requires localhost. Physical GPU and real-device performance are deliberately not inferred.
"""
import base64
import functools
import http.server
import json
import os
import shutil
import threading
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
reports=[];errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-webgpu','--enable-unsafe-swiftshader'])
  for requested in ['canvas','webgl2','webgpu']:
   context=browser.new_context(viewport={'width':1000,'height':760},device_scale_factor=1);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(f'http://127.0.0.1:{server.server_port}/?fresh=1&no-sw=1&renderer=canvas&renderer3d={requested}')
   page.wait_for_function('document.documentElement.dataset.ready==="true"')
   page.evaluate("conduit.action('3d-example:primitives')")
   page.wait_for_function('conduit.model3d.renderer.backend')
   page.evaluate("async()=>{const r=conduit.model3d.renderer;await r.ready;r.style='shaded';r.upload();r.camera.view('iso');r.fit();r.draw();await r.device?.queue.onSubmittedWorkDone();}")
   capability=page.evaluate("async()=>{const gl=document.createElement('canvas').getContext('webgl2'),gpu=await navigator.gpu?.requestAdapter();return {webgl2:!!gl,webgpu:!!gpu,adapter:gpu?{vendor:gpu.info.vendor,architecture:gpu.info.architecture,device:gpu.info.device,description:gpu.info.description}:null,glRenderer:gl?.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||gl.RENDERER)}}")
   report=page.evaluate("()=>{const r=conduit.model3d.renderer;return {backend:r.backend,reasons:r.fallbackReasons,triangles:r.scene.triangles.length,stats:r.stats,secure:isSecureContext}}")
   executed=report['backend'].lower().startswith(requested)
   assert executed or not capability[requested],{'requested':requested,**report,**capability}
   report.update(requested=requested,executedRequestedBackend=executed,capabilities=capability,physicalDevice=False)
   # Camera changes must update uniforms/projection only, not rebuild or reupload geometry.
   stable=page.evaluate("()=>{const r=conduit.model3d.renderer,n=r.uploads,s=r.camera.snapshot();r.camera.orbit(31,13);r.draw();const stable=r.uploads===n;Object.assign(r.camera,s);r.draw();return stable}")
   assert stable,'Orbit reuploaded immutable geometry'
   page.wait_for_timeout(100)
   data=page.evaluate("async()=>{const r=conduit.model3d.renderer;return await new Promise(resolve=>requestAnimationFrame(async()=>{r.draw();await r.device?.queue.onSubmittedWorkDone();resolve(r.canvas.toDataURL('image/png').split(',')[1]);}));}")
   (OUT/f'modeling3d-backend-{requested}.png').write_bytes(base64.b64decode(data))
   if executed and requested=='webgl2':
    page.evaluate("()=>{window.restore3DContext=conduit.model3d.renderer.gl.getExtension('WEBGL_lose_context');if(!window.restore3DContext)throw new Error('Context-loss extension unavailable');window.restore3DContext.loseContext()}")
    page.wait_for_function('conduit.model3d.renderer.gl.isContextLost()')
    # Extension lookup is unavailable during loss; retain the pre-loss extension object.
    page.evaluate('window.restore3DContext.restoreContext()')
    page.wait_for_function('conduit.model3d.renderer.gl.isContextLost()===false')
    report['contextRestore']=True
   if executed and requested=='webgpu':
    page.evaluate('conduit.model3d.renderer.device.destroy()');page.wait_for_function('!conduit.model3d.renderer.device&&conduit.model3d.renderer.backend!==null')
    report['deviceLossFallback']=page.evaluate('conduit.model3d.renderer.backend')
   reports.append(report);context.close()
  # Different AA rasterizers need edge tolerance. Compare chromatic filled regions and flat interiors.
  reference=np.asarray(Image.open(OUT/'modeling3d-backend-canvas.png').convert('RGB')).astype(float)
  ref_mask=(reference.max(2)-reference.min(2)>18)&(reference.mean(2)<215)
  for r in reports:
   actual=np.asarray(Image.open(OUT/f'modeling3d-backend-{r["requested"]}.png').convert('RGB')).astype(float)
   mask=(actual.max(2)-actual.min(2)>18)&(actual.mean(2)<215);intersection=ref_mask&mask;union=ref_mask|mask
   iou=float(intersection.sum()/max(1,union.sum()));difference=np.max(abs(actual-reference),2)
   interior=intersection.copy()
   for axis in [0,1]:
    interior &= np.max(abs(reference-np.roll(reference,2,axis=axis)),2)<1
    interior &= np.max(abs(reference-np.roll(reference,-2,axis=axis)),2)<1
   agreement=float((difference[interior]<=4).mean()) if interior.any() else 0
   r.update(filledMaskIoU=iou,flatInteriorAgreement=agreement,stableGeometryUploads=True)
   assert iou>.965 and agreement>.98,r
  assert not errors,errors
  browser.close()
finally:
 server.shutdown();(OUT/'modeling3d-backends.json').write_text(json.dumps({'reports':reports,'errors':errors,'physicalDevice':False,'pixelScope':'primitives, flat fills, orthographic iso; AA tolerance; no universal equivalence claim'},indent=2))
print(json.dumps({'reports':reports,'errors':errors},indent=2))
