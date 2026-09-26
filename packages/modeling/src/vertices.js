import { V3, ocs3, transform3, finite3, distance3, triangles3, validateMesh } from '@conduitcad/geometry3d';
import { clone } from '@conduitcad/model';
function nativePoints(entity) {
    if (entity.points)
        return entity.points;
    if (entity.controlPoints)
        return entity.controlPoints;
    if (entity.type === 'LINE')
        return [entity.a, entity.b];
    if (entity.c)
        return [entity.c];
    if (entity.p)
        return [entity.p];
    throw new Error('This entity has no editable spatial control points');
}
function planarPolyline(e) { return e.type === 'LWPOLYLINE' || (e.type === 'POLYLINE' && !(e.flags & (8 | 16 | 64))); }
function usesOCS(e) { return planarPolyline(e) || ['ARC', 'CIRCLE', 'SOLID', 'TRACE', 'TEXT', 'ATTRIB', 'ATTDEF'].includes(e.type); }
/** Expose native control points in WCS, not display tessellation vertices. */
export function controlPoints3(entity) {
    const points = nativePoints(entity), m = usesOCS(entity) ? ocs3(entity.extrusion || V3(0, 0, 1)) : null;
    return points.map(p => { let q = finite3(p); if (planarPolyline(entity))
        q.z = entity.elevation ?? points[0]?.z ?? 0; return m ? transform3(q, m) : q; });
}
/** Atomic WCS vertex edit. A planar DXF polyline cannot acquire a single off-plane vertex. */
export function setControlPoint3(entity, index, point) {
    point = finite3(point);
    const draft = clone(entity), points = nativePoints(draft);
    if (!Number.isInteger(index) || index < 0 || index >= points.length)
        throw new Error('Vertex index is out of range');
    if (usesOCS(draft)) {
        const m = ocs3(draft.extrusion || V3(0, 0, 1));
        point = V3(point.x * m[0] + point.y * m[1] + point.z * m[2], point.x * m[4] + point.y * m[5] + point.z * m[6], point.x * m[8] + point.y * m[9] + point.z * m[10]);
    }
    if (planarPolyline(draft)) {
        const z = draft.elevation ?? points[0]?.z ?? 0;
        if (Math.abs(point.z - z) > Math.max(1e-8, Math.abs(z) * 1e-12))
            throw new Error('A planar DXF polyline vertex must remain on its OCS plane');
        point.z = z;
    }
    const triangle = draft.type === '3DFACE' && points.length === 4 && distance3(points[2], points[3]) < 1e-10;
    if (draft.type === 'MESH') {
        draft.faces = triangles3(draft);
        delete draft.feature3d;
    }
    Object.assign(points[index], point);
    if (triangle && (index === 2 || index === 3)) {
        Object.assign(points[2], point);
        Object.assign(points[3], point);
    }
    if (draft.type === 'SPLINE')
        draft.fitPoints = [];
    if (draft.type === 'MESH')
        validateMesh(draft);
    draft.dirty = true;
    // Object.assign does not remove properties omitted from the validated draft.
    // Detach only after all validation has succeeded, so rejected edits are atomic.
    if (draft.type === 'MESH')
        delete entity.feature3d;
    Object.assign(entity, draft);
    return entity;
}
