/** Native-entity gallery, also used for independent DXF field audits. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createDocument, text, moveEntity, clone } from '@conduitcad/model';
import { createDrawingEntity, hatchFromEntities } from '@conduitcad/drawing';
import { writeDXF, writeDXFBinary } from '@conduitcad/dxf';
import { TOOL_CASES } from '../tests/drawing-fixtures.mjs';
const doc = createDocument('Native drawing tools');
const expected = [];
for(const [i,[id,points,type]] of TOOL_CASES.entries()) {
    const entity = createDrawingEntity(id, points, id==='hatch'?{pattern:'cross',spacing:10,angle:30}:id==='mtext'?{text:'Native MTEXT\nSecond line',height:10}:{}, {id:'tool-'+id,layer:'0'}, doc);
    // The audit source remains unshifted; the gallery uses translated copies.
    expected.push({id,entity:clone(entity)});
    const x=(i%5)*240,y=-Math.floor(i/5)*250;
    moveEntity(entity,x,y);
    doc.entities.push(entity,text({x:x-20,y:y+125},id,10,{layer:'0',id:'tool-title-'+id}));
}
await mkdir('samples',{recursive:true});await mkdir('artifacts',{recursive:true});
await writeFile('samples/drawing-tools.conduit.json',JSON.stringify(doc,null,2)+'\n');
await writeFile('samples/drawing-tools.dxf',writeDXF(doc));
const audit = createDocument('Native drawing factory audit');
audit.entities=expected.map(x=>clone(x.entity));
const outer=createDrawingEntity('circle-diameter',[{x:-80,y:0},{x:80,y:0}]);
const inner=createDrawingEntity('ellipse',[{x:0,y:0},{x:30,y:0},{x:0,y:15}]);
audit.entities.push(hatchFromEntities([outer,inner],audit,{pattern:'lines',angle:25,spacing:8},{id:'hatch-curves'}));
for(const encoding of ['ascii','binary'])await writeFile(`artifacts/drawing-tools-${encoding}.dxf`,encoding==='ascii'?writeDXF(audit,{includeMetadata:false}):writeDXFBinary(audit,{includeMetadata:false}));
await writeFile('artifacts/drawing-tools-expected.json',JSON.stringify(expected,null,2)+'\n');
console.log('Built native drawing tool samples and ASCII/binary audit inputs.');
