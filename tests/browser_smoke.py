import json, time, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 results=[]
 for backend in ['canvas','webgl2','webgpu']:
  page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.set_content((ROOT/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'"+backend+"'})"))
  try:page.wait_for_function('document.documentElement.dataset.ready === "true"',timeout=15000)
  except Exception as e:errors.append('ready timeout: '+str(e))
  page.wait_for_timeout(600)
  data=page.evaluate('''()=>({app:!!window.conduit,stats:window.conduit?.renderer.stats,rendererMessage:window.conduit?.rendererMessage,entities:window.conduit?.doc.entities.length,canvas:window.conduit?.camera,scroll:document.documentElement.scrollWidth,inner:innerWidth})''')
  results.append({'requested':backend,'errors':errors,'data':data})
  page.screenshot(path=str(OUT/f'desktop-{backend}.png'))
  page.close()
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=ctx.new_page();errs=[];page.on('pageerror',lambda error:errs.append(str(error)))
 page.set_content((ROOT/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))","mountWorkbench(document.getElementById('app'),{backend:'canvas'})"));page.wait_for_function('document.documentElement.dataset.ready === "true"',timeout=10000);page.wait_for_timeout(300);page.screenshot(path=str(OUT/'mobile.png'));results.append({'mobile':True,'errors':errs,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth'),'stats':page.evaluate('conduit.renderer.stats')});page.get_by_role('button',name='Symbols',exact=True).tap();page.wait_for_timeout(150);page.screenshot(path=str(OUT/'mobile-library.png'))
 print(json.dumps(results,indent=2));(OUT/'browser-smoke.json').write_text(json.dumps(results,indent=2))
 browser.close()
