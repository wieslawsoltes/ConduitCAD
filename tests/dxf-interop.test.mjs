import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDocument, entity, line, text, entityGeometry, entityBounds, moveEntity, transformEntity, explodeEntity } from '@conduitcad/model';
import { parseDXF, writeDXF, writeDXFBinary, parseAsciiPairs, parseBinaryPairs, inspectObjectGraph } from '@conduitcad/dxf';
import { readAsciiTags, writeAsciiTags, writeBinaryTags, readBinaryTags, splitSections } from '../packages/dxf/src/codec.js';
import { buildScene } from '@conduitcad/renderer';
import { writeSVG } from '@conduitcad/exchange';
import { viewportTransform, insideClips } from '../packages/model/src/interop.js';
import { transform } from '@conduitcad/geometry';
const fixture=()=>parseDXF(readFileSync(new URL('fixtures/interop.dxf',import.meta.url)));
const minimal=(body,objects='')=>`0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n${objects?`0\nSECTION\n2\nOBJECTS\n${objects}0\nENDSEC\n`:''}0\nEOF\n`;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [code,value] of [[160,'9223372036854775807'],[169,'-9223372036854775808'],[1071,-2147483648],[90,2147483647],[370,-3],[290,1],[40,1.2345678901234567],[310,'00ff01']])test(`typed ASCII/binary transport roundtrip group ${code}`,()=>{
 const pairs=[[0,'SECTION'],[2,'OBJECTS'],[0,'XRECORD'],[code,value],[0,'ENDSEC'],[0,'EOF']];
 assert.deepEqual(readAsciiTags(writeAsciiTags(pairs)),pairs);assert.deepEqual(readBinaryTags(writeBinaryTags(pairs)),pairs);
});
for(const [code,value]of [[160,'9223372036854775808'],[160,'-9223372036854775809'],[290,2],[70,32768],[90,2147483648],[40,'NaN'],[310,'FFF'],[40,''],[70,1.5]])test(`reject malformed/overflow scalar ${code}:${value}`,()=>assert.throws(()=>readAsciiTags(`${code}\n${value}\n0\nEOF\n`)));
test('reject incomplete pairs, trailing data and malformed section nesting',()=>{
 for(const s of ['0\nEOF\n999\n','0\nEOF\n1\ntrailing\n','0\nSECTION\n2\nENTITIES\n0\nEOF\n'])assert.throws(()=>splitSections(readAsciiTags(s)));
});
test('R12 binary single-byte group codes and extended-code escape',()=>{
 const pairs=[[0,'SECTION'],[2,'HEADER'],[9,'$ACADVER'],[1,'AC1009'],[0,'ENDSEC'],[0,'SECTION'],[2,'ENTITIES'],[0,'LINE'],[5,'100'],[8,'0'],[10,1],[20,2],[11,3],[21,4],[1001,'TEST'],[1071,42],[0,'ENDSEC'],[0,'EOF']];
 assert.deepEqual(readBinaryTags(writeBinaryTags(pairs,{version:'AC1009'})),pairs);
});
test('binary source signature, truncation and trailing bytes are guarded',()=>{
 const good=writeBinaryTags([[0,'EOF']]);assert.throws(()=>readBinaryTags(good.subarray(1)));assert.throws(()=>readBinaryTags(good.subarray(0,-1)));
 assert.throws(()=>readBinaryTags(new Uint8Array([...good,0])));
});
test('binary metadata and Unicode MTEXT survive all modern export versions',()=>{
 const d=createDocument();d.parameters.width='123';d.metadata.description='Zażółć 温度 😀';d.entities.push(entity('MTEXT',{p:{x:0,y:0},height:4,text:'😀漢 ΔP '.repeat(100)}));
 for(const version of ['AC1015','AC1018','AC1021','AC1024','AC1027','AC1032']){
  const out=writeDXFBinary(d,{version});const r=parseDXF(out);assert.equal(r.entities[0].text,d.entities[0].text);assert.equal(r.parameters.width,'123');assert.equal(r.metadata.description,d.metadata.description);
 }
});
test('modern MTEXT chunks never split Unicode scalars or exceed 250 UTF-8 bytes',()=>{
 const d=createDocument();d.entities.push(entity('MTEXT',{p:{x:0,y:0},height:4,text:'😀'.repeat(200)}));
 const pairs=parseAsciiPairs(writeDXF(d));const mt=pairs.findIndex(p=>p[0]===100&&p[1]==='AcDbMText');
 for(const [c,v]of pairs.slice(mt+1)){if(c===0)break;if(c===1||c===3){assert.ok(Buffer.byteLength(v)<=250);assert.ok(!/\uFFFD/.test(v));}}
});
test('extension coordinate fields do not shadow entity coordinates',()=>{
 const d=parseDXF(minimal('0\nLINE\n5\nAB\n102\n{EXTENSION\n10\n900\n20\n900\n102\n}\n10\n1\n20\n2\n11\n3\n21\n4\n'));
 assert.deepEqual(d.entities[0].a,{x:1,y:2,z:0});
});
test('unknown classes, object records, payload and handles survive preserving output',()=>{
 const d=fixture(),pairs=parseAsciiPairs(writeDXF(d,{mode:'preserve'})),original=parseAsciiPairs(readFileSync(new URL('fixtures/interop.dxf',import.meta.url),'utf8'));
 assert.deepEqual(pairs,original);assert.ok(inspectObjectGraph(d).nodes.some(n=>n.type==='XRECORD'&&n.tags.some(p=>p[0]===160&&p[1]==='9223372036854775807')));
});
test('preserving permits an unreferenced LINE endpoint edit and retains unknown entities',()=>{
 const d=parseDXF(minimal('0\nLINE\n5\nAB\n10\n1\n20\n2\n11\n3\n21\n4\n0\nACME_SOLID\n5\nCD\n1\nopaque\n310\n00FF\n'));
 d.entities[0].a.x=55;const r=parseDXF(writeDXF(d,{mode:'preserve'}));assert.equal(r.entities[0].a.x,55);assert.equal(r.entities[1]._dxf.raw.find(p=>p[0]===310)[1],'00FF');
});
test('preserving refuses dependency-sensitive, unrepresented and structural edits',()=>{
 const source=minimal('0\nLINE\n5\nAB\n10\n0\n20\n0\n11\n10\n21\n0\n','0\nXRECORD\n5\nBC\n330\n0\n340\nAB\n');
 let d=parseDXF(source);d.entities[0].a.x=5;assert.throws(()=>writeDXF(d,{mode:'preserve'}),/incoming references/);
 d=parseDXF(source);d.entities.push(line({x:0,y:0},{x:1,y:1}));assert.throws(()=>writeDXF(d,{mode:'preserve'}),/added or deleted/);
 d=parseDXF(source);d.layers[0].color='#ff0000';assert.throws(()=>writeDXF(d,{mode:'preserve'}),/tables/);
 d=parseDXF(source);assert.throws(()=>writeDXF(d,{mode:'preserve',version:'AC1032'}),/original DXF version/);
});
test('preserving rejects duplicate handles and modified raw payloads',()=>{
 let d=parseDXF(minimal('0\nLINE\n5\nAB\n10\n0\n20\n0\n11\n1\n21\n1\n0\nPOINT\n5\nAB\n10\n0\n20\n0\n'));
 assert.ok(inspectObjectGraph(d).diagnostics.some(d=>d.severity==='error'));assert.throws(()=>writeDXF(d,{mode:'preserve'}));
 d=fixture();d.entities[0]._dxf.raw.push([1,'tampered']);assert.throws(()=>writeDXF(d,{mode:'preserve'}),/raw records/);
});
test('normalized 64-bit source handles cannot cause unsafe-number allocation loops',()=>{
 const d=parseDXF(minimal('0\nPOINT\n5\nFFFFFFFFFFFFFFF0\n10\n1\n20\n2\n'));assert.equal(parseDXF(writeDXF(d)).entities[0].p.x,1);
});
test('model and all inactive paper-space contents are recovered once',()=>{
 const d=fixture();assert.deepEqual(d.layouts,['Model','Layout1','Sheet A','Sheet B']);assert.equal(d.entities.length,22);
 assert.equal(d.entities.filter(e=>e.layout==='Sheet B').length,4);assert.ok(!Object.keys(d.blocks).some(n=>/^\*(Model|Paper)_Space/.test(n)));
 const r=parseDXF(writeDXF(d));assert.equal(r.entities.length,22);assert.deepEqual(r.layouts,d.layouts);
});
test('layout root dictionaries, block owners, table counts and HANDSEED are coherent',()=>{
 const d=fixture(),r=parseDXF(writeDXF(d)),g=inspectObjectGraph(r);assert.deepEqual(g.diagnostics,[]);
 const pairs=parseAsciiPairs(writeDXF(d)),i=pairs.findIndex(p=>p[0]===9&&p[1]==='$HANDSEED'),seed=BigInt('0x'+pairs[i+1][1]);
 assert.ok(g.nodes.every(n=>BigInt('0x'+n.handle)<seed));assert.equal(new Set(g.nodes.map(n=>n.handle)).size,g.nodes.length);
});
test('viewport clip and frozen layer references are remapped without changing semantics',()=>{
 const d=fixture(),r=parseDXF(writeDXF(d)),v=r.entities.find(e=>e.type==='VIEWPORT'&&e.clipHandle);
 assert.deepEqual(v.frozenLayers,['Frozen']);assert.equal(r.entities.find(e=>e._dxf.handle===v.clipHandle).type,'LWPOLYLINE');
});
test('viewport DCS transform applies target, twist, scale and view center',()=>{
 const e={c:{x:100,y:70},viewportHeight:100,viewHeight:50,viewCenter:{x:10,y:5},viewTarget:{x:3,y:4},viewTwist:90};
 const p=transform({x:4,y:4},viewportTransform(e));near(p.x,80);near(p.y,62);
 assert.equal(viewportTransform({...e,viewportFlags:1}),null);
});
test('paper layout geometry uses clip polygons and excludes frozen layers',()=>{
 const d=fixture();d.activeLayout='Sheet B';const v=d.entities.find(e=>e.type==='VIEWPORT'&&e.clipHandle),g=entityGeometry(v,d);
 assert.ok(g.paths.some(p=>p.clips?.length===2));assert.ok(g.paths.filter(p=>p.clips).every(p=>p.color!=='#ff0000'));
 const b=entityBounds(v,d);near(b.minX,35);near(b.maxX,165);near(b.minY,15);near(b.maxY,115);
 assert.ok(!insideClips({x:45,y:90},g.paths.find(p=>p.clips).clips));
});
test('paper SVG uses nested scene-space clipping',()=>{
 const d=fixture();d.activeLayout='Sheet B';const svg=writeSVG(d);assert.ok(svg.includes('<clipPath'));assert.ok(svg.includes('clip-path="url(#cc-clip-'));
});
test('native mesh topology and helix fields survive ASCII and binary',()=>{
 const d=fixture();for(const out of [writeDXF(d),writeDXFBinary(d)]){
  const r=parseDXF(out),mesh=r.entities.find(e=>e.type==='MESH'),helix=r.entities.find(e=>e.type==='HELIX');
  assert.deepEqual(mesh.faces,d.entities.find(e=>e.type==='MESH').faces);assert.deepEqual(mesh.creases,[0,1]);assert.equal(mesh.points[4].z,25);
  assert.equal(helix.turns,3);assert.equal(helix.radius,12);assert.ok(entityGeometry(helix,r).paths[0].points.length>20);
 }
});
test('mesh invalid indices/counts and unsupported downgrades fail explicitly',()=>{
 const d=fixture();assert.throws(()=>writeDXF(d,{version:'AC1015'}),/MESH|HELIX/);
 d.entities.find(e=>e.type==='MESH').faces[0][0]=9999;assert.throws(()=>writeDXF(d),/vertex index/);
});
test('WIPEOUT converts normalized image boundary to the intended WCS mask',()=>{
 const d=fixture(),e=d.entities.find(e=>e.type==='WIPEOUT'),g=entityGeometry(e,d);const points=g.paths[0].points;
 near(points[0].x,115);near(points[0].y,-85);near(points[1].x,145);assert.equal(g.paths[0].stroke,false);assert.ok(g.paths[0].fill);
 const before=JSON.stringify(e);assert.throws(()=>transformEntity(e,[0,1,-1,0,0,0]));assert.equal(JSON.stringify(e),before);
});
test('native dimension edits cannot leave stale graphics blocks',()=>{
 const d=fixture(),e=d.entities.find(e=>e.type==='DIMENSION'),before=JSON.stringify(e);assert.throws(()=>moveEntity(e,10,20),/regeneration/);assert.equal(JSON.stringify(e),before);
});
test('strict normalized mode reports foreign data loss; preservation remains available',()=>{
 const d=fixture();assert.throws(()=>writeDXF(d,{strict:true}),/Foreign|XDATA/);assert.ok(writeDXFBinary(d,{mode:'preserve'}).length>0);
});

test('preservation refuses global line-pattern changes and arbitrary soft references',()=>{
 let d=fixture();d.linetypeScale=5;assert.throws(()=>writeDXF(d,{mode:'preserve'}),/tables/);
 d=parseDXF(minimal('0\nLINE\n5\nAB\n10\n0\n20\n0\n11\n10\n21\n0\n','0\nXRECORD\n5\nBC\n320\nAB\n'));
 d.entities[0].b.x=20;assert.throws(()=>writeDXF(d,{mode:'preserve'}),/incoming references/);
});
test('normalized export retains insertion unit codes beyond the UI unit choices',()=>{
 for(const unit of [3,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]){
  const d=parseDXF(minimal('0\nPOINT\n5\nAB\n10\n0\n20\n0\n').replace('1\nAC1024\n','1\nAC1024\n9\n$INSUNITS\n70\n'+unit+'\n'));
  assert.equal(parseDXF(writeDXFBinary(d)).insunits,unit);
  d.units='mm';assert.equal(parseDXF(writeDXF(d)).insunits,4);
 }
});
test('exploding a clipped viewport rejects before producing unclipped entities',()=>{
 const d=fixture(),e=d.entities.find(e=>e.type==='VIEWPORT'&&e.clipHandle);assert.throws(()=>explodeEntity(e,d),/clipped viewport/);const before=JSON.stringify(e);assert.throws(()=>moveEntity(e,5,6),/clipped viewport/);assert.equal(JSON.stringify(e),before);
});
