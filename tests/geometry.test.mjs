import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '@conduitcad/geometry';
const near = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
const point = (p, x, y) => { near(p.x, x); near(p.y, y); };
test('affine inverse and composition retain double precision', () => { const m = G.matrix({ x: 4e8, y: -9e8, rotation: 37, sx: 2, sy: .3 }), p = { x: 12.25, y: -84.5 }; const q = G.transform(G.transform(p, m), G.inverse(m)); point(q, p.x, p.y); const id = G.compose(m, G.inverse(m)); id.forEach((v, i) => near(v, G.identity()[i])); });
test('singular transforms fail explicitly', () => assert.throws(() => G.inverse([0, 0, 0, 0, 0, 0]), /Singular/));
test('zoom-independent segment projection clamps endpoints', () => { point(G.projectPoint({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 10, 0); point(G.projectPoint({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 10, y: 0 }, false), 50, 0); near(G.distanceToSegment({ x: 4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3); });
test('segment intersection and infinite-line extension', () => { point(G.lineIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }), 5, 5); assert.equal(G.lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: -1 }, { x: 4, y: 1 }), null); point(G.lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: -1 }, { x: 4, y: 1 }, false), 4, 0); });
test('parallel and degenerate lines do not produce NaNs', () => { assert.equal(G.lineIntersection({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 }), null); point(G.projectPoint({ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 3 }), 3, 3); });
test('box intersection checks crossing, contained and distant segments', () => { const b = { minX: 0, minY: 0, maxX: 10, maxY: 10 }; assert.ok(G.segmentIntersectsBox({ x: -2, y: 5 }, { x: 12, y: 5 }, b)); assert.ok(G.segmentIntersectsBox({ x: 2, y: 2 }, { x: 3, y: 3 }, b)); assert.equal(G.segmentIntersectsBox({ x: -2, y: 11 }, { x: 12, y: 11 }, b), false); });
test('polygon area and inclusive edge containment', () => { const p = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }]; near(G.polygonArea(p), 80); assert.ok(G.polygonContains({ x: 2, y: 3 }, p)); assert.ok(G.polygonContains({ x: 10, y: 3 }, p)); assert.equal(G.polygonContains({ x: 12, y: 3 }, p), false); });
test('orthogonal simplification removes duplicates but keeps reversal', () => { assert.deepEqual(G.simplifyOrthogonal([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }]), [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }]); assert.equal(G.simplifyOrthogonal([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }]).length, 3); });
test('arc tessellation follows adaptive chord error budget', () => {
    const ps = G.arcPoints({ x: 0, y: 0 }, 100, 0, G.TAU, .03);
    for (let i = 1; i < ps.length; i++)
        assert.ok(100 - G.length(G.lerp(ps[i - 1], ps[i], .5)) <= .030001);
    point(ps[0], 100, 0);
    point(ps.at(-1), 100, 0);
});
test('positive and negative bulges interpolate intended semicircles', () => {
    for (const bulge of [1, -1]) {
        const a = { x: 0, y: 0, bulge }, b = { x: 10, y: 0 }, arc = G.bulgeArc(a, b, bulge);
        point(arc.c, 5, 0);
        near(arc.r, 5);
        near(arc.sweep, bulge * Math.PI);
        const p = G.tessellatePolyline([a, b], false, .01);
        point(p[0], 0, 0);
        point(p.at(-1), 10, 0);
        assert.ok(p.some(p => bulge > 0 ? p.y < -4.9 : p.y > 4.9));
    }
});
test('rational quadratic NURBS quarter circle', () => { const cp = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], w = [1, Math.SQRT1_2, 1], k = [0, 0, 0, 1, 1, 1]; const p = G.nurbsPoint(cp, 2, k, .5, w); point(p, Math.SQRT1_2, Math.SQRT1_2); const ps = G.splinePoints({ controlPoints: cp, degree: 2, knots: k, weights: w }, .001); assert.ok(ps.length > 8); ps.forEach(p => near(G.length(p), 1)); });
test('spline evaluation rejects malformed explicit knot vectors', () => assert.throws(() => G.nurbsPoint([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }], 2, [0, 1], .5), /knot/));
test('open and closed offsets and tangent fillet', () => { const p = G.offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2); assert.deepEqual(p, [{ x: 0, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 10 }]); const f = G.filletLines({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 100 }, 10); point(f.p, 10, 0); point(f.q, 0, 10); point(f.c, 10, 10); assert.throws(() => G.filletLines({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 5 }, { x: 1, y: 5 }, 10)); });
test('circle quadrant snaps are exactly cardinal, arc snaps are restricted', () => { const c = G.snapCandidates({ type: 'CIRCLE', c: { x: 10, y: 20 }, r: 5 }); assert.equal(c.length, 5); point(c[1], 15, 20); point(c[2], 10, 25); point(c[3], 5, 20); point(c[4], 10, 15); const a = G.snapCandidates({ type: 'ARC', c: { x: 0, y: 0 }, r: 5, start: .2, end: 2 }); assert.equal(a.filter(x => x.kind === 'quadrant').length, 1); assert.equal(a.filter(x => x.kind === 'endpoint').length, 2); });
test('closed polyline provides closing-segment midpoint snap', () => { const ps = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]; assert.equal(G.snapCandidates({ type: 'LWPOLYLINE', points: ps, closed: true }).filter(x => x.kind === 'midpoint').length, 3); });
