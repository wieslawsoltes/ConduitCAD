import { mkdir, writeFile } from 'node:fs/promises';
import { EXAMPLES_3D, create3DExample } from '@conduitcad/modeling';
import { writeDXF, writeDXFBinary } from '@conduitcad/dxf';
import { meshProperties } from '@conduitcad/geometry3d';
await mkdir('samples/3d', { recursive: true });
const report = [];
for (const spec of EXAMPLES_3D) {
    const document = create3DExample(spec.id);
    await writeFile(`samples/3d/${spec.id}.conduit.json`, JSON.stringify(document, null, 2) + '\n');
    await writeFile(`samples/3d/${spec.id}.dxf`, writeDXF(document, { version: 'AC1032' }));
    await writeFile(`samples/3d/${spec.id}-binary.dxf`, writeDXFBinary(document, { version: 'AC1032' }));
    const bodies = document.entities.filter(e => e.type === 'MESH' && !e.model3dConsumed);
    report.push({ id: spec.id, features: document.entities.filter(e => e.feature3d).length, bodies: bodies.map(e => ({ name: e.label, ...meshProperties(e) })) });
    console.log(spec.id, document.entities.length, bodies.length);
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/modeling-samples.json', JSON.stringify(report, null, 2) + '\n');
