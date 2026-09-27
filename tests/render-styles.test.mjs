import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, entity } from '@conduitcad/model';
import { V3, boxMesh, sphereMesh, torusMesh, translation3, transformMesh, cross3, sub3, length3, dot3 } from '@conduitcad/geometry3d';
import { buildScene3D, OrbitCamera, VISUAL_STYLES, DEFAULT_DISPLAY_SETTINGS, normalizeDisplaySettings, normalizeMaterial, visualStyle, MATERIAL_PRESETS, ENVIRONMENTS, createRenderingStudy } from '@conduitcad/renderer3d';
import { prepareRenderScene, sectionGeometry, packRenderData, edgeVisible, surfaceAlpha } from '../packages/renderer3d/src/render-data.js';
import { rasterizeScene, clipSurface, softwareShadowMap } from '../packages/renderer3d/src/software.js';
import { shadeSurface3D } from '../packages/renderer3d/src/lighting.js';
import { renderSize3D } from '../packages/renderer3d/src/visual-styles.js';
import { FRAME_FLOATS } from '../packages/renderer3d/src/shaders.js';
import { writeDXF, writeDXFBinary, parseDXF } from '@conduitcad/dxf';
const body=(mesh,id='body',extra={})=>entity('MESH',{...mesh,id,color:'#4c9aaa',...extra});
const documentWith=(...entities)=>{const d=createDocument('Rendering study');d.entities=entities;return d;};
const box=(id='box',extra={})=>body(boxMesh(20,16,14),id,extra);
function fixture(...entities){const document=documentWith(...(entities.length?entities:[box()]));const scene=buildScene3D(document);const camera=new OrbitCamera();camera.resize(160,144);camera.fit(scene.points);return {document,scene,camera};}
function render(f,style='shaded',extra={},section=null){const settings=normalizeDisplaySettings({grid:false,...extra,style});const scene=prepareRenderScene(f.scene,settings,section);return rasterizeScene(scene,f.camera,{width:160,height:144,style,settings,section});}
const differs=(a,b)=>a.pixels.reduce((n,v,i)=>n+(Math.abs(v-b.pixels[i])>2),0);
const area=triangles=>triangles.reduce((sum,t)=>sum+length3(cross3(sub3(t.vertices[1],t.vertices[0]),sub3(t.vertices[2],t.vertices[0])))/2,0);
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('All sixteen immutable CAD styles have distinct identifiers and documented pass semantics',()=>{
 assert.equal(VISUAL_STYLES.length,16);assert.equal(new Set(VISUAL_STYLES.map(s=>s.id)).size,16);assert.ok(Object.isFrozen(VISUAL_STYLES));
 for(const style of VISUAL_STYLES){assert.ok(Object.isFrozen(style));assert.ok(style.description.length>20);assert.equal(visualStyle(style.id),style);}
 assert.equal(visualStyle('hidden').faces,'none');assert.equal(visualStyle('wireframe').hidden,'solid');assert.equal(visualStyle('wireframe-hidden').hidden,true);assert.equal(visualStyle('conceptual').faces,'gooch');assert.equal(visualStyle('realistic').faces,'pbr');assert.throws(()=>visualStyle('path-traced'),/Unknown/);
});
test('Frame uniform contract is explicitly aligned to 29 vec4 slots',()=>assert.equal(FRAME_FLOATS,29*4));
test('Tolerant restored settings whitelist unknown values without accepting prototype contamination',()=>{
 const input=JSON.parse('{"style":"bad","edgeWidth":999,"__proto__":{"polluted":true},"quality":"high"}');const s=normalizeDisplaySettings(input,{tolerant:true});assert.equal(s.style,'shaded-edges');assert.equal(s.edgeWidth,1);assert.equal(s.quality,'high');assert.equal({}.polluted,undefined);assert.equal(s.polluted,undefined);assert.deepEqual(normalizeDisplaySettings(null,{tolerant:true}),DEFAULT_DISPLAY_SETTINGS);
});
for(const [key,value]of Object.entries({edgeWidth:0,silhouetteWidth:100,exposure:Infinity,creaseAngle:90,ambientOcclusion:'yes',grid:1,backgroundColor:'url(javascript:1)',aoRadius:-.1,xrayOpacity:0,environment:'fake',quality:'ultra',jitter:99,overhang:-1}))test(`Strict display settings reject invalid ${key} before mutation`,()=>{assert.throws(()=>normalizeDisplaySettings({[key]:value}),/Invalid/);assert.equal(DEFAULT_DISPLAY_SETTINGS.style,'shaded-edges');});
test('Material defaults, clamping and immutable presets are safe for untrusted metadata',()=>{
 const s=normalizeMaterial({metallic:2,roughness:0,emission:Infinity,opacity:-1,color:'<svg>'},'#abcdef');assert.deepEqual(s,{color:'#abcdef',metallic:1,roughness:.04,emission:0,opacity:0});assert.equal(MATERIAL_PRESETS.length,9);assert.ok(MATERIAL_PRESETS.every(Object.isFrozen));assert.ok(ENVIRONMENTS.every(e=>Object.isFrozen(e.light)));
});
for(const style of VISUAL_STYLES)test(`Software ${style.id} produces finite nonempty output without mutating CAD geometry`,()=>{
 const f=fixture();const before=JSON.stringify(f.document);const result=render(f,style.id);assert.equal(result.pixels.length,160*144*4);assert.ok(result.depth.some(Number.isFinite)||style.id==='xray');assert.ok(result.pixels.some((v,i)=>i%4<3&&v<150));assert.equal(JSON.stringify(f.document),before);
});
test('Hidden-line removal, dashed hidden edges and full wireframe are genuinely different passes',()=>{
 const f=fixture();const visible=render(f,'hidden'),dashed=render(f,'wireframe-hidden'),all=render(f,'wireframe');assert.ok(differs(visible,dashed)>100);assert.ok(differs(dashed,all)>100);assert.ok(differs(visible,all)>100);
});
test('Shaded, edge overlay, Conceptual, gray, material, clay and normal outputs differ',()=>{
 const f=fixture();const base=render(f);for(const style of ['shaded-edges','conceptual','gray','realistic','clay','normals'])assert.ok(differs(base,render(f,style))>100,style);
});
test('Gray interiors discard source hue while preserving the document color',()=>{
 const f=fixture();const result=render(f,'gray');const colored=result.pixels.some((v,i)=>i%4===0&&result.depth[i/4]<Infinity&&(Math.abs(v-result.pixels[i+1])>1||Math.abs(v-result.pixels[i+2])>1));assert.equal(colored,false);assert.equal(f.document.entities[0].color,'#4c9aaa');
});
test('Sketch strokes are stable across redraws and respond to overhang/jitter',()=>{const f=fixture();assert.deepEqual(render(f,'sketchy').pixels,render(f,'sketchy').pixels);assert.ok(differs(render(f,'sketchy'),render(f,'sketchy',{jitter:0,overhang:0}))>100);});
test('Weighted transparency is independent of opaque and transparent entity submission order',()=>{
 const a=box('a',{appearance3d:{opacity:.32,color:'#ff4422'}}),b=body(transformMesh(boxMesh(20,16,14),translation3(6,0,6)),'b',{appearance3d:{opacity:.6,color:'#2277ff'}});const f=fixture(a,b),g=fixture(b,a);Object.assign(g.camera,f.camera.snapshot());const x=render(f),y=render(g);assert.ok(differs(x,y)<5);assert.ok(differs(x,render(f,'xray'))>100);
});
test('Opaque stock correctly occludes transparent geometry behind it',()=>{
 const a=box('front'),b=body(transformMesh(boxMesh(6,6,6),translation3(5,5,3)),'inside',{appearance3d:{opacity:.3,color:'#ff0000'}});const f=fixture(a),g=fixture(a,b);Object.assign(g.camera,f.camera.snapshot());assert.deepEqual(render(f).pixels,render(g).pixels);
});
test('Crease-limited normal smoothing retains hard box corners and smooths a sphere',()=>{
 const f=fixture(box(),body(sphereMesh(8,16,8),'sphere'));const p=prepareRenderScene(f.scene,normalizeDisplaySettings(),null);
 assert.ok(p.triangles.filter(t=>t.id==='box').every(t=>t.normals.every(n=>dot3(n,t.normal)>.99999)));
 assert.ok(p.triangles.filter(t=>t.id==='sphere').some(t=>t.normals.some(n=>dot3(n,t.normal)<.995)));
 assert.ok(p.triangles.every(t=>t.normals.every(n=>Math.abs(length3(n)-1)<1e-7)));
});
test('Smooth sphere shading differs from polygon-normal inspection mode',()=>{const f=fixture(body(sphereMesh(8,16,8)));assert.ok(differs(render(f,'shaded'),render(f,'flat'))>500);});
test('Smooth silhouettes suppress tangent edges but not boundaries or deliberate all-edges inspection',()=>{
 const f=fixture(body(sphereMesh(8,16,8)));const s=normalizeDisplaySettings({style:'shaded-edges'}),visible=f.scene.lines.filter(l=>edgeVisible(l,f.camera,s)).length,all=f.scene.lines.filter(l=>edgeVisible(l,f.camera,{...s,edgeDetail:'all'})).length;assert.ok(visible>0&&visible<all*.6,`${visible}/${all}`);
});
test('Closed box cuts generate correctly oriented planar caps with exact area',()=>{
 const f=fixture();for(const [normal,offset,expected]of [[V3(1,0,0),10,16*14],[V3(0,1,0),8,20*14],[V3(0,0,1),7,20*16]]){const result=sectionGeometry(f.scene,{normal,offset});assert.equal(result.diagnostics.length,0);near(area(result.triangles),expected);assert.ok(result.triangles.every(t=>t.vertices.every(p=>Math.abs(dot3(p,normal)-offset)<1e-7)));}
});
test('Section plane through an existing sphere tessellation ring still forms a cap',()=>{
 const f=fixture(body(sphereMesh(8,16,8)));const cap=sectionGeometry(f.scene,{normal:V3(0,0,1),offset:0});assert.ok(cap.triangles.length>0);assert.equal(cap.diagnostics.length,0);near(area(cap.triangles),16/2*8*8*Math.sin(2*Math.PI/16),1e-5);
});
test('Even-odd torus section cap preserves the annular hole',()=>{
 const f=fixture(body(torusMesh(15,4,32,12)));const cap=sectionGeometry(f.scene,{normal:V3(0,0,1),offset:0});assert.ok(cap.triangles.length>0);assert.equal(cap.diagnostics.length,0);near(area(cap.triangles),32/2*Math.sin(2*Math.PI/32)*(19*19-11*11),1e-4);
 for(const t of cap.triangles){const p=t.vertices.reduce((a,b)=>V3(a.x+b.x/3,a.y+b.y/3,a.z+b.z/3),V3());assert.ok(Math.hypot(p.x,p.y)>10.5);}
});
test('Open section contours diagnose uncapped geometry rather than fabricating solids',()=>{
 const f=fixture();f.scene.triangles=f.scene.triangles.filter(t=>t.face!==0);const cap=sectionGeometry(f.scene,{normal:V3(1,0,0),offset:10});assert.equal(cap.triangles.length,0);assert.ok(cap.diagnostics.length);
});
test('Section budgets reject pathological contour growth deterministically',()=>{const f=fixture();const c=sectionGeometry(f.scene,{normal:V3(1,0,0),offset:10},{maxSegments:1});assert.equal(c.triangles.length,0);assert.match(c.diagnostics[0].message,/budget/);});
test('Caps are render-only and do not change bounds, source mesh or exported topology',()=>{const f=fixture();const before=JSON.stringify(f.scene);const p=prepareRenderScene(f.scene,normalizeDisplaySettings(),{normal:V3(1,0,0),offset:10});assert.ok(p.triangles.some(t=>t.cap));assert.equal(JSON.stringify(f.scene),before);assert.equal(p.bounds,f.scene.bounds);assert.equal(p.items,f.scene.items);assert.equal(surfaceAlpha(p.triangles.find(t=>t.cap),{style:'xray',xrayOpacity:.1}),1);});
test('Large WCS origins are rebased before float32 vertex upload',()=>{const f=fixture(body(transformMesh(boxMesh(20,16,14),translation3(1e9,-2e9,3e9))));const p=prepareRenderScene(f.scene,normalizeDisplaySettings());const [surfaces,edges]=packRenderData(p);assert.equal(surfaces.length,p.triangles.length*51);assert.equal(edges.length,p.lines.length*21);for(let i=0;i<surfaces.length;i+=17)assert.ok(Math.abs(surfaces[i])<1000);});
test('Near-plane clipping interpolates positions and normals before projection',()=>{const n=V3(0,0,1);const p=clipSurface([{p:V3(-1,0,-1),n},{p:V3(1,0,1),n},{p:V3(0,1,1),n}],[{n:V3(0,0,-1),w:0}]);assert.equal(p.length,4);assert.ok(p.every(v=>v.p.z>=0));});
test('Perspective and section near clipping produce finite bounded raster images',()=>{const f=fixture();f.camera.perspective=true;f.camera.distance=4;const a=render(f,'realistic',{}, {normal:V3(1,0,0),offset:10});assert.equal(a.pixels.length,160*144*4);assert.ok(a.depth.every(v=>v===Infinity||Number.isFinite(v)));});
test('Thick edge rendering remains bounded for distant line projections',()=>{const f=fixture();f.scene.lines.push({id:'far',a:V3(-1e12,-1e12,5),b:V3(1e12,1e12,5),color:'#000000'});const a=render(f,'wireframe',{edgeWidth:5});assert.ok(a.pixels.length);});
test('Ambient occlusion and shadows are real image effects',()=>{
 const f=fixture(box(),body(transformMesh(boxMesh(8,8,20),translation3(25,0,0)),'b'));const settings=normalizeDisplaySettings({style:'shaded',grid:false,ground:true,shadows:true,ambientOcclusion:true,aoRadius:.3});const scene=prepareRenderScene(f.scene,settings);const light=new OrbitCamera({yaw:Math.atan2(-.6,-.3),pitch:Math.asin(1/Math.hypot(.3,.6,1))});light.resize(128,128);light.fit(scene.points);const map=softwareShadowMap(scene,light,settings,null,128);assert.ok(map.depth.some(Number.isFinite));const a=rasterizeScene(scene,f.camera,{width:160,height:144,style:'shaded',settings,shadowMap:map}),b=render(f,'shaded',{ground:true});assert.ok(differs(a,b)>100);
});
test('GGX metallic, roughness and exposure controls produce bounded distinct radiance',()=>{
 const t={color:'#cc7733',material:{color:'#cc7733',metallic:1,roughness:.2,opacity:1,emission:0}},n=V3(0,0,1),v=V3(0,0,1),s=normalizeDisplaySettings({style:'realistic'});const a=shadeSurface3D(t,n,v,s),b=shadeSurface3D({...t,material:{...t.material,metallic:0,roughness:.9}},n,v,s);assert.ok(a.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.notDeepEqual(a,b);assert.notDeepEqual(a,shadeSurface3D(t,n,v,{...s,exposure:2}));
});
for(const binary of [false,true])test(`Material and portable display presets survive ${binary?'binary':'ASCII'} DXF application metadata`,()=>{
 const f=fixture(box('a',{opacity:.42,appearance3d:{color:'#c88455',metallic:.9,roughness:.25,opacity:.42,emission:1}}));f.document.metadata.display3d=normalizeDisplaySettings({style:'realistic'});f.document.metadata.displayPresets3d=[{name:'Studio',settings:f.document.metadata.display3d}];const read=parseDXF(binary?writeDXFBinary(f.document):writeDXF(f.document));const e=read.entities.find(e=>e.id==='a');assert.ok(e);assert.deepEqual(e.appearance3d,f.document.entities[0].appearance3d);assert.equal(read.metadata.display3d.style,'realistic');assert.equal(read.metadata.displayPresets3d[0].name,'Studio');
});
test('Nonfinite and excessive software sizes reject before allocating frame buffers',()=>{const f=fixture();for(const width of [0,-1,Infinity,NaN,9e6])assert.throws(()=>rasterizeScene(f.scene,f.camera,{width,height:144}),/pixels/);});

test('Native color edits remain authoritative over previously assigned material color',()=>{const e=box('paint',{color:'#123456',appearance3d:{color:'#abcdef',metallic:.8,roughness:.2}});const f=fixture(e);assert.equal(f.scene.items[0].material.color,'#123456');assert.equal(f.scene.items[0].material.metallic,.8);});
test('Native line transparency is packed without changing geometry',()=>{const e=entity('LINE',{id:'line',a:V3(0,0,0),b:V3(10,10,10),color:'#445566',opacity:.25});const f=fixture(e);const [_,edges]=packRenderData(f.scene);near(edges[15],.25);assert.equal(edges.length,21);});

test('Material study is editable native feature geometry with a portable default',()=>{const d=createRenderingStudy();assert.equal(d.entities.length,19);assert.ok(d.entities.every(e=>e.type==='MESH'&&e.feature3d));assert.equal(d.metadata.display3d.style,'realistic');assert.ok(buildScene3D(d).triangles.length>1000);});
for(const mobile of [false,true])for(const transparent of [false,true])test(`Attachment memory budget respects ${mobile?'touch':'desktop'} limits with transparency=${transparent}`,()=>{const s=normalizeDisplaySettings({quality:'high',ambientOcclusion:true,shadows:true});const size=renderSize3D(8000,5000,3,s,transparent,mobile);assert.ok(size.estimatedAttachmentBytes<=(mobile?96:256)*1024*1024);assert.ok(size.width>=1&&size.height>=1);assert.ok(size.scale<1);});
test('Opaque display receives a higher resolution budget than weighted transparency',()=>{const s=normalizeDisplaySettings({quality:'high'});assert.ok(renderSize3D(4000,3000,2,s,false,true).width>renderSize3D(4000,3000,2,s,true,true).width);assert.throws(()=>renderSize3D(0,5,1,s),/Invalid/);});


test('Native opacity changes remain authoritative over old material metadata',()=>{const f=fixture(box('transparent',{opacity:.7,appearance3d:{opacity:.2,metallic:.6,roughness:.4}}));near(f.scene.items[0].material.opacity,.7);});
test('World-normal inspection is independent of viewing direction',()=>{const t={color:'#336699',material:normalizeMaterial({},'#336699')},s=normalizeDisplaySettings({style:'normals'});assert.deepEqual(shadeSurface3D(t,V3(0,0,1),V3(0,0,1),s),shadeSurface3D(t,V3(0,0,1),V3(0,0,-1),s));});
test('Material study ring uses declared dimensions, not primitive defaults',()=>{const d=createRenderingStudy(),e=d.entities.find(e=>e.label==='Section contour and silhouette ring')||d.entities.at(-1);const width=Math.max(...e.points.map(p=>p.x))-Math.min(...e.points.map(p=>p.x));near(width,44);assert.equal(e.feature3d.parameters.major,18);});

test('Extreme-aspect viewports respect attachment dimension limits and nonzero memory accounting',()=>{const s=normalizeDisplaySettings();for(const [w,h]of [[1e8,1],[1,1e8]]){const size=renderSize3D(w,h,2,s,false,true,4096);assert.ok(size.width<=4096&&size.height<=4096);assert.ok(size.width>0&&size.height>0);assert.ok(size.estimatedAttachmentBytes>=56);}});
