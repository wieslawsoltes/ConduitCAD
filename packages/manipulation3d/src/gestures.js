import { V3, add3, sub3, mul3, dot3, cross3, unit3, finite3 } from '@conduitcad/geometry3d';
const finite = n => { if (!Number.isFinite(n)) throw new TypeError('A finite gesture coordinate is required'); return n; };
const point2 = p => ({ x: finite(p.x), y: finite(p.y) });
export function snapValue3(value, step = 0) {
    finite(value); finite(step);
    if (step < 0) throw new RangeError('Snap increment cannot be negative');
    if (!step) return value;
    const out = Math.round(value / step) * step;
    if (!Number.isFinite(out)) throw new RangeError('Snap range exceeded');
    return Number(out.toPrecision(14));
}
/** Ray / plane intersection in WCS; parallel and behind-eye rays are not invented. */
export function rayPlane3(ray, origin, normal) {
    finite3(origin); normal = unit3(finite3(normal));
    const direction=finite3(ray.direction),rayOrigin=finite3(ray.origin);
    const denominator = dot3(direction, normal);
    if (Math.abs(denominator) < 1e-7) return null;
    const t = dot3(sub3(origin, rayOrigin), normal) / denominator;
    if (!Number.isFinite(t) || t < 0) return null;
    return add3(rayOrigin, mul3(direction, t));
}
export function unitsPerPixel3(camera, origin) {
    const depth = camera.project(origin).depth;
    return camera.perspective ? Math.max(camera.near(), depth) * 2 * Math.tan(Math.PI / 8) / camera.pixelHeight : camera.height / camera.pixelHeight;
}
/** Snapshot projection state so a gesture never mixes two different cameras. */
function frozenCamera(camera) {
    const b = camera.basis(), width = camera.width, height = camera.pixelHeight, worldHeight = camera.height;
    const perspective = camera.perspective, near = camera.near();
    const ray = (x, y) => {
        const k = perspective ? 2 * Math.tan(Math.PI / 8) / height : worldHeight / height;
        const offset = add3(mul3(b.right, (x - width / 2) * k), mul3(b.up, (height / 2 - y) * k));
        return perspective ? { origin: b.eye, direction: unit3(add3(b.forward, offset)) } : { origin: add3(b.eye, offset), direction: b.forward };
    };
    return { ray, b, near, perspective, height, worldHeight };
}
function axisParameter(ray, origin, axis) {
    const o = sub3(ray.origin, origin), ad = dot3(axis, ray.direction), den = 1 - ad * ad;
    if (den < .0004) return null;
    return (dot3(axis, o) - ad * dot3(ray.direction, o)) / den;
}
/** Signed axis drag. End-on axes deliberately use vertical screen distance rather than exploding. */
export function beginAxisDrag3(camera, origin, axis, pointer) {
    origin = finite3(origin); axis = unit3(finite3(axis)); pointer = point2(pointer);
    const view = frozenCamera(camera), start = axisParameter(view.ray(pointer.x, pointer.y), origin, axis);
    const scale = unitsPerPixel3(camera, origin);
    return { kind: 'axis', origin, axis, pointer, start, view, scale, fallback: start === null };
}
export function updateAxisDrag3(drag, pointer) {
    pointer = point2(pointer);
    if (drag.fallback) return finite((drag.pointer.y - pointer.y) * drag.scale);
    const value = axisParameter(drag.view.ray(pointer.x, pointer.y), drag.origin, drag.axis);
    if (value === null) throw new Error('Axis projection became ambiguous; release and orbit');
    return finite(value - drag.start);
}
export function beginPlaneDrag3(camera, origin, u, v, pointer) {
    origin = finite3(origin); u = unit3(finite3(u)); v = unit3(finite3(v));
    if (Math.abs(dot3(u, v)) > 1e-6) throw new Error('Plane axes must be orthogonal');
    const view = frozenCamera(camera), normal = unit3(cross3(u, v));
    const start = rayPlane3(view.ray(pointer.x, pointer.y), origin, normal);
    if (!start) throw new Error('This plane is edge-on; orbit or use an axis handle');
    return { kind: 'plane', view, origin, u, v, normal, start };
}
export function updatePlaneDrag3(drag, pointer) {
    point2(pointer);
    const p = rayPlane3(drag.view.ray(pointer.x, pointer.y), drag.origin, drag.normal);
    if (!p) throw new Error('Pointer ray no longer intersects this plane');
    const delta = sub3(p, drag.start);
    return { u: finite(dot3(delta, drag.u)), v: finite(dot3(delta, drag.v)) };
}
/** Angles are unwrapped across +/-pi, supporting repeated complete revolutions. */
export function beginAngleDrag3(camera, origin, u, v, pointer) {
    const plane = beginPlaneDrag3(camera, origin, u, v, pointer), d = sub3(plane.start, origin);
    if (Math.hypot(dot3(d, u), dot3(d, v)) < 1e-10) throw new Error('Start rotation away from the axis center');
    return { ...plane, kind: 'angle', last: Math.atan2(dot3(d, v), dot3(d, u)), accumulated: 0 };
}
export function updateAngleDrag3(drag, pointer) {
    point2(pointer);
    const p = rayPlane3(drag.view.ray(pointer.x, pointer.y), drag.origin, drag.normal);
    if (!p) throw new Error('Rotation plane is edge-on; orbit first');
    const d = sub3(p, drag.origin), u = dot3(d, drag.u), v = dot3(d, drag.v);
    if (Math.hypot(u, v) < 1e-10) return drag.accumulated;
    const angle = Math.atan2(v, u);
    let delta = angle - drag.last;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    drag.accumulated += delta * 180 / Math.PI; drag.last = angle;
    return finite(drag.accumulated);
}
/** Keep an expression's dependency during a drag; the original expression is reused for every sample. */
export function expressionDelta3(original, delta, originalValue) {
    finite(delta); finite(originalValue);
    if (Math.abs(delta) <= 1e-12) return original;
    const n = Number((originalValue + delta).toPrecision(12)); finite(n);
    if (typeof original === 'number' || /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(String(original))) return n;
    const d = Number(Math.abs(delta).toPrecision(12));
    return `(${String(original)}) ${delta < 0 ? '-' : '+'} ${d}`;
}
export function perpendicularAxes3(axis) {
    axis = unit3(axis);
    const u = unit3(cross3(Math.abs(axis.z) < .9 ? V3(0, 0, 1) : V3(0, 1, 0), axis));
    return { u, v: unit3(cross3(axis, u)) };
}
