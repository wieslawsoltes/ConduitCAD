import { evaluateExpression } from '@conduitcad/constraints';
import { distance3 } from '@conduitcad/geometry3d';

export const MAX_SPATIAL_PATH_POINTS = 2048;
/** Evaluates native WCS POLYLINE coordinates; does not modify its argument. */
export function spatialPathPoints(coordinates, parameters = {}, closed = false) {
    if (!Array.isArray(coordinates) || coordinates.length < (closed ? 3 : 2) || coordinates.length > MAX_SPATIAL_PATH_POINTS)
        throw new Error(`A ${closed ? 'closed' : 'spatial'} path needs ${closed ? '3' : '2'}–2048 vertices`);
    const points = coordinates.map((p, i) => {
        if (!p || typeof p !== 'object') throw new Error('Invalid path point ' + (i + 1));
        const result = {};
        for (const axis of ['x', 'y', 'z']) {
            const source = p[axis];
            if (!['string', 'number'].includes(typeof source)) throw new Error('Every path point needs X, Y and Z');
            const value = evaluateExpression(source, parameters);
            if (Math.abs(value) > 1e12) throw new Error('Spatial coordinates must stay within ±1e12 drawing units');
            result[axis] = value;
        }
        return result;
    });
    for (let i = 1; i < points.length; i++) if (distance3(points[i], points[i - 1]) < 1e-8) throw new Error('Consecutive path vertices must be distinct');
    if (closed && distance3(points[0], points.at(-1)) < 1e-8) throw new Error('A closed path connects its last point automatically; do not repeat the first point');
    return points;
}
/** Prepare all path updates before feature evaluation; publish them only with the complete result. */
export function spatialPathUpdates(document) {
    const updates = new Map();
    for (const e of document.entities) {
        if (e.parametric?.kind !== 'spatial-path') continue;
        if (e.type !== 'POLYLINE' || !(e.flags & 8) || (e.flags & (2 | 4 | 16 | 64)) || e.feature3d || e.points?.some(p => p.bulge) || e.parametric.version !== 1)
            throw new Error('Parametric spatial paths require an ordinary native 3D POLYLINE');
        const points = spatialPathPoints(e.parametric.coordinates, document.parameters, !!e.closed);
        if (points.length !== e.points.length) throw new Error('Spatial path expression count does not match its vertices');
        const next = points.map((p, i) => ({ ...e.points[i], ...p }));
        if (JSON.stringify(next) !== JSON.stringify(e.points)) updates.set(e.id, { ...e, points: next, dirty: true });
    }
    return updates;
}
