import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpression, resolveParameters, ConstraintSolver } from '@conduitcad/constraints';
import { History } from '@conduitcad/history';
import { SpatialIndex } from '@conduitcad/spatial';
import { routeOrthogonal, routePorts, routeVia, graphFromDocument } from '@conduitcad/routing';
import { segmentIntersectsBox, inflate, distance, intersects } from '@conduitcad/geometry';
import { line, circle, createDocument } from '@conduitcad/model';
const near = (a, b, t = 1e-5) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
for (const [source, expected] of [['2+3*4', 14], ['(2+3)*4', 20], ['2^3^2', 512], ['-2^2', -4], ['2^-2', .25], ['(-2)^2', 4], ['2e3 / .5', 4000], ['pi*2', Math.PI * 2]])
    test('expression ' + source, () => near(evaluateExpression(source), expected));
test('parameter dependency resolution and cycle diagnostics', () => { assert.deepEqual(resolveParameters({ a: '10', b: 'a*2', c: 'b+a' }), { a: 10, b: 20, c: 30 }); assert.throws(() => resolveParameters({ a: 'b', b: 'a' }), /cycle/); });
for (const expr of ['globalThis.x=1', 'constructor', '1/0', 'abc', '1;2', 'Math.sin(2)', '2 +', '(2', '2**3'])
    test('unsafe or invalid expression rejected: ' + expr, () => assert.throws(() => evaluateExpression(expr)));
test('constraint horizontal and length solve together', () => { const l = line({ x: 0, y: 0 }, { x: 100, y: 5 }), r = new ConstraintSolver().solve([l], [{ type: 'horizontal', entityId: l.id }, { type: 'length', entityId: l.id, value: 'size' }], { size: '80' }); assert.ok(r.converged); near(l.a.y, l.b.y); near(distance(l.a, l.b), 80); });
test('radius constraint uses named expressions', () => { const c = circle({ x: 2, y: 3 }, 5), r = new ConstraintSolver().solve([c], [{ type: 'radius', entityId: c.id, value: 'd/2' }], { d: '24' }); assert.ok(r.converged); near(c.r, 12); });
test('coincidence and perpendicular constraints', () => { const a = line({ x: 0, y: 0 }, { x: 20, y: 0 }), b = line({ x: 23, y: 3 }, { x: 27, y: 23 }), r = new ConstraintSolver().solve([a, b], [{ type: 'fixed', entityId: a.id, target: structuredClone(a) }, { type: 'coincident', entities: [a.id, b.id] }, { type: 'perpendicular', entities: [a.id, b.id] }]); assert.ok(r.converged); near(distance(a.b, b.a), 0); near(b.a.x, b.b.x); });
test('conflicting constraints roll back complete geometry', () => { const a = line({ x: 0, y: 0 }, { x: 20, y: 0 }), before = structuredClone(a), r = new ConstraintSolver({ maxIterations: 20 }).solve([a], [{ type: 'fixed', entityId: a.id, target: before }, { type: 'length', entityId: a.id, value: '50' }]); assert.equal(r.converged, false); assert.equal(r.rolledBack, true); assert.deepEqual(a, before); });
test('stale, incompatible and negative-size constraints fail explicitly', () => { const c = circle({ x: 0, y: 0 }, 5), solver = new ConstraintSolver(); assert.throws(() => solver.solve([c], [{ type: 'horizontal', entityId: c.id }]), /line/); assert.throws(() => solver.solve([c], [{ type: 'radius', entityId: c.id, value: '-1' }]), /positive/); assert.throws(() => solver.solve([c], [{ type: 'radius', entityId: 'missing', value: '5' }]), /missing/); });
test('history atomically cancels exceptions and invalidates redo', () => { let doc = { n: 0 }; const h = new History({ capture: () => doc, restore: d => doc = d }); h.run('one', () => doc.n++); assert.equal(doc.n, 1); assert.ok(h.undo()); assert.equal(doc.n, 0); assert.ok(h.redo()); assert.equal(doc.n, 1); assert.throws(() => h.run('bad', () => { doc.n = 9; throw new Error('bad'); })); assert.equal(doc.n, 1); h.undo(); h.run('two', () => doc.n = 2); assert.equal(h.canRedo, false); assert.equal(h.undoStack.length, 1); });
test('history suppresses no-op edits and enforces entry limit', () => {
    let doc = { n: 0 };
    const h = new History({ capture: () => doc, restore: d => doc = d, limit: 2 });
    h.begin();
    assert.equal(h.commit(), false);
    for (let i = 0; i < 4; i++)
        h.run('edit', () => doc.n++);
    assert.equal(h.undoStack.length, 2);
    h.undo();
    h.undo();
    assert.equal(doc.n, 2);
});
test('spatial queries agree with brute force over 10000 boxes', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, minX: i % 100 * 5, minY: Math.floor(i / 100) * 7, maxX: i % 100 * 5 + 2, maxY: Math.floor(i / 100) * 7 + 4 })), idx = new SpatialIndex(items);
    for (let n = 0; n < 30; n++) {
        const box = { minX: n * 3, minY: n * 9, maxX: n * 3 + 31, maxY: n * 9 + 48 };
        assert.deepEqual(idx.search(box).map(x => x.id).sort((a, b) => a - b), items.filter(x => intersects(box, x)).map(x => x.id));
    }
    assert.equal(idx.size, 10000);
});
test('routing has no obstacle collisions and returns orthogonal segments', () => {
    const obs = [{ minX: 30, minY: -10, maxX: 70, maxY: 10 }], r = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 0 }, obs, { clearance: 8 });
    assert.equal(r.status, 'routed');
    assert.ok(r.points.length >= 4);
    for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1], b = r.points[i];
        assert.ok(a.x === b.x || a.y === b.y);
        assert.equal(segmentIntersectsBox(a, b, inflate(obs[0], 8)), false);
    }
});
test('router reports blocked endpoints and safety limits, never claims successful fallback', () => { const obs = [{ minX: -10, minY: -10, maxX: 10, maxY: 10 }]; assert.equal(routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 0 }, obs).status, 'blocked'); const r = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ minX: 40, minY: -10, maxX: 60, maxY: 10 }], { maxNodes: 2 }); assert.equal(r.status, 'blocked'); assert.match(r.reason, /limit/); });
test('port leads and waypoints preserve exact endpoints', () => { const from = { x: 0, y: 0, dx: 1, dy: 0, entityId: 'a' }, to = { x: 100, y: 50, dx: -1, dy: 0, entityId: 'b' }, r = routePorts(from, to, [{ id: 'a', minX: -40, minY: -40, maxX: 0, maxY: 40 }]); assert.equal(r.status, 'routed'); near(r.points[0].x, 0); near(r.points.at(-1).y, 50); const v = routeVia({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 50, y: 40 }], []); assert.equal(v.status, 'routed'); assert.ok(v.points.some(p => p.x === 50 && p.y === 40)); });
test('directed graph preserves port references', () => { const d = createDocument(); d.entities = [{ type: 'INSERT', id: 'a', tag: 'A', block: 'X' }, { type: 'INSERT', id: 'b', tag: 'B', block: 'X' }, { id: 'wire', connector: { from: { entityId: 'a', port: 'out' }, to: { entityId: 'b', port: 'in' }, style: 'electrical' } }]; const g = graphFromDocument(d); assert.equal(g.nodes.length, 2); assert.equal(g.edges[0].fromPort, 'out'); assert.equal(g.adjacency.a[0].to, 'b'); });
test('spatial updates remove stale hits and discover objects outside original tree bounds', () => { const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, minX: i, minY: 0, maxX: i + 1, maxY: 1 })), idx = new SpatialIndex(items); idx.update([{ id: 10, minX: 10000, minY: 10000, maxX: 10010, maxY: 10010 }]); assert.ok(!idx.search({ minX: 10, minY: 0, maxX: 11, maxY: 1 }).some(x => x.id === 10)); assert.deepEqual(idx.search({ minX: 9999, minY: 9999, maxX: 10011, maxY: 10011 }).map(x => x.id), [10]); assert.equal(idx.size, 1000); assert.throws(() => idx.update([{ id: 'missing', minX: 0, minY: 0, maxX: 1, maxY: 1 }]), /existing/); });
