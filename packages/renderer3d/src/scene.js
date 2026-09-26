import { V3, add3, sub3, mul3, dot3, cross3, distance3, identity4, multiply4, translation3, rotation3, scaling3, transform3, ocs3, bounds3, triangulateFace, faceNormal, rayTriangle } from '@conduitcad/geometry3d';
import { curvePoints3, controlPoints3 } from '@conduitcad/modeling';
import { resolveStyle, evaluateDynamicBlock, dimensionPicture, cleanText } from '@conduitcad/model';
/** Spatial display list; unsupported entities emit explicit diagnostics instead of invented solids. */
export function buildScene3D(document, { showInputs = false, maxTriangles = 300000, maxInstances = 50000 } = {}) {
    const items = [], triangles = [], lines = [], labels = [], diagnostics = [];
    let visited = 0;
    function visit(e, parent = identity4(), owner = e.id, parentStyle = null, parentLayer = null, depth = 0) {
        if (++visited > maxInstances)
            throw new Error('3D instance expansion budget exceeded');
        const layer = document.layers.find(l => l.name === (e.layer === '0' && parentLayer ? parentLayer.name : e.layer));
        if (e.hidden || e.invisible || e.feature3d?.suppressed || (!showInputs && e.model3dConsumed) || layer?.visible === false)
            return;
        const style = resolveStyle(e, document, parentStyle, parentLayer);
        try {
            if (e.type === 'INSERT') {
                if (depth > 24)
                    throw new Error('Nested block depth exceeded');
                const definition = document.blocks[e.block], block = definition?.dynamic ? evaluateDynamicBlock(definition, e.dynamicParameters || {}) : definition;
                if (!block)
                    throw new Error('Missing block ' + e.block);
                const base = block.base || V3(), placement = multiply4(parent, multiply4(ocs3(e.extrusion || V3(0, 0, 1)), multiply4(translation3(e.x || 0, e.y || 0, e.z || 0), rotation3(V3(0, 0, 1), (e.rotation || 0) * Math.PI / 180)))), shape = multiply4(scaling3(e.sx ?? 1, e.sy ?? 1, e.sz ?? 1), translation3(-base.x, -base.y, -(base.z || 0)));
                const rows = e.rows || 1, columns = e.columns || 1;
                if (rows * columns > 10000)
                    throw new Error('Block array expansion budget exceeded');
                const used = new Set();
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < columns; c++) {
                        const x = c * (e.columnSpacing || 0), y = r * (e.rowSpacing || 0), key = x + ':' + y;
                        if (used.has(key))
                            continue;
                        used.add(key);
                        const m = multiply4(placement, multiply4(translation3(x, y, 0), shape));
                        for (const child of block.entities || [])
                            if (child.type !== 'ATTDEF' || child.constant || (child.attributeFlags & 2))
                                visit(child, m, owner, style, layer, depth + 1);
                    }
                for (const a of e.attributes || [])
                    visit(a, parent, owner, style, layer, depth + 1);
                return;
            }
            if (e.type === 'DIMENSION') {
                if (e.dimension?.version === 1) {
                    for (const child of dimensionPicture(e, document).entities)
                        visit(child, parent, owner, style, layer, depth + 1);
                }
                else if (e.block)
                    visit({ ...e, type: 'INSERT', x: 0, y: 0, z: 0 }, parent, owner, style, layer, depth + 1);
                return;
            }
            let points = [], faces = [], closed = false, wireOnly = false, mask = e.edgeFlags || 0;
            if (e.type === 'MESH') {
                points = e.points || [];
                faces = e.faces || [];
            }
            else if (e.type === '3DFACE' || e.type === 'SOLID' || e.type === 'TRACE') {
                points = e.points || [];
                if (e.type !== '3DFACE')
                    points = points.map(p => transform3(p, ocs3(e.extrusion || V3(0, 0, 1))));
                const ids = points.map((_, i) => i).filter((i, n, all) => all.findIndex(j => distance3(points[i], points[j]) < 1e-10) === n);
                if (ids.length >= 3)
                    faces = [ids];
            }
            else if (e.type === 'POLYLINE' && (e.flags & 64)) {
                points = e.points || [];
                faces = (e.faces || []).map(f => f.map(i => Math.abs(i) - 1));
            }
            else if (e.type === 'POLYLINE' && (e.flags & 16)) {
                points = e.points || [];
                const m = e.mCount, n = e.nCount;
                if (!Number.isInteger(m) || !Number.isInteger(n) || m < 2 || n < 2 || m * n !== points.length)
                    throw new Error('Invalid polygon mesh dimensions');
                for (let i = 0; i < m - ((e.flags & 1) ? 0 : 1); i++)
                    for (let j = 0; j < n - ((e.flags & 32) ? 0 : 1); j++) {
                        const a = i * n + j, b = ((i + 1) % m) * n + j, c = ((i + 1) % m) * n + (j + 1) % n, d = i * n + (j + 1) % n;
                        faces.push([a, b, c], [a, c, d]);
                    }
                if (e.smoothType)
                    diagnostics.push({ id: owner, message: 'Polygon mesh control surface; smooth surface fitting is not evaluated' });
            }
            else if (['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'ELLIPSE', 'SPLINE', 'HELIX'].includes(e.type)) {
                const g = curvePoints3(e);
                points = g.points;
                closed = g.closed;
                wireOnly = true;
            }
            else if (e.type === 'LEADER') {
                points = e.points || [];
                wireOnly = true;
            }
            else if (e.type === 'POINT') {
                const p = transform3(e.p, parent);
                labels.push({ p, text: '+', color: style.color, id: owner });
                return;
            }
            else if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(e.type)) {
                const p = e.type === 'MTEXT' ? e.p : transform3(e.p, ocs3(e.extrusion || V3(0, 0, 1)));
                labels.push({ p: transform3(p, parent), text: cleanText(e.text), height: e.height, color: style.color, id: owner });
                return;
            }
            else if (e.type === 'HATCH') {
                diagnostics.push({ id: owner, message: 'HATCH remains editable in 2D; 3D fill preview is not implemented' });
                return;
            }
            else if (e.type === 'RAY' || e.type === 'XLINE') {
                const length = 1000, a = e.type === 'RAY' ? e.p : add3(e.p, mul3(e.direction, -length));
                points = [a, add3(e.p, mul3(e.direction, length))];
                wireOnly = true;
                diagnostics.push({ id: owner, message: 'Infinite construction line shown with a finite 3D display range' });
            }
            else {
                diagnostics.push({ id: owner, message: e.type + ': no spatial tessellator; native source retained' });
                return;
            }
            points = points.map(p => transform3(p, parent));
            let controls=points;try{controls=controlPoints3(e).map(p=>transform3(p,parent));}catch{}
            const item = { id: owner, sourceId: e.id, points, controls, faces, style };
            items.push(item);
            const edgeKeys = new Map();
            for (let face = 0; face < faces.length; face++) {
                const ids = faces[face];
                for (const t of (e.type === '3DFACE' && ids.length === 4 ? [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]] : triangulateFace(points, ids))) {
                    if (triangles.length >= maxTriangles)
                        throw new Error('Triangle budget exceeded');
                    triangles.push({ id: owner, sourceId: e.id, face, indices: t, vertices: t.map(i => points[i]), normal: faceNormal(points, t), color: style.color });
                }
                for (let j = 0; j < ids.length; j++) {
                    if (e.type === '3DFACE' && (mask & (1 << j)))
                        continue;
                    if (e.type === 'POLYLINE' && (e.flags & 64) && e.faces[face][j] < 0)
                        continue;
                    const a = ids[j], b = ids[(j + 1) % ids.length], key = a < b ? a + ':' + b : b + ':' + a;
                    if (edgeKeys.has(key)) {
                        const previous = edgeKeys.get(key);
                        previous.coplanar = dot3(previous.normal, faceNormal(points, ids)) > 1 - 1e-7;
                        continue;
                    }
                    const edge = { a: points[a], b: points[b], id: owner, color: style.color, edge: true, normal: faceNormal(points, ids) };
                    edgeKeys.set(key, edge);
                    lines.push(edge);
                }
            }
            if (wireOnly)
                for (let i = 0; i < points.length - (closed ? 0 : 1); i++)
                    lines.push({ a: points[i], b: points[(i + 1) % points.length], id: owner, color: style.color });
        }
        catch (error) {
            diagnostics.push({ id: owner, message: error.message });
        }
    }
    for (const e of document.entities)
        if ((e.layout || 'Model') === 'Model')
            visit(e);
    const points = [...items.flatMap(i => i.points), ...labels.map(l => l.p)], box = bounds3(points), origin = box.empty ? V3() : mul3(add3(box.min, box.max), .5);
    return { items, triangles, lines, labels, diagnostics, points, bounds: box, origin };
}
export function pick3D(scene, camera, x, y, { mode = 'body', radius = 10, section = null } = {}) {
    const ray = camera.ray(x, y);
    let best = null;
    const admitted = p => !section || dot3(p, section.normal) <= section.offset + 1e-8;
    for (const t of scene.triangles) {
        const hit = rayTriangle(ray.origin, ray.direction, ...t.vertices);
        if (hit && admitted(hit.point) && (!best || hit.distance < best.distance))
            best = { ...hit, id: t.id, sourceId: t.sourceId, face: t.face, triangle: t.indices };
    }
    if (mode === 'vertex') {
        let vertex = null;
        for (const item of scene.items)
            for (let i = 0; i < (item.controls||item.points).length; i++) {
                const p = (item.controls||item.points)[i], q = camera.project(p), d = Math.hypot(q.x - x, q.y - y);
                if (q.visible && admitted(p) && d <= radius && (!best || q.depth <= camera.project(best.point).depth + camera.height * .01) && (!vertex || d < vertex.screenDistance))
                    vertex = { id: item.id, sourceId: item.sourceId, vertex: i, point: p, distance: q.depth, screenDistance: d };
            }
        return vertex;
    }
    if (best)
        return best;
    for (const l of scene.lines) {
        const a = camera.project(l.a), b = camera.project(l.b);
        if (!a.visible || !b.visible)
            continue;
        const dx = b.x - a.x, dy = b.y - a.y, den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / den)) : 0, d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y), point = add3(l.a, mul3(sub3(l.b, l.a), t)), depth = a.depth + (b.depth - a.depth) * t;
        if (d < radius && admitted(point) && (!best || depth < best.distance))
            best = { id: l.id, point, distance: depth };
    }
    return best;
}
