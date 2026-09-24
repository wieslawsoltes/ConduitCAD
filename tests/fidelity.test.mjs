import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDXF, writeDXF, parseAsciiPairs } from '@conduitcad/dxf';
import { createDocument, entity, entityGeometry, moveEntity, transformEntity, resolveStyle, textLayout, objectCoordinateTransform, clone } from '@conduitcad/model';
import { hatchContours, hatchRegionContours, hatchPatternSegments, cadTextRuns, inPolygon, signedDashPattern } from '../packages/model/src/fidelity.js';
import { parseHatchData } from '../packages/dxf/src/fidelity.js';
import { buildScene, Camera } from '@conduitcad/renderer';
import { matrix, transform, distance, distanceToSegment } from '@conduitcad/geometry';
import { SYMBOLS, installSymbols, insertSymbol } from '@conduitcad/symbols';
import { writeSVG } from '@conduitcad/exchange';
const input=fs.readFileSync(new URL('./fixtures/fidelity.dxf',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/fidelity.json',import.meta.url)));
const doc=parseDXF(input), again=parseDXF(writeDXF(doc));
const get=name=>doc.entities.find(e=>e._dxf.handle===manifest.find(m=>m.name===name).handle);
const regenerated=name=>again.entities.find(e=>e.id===get(name).id);
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const pointNear=(a,b,eps)=>{near(a.x,b.x,eps);near(a.y,b.y,eps)};
const poly=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];

test('all independently generated entities import without unsupported entities or nonfinite geometry',()=>{
 assert.equal(doc.entities.length,37);assert.equal(doc.entities.filter(e=>e.unsupported).length,0);
 for(const e of doc.entities){const g=entityGeometry(e,doc);assert.ok(g.paths.length+g.texts.length>0,e.type);for(const p of g.paths.flatMap(p=>p.contours?.flat() || p.points))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),e.type);}
});
for(const name of ['arc-False','arc-True','ellipse-False','ellipse-True'])test(`native hatch ${name} agrees with independent analytic endpoints`,()=>{
 const data=manifest.find(m=>m.name===name),e=get(name),points=hatchContours(e,.01)[0];
 pointNear(points[0],{x:data.start[0],y:data.start[1]});
 assert.ok(points.some(p=>distance(p,{x:data.end[0],y:data.end[1]})<1e-6));
 const r=regenerated(name);assert.equal(r.loops[0].edges[0].ccw,e.loops[0].edges[0].ccw);
 pointNear(hatchContours(r,.01)[0][0],points[0]);
});
test('normal, outer, and ignore hatch styles produce correct nested-island topology',()=>{
 for(const [style,count] of [[0,3],[1,2],[2,1]]) {const e=get('islands-'+style);assert.equal(hatchRegionContours(e,.01).length,count);assert.equal(regenerated('islands-'+style).hatchStyle,style);}
 const contours=hatchRegionContours(get('islands-0'));
 const inside=p=>contours.reduce((n,c)=>n^(inPolygon(p,c)?1:0),0);
 assert.equal(inside({x:10,y:50}),1);assert.equal(inside({x:25,y:50}),0);assert.equal(inside({x:50,y:50}),1);
});
test('hatch pattern scanlines never bridge an island hole',()=>{
 const e=get('pattern'),contours=hatchRegionContours(e,.01),result=hatchPatternSegments(e,contours);
 assert.ok(result.segments.length>30);assert.equal(result.limited,false);
 for(const [a,b]of result.segments){const p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};assert.equal(inPolygon(p,contours[1]),false);}
 const copy=regenerated('pattern').patternLines; near(copy[0].angle,e.patternLines[0].angle); pointNear(copy[0].offset,e.patternLines[0].offset); assert.deepEqual(copy[0].dashes,e.patternLines[0].dashes);
});
test('pathological hatch spacing terminates at the configured safety budget',()=>{
 const e={patternLines:[{angle:0,base:{x:0,y:0},offset:{x:0,y:1e-6},dashes:[]}]};
 assert.equal(hatchPatternSegments(e,[poly(0,0,100,100)],{maxLines:50}).limited,true);
});
test('malformed hatch counts are rejected before allocation',()=>{
 assert.throws(()=>parseHatchData([[91,10000001]]),/length/);
 assert.throws(()=>parseHatchData([[91,1],[92,2],[72,0],[73,1],[93,-1]]),/length/);
});
test('rational spline hatch preserves native knots, controls, weights and edge topology',()=>{
 const a=get('spline').loops[0].edges[0],b=regenerated('spline').loops[0].edges[0];
 for(const key of ['knots','controlPoints','weights','degree','rational'])assert.deepEqual(b[key],a[key]);
 assert.ok(hatchContours(get('spline'),.01)[0].length>20);
});
test('gradient DXF data survives native export while preview limitation remains explicit',()=>{
 assert.deepEqual(regenerated('gradient').gradient,get('gradient').gradient);
 assert.ok(doc.importDiagnostics.some(d=>/Gradient/.test(d.message)));
});
test('variable-width bulge polyline emits a filled ribbon and retains per-vertex widths',()=>{
 const e=get('wide-polyline'),g=entityGeometry(e,doc);assert.equal(g.paths[0].stroke,false);assert.ok(g.paths[0].fill);assert.ok(g.paths[0].points.length>12);
 assert.deepEqual(regenerated('wide-polyline').points,e.points);
});
test('3D POLYLINE retains Z, vertex ordering, native record type, and closure',()=>{
 const e=get('poly3d'),r=regenerated('poly3d');assert.equal(r.type,'POLYLINE');assert.ok(r.flags&8);assert.deepEqual(r.points,e.points);assert.equal(r.closed,true);assert.equal(r.points[2].z,12);
});
test('polyface and polygon meshes remain native and render indexed edges',()=>{
 for(const name of ['polyface','polygon-mesh']) {const e=get(name),r=regenerated(name);assert.equal(r.type,'POLYLINE');assert.equal(r.flags,e.flags);assert.deepEqual(r.points,e.points);assert.deepEqual(r.faces,e.faces);assert.equal(r.mCount,e.mCount);assert.equal(r.nCount,e.nCount);assert.ok(entityGeometry(e,doc).paths.length>=4);}
});
test('3DFACE uses native vertex order and respects hidden edge bitmask',()=>{
 const e=get('face-hidden-edge');assert.equal(entityGeometry(e,doc).paths.length,3);assert.equal(regenerated('face-hidden-edge').edgeFlags,2);assert.deepEqual(regenerated('face-hidden-edge').points,e.points);
});
test('WCS ellipse minor axis respects reversed extrusion normal',()=>{
 const g=entityGeometry(get('negative-ocs-ellipse'),doc);assert.ok(g.paths[0].points.every(p=>p.y<=530+1e-6));assert.ok(g.paths[0].points.some(p=>p.y<519));
});
test('OCS arbitrary-axis basis normalizes vectors and includes projected elevation',()=>{
 const m=objectCoordinateTransform({x:0,y:0,z:-2},10);assert.deepEqual(m,[-1,0,0,1,0,0]);
 const n={x:.3,y:.4,z:Math.sqrt(.75)},a=objectCoordinateTransform(n,12);near(a[4],3.6);near(a[5],4.8);near(Math.hypot(a[0],a[1]),1);assert.throws(()=>objectCoordinateTransform({x:0,y:0,z:0}),/zero/);
});
test('dragging reflected OCS entities follows the world-space pointer delta',()=>{
 const e=clone(get('negative-ocs-circle')),before=entityGeometry(e,doc).paths[0].points[0];moveEntity(e,15,-7);const after=entityGeometry(e,doc).paths[0].points[0];near(after.x-before.x,15);near(after.y-before.y,-7);
});
test('edge-on plane edits reject atomically instead of moving in the wrong coordinate frame',()=>{
 const e=entity('CIRCLE',{c:{x:0,y:0},r:10,extrusion:{x:0,y:1,z:0}}),original=clone(e);assert.throws(()=>moveEntity(e,2,3),/edge-on/);assert.deepEqual(e,original);
});
for(let attachment=1;attachment<=9;attachment++)test(`MTEXT attachment ${attachment} retains wrapping box, rotation and placement`,()=>{
 const e=get('mtext-'+attachment),r=regenerated('mtext-'+attachment),t=entityGeometry(e,doc).texts[0],layout=textLayout(t);
 assert.equal(e.widthFactor,1);assert.equal(r.mtextWidth,120);assert.equal(r.attachment,attachment);near(e.rotation,15);near(r.rotation,15);
 near(layout.minX, -120*((attachment-1)%3)/2);assert.ok(layout.lines.length>=2);assert.ok(t.frame.every(Number.isFinite));
});
test('MTEXT background truecolor does not overwrite foreground ACI',()=>{
 const e=get('mtext-mask');assert.equal(e.color,'#00ff00');assert.equal(e.backgroundColor,'#ebd29b');assert.equal(regenerated('mtext-mask').color,e.color);assert.equal(regenerated('mtext-mask').backgroundColor,e.backgroundColor);
});
test('MTEXT formatter scopes styles, decodes escapes, and wraps long unbroken identifiers',()=>{
 const runs=cadTextRuns('A{\\C1;B}C\\P\\U+03A9');assert.equal(runs.map(r=>r.text).join(''),'ABC\nΩ');assert.equal(runs[1].color,'#ff0000');assert.equal(runs.at(-1).color,undefined);
 const t={text:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',mtext:true,mtextWidth:24,nominalHeight:10};const result=textLayout(t);assert.ok(result.lines.length>=6);assert.ok(result.lines.every(l=>l.width<=24));
});
test('TEXT second alignment point, width factor, and style survive the native writer',()=>{
 for(const name of ['middle-center','baseline-right','aligned','fit']) {const e=get('text-'+name),r=regenerated('text-'+name);assert.deepEqual(r.alignPoint,e.alignPoint);assert.equal(r.halign,e.halign);assert.equal(r.valign,e.valign);assert.equal(r.styleName,'FIDELITY');near(r.widthFactor,.8);}
 assert.equal(again.textStyles.FIDELITY.font,'DejaVuSans.ttf');near(again.textStyles.FIDELITY.oblique,12);
});
test('signed linetypes preserve leading gaps and dots with global/entity scale',()=>{
 assert.deepEqual(signedDashPattern([-3,0,-3,5,-5]),[0,3,0,3,5,5]);
 const e=get('signed-dashes');assert.deepEqual(resolveStyle(e,doc).dash,[0,15,0,15,25,25]);assert.deepEqual(again.linetypes.LEADING_DOTS,doc.linetypes.LEADING_DOTS);near(resolveStyle(e,doc).width,50*96/2540);
});
test('DXF transparency remains native rather than a synthetic hatch alpha',()=>{near(get('transparency').opacity,.6);near(regenerated('transparency').opacity,.6);});
test('rays and construction lines clip parametrically to the current view',()=>{
 const e=entity('RAY',{p:{x:0,y:0},direction:{x:1,y:0}}),v={minX:-5,minY:-5,maxX:10,maxY:5};const d=createDocument();
 assert.deepEqual(entityGeometry(e,d,{view:v}).paths[0].points,[{x:0,y:0},{x:10,y:0}]);
 e.type='XLINE';assert.deepEqual(entityGeometry(e,d,{view:v}).paths[0].points,[{x:-5,y:0},{x:10,y:0}]);
 e.direction={x:0,y:0};assert.equal(entityGeometry(e,d,{view:v}).paths.length,0);
});
test('native leader keeps vertices and adds its arrow at the first vertex',()=>{
 const e=get('leader'),g=entityGeometry(e,doc);assert.equal(g.paths.length,2);pointNear(g.paths[1].points[0],e.points[0]);assert.deepEqual(regenerated('leader').points,e.points);
});
test('native hatch similarity transformation updates analytic edges and pattern definitions',()=>{
 const e=clone(get('arc-False')),m=matrix({x:20,y:-10,rotation:90,sx:2,sy:2}),before=hatchContours(e,.01)[0][0];transformEntity(e,m);pointNear(hatchContours(e,.01)[0][0],transform(before,m));
 const pattern=clone(get('pattern')),base=clone(pattern.patternLines[0].base);transformEntity(pattern,m);pointNear(pattern.patternLines[0].base,transform(base,m));near(pattern.patternLines[0].dashes[0],20);
 const original=clone(e);assert.throws(()=>transformEntity(e,matrix({sx:2,sy:1})),/similarity/);assert.deepEqual(e,original);
});
test('SVG exchange retains compound hole contours, opacity, and masked text',()=>{
 const svg=writeSVG(doc);assert.match(svg,/fill-rule="evenodd"/);assert.doesNotMatch(svg,/fill-opacity="0.15"/);assert.match(svg,/font-family="DejaVuSans.ttf"/);assert.match(svg,/#ebd29b/);assert.match(svg,/opacity="0.6"/);
});
test('all 64 original symbol masters have connection ports on actual terminal geometry',()=>{
 const d=installSymbols(createDocument());for(const s of SYMBOLS){const e=insertSymbol(d,s.id,0,0),g=entityGeometry(e,d,{tolerance:.01});
  for(const port of s.ports){let best=Infinity;for(const path of g.paths){for(let i=1;i<path.points.length;i++)best=Math.min(best,distanceToSegment(port,path.points[i-1],path.points[i]));if(path.closed)best=Math.min(best,distanceToSegment(port,path.points.at(-1),path.points[0]));}assert.ok(best<.15,`${s.id}:${port.name} terminal gap ${best}`);}
  assert.equal(s.symbol.geometryRevision,2);assert.match(s.symbol.conformity,/not standards-certified/);
 }
});
