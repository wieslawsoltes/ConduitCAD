import { mkdir, writeFile } from 'node:fs/promises';
import { createVisualDraftingExample } from '../packages/workbench/src/visual-example2d.js';
import { writeDXF, writeDXFBinary } from '@conduitcad/dxf';
const doc=createVisualDraftingExample();await mkdir('samples/visual',{recursive:true});
await writeFile('samples/visual/drafting-workshop.conduit.json',JSON.stringify(doc,null,2)+'\n');
await writeFile('samples/visual/drafting-workshop.dxf',writeDXF(doc));
await writeFile('samples/visual/drafting-workshop-binary.dxf',writeDXFBinary(doc));
console.log(`Visual drafting workshop: ${doc.entities.length} native entities, ASCII and binary DXF.`);
