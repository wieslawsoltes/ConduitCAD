import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ICON_NAMES, ICON_GROUPS, icon, hasIcon } from '@conduitcad/icons';
import { ACTION_ICONS, MODEL_ICONS, TOOL_ICONS, EXAMPLE_ICONS, actionIcon, entityIcon, fieldIcon } from '../packages/workbench/src/icon-map.js';
import { commandButton, commandContent } from '../packages/workbench/src/icons.js';
import { MODELING_TOOLS, EXAMPLES_3D } from '@conduitcad/modeling';
import { DRAWING_TOOLS } from '@conduitcad/drawing';

test('180 unique SVG glyphs are immutable discoverable metadata',()=>{
 assert.equal(ICON_NAMES.length,180); assert.equal(new Set(ICON_NAMES).size,180);
 assert.ok(Object.isFrozen(ICON_NAMES)); assert.ok(Object.isFrozen(ICON_GROUPS));
 const grouped=Object.values(ICON_GROUPS).flat();
 assert.equal(grouped.length,180);assert.deepEqual(new Set(grouped),new Set(ICON_NAMES));
 for(const names of Object.values(ICON_GROUPS))assert.ok(Object.isFrozen(names));
});
test('All icons are decorative, unfocusable, currentColor vectors with bounded viewboxes',()=>{
 for(const name of ICON_NAMES){const svg=icon(name);assert.ok(hasIcon(name));assert.match(svg,/aria-hidden="true"/);assert.match(svg,/focusable="false"/);assert.match(svg,/stroke="currentColor"/);assert.match(svg,/viewBox="0 0 (24 24|32 32)"/);assert.doesNotMatch(svg,/<(?:script|foreignObject|image|use)|(?:id|onload)=/);assert.match(svg,/<path d="[Mm]/);}
});
test('Untrusted glyph and class inputs cannot inject SVG or event handlers',()=>{
 assert.equal(hasIcon('__proto__'),false);assert.equal(hasIcon('constructor'),false);assert.equal(hasIcon(null),false);
 assert.match(icon('" onload="alert(1)'),/data-icon="help"/);
 assert.match(icon('cube','x" onload="alert(1)'),/class="icon x&amp;|class="icon x&quot;/);
 assert.doesNotMatch(icon('cube','"><script>bad</script>'),/<script>/);
});
test('All command, modeling, drawing and example semantics resolve to registered glyphs',()=>{
 for(const map of [ACTION_ICONS,MODEL_ICONS,TOOL_ICONS,EXAMPLE_ICONS]) for(const value of Object.values(map))assert.ok(hasIcon(value),value);
 for(const t of MODELING_TOOLS)assert.ok(hasIcon(MODEL_ICONS[t.id]),t.id);
 for(const t of DRAWING_TOOLS)assert.ok(hasIcon(TOOL_ICONS[t.id]),t.id);
 for(const t of EXAMPLES_3D)assert.ok(hasIcon(EXAMPLE_ICONS[t.id]),t.id);
});
test('Native entities and all camera view actions have non-generic icons',()=>{
 for(const type of ['MESH','3DFACE','INSERT','ARC','CIRCLE','LWPOLYLINE','SPLINE','MTEXT','DIMENSION','HELIX','WIPEOUT'])assert.notEqual(entityIcon({type}),'file-cad',type);
 for(const v of ['iso','top','bottom','left','right','front','back'])assert.ok(hasIcon(actionIcon('3d-view-'+v)));
 assert.equal(entityIcon({type:'MESH',feature3d:{kind:'extrude'}}),'extrude');
});
test('Shared action identity is used in tools and selection modes',()=>{
 assert.equal(actionIcon('tool-spline'),'spline');assert.equal(actionIcon('3d-op-hole'),'hole');
 assert.equal(actionIcon('3d-pick:vertex'),'vertex');assert.equal(actionIcon('document-duplicate:a'),'copy');
 assert.equal(actionIcon(null),'settings');assert.equal(actionIcon('unregistered','help'),'help');
});
test('Geometric field icons do not substitute or parse dimension values',()=>{
 for(const [name,label,glyph] of [['x','X','axis-x'],['y','Y','axis-y'],['z','Z','axis-z'],['r','Radius','radius'],['d','Diameter','diameter'],['w','Width','width'],['h','Height','height'],['a','Angle','angle']])assert.equal(fieldIcon(name,label),glyph);
 assert.equal(fieldIcon('custom','Arbitrary user data'),null);
});
test('Command captions and external names are escaped without deleting accessible text',()=>{
 const html=commandButton('3d-op-box','<Box> "size"','btn" x');
 assert.match(html,/class="command-label">&lt;Box&gt; &quot;size&quot;<\/span>/);
 assert.match(html,/data-icon="cube"/);assert.match(html,/type="button"/);
 assert.doesNotMatch(html,/<Box>/);assert.match(commandContent('3d-view-iso','ISO'),/ISO<\/span>/);
});
test('Explicit state override can reuse a control with a different glyph',()=>{
 assert.match(commandContent('3d-nav-toggle','Pan','pan'),/data-icon="pan"/);
 assert.match(commandContent('3d-visibility','Show','eye'),/data-icon="eye"/);
});
test('Compact rules only hide semantic captions, not fields or arbitrary document names',async()=>{
 const css=await readFile(new URL('../packages/workbench/src/styles.css',import.meta.url),'utf8');
 assert.match(css,/clip-path:inset\(50%\)/);assert.doesNotMatch(css,/\[data-action=3d-/);
 assert.doesNotMatch(css,/data-icon-labels[^\{]+\.document-tab-name[^\{]*\{[^}]*display:none/);
 assert.match(css,/\.icon \* \{ pointer-events:none/);
});
test('Icon integration has no global observer, timer-based scan or external asset load',async()=>{
 const adapter=await readFile(new URL('../packages/workbench/src/iconography.js',import.meta.url),'utf8');
 assert.doesNotMatch(adapter,/new MutationObserver|setInterval\(|fetch\(/);
 const main=await readFile(new URL('../packages/workbench/src/index.js',import.meta.url),'utf8');
 const frame=main.slice(main.indexOf('    updateFrame('),main.indexOf('    rendererStatus('));
 assert.doesNotMatch(frame,/iconography|decorateIcon/);
});
