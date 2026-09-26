import { V3, add3, sub3, mul3, dot3, cross3, unit3, distance3, lerp3, translation3, scaling3, rotation3, multiply4, transform3, ocs3, validateMesh, meshProperties, boxMesh, cylinderMesh, sphereMesh, torusMesh, extrudeMesh, revolveMesh, loftMesh, sweepMesh, booleanMesh, transformMesh, mergeMeshes, spline3, triangles3, faceNormal, sliceMesh } from '@conduitcad/geometry3d';
import { entity, clone } from '@conduitcad/model';
import { tessellatePolyline } from '@conduitcad/geometry';
import { evaluateExpression, resolveParameters } from '@conduitcad/constraints';
const field = (name, label, value) => ({ name, label, value });
export const MODELING_TOOLS = [
    { id: 'box', label: 'Box', group: 'Primitives', fields: [field('width', 'Width', 100), field('depth', 'Depth', 70), field('height', 'Height', 45)] },
    { id: 'cylinder', label: 'Cylinder', group: 'Primitives', fields: [field('radius', 'Radius', 30), field('height', 'Height', 70), field('segments', 'Radial segments', 48)] },
    { id: 'cone', label: 'Cone / frustum', group: 'Primitives', fields: [field('radius', 'Bottom radius', 35), field('topRadius', 'Top radius', 0), field('height', 'Height', 70), field('segments', 'Radial segments', 48)] },
    { id: 'sphere', label: 'Sphere', group: 'Primitives', fields: [field('radius', 'Radius', 35), field('segments', 'Radial segments', 32)] },
    { id: 'torus', label: 'Torus', group: 'Primitives', fields: [field('major', 'Major radius', 45), field('minor', 'Tube radius', 12), field('segments', 'Radial segments', 48)] },
    { id: 'wedge', label: 'Wedge', group: 'Primitives', fields: [field('width', 'Width', 100), field('depth', 'Depth', 60), field('height', 'Height', 50)] },
    { id: 'extrude', label: 'Extrude profile', group: 'Create', inputs: 1, fields: [field('height', 'Signed distance', 45), field('taper', 'Top scale change (0 = parallel)', 0), field('nx', 'Direction X', 0), field('ny', 'Direction Y', 0), field('nz', 'Direction Z', 1)] },
    { id: 'revolve', label: 'Revolve profile', group: 'Create', inputs: 1, fields: [field('angle', 'Angle · degrees', 360), field('segments', 'Angular segments', 48)] },
    { id: 'loft', label: 'Loft profiles', group: 'Create', inputs: 2, multiple: true, fields: [field('samples', 'Vertices per section', 32)] },
    { id: 'sweep', label: 'Sweep along path', group: 'Create', inputs: 2, fields: [] },
    { id: 'transform', label: 'Move / rotate / scale', group: 'Modify', inputs: 1, fields: [field('dx', 'Move X', 0), field('dy', 'Move Y', 0), field('dz', 'Move Z', 0), field('rx', 'Rotate X · degrees', 0), field('ry', 'Rotate Y · degrees', 0), field('rz', 'Rotate Z · degrees', 0), field('sx', 'Scale X', 1), field('sy', 'Scale Y', 1), field('sz', 'Scale Z', 1)] },
    { id: 'offset-face', label: 'Press / pull planar face', group: 'Modify', inputs: 1, fields: [field('face', 'Face index (zero based)', 0), field('distance', 'Normal offset', 5)] },
    { id: 'union', label: 'Boolean union', group: 'Combine', inputs: 2, fields: [] },
    { id: 'subtract', label: 'Boolean cut', group: 'Combine', inputs: 2, fields: [] },
    { id: 'intersect', label: 'Boolean intersection', group: 'Combine', inputs: 2, fields: [] },
    { id: 'linear-pattern', label: 'Rectangular pattern', group: 'Pattern', inputs: 1, fields: [field('count', 'Instances', 4), field('dx', 'X pitch', 100), field('dy', 'Y pitch', 0), field('dz', 'Z pitch', 0)] },
    { id: 'circular-pattern', label: 'Circular pattern', group: 'Pattern', inputs: 1, fields: [field('count', 'Instances', 6), field('angle', 'Total angle · degrees', 360), field('cx', 'Axis center X', 0), field('cy', 'Axis center Y', 0)] },
    { id: 'mirror', label: 'Mirror body', group: 'Pattern', inputs: 1, fields: [field('axis', 'Axis: 0=X, 1=Y, 2=Z', 0), field('offset', 'Mirror plane offset', 0)] }
];
const defaults = kind => Object.fromEntries((MODELING_TOOLS.find(t => t.id === kind)?.fields || []).map(f => [f.name, f.value]));
const cache = new Map();
let cacheBytes = 0;
function cached(key, fn) { if (cache.has(key)) {
    const v = cache.get(key);
    cache.delete(key);
    cache.set(key, v);
    return clone(v.mesh);
} const mesh = fn(); validateMesh(mesh); const bytes = key.length + mesh.points.length * 32 + mesh.faces.reduce((s, f) => s + 16 + f.length * 8, 0); if (bytes < 16000000) {
    while (cache.size && (cache.size >= 48 || cacheBytes + bytes > 16000000)) {
        const [first, value] = cache.entries().next().value;
        cache.delete(first);
        cacheBytes -= value.bytes;
    }
    cache.set(key, { mesh: clone(mesh), bytes });
    cacheBytes += bytes;
} return mesh; }
/** Native WCS curve sampling. OCS circles/polylines retain elevation and arbitrary axes. */
export function curvePoints3(e, { closed = false, samples = 96 } = {}) {
    let points, loop = false, ocs = false;
    if (e.type === 'LINE')
        points = [e.a, e.b];
    else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
        loop = !!e.closed;
        const spatial = e.type === 'POLYLINE' && !!(e.flags & 8);
        points = spatial ? e.points.map(p => ({ ...p })) : tessellatePolyline(e.points, loop, .15).map(p => ({ ...p, z: e.elevation ?? e.points[0]?.z ?? 0 }));
        ocs = !spatial;
    }
    else if (e.type === 'CIRCLE' || e.type === 'ARC') {
        loop = e.type === 'CIRCLE';
        let a = loop ? 0 : e.start, b = loop ? Math.PI * 2 : e.end;
        if (!loop && e.clockwise) {
            while (b >= a)
                b -= Math.PI * 2;
        }
        else {
            while (b <= a)
                b += Math.PI * 2;
        }
        points = Array.from({ length: loop ? samples : samples + 1 }, (_, i) => V3(e.c.x + e.r * Math.cos(a + (b - a) * i / samples), e.c.y + e.r * Math.sin(a + (b - a) * i / samples), e.c.z ?? e.elevation ?? 0));
        ocs = true;
    }
    else if (e.type === 'ELLIPSE') {
        const u = e.major, v = mul3(unit3(cross3(e.extrusion || V3(0, 0, 1), u)), Math.hypot(u.x, u.y, u.z || 0) * (e.ratio ?? 1)), a = e.start ?? 0;
        let b = e.end ?? 2 * Math.PI;
        while (b <= a)
            b += 2 * Math.PI;
        loop = Math.abs(b - a - 2 * Math.PI) < 1e-8;
        points = Array.from({ length: loop ? samples : samples + 1 }, (_, i) => add3(e.c, add3(mul3(u, Math.cos(a + (b - a) * i / samples)), mul3(v, Math.sin(a + (b - a) * i / samples)))));
    }
    else if (e.type === 'SPLINE') {
        points = spline3(e, samples);
        loop = !!e.closed;
    }
    else if (e.type === 'HELIX') {
        if (e.helixSpline?.controlPoints?.length)
            points = spline3(e.helixSpline, samples);
        else {
            const n = unit3(e.axis || V3(0, 0, 1)), a = e.axisBase || V3(), s = e.startPoint || V3(e.radius, 0, 0), r = sub3(s, a), u = sub3(r, mul3(n, dot3(r, n))), v = cross3(n, u), turns = e.turns ?? 3;
            points = Array.from({ length: Math.min(4096, Math.max(32, Math.ceil(Math.abs(turns) * 48))) + 1 }, (_, i, all) => V3());
            const steps = points.length - 1;
            points = points.map((_, i) => { const f = i / steps, t = f * turns * 2 * Math.PI * (e.handedness === false ? -1 : 1); return add3(add3(s, mul3(u, Math.cos(t) - 1)), add3(mul3(v, Math.sin(t)), mul3(n, f * turns * e.turnHeight))); });
        }
    }
    else
        throw new Error(e.type + ' is not a supported spatial profile/path');
    if (ocs && e.extrusion)
        points = points.map(p => transform3(p, ocs3(e.extrusion)));
    if (points.length > 2 && distance3(points[0], points.at(-1)) < 1e-9) {
        points.pop();
        loop = true;
    }
    if (closed && !loop)
        throw new Error('Choose a closed circle, ellipse, planar polyline or closed spline');
    return { points, closed: loop };
}
function resample(points, n) { if (!Number.isInteger(n) || n < 3 || n > 256)
    throw new Error('Loft sampling must be an integer 3–256'); const lengths = points.map((p, i) => distance3(p, points[(i + 1) % points.length])), total = lengths.reduce((a, b) => a + b, 0); if (!(total > 1e-9))
    throw new Error('Empty loft profile'); let edge = 0, start = 0; return Array.from({ length: n }, (_, i) => { const d = total * i / n; while (edge < lengths.length - 1 && d > start + lengths[edge])
    start += lengths[edge++]; return lerp3(points[edge], points[(edge + 1) % points.length], (d - start) / lengths[edge]); }); }
function asMesh(e) { if (e.type !== 'MESH')
    throw new Error('This operation requires a native MESH body'); validateMesh(e); return { points: e.points, faces: e.faces }; }
export function offsetPlanarFace(mesh, index, distance) {
    validateMesh(mesh);
    if (!Number.isInteger(index) || index < 0 || index >= mesh.faces.length || !Number.isFinite(distance))
        throw new Error('Invalid face index or offset');
    const face = mesh.faces[index], normal = faceNormal(mesh.points, face), origin = mesh.points[face[0]], tolerance = mesh.points.reduce((size, p) => Math.max(size, distance3(p, origin)), 1) * 1e-8, group = new Set(face);
    let changed = true;
    while (changed) {
        changed = false;
        for (const f of mesh.faces) {
            if (!f.some(i => group.has(i)) || !f.every(i => Math.abs(dot3(sub3(mesh.points[i], origin), normal)) <= tolerance) || dot3(faceNormal(mesh.points, f), normal) < .999999)
                continue;
            for (const i of f)
                if (!group.has(i)) {
                    group.add(i);
                    changed = true;
                }
        }
    }
    const result = { points: mesh.points.map((p, i) => group.has(i) ? add3(p, mul3(normal, distance)) : { ...p }), faces: triangles3(mesh) };
    const before = meshProperties(mesh), after = meshProperties(result);
    if (before.closed && (!after.closed || after.signedVolume <= 1e-10))
        throw new Error('Face offset collapses or reverses this body');
    return result;
}
function evaluateFeature(f, inputs, variables) {
    const tool = MODELING_TOOLS.find(t => t.id === f.kind);
    if (!tool || f.version !== 1)
        throw new Error('Unsupported 3D feature schema or operation');
    if ((tool.inputs || 0) !== inputs.length && !(tool.multiple && inputs.length >= tool.inputs))
        throw new Error(tool.label + ': incorrect number of inputs');
    const p = { ...defaults(f.kind), ...f.parameters };
    for (const [k, v] of Object.entries(p)) {
        if (typeof v !== 'number' && typeof v !== 'string')
            throw new Error('Feature parameters must be numeric expressions');
        p[k] = typeof v === 'number' ? v : evaluateExpression(v, variables);
        if (!Number.isFinite(p[k]))
            throw new Error('Non-finite ' + k);
    }
    const key = JSON.stringify([f.kind, p, inputs.map(e => ({ type: e.type, points: e.points, faces: e.faces, a: e.a, b: e.b, c: e.c, r: e.r, major: e.major, ratio: e.ratio, start: e.start, end: e.end, extrusion: e.extrusion, elevation: e.elevation, flags: e.flags, closed: e.closed, controlPoints: e.controlPoints, knots: e.knots, weights: e.weights, degree: e.degree, clockwise: e.clockwise, helixSpline: e.helixSpline, axis: e.axis, axisBase: e.axisBase, startPoint: e.startPoint, turns: e.turns, turnHeight: e.turnHeight, handedness: e.handedness }))]);
    return cached(key, () => {
        let m;
        if (f.kind === 'box')
            m = boxMesh(p.width, p.depth, p.height);
        else if (f.kind === 'wedge')
            m = extrudeMesh([V3(), V3(p.width, 0, 0), V3(0, 0, p.height)], p.depth, V3(0, 1, 0));
        else if (f.kind === 'cylinder' || f.kind === 'cone')
            m = cylinderMesh(p.radius, p.height, p.segments, f.kind === 'cone' ? p.topRadius : p.radius);
        else if (f.kind === 'sphere')
            m = sphereMesh(p.radius, p.segments);
        else if (f.kind === 'torus')
            m = torusMesh(p.major, p.minor, p.segments);
        else if (f.kind === 'extrude')
            m = extrudeMesh(curvePoints3(inputs[0], { closed: true }).points, p.height, V3(p.nx, p.ny, p.nz), p.taper);
        else if (f.kind === 'revolve')
            m = revolveMesh(curvePoints3(inputs[0], { closed: true }).points, p.angle, p.segments);
        else if (f.kind === 'loft')
            m = loftMesh(inputs.map(e => resample(curvePoints3(e, { closed: true }).points, p.samples)));
        else if (f.kind === 'sweep')
            m = sweepMesh(curvePoints3(inputs[0], { closed: true, samples: 32 }).points, curvePoints3(inputs[1], { samples: 48 }).points);
        else if (['union', 'subtract', 'intersect'].includes(f.kind))
            m = booleanMesh(asMesh(inputs[0]), asMesh(inputs[1]), f.kind);
        else if (f.kind === 'transform') {
            const degrees = Math.PI / 180;
            let t = multiply4(translation3(p.dx, p.dy, p.dz), multiply4(rotation3(V3(0, 0, 1), p.rz * degrees), multiply4(rotation3(V3(0, 1, 0), p.ry * degrees), multiply4(rotation3(V3(1, 0, 0), p.rx * degrees), scaling3(p.sx, p.sy, p.sz)))));
            m = transformMesh(asMesh(inputs[0]), t);
        }
        else if (f.kind === 'offset-face')
            m = offsetPlanarFace(asMesh(inputs[0]), p.face, p.distance);
        else if (f.kind === 'mirror') {
            if (![0, 1, 2].includes(p.axis))
                throw new Error('Mirror axis must be 0, 1 or 2');
            const scales = [1, 1, 1], delta = [0, 0, 0];
            scales[p.axis] = -1;
            delta[p.axis] = 2 * p.offset;
            m = transformMesh(asMesh(inputs[0]), multiply4(translation3(...delta), scaling3(...scales)));
        }
        else if (f.kind.endsWith('-pattern')) {
            if (!Number.isInteger(p.count) || p.count < 1 || p.count > 128)
                throw new Error('Pattern count must be an integer 1–128');
            const src = asMesh(inputs[0]);
            if (src.points.length * p.count > 200000)
                throw new Error('Pattern vertex budget exceeded');
            m = mergeMeshes(Array.from({ length: p.count }, (_, i) => { const transform = f.kind === 'linear-pattern' ? translation3(i * p.dx, i * p.dy, i * p.dz) : multiply4(translation3(p.cx, p.cy, 0), multiply4(rotation3(V3(0, 0, 1), p.angle * Math.PI / 180 * i / (Math.abs(p.angle) === 360 ? p.count : Math.max(1, p.count - 1))), translation3(-p.cx, -p.cy, 0))); return transformMesh(src, transform); }));
        }
        else
            throw new Error('Unimplemented operation');
        if (!inputs.length && (p.x || p.y || p.z))
            m = transformMesh(m, translation3(p.x || 0, p.y || 0, p.z || 0));
        return m;
    });
}
/** Two-phase regeneration: evaluate every dependent result before mutating the document. */
export function regenerateFeatures(doc) {
    const features = doc.entities.filter(e => e.feature3d);
    if (!features.length) {
        for (const e of doc.entities)
            delete e.model3dConsumed;
        return { features: 0, updated: [] };
    }
    if (features.length > 256)
        throw new Error('Feature history exceeds 256 feature budget');
    const map = new Map(doc.entities.map(e => [e.id, e]));
    if (map.size !== doc.entities.length)
        throw new Error('Duplicate entity identities');
    const visiting = new Set(), done = new Map(), consumed = new Set(), variables = resolveParameters(doc.parameters || {}), order = [];
    function visit(e) {
        if (done.has(e.id))
            return done.get(e.id);
        if (visiting.has(e.id))
            throw new Error('Cyclic 3D feature dependency');
        if (!e.feature3d) {
            done.set(e.id, e);
            return e;
        }
        visiting.add(e.id);
        const f = e.feature3d;
        if (!Array.isArray(f.inputs) || f.inputs.length > 128)
            throw new Error('Invalid feature inputs');
        const inputs = f.inputs.map(id => { const input = map.get(id); if (!input)
            throw new Error('Missing feature input: ' + id); if (input.feature3d?.suppressed && !f.suppressed)
            throw new Error('An enabled feature depends on a suppressed input'); return visit(input); });
        let result = e;
        if (!f.suppressed) {
            try {
                const mesh = evaluateFeature(f, inputs, variables);
                result = { ...e, type: 'MESH', points: mesh.points, faces: mesh.faces, edges: [], creases: [], subdivision: 0 };
                for (const id of f.inputs)
                    consumed.add(id);
            }
            catch (error) {
                throw new Error(`${e.label || f.kind}: ${error.message}`);
            }
        }
        visiting.delete(e.id);
        done.set(e.id, result);
        order.push(e.id);
        return result;
    }
    for (const e of features)
        visit(e);
    const updated = [];
    for (const e of doc.entities) {
        const result = done.get(e.id);
        if (result && result !== e) {
            Object.assign(e, result);
            updated.push(e.id);
        }
        e.model3dConsumed = consumed.has(e.id);
    }
    return { features: features.length, updated, order };
}
export function addFeature(doc, kind, parameters = {}, inputs = [], options = {}) {
    const e = entity('MESH', { points: [], faces: [], layer: options.layer || 'Equipment', label: options.name || MODELING_TOOLS.find(t => t.id === kind)?.label || kind, color: options.color || '#5496a4', feature3d: { version: 1, kind, parameters: clone(parameters), inputs: inputs.slice(), suppressed: false } }), draft = { ...doc, entities: [...clone(doc.entities), e] };
    regenerateFeatures(draft);
    doc.entities = draft.entities;
    return doc.entities.find(x => x.id === e.id);
}
export function editFeature(doc, id, patch) { const draft = { ...doc, entities: clone(doc.entities) }, e = draft.entities.find(q => q.id === id); if (!e?.feature3d)
    throw new Error('Select a feature-driven body'); const f = e.feature3d; if (patch.parameters)
    f.parameters = { ...f.parameters, ...clone(patch.parameters) }; if (patch.inputs)
    f.inputs = patch.inputs.slice(); if (patch.suppressed !== undefined)
    f.suppressed = !!patch.suppressed; if (patch.name !== undefined)
    e.label = String(patch.name).slice(0, 160); regenerateFeatures(draft); doc.entities = draft.entities; return doc.entities.find(q => q.id === id); }
export function removeFeature(doc, id, { cascade = false } = {}) { const ids = new Set([id]); let changed = true; while (changed) {
    changed = false;
    for (const e of doc.entities)
        if (e.feature3d?.inputs.some(x => ids.has(x)) && !ids.has(e.id)) {
            if (!cascade)
                throw new Error('Feature has dependents; enable cascade deletion or remove dependents first');
            ids.add(e.id);
            changed = true;
        }
} const draft = { ...doc, entities: clone(doc.entities.filter(e => !ids.has(e.id))) }; regenerateFeatures(draft); if (!draft.entities.some(e => e.feature3d))
    for (const e of draft.entities)
        delete e.model3dConsumed; doc.entities = draft.entities; return [...ids]; }
export function bakeFeature(doc, id) { const draft = { ...doc, entities: clone(doc.entities) }, e = draft.entities.find(q => q.id === id); if (!e?.feature3d)
    throw new Error('No editable feature selected'); const inputs = e.feature3d.inputs.slice(); delete e.feature3d; regenerateFeatures(draft); for (const source of draft.entities)
    if (inputs.includes(source.id))
        source.hidden = true; doc.entities = draft.entities; return e; }
export function sectionEntities(mesh, axis = 'z', offset = 0) { const n = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) }[axis]; if (!n || !Number.isFinite(offset))
    throw new Error('Invalid section plane'); return sliceMesh(mesh, n, offset).map(([a, b]) => entity('LINE', { a, b, layer: 'Annotations', color: '#d88730' })); }
export function writeOBJ(mesh) { validateMesh(mesh); return ['# ConduitCAD faceted mesh', ...mesh.points.map(p => `v ${p.x} ${p.y} ${p.z || 0}`), ...mesh.faces.map(f => 'f ' + f.map(i => i + 1).join(' '))].join('\n') + '\n'; }
export function writeSTL(mesh, name = 'ConduitCAD') { validateMesh(mesh); const lines = ['solid ' + name.replace(/[^A-Za-z0-9_-]/g, '_')]; for (const f of triangles3(mesh)) {
    const n = faceNormal(mesh.points, f);
    lines.push(`facet normal ${n.x} ${n.y} ${n.z}`, 'outer loop', ...f.map(i => { const p = mesh.points[i]; return `vertex ${p.x} ${p.y} ${p.z || 0}`; }), 'endloop', 'endfacet');
} return lines.concat('endsolid').join('\n') + '\n'; }
