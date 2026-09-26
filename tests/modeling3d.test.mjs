// Recovered complete test cases from the interrupted 3D source upload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { V3, add3, sub3, dot3, cross3, distance3, unit3, ocs3, transform3, multiply4, translation3, scaling3, rotation3, boxMesh, cylinderMesh, sphereMesh, torusMesh, extrudeMesh, revolveMesh, loftMesh, sweepMesh, booleanMesh, transformMesh, meshProperties, validateMesh, triangles3, triangulateFace, spline3, rayTriangle, sliceMesh } from '@conduitcad/geometry3d';
import { MODELING_TOOLS, EXAMPLES_3D, create3DExample, addFeature, editFeature, removeFeature, bakeFeature, regenerateFeatures, curvePoints3, offsetPlanarFace, sectionEntities, writeOBJ, writeSTL } from '@conduitcad/modeling';
import { createDocument, entity, circle, polyline, isVisible } from '@conduitcad/model';
import { writeDXF, parseDXF } from '@conduitcad/dxf';
import { OrbitCamera, buildScene3D, pick3D } from '@conduitcad/renderer3d';
import { rasterizeScene } from '../packages/renderer3d/src/software.js';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} ≠ ${b}`);
const near3=(a,b,t=1e-6)=>{for(const k of ['x','y','z'])near(a[k]||0,b[k]||0,t);};
const square=[V3(0,0),V3(20,0),V3(20,10),V3(0,10)];
function meshEntity(mesh,id='body'){return entity('MESH',{...mesh,id,layer:'Equipment',color:'#669999'});}
function docWith(...entities){const d=createDocument();d.entities=entities;return d;}

for(const normal of [V3(0,0,1),V3(0,0,-1),V3(1,0,0),V3(0,-1,0),V3(1,2,3),V3(.001,.001,1)])test(`OCS right-handed orthonormal frame ${JSON.stringify(normal)}`,()=>{const m=ocs3(normal),x=transform3(V3(1,0,0),m),y=transform3(V3(0,1,0),m),z=transform3(V3(0,0,1),m);near(dot3(x,y),0);near(dot3(x,z),0);near(dot3(y,z),0);near3(cross3(x,y),z);near3(z,unit3(normal));});
test('Spatial transforms compose around arbitrary axes and retain reflection winding',()=>{const m=multiply4(translation3(10,20,30),rotation3(V3(0,1,0),Math.PI/2));near3(transform3(V3(1,0,0),m),V3(10,20,29));const r=transformMesh(boxMesh(2,3,4),scaling3(-2,3,4));const p=meshProperties(r);assert.equal(p.closed,true);near(p.volume,576);assert.ok(p.signedVolume>0);});
test('Translated mesh mass properties stay numerically stable at civil coordinates',()=>{const mesh=transformMesh(boxMesh(2,3,4),translation3(1e9,-2e9,3e9)),p=meshProperties(mesh);near(p.volume,24);near3(p.centroid,V3(1e9+1,-2e9+1.5,3e9+2));near(p.area,52);});
for(const [name,make]of [['box',()=>boxMesh()],['cylinder',()=>cylinderMesh()],['cone',()=>cylinderMesh(20,50,24,0)],['sphere',()=>sphereMesh()],['torus',()=>torusMesh()],['extrude',()=>extrudeMesh(square,12)],['negative extrusion',()=>extrudeMesh(square,-12)],['taper extrusion',()=>extrudeMesh(square,12,V3(0,0,1),.5)],['revolve',()=>revolveMesh([V3(0,0),V3(20,0),V3(20,40),V3(0,40)])],['partial revolve',()=>revolveMesh([V3(5,0),V3(20,0),V3(20,40),V3(5,40)],150)],['loft',()=>loftMesh([square,square.map(p=>add3(p,V3(4,5,30)))])],['sweep',()=>sweepMesh(square,[V3(),V3(0,0,20),V3(20,5,40)])]])test(`${name} has closed oriented finite polygon topology`,()=>{const m=make(),p=meshProperties(m);assert.equal(p.closed,true);assert.ok(p.volume>0);assert.equal(p.nonManifoldEdges,0);assert.ok(triangles3(m).every(f=>f.length===3));});
test('Concave extrusion retains its notch rather than fan filling',()=>{const p=[V3(),V3(30,0),V3(30,10),V3(10,10),V3(10,30),V3(0,30)];near(meshProperties(extrudeMesh(p,7)).volume,3500);});
test('Extrusion rejects coplanar direction and nonplanar profiles',()=>{assert.throws(()=>extrudeMesh(square,10,V3(1,0,0)),/plane/);assert.throws(()=>extrudeMesh([V3(),V3(20,0),V3(20,10,3),V3(0,10)],10),/planar/);});
test('Invalid topology and unbounded inputs fail before meshing',()=>{assert.throws(()=>validateMesh({points:[V3()],faces:[[0,0,2]]}),/indices/);assert.throws(()=>boxMesh(-1),/positive/);assert.throws(()=>cylinderMesh(1,2,1000),/Segments/);assert.throws(()=>revolveMesh(square,361),/angle/);assert.throws(()=>sweepMesh(square,[V3(),V3(0,0,5),V3()]),/revers|direction/i);});
for(const [op,volume]of [['union',1500],['subtract',500],['intersect',500]])test(`BSP ${op} conforms intersections and has expected volume`,()=>{const a=boxMesh(10,10,10),b=transformMesh(a,translation3(5,0,0)),out=booleanMesh(a,b,op),p=meshProperties(out);assert.equal(p.closed,true);near(p.volume,volume);near(meshProperties(a).volume,1000);});
test('Disjoint Boolean intersection is an empty mesh, not an exception',()=>{const a=boxMesh(10,10,10),b=transformMesh(a,translation3(50,0,0));assert.equal(booleanMesh(a,b,'intersect').faces.length,0);});
test('Boolean rejects open input shells',()=>{const a=boxMesh();a.faces.pop();assert.throws(()=>booleanMesh(a,boxMesh()),/closed/);});
