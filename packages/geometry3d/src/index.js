import { booleanPolygons } from './csg.js';
/** Double-precision spatial geometry. Meshes are indexed polygons, not ACIS solids. */
export const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add3 = (a, b) => V3(a.x + b.x, a.y + b.y, (a.z || 0) + (b.z || 0));
export const sub3 = (a, b) => V3(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
export const mul3 = (a, s) => V3(a.x * s, a.y * s, (a.z || 0) * s);
export const dot3 = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
export const cross3 = (a, b) => V3(a.y * (b.z || 0) - (a.z || 0) * b.y, (a.z || 0) * b.x - a.x * (b.z || 0), a.x * b.y - a.y * b.x);
export const length3 = a => Math.hypot(a.x, a.y, a.z || 0);
export const distance3 = (a, b) => length3(sub3(a, b));
export function unit3(a) { const l = length3(a); if (!(l > 1e-15) || !Number.isFinite(l))
    throw new Error('A finite non-zero direction is required'); return mul3(a, 1 / l); }
export const lerp3 = (a, b, t) => add3(a, mul3(sub3(b, a), t));
export function finite3(p) { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z ?? 0))
    throw new Error('Non-finite XYZ coordinate'); return V3(p.x, p.y, p.z ?? 0); }
export const identity4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function multiply4(a, b) { const c = Array(16).fill(0); for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++)
            c[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return c; }
export function transform3(p, m) { const z = p.z || 0, w = m[3] * p.x + m[7] * p.y + m[11] * z + m[15]; if (!Number.isFinite(w) || Math.abs(w) < 1e-15)
    throw new Error('Singular spatial transform'); return V3((m[0] * p.x + m[4] * p.y + m[8] * z + m[12]) / w, (m[1] * p.x + m[5] * p.y + m[9] * z + m[13]) / w, (m[2] * p.x + m[6] * p.y + m[10] * z + m[14]) / w); }
export const translation3 = (x = 0, y = 0, z = 0) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
export const scaling3 = (x = 1, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
export function rotation3(axis, angle) { const { x, y, z } = unit3(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c; return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]; }
/** AutoCAD arbitrary-axis algorithm. Columns are OCS X, Y and extrusion normal. */
export function ocs3(normal = V3(0, 0, 1)) { const z = unit3(normal), x = unit3(cross3(Math.abs(z.x) < 1 / 64 && Math.abs(z.y) < 1 / 64 ? V3(0, 1, 0) : V3(0, 0, 1), z)), y = cross3(z, x); return [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]; }
export function bounds3(points) { const min = V3(Infinity, Infinity, Infinity), max = V3(-Infinity, -Infinity, -Infinity); for (const p of points) {
    finite3(p);
    for (const a of ['x', 'y', 'z']) {
        min[a] = Math.min(min[a], p[a] || 0);
        max[a] = Math.max(max[a], p[a] || 0);
    }
} return { min, max, empty: !points.length }; }
export function faceNormal(points, face) { let n = V3(); const origin = points[face[0]]; for (let i = 1; i + 1 < face.length; i++)
    n = add3(n, cross3(sub3(points[face[i]], origin), sub3(points[face[i + 1]], origin))); return unit3(n); }
export function validateMesh(mesh, { maxVertices = 200000, maxFaces = 200000 } = {}) { if (!mesh || !Array.isArray(mesh.points) || !Array.isArray(mesh.faces) || mesh.points.length > maxVertices || mesh.faces.length > maxFaces)
    throw new Error('Invalid mesh or mesh budget exceeded'); mesh.points.forEach(finite3); for (const f of mesh.faces) {
    if (!Array.isArray(f) || f.length < 3 || f.length > 4096 || f.some(i => !Number.isInteger(i) || i < 0 || i >= mesh.points.length) || new Set(f).size !== f.length)
        throw new Error('Invalid mesh face indices');
    faceNormal(mesh.points, f);
} return mesh; }
/** Ear clipping on the dominant plane; concave planar faces are retained, not fan-filled. */
export function triangulateFace(points, face) {
    if (face.length === 3)
        return [face.slice()];
    const normal = faceNormal(points, face), axis = ['x', 'y', 'z'].sort((a, b) => Math.abs(normal[b]) - Math.abs(normal[a]))[0], axes = ['x', 'y', 'z'].filter(a => a !== axis);
    const origin = points[face[0]], size = Math.max(...face.map(i => distance3(points[i], origin)), 1e-15);
    if (face.some(i => Math.abs(dot3(sub3(points[i], origin), normal)) > size * 1e-7))
        throw new Error('Non-planar polygon face must be triangulated explicitly');
    const q = i => ({ x: (points[i][axes[0]] - origin[axes[0]]) / size, y: ((points[i][axes[1]] || 0) - (origin[axes[1]] || 0)) / size });
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), ids = face.slice(), result = [];
    let area = 0;
    for (let i = 0; i < ids.length; i++) {
        const a = q(ids[i]), b = q(ids[(i + 1) % ids.length]);
        area += a.x * b.y - b.x * a.y;
    }
    const sign = Math.sign(area);
    if (!sign)
        throw new Error('Zero-area face');
    for (let guard = 0; ids.length > 3 && guard < face.length * face.length; guard++) {
        let found = false;
        for (let i = 0; i < ids.length; i++) {
            const ia = ids[(i + ids.length - 1) % ids.length], ib = ids[i], ic = ids[(i + 1) % ids.length], a = q(ia), b = q(ib), c = q(ic);
            if (sign * cross(a, b, c) <= 1e-14)
                continue;
            if (ids.some(id => id !== ia && id !== ib && id !== ic && sign * cross(a, b, q(id)) >= -1e-14 && sign * cross(b, c, q(id)) >= -1e-14 && sign * cross(c, a, q(id)) >= -1e-14))
                continue;
            result.push([ia, ib, ic]);
            ids.splice(i, 1);
            found = true;
            break;
        }
        if (!found)
            throw new Error('Self-intersecting or degenerate polygon');
    }
    result.push(ids.slice());
    return result;
}
export function triangles3(mesh) { return mesh.faces.flatMap(f => triangulateFace(mesh.points, f)); }
export function transformMesh(mesh, m) { const points = mesh.points.map(p => transform3(p, m)); const det = dot3(V3(m[0], m[1], m[2]), cross3(V3(m[4], m[5], m[6]), V3(m[8], m[9], m[10]))); if (Math.abs(det) < 1e-15)
    throw new Error('Mesh transform collapses a dimension'); return { points, faces: mesh.faces.map(f => det < 0 ? f.slice().reverse() : f.slice()) }; }
export function mergeMeshes(meshes) { const points = [], faces = []; for (const m of meshes) {
    const base = points.length;
    points.push(...m.points.map(p => ({ ...p })));
    faces.push(...m.faces.map(f => f.map(i => i + base)));
} return validateMesh({ points, faces }); }
export function meshProperties(mesh) {
    validateMesh(mesh);
    const edges = new Map(), b = bounds3(mesh.points), origin = b.empty ? V3() : mul3(add3(b.min, b.max), .5);
    let area = 0, volume = 0, centroid = V3();
    for (const face of mesh.faces)
        for (let j = 0; j < face.length; j++) {
            const a = face[j], b = face[(j + 1) % face.length], key = a < b ? `${a}:${b}` : `${b}:${a}`, v = edges.get(key) || { count: 0, balance: 0 };
            v.count++;
            v.balance += a < b ? 1 : -1;
            edges.set(key, v);
        }
    for (const [ia, ib, ic] of triangles3(mesh)) {
        const a = sub3(mesh.points[ia], origin), b = sub3(mesh.points[ib], origin), c = sub3(mesh.points[ic], origin), v = dot3(a, cross3(b, c)) / 6;
        area += length3(cross3(sub3(b, a), sub3(c, a))) / 2;
        volume += v;
        centroid = add3(centroid, mul3(add3(add3(a, b), c), v / 4));
    }
    const boundaryEdges = [...edges.values()].filter(v => v.count === 1).length, nonManifoldEdges = [...edges.values()].filter(v => v.count > 2 || v.count === 2 && v.balance !== 0).length, closed = mesh.faces.length > 0 && !boundaryEdges && !nonManifoldEdges;
    return { vertices: mesh.points.length, faces: mesh.faces.length, edges: edges.size, triangles: triangles3(mesh).length, area, volume: closed ? Math.abs(volume) : null, signedVolume: volume, centroid: closed && Math.abs(volume) > 1e-15 ? add3(origin, mul3(centroid, 1 / volume)) : null, bounds: b, closed, boundaryEdges, nonManifoldEdges };
}
const positive = (n, label) => { if (!Number.isFinite(n) || n <= 0)
    throw new Error(label + ' must be positive'); return n; };
export function segments3(n = 48) { if (!Number.isInteger(n) || n < 3 || n > 256)
    throw new Error('Segments must be an integer from 3 to 256'); return n; }
export function boxMesh(width = 100, depth = 70, height = 50) { positive(width, 'Width'); positive(depth, 'Depth'); positive(height, 'Height'); return { points: [V3(), V3(width, 0), V3(width, depth), V3(0, depth), V3(0, 0, height), V3(width, 0, height), V3(width, depth, height), V3(0, depth, height)], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] }; }
export function cylinderMesh(radius = 30, height = 60, segments = 48, topRadius = radius) {
    positive(radius, 'Radius');
    positive(height, 'Height');
    segments3(segments);
    if (topRadius < 0 || !Number.isFinite(topRadius))
        throw new Error('Invalid top radius');
    const points = Array.from({ length: segments }, (_, i) => V3(radius * Math.cos(i * 2 * Math.PI / segments), radius * Math.sin(i * 2 * Math.PI / segments), 0)), faces = [];
    if (topRadius === 0) {
        points.push(V3(0, 0, height));
        faces.push(Array.from({ length: segments }, (_, i) => segments - 1 - i));
        for (let i = 0; i < segments; i++)
            faces.push([i, (i + 1) % segments, segments]);
    }
    else {
        for (let i = 0; i < segments; i++)
            points.push(V3(topRadius * Math.cos(i * 2 * Math.PI / segments), topRadius * Math.sin(i * 2 * Math.PI / segments), height));
        faces.push(Array.from({ length: segments }, (_, i) => segments - 1 - i), Array.from({ length: segments }, (_, i) => segments + i));
        for (let i = 0; i < segments; i++) {
            const j = (i + 1) % segments;
            faces.push([i, j, j + segments, i + segments]);
        }
    }
    return { points, faces };
}
export function sphereMesh(radius = 35, segments = 32) { positive(radius, 'Radius'); segments3(segments); const rings = Math.max(3, Math.floor(segments / 2)), points = [V3(0, 0, -radius)], faces = []; for (let j = 1; j < rings; j++)
    for (let i = 0; i < segments; i++) {
        const v = -Math.PI / 2 + j * Math.PI / rings, u = i * 2 * Math.PI / segments;
        points.push(V3(radius * Math.cos(v) * Math.cos(u), radius * Math.cos(v) * Math.sin(u), radius * Math.sin(v)));
    } const top = points.length; points.push(V3(0, 0, radius)); for (let i = 0; i < segments; i++) {
    const k = (i + 1) % segments;
    faces.push([0, 1 + k, 1 + i], [top, 1 + (rings - 2) * segments + i, 1 + (rings - 2) * segments + k]);
    for (let j = 0; j < rings - 2; j++) {
        const a = 1 + j * segments;
        faces.push([a + i, a + k, a + k + segments, a + i + segments]);
    }
} return { points, faces }; }
/** Ring profile radius,z swept about Z. Axis vertices are shared across all rings. */
export function revolveMesh(profile, angle = 360, segments = 48) {
    segments3(segments);
    if (!Array.isArray(profile) || profile.length < 3 || profile.length > 512 || !Number.isFinite(angle) || angle <= 0 || angle > 360)
        throw new Error('Revolve needs a closed radius/height profile and angle in (0,360]');
    const src = profile.map(p => { finite3(p); if (p.x < 0)
        throw new Error('Revolve radius cannot be negative'); return V3(p.x, 0, p.y); });
    triangulateFace(src, src.map((_, i) => i));
    // Orient radius/z profile clockwise so rotating around Z yields outward faces.
    let signed = 0;
    for (let i = 0; i < profile.length; i++) {
        const a = profile[i], b = profile[(i + 1) % profile.length];
        signed += a.x * b.y - b.x * a.y;
    }
    if (signed > 0)
        src.reverse();
    const full = Math.abs(angle - 360) < 1e-9, count = full ? segments : segments + 1, points = [], indices = [], axis = new Map(), faces = [];
    for (let i = 0; i < count; i++) {
        const theta = angle * Math.PI / 180 * i / segments, row = [];
        for (let j = 0; j < src.length; j++) {
            const p = src[j];
            if (p.x === 0 && axis.has(j))
                row.push(axis.get(j));
            else {
                row.push(points.length);
                if (p.x === 0)
                    axis.set(j, points.length);
                points.push(V3(p.x * Math.cos(theta), p.x * Math.sin(theta), p.z));
            }
        }
        indices.push(row);
    }
    for (let i = 0; i < segments; i++)
        for (let j = 0; j < src.length; j++) {
            const k = (j + 1) % src.length, next = (i + 1) % count, f = [indices[i][j], indices[i][k], indices[next][k], indices[next][j]].filter((v, n, a) => n === 0 || v !== a[n - 1]);
            if (f[0] === f.at(-1))
                f.pop();
            if (f.length >= 3)
                faces.push(f);
        }
    if (!full) {
        faces.push(indices[0].slice().reverse(), indices.at(-1).slice());
    }
    const m = { points, faces };
    if (meshProperties(m).signedVolume < 0)
        m.faces = m.faces.map(f => f.slice().reverse());
    return validateMesh(m);
}
export function torusMesh(major = 45, minor = 12, segments = 48, tubeSegments = 16) { if (!(major > minor))
    throw new Error('Major radius must exceed tube radius'); positive(minor, 'Tube radius'); segments3(tubeSegments); return revolveMesh(Array.from({ length: tubeSegments }, (_, i) => V3(major + minor * Math.cos(i * 2 * Math.PI / tubeSegments), minor * Math.sin(i * 2 * Math.PI / tubeSegments))), 360, segments); }
export function extrudeMesh(profile, height = 40, direction = V3(0, 0, 1), taper = 0) {
    if (!Array.isArray(profile) || profile.length < 3 || profile.length > 2048 || !Number.isFinite(height) || Math.abs(height) < 1e-10)
        throw new Error('Extrusion requires a closed planar profile and non-zero height');
    let base = profile.map(finite3), n = faceNormal(base, base.map((_, i) => i)), d = mul3(unit3(direction), height);
    if (Math.abs(dot3(n, unit3(d))) < 1e-8)
        throw new Error('Extrusion direction lies in the profile plane');
    if (dot3(n, d) < 0)
        base.reverse();
    const ids = base.map((_, i) => i), caps = triangulateFace(base, ids), center = mul3(base.reduce(add3, V3()), 1 / base.length);
    if (!Number.isFinite(taper) || taper <= -1)
        throw new Error('Top scale change must exceed -1');
    const points = [...base, ...base.map(p => add3(add3(center, mul3(sub3(p, center), 1 + taper)), d))], faces = [...caps.map(f => f.slice().reverse()), ...caps.map(f => f.map(i => i + base.length))];
    for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length;
        faces.push([i, j, j + base.length, i + base.length]);
    }
    return validateMesh({ points, faces });
}
export function loftMesh(sections, { closed = true } = {}) {
    if (!Array.isArray(sections) || sections.length < 2 || sections.length > 256)
        throw new Error('Loft requires 2–256 sections');
    const n = sections[0].length;
    if (n < 3 || n > 512 || sections.some(s => s.length !== n))
        throw new Error('Loft sections must have equal vertex counts');
    const points = sections.flatMap(s => s.map(finite3)), faces = [];
    for (let k = 0; k < sections.length - 1; k++)
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n, a = k * n + i, b = k * n + j, c = (k + 1) * n + j, d = (k + 1) * n + i;
            faces.push([a, b, c], [a, c, d]);
        }
    if (closed)
        faces.push(...triangulateFace(points, Array.from({ length: n }, (_, i) => n - 1 - i)), ...triangulateFace(points, Array.from({ length: n }, (_, i) => (sections.length - 1) * n + i)));
    const mesh = { points, faces };
    if (closed && meshProperties(mesh).signedVolume < 0)
        mesh.faces = mesh.faces.map(f => f.slice().reverse());
    return validateMesh(mesh);
}
/** Parallel-transport profile frames avoid twist at each sampled path segment. */
export function sweepMesh(profile, path) {
    if (path.length < 2 || path.length > 256)
        throw new Error('Sweep requires 2–256 path vertices');
    path.forEach(finite3);
    profile.forEach(finite3);
    const tangents = path.map((p, i) => unit3(sub3(path[Math.min(i + 1, path.length - 1)], path[Math.max(0, i - 1)])));
    let normal = unit3(cross3(Math.abs(tangents[0].z) < .9 ? V3(0, 0, 1) : V3(0, 1, 0), tangents[0]));
    const sections = [];
    for (let i = 0; i < path.length; i++) {
        if (i) {
            const axis = cross3(tangents[i - 1], tangents[i]), sin = length3(axis), cos = dot3(tangents[i - 1], tangents[i]);
            if (cos < -.999999)
                throw new Error('Sweep path reverses direction');
            if (sin > 1e-10)
                normal = transform3(normal, rotation3(axis, Math.atan2(sin, cos)));
        }
        const binormal = cross3(tangents[i], normal);
        sections.push(profile.map(p => add3(path[i], add3(mul3(normal, p.x), mul3(binormal, p.y)))));
    }
    return loftMesh(sections);
}
export function rayTriangle(origin, direction, a, b, c) { const e1 = sub3(b, a), e2 = sub3(c, a), p = cross3(direction, e2), det = dot3(e1, p); if (Math.abs(det) < 1e-12)
    return null; const t = sub3(origin, a), u = dot3(t, p) / det; if (u < 0 || u > 1)
    return null; const q = cross3(t, e1), v = dot3(direction, q) / det; if (v < 0 || u + v > 1)
    return null; const distance = dot3(e2, q) / det; return distance >= 0 ? { distance, point: add3(origin, mul3(direction, distance)), u, v } : null; }
export function sliceMesh(mesh, normal = V3(0, 0, 1), offset = 0) { const n = unit3(normal), lines = []; for (const face of triangles3(mesh)) {
    const hit = [];
    for (let i = 0; i < 3; i++) {
        const a = mesh.points[face[i]], b = mesh.points[face[(i + 1) % 3]], da = dot3(a, n) - offset, db = dot3(b, n) - offset;
        if (Math.abs(da) < 1e-9)
            hit.push(a);
        else if (da * db < 0)
            hit.push(lerp3(a, b, da / (da - db)));
    }
    const unique = hit.filter((p, i) => hit.findIndex(q => distance3(p, q) < 1e-8) === i);
    if (unique.length === 2)
        lines.push(unique);
} return lines; }
/** Rational De Boor evaluation in XYZ, including clamped endpoint handling. */
export function spline3(spline, steps = 96) { const p = spline.controlPoints || [], degree = spline.degree ?? 3, k = spline.knots || [], w = spline.weights || []; if (!p.length || degree < 1 || degree >= p.length || k.length !== p.length + degree + 1 || k.some((v, i) => !Number.isFinite(v) || i && v < k[i - 1]))
    throw new Error('Invalid NURBS knot vector'); p.forEach(finite3); if (w.length && w.length !== p.length || w.some(v => !Number.isFinite(v) || v <= 0))
    throw new Error('Invalid rational spline weights'); const start = k[degree], end = k[p.length]; if (!(end > start))
    throw new Error('Empty spline domain'); steps = Math.min(4096, Math.max(8, Math.floor(steps))); const result = []; for (let j = 0; j <= steps; j++) {
    const u = start + (end - start) * j / steps;
    let span = degree;
    while (span < p.length - 1 && u >= k[span + 1])
        span++;
    const d = Array.from({ length: degree + 1 }, (_, i) => { const id = span - degree + i, weight = w[id] ?? 1; return [p[id].x * weight, p[id].y * weight, (p[id].z || 0) * weight, weight]; });
    for (let r = 1; r <= degree; r++)
        for (let i = degree; i >= r; i--) {
            const id = span - degree + i, den = k[id + degree - r + 1] - k[id], a = den ? (u - k[id]) / den : 0;
            d[i] = d[i].map((v, n) => d[i - 1][n] * (1 - a) + v * a);
        }
    const v = d[degree];
    result.push(V3(v[0] / v[3], v[1] / v[3], v[2] / v[3]));
} return result; }
/** Normalize before clipping, weld generated vertices and conform shared edges. */
export function booleanMesh(left, right, operation = 'union') {
    for (const mesh of [left, right]) {
        const p = meshProperties(mesh);
        if (!p.closed || !(p.signedVolume > 0))
            throw new Error('Boolean inputs must be closed, outward-oriented meshes');
        if (p.triangles > 8192)
            throw new Error('Boolean input exceeds 8192 triangle budget');
    }
    const box = bounds3([...left.points, ...right.points]), center = mul3(add3(box.min, box.max), .5), scale = Math.max(...Object.values(sub3(box.max, box.min))), encode = m => triangles3(m).map(f => f.map(i => { const p = mul3(sub3(m.points[i], center), 1 / scale); return [p.x, p.y, p.z]; }));
    const polygons = booleanPolygons(encode(left), encode(right), operation), points = [], map = new Map(), faces = [];
    for (const poly of polygons) {
        const face = [];
        for (const p of poly) {
            const key = p.map(v => Math.round(v / 1e-7)).join(':');
            let id = map.get(key);
            if (id === undefined) {
                id = points.length;
                map.set(key, id);
                points.push(V3(...p));
            }
            if (face.at(-1) !== id)
                face.push(id);
        }
        if (face.at(-1) === face[0])
            face.pop();
        if (new Set(face).size >= 3)
            faces.push(face);
    }
    if (points.length > 12000)
        throw new Error('Boolean result exceeds topology-conformance budget');
    // Include split points on both sides of every edge to avoid BSP T-junctions.
    let work = 0;
    const conformed = faces.map(face => {
        const original = new Set(face), splits = face.map(() => []);
        // Near a corner a tolerance ball may touch two edges. Assign each split vertex
        // to its nearest edge once; inserting it twice creates a self-touching polygon.
        const edges = face.map((a, i) => { const b = face[(i + 1) % face.length], d = sub3(points[b], points[a]); return { a, b, d, den: dot3(d, d) }; });
        for (let j = 0; j < points.length; j++) {
            if (original.has(j)) continue;
            let best = null;
            for (let i = 0; i < edges.length; i++) {
                if (++work > 40000000) throw new Error('Boolean topology budget exceeded');
                const { a, b, d, den } = edges[i];
                if (!den) continue;
                const t = dot3(sub3(points[j], points[a]), d) / den;
                if (t <= 1e-7 || t >= 1 - 1e-7) continue;
                const gap = distance3(points[j], lerp3(points[a], points[b], t));
                // Edge incidence needs a tighter tolerance than BSP half-space classification:
                // a nearby point is not necessarily on the same geometric edge.
                if (gap < 1e-9 && (!best || gap < best.gap)) best = { edge: i, t, gap };
            }
            if (best) splits[best.edge].push([best.t, j]);
        }
        return face.flatMap((a, i) => [a, ...splits[i].sort((x, y) => x[0] - y[0]).map(x => x[1])]);
    });
    return validateMesh({ points: points.map(p => add3(center, mul3(p, scale))), faces: conformed });
}
