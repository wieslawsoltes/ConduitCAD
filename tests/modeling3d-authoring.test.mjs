import test from 'node:test';
import assert from 'node:assert/strict';
import { V3, boxMesh, meshProperties, transformMesh, translation3, rotation3, multiply4, dot3, sub3, distance3, faceNormal } from '@conduitcad/geometry3d';
import { faceFrame3, facePoint3, faceCoordinates3, profileOnFace3, holeTool3, drillHole3, extrudeExtent3, combineExtrusion3, addFeature, editFeature, regenerateFeatures, create3DExample, curvePoints3 } from '@conduitcad/modeling';
import { entity, createDocument, polyline, circle } from '@conduitcad/model';
import { writeDXF, writeDXFBinary, parseDXF } from '@conduitcad/dxf';

const near = (a, b, tol = 1e-5) => assert.ok(Math.abs(a-b) <= tol, `${a} != ${b}`);
const mesh = () => entity('MESH', { ...boxMesh(60,40,20), layer:'Equipment' });
const documentWith = (...entities) => ({ ...createDocument('Authoring'), entities });
const loop = [V3(10,10),V3(20,10),V3(20,20),V3(10,20)];
const area = r => 16 / 2 * r * r * Math.sin(2*Math.PI/16);

for (const extent of [0,1,2]) test(`extrude extent ${extent} retains closed outward geometry and exact interval`, () => {
    const m=extrudeExtent3(loop,{height:12,extent,distance2:4,startOffset:3}); const p=meshProperties(m);
    assert.equal(p.closed,true); near(p.signedVolume,100*(extent===2?16:12));
    near(p.bounds.min.z,extent===0?3:extent===1?-3:-1); near(p.bounds.max.z,extent===0?15:extent===1?9:15);
});
test('negative one-sided extrusion remains outward oriented',()=> { const p=meshProperties(extrudeExtent3(loop,{height:-12}));near(p.volume,1200);near(p.bounds.min.z,-12);assert.ok(p.signedVolume>0); });
test('extrude profile-normal mode works in an arbitrary tilted plane',()=> {
    const points=loop.map(p=>({x:p.x,y:0,z:p.y}));const result=meshProperties(extrudeExtent3(points,{height:12,useNormal:1,profileNormal:V3(0,-1,0)}));
    near(result.bounds.min.y,-12);near(result.bounds.max.y,0);near(result.volume,1200);
});
for(const parameters of [{extent:3},{extent:1,height:-2},{extent:2,distance2:0},{extent:2,distance2:-4},{startOffset:Infinity},{useNormal:3},{nz:0,nx:0,ny:0}]) test('rejects invalid extrusion '+JSON.stringify(parameters),()=>assert.throws(()=>extrudeExtent3(loop,{height:10,...parameters})));
for(const operation of [1,2,3]) test(`extrusion boolean ${operation} combines with a selected target`,()=> {
    const target=mesh(), tool=extrudeExtent3(loop,{height:30});const result=meshProperties(combineExtrusion3(tool,target,operation));
    assert.equal(result.closed,true);near(result.volume,operation===1?49000:operation===2?46000:2000);
});
test('extrusion operation refuses ambiguous inputs and no-op cuts',()=>{
    const tool=extrudeExtent3(loop,{height:10});assert.throws(()=>combineExtrusion3(tool,null,2),/target/i);
    assert.throws(()=>combineExtrusion3(tool,mesh(),0),/New Body/);
    assert.throws(()=>combineExtrusion3(tool,mesh(),9),/operation/);
    assert.throws(()=>combineExtrusion3(transformMesh(tool,translation3(500,0,0)),mesh(),2),/does not cut/);
});
for(const face of [0,1,2,3,4,5]) test(`face frame ${face} produces orthonormal basis and reversible coordinates`,()=>{
    const f=faceFrame3(mesh(),face);near(dot3(f.normal,f.u),0);near(dot3(f.normal,f.v),0);near(dot3(f.u,f.v),0);
    const c=faceCoordinates3(f,facePoint3(f,2,-3,4));near(c.u,2);near(c.v,-3);near(c.offset,4);
});
for(const holeType of [0,1,2]) for(const through of [0,1]) test(`hole ${holeType}/${through} matches independent faceted removed volume`,()=>{
    const target=mesh(), params={holeType,through,depth:12,diameter:8,counterDiameter:16,counterDepth:4,sinkAngle:90,segments:16};
    const cutter=holeTool3(target,params), result=meshProperties(drillHole3(target,params));assert.equal(result.closed,true);
    near(meshProperties(cutter.mesh).signedVolume,meshProperties(cutter.mesh).volume);
    const depth=through?20:12;const recess=holeType===1?(area(8)-area(4))*4:holeType===2?4*(area(8)+area(4)+Math.sqrt(area(8)*area(4)))/3-area(4)*4:0;
    near(result.volume,48000-area(4)*depth-recess,1e-4);
});
for(const face of [0,2,3,4,5]) test('drill follows inward normal on box face '+face,()=>{
    const result=meshProperties(drillHole3(mesh(),{face,diameter:6,segments:16}));assert.equal(result.closed,true);assert.ok(result.volume<48000&&result.volume>40000);
});
test('drill works on a translated rotated body without world-axis assumptions',()=>{
    const target={...mesh(),...transformMesh(mesh(),multiply4(translation3(1e7,-2e7,500),rotation3(V3(1,2,3),.75)))};
    const result=meshProperties(drillHole3(target,{diameter:8,segments:16}));assert.equal(result.closed,true);near(result.volume,48000-area(4)*20,.01);
});
for(const p of [{diameter:0},{holeType:1,counterDiameter:2},{holeType:1,counterDepth:25},{holeType:2,sinkAngle:180},{holeType:2,sinkAngle:0},{through:0,depth:-1},{u:1000},{face:200},{segments:2},{holeType:4},{through:9}]) test('invalid hole is rejected '+JSON.stringify(p),()=>{
    const target=mesh(),before=JSON.stringify(target);assert.throws(()=>drillHole3(target,p));assert.equal(JSON.stringify(target),before);
});
test('nonplanar face and open target are rejected',()=>{
    const m=mesh();m.points[6].z+=5;assert.throws(()=>faceFrame3(m,1),/planar/);
    const open=mesh();open.faces.pop();assert.throws(()=>drillHole3(open,{}),/closed/);
});
test('face reference refuses replaced topology and allows explicit reattachment',()=>{
    const body=mesh(),d=documentWith(body),hole=addFeature(d,'hole',{segments:16},[body.id]);
    d.entities[0].faces[1]=[5,6,7,4];const before=JSON.stringify(d);
    assert.throws(()=>regenerateFeatures(d),/topology/);assert.equal(JSON.stringify(d),before);
    editFeature(d,hole.id,{reattach:true});assert.deepEqual(d.entities[1].feature3d.attachment.vertices,[5,6,7,4]);
});
test('attached hole follows upstream dimension edits and rolls back invalid descendants',()=>{
    const d=documentWith(),b=addFeature(d,'box',{width:60,depth:40,height:20}),h=addFeature(d,'hole',{holeType:1,segments:16,diameter:8,counterDiameter:16},[b.id]);
    editFeature(d,b.id,{parameters:{height:30,width:80}});const result=d.entities[1];assert.equal(result.id,h.id);near(meshProperties(result).bounds.max.z,30);near(holeTool3(d.entities[0],h.feature3d.parameters,h.feature3d.attachment).center.x,40);
    const before=JSON.stringify(d);assert.throws(()=>editFeature(d,b.id,{parameters:{height:2}}),/shallower/);assert.equal(JSON.stringify(d),before);
});
test('extrusion booleans regenerate both named inputs and preserve legacy extrusion defaults',()=>{
    const p=polyline(loop,true),d=documentWith(p),b=addFeature(d,'box',{width:60,depth:40,height:20});d.parameters.Depth='30';
    const cut=addFeature(d,'extrude',{height:'Depth',operation:2},[p.id,b.id]);near(meshProperties(cut).volume,46000);
    editFeature(d,b.id,{parameters:{height:40}});near(meshProperties(d.entities.at(-1)).volume,93000);
    const legacy=addFeature(d,'extrude',{height:12},[p.id]);near(meshProperties(legacy).volume,1200);
});
for(const face of [0,1,2,3,4,5]) for(const shape of ['rectangle','circle']) test(`native ${shape} profile snapshot lies in face ${face} OCS plane`,()=>{
    const target={...mesh(),...transformMesh(mesh(),rotation3(V3(1,2,3),.5))},frame=faceFrame3(target,face);
    const e=profileOnFace3(target,face,{shape,width:12,height:8,radius:5,u:1,v:2,offset:3});const points=curvePoints3(e,{closed:true}).points;
    for(const p of points) near(dot3(sub3(p,frame.origin),frame.normal),3);
    assert.equal(e.type,shape==='circle'?'CIRCLE':'LWPOLYLINE');
});
for(const binary of [false,true]) test('DXF '+(binary?'binary':'ASCII')+' retains hole attachments and re-executable history',()=>{
    const d=documentWith();const b=addFeature(d,'box',{width:60,depth:40,height:20});const h=addFeature(d,'hole',{holeType:2,diameter:8,counterDiameter:16,segments:16},[b.id]);
    const out=parseDXF(binary?writeDXFBinary(d):writeDXF(d));assert.deepEqual(out.entities[1].feature3d.attachment,h.feature3d.attachment);
    editFeature(out,b.id,{parameters:{height:30}});near(meshProperties(out.entities[1]).bounds.max.z,30);assert.equal(meshProperties(out.entities[1]).closed,true);
});
for(const example of ['hole-plate','extrusion-study','face-boss']) test(example+' example is deterministic and regenerates',()=>{
    const d=create3DExample(example),expected=JSON.stringify(d);regenerateFeatures(d);assert.equal(JSON.stringify(d),expected);
    for(const e of d.entities.filter(e=>e.type==='MESH'))assert.equal(meshProperties(e).closed,true);
    assert.deepEqual(d.entities.map(e=>e.id),create3DExample(example).entities.map(e=>e.id));
});

test('small-padding side drilling never creates duplicate conforming-edge insertions',()=>{
    for(const face of [2,3,4,5]){
        const result=drillHole3(mesh(),{face,diameter:6,segments:16});
        assert.equal(meshProperties(result).closed,true);
        for(const f of result.faces)assert.equal(new Set(f).size,f.length);
    }
});
