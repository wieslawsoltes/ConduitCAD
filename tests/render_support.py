"""Production renderer harness. Opaque-origin mode explicitly substitutes memory storage only.
The native-origin mode is required for WebGPU; no origin policy is changed by this harness.
"""
import functools, http.server, os, shutil, threading
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'; OUT.mkdir(exist_ok=True)
NATIVE=os.environ.get('CONDUIT_TEST_ORIGIN')=='localhost'
MEMORY="""for(const name of ['localStorage','sessionStorage']){const data=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size}}});}Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});"""
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
class Harness:
 def __init__(self):
  self.source=(ROOT/'dist/ConduitCAD.html').read_text()
  self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
  threading.Thread(target=self.server.serve_forever,daemon=True).start()
 def load(self,page,backend='canvas'):
  if NATIVE:page.goto(f'http://127.0.0.1:{self.server.server_port}/?fresh=1&no-sw=1&renderer=canvas&renderer3d={backend}')
  else:page.set_content(self.source.replace('<script>globalThis.__CONDUIT_STANDALONE__=true;','<script>'+MEMORY+'globalThis.__CONDUIT_STANDALONE__=true;').replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas',backend3d:'"+backend+"'})"))
  page.wait_for_function('document.documentElement.dataset.ready==="true"')
  page.evaluate('conduit.documents.debounce=100000;clearTimeout(conduit.documents.timer)')
  page.evaluate("async()=>{await conduit.action('3d-example:primitives');await conduit.model3d.ready;conduit.model3d.renderer.draw()}")
 def close(self):self.server.shutdown()
def launch(playwright):
 return playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader'])
def bounded(page,selector):
 return page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-.7&&r.top>=-.7&&r.right<=innerWidth+.7&&r.bottom<=innerHeight+.7}')
def frame(page):
 """Capture the submitted pixels, not a canvas buffer that presentation may retire.

 Use the application's snapshot contract on every backend. WebGPU copies into a
 staging buffer synchronously with draw submission, then maps it asynchronously.
 Waiting for onSubmittedWorkDone before canvas.toDataURL can capture an expired
 swapchain frame. No retries, backend substitution, or image tolerances are used.
 """
 return page.evaluate("""async()=>{
  const blob=await conduit.model3d.renderer.capturePNG({annotations:false});
  return await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result.split(',')[1]);
   reader.onerror=()=>reject(reader.error||new Error('PNG read failed'));
   reader.readAsDataURL(blob);
  });
 }""")
