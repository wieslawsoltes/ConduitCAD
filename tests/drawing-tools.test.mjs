import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWING_TOOLS, drawingTool, createDrawingEntity, circumcircle, interpolatingSpline, validateBoundary, hatchFromEntities, DrawingSession, parseDrawingPoint } from '@conduitcad/drawing';
import { entity, createDocument, entityGeometry, circle, polyline } from '@conduitcad/model';
import { parseDXF, writeDXF, writeDXFBinary } from '@conduitcad/dxf';
import { distance, distanceToSegment, nurbsPoint, snapCandidates } from '@conduitcad/geometry';
import { evaluateExpression } from '@conduitcad/constraints';
const p = (x,y) => ({x,y});
const doc = () => createDocument('Native drawing tools');
const near = (a,b,eps=1e-7) => assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
import { TOOL_CASES } from './drawing-fixtures.mjs';
test('every tool has unique descriptor and coverage',()=>{assert.equal(DRAWING_TOOLS.length,28);assert.equal(new Set(DRAWING_TOOLS.map(t=>t.id)).size,28);assert.deepEqual(TOOL_CASES.map(t=>t[0]).sort(),DRAWING_TOOLS.map(t=>t.id).sort());});
for(const [id,points,type] of TOOL_CASES){
 test(`${id}: native factory, renderer and point-session agree`,()=>{
   const d=doc(),s=new DrawingSession(id), before=structuredClone(points),e=createDrawingEntity(id,points,{}, {},d);
   assert.equal(e.type,type);assert.deepEqual(points,before);
   let out;for(const point of points)out=s.add(point,{},d);
   if(!out)out=s.finish(false,{},d);
   assert.equal(out.type,type);
   const g=entityGeometry(e,d);assert.ok(g.paths.length+g.texts.length>0,id);assert.ok(!g.warnings?.length,JSON.stringify(g.warnings));
   for(const path of g.paths)for(const p of path.points){assert.ok(Number.isFinite(p.x));assert.ok(Number.isFinite(p.y));}
 });
 test(`${id}: ASCII and binary roundtrips keep native entity`,()=>{
   for(const binary of [false,true]){
     const d=doc();d.entities=[createDrawingEntity(id,points,{}, {},d)];
     const e=parseDXF(binary?writeDXFBinary(d,{includeMetadata:false}):writeDXF(d,{includeMetadata:false})).entities.find(e=>e.type===type);
     assert.ok(e,`${id}: ${binary}`);
     if(type==='SPLINE'){assert.equal(e.degree,3);assert.equal(e.knots.length,e.controlPoints.length+4);}
     if(type==='ELLIPSE')assert.ok(e.ratio>0&&e.ratio<=1);
   }
 });
}
test('circumcircle preserves survey-coordinate precision and arc through point',()=>{
 const a=p(1e9,1e9),b=p(1e9+50,1e9+50),c=p(1e9+100,1e9),e=createDrawingEntity('arc',[a,b,c]);
 near(e.r,50);near(e.c.x,1e9+50);near(e.c.y,1e9);assert.ok(e.clockwise);
 const path=entityGeometry(e,doc(),{tolerance:.001}).paths[0];assert.ok(path.points.slice(1).some((q,i)=>distanceToSegment(b,path.points[i],q)<.0011));
});
test('arc orientation includes picked through-point on reflex arcs',()=>{
 const e=createDrawingEntity('arc',[p(1,0),p(-1,0),p(0,1)]);assert.ok(e.clockwise);
 const g=entityGeometry(e,doc(),{tolerance:.0001});assert.ok(g.paths[0].points.some(p=>p.y<-.9));
});
test('collinear, coincident and nonfinite arc inputs are refused without mutation',()=>{
 for(const points of [[p(0,0),p(1,1),p(2,2)],[p(0,0),p(0,0),p(1,1)],[p(0,0),p(Infinity,1),p(2,3)]])assert.throws(()=>circumcircle(...points));
 const s=new DrawingSession('arc');s.add(p(0,0));s.add(p(10,0));assert.throws(()=>s.add(p(20,0)));assert.equal(s.points.length,2);assert.equal(s.add(p(10,20)).type,'ARC');
});
test('ellipse canonicalizes a longer second semi-axis and remaps arc parameters',()=>{
 const e=createDrawingEntity('ellipse-arc',[p(0,0),p(20,0),p(0,60),p(20,0),p(0,60)]);
 near(e.ratio,1/3);near(e.major.y,60);const pts=entityGeometry(e,doc(),{tolerance:.001}).paths[0].points;
 near(pts[0].x,20);near(pts[0].y,0);near(pts.at(-1).x,0);near(pts.at(-1).y,60);
});
test('ellipse minor radius is perpendicular axis distance, not radial cursor distance',()=>{
 const e=createDrawingEntity('ellipse',[p(10,20),p(110,20),p(50,60)]);near(e.ratio,.4);
 assert.throws(()=>createDrawingEntity('ellipse',[p(0,0),p(10,0),p(20,0)]));
});
test('interpolating spline visits every point and matches tangent across internal knots',()=>{
 const pts=[p(0,0),p(30,70),p(80,-20),p(140,30)],e=interpolatingSpline(pts);
 for(let i=0;i<pts.length;i++)assert.ok(distance(nurbsPoint(e.controlPoints,e.degree,e.knots,i),pts[i])<1e-7);
 for(let i=1;i<pts.length-1;i++){
  const h=1e-5,a=nurbsPoint(e.controlPoints,3,e.knots,i-h),b=pts[i],c=nurbsPoint(e.controlPoints,3,e.knots,i+h);
  near((b.x-a.x)/h,(c.x-b.x)/h,.01);near((b.y-a.y)/h,(c.y-b.y)/h,.01);
 }
});
test('closed interpolating spline has a shared seam and closed native flag',()=>{
 const e=interpolatingSpline([p(0,0),p(100,0),p(0,100)],true);assert.ok(e.closed);assert.deepEqual(e.controlPoints[0],e.controlPoints.at(-1));assert.equal(e.knots.at(-1),3);
});
test('native donut encodes two semicircles and a real polyline width',()=>{
 const e=createDrawingEntity('donut',[p(10,20),p(30,20),p(50,20)]);near(e.constantWidth,20);assert.deepEqual(e.points.map(p=>p.bulge),[1,1]);assert.ok(e.closed);
 assert.throws(()=>createDrawingEntity('donut',[p(0,0),p(20,0),p(10,0)]));
 const disk=createDrawingEntity('donut',[p(0,0),p(0,0),p(10,0)]);near(disk.constantWidth,10);
});
test('polygon inscribed/circumscribed and bounds checks',()=>{
 const a=createDrawingEntity('polygon',[p(0,0),p(50,0)],{sides:4});near(a.points[0].x,50);
 const b=createDrawingEntity('polygon',[p(0,0),p(50,0)],{sides:4,circumscribed:true});near(b.points[0].x,50);near(b.points[0].y,50);
 for(const sides of [2,513,5.5,NaN])assert.throws(()=>createDrawingEntity('polygon',[p(0,0),p(50,0)],{sides}));
});
test('hatch copies native circles/ellipse/bulges, preserving islands without changing sources',()=>{
 const d=doc(),outer=circle(p(0,0),50),hole=circle(p(0,0),10),before=JSON.stringify([outer,hole]);
 const e=hatchFromEntities([outer,hole],d);assert.equal(e.loops.length,2);assert.equal(e.loops[0].edges[0].type,2);assert.equal(JSON.stringify([outer,hole]),before);assert.equal(e.associative,false);
 const wide=polyline([p(0,0),p(10,0),p(0,10)],true,{constantWidth:3});assert.throws(()=>hatchFromEntities([wide],d));
 assert.throws(()=>hatchFromEntities([polyline([p(0,0),p(1,0)],false)],d));
});
test('hatch line and cross patterns produce visible bounded segments',()=>{
 for(const pattern of ['lines','cross']){const e=createDrawingEntity('hatch',[p(0,0),p(100,0),p(100,100),p(0,100)],{pattern,spacing:10,angle:35});assert.equal(e.patternLines.length,pattern==='lines'?1:2);assert.ok(entityGeometry(e,doc()).paths.length>5);}
 assert.throws(()=>createDrawingEntity('hatch',[p(0,0),p(20,0),p(0,20)],{spacing:0}));
});
test('simple-boundary validator rejects intersections, touching, overlap and zero area',()=>{
 for(const q of [[p(0,0),p(20,20),p(0,20),p(20,0)],[p(0,0),p(20,0),p(10,0),p(10,10)],[p(0,0),p(10,0),p(20,0)]])assert.throws(()=>validateBoundary(q));
 const concave=[p(0,0),p(20,0),p(5,5),p(0,20)];assert.equal(validateBoundary(concave).length,4);
});
test('wipeout normalized boundary reconstructs the authored polygon',()=>{
 const points=[p(100,200),p(300,200),p(250,250),p(120,230)],e=createDrawingEntity('wipeout',points),actual=entityGeometry(e,doc()).paths[0].points;
 for(let i=0;i<points.length;i++)assert.ok(distance(points[i],actual[i])<1e-7);
});
test('polar and relative point entry accepts parameter expressions without eval',()=>{
 const evalParam=s=>evaluateExpression(s,{size:20});
 assert.deepEqual(parseDrawingPoint('size, size/2',p(10,10),evalParam),p(20,10));
 assert.deepEqual(parseDrawingPoint('@size,0',p(10,10),evalParam),p(30,10));
 const q=parseDrawingPoint('@size<90',p(10,10),evalParam);near(q.x,10);near(q.y,30);
 for(const s of ['','1,','1<30','@1<','1,2,3','Infinity,0'])assert.throws(()=>parseDrawingPoint(s));
});
test('session undo, incomplete finish, close and expansion limits',()=>{
 const s=new DrawingSession('spline');assert.throws(()=>s.finish());s.add(p(0,0));s.add(p(10,0));assert.throws(()=>s.finish(true));s.add(p(10,10));assert.ok(s.finish(true).closed);s.undo();assert.equal(s.points.length,2);
 const solid=new DrawingSession('solid');[p(0,0),p(10,0),p(10,10),p(0,10)].forEach(p=>solid.add(p));assert.throws(()=>solid.add(p(5,5)));assert.equal(solid.points.length,4);
});
test('preview of degenerate points remains a nonmutating guide',()=>{
 const s=new DrawingSession('arc');s.add(p(0,0));s.add(p(10,0));const before=JSON.stringify(s.points);assert.equal(s.preview(p(20,0)).type,'LWPOLYLINE');assert.equal(JSON.stringify(s.points),before);
});

test('new DXF tools preserve SOLID and 3DFACE perimeter order',()=>{
 for(const id of ['solid','face']){
  const d=createDocument(),pts=[{x:0,y:0},{x:80,y:0},{x:70,y:50},{x:10,y:40}],e=createDrawingEntity(id,pts);d.entities.push(e);
  const back=parseDXF(writeDXF(d,{includeMetadata:false})).entities[0];
  assert.deepEqual(back.points.map(p=>({x:p.x,y:p.y})),pts);
 }
});

test('polyline arc midpoint snap lies on the bulge not the chord',async()=>{
 const {snapCandidates}=await import('@conduitcad/geometry');
 const e={type:'LWPOLYLINE',points:[{x:0,y:0,bulge:1},{x:100,y:0}],closed:false};
 const snap=snapCandidates(e).find(s=>s.kind==='midpoint');
 assert.ok(snap);assert.ok(Math.abs(snap.y+50)<1e-8);assert.ok(Math.abs(snap.x-50)<1e-8);
});

test('ellipse snaps retain native minor-axis ratio',async()=>{
 const {snapCandidates}=await import('@conduitcad/geometry');
 const snaps=snapCandidates(createDrawingEntity('ellipse',[{x:0,y:0},{x:80,y:0},{x:0,y:40}]));
 assert.ok(snaps.some(p=>Math.abs(p.x)<1e-6&&Math.abs(p.y-40)<1e-6));
});

test('spline endpoint snaps use the actual NURBS curve',async()=>{
 const {snapCandidates}=await import('@conduitcad/geometry');const e=createDrawingEntity('bezier',[{x:0,y:0},{x:20,y:30},{x:50,y:20},{x:80,y:0}]);
 const snaps=snapCandidates(e);assert.ok(snaps.some(s=>s.x===0&&s.y===0));assert.ok(snaps.some(s=>s.x===80&&s.y===0));
 assert.ok(!snaps.some(s=>s.x===20&&s.y===30));
});

test('construction lines are indexed across the viewport without inflating fit extents',async()=>{
 const {buildScene}=await import('@conduitcad/renderer');const d=createDocument();
 d.entities.push(createDrawingEntity('xline',[{x:0,y:0},{x:1,y:0}]));
 const s=buildScene(d,{view:{minX:-1000,minY:-100,maxX:1000,maxY:100}});
 assert.equal(s.hasInfinite,true);assert.ok(s.index.search({minX:900,minY:-1,maxX:910,maxY:1}).length===1);
 assert.ok(s.bounds.maxX-s.bounds.minX<1);
});

test('nested construction-line references retain viewport indexing and finite fit bounds',async()=>{
 const {buildScene}=await import('@conduitcad/renderer');const d=createDocument();
 d.blocks.Infinite={name:'Infinite',base:{x:0,y:0},entities:[createDrawingEntity('xline',[{x:0,y:0},{x:1,y:0}])]};
 d.entities.push(entity('INSERT',{block:'Infinite',x:100,y:20,sx:1,sy:1}));
 const s=buildScene(d,{view:{minX:-1000,minY:-100,maxX:1000,maxY:100}});
 assert.equal(s.hasInfinite,true);assert.equal(s.index.search({minX:900,minY:19,maxX:910,maxY:21}).length,1);
 assert.ok(s.bounds.maxX-s.bounds.minX<1);
});

test('nonfinite or elevated point coordinates fail before native construction',()=>{
 for(const z of [NaN,Infinity,1])assert.throws(()=>createDrawingEntity('point',[{x:0,y:0,z}]),/XY/);
});

test('curved hatch sources reject invalid native ellipse axes and excessive vertices',()=>{
 const d=createDocument();assert.throws(()=>hatchFromEntities([entity('ELLIPSE',{c:p(0,0),major:p(0,0),ratio:.5,start:0,end:2*Math.PI})],d),/major axis/);
 assert.throws(()=>hatchFromEntities([entity('ELLIPSE',{c:p(0,0),major:p(10,0),ratio:2,start:0,end:2*Math.PI})],d),/ratio/);
 assert.throws(()=>hatchFromEntities([polyline(Array.from({length:513},(_,i)=>p(i,0)),true)],d),/512/);
});

test('triangle fills and faces retain three unique native corners through DXF',()=>{
 for(const kind of ['solid','face']){
  const d=createDocument(),pts=[p(0,0),p(50,0),p(20,40)];d.entities.push(createDrawingEntity(kind,pts));
  const e=parseDXF(writeDXF(d,{includeMetadata:false})).entities[0];assert.equal(e.type,kind==='solid'?'SOLID':'3DFACE');
  const unique=[...new Map(e.points.map(p=>[`${p.x},${p.y}`,p])).values()];assert.equal(unique.length,3);
 }
});

test('offscreen infinite geometry stays camera-dependent even when it emits no segments',async()=>{
 const {buildScene}=await import('@conduitcad/renderer');const d=createDocument();
 d.blocks.Offscreen={name:'Offscreen',entities:[createDrawingEntity('ray',[p(0,0),p(1,0)])]};
 d.entities.push(entity('INSERT',{block:'Offscreen',x:0,y:500,sx:1,sy:1}));
 const s=buildScene(d,{view:{minX:-100,minY:-100,maxX:100,maxY:100}});
 assert.equal(s.paths.length,0);assert.equal(s.hasInfinite,true);
});
