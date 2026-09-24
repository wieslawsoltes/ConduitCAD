import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, line, moveEntity, rect } from '@conduitcad/model';
import { buildScene, updateSceneEntities } from '@conduitcad/renderer';
test('incremental entity update retains buffer identity and leaves unrelated geometry unchanged', () => {
    const d = createDocument();
    for (let i = 0; i < 10000; i++)
        d.entities.push(line({ x: i * 10, y: 0 }, { x: i * 10 + 5, y: 5 }));
    const s = buildScene(d), data = s.data, before = data.slice();
    moveEntity(d.entities[20], 2, 3);
    const ranges = updateSceneEntities(s, d, [d.entities[20].id]);
    assert.equal(s.data, data);
    assert.deepEqual(ranges, [{ offset: 20, count: 1 }]);
    for (let i = 0; i < data.length; i++)
        if (i < 20 * 16 || i >= 21 * 16)
            assert.equal(data[i], before[i]);
    assert.equal(data[20 * 16], before[20 * 16] + 2);
    assert.equal(data[20 * 16 + 1], before[20 * 16 + 1] + 3);
});
test('incremental update switches to rebuild atomically when topology changes', () => { const d = createDocument(), a = line({ x: 0, y: 0 }, { x: 10, y: 10 }), b = rect(0, 20, 10, 10); d.entities = [a, b]; const s = buildScene(d), before = s.data.slice(); moveEntity(a, 5, 5); b.points.push({ x: 50, y: 50 }); assert.equal(updateSceneEntities(s, d, [a.id, b.id]), null); assert.deepEqual(s.data, before); });
test('incremental update relocates BVH hits after moving beyond previous scene bounds', () => { const d = createDocument(), e = line({ x: 0, y: 0 }, { x: 10, y: 0 }); d.entities = [e]; const s = buildScene(d); moveEntity(e, 1000, 1000); assert.ok(updateSceneEntities(s, d, [e.id])); assert.equal(s.index.search({ minX: 0, minY: 0, maxX: 10, maxY: 1 }).length, 0); assert.equal(s.index.search({ minX: 1000, minY: 999, maxX: 1010, maxY: 1001 }).length, 1); });
