import { mkdir, writeFile } from 'node:fs/promises';
import { createLiveWorkspaceExample } from '../packages/workbench/src/live-workspace-example.js';
import { writeDXF, writeDXFBinary } from '@conduitcad/dxf';
const document = createLiveWorkspaceExample();
await mkdir('samples/live', { recursive: true });
await writeFile('samples/live/parametric-path-workshop.conduit.json', JSON.stringify(document, null, 2) + '\n');
await writeFile('samples/live/parametric-path-workshop.dxf', writeDXF(document));
await writeFile('samples/live/parametric-path-workshop-binary.dxf', writeDXFBinary(document));
console.log(`Parametric path workshop: ${document.entities.length} native entities, ASCII and binary DXF.`);
