/** New recovery-time regressions; these do not stand in for missing historical results. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { V3, boxMesh, meshProperties, transformMesh, translation3, triangles3, faceNormal, spline3 } from '@conduitcad/geometry3d';
import { EXAMPLES_3D, create3DExample, addFeature, editFeature, removeFeature, bakeFeature, regenerateFeatures, curvePoints3, controlPoints3, setControlPoint3, offsetPlanarFace, sectionEntities, writeOBJ, writeSTL } from '@conduitcad/modeling';
import { entity, createDocument, circle, polyline, isVisible } from '@conduitcad/model';
import { writeDXF, writeDXFBinary, parseDXF } from '@conduitcad/dxf';
import { OrbitCamera, buildScene3D, pick3D } from '@conduitcad/renderer3d';
import { rasterizeScene } from '../packages/renderer3d/src/software.js';

function near(actual, expected, tolerance = 1e-7) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
function documentWith(...entities) {
    const document = createDocument('Recovery regression');
    document.entities = entities;
    return document;
}
function body(mesh, id, color = '#669999') {
    return entity('MESH', { ...mesh, id, color, layer: 'Equipment' });
}
function pair() {
    const document = documentWith();
    const parent = addFeature(document, 'box', { width: 20, depth: 10, height: 5 });
    const child = addFeature(document, 'transform', { dz: 30 }, [parent.id]);
    return { document, parentId: parent.id, childId: child.id };
}

test('Feature parent edit regenerates dependent geometry without changing identities', () => {
    const { document, parentId, childId } = pair();
    editFeature(document, parentId, { parameters: { width: 40 } });
    assert.deepEqual(document.entities.map(e => e.id), [parentId, childId]);
    const child = document.entities[1];
    near(Math.max(...child.points.map(p => p.x)), 40);
    near(Math.min(...child.points.map(p => p.z)), 30);
    assert.equal(document.entities[0].model3dConsumed, true);
});

test('Invalid upstream edit is atomic across all dependent bodies', () => {
    const { document, parentId } = pair();
    const before = JSON.stringify(document);
    assert.throws(() => editFeature(document, parentId, { parameters: { width: -1 } }), /positive/i);
    assert.equal(JSON.stringify(document), before);
});

test('Missing inputs and cyclic dependencies leave the document unchanged', () => {
    const { document, parentId, childId } = pair();
    const before = JSON.stringify(document);
    assert.throws(() => editFeature(document, childId, { inputs: ['missing'] }), /missing/i);
    assert.equal(JSON.stringify(document), before);
    assert.throws(() => editFeature(document, parentId, { inputs: [childId] }), /cyclic/i);
    assert.equal(JSON.stringify(document), before);
});

test('Suppression restores stock and guards enabled descendants', () => {
    const { document, parentId, childId } = pair();
    const before = JSON.stringify(document);
    assert.throws(() => editFeature(document, parentId, { suppressed: true }), /suppressed/i);
    assert.equal(JSON.stringify(document), before);
    editFeature(document, childId, { suppressed: true });
    assert.equal(document.entities[0].model3dConsumed, false);
    assert.equal(isVisible(document.entities[1], document), false);
    editFeature(document, childId, { suppressed: false });
    assert.equal(document.entities[0].model3dConsumed, true);
});

test('Feature removal requires explicit cascade and removes descendants', () => {
    const { document, parentId, childId } = pair();
    const before = JSON.stringify(document);
    assert.throws(() => removeFeature(document, parentId), /dependents/i);
    assert.equal(JSON.stringify(document), before);
    assert.deepEqual(new Set(removeFeature(document, parentId, { cascade: true })), new Set([parentId, childId]));
    assert.equal(document.entities.length, 0);
});

test('Baking a leaf retains evaluated geometry and hides input stock', () => {
    const { document, parentId, childId } = pair();
    const vertices = structuredClone(document.entities[1].points);
    const baked = bakeFeature(document, childId);
    assert.equal(baked.feature3d, undefined);
    assert.deepEqual(baked.points, vertices);
    assert.equal(document.entities.find(e => e.id === parentId).hidden, true);
});

test('Named expressions drive primitive and dependent pattern calculations', () => {
    const document = documentWith();
    document.parameters = { Width: '12', Depth: 'Width/2', Copies: '3' };
    const primitive = addFeature(document, 'box', { width: 'Width', depth: 'Depth', height: 4 });
    const pattern = addFeature(document, 'linear-pattern', { count: 'Copies', dx: 'Width*2' }, [primitive.id]);
    near(meshProperties(pattern).volume, 864);
    document.parameters.Width = '20';
    regenerateFeatures(document);
    near(meshProperties(document.entities[1]).volume, 2400);
});

test('Feature caches return independent geometry without cross-document mutation', () => {
    const a = documentWith(), b = documentWith();
    const left = addFeature(a, 'box', { width: 17, depth: 19, height: 23 });
    left.points[0].x = -500;
    const right = addFeature(b, 'box', { width: 17, depth: 19, height: 23 });
    near(right.points[0].x, 0);
});

test('Spatial native curves retain XYZ and tilted OCS elevation', () => {
    const e = circle(V3(0, 0, 7), 5, { extrusion: V3(0, -1, 0) });
    const sampled = curvePoints3(e);
    assert.equal(sampled.closed, true);
    assert.ok(sampled.points.every(p => Math.abs(p.y + 7) < 1e-8));
    assert.ok(sampled.points.some(p => Math.abs(p.z) > 4));
    const path = entity('POLYLINE', { flags: 8, points: [V3(0, 0, 3), V3(2, 4, 9)] });
    assert.deepEqual(curvePoints3(path).points, path.points);
});

test('Rational spatial spline sampling retains endpoint Z and weights', () => {
    const spline = { degree: 2, knots: [0, 0, 0, 1, 1, 1], weights: [1, .5, 1], controlPoints: [V3(0, 0, 2), V3(5, 10, 20), V3(10, 0, 8)] };
    const points = spline3(spline, 20);
    near(points[0].z, 2);
    near(points.at(-1).z, 8);
    assert.ok(points.some(p => p.z > 8));
});

test('Planar OCS controls reject an off-plane edit without mutation', () => {
    const e = polyline([V3(0, 0), V3(20, 0), V3(20, 10)], true, { extrusion: V3(0, -1, 0), elevation: 6 });
    const controls = controlPoints3(e);
    near(controls[1].y, -6);
    const before = JSON.stringify(e);
    assert.throws(() => setControlPoint3(e, 1, V3(20, -7, 0)), /OCS plane/);
    assert.equal(JSON.stringify(e), before);
    setControlPoint3(e, 1, V3(25, -6, 0));
    near(e.points[1].x, 25);
});

test('3DFACE triangle controls keep native duplicate fourth vertex synchronized', () => {
    const e = entity('3DFACE', { points: [V3(), V3(10, 0), V3(0, 10, 4), V3(0, 10, 4)] });
    setControlPoint3(e, 3, V3(2, 12, 9));
    assert.deepEqual(e.points[2], e.points[3]);
    near(e.points[2].z, 9);
});

test('Direct mesh control editing detaches feature metadata only after successful validation', () => {
    const document = documentWith();
    const e = addFeature(document, 'box', { width: 10, depth: 10, height: 10 });
    const before = JSON.stringify(e);
    assert.throws(() => setControlPoint3(e, 0, V3(NaN, 0, 0)), /finite/i);
    assert.equal(JSON.stringify(e), before);
    setControlPoint3(e, 0, V3(-1, 0, 0));
    assert.equal(e.feature3d, undefined);
    assert.ok(e.faces.every(f => f.length === 3));
    near(e.points[0].x, -1);
});

test('Planar face press/pull moves its connected face and preserves closed topology', () => {
    const mesh = boxMesh(20, 10, 5);
    const face = mesh.faces.findIndex(f => faceNormal(mesh.points, f).z > .99);
    const modified = offsetPlanarFace(mesh, face, 3);
    near(Math.max(...modified.points.map(p => p.z)), 8);
    near(meshProperties(modified).volume, 1600);
    assert.equal(meshProperties(modified).closed, true);
    near(Math.max(...mesh.points.map(p => p.z)), 5);
});

test('Section calculations emit finite native lines on the requested plane', () => {
    const section = sectionEntities(boxMesh(20, 10, 8), 'z', 3);
    assert.ok(section.length >= 4);
    assert.ok(section.every(e => e.type === 'LINE' && e.a.z === 3 && e.b.z === 3));
    assert.equal(sectionEntities(boxMesh(), 'z', -100).length, 0);
});

test('OBJ/STL serialization contains native evaluated coordinates and all triangles', () => {
    const mesh = transformMesh(boxMesh(2, 3, 4), translation3(5, 6, 7));
    const obj = writeOBJ(mesh), stl = writeSTL(mesh, 'Test body');
    assert.equal(obj.split('\n').filter(s => s.startsWith('v ')).length, mesh.points.length);
    assert.equal(obj.split('\n').filter(s => s.startsWith('f ')).length, mesh.faces.length);
    assert.equal(stl.split('\n').filter(s => s.startsWith('facet normal')).length, triangles3(mesh).length);
    assert.ok(obj.includes('v 5 6 7'));
    assert.ok(stl.startsWith('solid Test_body'));
});

for (const spec of EXAMPLES_3D) {
    test(`Recovered example ${spec.id} is deterministic and regenerates native closed bodies`, () => {
        const first = create3DExample(spec.id), second = create3DExample(spec.id);
        assert.deepEqual(first.entities, second.entities);
        assert.ok(first.entities.some(e => e.feature3d));
        regenerateFeatures(first);
        for (const e of first.entities.filter(e => e.type === 'MESH')) {
            const properties = meshProperties(e);
            assert.equal(properties.closed, true);
            assert.ok(properties.volume > 0);
        }
        const scene = buildScene3D(first);
        assert.equal(scene.diagnostics.length, 0);
        assert.ok(scene.triangles.length > 0);
    });
}

for (const [encoding, write] of [['ASCII', writeDXF], ['binary', writeDXFBinary]]) {
    for (const includeMetadata of [true, false]) {
        test(`${encoding} DXF round trip retains mesh topology and explicit metadata contract (${includeMetadata})`, () => {
            const { document, parentId, childId } = pair();
            const reread = parseDXF(write(document, { version: 'AC1032', includeMetadata }));
            assert.equal(reread.entities.length, 2);
            for (let i = 0; i < 2; i++) {
                assert.equal(reread.entities[i].type, 'MESH');
                assert.deepEqual(reread.entities[i].points, document.entities[i].points);
                assert.deepEqual(reread.entities[i].faces, document.entities[i].faces);
            }
            if (includeMetadata) {
                assert.deepEqual(reread.entities.map(e => e.id), [parentId, childId]);
                assert.equal(reread.entities[0].hidden, false);
                assert.equal(reread.entities[0].model3dConsumed, true);
                editFeature(reread, parentId, { parameters: { width: 35 } });
                near(Math.max(...reread.entities[1].points.map(p => p.x)), 35);
            } else {
                assert.ok(reread.entities.every(e => !e.feature3d));
                assert.equal(reread.entities[0].hidden, true);
            }
        });
    }
}

for (const perspective of [false, true]) {
    test(`Depth picking chooses the nearest face regardless of entity order (perspective=${perspective})`, () => {
        const camera = new OrbitCamera({ perspective });
        camera.resize(200, 160);
        camera.view('top');
        const far = body(boxMesh(10, 10, 3), 'far', '#003388');
        const nearBody = body(transformMesh(boxMesh(10, 10, 3), translation3(0, 0, 10)), 'near', '#ff6600');
        const scene = buildScene3D(documentWith(far, nearBody));
        camera.fit(scene.points);
        const q = camera.project(V3(5, 5, 13));
        assert.equal(pick3D(scene, camera, q.x, q.y).id, 'near');
        const reverse = buildScene3D(documentWith(nearBody, far));
        assert.equal(pick3D(reverse, camera, q.x, q.y).id, 'near');
        assert.equal(pick3D(scene, camera, q.x, q.y, { section: { normal: V3(0, 0, 1), offset: 4 } }).id, 'far');
        const options = { width: 200, height: 160, style: 'shaded', rgb: () => [0, 0, 0], shade: t => t.id === 'near' ? [1, .4, 0, 1] : [0, .2, .6, 1] };
        assert.deepEqual(rasterizeScene(scene, camera, options).pixels, rasterizeScene(reverse, camera, options).pixels);
    });
}

test('Nested INSERT transformations preserve Z and map picking to owning reference', () => {
    const document = documentWith(entity('INSERT', { id: 'outer', block: 'outerBlock', x: 100, y: 200, z: 300, sx: 2, sy: 3, sz: 4 }));
    document.blocks.innerBlock = { name: 'innerBlock', base: V3(), entities: [body(boxMesh(2, 3, 4), 'mesh')] };
    document.blocks.outerBlock = { name: 'outerBlock', base: V3(), entities: [entity('INSERT', { block: 'innerBlock', x: 5, y: 6, z: 7 })] };
    const scene = buildScene3D(document);
    assert.equal(scene.diagnostics.length, 0);
    near(scene.bounds.min.z, 328);
    near(scene.bounds.max.z, 344);
    assert.ok(scene.triangles.every(t => t.id === 'outer'));
});
