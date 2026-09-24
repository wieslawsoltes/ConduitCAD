/** CPU-only measurements. Does not infer GPU timestamps or frame rate. */
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createDocument, line } from '@conduitcad/model';
import { buildScene, updateSceneEntities } from '@conduitcad/renderer';
import { writeDXF, parseDXF } from '@conduitcad/dxf';
import { routeOrthogonal } from '@conduitcad/routing';
const results = [], measure = (name, fn) => { const t = performance.now(), value = fn(); return { name, ms: +(performance.now() - t).toFixed(3), value }; };
for (const count of [1000, 10000, 100000]) {
    const d = createDocument('Synthetic ' + count + ' lines');
    for (let i = 0; i < count; i++) {
        const x = (i % 1000) * 10, y = Math.floor(i / 1000) * 10;
        d.entities.push(line({ x, y }, { x: x + 7, y: y + 5 }));
    }
    let scene;
    const compile = measure('compile', () => scene = buildScene(d));
    let hits = 0;
    const query = measure('1000 BVH queries', () => {
        for (let i = 0; i < 1000; i++)
            hits += scene.index.search({ minX: i * 5, minY: 0, maxX: i * 5 + 100, maxY: 100 }).length;
    });
    const edit = measure('patch 1 entity', () => { d.entities[0].a.x += 1; d.entities[0].b.x += 1; return updateSceneEntities(scene, d, [d.entities[0].id]); });
    results.push({ singleEntityPatchMs: edit.ms, entities: count, segments: scene.count, geometryUploadBytes: scene.data.byteLength, sceneCompileMs: compile.ms, spatialQueries1000Ms: query.ms, queryHits: hits });
}
const doc = createDocument('DXF synthetic 10000');
doc.entities = Array.from({ length: 10000 }, (_, i) => line({ x: i, y: i % 73 }, { x: i + 5, y: i % 73 + 6 }));
let source, read;
const out = measure('DXF write 10000 lines', () => source = writeDXF(doc)), input = measure('DXF parse 10000 lines', () => read = parseDXF(source));
const router = measure('100 obstacle routes', () => {
    let success = 0;
    for (let i = 0; i < 100; i++)
        if (routeOrthogonal({ x: 0, y: i }, { x: 300, y: i }, [{ minX: 50, minY: -10, maxX: 100, maxY: 130 }, { minX: 180, minY: -30, maxX: 220, maxY: 120 }], { clearance: 12 }).status === 'routed')
            success++;
    return success;
});
const report = { kind: 'CPU-only synthetic microbenchmark; not a browser/GPU/fps measurement', node: process.version, platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, scene: results, dxf: { entities: 10000, bytes: Buffer.byteLength(source), writeMs: out.ms, parseMs: input.ms, parsedEntities: read.entities.length }, routing: { runs: 100, ms: router.ms, successful: router.value } };
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
