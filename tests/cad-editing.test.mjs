import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, entity, line, rect, circle, editDimension, dimensionPicture, dimensionGrips, regenerateDimensions, entityGeometry, transformEntity, evaluateDynamicBlock, dynamicValues, setDynamicParameters, ports, dynamicParameterGrips, dynamicGripValue, detachReferences } from '@conduitcad/model';
import { parseDXF, writeDXF, writeDXFBinary } from '@conduitcad/dxf';
import { matrix } from '@conduitcad/geometry';
import { writeSVG } from '@conduitcad/exchange';
const pt=(x,y)=>({x,y});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const samples=[
 {dimtype:32,a:pt(0,0),b:pt(80,50),definitionPoint:pt(0,70),dimensionAngle:0},
 {dimtype:33,a:pt(0,0),b:pt(80,60),offset:30},
 {dimtype:34,a:pt(0,0),b:pt(100,0),defpoint4:pt(0,0),definitionPoint:pt(0,100),defpoint5:pt(20,20)},
 {dimtype:35,definitionPoint:pt(-40,0),defpoint4:pt(40,0)},
 {dimtype:36,definitionPoint:pt(0,0),defpoint4:pt(40,0)},
 {dimtype:37,a:pt(100,0),b:pt(0,100),defpoint4:pt(0,0),definitionPoint:pt(20,20)},
 {dimtype:102,a:pt(80,50),b:pt(80,90),definitionPoint:pt(0,0)}
];
for(const [i,props]of samples.entries())test(`dimension subtype ${i}: regenerate native picture and ASCII/binary metadata`,()=>{
 const doc=createDocument(),e=entity('DIMENSION',props);doc.entities.push(e);editDimension(e,doc,{style:{dimtxt:4,dimasz:2,dimdec:2}});
 const g=entityGeometry(e,doc);assert.ok(g.paths.length&&g.texts.length);assert.equal((g.warnings||[]).length,0);assert.ok(dimensionGrips(e,doc).length>=3);
 for(const data of [writeDXF(doc),writeDXFBinary(doc)]){const result=parseDXF(data),d=result.entities[0];assert.equal(d.dimtype&15,i);assert.ok(result.blocks[d.block]);assert.equal(d.dimension.version,1);near(d.measurement,e.measurement);assert.equal(d.dimstyleOverrides.dimtxt,4);}
});
test('dimension preserves decimal override, prefix and manual midpoint across regeneration',()=>{
 const d=createDocument(),e=entity('DIMENSION',samples[1]);editDimension(e,d,{text:'L=<> mm',style:{dimdec:2,dimlfac:2}});assert.equal(dimensionPicture(e,d).entities.at(-1).text,'L=200.00 mm');
 editDimension(e,d,{textMidpoint:pt(11,12)});assert.ok(e.dimtype&128);assert.deepEqual(dimensionPicture(e,d).textMidpoint,pt(11,12));
 editDimension(e,d,{manualText:false});assert.equal(e.dimtype&128,0);assert.notDeepEqual(dimensionPicture(e,d).textMidpoint,pt(11,12));
});
test('definition-point grip supersedes original authored offset',()=>{const d=createDocument(),e=entity('DIMENSION',{a:pt(0,0),b:pt(100,0),offset:30});editDimension(e,d);editDimension(e,d,{definitionPoint:pt(100,80)});assert.equal(e.offset,undefined);near(e.definitionPoint.y,80);});
test('one space suppresses dimension text without suppressing linework',()=>{const e=entity('DIMENSION',samples[1]);editDimension(e,{}, {text:' '});const g=dimensionPicture(e,{});assert.ok(g.entities.length);assert.equal(g.entities.filter(e=>e.type==='TEXT').length,0);});
for(const patch of [{a:pt(80,60)},{style:{dimtxt:-1}},{style:{dimdec:20}},{style:{unknown:1}}])test('invalid dimension edit is atomic '+JSON.stringify(patch),()=>{const e=entity('DIMENSION',samples[1]),before=JSON.stringify(e);assert.throws(()=>editDimension(e,{},patch));assert.equal(JSON.stringify(e),before);});
test('non-planar and unsupported dimension frames are refused without mutation',()=>{for(const extra of [{extrusion:{x:1,y:0,z:1}},{dimensionInsert:pt(20,0)},{obliqueAngle:30}]){const e=entity('DIMENSION',{...samples[1],...extra}),before=JSON.stringify(e);assert.throws(()=>editDimension(e,{}));assert.equal(JSON.stringify(e),before);}});
test('all associated dimensions refresh atomically and keep signed offsets',()=>{
 const d=createDocument(),source=line(pt(0,0),pt(100,0)),e=entity('DIMENSION',{a:pt(0,0),b:pt(100,0),offset:30,dimension:{version:1,references:{a:{entityId:source.id,point:'a'},b:{entityId:source.id,point:'b'}}}});editDimension(e,d);d.entities=[source,e];source.b.x=150;assert.deepEqual(regenerateDimensions(d),[e.id]);near(e.measurement,150);near(e.definitionPoint.y,30);
 const f=entity('DIMENSION',{...samples[1],dimension:{version:1,references:{a:{entityId:'missing',point:'a'}}}});d.entities.push(f);source.b.x=200;const before=JSON.stringify(e);assert.throws(()=>regenerateDimensions(d));assert.equal(JSON.stringify(e),before);
});
test('manual witness edit detaches only its own reference',()=>{const e=entity('DIMENSION',{...samples[1],dimension:{version:1,references:{a:{entityId:'a',point:'a'},b:{entityId:'b',point:'b'}}}});editDimension(e,{}, {a:pt(1,0)});assert.equal(e.dimension.references.a,undefined);assert.ok(e.dimension.references.b);});
test('managed dimensions rotate without stale anonymous pictures',()=>{const e=entity('DIMENSION',samples[0]);editDimension(e,{});transformEntity(e,matrix({rotation:90}));near(dimensionPicture(e,{}).measurement,80);assert.equal(e.block,undefined);});
function block(){return {name:'D',base:pt(0,0),entities:[rect(0,-10,100,20,{id:'body'}),line(pt(0,0),pt(100,0),{id:'axis'})],ports:[{name:'in',...pt(0,0),dx:-1,dy:0},{name:'out',...pt(100,0),dx:1,dy:0}],dynamic:{version:1,parameters:[{name:'Length',type:'distance',default:100,min:20,max:500}],actions:[{type:'stretch',parameter:'Length',box:{minX:50,minY:-30,maxX:500,maxY:30},direction:pt(1,0)}]}};}
test('dynamic stretch preserves analytic line/polyline and moves connector ports',()=>{const b=block(),before=JSON.stringify(b),r=evaluateDynamicBlock(b,{Length:180});near(r.entities[0].points[1].x,180);near(r.ports[1].x,180);near(r.ports[0].x,0);assert.equal(JSON.stringify(b),before);});
for(const [type,defaultValue,value]of [['move',0,20],['rotate',0,90],['scale',100,200],['flip',false,true],['array',1,3]])test('dynamic '+type+' action evaluates a pristine instance',()=>{const b=block();b.dynamic={version:1,parameters:[{name:'P',type:type==='flip'?'boolean':type==='array'?'integer':'number',default:defaultValue}],actions:[{type,parameter:'P',direction:pt(1,0),step:pt(20,0)}]};const r=evaluateDynamicBlock(b,{P:value});assert.notDeepEqual(r.entities,b.entities);assert.equal(evaluateDynamicBlock(b,{P:defaultValue}).entities[0].points[0].x,0);});
test('visibility hides selected geometry without discarding named terminals',()=>{const b=block();b.dynamic={version:1,parameters:[{name:'State',type:'enum',default:'All',values:['All','Body']}],actions:[{type:'visibility',parameter:'State',states:{All:['axis','body'],Body:['body']}}]};const r=evaluateDynamicBlock(b,{State:'Body'});assert.equal(r.entities[1].hidden,true);assert.equal(r.ports.length,2);});
test('lookup actions are topologically evaluated and validate dependent ranges',()=>{const b=block();b.dynamic.parameters.push({name:'Size',type:'enum',default:'Small',values:['Small','Large']});b.dynamic.actions.push({type:'lookup',parameter:'Size',rows:{Small:{Length:100},Large:{Length:200}}});assert.equal(dynamicValues(b,{Size:'Large'}).Length,200);near(evaluateDynamicBlock(b,{Size:'Large'}).ports[1].x,200);});
test('lookup cycles fail before changing document',()=>{const b=block();b.dynamic.parameters.push({name:'Other',type:'number',default:100});b.dynamic.actions.push({type:'lookup',parameter:'Other',rows:{100:{Length:100}}},{type:'lookup',parameter:'Length',rows:{100:{Other:100}}});assert.throws(()=>evaluateDynamicBlock(b),/cycle/);});
test('dynamic mutation rejects invalid values and array resource explosions',()=>{const d=createDocument(),b=block(),e=entity('INSERT',{block:'D',x:0,y:0});d.blocks.D=b;const before=JSON.stringify(e);assert.throws(()=>setDynamicParameters(e,d,{Length:Infinity}));assert.equal(JSON.stringify(e),before);b.dynamic={version:1,parameters:[{name:'Count',type:'integer',default:1}],actions:[{type:'array',parameter:'Count'}]};assert.throws(()=>evaluateDynamicBlock(b,{Count:256},{maxEntities:20}),/budget/);});
test('partial bulge stretch is rejected instead of silently changing arc geometry',()=>{const b=block();b.entities[0].points[0].bulge=.2;assert.throws(()=>evaluateDynamicBlock(b,{Length:140}),/curved/);});
test('dynamic block geometry is rendered and connector points use evaluated dimensions',()=>{const d=createDocument();d.blocks.D=block();const e=entity('INSERT',{block:'D',x:10,y:20,dynamicParameters:{Length:150}});d.entities.push(e);near(ports(e,d)[1].x,160);assert.ok(entityGeometry(e,d).paths.flatMap(p=>p.points).some(p=>p.x===160));});
test('dynamic DXF exports baked variants and recovers editable master metadata',()=>{
 const d=createDocument();d.blocks.D=block();d.entities=[entity('INSERT',{block:'D',x:0,y:0,dynamicParameters:{Length:140}}),entity('INSERT',{block:'D',x:200,y:0,dynamicParameters:{Length:200}})];
 for(const binary of [false,true]){const data=binary?writeDXFBinary(d):writeDXF(d),r=parseDXF(data);assert.ok(r.blocks.D.dynamic);assert.equal(r.entities[0].block,'D');near(ports(r.entities[0],r)[1].x,140);assert.doesNotThrow(()=>writeDXF(r,{mode:'preserve'}));}
 const r=parseDXF(writeDXF(d,{includeMetadata:false}));assert.ok(r.entities[0].block.startsWith('*UCC'));assert.equal(r.blocks.D.dynamic,undefined);near(ports(d.entities[0],d)[1].x,140);
});
test('dynamic authored definition is preserved through repeat exports',()=>{let d=createDocument();d.blocks.D=block();d.entities=[entity('INSERT',{block:'D',x:0,y:0})];for(let i=0;i<3;i++){d=parseDXF(writeDXF(d));setDynamicParameters(d.entities[0],d,{Length:120+i*20});}near(ports(d.entities[0],d)[1].x,160);});
test('unshifted LINEAR gradient reaches scene and SVG without replacing native DXF tags',()=>{const d=createDocument(),gradient=[[450,1],[451,0],[460,0],[461,0],[452,0],[462,0],[453,2],[463,0],[421,0xff0000],[463,1],[421,0x0000ff],[470,'LINEAR']],e=entity('HATCH',{solid:true,loops:[{points:[pt(0,0),pt(100,0),pt(100,100),pt(0,100)]}],gradient});d.entities.push(e);const p=entityGeometry(e,d).paths[0];assert.deepEqual(p.gradient.colors,['#ff0000','#0000ff']);assert.match(writeSVG(d),/<linearGradient/);assert.deepEqual(parseDXF(writeDXF(d)).entities[0].gradient,gradient);});

test('dynamic grip inverses preserve scaled rotated nonzero-base coordinates',()=>{
 const d=createDocument(),b=block();b.base=pt(20,30);b.dynamic.parameters[0].grip={base:pt(20,15),direction:pt(2,0)};d.blocks.D=b;
 const e=entity('INSERT',{block:'D',x:200,y:100,sx:2,sy:3,rotation:37,dynamicParameters:{Length:140}});
 const g=dynamicParameterGrips(e,d)[0];near(dynamicGripValue(e,d,'Length',g),140);
});
test('invalid dynamic grip, port, parameter/action type and entity budgets fail explicitly',()=>{
 let b=block();b.dynamic.parameters[0].grip={direction:pt(0,0)};assert.throws(()=>evaluateDynamicBlock(b),/nonzero/);
 b=block();b.ports[0].x=Infinity;assert.throws(()=>evaluateDynamicBlock(b),/port/);
 b=block();b.dynamic.parameters[0]={name:'Length',type:'enum',default:'A',values:['A']};assert.throws(()=>evaluateDynamicBlock(b),/numeric/);
 assert.throws(()=>evaluateDynamicBlock(block(),{},{maxEntities:1}),/budget/);
});
test('circle radius associations track size and detach safely when source is removed',()=>{
 const d=createDocument(),c=circle(pt(20,30),40),e=entity('DIMENSION',{dimtype:36,definitionPoint:pt(20,30),defpoint4:pt(60,30),dimension:{version:1,references:{definitionPoint:{entityId:c.id,point:'c'},defpoint4:{entityId:c.id,point:'circle',angle:0}}}});
 editDimension(e,d);d.entities=[c,e];c.r=70;regenerateDimensions(d);near(e.measurement,70);
 detachReferences(d,new Set([c.id]));d.entities=[e];assert.doesNotThrow(()=>regenerateDimensions(d));near(e.measurement,70);
});
test('oversized native XDATA is refused rather than writing an invalid DXF',()=>{
 const d=createDocument();d.blocks.D=block();d.blocks.D.dynamic.description='x'.repeat(16000);d.entities=[entity('INSERT',{block:'D'})];
 assert.throws(()=>writeDXF(d),/XDATA budget/);assert.doesNotThrow(()=>writeDXF(d,{includeMetadata:false}));
});
test('invalid dimension formatting and overflowing geometry remain atomic',()=>{
 for(const patch of [{text:{}},{style:{dimpost:42}},{style:{dimzin:-1}},{style:{dimdsep:999}},{dimensionAngle:NaN},{dimtype:1.5},{b:pt(1e300,0)}]){
  const e=entity('DIMENSION',samples[1]),before=JSON.stringify(e);assert.throws(()=>editDimension(e,{},patch));assert.equal(JSON.stringify(e),before);
 }
});

test('repeated native export does not accumulate unreachable generated pictures',()=>{
 let d=createDocument();d.blocks.D=block();const dim=entity('DIMENSION',samples[1]);editDimension(dim,d);
 d.entities=[dim,entity('INSERT',{block:'D',x:0,y:0,dynamicParameters:{Length:150}})];
 for(let i=0;i<5;i++){d=parseDXF(writeDXF(d));assert.equal(Object.values(d.blocks).filter(b=>b.dimensionPicture).length,1);assert.equal(Object.values(d.blocks).filter(b=>b.dynamicInstance).length,1);}
});
test('explicit static references keep a previous generated native block',()=>{
 let d=createDocument();d.blocks.D=block();d.entities=[entity('INSERT',{block:'D',x:0,y:0,dynamicParameters:{Length:150}})];d=parseDXF(writeDXF(d));
 const name=Object.entries(d.blocks).find(([n,b])=>b.dynamicInstance)[0];d.entities.push(entity('INSERT',{block:name,x:300,y:0}));
 setDynamicParameters(d.entities[0],d,{Length:200});const r=parseDXF(writeDXF(d));assert.ok(r.blocks[name]);near(r.blocks[name].entities[0].points[1].x,150);
});

test('rotating a default-angle linear dimension updates its native angle and rejects shear',()=>{
 const e=entity('DIMENSION',{dimtype:32,a:pt(0,0),b:pt(100,50),offset:30});editDimension(e,{});transformEntity(e,matrix({rotation:90}));near(dimensionPicture(e,{}).measurement,100);
 const before=JSON.stringify(e);assert.throws(()=>transformEntity(e,[1,0,.6,.8,0,0]),/similarity/);assert.equal(JSON.stringify(e),before);
});
test('dimension similarity scaling honors resolved document style scale',()=>{
 const d=createDocument();d.dimstyles={STANDARD:{dimscale:5}};const e=entity('DIMENSION',samples[1]);editDimension(e,d);transformEntity(e,matrix({sx:2,sy:2}));near(dimensionPicture(e,d).style.dimscale,10);
});
test('native hatch rotation updates gradient angle in radians',()=>{
 const e=entity('HATCH',{solid:true,loops:[{points:[pt(0,0),pt(100,0),pt(100,100)]}],gradient:[[450,1],[460,0],[461,0],[453,2],[421,16711680],[421,255],[470,'LINEAR']]});
 transformEntity(e,matrix({rotation:90}));near(e.gradient.find(p=>p[0]===460)[1],Math.PI/2);
});
