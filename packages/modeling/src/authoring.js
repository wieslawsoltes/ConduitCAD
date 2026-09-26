import { V3, add3, sub3, mul3, dot3, cross3, unit3, distance3, finite3, faceNormal, validateMesh, triangulateFace, rayTriangle, extrudeMesh, revolveMesh, transformMesh, booleanMesh, meshProperties, ocs3 } from '@conduitcad/geometry3d';
import { entity } from '@conduitcad/model';

const positive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(label + ' must be positive');
    return value;
};
const choice = (value, choices, label) => {
    if (!choices.includes(value)) throw new Error('Unsupported ' + label);
    return value;
};

/** A local face frame follows dimensional edits while retaining the selected face's incidence.
 * Topology edits require explicit reattachment: a face index alone is not persistent naming.
 */
export function faceFrame3(mesh, index, reference = null) {
    validateMesh(mesh);
    if (!Number.isInteger(index) || !mesh.faces[index]) throw new Error('Select a valid planar face');
    const indices = mesh.faces[index];
    if (reference && (reference.face !== index || reference.vertexCount !== mesh.points.length ||
        reference.faceCount !== mesh.faces.length || !Array.isArray(reference.vertices) ||
        reference.vertices.length !== indices.length || indices.some((v, i) => reference.vertices[i] !== v)))
        throw new Error('Attached face topology changed; reselect the face before regenerating');
    const normal = faceNormal(mesh.points, indices), anchor = mesh.points[indices[0]];
    const size = Math.max(...indices.map(i => distance3(mesh.points[i], anchor)));
    const tolerance = Math.max(size * 1e-8, Math.max(...Object.values(anchor).map(Math.abs)) * Number.EPSILON * 16, 1e-10);
    if (indices.some(i => Math.abs(dot3(sub3(mesh.points[i], anchor), normal)) > tolerance))
        throw new Error('The selected face is not planar');
    const u = unit3(sub3(mesh.points[indices[1]], anchor)), v = unit3(cross3(normal, u));
    // Use translated coordinates to avoid summing large global origins.
    const center = add3(anchor, mul3(indices.reduce((sum, i) => add3(sum, sub3(mesh.points[i], anchor)), V3()), 1 / indices.length));
    return { origin: center, u, v, normal, tolerance,
        reference: { face: index, vertices: indices.slice(), vertexCount: mesh.points.length, faceCount: mesh.faces.length } };
}

export function faceCoordinates3(frame, point) {
    const delta = sub3(finite3(point), frame.origin);
    return { u: dot3(delta, frame.u), v: dot3(delta, frame.v), offset: dot3(delta, frame.normal) };
}

export function facePoint3(frame, u = 0, v = 0, offset = 0) {
    if (![u, v, offset].every(Number.isFinite)) throw new Error('Face coordinates must be finite');
    return add3(frame.origin, add3(mul3(frame.u, u), add3(mul3(frame.v, v), mul3(frame.normal, offset))));
}

/** Native snapshot of a rectangle/circle on a picked face. Does not create a hidden association. */
export function profileOnFace3(mesh, face, { shape = 'rectangle', width = 30, height = 20, radius = 10, u = 0, v = 0, offset = 0 } = {}) {
    const frame = faceFrame3(mesh, face), center = facePoint3(frame, u, v, offset), m = ocs3(frame.normal);
    const project = p => V3(dot3(p, V3(m[0], m[1], m[2])), dot3(p, V3(m[4], m[5], m[6])), dot3(p, frame.normal));
    const c = project(center), common = { layer: 'Annotations', label: 'Face profile', extrusion: frame.normal, elevation: c.z };
    if (shape === 'circle') return entity('CIRCLE', { ...common, c, r: positive(radius, 'Radius') });
    if (shape !== 'rectangle') throw new Error('Unsupported profile shape');
    positive(width, 'Width'); positive(height, 'Height');
    const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const p = project(add3(center, add3(mul3(frame.u, a * width / 2), mul3(frame.v, b * height / 2))));
        return { x: p.x, y: p.y };
    });
    return entity('LWPOLYLINE', { ...common, points, closed: true });
}

/** Extrusion extent in drawing units. Symmetric means total length, not per-side length. */
export function extrudeExtent3(profile, p) {
    const extent = choice(p.extent ?? 0, [0, 1, 2], 'extrusion extent');
    const direction = p.useNormal === 1 ? unit3(p.profileNormal || faceNormal(profile, profile.map((_, i) => i))) : unit3(V3(p.nx ?? 0, p.ny ?? 0, p.nz ?? 1));
    choice(p.useNormal ?? 0, [0, 1], 'extrusion direction mode');
    let height = p.height ?? 45, shift = p.startOffset ?? 0;
    if (!Number.isFinite(shift)) throw new Error('Start offset must be finite');
    if (extent === 1) { positive(height, 'Symmetric total distance'); shift -= height / 2; }
    if (extent === 2) { positive(height, 'Side one distance'); const second = positive(p.distance2 ?? 20, 'Side two distance'); shift -= second; height += second; }
    return extrudeMesh(profile.map(point => add3(point, mul3(direction, shift))), height, direction, p.taper ?? 0);
}

export function combineExtrusion3(tool, target, operation = 0) {
    choice(operation, [0, 1, 2, 3], 'extrusion operation');
    if (!operation) { if (target) throw new Error('New Body does not accept a target'); return tool; }
    if (!target || target.type !== 'MESH') throw new Error('Select a target mesh for Join, Cut or Intersect');
    const result = booleanMesh(target, tool, ['new', 'union', 'subtract', 'intersect'][operation]);
    const properties = meshProperties(result);
    if (!properties.closed || !(properties.signedVolume > 0)) throw new Error('Operation produced no closed body');
    if (operation === 2) {
        const before = meshProperties(target).volume;
        if (before - properties.volume <= Math.max(before * 1e-9, 1e-12)) throw new Error('The extrusion does not cut the target body');
    }
    return result;
}

/** One closed revolved cutter, not overlapping cylinders. Its local +Z is inward. */
export function holeTool3(target, parameters = {}, reference = null) {
    if (target.type && target.type !== 'MESH') throw new Error('Hole requires a native mesh body');
    const p = { face: 1, u: 0, v: 0, diameter: 10, depth: 15, through: 1, holeType: 0, counterDiameter: 18, counterDepth: 4, sinkAngle: 90, segments: 24, ...parameters };
    choice(p.through, [0, 1], 'hole extent'); choice(p.holeType, [0, 1, 2], 'hole type');
    const frame = faceFrame3(target, p.face, reference), center = facePoint3(frame, p.u, p.v), inward = mul3(frame.normal, -1);
    positive(p.diameter, 'Hole diameter');
    const properties = meshProperties(target);
    if (!properties.closed || properties.signedVolume <= 0) throw new Error('Hole target must be closed and outward oriented');
    const eps = Math.max(distance3(properties.bounds.min, properties.bounds.max) * 1e-5, frame.tolerance * 8);
    // Reject an out-of-face center rather than silently creating an unrelated cut elsewhere.
    const pointOnFace = triangulateFace(target.points, target.faces[p.face]).some(f => rayTriangle(add3(center, mul3(frame.normal, eps)), inward, ...f.map(i => target.points[i])));
    if (!pointOnFace) throw new Error('Hole center lies outside the selected face');
    const span = target.points.reduce((max, point) => Math.max(max, dot3(sub3(point, center), inward)), 0);
    const depth = p.through ? span + eps : positive(p.depth, 'Hole depth');
    if (!(depth > frame.tolerance)) throw new Error('No inward material along this face normal');
    const r = p.diameter / 2, top = p.holeType ? positive(p.counterDiameter, 'Counter diameter') / 2 : r;
    if (p.holeType && !(top > r)) throw new Error('Counter diameter must exceed hole diameter');
    let step = 0;
    if (p.holeType === 1) step = positive(p.counterDepth, 'Counterbore depth');
    if (p.holeType === 2) {
        if (!Number.isFinite(p.sinkAngle) || p.sinkAngle <= 1 || p.sinkAngle >= 179) throw new Error('Countersink included angle must be between 1 and 179 degrees');
        step = (top - r) / Math.tan(p.sinkAngle * Math.PI / 360);
    }
    if (step >= depth - eps) throw new Error('Counter recess must be shallower than the hole');
    const section = [V3(0, -eps), V3(top, -eps)];
    if (p.holeType === 1) section.push(V3(top, step), V3(r, step));
    else if (p.holeType === 2) section.push(V3(top, 0), V3(r, step));
    section.push(V3(r, depth), V3(0, depth));
    const local = revolveMesh(section, 360, p.segments), { u, v } = frame;
    const matrix = [u.x, u.y, u.z, 0, -v.x, -v.y, -v.z, 0, inward.x, inward.y, inward.z, 0, center.x, center.y, center.z, 1];
    return { mesh: transformMesh(local, matrix), frame, center, depth };
}

export function drillHole3(target, parameters, reference = null) {
    const { mesh, frame, center } = holeTool3(target, parameters, reference);
    const { u } = frame, v = mul3(frame.v, -1), inward = mul3(frame.normal, -1);
    // Perform clipping in the face frame. This also avoids global-origin cancellation.
    const local = source => ({ points: source.points.map(p => { const d = sub3(p, center); return V3(dot3(d, u), dot3(d, v), dot3(d, inward)); }), faces: source.faces });
    const result = combineExtrusion3(local(mesh), { ...local(target), type: 'MESH' }, 2);
    return transformMesh(result, [u.x,u.y,u.z,0,v.x,v.y,v.z,0,inward.x,inward.y,inward.z,0,center.x,center.y,center.z,1]);
}
