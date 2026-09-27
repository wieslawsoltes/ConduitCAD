import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, entity, circle } from '@conduitcad/model';
import { V3, add3, mul3, bounds3, meshProperties, boxMesh } from '@conduitcad/geometry3d';
import { addFeature, editFeature, faceFrame3, facePoint3, controlPoints3 } from '@conduitcad/modeling';
import { OrbitCamera } from '@conduitcad/renderer3d';
import { evaluateExpression } from '@conduitcad/constraints';
import { History } from '@conduitcad/history';
import { parseDXF, writeDXF, writeDXFBinary } from '@conduitcad/dxf';
import { VisualEditSession, VISUAL_TOOLS, visualTool3, visibleFields3, visualHandles3, snapValue3, expressionDelta3, beginAxisDrag3, updateAxisDrag3, beginPlaneDrag3, updatePlaneDrag3, beginAngleDrag3, updateAngleDrag3, rayPlane3, perpendicularAxes3 } from '@conduitcad/manipulation3d';
const close = (a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const camera=(perspective=false)=>{const c=new OrbitCamera({perspective});c.resize(900,700);return c;};
const stock=()=>{const d=createDocument('Visual test');const e=addFeature(d,'box',{width:100,depth:80,height:40});return {d,e};};
const rect=(z=0)=>entity('LWPOLYLINE',{points:[{x:0,y:0},{x:30,y:0},{x:30,y:20},{x:0,y:20}],closed:true,elevation:z});
for(const kind of ['box','wedge','cylinder','cone','sphere','torus'])test(`visual ${kind} is transient, cached and atomically committable`,()=>{
 const d=createDocument('New'),s=new VisualEditSession(d,kind),before=JSON.stringify(d);
 const a=s.evaluate();assert.equal(JSON.stringify(d),before);assert.equal(a.entities.length,1);assert.equal(s.evaluate(),a);assert.equal(s.evaluations,1);
 assert.ok(visualHandles3(s,camera()).length>0);const id=s.resultId;s.set(kind==='torus'?'major':kind==='box'||kind==='wedge'?'width':'radius',65);
 assert.notEqual(s.evaluate(),a);assert.equal(s.resultId,id);const result=s.commit(d);assert.equal(result.id,id);assert.equal(d.entities.length,1);assert.ok(meshProperties(result).closed);
});
for(const perspective of [false,true])for(const axis of [V3(1,0,0),V3(0,1,0),V3(0,0,1)])test(`ray-based ${perspective?'perspective':'orthographic'} axis ${JSON.stringify(axis)}`,()=>{
 const c=camera(perspective),o=V3(20,30,10),start=c.project(o),end=c.project(add3(o,mul3(axis,23.5)));
 close(updateAxisDrag3(beginAxisDrag3(c,o,axis,start),end),23.5);
});
for(const offset of [0,1e8,1e10])test(`large-origin gesture remains translated, origin ${offset}`,()=>{
 const c=camera(),o=V3(offset,offset,-offset);c.target=o;const start=c.project(o),a=V3(1,0,0),end=c.project(add3(o,mul3(a,15)));
 close(updateAxisDrag3(beginAxisDrag3(c,o,a,start),end),15,1e-4);
});
test('end-on axis has finite explicit vertical fallback',()=>{const c=camera();c.view('top');const s=c.project(V3()),g=beginAxisDrag3(c,V3(),V3(0,0,1),s);assert.ok(g.fallback);close(updateAxisDrag3(g,{x:s.x,y:s.y-70}),22);});
test('drag camera is frozen until release',()=>{const c=camera(),p=c.project(V3()),q=c.project(V3(10,0,0)),g=beginAxisDrag3(c,V3(),V3(1,0,0),p);c.orbit(200,40);close(updateAxisDrag3(g,q),10);});
for(const perspective of [false,true])test(`face-local plane motion ${perspective}`,()=>{const c=camera(perspective),o=V3(),a=c.project(o),b=c.project(V3(12,23));const g=beginPlaneDrag3(c,o,V3(1,0,0),V3(0,1,0),a),r=updatePlaneDrag3(g,b);close(r.u,12);close(r.v,23);});
test('edge-on plane is rejected, not projected to infinity',()=>{const c=camera();c.view('front');assert.throws(()=>beginPlaneDrag3(c,V3(),V3(1,0,0),V3(0,1,0),c.project(V3())),/edge-on/);});
test('plane basis requires orthogonality',()=>assert.throws(()=>beginPlaneDrag3(camera(),V3(),V3(1,0,0),V3(1,1,0),{x:0,y:0}),/orthogonal/));
test('ray plane rejects intersections behind the eye',()=>assert.equal(rayPlane3({origin:V3(0,0,10),direction:V3(0,0,1)},V3(),V3(0,0,1)),null));
test('angle gesture unwraps two turns without +/-180 discontinuity',()=>{
 const c=camera();c.view('top');const g=beginAngleDrag3(c,V3(),V3(1,0,0),V3(0,1,0),c.project(V3(30,0)));let out;
 for(let a=10;a<=720;a+=10)out=updateAngleDrag3(g,c.project(V3(30*Math.cos(a*Math.PI/180),30*Math.sin(a*Math.PI/180))));close(out,720);
});
test('invalid gesture and snap samples cannot leak NaN',()=>{assert.throws(()=>snapValue3(Infinity,1));assert.throws(()=>snapValue3(1,-1));assert.throws(()=>beginAxisDrag3(camera(),V3(),V3(),{x:0,y:0}));const c=camera(),g=beginAxisDrag3(c,V3(),V3(1,0,0),c.project(V3()));assert.throws(()=>updateAxisDrag3(g,{x:NaN,y:0}));});
test('snap supports negatives and fine floating increments',()=>{close(snapValue3(-4.2,1),-4);close(snapValue3(.37,.05),.35);close(snapValue3(.37,0),.37);});
test('dragging a parameter expression preserves its upstream dependency',()=>{const v=expressionDelta3('Span / 2',12,50);assert.equal(v,'(Span / 2) + 12');assert.equal(evaluateExpression(v,{Span:120}),72);assert.equal(expressionDelta3('Span',0,60),'Span');assert.equal(expressionDelta3(' 2e1 ',3,20),23);});
test('expression drag samples start from the pristine expression, not nested deltas',()=>{const d=createDocument('Expr');d.parameters={Span:100};const s=new VisualEditSession(d,'box',{parameters:{width:'Span/2'}});for(let i=1;i<=20;i++)s.dragValue('width',i,'Span/2',50);assert.equal(s.parameters.width,'(Span/2) + 20');close(s.value('width'),70);});
test('draft undo/redo does not touch document history',()=>{const d=createDocument('Draft'),s=new VisualEditSession(d,'box'),before=JSON.stringify(d);s.checkpoint();s.set('width',150);assert.ok(s.undo());assert.equal(s.value('width'),100);assert.ok(s.redo());assert.equal(s.value('width'),150);assert.equal(JSON.stringify(d),before);});
test('invalid preview clears prior geometry and recovers after correction',()=>{const d=createDocument('Invalid'),s=new VisualEditSession(d,'box');s.evaluate();s.set('height',-1);assert.equal(s.preview,null);assert.throws(()=>s.evaluate(),/positive/);assert.equal(s.preview,null);s.set('height','45');assert.equal(s.evaluate().entities.length,1);});
test('unknown and oversized values are rejected before invalidating',()=>{const s=new VisualEditSession(createDocument('D'),'box');assert.throws(()=>s.set('__proto__',1));assert.throws(()=>s.set('width','1'.repeat(1025)));assert.equal(s.revision,0);});
for(const alter of [d=>d.name='Changed',d=>d.entities.push(rect()),d=>d.parameters.Span=2,d=>d.version++])test(`stale-source guard catches ${alter.toString()}`,()=>{const d=createDocument('Stale'),s=new VisualEditSession(d,'box');s.evaluate();alter(d);const before=JSON.stringify(d);assert.throws(()=>s.commit(d),/changed/);assert.equal(JSON.stringify(d),before);});
test('different document with the same JSON cannot receive a draft',()=>{const d=createDocument('A'),s=new VisualEditSession(d,'box');assert.throws(()=>s.commit(structuredClone(d)),/changed/);});
test('cancel closes session and releases document references',()=>{const s=new VisualEditSession(createDocument('Cancel'),'box');s.evaluate();s.cancel();assert.equal(s.preview,null);assert.equal(s.base,null);assert.equal(s.source,null);assert.throws(()=>s.evaluate(),/closed/);});
test('all preview samples become one undoable host transaction',()=>{
 let d=createDocument('Undo');const before=JSON.stringify(d),history=new History({capture:()=>d,restore:v=>{d=v;}}),s=new VisualEditSession(d,'box');
 for(let i=0;i<40;i++){s.set('width',100+i);s.evaluate();}assert.equal(history.undoStack.length,0);history.run('Visual box',()=>s.commit(d));assert.equal(history.undoStack.length,1);assert.ok(history.undo());assert.equal(JSON.stringify(d),before);assert.ok(history.redo());assert.equal(d.entities[0].feature3d.parameters.width,139);
});
for(const extent of [0,1,2])test(`extrusion ${extent} handles follow native extents`,()=>{
 const d=createDocument('Extrude'),e=rect();d.entities.push(e);const s=new VisualEditSession(d,'extrude',{inputs:[e.id],parameters:{extent,height:40,distance2:10,startOffset:5}});const out=s.evaluate().entities.at(-1),b=bounds3(out.points),handles=visualHandles3(s,camera());
 close(b.min.z,extent===1?-15:extent===2?-5:5);close(b.max.z,extent===1?25:45);assert.equal(handles.find(h=>h.field==='height').factor,extent===1?2:1);assert.equal(handles.some(h=>h.field==='distance2'),extent===2);
});
test('native tilted profile handles use OCS normal',()=>{const d=createDocument('Tilt'),e=circle({x:0,y:0,z:0},10);e.extrusion=V3(1,0,0);d.entities.push(e);const s=new VisualEditSession(d,'extrude',{inputs:[e.id],parameters:{height:20}});s.evaluate();const h=visualHandles3(s,camera()).find(h=>h.field==='height');close(h.axis.x,1);close(h.point.x,20);});
test('new body operation removes a stale extrusion target',()=>{const {d,e}=stock(),p=rect();d.entities.push(p);const s=new VisualEditSession(d,'extrude',{inputs:[p.id],parameters:{operation:1}});s.setInput(1,e.id);s.set('operation',0);assert.deepEqual(s.inputs,[p.id]);assert.equal(s.evaluate().entities.at(-1).feature3d.inputs.length,1);});
test('missing extrusion target cannot Apply an old new-body preview',()=>{const d=createDocument('E'),p=rect();d.entities.push(p);const s=new VisualEditSession(d,'extrude',{inputs:[p.id]});s.evaluate();s.set('operation',2);assert.throws(()=>s.evaluate(),/source geometry/);assert.equal(s.preview,null);});
for(const face of [0,1,2,3,4,5])test(`face ${face}: hole placement and local dimensions`,()=>{
 const {d,e}=stock(),frame=faceFrame3(e,face),s=new VisualEditSession(d,'hole',{inputs:[e.id],hit:{id:e.id,face,point:frame.origin},parameters:{diameter:8,segments:12}}),before=JSON.stringify(d);const out=s.evaluate().entities.at(-1);assert.equal(JSON.stringify(d),before);assert.ok(meshProperties(out).volume<100*80*40);const h=visualHandles3(s,camera()).find(h=>h.field==='diameter');assert.equal(h.factor,2);assert.ok(visualHandles3(s,camera()).some(h=>h.kind==='plane'));
});
test('face input validation is atomic when an invalid face is picked',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'hole',{inputs:[e.id]}),before=s.snapshot();assert.throws(()=>s.setInput(0,e.id,{id:e.id,face:100}),/face/);assert.deepEqual(s.snapshot(),before);});
test('face profile is native editable CAD geometry',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'face-profile',{inputs:[e.id],hit:{id:e.id,face:1,point:faceFrame3(e,1).origin}});const out=s.evaluate().entities.at(-1);assert.equal(out.type,'LWPOLYLINE');close(out.elevation,40);s.set('shape',1);assert.equal(s.evaluate().entities.at(-1).type,'CIRCLE');});
for(const plane of [0,1,2])for(const shape of [0,1])test(`native ground sketch ${plane}/${shape}`,()=>{const d=createDocument('Sketch'),s=new VisualEditSession(d,'sketch-profile',{parameters:{plane,shape,x:11,y:12,z:13}});const e=s.evaluate().entities[0];assert.equal(e.type,shape?'CIRCLE':'LWPOLYLINE');assert.ok(e.extrusion);assert.equal(d.entities.length,0);assert.ok(visualHandles3(s,camera()).length);});
test('press pull preview edits the chosen planar face only',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'offset-face',{inputs:[e.id],parameters:{face:1,distance:12}});const b=bounds3(s.evaluate().entities.at(-1).points);close(b.max.z,52);close(b.min.z,0);assert.equal(visualHandles3(s,camera())[0].axis.z,1);});
for(const mode of ['move','rotate','scale'])test(`transform ${mode} supplies a complete axis triad`,()=>{const {d,e}=stock(),s=new VisualEditSession(d,'transform',{inputs:[e.id]});assert.equal(visualHandles3(s,camera(),mode).filter(h=>h.field).length,3);});
test('new transforms rotate around the selected body center, old transforms remain world-origin',()=>{
 const {d,e}=stock();const s=new VisualEditSession(d,'transform',{inputs:[e.id]});s.set('rz',180);const b=bounds3(s.evaluate().entities.at(-1).points);close(b.min.x,0);close(b.max.x,100);close(b.min.y,0);close(b.max.y,80);
 const old=addFeature(d,'transform',{rz:180},[e.id]);const ob=bounds3(old.points);close(ob.min.x,-100);close(ob.min.y,-80);
});
test('direct vertex mode requires explicit history detachment',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'vertex',{inputs:[e.id],hit:{id:e.id,vertex:6}}),before=JSON.stringify(d);s.set('z',55);assert.throws(()=>s.evaluate(),/detaching/);assert.equal(JSON.stringify(d),before);s.set('detach',1);const result=s.evaluate().entities.find(x=>x.id===e.id);assert.equal(result.feature3d,undefined);close(controlPoints3(result)[6].z,55);assert.equal(d.entities[0].feature3d.kind,'box');});
test('planar vertices cannot escape their native OCS plane',()=>{const d=createDocument('P'),e=rect();d.entities.push(e);const s=new VisualEditSession(d,'vertex',{inputs:[e.id]});s.set('z',2);assert.throws(()=>s.evaluate(),/plane/);assert.equal(d.entities[0].elevation,0);});
test('existing feature edits regenerate downstream features without replacing identities',()=>{const {d,e}=stock(),result=addFeature(d,'linear-pattern',{count:2,dx:150},[e.id]),s=new VisualEditSession(d,'box',{id:e.id});s.set('height',65);const preview=s.evaluate();close(bounds3(preview.entities.find(x=>x.id===result.id).points).max.z,65);assert.equal(s.resultId,e.id);assert.equal(d.entities[0].feature3d.parameters.height,40);});
test('locked existing feature cannot enter visual authoring',()=>{const {d,e}=stock();d.layers.find(l=>l.name===e.layer).locked=true;assert.throws(()=>new VisualEditSession(d,'box',{id:e.id}),/locked/);});
test('duplicate and self references are rejected before regeneration',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'union',{inputs:[e.id,e.id]});assert.throws(()=>s.evaluate(),/distinct/);});
test('choice fields and detail fields follow the actual parameter values',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'hole',{inputs:[e.id]});assert.ok(!visibleFields3(s).some(f=>f.name==='depth'));s.set('through',0);s.set('holeType',1);assert.ok(visibleFields3(s).some(f=>f.name==='counterDepth'));assert.ok(!visibleFields3(s).some(f=>f.name==='sinkAngle'));});
test('every visual tool has a discoverable unique name',()=>{assert.equal(new Set(VISUAL_TOOLS.map(t=>t.id)).size,VISUAL_TOOLS.length);assert.equal(VISUAL_TOOLS.length,22);assert.throws(()=>visualTool3('unknown'));});
for(const binary of [false,true])test(`WYSIWYG result survives native ${binary?'binary':'ASCII'} DXF and keeps feature metadata`,()=>{const d=createDocument('Export'),s=new VisualEditSession(d,'box',{parameters:{width:85,height:32}});s.commit(d);const dx=binary?writeDXFBinary(d):writeDXF(d),read=parseDXF(dx),e=read.entities.find(e=>e.type==='MESH');assert.ok(e);close(bounds3(e.points).max.x,85);assert.equal(e.feature3d.kind,'box');});

test('canvas-picked transform source initializes center pivot atomically',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'transform',{inputs:['']});s.setInput(0,e.id);close(s.value('px'),50);close(s.value('py'),40);close(s.value('pz'),20);assert.ok(s.evaluate());});
test('visual tool descriptors and nested options are immutable',()=>{assert.throws(()=>VISUAL_TOOLS[0].fields.push({}));assert.throws(()=>visualTool3('extrude').fields.find(f=>f.name==='extent').options.push('bad'));});

import { layoutHandles3 } from '@conduitcad/manipulation3d';
for(const [width,height] of [[320,422],[390,698],[844,260],[1024,630],[1400,840]])test(`screen layout ${width}×${height}: badges do not mask 44px handle targets`,()=>{
 const hs=Array.from({length:6},(_,i)=>({id:String(i),x:width/2,y:height/2,hasLabel:true,labelWidth:110,labelHeight:44}));
 const top=60,bottom=height-110,rs=layoutHandles3(hs,{width,height,top,bottom});
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(const r of rs.filter(x=>x.visible)){assert.ok(r.x>=22&&r.x<=width-22&&r.y>=top+22&&r.y<=bottom-22);if(r.label){for(const q of rs.filter(x=>x.visible))assert.ok(!overlap(r.label,{x:q.x-22,y:q.y-22,w:44,h:44}));}}
});
test('unusable viewport hides anchors rather than spilling into toolbars',()=>{assert.ok(layoutHandles3([{id:'a',x:0,y:0}],{width:30,height:30}).every(r=>!r.visible));});

test('fixed-arity input setters reject an invalid slot without mutation',()=>{const {d,e}=stock(),s=new VisualEditSession(d,'transform',{inputs:[e.id]}),before=s.snapshot();assert.throws(()=>s.setInput(2,e.id),/range/);assert.deepEqual(s.snapshot(),before);});
test('nonfinite ray data fails explicitly',()=>{assert.throws(()=>rayPlane3({origin:V3(NaN,0,1),direction:V3(0,0,-1)},V3(),V3(0,0,1)),/finite/);});
