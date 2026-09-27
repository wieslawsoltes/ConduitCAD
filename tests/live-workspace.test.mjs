import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, entity, circle, clone, regenerateDimensions } from '@conduitcad/model';
import { ParameterEditSession } from '@conduitcad/manipulation2d';
import { SpatialPathSession } from '@conduitcad/manipulation3d';
import { addFeature, regenerateFeatures, spatialPathPoints, spatialPathUpdates, setControlPoint3 } from '@conduitcad/modeling';
import { evaluateExpression, ConstraintSolver, evaluateCalculations } from '@conduitcad/constraints';
import { meshProperties } from '@conduitcad/geometry3d';
import { writeDXF, writeDXFBinary, parseDXF } from '@conduitcad/dxf';
import { History } from '@conduitcad/history';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function design() { const d=createDocument('Live design');d.parameters={Size:40,Half:'Size / 2'};d.entities=[circle({x:0,y:0},20,{parametric:{radius:'Half'}})];addFeature(d,'box',{x:70,width:'Size',depth:30,height:'Half'});return d; }
function process(d) { for(const e of d.entities) if(e.type==='CIRCLE'&&e.parametric?.radius)e.r=evaluateExpression(e.parametric.radius,d.parameters);const r=new ConstraintSolver().solve(d.entities,d.constraints,d.parameters);if(!r.converged)throw new Error('Constraint conflict');evaluateCalculations(d.entities,d.constraints,d.parameters);regenerateFeatures(d);regenerateDimensions(d); }
const row=(s,name)=>s.rows.find(r=>r.name===name).id;
function pathFixture() { const d=createDocument('Spatial');d.parameters={Rise:30,Run:80};const s=new SpatialPathSession(d);s.insert(0,{x:0,y:0,z:0});s.insert(1,{x:0,y:0,z:'Rise'});s.insert(2,{x:'Run',y:0,z:'Rise'});s.commit(d);return {d,id:s.id}; }

test('whole-design parameter preview changes dependent 2D and 3D without source mutation',()=>{
 const d=design(),before=JSON.stringify(d),s=new ParameterEditSession(d,{process});s.set(row(s,'Size'),{expression:'60'});const p=s.evaluate();near(p.entities[0].r,30);near(meshProperties(p.entities[1]).volume,60*30*30);assert.equal(JSON.stringify(d),before);assert.equal(s.evaluate(),p);assert.equal(s.evaluations,1);s.commit(d);near(d.entities[0].r,30);assert.equal(d.parameters.Size,'60');
});
test('unchanged parameter records and object annotations survive expression changes',()=>{const d=design();d.parameters={Size:{expression:'40',unit:'mm',description:'Outer size'},Other:{value:12,ui:{group:'Geometry'}},Number:7,String:'7'};const s=new ParameterEditSession(d);assert.equal(s.changed,false);s.set(row(s,'Size'),{expression:'50'});s.set(row(s,'Other'),{expression:'14'});s.commit(d);assert.deepEqual(d.parameters,{Size:{expression:'50',unit:'mm',description:'Outer size'},Other:{value:'14',ui:{group:'Geometry'}},Number:7,String:'7'});});
test('renaming follows stable row metadata and validates all dependencies before commit',()=>{const d=design(),s=new ParameterEditSession(d);s.set(row(s,'Size'),{name:'Span'});assert.throws(()=>s.evaluate(),/Unknown parameter/);s.set(row(s,'Half'),{expression:'Span / 2'});s.commit(d);assert.equal(d.parameters.Span,40);assert.equal(d.parameters.Size,undefined);});
test('cyclic parameter changes invalidate previous good preview',()=>{const d=design(),s=new ParameterEditSession(d,{process});s.evaluate();s.set(row(s,'Size'),{expression:'Half*2'});assert.equal(s.preview,null);assert.throws(()=>s.evaluate(),/cycle/);assert.equal(s.preview,null);assert.equal(s.values,null);assert.throws(()=>s.commit(d),/cycle/);near(d.entities[0].r,20);});
for(const name of ['constructor','__proto__','prototype','sin','pi','bad name','0bad',''])test(`parameter name guard rejects ${JSON.stringify(name)}`,()=>{const s=new ParameterEditSession(design());s.set(s.rows[0].id,{name});assert.throws(()=>s.evaluate(),/parameter/);});
test('duplicate and constraint-measurement names are not silently shadowed',()=>{const d=design();d.constraints.push({name:'Measured'});const s=new ParameterEditSession(d);s.add('Size',10);assert.throws(()=>s.evaluate(),/duplicate/);s.remove(s.rows.at(-1).id);s.add('Measured',12);assert.throws(()=>s.evaluate(),/reserved/);});
test('parameter deletion preserves invalid draft for repair without modifying design',()=>{const d=design(),s=new ParameterEditSession(d,{process}),before=s.snapshot();s.remove(row(s,'Size'));s.checkpoint(before);assert.throws(()=>s.evaluate());assert.ok(s.undo());s.evaluate();near(s.values.Half,20);assert.ok(s.redo());assert.throws(()=>s.evaluate());});
test('parameter scrubbing retains its original formula without accumulating nesting',()=>{const s=new ParameterEditSession(design()),id=row(s,'Half'),before=s.snapshot();for(let i=1;i<=30;i++)s.scrub(id,i,20,before);assert.equal(s.row(id).expression,'(Size / 2) + 30');near(s.evaluate().parameters.Size,40);near(s.values.Half,50);});
test('parameter snapshots are detached and histories bounded',()=>{const s=new ParameterEditSession(design()),id=row(s,'Size');const copy=s.snapshot();copy[0].name='Changed';assert.equal(s.rows[0].name,'Size');for(let i=0;i<80;i++){const b=s.snapshot();s.set(id,{expression:String(i)});s.checkpoint(b);}assert.equal(s.undoStack.length,60);s.undo();const b=s.snapshot();s.set(id,{expression:'90'});s.checkpoint(b);assert.equal(s.redoStack.length,0);});
for(const mutation of [d=>d.version++,d=>d.parameters.Size=41])test('parameter source identity and complete signature reject concurrent edits '+mutation,()=>{const d=design(),s=new ParameterEditSession(d,{process});s.evaluate();assert.throws(()=>s.commit(clone(d)),/changed/);mutation(d);const before=JSON.stringify(d);assert.throws(()=>s.commit(d),/changed/);assert.equal(JSON.stringify(d),before);});
test('global parameter changes cannot bypass locked dependent geometry',()=>{const d=design();d.entities[1].locked=true;const s=new ParameterEditSession(d,{process});s.set(row(s,'Size'),{expression:'80'});assert.throws(()=>s.evaluate(),/locked/);assert.equal(s.preview,null);near(d.entities[0].r,20);});
test('unrelated parameter changes can retain locked geometry with regeneration bookkeeping',()=>{const d=design();d.entities[1].locked=true;const s=new ParameterEditSession(d,{process});s.add('Independent',77);s.evaluate();s.commit(d);assert.equal(d.parameters.Independent,'77');});
test('parameter apply is one host history transaction',()=>{let d=design();const h=new History({capture:()=>d,restore:value=>d=value}),s=new ParameterEditSession(d,{process});s.set(row(s,'Size'),{expression:'70'});h.run('Parameters',()=>s.commit(d));assert.ok(h.canUndo);near(d.entities[0].r,35);h.undo();near(d.entities[0].r,20);h.redo();near(d.entities[0].r,35);});
test('ended parameter session rejects use and releases document references',()=>{const s=new ParameterEditSession(design());s.cancel();assert.equal(s.source,null);assert.equal(s.base,null);assert.throws(()=>s.evaluate(),/ended/);});
test('parameter schema input is bounded and never executes arbitrary code',()=>{const s=new ParameterEditSession(design());assert.throws(()=>s.set(s.rows[0].id,{other:'x'}));assert.throws(()=>s.set(s.rows[0].id,{expression:'1'.repeat(4097)}));s.set(s.rows[0].id,{expression:'globalThis.process.exit()'});assert.throws(()=>s.evaluate());assert.throws(()=>s.restore([{id:'x',name:'A',expression:'1'},{id:'x',name:'B',expression:'2'}]));});

test('new spatial path stages incomplete points, stable entity id and evaluated WCS positions',()=>{const d=createDocument(),s=new SpatialPathSession(d),before=JSON.stringify(d);assert.throws(()=>s.evaluate(),/vertices/);s.insert(0,{x:0,y:0,z:0});assert.throws(()=>s.evaluate());s.insert(1,{x:1,y:'2+3',z:8});const p=s.evaluate();assert.equal(p.entities[0].id,s.id);assert.equal(p.entities[0].flags,8);assert.deepEqual(p.entities[0].points[1],{x:1,y:5,z:8});assert.equal(JSON.stringify(d),before);assert.equal(s.evaluate(),p);s.commit(d);assert.equal(d.entities.length,1);});
test('spatial path expressions regenerate with design parameters',()=>{const {d,id}=pathFixture();d.parameters.Rise=55;const updates=spatialPathUpdates(d);assert.equal(d.entities[0].points[1].z,30);assert.equal(updates.get(id).points[1].z,55);assert.deepEqual(regenerateFeatures(d).updated,[id]);assert.equal(d.entities[0].points[1].z,55);});
test('native vertex edit replaces only that vertex expression so subsequent regeneration keeps the edit',()=>{const {d}=pathFixture();setControlPoint3(d.entities[0],1,{x:12,y:9,z:25});regenerateFeatures(d);assert.deepEqual(d.entities[0].points[1],{x:12,y:9,z:25});assert.equal(d.entities[0].parametric.coordinates[2].z,'Rise');});
test('insertion, removal and undo retain unaffected native vertex metadata',()=>{const {d,id}=pathFixture();d.entities[0].points[1].handle='ABC';d.entities[0].points[2].extra={retained:[1,2]};const s=new SpatialPathSession(d,{id}),before=s.snapshot();s.insert(1,{x:0,y:0,z:10});s.checkpoint(before);let p=s.evaluate().entities[0];assert.equal(p.points[2].handle,'ABC');assert.deepEqual(p.points[3].extra,{retained:[1,2]});s.remove(0);p=s.evaluate().entities[0];assert.equal(p.points[1].handle,'ABC');s.undo();p=s.evaluate().entities[0];assert.equal(p.points[1].handle,'ABC');});
test('expression-preserving XYZ path drag is based on gesture start and atomically rejects nonfinite delta',()=>{const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id}),before=s.snapshot();for(let i=0;i<15;i++)s.drag(1,{x:i,z:i},before);assert.equal(s.state.coordinates[1].z,'(Rise) + 14');const current=JSON.stringify(s.state);assert.throws(()=>s.drag(1,{x:10,z:NaN},before));assert.equal(JSON.stringify(s.state),current);near(s.evaluate().entities[0].points[1].z,44);});
for(const points of [[{x:0,y:0,z:0}], [{x:0,y:0,z:0},{x:0,y:0,z:0}], [{x:0,y:0,z:0},{x:NaN,y:0,z:0}], [{x:0,y:0,z:0},{x:1e13,y:0,z:0}], [{x:0,y:0,z:0},{x:'unknown',y:0,z:0}]])test('invalid native path does not leave stale preview: '+JSON.stringify(points),()=>{assert.throws(()=>spatialPathPoints(points));});
test('closing requires three distinct consecutive vertices and no duplicate terminal point',()=>{const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});s.setClosed(true);s.commit(d);assert.equal(d.entities[0].flags,9);assert.equal(d.entities[0].closed,true);const s2=new SpatialPathSession(d,{id});s2.insert(3,{x:0,y:0,z:0});assert.throws(()=>s2.evaluate(),/repeat/);});
test('path edits regenerate downstream sweep while preserving source identity',()=>{const {d,id}=pathFixture();const profile=circle({x:0,y:0},2);d.entities.push(profile);const body=addFeature(d,'sweep',{segments:12},[profile.id,id]);const before=JSON.stringify(body.points),s=new SpatialPathSession(d,{id});s.set(2,'x','Run + 20');const p=s.evaluate();assert.notEqual(JSON.stringify(p.entities.find(e=>e.id===body.id).points),before);assert.equal(JSON.stringify(d.entities.find(e=>e.id===body.id).points),before);s.commit(d);assert.equal(d.entities.find(e=>e.id===id).model3dConsumed,true);});
test('path updates and features are atomic when a downstream feature fails',()=>{const {d,id}=pathFixture();addFeature(d,'box',{width:20,depth:20,height:20});d.parameters.Rise=80;d.entities[1].feature3d.parameters.width=-1;const before=JSON.stringify(d);assert.throws(()=>regenerateFeatures(d));assert.equal(JSON.stringify(d),before);});
test('malformed path expression count fails before any prepared update is published',()=>{const {d}=pathFixture();d.parameters.Rise=80;const extra=clone(d.entities[0]);extra.id='bad';extra.parametric.coordinates.pop();d.entities.push(extra);const before=JSON.stringify(d);assert.throws(()=>regenerateFeatures(d),/count/);assert.equal(JSON.stringify(d),before);});
test('locked path and dependent locked sweep reject visual editing',()=>{const {d,id}=pathFixture();d.entities[0].locked=true;assert.throws(()=>new SpatialPathSession(d,{id}),/locked/);d.entities[0].locked=false;const profile=circle({x:0,y:0},2);d.entities.push(profile);const body=addFeature(d,'sweep',{segments:12},[profile.id,id]);body.locked=true;const s=new SpatialPathSession(d,{id});s.set(2,'x',120);assert.throws(()=>s.evaluate(),/locked/);});
test('path source signature, layout, flags and output layer are guarded',()=>{const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});d.parameters.Rise=99;assert.throws(()=>s.commit(d),/changed/);assert.throws(()=>new SpatialPathSession(d,{layer:'Missing'}));d.entities[0].layout='Layout1';assert.throws(()=>new SpatialPathSession(d,{id}),/Model/);d.entities[0].layout='Model';d.entities[0].flags|=16;assert.throws(()=>new SpatialPathSession(d,{id}),/ordinary/);});
test('invalid path snapshots cannot forge original vertex metadata',()=>{const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id}),snapshot=s.snapshot();snapshot.origins[1]=0;assert.throws(()=>s.restore(snapshot),/provenance/);assert.throws(()=>s.set(4,'x',20));assert.throws(()=>s.insert(-1,{x:0,y:0,z:0}));assert.throws(()=>s.set(1,'x','1'.repeat(4097)));});
for(const [name,writer] of [['ASCII',writeDXF],['binary',writeDXFBinary]])test(`${name} DXF preserves native spatial path, XYZ expressions and later regeneration`,()=>{const {d}=pathFixture();const read=parseDXF(writer(d));const e=read.entities.find(e=>e.type==='POLYLINE');assert.ok(e.flags&8);assert.deepEqual(e.points.map(p=>[p.x,p.y,p.z]),[[0,0,0],[0,0,30],[80,0,30]]);assert.equal(e.parametric.coordinates[1].z,'Rise');read.parameters.Rise=65;regenerateFeatures(read);assert.equal(e.id,read.entities[0].id);near(read.entities[0].points[2].z,65);});
test('path draft history, closed lifecycle, and detached snapshots',()=>{const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});const b=s.snapshot();s.set(1,'z',90);s.checkpoint(b);s.undo();assert.equal(s.state.coordinates[1].z,'Rise');s.redo();assert.equal(s.state.coordinates[1].z,90);s.cancel();assert.equal(s.source,null);assert.throws(()=>s.evaluate(),/ended/);});
test('parameter-driven path and sweep update together in one parameter draft',()=>{const {d,id}=pathFixture();const profile=circle({x:0,y:0},2);d.entities.push(profile);const b=addFeature(d,'sweep',{segments:12},[profile.id,id]);const before=JSON.stringify(b.points);const s=new ParameterEditSession(d,{process});s.set(row(s,'Rise'),{expression:'75'});const p=s.evaluate();near(p.entities[0].points[2].z,75);assert.notEqual(JSON.stringify(p.entities.find(e=>e.id===b.id).points),before);near(d.entities[0].points[2].z,30);s.commit(d);near(d.entities[0].points[2].z,75);});

import { createLiveWorkspaceExample } from '../packages/workbench/src/live-workspace-example.js';
test('workshop has six native editable entities and independent repeatable geometry',()=>{const d=createLiveWorkspaceExample(),copy=createLiveWorkspaceExample();assert.equal(d.entities.length,6);assert.equal(d.entities.filter(e=>e.type==='MESH').length,2);assert.equal(d.entities.find(e=>e.id==='live-route').points[1].z,70);d.parameters.Rise={value:110};regenerateFeatures(d);assert.equal(d.entities.find(e=>e.id==='live-route').points[1].z,110);assert.equal(copy.entities.find(e=>e.id==='live-route').points[1].z,70);});
test('parameter previews mark changed native geometry dirty for record-preserving writers',()=>{const d=design();d.entities[0].dirty=false;const s=new ParameterEditSession(d,{process});s.set(row(s,'Size'),{expression:'90'});assert.equal(s.evaluate().entities[0].dirty,true);assert.equal(d.entities[0].dirty,false);});

test('display coordinates are immutable and cached across repeated camera-only reads', () => {
 const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id}),points=s.points();
 for(let i=0;i<120;i++)assert.equal(s.points(),points);
 assert.equal(s.pointEvaluations,1);assert.equal(s.evaluations,0);
 assert.throws(()=>{points[1].z=999;},TypeError);assert.throws(()=>points.push({x:0,y:0,z:0}),TypeError);
 near(s.points()[1].z,30);near(d.entities[0].points[1].z,30);
 const before=s.snapshot();s.set(1,'z','Rise+10');s.checkpoint(before);
 assert.notEqual(s.points(),points);near(s.points()[1].z,40);assert.equal(s.pointEvaluations,2);
 s.undo();near(s.points()[1].z,30);s.redo();near(s.points()[1].z,40);
});
test('an invalid coordinate revision never returns or repeatedly evaluates old cached points', () => {
 const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});s.points();s.set(1,'z','unknown');
 for(let i=0;i<120;i++)assert.throws(()=>s.points(),/Unknown parameter/);
 assert.equal(s.pointEvaluations,2);assert.equal(s.preview,null);
 s.set(1,'z','Rise');near(s.points()[1].z,30);assert.equal(s.pointEvaluations,3);
 s.cancel();assert.equal(s.pointCache,null);assert.throws(()=>s.points(),/ended/);
});
test('unfinished display coordinates remain available without accepting an invalid native path', () => {
 const s=new SpatialPathSession(createDocument());assert.deepEqual(s.points(),[]);
 s.insert(0,{x:'3+4',y:0,z:0});assert.deepEqual(s.points(),[{x:7,y:0,z:0}]);
 assert.throws(()=>s.evaluate(),/vertices/);s.set(0,'x',1e13);assert.throws(()=>s.points(),/1e12/);
});
test('reversing an open spatial path retains expression and native vertex provenance', () => {
 const {d,id}=pathFixture();d.entities[0].points.forEach((p,i)=>{p.extra={name:'point-'+i};});
 const before=JSON.stringify(d),s=new SpatialPathSession(d,{id}),snapshot=s.snapshot();
 s.reverse();s.checkpoint(snapshot);assert.deepEqual(s.state.origins,[2,1,0]);
 const points=s.evaluate().entities[0].points;
 assert.deepEqual(points.map(p=>p.extra.name),['point-2','point-1','point-0']);
 assert.equal(s.state.coordinates[0].x,'Run');assert.equal(JSON.stringify(d),before);
 s.undo();assert.deepEqual(s.snapshot(),snapshot);s.redo();s.reverse();assert.deepEqual(s.snapshot(),snapshot);
});
test('closed-path reversal retains start identity and closure without duplicate endpoints', () => {
 const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});s.setClosed(true);s.reverse();
 assert.deepEqual(s.state.origins,[0,2,1]);const e=s.evaluate().entities[0];assert.equal(e.flags,9);assert.equal(e.points.length,3);
 const cache=s.points();s.reverse();assert.notEqual(s.points(),cache);assert.deepEqual(s.state.origins,[0,1,2]);
});
test('reversal is an atomic history operation and a dependent sweep regenerates', () => {
 let {d,id}=pathFixture();const c=circle({x:0,y:0},2);d.entities.push(c);const body=addFeature(d,'sweep',{segments:12},[c.id,id]);
 const before=JSON.stringify(d),s=new SpatialPathSession(d,{id}),history=new History({capture:()=>d,restore:x=>d=x});s.reverse();
 s.evaluate();assert.equal(JSON.stringify(d),before);history.run('Reverse path',()=>s.commit(d));
 assert.equal(d.entities.find(e=>e.id===id).points[0].x,80);assert.ok(d.entities.find(e=>e.id===body.id));
 history.undo();assert.equal(JSON.stringify(d),before);history.redo();assert.equal(d.entities.find(e=>e.id===id).points[0].x,80);
});
test('future spatial path metadata is rejected, never silently downgraded', () => {
 const {d,id}=pathFixture();d.entities[0].parametric.version=2;const before=JSON.stringify(d);
 assert.throws(()=>new SpatialPathSession(d,{id}),/ordinary/);assert.equal(JSON.stringify(d),before);
});
for(const [name,writer] of [['ASCII',writeDXF],['binary',writeDXFBinary]])test(name+' reversed native path retains traversal and expressions through DXF',()=>{
 const {d,id}=pathFixture(),s=new SpatialPathSession(d,{id});s.reverse();s.commit(d);
 const reloaded=parseDXF(writer(d)),e=reloaded.entities.find(e=>e.type==='POLYLINE');
 assert.deepEqual(e.points.map(p=>[p.x,p.y,p.z]),[[80,0,30],[0,0,30],[0,0,0]]);
 assert.equal(e.parametric.coordinates[0].x,'Run');reloaded.parameters.Run=100;regenerateFeatures(reloaded);
 assert.equal(reloaded.entities.find(candidate=>candidate.id===e.id).points[0].x,100);
});
