"""Render every catalogue category from native CAD-derived SVG; not GPU certification."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil
r=Path(__file__).resolve().parents[1];out=r/'artifacts/symbol-review';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_content((r/'docs/symbol-atlas.html').read_text())
 for loc in page.locator('.category').all():
  name=loc.get_attribute('id');loc.screenshot(path=str(out/(name+'.png')))
 page.set_content((r/'dist/ConduitCAD.html').read_text().replace("mountWorkbench(document.getElementById('app'))", "mountWorkbench(document.getElementById('app'),{backend:'canvas'})"));page.wait_for_function('document.documentElement.dataset.ready === "true"');page.evaluate('conduit.store.save=async()=>{};conduit.store.schedule=()=>{}');page.locator('#symbol-category').select_option('Hydraulics');page.wait_for_timeout(150);page.screenshot(path=str(out/'desktop-hydraulics.png'));page.evaluate("conduit.newDialog()");page.screenshot(path=str(out/'drawing-starters.png'));b.close()
