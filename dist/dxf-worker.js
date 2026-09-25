'use strict';
(()=>{
const __modules=Object.create(null);
// packages/dxf/src/fidelity.js
__modules["packages/dxf/src/fidelity.js"]=(()=>{
/** DXF entity fidelity helpers. Native values remain native: OCS coordinates,
 * signed linetype elements and hatch edge records are not flattened on import.
 * Autodesk DXF reference links and explicit limitations: docs/DXF_COMPATIBILITY.md.
 */
const get = (r, c, fallback = 0) => r.find(p => p[0] === c)?.[1] ?? fallback;
const point = (r, c = 10) => ({ x: +get(r, c), y: +get(r, c + 10), z: +get(r, c + 20) });
const all = (r, c) => r.filter(p => p[0] === c).map(p => p[1]);
const rad = d => d * Math.PI / 180;
function count(n, limit = 100000) {
    if (!Number.isSafeInteger(n) || n < 0 || n > limit) throw new Error('Invalid DXF collection length: ' + n);
    return n;
}
function parseHatchData(raw) {
    let i = raw.findIndex(p => p[0] === 91);
    if (i < 0) return { loops: [], patternLines: [] };
    const read = (code, fallback) => {
        if (raw[i]?.[0] === code) return raw[i++][1];
        if (fallback !== undefined) return fallback;
        throw new Error(`Malformed HATCH: expected group ${code}, got ${raw[i]?.[0]}`);
    };
    const p2 = (c = 10) => ({ x: +read(c), y: +read(c + 10) });
    const loops = [], n = count(+read(91));
    for (let k = 0; k < n; k++) {
        const flags = +read(92), loop = { flags, closed: true, points: [], edges: [] };
        if (flags & 2) {
            const bulge = +read(72); loop.closed = !!read(73);
            const vertices = count(+read(93));
            for (let j = 0; j < vertices; j++) {
                const p = p2(); if (bulge || raw[i]?.[0] === 42) p.bulge = +read(42, 0);
                loop.points.push(p);
            }
        } else {
            const edges = count(+read(93));
            for (let j = 0; j < edges; j++) {
                const type = +read(72); let edge;
                if (type === 1) edge = { type, a: p2(), b: p2(11) };
                else if (type === 2 || type === 3) {
                    edge = { type, c: p2() };
                    if (type === 3) edge.major = p2(11);
                    edge[type === 2 ? 'r' : 'ratio'] = +read(40);
                    edge.start = rad(+read(50)); edge.end = rad(+read(51)); edge.ccw = !!read(73);
                    if (!edge.ccw) { edge.start = 2*Math.PI-edge.start; edge.end = 2*Math.PI-edge.end; }
                } else if (type === 4) {
                    edge = { type, degree: +read(94), rational: !!read(73), periodic: !!read(74) };
                    const knots = count(+read(95)), controls = count(+read(96));
                    edge.knots = Array.from({ length: knots }, () => +read(40));
                    edge.controlPoints = []; edge.weights = [];
                    for (let q = 0; q < controls; q++) {
                        edge.controlPoints.push(p2());
                        if (edge.rational) edge.weights.push(+read(42, 1));
                    }
                    // Group 97 here is spline fit data; the later 97 belongs to the path.
                    const fits = count(+read(97, 0));
                    edge.fitPoints = Array.from({ length: fits }, () => p2(11));
                    if (raw[i]?.[0] === 12) edge.startTangent = p2(12);
                    if (raw[i]?.[0] === 13) edge.endTangent = p2(13);
                } else throw new Error('Unsupported HATCH edge type ' + type);
                loop.edges.push(edge);
            }
        }
        const refs = count(+read(97, 0));
        loop.sourceHandles = Array.from({ length: refs }, () => String(read(330)));
        loops.push(loop);
    }
    const tail = raw.slice(i), patternLines = [];
    const hatchStyle = +get(tail, 75), patternType = +get(tail, 76, 1);
    const pstart = tail.findIndex(p => p[0] === 78);
    if (pstart >= 0) {
        i += pstart;
        const lines = count(+read(78), 1024);
        for (let k = 0; k < lines; k++) {
            const angle = rad(+read(53)), base = { x: +read(43), y: +read(44) }, offset = { x: +read(45), y: +read(46) };
            const n = count(+read(79), 1024);
            patternLines.push({ angle, base, offset, dashes: Array.from({ length: n }, () => +read(49)) });
        }
    }
    return { loops, hatchStyle, patternType, patternAngle: +get(tail, 52), patternScale: +get(tail, 41, 1), patternDouble: !!get(tail, 77),
        elevation: +get(raw, 30), associative: !!get(raw, 71), patternLines,
        gradient: +get(tail, 450) ? tail.slice(tail.findIndex(p => p[0] === 450)).filter(p => p[0] < 1000) : null };
}
function readEntityFidelity(e, raw, diagnostics, options = {}) {
    e.extrusion = { x: +get(raw, 210), y: +get(raw, 220), z: +get(raw, 230, 1) };
    e.thickness = +get(raw, 39); e.linetypeScale = +get(raw, 48, 1);
    e.transparency = get(raw, 440, null);
    if (e.transparency !== null && (e.transparency & 0x02000000)) e.opacity = (e.transparency & 255) / 255;
    if (e.type === 'LWPOLYLINE' || e.type === 'VERTEX') {
        e.elevation = +get(raw, 38); let p = -1;
        for (const [c, v] of raw) {
            if (c === 10) p++;
            if ((c === 40 || c === 41) && p >= 0) {
                const q = e.points?.[p] || e.p;
                if (q) q[c === 40 ? 'startWidth' : 'endWidth'] = +v;
            }
        }
    }
    if (e.type === 'POLYLINE') { e.elevation = +get(raw, 30); e.startWidth = +get(raw, 40); e.endWidth = +get(raw, 41); }
    if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(e.type)) {
        e.styleName = String(get(raw, 7, 'STANDARD')); e.oblique = +get(raw, 51);
        e.textFlags = e.type === 'MTEXT' ? 0 : +get(raw, 71);
        if (e.type === 'MTEXT') {
            e.widthFactor = 1; // Group 41 is the reference box width, never an X-scale.
            e.attachment = +get(raw, 71, 1); e.lineSpacing = +get(raw, 44, 1); e.lineSpacingStyle = +get(raw, 73, 1);
            e.backgroundFill = +get(raw, 90); e.backgroundScale = +get(raw, 45, 1.5);
            const start = raw.findIndex(p => p[0] === 100 && p[1] === 'AcDbMText');
            const common = start >= 0 ? raw.slice(0, start) : raw, content = start >= 0 ? raw.slice(start) : [];
            const bg = get(content, 421, get(content, 420, null));
            e.backgroundColor = bg === null ? '#ffffff' : '#' + (Number(bg) & 0xffffff).toString(16).padStart(6, '0');
            const fg = get(common, 420, null);
            if (fg === null && bg !== null && +get(common, 62, 256) === 256) delete e.color;
            const directionIndex = raw.findIndex(p => p[0] === 11), angleIndex = raw.findIndex(p => p[0] === 50);
            // Wire DXF angle groups are degrees; callers can explicitly opt into the APP-radians convention.
            if (angleIndex > directionIndex && !get(raw, 75)) e.rotation = +raw[angleIndex][1] * (options.mtextRotationUnit === 'radians' ? 180 / Math.PI : 1);
            if (+get(raw, 75) || +get(raw, 72) === 3) diagnostics.push({ severity: 'warning', type: e.type, message: 'MTEXT columns/vertical flow preserved in source; displayed as a single horizontal text box.' });
        } else {
            e.halign = +get(raw, 72); e.valign = +get(raw, e.type === 'TEXT' ? 73 : 74);
            if (raw.some(p => p[0] === 11)) e.alignPoint = point(raw, 11);
        }
    }
    if (e.type === 'HATCH') {
        Object.assign(e, parseHatchData(raw));
        if (e.gradient) diagnostics.push({ severity: 'warning', type: 'HATCH', message: 'Gradient records retained; preview uses the entity color, not a gradient shader.' });
    }
    if (e.type === '3DFACE') { e.points = [point(raw), point(raw, 11), point(raw, 12), point(raw, 13)]; e.edgeFlags = +get(raw, 70); }
    if (e.type === 'LEADER') {
        e.points = []; let p;
        for (const [c, v] of raw) { if (c === 10) { p = { x: +v, y: 0, z: 0 }; e.points.push(p); } else if (p && c === 20) p.y = +v; else if (p && c === 30) p.z = +v; }
        e.arrow = !!get(raw, 71, 1); e.spline = !!get(raw, 72); e.dimstyle = get(raw, 3, 'STANDARD');
        if (e.spline) diagnostics.push({ severity: 'warning', type: e.type, message: 'Spline leader retained; displayed using its control polygon.' });
    }
    if (e.type === 'RAY' || e.type === 'XLINE') { e.p = point(raw); e.direction = point(raw, 11); }
}
function writeHatchData(e, pair) {
    const p2 = (c, p) => { pair(c, p.x); pair(c + 10, p.y); };
    pair(100, 'AcDbHatch'); pair(10, 0); pair(20, 0); pair(30, e.elevation || 0);
    pair(210, e.extrusion?.x || 0); pair(220, e.extrusion?.y || 0); pair(230, e.extrusion?.z ?? 1);
    pair(2, e.pattern || (e.solid ? 'SOLID' : 'USER')); pair(70, e.solid ? 1 : 0); pair(71, 0);
    pair(91, e.loops?.length || 0);
    for (const loop of e.loops || []) {
        const native = !!loop.edges?.length;
        pair(92, native ? (loop.flags || 0) & ~2 : (loop.flags || 0) | 2);
        if (native) {
            pair(93, loop.edges.length);
            for (const edge of loop.edges) {
                pair(72, edge.type);
                if (edge.type === 1) { p2(10, edge.a); p2(11, edge.b); }
                else if (edge.type === 2 || edge.type === 3) {
                    p2(10, edge.c); if (edge.type === 3) p2(11, edge.major);
                    pair(40, edge.type === 2 ? edge.r : edge.ratio); pair(50, (edge.ccw === false ? 2*Math.PI-edge.start : edge.start) * 180 / Math.PI); pair(51, (edge.ccw === false ? 2*Math.PI-edge.end : edge.end) * 180 / Math.PI); pair(73, edge.ccw === false ? 0 : 1);
                } else if (edge.type === 4) {
                    pair(94, edge.degree); pair(73, edge.rational ? 1 : 0); pair(74, edge.periodic ? 1 : 0);
                    pair(95, edge.knots.length); pair(96, edge.controlPoints.length);
                    edge.knots.forEach(v => pair(40, v));
                    edge.controlPoints.forEach((p, j) => { p2(10, p); if (edge.rational) pair(42, edge.weights?.[j] ?? 1); });
                    pair(97, edge.fitPoints?.length || 0); (edge.fitPoints || []).forEach(p => p2(11, p));
                    if (edge.startTangent) p2(12, edge.startTangent); if (edge.endTangent) p2(13, edge.endTangent);
                } else throw new Error('Unsupported HATCH edge export ' + edge.type);
            }
        } else {
            const points = loop.points || [], bulges = points.some(p => p.bulge);
            pair(72, bulges ? 1 : 0); pair(73, loop.closed === false ? 0 : 1); pair(93, points.length);
            for (const p of points) { p2(10, p); if (bulges) pair(42, p.bulge || 0); }
        }
        pair(97, 0); // Detached boundary references cannot safely reference regenerated handles.
    }
    pair(75, e.hatchStyle || 0); pair(76, e.patternType ?? 1);
    if (!e.solid) {
        pair(52, e.patternAngle || 0); pair(41, e.patternScale || 1); pair(77, e.patternDouble ? 1 : 0);
        pair(78, e.patternLines?.length || 0);
        for (const line of e.patternLines || []) {
            pair(53, line.angle * 180 / Math.PI); pair(43, line.base.x); pair(44, line.base.y); pair(45, line.offset.x); pair(46, line.offset.y);
            pair(79, line.dashes?.length || 0); for (const d of line.dashes || []) pair(49, d);
        }
    }
    pair(98, 0); for (const p of e.gradient || []) pair(...p);
}

return {parseHatchData,readEntityFidelity,writeHatchData};
})();
// packages/geometry/src/index.js
__modules["packages/geometry/src/index.js"]=(()=>{
/** Double-precision planar geometry. DXF coordinates are right-handed, Y up. */
const EPS = 1e-9;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const point = (x = 0, y = 0) => ({ x, y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const length = a => Math.hypot(a.x, a.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = a => mul(a, 1 / (length(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const almost = (a, b, tolerance = EPS) => Math.abs(a - b) <= tolerance;
const equalPoint = (a, b, tolerance = EPS) => distance(a, b) <= tolerance;
const identity = () => [1, 0, 0, 1, 0, 0];
const transform = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
function matrix({ x = 0, y = 0, rotation = 0, sx = 1, sy = sx } = {}) { const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * sx, s * sx, -s * sy, c * sy, x, y]; }
function compose(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
function inverse(m) {
    const d = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(d) < EPS)
        throw new Error('Singular transform');
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
function bounds(points) {
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
            continue;
        b.minX = Math.min(b.minX, p.x);
        b.minY = Math.min(b.minY, p.y);
        b.maxX = Math.max(b.maxX, p.x);
        b.maxY = Math.max(b.maxY, p.y);
    }
    return b;
}
const emptyBounds = () => bounds([]);
const validBounds = b => Number.isFinite(b.minX) && b.minX <= b.maxX && b.minY <= b.maxY;
const inflate = (b, n) => ({ minX: b.minX - n, minY: b.minY - n, maxX: b.maxX + n, maxY: b.maxY + n });
const intersects = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
const contains = (b, p) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
const union = (a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) });
const center = b => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
function projectPoint(p, a, b, segment = true) { const v = sub(b, a), n = dot(v, v); const t = n < EPS * EPS ? 0 : dot(sub(p, a), v) / n; return lerp(a, b, segment ? clamp(t, 0, 1) : t); }
const distanceToSegment = (p, a, b) => distance(p, projectPoint(p, a, b));
function lineIntersection(a, b, c, d, segments = true) {
    const r = sub(b, a), s = sub(d, c), det = cross(r, s);
    if (Math.abs(det) <= EPS * Math.max(1, length(r) * length(s)))
        return null;
    const q = sub(c, a), t = cross(q, s) / det, u = cross(q, r) / det;
    if (segments && (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS))
        return null;
    return { ...lerp(a, b, t), t, u };
}
function segmentIntersectsBox(a, b, box) {
    if (contains(box, a) || contains(box, b))
        return true;
    const p = [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }];
    return p.some((v, i) => lineIntersection(a, b, v, p[(i + 1) % 4]));
}
function polygonContains(p, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if (distanceToSegment(p, a, b) < EPS)
            return true;
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
            inside = !inside;
    }
    return inside;
}
function polygonArea(points) {
    let n = 0;
    for (let i = 0; i < points.length; i++)
        n += cross(points[i], points[(i + 1) % points.length]);
    return n / 2;
}
function polylineLength(points, closed = false) {
    let n = 0;
    for (let i = 1; i < points.length; i++)
        n += distance(points[i - 1], points[i]);
    if (closed && points.length > 1)
        n += distance(points.at(-1), points[0]);
    return n;
}
function simplifyOrthogonal(points) {
    const r = [];
    for (const p of points) {
        if (r.length && equalPoint(r.at(-1), p))
            continue;
        if (r.length > 1) {
            const a = r.at(-2), b = r.at(-1);
            if (Math.abs(cross(sub(b, a), sub(p, b))) < EPS && dot(sub(b, a), sub(p, b)) >= 0)
                r.pop();
        }
        r.push({ ...p });
    }
    return r;
}
function arcPoints(c, r, start = 0, end = TAU, tolerance = .2, clockwise = false) {
    if (!Number.isFinite(r) || r <= 0)
        return [c];
    let sweep = end - start;
    if (clockwise) {
        while (sweep > 0)
            sweep -= TAU;
    }
    else {
        while (sweep < 0)
            sweep += TAU;
    }
    if (Math.abs(sweep) < EPS)
        sweep = clockwise ? -TAU : TAU;
    const step = 2 * Math.acos(clamp(1 - Math.max(tolerance, 1e-7) / r, -1, 1));
    const n = clamp(Math.ceil(Math.abs(sweep) / Math.max(step, .0005)), 2, 8192);
    return Array.from({ length: n + 1 }, (_, i) => ({ x: c.x + r * Math.cos(start + sweep * i / n), y: c.y + r * Math.sin(start + sweep * i / n) }));
}
function bulgeArc(a, b, bulge) {
    if (Math.abs(bulge) < EPS || distance(a, b) < EPS)
        return null;
    const chord = sub(b, a), mid = lerp(a, b, .5), c = add(mid, mul({ x: -chord.y, y: chord.x }, (1 - bulge * bulge) / (4 * bulge)));
    return { c, r: distance(a, c), start: Math.atan2(a.y - c.y, a.x - c.x), sweep: 4 * Math.atan(bulge), clockwise: bulge < 0 };
}
function tessellatePolyline(points, closed = false, tolerance = .2) {
    if (!points.length)
        return [];
    const out = [];
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
        const a = points[i], b = points[(i + 1) % points.length], arc = bulgeArc(a, b, a.bulge || 0);
        if (arc)
            out.push(...arcPoints(arc.c, arc.r, arc.start, arc.start + arc.sweep, tolerance, arc.clockwise).slice(0, -1));
        else
            out.push(a);
    }
    out.push(closed ? points[0] : points.at(-1));
    return out;
}
/** Rational de Boor evaluation; input is never mutated. */
function nurbsPoint(control, degree, knots, t, weights = []) {
    const n = control.length - 1, p = Math.min(degree, n);
    if (n < 0)
        return point();
    if (p < 1)
        return { ...control[0] };
    if (knots.length < n + p + 2)
        throw new Error('Invalid NURBS knot vector');
    const lo = knots[p], hi = knots[n + 1];
    t = clamp(t, lo, hi);
    let k = n;
    if (t < hi) {
        k = p;
        while (k < n && !(t >= knots[k] && t < knots[k + 1]))
            k++;
    }
    const d = [];
    for (let j = 0; j <= p; j++) {
        const i = k - p + j, w = weights[i] ?? 1;
        d.push([control[i].x * w, control[i].y * w, w]);
    }
    for (let r = 1; r <= p; r++)
        for (let j = p; j >= r; j--) {
            const i = k - p + j, den = knots[i + p - r + 1] - knots[i], a = Math.abs(den) < EPS ? 0 : (t - knots[i]) / den;
            d[j] = d[j].map((v, q) => (1 - a) * d[j - 1][q] + a * v);
        }
    const w = d[p][2];
    return Math.abs(w) > EPS ? { x: d[p][0] / w, y: d[p][1] / w } : { ...control[Math.min(n, k)] };
}
function splinePoints(e, tolerance = .2) {
    const cp = e.controlPoints || [];
    if (cp.length < 2)
        return cp;
    const p = Math.min(e.degree || 3, cp.length - 1), n = cp.length;
    let knots = e.knots;
    if (!knots || knots.length < n + p + 1) {
        knots = [];
        for (let i = 0; i < n + p + 1; i++)
            knots.push(i <= p ? 0 : i >= n ? 1 : (i - p) / (n - p));
    }
    const start = knots[p], end = knots[n], out = [nurbsPoint(cp, p, knots, start, e.weights)];
    function split(t0, a, t1, b, depth) {
        const tm = (t0 + t1) / 2, m = nurbsPoint(cp, p, knots, tm, e.weights), q1 = nurbsPoint(cp, p, knots, (t0 + tm) / 2, e.weights), q3 = nurbsPoint(cp, p, knots, (tm + t1) / 2, e.weights);
        if (depth < 12 && Math.max(distanceToSegment(m, a, b), distanceToSegment(q1, a, b), distanceToSegment(q3, a, b)) > tolerance) {
            split(t0, a, tm, m, depth + 1);
            split(tm, m, t1, b, depth + 1);
        }
        else
            out.push(b);
    }
    for (let i = p; i < n; i++) {
        if (knots[i + 1] > knots[i])
            split(knots[i], out.at(-1), knots[i + 1], nurbsPoint(cp, p, knots, knots[i + 1], e.weights), 0);
    }
    return out;
}
/** Planar polyline offset with bounded miters; not a polygon Boolean engine. */
function offsetPolyline(points, amount, closed = false, miterLimit = 6) {
    if (points.length < 2)
        throw new Error('Offset requires two vertices');
    const seg = [];
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
        const a = points[i], b = points[(i + 1) % points.length], v = normalize(sub(b, a)), o = mul({ x: -v.y, y: v.x }, amount);
        seg.push([add(a, o), add(b, o)]);
    }
    const out = [];
    for (let i = 0; i < points.length; i++) {
        if (!closed && i === 0) {
            out.push(seg[0][0]);
            continue;
        }
        if (!closed && i === points.length - 1) {
            out.push(seg.at(-1)[1]);
            continue;
        }
        const prev = seg[(i - 1 + seg.length) % seg.length], next = seg[i % seg.length], hit = lineIntersection(...prev, ...next, false);
        if (hit && distance(hit, points[i]) <= Math.abs(amount) * miterLimit + EPS)
            out.push({ x: hit.x, y: hit.y });
        else
            out.push(prev[1], next[0]);
    }
    return out;
}
function filletLines(a, b, c, d, radius) {
    const hit = lineIntersection(a, b, c, d, false);
    if (!hit || radius <= 0)
        throw new Error('Fillet needs intersecting nonparallel lines and positive radius');
    const u = normalize(sub(distance(a, hit) > distance(b, hit) ? a : b, hit)), v = normalize(sub(distance(c, hit) > distance(d, hit) ? c : d, hit)), theta = Math.acos(clamp(dot(u, v), -1, 1));
    if (theta < EPS || Math.abs(theta - Math.PI) < EPS)
        throw new Error('Degenerate fillet');
    const t = radius / Math.tan(theta / 2), p = add(hit, mul(u, t)), q = add(hit, mul(v, t)), cen = add(hit, mul(normalize(add(u, v)), radius / Math.sin(theta / 2)));
    return { p, q, c: cen, r: radius, start: Math.atan2(p.y - cen.y, p.x - cen.x), end: Math.atan2(q.y - cen.y, q.x - cen.x), clockwise: cross(sub(p, cen), sub(q, cen)) < 0 };
}
function snapCandidates(entity) {
    switch (entity.type) {
        case 'LINE': return [{ ...entity.a, kind: 'endpoint' }, { ...entity.b, kind: 'endpoint' }, { ...lerp(entity.a, entity.b, .5), kind: 'midpoint' }];
        case 'CIRCLE':
        case 'ARC': {
            const onArc = a => {
                if (entity.type === 'CIRCLE')
                    return true;
                const norm = x => ((x % TAU) + TAU) % TAU;
                return entity.clockwise ? norm(entity.start - a) <= norm(entity.start - entity.end) + EPS : norm(a - entity.start) <= norm(entity.end - entity.start) + EPS;
            };
            const at = a => ({ x: entity.c.x + entity.r * Math.cos(a), y: entity.c.y + entity.r * Math.sin(a) });
            return [{ ...entity.c, kind: 'center' }, ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].filter(onArc).map(a => ({ ...at(a), kind: 'quadrant' })), ...(entity.type === 'ARC' ? [{ ...at(entity.start), kind: 'endpoint' }, { ...at(entity.end), kind: 'endpoint' }] : [])];
        }
        case 'LWPOLYLINE': return entity.points.flatMap((p, i) => [{ ...p, kind: 'endpoint' }, ...(i < entity.points.length - 1 || entity.closed ? [{ ...lerp(p, entity.points[(i + 1) % entity.points.length], .5), kind: 'midpoint' }] : [])]);
        case 'INSERT': return [{ x: entity.x, y: entity.y, kind: 'insertion' }];
        default: return [];
    }
}

return {EPS,TAU,clamp,point,add,sub,mul,dot,cross,length,distance,normalize,lerp,almost,equalPoint,identity,transform,matrix,compose,inverse,bounds,emptyBounds,validBounds,inflate,intersects,contains,union,center,projectPoint,distanceToSegment,lineIntersection,segmentIntersectsBox,polygonContains,polygonArea,polylineLength,simplifyOrthogonal,arcPoints,bulgeArc,tessellatePolyline,nurbsPoint,splinePoints,offsetPolyline,filletLines,snapCandidates};
})();
// packages/model/src/fidelity.js
__modules["packages/model/src/fidelity.js"]=(()=>{
const {arcPoints, tessellatePolyline, splinePoints, bounds, distance, TAU} = __modules["packages/geometry/src/index.js"];
const EPS = 1e-9;
/** XY projection of Autodesk's arbitrary-axis OCS basis. */
function ocsTransform(normal = { x: 0, y: 0, z: 1 }, elevation = 0) {
    const length = Math.hypot(normal.x || 0, normal.y || 0, normal.z ?? 1);
    if (length < EPS) throw new Error('Invalid zero-length DXF extrusion normal');
    const n = { x: (normal.x || 0) / length, y: (normal.y || 0) / length, z: (normal.z ?? 1) / length };
    const a = Math.abs(n.x) < 1 / 64 && Math.abs(n.y) < 1 / 64 ? { x: n.z, y: 0, z: -n.x } : { x: -n.y, y: n.x, z: 0 };
    const l = Math.hypot(a.x, a.y, a.z); a.x /= l; a.y /= l; a.z /= l;
    const b = { x: n.y * a.z - n.z * a.y, y: n.z * a.x - n.x * a.z };
    return [a.x, a.y, b.x, b.y, n.x * elevation, n.y * elevation];
}
function ellipseEdgePoints(edge, tolerance = .25) {
    const a = edge.major, ratio = edge.ratio ?? 1;
    let start = edge.start ?? 0, end = edge.end ?? TAU;
    // Hatch ellipse group 50/51 use geometric angles, unlike ELLIPSE parameters.
    if (edge.type === 3) {
        const convert = v => Math.atan2(Math.sin(v) / Math.max(Math.abs(ratio), EPS), Math.cos(v));
        start = convert(start); end = convert(end);
    }
    let sweep = end - start;
    if (edge.ccw === false) { while (sweep >= 0) sweep -= TAU; }
    else { while (sweep <= 0) sweep += TAU; }
    const n = Math.min(8192, Math.max(8, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(tolerance, 1e-8)))));
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = start + sweep * i / n;
        return { x: edge.c.x + a.x * Math.cos(t) - a.y * ratio * Math.sin(t), y: edge.c.y + a.y * Math.cos(t) + a.x * ratio * Math.sin(t) };
    });
}
function hatchContours(e, tolerance = .25) {
    return (e.loops || []).map(loop => {
        if (!loop.edges?.length) return tessellatePolyline(loop.points || [], true, tolerance);
        const result = [];
        for (const edge of loop.edges) {
            let points = [];
            if (edge.type === 1) points = [edge.a, edge.b];
            if (edge.type === 2) points = arcPoints(edge.c, edge.r, edge.start, edge.end, tolerance, edge.ccw === false);
            if (edge.type === 3) points = ellipseEdgePoints(edge, tolerance);
            if (edge.type === 4) points = splinePoints(edge, tolerance);
            if (result.length && points.length && distance(result.at(-1), points[0]) < EPS) points = points.slice(1);
            result.push(...points);
        }
        return result;
    }).filter(p => p.length >= 3);
}
function inPolygon(p, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
function hatchRegionContours(e, tolerance) {
    const contours = hatchContours(e, tolerance);
    if (!e.hatchStyle) return contours;
    return contours.filter((p, i) => {
        const depth = contours.reduce((n, q, j) => n + (i !== j && inPolygon(p[0], q) ? 1 : 0), 0);
        return e.hatchStyle === 2 ? depth === 0 : depth <= 1;
    });
}
/** Scanline hatch clipping with half-open crossings and parity across islands.
 * Definitions are already transformed by the DXF producer: do not apply scale twice.
 */
function hatchPatternSegments(e, contours, { maxLines = 20000, maxSegments = 100000 } = {}) {
    const segments = [], vertices = contours.flat(), bb = bounds(vertices);
    if (!vertices.length) return { segments, limited: false };
    let lines = 0;
    for (const definition of e.patternLines || []) {
        const u = { x: Math.cos(definition.angle), y: Math.sin(definition.angle) }, n = { x: -u.y, y: u.x }, base = definition.base, offset = definition.offset;
        const step = offset.x * n.x + offset.y * n.y, origin = base.x * n.x + base.y * n.y;
        if (Math.abs(step) < EPS) continue;
        const corners = [{ x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.minY }, { x: bb.minX, y: bb.maxY }, { x: bb.maxX, y: bb.maxY }];
        const projections = corners.map(p => (p.x * n.x + p.y * n.y - origin) / step);
        const first = Math.ceil(Math.min(...projections) - EPS), last = Math.floor(Math.max(...projections) + EPS);
        if (!Number.isSafeInteger(first) || last - first + lines > maxLines) return { segments: [], limited: true };
        for (let k = first; k <= last; k++) {
            lines++;
            const b = { x: base.x + k * offset.x, y: base.y + k * offset.y }, hits = [];
            for (const polygon of contours) for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i], z = polygon[(i + 1) % polygon.length];
                const da = (a.x - b.x) * n.x + (a.y - b.y) * n.y, dz = (z.x - b.x) * n.x + (z.y - b.y) * n.y;
                if ((da > 0) === (dz > 0)) continue;
                const t = da / (da - dz), x = a.x + (z.x - a.x) * t - b.x, y = a.y + (z.y - a.y) * t - b.y;
                hits.push(x * u.x + y * u.y);
            }
            hits.sort((a, b) => a - b);
            for (let i = 0; i + 1 < hits.length; i += 2) {
                const lo = hits[i], hi = hits[i + 1];
                if (hi - lo <= EPS) continue;
                const emit = (a, z) => segments.push([{ x: b.x + a * u.x, y: b.y + a * u.y }, { x: b.x + z * u.x, y: b.y + z * u.y }]);
                const dashes = definition.dashes || [], cycle = dashes.reduce((a, d) => a + Math.abs(d), 0);
                if (cycle < EPS) emit(lo, hi);
                else {
                    if ((hi - lo) / cycle * dashes.length > maxSegments) return { segments: [], limited: true };
                    for (let c = Math.floor(lo / cycle) * cycle; c < hi; c += cycle) {
                        let p = c;
                        for (const dash of dashes) {
                            if (dash >= 0 && p + dash >= lo && p <= hi) emit(Math.max(lo, p), Math.min(hi, p + Math.max(dash, EPS)));
                            p += Math.abs(dash);
                        }
                        if (segments.length > maxSegments) return { segments: [], limited: true };
                    }
                }
                if (segments.length > maxSegments) return { segments: [], limited: true };
            }
        }
    }
    return { segments, limited: false };
}
/** Variable width arc/polyline ribbons, retaining original analytic model data. */
function widePolylineContours(e, tolerance = .25) {
    const result = [], points = e.points || [], n = points.length - (e.closed ? 0 : 1);
    for (let i = 0; i < n; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const w0 = e.constantWidth || (a.startWidth ?? e.startWidth ?? 0), w1 = e.constantWidth || (a.endWidth ?? e.endWidth ?? w0);
        if (!(w0 > 0 || w1 > 0)) continue;
        const center = tessellatePolyline([a, b], false, tolerance), left = [], right = [];
        for (let j = 0; j < center.length; j++) {
            const prev = center[Math.max(0, j - 1)], next = center[Math.min(center.length - 1, j + 1)], len = Math.hypot(next.x - prev.x, next.y - prev.y);
            if (len < EPS) continue;
            const w = (w0 + (w1 - w0) * j / (center.length - 1)) / 2, nx = -(next.y - prev.y) / len * w, ny = (next.x - prev.x) / len * w;
            left.push({ x: center[j].x + nx, y: center[j].y + ny }); right.push({ x: center[j].x - nx, y: center[j].y - ny });
        }
        if (left.length >= 2) result.push([...left, ...right.reverse()]);
    }
    return result;
}
function signedDashPattern(pattern = []) {
    if (!pattern.length) return [];
    const result = []; let ink = true;
    for (const value of pattern) {
        const nextInk = value >= 0, size = Math.abs(value);
        if (nextInk !== ink) { if (!result.length) result.push(0); ink = nextInk; result.push(size); }
        else if (!result.length) result.push(size); else result[result.length - 1] += size;
    }
    if (result.length % 2) result.push(0);
    return result;
}
const plainText = s => String(s).replace(/\\U\+([\da-f]{4})/gi, (_, v) => String.fromCharCode(parseInt(v, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀');
/** Bounded, no-eval MTEXT formatting lexer with group-local formatting state. */
function cadTextRuns(value, initial = {}) {
    const source = plainText(value), result = [], stack = [];
    let style = { scale: 1, width: 1, underline: false, overline: false, ...initial }, text = '';
    const flush = () => { if (text) result.push({ text, ...style }); text = ''; };
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (ch === '{') { flush(); if (stack.length < 64) stack.push({ ...style }); continue; }
        if (ch === '}') { flush(); style = stack.pop() || style; continue; }
        if (ch !== '\\') { text += ch; continue; }
        const command = source[++i];
        if (command === undefined) break;
        if (['\\', '{', '}'].includes(command)) { text += command; continue; }
        if (command === 'P' || command === 'X') { text += '\n'; continue; }
        if (command === '~') { text += '\u00a0'; continue; }
        if ('LlOoKk'.includes(command)) { flush(); const key = /[Ll]/.test(command) ? 'underline' : /[Oo]/.test(command) ? 'overline' : 'strike'; style[key] = command === command.toUpperCase(); continue; }
        if ('ACcFfHhQqTtWwSs'.includes(command)) {
            const end = source.indexOf(';', i + 1); if (end < 0) { text += '\\' + command; continue; }
            const arg = source.slice(i + 1, end); i = end; flush(); const num = parseFloat(arg);
            if (/[Hh]/.test(command) && num > 0 && Number.isFinite(num)) style.scale = /x$/i.test(arg) ? num : num / (initial.height || 1);
            else if (/[Ww]/.test(command) && num > 0 && Number.isFinite(num)) style.width = num;
            else if (/[Qq]/.test(command) && Number.isFinite(num)) style.oblique = Math.max(-85, Math.min(85, num));
            else if (/[Ff]/.test(command)) { style.font = arg.split('|')[0]; style.bold = /\|b1/i.test(arg); style.italic = /\|i1/i.test(arg); }
            else if (command === 'c' && Number.isFinite(num)) style.color = '#' + (num & 0xffffff).toString(16).padStart(6, '0');
            else if (command === 'C' && num >= 1 && num <= 7) style.color = ['','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#000000'][num];
            else if (/[Ss]/.test(command)) result.push({ text: arg.replace(/[\/#^]/g, '/'), ...style, scale: style.scale * .8 });
            continue;
        }
        text += '\\' + command;
    }
    flush(); return result;
}
/** Deterministic text layout; canvas may supply measured glyph advances. */
function layoutCadText(t, measure) {
    const h = t.nominalHeight || t.height || 12, multiline = !!t.mtext;
    const runs = multiline ? cadTextRuns(t.rawText ?? t.text, { height: h }) : [{ text: plainText(t.text), scale: 1, width: 1 }];
    const width = multiline && t.mtextWidth > 0 ? t.mtextWidth : Infinity;
    const lines = [{ runs: [], width: 0, height: h }];
    let line = lines[0];
    const add = (text, style) => {
        if (!text) return;
        const height = h * style.scale, w = (measure ? measure(text, height, style) : [...text].reduce((n, c) => n + (/\s/.test(c) ? .33 : /[ilI.,'!:;]/.test(c) ? .28 : /[MW@%]/.test(c) ? .9 : .6), 0) * height) * style.width;
        if (w > width && Number.isFinite(width) && [...text].length > 1) {
            for (const ch of text) add(ch, style);
            return;
        }
        if (line.width > 0 && line.width + w > width && !/^\s+$/.test(text)) { line = { runs: [], width: 0, height: h }; lines.push(line); }
        line.runs.push({ ...style, text, x: line.width, width: w, height }); line.width += w; line.height = Math.max(line.height, height);
    };
    for (const run of runs) for (const token of run.text.split(/(\n|[ \t]+)/)) {
        if (token === '\n') { line = { runs: [], width: 0, height: h }; lines.push(line); }
        else add(token, run);
    }
    const lineFactor = multiline ? (5 / 3) * Math.max(.25, Math.min(4, t.lineSpacing || 1)) : 1.3;
    let y = 0;
    for (const line of lines) { line.y = y; y += (t.lineSpacingStyle === 2 ? h : line.height) * lineFactor; }
    const height = lines.at(-1).y + lines.at(-1).height, w = lines.reduce((n, l) => Math.max(n, l.width), 0);
    const vertical = multiline ? Math.floor(((t.attachment || 1) - 1) / 3) : t.valign === 3 ? 0 : t.valign === 2 ? 1 : t.valign === 1 ? 2 : -1;
    const baseline = vertical === 0 ? h * .8 : vertical === 1 ? h * .8 - height / 2 : vertical === 2 ? h * .8 - height : 0;
    const boxWidth = Number.isFinite(width) ? width : w;
    const align = t.align || 'left', offsetX = align === 'center' ? -boxWidth / 2 : align === 'right' ? -boxWidth : 0;
    for (const line of lines) {
        const start = offsetX + (align === 'center' ? (boxWidth - line.width) / 2 : align === 'right' ? boxWidth - line.width : 0);
        for (const r of line.runs) { r.x += start; r.y = baseline + line.y; }
    }
    return { lines, width: boxWidth, height, minX: offsetX, minY: baseline - h * .8, maxX: offsetX + boxWidth, maxY: baseline + height - h * .8 };
}

return {ocsTransform,ellipseEdgePoints,hatchContours,inPolygon,hatchRegionContours,hatchPatternSegments,widePolylineContours,signedDashPattern,cadTextRuns,layoutCadText};
})();
// packages/model/src/index.js
__modules["packages/model/src/index.js"]=(()=>{
const {ocsTransform, hatchRegionContours, hatchPatternSegments, widePolylineContours, signedDashPattern, layoutCadText} = __modules["packages/model/src/fidelity.js"];
const {matrix, compose, identity, transform, bounds, union, emptyBounds, arcPoints, tessellatePolyline, splinePoints, TAU, distance, lerp, add, mul, normalize, sub, validBounds} = __modules["packages/geometry/src/index.js"];
function textLayout(text, measure) { return layoutCadText(text, measure); }
function objectCoordinateTransform(normal, elevation) { return ocsTransform(normal, elevation); }
let sequence = 0;
const uid = (prefix = 'e') => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const clone = value => JSON.parse(JSON.stringify(value));
function createDocument(name = 'Untitled drawing') { return { schema: 'conduitcad/1', name, units: 'mm', version: 0, entities: [], blocks: {}, layers: [{ name: '0', color: '#344755', visible: true, locked: false }, { name: 'Equipment', color: '#355463', visible: true, locked: false }, { name: 'Process', color: '#147c77', visible: true, locked: false }, { name: 'Instruments', color: '#9b7246', visible: true, locked: false, dash: [5, 4] }, { name: 'Electrical', color: '#6477ba', visible: true, locked: false }, { name: 'Annotations', color: '#71808a', visible: true, locked: false }], linetypes: { CONTINUOUS: [], DASHED: [8, 4], CENTER: [12, 3, 2, 3], HIDDEN: [4, 3] }, parameters: { grid: '10', pipeWidth: '2', valveSize: '64' }, constraints: [], metadata: { author: '', description: '' }, activeLayout: 'Model', layouts: ['Model'], importDiagnostics: [] }; }
function validateDocument(doc) {
    if (!doc || doc.schema !== 'conduitcad/1' || !Array.isArray(doc.entities) || !doc.blocks || !Array.isArray(doc.layers))
        throw new Error('Not a Conduit CAD project');
    if (doc.entities.length > 1000000)
        throw new Error('Entity safety limit exceeded');
    const ids = new Set();
    for (const e of doc.entities) {
        if (!e.id || ids.has(e.id))
            throw new Error('Missing or duplicate entity ID');
        ids.add(e.id);
        if (!e.type)
            throw new Error('Missing entity type');
    }
    return doc;
}
function entity(type, props = {}) { return { id: uid(), type, layer: '0', ...props }; }
const line = (a, b, props = {}) => entity('LINE', { a: { ...a }, b: { ...b }, ...props });
const polyline = (points, closed = false, props = {}) => entity('LWPOLYLINE', { points: points.map(p => ({ ...p })), closed, ...props });
const circle = (c, r, props = {}) => entity('CIRCLE', { c: { ...c }, r, ...props });
const text = (p, value, height = 14, props = {}) => entity('TEXT', { p: { ...p }, text: value, height, rotation: 0, ...props });
const rect = (x, y, w, h, props = {}) => polyline([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, props);
function layerFor(e, doc) { return doc.layers.find(l => l.name === (e.layer || '0')) || doc.layers[0]; }
function isVisible(e, doc) { return !e.hidden && layerFor(e, doc)?.visible !== false && (e.layout || 'Model') === (doc.activeLayout || 'Model'); }
function isLocked(e, doc) { return !!e.locked || !!layerFor(e, doc)?.locked; }
function cleanText(value = '') { return String(value).replace(/\\P/g, '\n').replace(/\\U\+([0-9a-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀').replace(/\\[ACFHQTW][^;]*;/g, '').replace(/\\[LlOoKk]/g, '').replace(/\\S([^;]+);/g, (_, s) => s.replace(/[\/#^]/g, '/')).replace(/[{}]/g, '').replace(/\\~/g, ' '); }
function resolveStyle(e, doc, parentStyle = null, parentLayer = null) {
    const layer = (e.layer === '0' && parentLayer) ? parentLayer : layerFor(e, doc);
    const lineweight = e.lineweight === -2 ? parentStyle?.lineweight : e.lineweight == null || e.lineweight === -1 ? layer?.lineweight : e.lineweight;
    const type = e.linetype === 'BYBLOCK' ? null : (!e.linetype || e.linetype === 'BYLAYER' ? layer?.linetype : e.linetype);
    const raw = doc.linetypes?.[type];
    const dash = e.dash ?? (e.linetype === 'BYBLOCK' ? parentStyle?.dash : null) ?? (raw ? (doc.signedLinetypes ? signedDashPattern(raw) : raw) : null) ?? layer?.dash ?? [];
    const factor = (e.linetypeScale ?? 1) * (e.dash || e.linetype === 'BYBLOCK' ? 1 : doc.linetypeScale ?? 1);
    return { color: e.color === 'BYBLOCK' ? parentStyle?.color || layer?.color || '#344755' : (!e.color || e.color === 'BYLAYER' ? layer?.color || '#344755' : e.color),
        width: e.width ?? (lineweight >= 0 ? Math.max(.5, lineweight * 96 / 2540) : 1.5), lineweight,
        dash: dash.map(v => Math.max(0, v * factor)), opacity: e.transparency === 0x01000000 ? parentStyle?.opacity ?? 1 : e.opacity ?? 1 };
}
/** Returns portable paths/text. Blocks retain their native definitions in the model. */
function entityGeometry(e, doc, options = {}) {
    const { tolerance = .25, depth = 0, parentStyle = null, parentLayer = null } = options;
    let m = options.matrix || identity();
    if (e.extrusion && ['CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'TEXT', 'ATTRIB', 'ATTDEF', 'SOLID', 'TRACE', 'HATCH', 'INSERT'].includes(e.type) && !(e.type === 'POLYLINE' && (e.flags & (8|16|64))))
        m = compose(m, ocsTransform(e.extrusion, e.elevation ?? e.c?.z ?? e.p?.z ?? e.z ?? 0));
    if (depth > 24)
        return { paths: [], texts: [] };
    const curveTolerance = tolerance / Math.max(1e-9, Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
    const style = resolveStyle(e, doc, parentStyle, parentLayer), paths = [], texts = [], warnings = [];
    const path = (pts, closed = false, fill = null, extra = {}) => {
        if (pts.length > 1)
            paths.push({ points: pts.map(p => transform(p, m)), closed, fill: fill === 'BYBLOCK' || fill === 'BYLAYER' ? style.color : fill, ...style, ...extra, entityId: e.id });
    };
    const label = (p, value, height, rotation = 0, align = 'left') => {
        const textStyle = doc.textStyles?.[e.styleName] || {}, q = transform(p, m), angle = rotation * Math.PI / 180;
        const sx = (e.textFlags & 2) ? -1 : 1, sy = (e.textFlags & 4) ? -1 : 1;
        const width = e.widthFactor ?? textStyle.widthFactor ?? 1, oblique = (e.oblique || textStyle.oblique || 0) * Math.PI / 180;
        const local = compose(matrix({ rotation }), [sx * width, 0, Math.tan(oblique) * sy, sy, 0, 0]);
        const affine = compose(m, local), frame = affine.slice(0, 4);
        texts.push({ p: q, text: cleanText(value), rawText: value, height: height * Math.hypot(frame[2], frame[3]), nominalHeight: height,
            rotation: Math.atan2(frame[1], frame[0]) * 180 / Math.PI, align, color: style.color, opacity: style.opacity, entityId: e.id,
            font: e.font || textStyle.font || 'sans-serif', frame, widthFactor: width,
            mtext: e.type === 'MTEXT', mtextWidth: e.mtextWidth, attachment: e.attachment, valign: e.valign,
            lineSpacing: e.lineSpacing, lineSpacingStyle: e.lineSpacingStyle, backgroundFill: e.backgroundFill, backgroundColor: e.backgroundColor, backgroundScale: e.backgroundScale });
    };
    switch (e.type) {
        case 'LINE':
            path([e.a, e.b]);
            break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
            if(e.type==='POLYLINE' && (e.flags & 64)) {
                for(const face of e.faces || []) for(let i=0;i<face.length;i++) { const a=e.points[Math.abs(face[i])-1], b=e.points[Math.abs(face[(i+1)%face.length])-1]; if(face[i]>0&&a&&b)path([a,b]); }
                break;
            }
            if(e.type==='POLYLINE' && (e.flags & 16)) {
                const mCount=e.mCount || 0,nCount=e.nCount || 0;
                if(mCount*nCount===e.points.length)for(let m=0;m<mCount;m++)for(let n=0;n<nCount;n++) {
                    const a=e.points[m*nCount+n];
                    if(m+1<mCount || (e.flags&1))path([a,e.points[((m+1)%mCount)*nCount+n]]);
                    if(n+1<nCount || (e.flags&32))path([a,e.points[m*nCount+(n+1)%nCount]]);
                }
                break;
            }
            { const ribbons = widePolylineContours(e, curveTolerance);
              if (ribbons.length) { for (const ribbon of ribbons) path(ribbon, true, style.color, { stroke: false }); }
              else path(tessellatePolyline(e.points || [], !!e.closed, curveTolerance), !!e.closed, e.fill); }
            break;
        case 'CIRCLE':
            path(arcPoints(e.c, e.r, 0, TAU, curveTolerance), true, e.fill);
            break;
        case 'ARC':
            path(arcPoints(e.c, e.r, e.start, e.end, curveTolerance, !!e.clockwise));
            break;
        case 'ELLIPSE': {
            const a = e.major || { x: e.rx || 1, y: 0 }, r = e.ratio ?? 1, s = e.start ?? 0;
            const normal=e.extrusion || {x:0,y:0,z:1}, minor={x:(normal.y || 0)*(a.z || 0)-(normal.z ?? 1)*a.y,y:(normal.z ?? 1)*a.x-(normal.x || 0)*(a.z || 0),z:(normal.x || 0)*a.y-(normal.y || 0)*a.x};
            const factor=Math.hypot(a.x,a.y,a.z || 0)*r/(Math.hypot(minor.x,minor.y,minor.z) || 1); minor.x*=factor;minor.y*=factor;
            let sweep = (e.end ?? TAU) - s;
            while (sweep <= 0)
                sweep += TAU;
            const n = Math.min(4096, Math.max(24, Math.ceil(sweep * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(curveTolerance, .0000001)))));
            path(Array.from({ length: n + 1 }, (_, i) => { const t = s + sweep * i / n; return { x: e.c.x + a.x * Math.cos(t) + minor.x * Math.sin(t), y: e.c.y + a.y * Math.cos(t) + minor.y * Math.sin(t) }; }), Math.abs(sweep - TAU) < 1e-6);
            break;
        }
        case 'SPLINE':
            path(splinePoints(e, curveTolerance), !!e.closed);
            break;
        case 'TEXT':
        case 'MTEXT':
        case 'ATTRIB':
        case 'ATTDEF':
            if (!e.invisible) {
                let p = ((e.halign || e.valign) && e.alignPoint) ? e.alignPoint : e.p, height = e.height || doc.textStyles?.[e.styleName]?.height || 12, rotation = e.rotation || 0;
                let value = e.text || '', alignment = e.halign === 4 ? 'center' : e.align || 'left';
                if ([3, 5].includes(e.halign) && e.alignPoint) {
                    const target = distance(e.p, e.alignPoint), measured = layoutCadText({ text: cleanText(value), height }).width || 1;
                    rotation = Math.atan2(e.alignPoint.y - e.p.y, e.alignPoint.x - e.p.x) * 180 / Math.PI;
                    p = e.p; alignment = 'left';
                    label(p, value, height, rotation, alignment);
                    const t = texts.at(-1), factor = target / measured; t.frame[0] *= factor; t.frame[1] *= factor;
                    if (e.halign === 3) { t.frame[2] *= factor; t.frame[3] *= factor; t.height *= factor; }
                } else label(p, value, height, rotation, alignment);
            }
            break;
        case 'POINT': {
            const r = 1.5;
            path([{ x: e.p.x - r, y: e.p.y }, { x: e.p.x + r, y: e.p.y }]);
            path([{ x: e.p.x, y: e.p.y - r }, { x: e.p.x, y: e.p.y + r }]);
            break;
        }
        case 'SOLID':
        case 'TRACE':
            path(e.points || [], true, style.color, { stroke: false });
            break;
        case '3DFACE':
            for (let i = 0; i < (e.points?.length || 0); i++) if (!(e.edgeFlags & (1 << i))) path([e.points[i], e.points[(i + 1) % e.points.length]]);
            break;
        case 'HATCH': {
            const contours = hatchRegionContours(e, curveTolerance);
            if (e.solid || e.gradient) {
                if (contours.length) path(contours[0], true, style.color, { stroke: false, contours: contours.map(p => p.map(v => transform(v, m))), fillRule: 'evenodd' });
            } else {
                const pattern = hatchPatternSegments(e, contours);
                if (pattern.limited || !e.patternLines?.length) {
                    for (const contour of contours) path(contour, true);
                    warnings.push({ entityId: e.id, message: pattern.limited ? 'Hatch density exceeds bounded tessellation budget; showing boundaries.' : 'Hatch has no pattern line definitions; showing boundaries.' });
                } else for (const points of pattern.segments) path(points, false, null, { dash: [] });
            }
            break;
        }
        case 'LEADER': {
            path(e.points || []);
            if (e.arrow !== false && e.points?.length > 1) {
                const tip = e.points[0], d = normalize(sub(e.points[1], tip)), n = { x: -d.y, y: d.x }, length = e.arrowSize || 6;
                path([tip, add(tip, add(mul(d, length), mul(n, length / 3))), add(tip, add(mul(d, length), mul(n, -length / 3)))], true, style.color, { stroke: false });
            }
            break;
        }
        case 'RAY':
        case 'XLINE': {
            const p = transform(e.p, m), q = transform(add(e.p, e.direction), m), d = sub(q, p), v = options.view || { minX: p.x - 10000, maxX: p.x + 10000, minY: p.y - 10000, maxY: p.y + 10000 };
            let lo = e.type === 'RAY' ? 0 : -Infinity, hi = Infinity;
            for (const axis of ['x', 'y']) {
                const min = v[axis === 'x' ? 'minX' : 'minY'], max = v[axis === 'x' ? 'maxX' : 'maxY'];
                if (Math.abs(d[axis]) < 1e-12) { if (p[axis] < min || p[axis] > max) hi = -Infinity; }
                else { const a = (min - p[axis]) / d[axis], b = (max - p[axis]) / d[axis]; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }
            }
            if (hi >= lo && Number.isFinite(lo) && Number.isFinite(hi)) paths.push({ points: [add(p, mul(d, lo)), add(p, mul(d, hi))], ...style, entityId: e.id });
            break;
        }
        case 'DIMENSION': {
            if (e.block && doc.blocks[e.block]) {
                const g = entityGeometry({ ...e, type: 'INSERT', x: 0, y: 0 }, doc, { ...options, depth: depth + 1 });
                for (const p of g.paths)
                    paths.push(p);
                for (const t of g.texts)
                    texts.push(t);
                break;
            }
            const a = e.a, b = e.b;
            if (!a || !b)
                break;
            const n = normalize({ x: -(b.y - a.y), y: b.x - a.x }), off = e.offset ?? 30, p = add(a, mul(n, off)), q = add(b, mul(n, off));
            path([a, add(p, mul(n, 6))]);
            path([b, add(q, mul(n, 6))]);
            path([p, q]);
            const u = normalize(sub(q, p));
            for (const [v, dir] of [[p, 1], [q, -1]]) {
                path([add(v, add(mul(u, dir * 7), mul(n, 3))), v, add(v, add(mul(u, dir * 7), mul(n, -3)))]);
            }
            label(add(lerp(p, q, .5), mul(n, 5)), e.text && e.text !== '<>' ? e.text : distance(a, b).toFixed(1), e.height || 12, Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, 'center');
            break;
        }
        case 'INSERT': {
            const block = doc.blocks[e.block];
            if (!block)
                break;
            const base = block.base || { x: 0, y: 0 }, rows = Math.min(1000, e.rows || 1), cols = Math.min(1000, e.columns || 1);
            if (rows * cols > 10000)
                break;
            // MINSERT spacing belongs to the rotated placement grid, not the scaled block.
            const placement = matrix({ x: e.x || 0, y: e.y || 0, rotation: e.rotation || 0 });
            const shape = compose(matrix({ sx: e.sx ?? 1, sy: e.sy ?? e.sx ?? 1 }), matrix({ x: -base.x, y: -base.y }));
            const gridRotation = matrix({ rotation: e.rotation || 0 }), locations = new Set();
            for (let row = 0; row < rows; row++)
                for (let col = 0; col < cols; col++) {
                    const offset = { x: col * (e.columnSpacing || 0), y: row * (e.rowSpacing || 0) };
                    const key = offset.x + ':' + offset.y;
                    if (locations.has(key))
                        continue;
                    locations.add(key);
                    const mm = compose(m, compose(placement, compose(matrix(offset), shape)));
                    const attributeOffset = transform(offset, gridRotation);
                    for (const attribute of e.attributes || []) {
                        if (attribute.invisible)
                            continue;
                        const g = entityGeometry(attribute, doc, { ...options, matrix: compose(m, matrix(attributeOffset)), depth: depth + 1 });
                        for (const t of g.texts)
                            texts.push({ ...t, entityId: e.id });
                    }
                    for (const child of block.entities || []) {
                        if (child.type === 'ATTDEF' || child.hidden)
                            continue;
                        const cl = (child.layer === '0') ? (e.layer === '0' && parentLayer ? parentLayer : layerFor(e, doc)) : layerFor(child, doc);
                        if (cl?.visible === false)
                            continue;
                        const g = entityGeometry(child, doc, { matrix: mm, tolerance, depth: depth + 1, parentStyle: style, parentLayer: cl, view: options.view });
                        warnings.push(...(g.warnings || []));
                        for (const p of g.paths)
                            paths.push({ ...p, entityId: e.id });
                        for (const t of g.texts)
                            texts.push({ ...t, entityId: e.id });
                    }
                }
            if (e.tag && block.symbol) {
                const p = { x: e.x || 0, y: (e.y || 0) - Math.abs((e.sy ?? e.sx ?? 1) * (block.symbol.labelOffset || 55)) };
                label(p, e.tag, e.tagHeight || 12, 0, 'center');
            }
            break;
        }
    }
    if (e.connector && e.points?.length > 1) {
        const ps = e.points;
        const b = ps.at(-1), a = ps.at(-2), u = normalize(sub(a, b)), n = { x: -u.y, y: u.x };
        if (e.connector.arrow !== 'none')
            path([add(b, add(mul(u, 9), mul(n, 4))), b, add(b, add(mul(u, 9), mul(n, -4)))]);
        if (e.label) {
            const mid = ps[Math.floor((ps.length - 1) / 2)], next = ps[Math.min(ps.length - 1, Math.floor((ps.length - 1) / 2) + 1)];
            label(add(lerp(mid, next, .5), { x: 0, y: 8 }), e.label, 11, 0, 'center');
        }
    }
    return warnings.length ? { paths, texts, warnings } : { paths, texts };
}
function entityBounds(e, doc) {
    if (['RAY', 'XLINE'].includes(e.type)) return bounds([e.p]);
    const g = entityGeometry(e, doc, { tolerance: 1 }), pts = g.paths.flatMap(p => p.contours ? p.contours.flat() : p.points);
    for (const t of g.texts) {
        const layout = layoutCadText(t), frame = t.frame || matrix({ rotation: t.rotation }).slice(0, 4), tm = [...frame, t.p.x, t.p.y];
        // Layout coordinates are font coordinates (Y down); model coordinates are Y up.
        for (const x of [layout.minX, layout.maxX]) for (const y of [layout.minY, layout.maxY]) pts.push(transform({ x, y: -y }, tm));
    }
    if (!pts.length && e.type === 'INSERT') pts.push({ x: e.x, y: e.y });
    return bounds(pts);
}
function documentBounds(doc) {
    let b = emptyBounds();
    for (const e of doc.entities)
        if (isVisible(e, doc))
            b = union(b, entityBounds(e, doc));
    return validBounds(b) ? b : { minX: -100, minY: -100, maxX: 100, maxY: 100 };
}
function ports(e, doc) {
    if (e.type !== 'INSERT')
        return [];
    const block = doc.blocks[e.block], base = block?.base || { x: 0, y: 0 };
    const m = compose(matrix(e), matrix({ x: -base.x, y: -base.y }));
    return (block?.ports || []).map(p => { const q = transform(p, m), v = transform({ x: p.x + (p.dx || 0), y: p.y + (p.dy || 0) }, m); return { ...p, ...q, dx: v.x - q.x, dy: v.y - q.y, entityId: e.id }; });
}
function moveEntity(e, dx, dy) {
    const worldDX = dx, worldDY = dy;
    if (e.extrusion && ['CIRCLE','ARC','LWPOLYLINE','POLYLINE','TEXT','ATTRIB','ATTDEF','SOLID','TRACE','HATCH','INSERT'].includes(e.type) && !(e.type === 'POLYLINE' && (e.flags & (8|16|64)))) {
        const m = ocsTransform(e.extrusion, 0), det = m[0]*m[3]-m[1]*m[2];
        if (Math.abs(det) < 1e-10) throw new Error('Cannot drag an edge-on OCS plane in the top view.');
        dx = (m[3]*worldDX-m[2]*worldDY)/det; dy = (-m[1]*worldDX+m[0]*worldDY)/det;
    }
    const mv = p => {
        if (p) {
            p.x += dx;
            p.y += dy;
        }
    };
    for (const key of ['a', 'b', 'c', 'p', 'alignPoint'])
        mv(e[key]);
    for (const key of ['points', 'controlPoints', 'fitPoints'])
        for (const p of e[key] || [])
            mv(p);
    for (const l of e.loops || [])
        for (const p of l.points || [])
            mv(p);
    for (const loop of e.loops || []) for (const edge of loop.edges || []) {
        for (const key of ['a', 'b', 'c']) mv(edge[key]);
        for (const key of ['controlPoints', 'fitPoints']) for (const p of edge[key] || []) mv(p);
    }
    for (const definition of e.patternLines || []) mv(definition.base);
    if (e.type === 'INSERT') {
        e.x += dx;
        e.y += dy;
        for (const a of e.attributes || [])
            moveEntity(a, worldDX, worldDY);
    }
    e.dirty = true;
}
function transformEntity(e, m) {
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]), determinant = m[0]*m[3]-m[1]*m[2];
    if (!m.every(Number.isFinite) || sx < 1e-12 || sy < 1e-12) throw new Error('Singular or nonfinite CAD transform.');
    if (e.extrusion && (Math.abs(e.extrusion.x || 0) > 1e-9 || Math.abs(e.extrusion.y || 0) > 1e-9 || e.extrusion.z < 0))
        throw new Error('Rotation of non-default OCS geometry requires a 3D transform; coordinates were not modified.');
    if (['HATCH','CIRCLE','ARC','INSERT'].includes(e.type) && (Math.abs(sx-sy) > 1e-8*Math.max(sx,sy) || Math.abs(m[0]*m[2]+m[1]*m[3]) > 1e-8*sx*sy))
        throw new Error('This entity requires a similarity transform; nonuniform scale would change its native type.');
    if (e.type === 'HATCH' && determinant < 0) throw new Error('Mirroring native hatch edge paths is not supported; coordinates were not modified.');
    const vector = p => ({x:m[0]*p.x+m[2]*p.y,y:m[1]*p.x+m[3]*p.y});
    if (e.direction) Object.assign(e.direction, vector(e.direction));
    if (e.major) Object.assign(e.major, vector(e.major));
    for (const loop of e.loops || []) for (const edge of loop.edges || []) {
        for (const key of ['a','b','c']) if (edge[key]) Object.assign(edge[key], transform(edge[key], m));
        for (const key of ['controlPoints','fitPoints']) for (const p of edge[key] || []) Object.assign(p, transform(p, m));
        for (const key of ['major','startTangent','endTangent']) if (edge[key]) Object.assign(edge[key], vector(edge[key]));
        if (edge.r) edge.r *= sx;
        if (edge.type === 2) { const angle = Math.atan2(m[1],m[0]); edge.start += angle; edge.end += angle; }
    }
    for (const definition of e.patternLines || []) {
        Object.assign(definition.base, transform(definition.base, m)); Object.assign(definition.offset, vector(definition.offset));
        definition.angle += Math.atan2(m[1],m[0]); definition.dashes = (definition.dashes || []).map(v=>v*sx);
    }
    if (e.type === 'HATCH') { e.patternScale = (e.patternScale || 1)*sx; e.patternAngle = (e.patternAngle || 0) + Math.atan2(m[1],m[0])*180/Math.PI; }
    for (const p of e.points || []) { if (p.bulge && determinant < 0) p.bulge *= -1; for (const k of ['startWidth','endWidth']) if (p[k]) p[k] *= sx; }
    for (const k of ['constantWidth','startWidth','endWidth','mtextWidth']) if (e[k]) e[k] *= sx;
    const apply = p => {
        if (p)
            Object.assign(p, transform(p, m));
    };
    for (const key of ['a', 'b', 'c', 'p', 'alignPoint'])
        apply(e[key]);
    for (const key of ['points', 'controlPoints', 'fitPoints'])
        for (const p of e[key] || [])
            apply(p);
    for (const l of e.loops || [])
        for (const p of l.points || [])
            apply(p);
    const scale = Math.hypot(m[0], m[1]), rot = Math.atan2(m[1], m[0]) * 180 / Math.PI;
    if (e.r)
        e.r *= scale;
    if (e.height)
        e.height *= scale;
    if (e.type === 'ARC') {
        const angle = a => { const v=vector({x:Math.cos(a),y:Math.sin(a)}); return Math.atan2(v.y,v.x); };
        e.start = angle(e.start); e.end = angle(e.end);
        if (determinant < 0) e.clockwise = !e.clockwise;
    }
    if (e.type === 'INSERT') {
        const p = transform({ x: e.x, y: e.y }, m);
        e.x = p.x;
        e.y = p.y;
        e.sx = (e.sx ?? 1) * scale;
        e.sy = (e.sy ?? 1) * scale;
        e.rotation = (e.rotation || 0) + rot;
    }
    if (['TEXT', 'MTEXT'].includes(e.type))
        e.rotation = (e.rotation || 0) + rot;
    e.dirty = true;
}
function explodeEntity(e, doc) { const g = entityGeometry(e, doc, { tolerance: .05 }); return [...g.paths.map(p => polyline(p.points, p.closed, { layer: e.layer, color: p.color, width: p.width, dash: p.dash, fill: p.fill })), ...g.texts.map(t => text(t.p, t.text, t.height, { layer: e.layer, color: t.color, rotation: t.rotation, align: t.align }))]; }
function detachReferences(doc, deleted) {
    for (const e of doc.entities) {
        const c = e.connector;
        if (!c)
            continue;
        for (const end of ['from', 'to'])
            if (c[end] && deleted.has(c[end].entityId))
                c[end] = null;
    }
    doc.constraints = doc.constraints.filter(c => !(c.entities || [c.entityId]).some(id => deleted.has(id)));
}

return {textLayout,objectCoordinateTransform,uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences};
})();
// packages/dxf/src/index.js
__modules["packages/dxf/src/index.js"]=(()=>{
const {readEntityFidelity, writeHatchData} = __modules["packages/dxf/src/fidelity.js"];
const {createDocument, entity, uid, cleanText, clone, entityGeometry} = __modules["packages/model/src/index.js"];
const {TAU, arcPoints} = __modules["packages/geometry/src/index.js"];
const NUMBER_CODES = c => (c >= 10 && c <= 59) || (c >= 110 && c <= 149) || (c >= 210 && c <= 239) || (c >= 460 && c <= 469) || (c >= 1010 && c <= 1059);
const INT16_CODES = c => (c >= 60 && c <= 79) || (c >= 170 && c <= 179) || (c >= 270 && c <= 289) || (c >= 370 && c <= 389) || (c >= 400 && c <= 409) || (c >= 1060 && c <= 1070);
const INT32_CODES = c => (c >= 90 && c <= 99) || (c >= 420 && c <= 429) || (c >= 440 && c <= 459) || c === 1071;
const INT64_CODES = c => c >= 160 && c <= 169;
const BINARY_CODES = c => (c >= 310 && c <= 319) || c === 1004;
// Default ACI modelspace palette, verified against ezdxf 1.4.4.
// ACI 7 follows this application's light canvas. Palette data attribution: THIRD_PARTY_NOTICES.md.
const ACI_PALETTE = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 10813440, 10834514, 8323072, 8339263, 4980736, 4990502, 2490368, 2495251, 16727808, 16752511, 10823936, 10839890, 8331008, 8343359, 4985600, 4992806, 2492672, 2496275, 16744192, 16760703, 10834432, 10845266, 8339200, 8347455, 4990464, 4995366, 2495232, 2497555, 16760576, 16768895, 10845184, 10850642, 8347392, 8351551, 4995328, 4997670, 2497536, 2498835, 16776960, 16777087, 10855680, 10855762, 8355584, 8355647, 5000192, 5000230, 2500096, 2500115, 12582656, 14679935, 8168704, 9545042, 6258432, 7307071, 3755008, 4344870, 1844736, 2172435, 8388352, 12582783, 5416192, 8168786, 4161280, 6258495, 2509824, 3755046, 1254912, 1844755, 4194048, 10485631, 2729216, 6792530, 2064128, 5209919, 1264640, 3099686, 599552, 1517075, 65280, 8388479, 42240, 5416274, 32512, 4161343, 19456, 2509862, 9728, 1254931, 65343, 8388511, 42281, 5416295, 32543, 4161359, 19475, 2509871, 9737, 1267735, 65407, 8388543, 42322, 5416316, 32575, 4161375, 19494, 2509881, 9747, 1267740, 65471, 8388575, 42364, 5416337, 32607, 4161391, 19513, 2509890, 9756, 1267800, 65535, 8388607, 42405, 5416357, 32639, 4161407, 19532, 2509900, 9766, 1267800, 49151, 8380415, 31909, 5411237, 24447, 4157311, 14668, 2507390, 7206, 1267800, 32767, 8372223, 21157, 5405861, 16255, 4153215, 9804, 2505086, 4902, 1252440, 16383, 8364031, 10661, 5400485, 8063, 4149119, 4940, 2502526, 2342, 1251160, 255, 8355839, 165, 5395109, 127, 4145023, 76, 2500222, 38, 1250136, 4129023, 10452991, 2687141, 6771365, 2031743, 5193599, 1245260, 3090046, 589862, 1512280, 8323327, 12550143, 5374117, 8147621, 4128895, 6242175, 2490444, 3745406, 1245222, 1839960, 12517631, 14647295, 8126629, 9523877, 6226047, 7290751, 3735628, 4335180, 1835046, 5772120, 16711935, 16744447, 10813605, 10834597, 8323199, 8339327, 4980812, 4990540, 2490406, 5772120, 16711871, 16744415, 10813564, 10834577, 8323167, 8339311, 4980793, 4990530, 2490396, 5772120, 16711807, 16744383, 10813522, 10834556, 8323135, 8339295, 4980774, 4990521, 2490387, 5772060, 16711743, 16744351, 10813481, 10834535, 8323103, 8339279, 4980755, 4990511, 2490377, 5772055, 0, 6645093, 6710886, 10066329, 13421772, 16777215];
function aciColor(index) {
    index = Math.abs(Math.trunc(index));
    if (index === 7)
        return '#000000';
    return '#' + (ACI_PALETTE[index] ?? 0).toString(16).padStart(6, '0');
}
function parseAsciiPairs(source, { maxPairs = 8000000 } = {}) {
    const lines = source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/), pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
        if (pairs.length >= maxPairs)
            throw new Error('DXF group-code safety limit exceeded');
        const code = Number(lines[i].trim());
        if (!Number.isInteger(code) || code < 0 || code > 1071)
            throw new Error(`Invalid DXF group code at line ${i + 1}`);
        const raw = lines[i + 1], value = INT64_CODES(code) ? raw.trim() : (NUMBER_CODES(code) || INT16_CODES(code) || INT32_CODES(code) || INT64_CODES(code) || (code >= 290 && code <= 299)) ? Number(raw.trim()) : raw;
        if (INT64_CODES(code) && !/^[-+]?\d+$/.test(value))
            throw new Error('Invalid DXF int64 value');
        if (typeof value === 'number' && !Number.isFinite(value))
            throw new Error(`Invalid DXF numeric value at line ${i + 2}`);
        pairs.push([code, value]);
    }
    if (!pairs.some(([c, v]) => c === 0 && String(v).trim() === 'EOF'))
        throw new Error('DXF EOF marker missing (file may be truncated)');
    return pairs;
}
function parseBinaryPairs(input, { maxPairs = 8000000 } = {}) {
    const u = input instanceof Uint8Array ? input : new Uint8Array(input), v = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let pos = 22;
    const pairs = []; let decoder = new TextDecoder('windows-1252'), headerKey = ''; 
    const r12 = u[23] !== 0;
    const need = n => {
        if (pos + n > u.length)
            throw new Error('Truncated binary DXF');
    };
    while (pos < u.length) {
        if (pairs.length >= maxPairs)
            throw new Error('DXF safety limit exceeded');
        need(r12 ? 1 : 2);
        let code;
        if (r12) {
            code = u[pos++];
            if (code === 255) {
                need(2);
                code = v.getUint16(pos, true);
                pos += 2;
            }
        }
        else {
            code = v.getUint16(pos, true);
            pos += 2;
        }
        let value;
        if (NUMBER_CODES(code)) {
            need(8);
            value = v.getFloat64(pos, true);
            pos += 8;
        }
        else if (INT16_CODES(code)) {
            need(2);
            value = v.getInt16(pos, true);
            pos += 2;
        }
        else if (INT32_CODES(code)) {
            need(4);
            value = v.getInt32(pos, true);
            pos += 4;
        }
        else if (INT64_CODES(code)) {
            need(8);
            const n = v.getBigInt64(pos, true);
            value = n.toString();
            pos += 8;
        }
        else if (code >= 290 && code <= 299) {
            need(1);
            value = u[pos++];
        }
        else if (BINARY_CODES(code)) {
            need(1);
            const count = u[pos++];
            need(count);
            value = Array.from(u.subarray(pos, pos + count), n => n.toString(16).padStart(2, '0')).join('');
            pos += count;
        }
        else {
            const start = pos;
            while (pos < u.length && u[pos] !== 0)
                pos++;
            need(1);
            value = decoder.decode(u.subarray(start, pos));
            pos++;
        }
        if (typeof value === 'number' && !Number.isFinite(value))
            throw new Error('Non-finite binary DXF value');
        pairs.push([code, value]);
        if (code === 9) headerKey = value;
        else if (headerKey === '$ACADVER' && code === 1 && /^AC\d+$/.test(value) && +value.slice(2) >= 1021) decoder = new TextDecoder('utf-8');
        else if (headerKey === '$DWGCODEPAGE' && code === 3 && decoder.encoding !== 'utf-8') { try { decoder = new TextDecoder(({ ANSI_1250: 'windows-1250', ANSI_1251: 'windows-1251', ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_950: 'big5' })[value] || 'windows-1252'); } catch {} }
        if (code === 0 && value === 'EOF')
            break;
    }
    if (!pairs.some(([c, v]) => c === 0 && v === 'EOF'))
        throw new Error('Binary DXF EOF marker missing');
    return pairs;
}
const get = (r, c, d = undefined) => r.find(x => x[0] === c)?.[1] ?? d;
const all = (r, c) => r.filter(x => x[0] === c).map(x => x[1]);
const pt = (r, c = 10) => ({ x: Number(get(r, c, 0)), y: Number(get(r, c + 10, 0)), z: Number(get(r, c + 20, 0)) });
const points = (r, c = 10) => {
    const p = [];
    let current;
    for (const [code, v] of r) {
        if (code === c) {
            current = { x: Number(v), y: 0 };
            p.push(current);
        }
        else if (current && code === c + 10)
            current.y = Number(v);
        else if (current && code === c + 20)
            current.z = Number(v);
        else if (current && code === 42 && c === 10)
            current.bulge = Number(v);
    }
    return p;
};
const records = pairs => {
    const result = [];
    let r = [];
    for (const pair of pairs) {
        if (pair[0] === 0 && r.length) {
            result.push(r);
            r = [];
        }
        r.push(pair);
    }
    if (r.length)
        result.push(r);
    return result;
};
function metadata(raw) {
    let active = false, s = '';
    for (const [c, v] of raw) {
        if (c === 1001)
            active = v === 'CONDUITCAD';
        else if (active && c === 1000)
            s += v;
    }
    if (!s)
        return {};
    try {
        const data = JSON.parse(s);
        return data && typeof data === 'object' ? data : {};
    }
    catch {
        return {};
    }
}
function parseEntity(raw, diagnostics, options = {}) {
    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw, handle: get(raw, 5) }, dirty: false };
    const aci = Number(get(raw, 62, 256)), trueColor = get(raw, 420);
    e.colorIndex = aci; e.colorMode = trueColor === undefined ? 'aci' : 'truecolor';
    if (trueColor !== undefined)
        e.color = '#' + Number(trueColor).toString(16).padStart(6, '0');
    else if (aci === 0)
        e.color = 'BYBLOCK';
    else if (aci !== 256)
        e.color = aciColor(aci);
    e.lineweight = Number(get(raw, 370, -1));
    e.linetype = get(raw, 6, 'BYLAYER');
    if (get(raw, 60, 0))
        e.hidden = true;
    switch (type) {
        case 'LINE':
            e.a = pt(raw);
            e.b = pt(raw, 11);
            break;
        case 'LWPOLYLINE':
            e.points = points(raw);
            e.closed = !!(get(raw, 70, 0) & 1);
            e.constantWidth = get(raw, 43, 0);
            break;
        case 'POLYLINE':
            e.points = [];
            e.closed = !!(get(raw, 70, 0) & 1);
            e.flags = get(raw, 70, 0); e.mCount = +get(raw,71,0); e.nCount = +get(raw,72,0);
            break;
        case 'CIRCLE':
        case 'ARC':
            e.c = pt(raw);
            e.r = Number(get(raw, 40, 1));
            if (type === 'ARC') {
                e.start = Number(get(raw, 50, 0)) * Math.PI / 180;
                e.end = Number(get(raw, 51, 360)) * Math.PI / 180;
            }
            break;
        case 'ELLIPSE':
            e.c = pt(raw);
            e.major = pt(raw, 11);
            e.ratio = Number(get(raw, 40, 1));
            e.start = Number(get(raw, 41, 0));
            e.end = Number(get(raw, 42, TAU));
            break;
        case 'SPLINE':
            e.degree = Number(get(raw, 71, 3));
            e.controlPoints = points(raw);
            e.fitPoints = points(raw, 11);
            e.knots = all(raw, 40).map(Number);
            e.weights = all(raw, 41).map(Number);
            e.closed = !!(get(raw, 70, 0) & 1);
            break;
        case 'POINT':
            e.p = pt(raw);
            break;
        case 'TEXT':
        case 'MTEXT':
        case 'ATTRIB':
        case 'ATTDEF':
            e.p = pt(raw);
            e.text = type === 'MTEXT' ? all(raw, 3).join('') + get(raw, 1, '') : get(raw, 1, '');
            e.height = Number(get(raw, 40, 12));
            e.rotation = Number(get(raw, 50, 0));
            e.align = get(raw, 72, 0) === 1 ? 'center' : get(raw, 72, 0) === 2 ? 'right' : 'left';
            if (type === 'MTEXT') {
                const a = Number(get(raw, 71, 1));
                e.align = [2, 5, 8].includes(a) ? 'center' : [3, 6, 9].includes(a) ? 'right' : 'left';
                if (get(raw, 11) !== undefined)
                    e.rotation = Math.atan2(get(raw, 21, 0), get(raw, 11, 1)) * 180 / Math.PI;
                e.mtextWidth = get(raw, 41, 0);
            }
            if (['ATTRIB', 'ATTDEF'].includes(type)) {
                e.attributeTag = get(raw, 2, '');
                e.invisible = !!(get(raw, 70, 0) & 1);
            }
            e.widthFactor = Number(get(raw, 41, 1));
            break;
        case 'INSERT':
            e.block = get(raw, 2, '');
            e.x = get(raw, 10, 0);
            e.y = get(raw, 20, 0);
            e.z = get(raw, 30, 0);
            e.sx = get(raw, 41, 1);
            e.sy = get(raw, 42, 1);
            e.sz = get(raw, 43, 1);
            e.rotation = get(raw, 50, 0);
            e.columns = get(raw, 70, 1);
            e.rows = get(raw, 71, 1);
            e.columnSpacing = get(raw, 44, 0);
            e.rowSpacing = get(raw, 45, 0);
            e.attributes = [];
            break;
        case 'SOLID':
        case 'TRACE':
        case '3DFACE':
            e.points = [pt(raw, 10), pt(raw, 11), pt(raw, 13), pt(raw, 12)];
            break;
        case 'HATCH':
            e.loops = [];
            e.solid = !!get(raw, 70, 0);
            e.pattern = get(raw, 2, 'SOLID');
            break;
        case 'DIMENSION':
            e.block = get(raw, 2);
            e.a = pt(raw, 13);
            e.b = pt(raw, 14);
            e.text = get(raw, 1, '<>');
            break;
        case 'VERTEX':
            e.p = pt(raw);
            e.p.bulge = get(raw, 42, 0);
            e.p.startWidth = get(raw, 40, 0); e.p.endWidth = get(raw, 41, 0);
            e.vertexFlags=+get(raw,70,0); e.faceIndices=[71,72,73,74].map(c=>+get(raw,c,0)).filter(Boolean);
            break;
        case 'LEADER':
        case 'RAY':
        case 'XLINE':
        case 'SEQEND': break;
        default:
            e.unsupported = true;
            diagnostics.push({ severity: 'warning', type, message: `${type}: retained in original source; no editable display implementation.` });
    }
    const meta = metadata(raw);
    if (typeof meta.id === 'string' && meta.id.length <= 160)
        e.id = meta.id;
    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked'])
        if (k in meta)
            e[k] = meta[k];
    readEntityFidelity(e, raw, diagnostics, options);
    if(type === 'MTEXT') {
        const pos=raw.findIndex(p=>p[0]===100&&p[1]==='AcDbMText');
        if(pos>=0) { const common=raw.slice(0,pos), value=get(common,420), index=+get(common,62,256);
            e.colorMode = value===undefined ? 'aci' : 'truecolor';
            if(value!==undefined)e.color='#'+(+value&0xffffff).toString(16).padStart(6,'0');
            else if(index===256)delete e.color; else e.color=index===0?'BYBLOCK':aciColor(index);
        }
    }
    return e;
}
function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192)
        s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
}
function parseDXF(input, options = {}) {
    let rawText = '', pairs, source;
    const bytes = typeof input === 'string' ? null : input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes && bytes.byteLength > 128 * 1024 * 1024)
        throw new Error('File exceeds the 128 MiB import safety limit');
    const binary = bytes && new TextDecoder().decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF';
    if (binary) {
        pairs = parseBinaryPairs(bytes, options);
        source = { format: 'binary', base64: base64(bytes) };
    }
    else {
        if (bytes) {
            let enc = options.encoding;
            const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 65536));
            if (!enc) {
                const ver = prefix.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/)?.[1];
                const cp = prefix.match(/ANSI_(\d+)/)?.[1];
                enc = ver && Number(ver.slice(2)) >= 1021 ? 'utf-8' : cp === '1250' ? 'windows-1250' : cp === '1251' ? 'windows-1251' : cp === '932' ? 'shift_jis' : 'windows-1252';
            }
            rawText = new TextDecoder(enc).decode(bytes);
        }
        else
            rawText = String(input);
        pairs = parseAsciiPairs(rawText, options);
        source = bytes ? { format: 'ascii', base64: base64(bytes) } : { format: 'ascii', text: rawText };
    }
    const doc = createDocument(options.name || 'Imported DXF');
    doc.layers = []; doc.textStyles = {}; doc.linetypes = { CONTINUOUS: [] }; doc.signedLinetypes = true;
    doc.source = source;
    doc.rawSections = {};
    doc.importDiagnostics = [];
    let section = '', current = [], sections = {};
    for (let i = 0; i < pairs.length; i++) {
        const [c, v] = pairs[i];
        if (c === 0 && v === 'SECTION') {
            section = String(pairs[++i]?.[1] || '');
            current = [];
        }
        else if (c === 0 && v === 'ENDSEC') {
            sections[section] = current;
            section = '';
        }
        else if (section)
            current.push(pairs[i]);
    }
    if (!sections.ENTITIES && !sections.BLOCKS)
        throw new Error('DXF contains neither ENTITIES nor BLOCKS sections');
    const header = sections.HEADER || [];
    let key = '';
    for (const [c, v] of header) {
        if (c === 9)
            key = String(v);
        else if (key === '$INSUNITS' && c === 70)
            doc.units = ({ 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' })[v] || 'unitless';
        else if (key === '$LTSCALE' && c === 40) doc.linetypeScale = v;
        else if (key === '$ACADVER')
            doc.importVersion = v;
    }
    let table = '';
    for (const r of records(sections.TABLES || [])) {
        const t = get(r, 0);
        if (t === 'TABLE')
            table = get(r, 2);
        else if (t === 'ENDTAB')
            table = '';
        else if (table === 'LAYER' && t === 'LAYER') {
            const n = get(r, 2, '0'), aci = Number(get(r, 62, 7));
            doc.layers.push({ name: n, colorIndex:Math.abs(aci), colorMode:get(r,420)===undefined?'aci':'truecolor', color: get(r, 420) !== undefined ? '#' + Number(get(r, 420)).toString(16).padStart(6, '0') : aciColor(Math.abs(aci)), visible: aci >= 0 && !(get(r, 70, 0) & 1), locked: !!(get(r, 70, 0) & 4), linetype: get(r, 6, 'CONTINUOUS'), lineweight: +get(r, 370, -3) });
        }
        else if (table === 'LTYPE' && t === 'LTYPE')
            doc.linetypes[get(r, 2, 'CONTINUOUS')] = all(r, 49).map(Number);
        else if (table === 'STYLE' && t === 'STYLE')
            doc.textStyles[get(r, 2, 'STANDARD')] = { font: get(r, 3, 'sans-serif'), bigFont: get(r, 4, ''), height: +get(r, 40, 0), widthFactor: +get(r, 41, 1), oblique: +get(r, 50, 0), flags: +get(r, 71, 0) };
    }
    if (!doc.layers.length)
        doc.layers.push({ name: '0', color: '#344755', visible: true, locked: false });
    const parseList = rs => {
        const es = [];
        let poly = null, insert = null;
        for (const raw of rs) {
            const e = parseEntity(raw, doc.importDiagnostics, options);
            if (e.type === 'VERTEX' && poly) {
                if ((poly.flags & 64) && e.faceIndices.length) { poly.faces ??= []; poly.faces.push(e.faceIndices); }
                else poly.points.push(e.p);
                continue;
            }
            if (e.type === 'ATTRIB' && insert) {
                insert.attributes.push(e);
                continue;
            }
            if (e.type === 'SEQEND') {
                poly = null;
                insert = null;
                continue;
            }
            poly = e.type === 'POLYLINE' ? e : null;
            insert = e.type === 'INSERT' ? e : null;
            es.push(e);
        }
        for (const e of es)
            if (e.type === 'INSERT' && e.tag)
                e.attributes = e.attributes.filter(a => !(a.attributeTag === 'TAG' && a.text === e.tag));
        return es;
    };
    let block = null, blockRecords = [];
    for (const raw of records(sections.BLOCKS || [])) {
        const t = get(raw, 0);
        if (t === 'BLOCK') {
            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], ...metadata(raw) };
            blockRecords = [];
        }
        else if (t === 'ENDBLK') {
            if (block) {
                block.entities = parseList(blockRecords);
                doc.blocks[block.name] = block;
            }
            block = null;
        }
        else if (block)
            blockRecords.push(raw);
    }
    doc.entities = parseList(records(sections.ENTITIES || []));
    const seen = new Set();
    for (const e of doc.entities) {
        if (seen.has(e.id))
            e.id = uid();
        seen.add(e.id);
        if (!doc.layers.some(l => l.name === e.layer))
            doc.layers.push({ name: e.layer, color: '#344755', visible: true, locked: false });
        if (!doc.layouts.includes(e.layout))
            doc.layouts.push(e.layout);
    }
    const metaComments = all(header, 999).filter(s => String(s).startsWith('CONDUIT:')).map(s => String(s).slice(8)).join('');
    if (metaComments) {
        try {
            const m = JSON.parse(metaComments);
            doc.parameters = m.parameters || doc.parameters;
            doc.constraints = m.constraints || [];
            doc.metadata = m.metadata || doc.metadata;
        }
        catch {
            doc.importDiagnostics.push({ severity: 'warning', message: 'Conduit header metadata could not be decoded.' });
        }
    }
    const unsupported = doc.entities.filter(e => e.unsupported).length;
    doc.importDiagnostics.unshift({ severity: 'info', message: `${doc.entities.length} model/layout entities, ${Object.keys(doc.blocks).length} blocks, ${doc.layers.length} layers; ${unsupported} unsupported entities.` });
    for (const [name, p] of Object.entries(sections))
        if (!['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(name))
            doc.rawSections[name] = p;
    doc.importDiagnostics.push({ severity: 'info', message: 'Original input remains available unchanged. Edited DXF export normalizes supported planar entities; arbitrary objects, dictionaries and ownership graphs are not losslessly rewritten.' });
    return doc;
}
function asciiJson(data) { return JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); }
/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */
function writeDXF(doc, { version = 'AC1024', includeMetadata = true } = {}) {
    if (!['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'].includes(version))
        throw new Error('Supported export versions: R2000–R2018');
    const out = [];
    let handle = 0x100;
    const used = new Set();
    for (const e of doc.entities) {
        if (e._dxf?.handle) {
            used.add(e._dxf.handle.toUpperCase());
            handle = Math.max(handle, parseInt(e._dxf.handle, 16) + 1 || 0x100);
        }
    }
    const next = () => {
        while (used.has(handle.toString(16).toUpperCase()))
            handle++;
        return (handle++).toString(16).toUpperCase();
    };
    const pair = (c, v) => {
        if (typeof v === 'number' && !Number.isFinite(v))
            throw new Error(`Nonfinite DXF value for code ${c}`);
        let s = typeof v === 'number' ? String(v) : String(v ?? '');
        s = s.replace(/\r?\n/g, '\\P');
        if (Number(version.slice(2)) < 1021)
            s = s.replace(/[\u007f-\uffff]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
        out.push(String(c), s);
    };
    const pp = (c, p) => { pair(c, p?.x || 0); pair(c + 10, p?.y || 0); pair(c + 20, p?.z || 0); };
    const meta = data => {
        if (!includeMetadata || !Object.keys(data).length)
            return;
        pair(1001, 'CONDUITCAD');
        const s = asciiJson(data);
        for (let i = 0; i < s.length; i += 200)
            pair(1000, s.slice(i, i + 200));
    };
    const section = name => { pair(0, 'SECTION'); pair(2, name); };
    const end = () => pair(0, 'ENDSEC');
    section('HEADER');
    pair(9, '$ACADVER');
    pair(1, version);
    pair(9, '$INSUNITS');
    pair(70, ({ unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 })[doc.units] ?? 4);
    pair(9, '$LTSCALE'); pair(40, doc.linetypeScale || 1);
    pair(9, '$MEASUREMENT');
    pair(70, doc.units === 'in' || doc.units === 'ft' ? 0 : 1);
    if (includeMetadata) {
        const s = asciiJson({ parameters: doc.parameters, constraints: doc.constraints, metadata: doc.metadata });
        for (let i = 0; i < s.length; i += 180)
            pair(999, 'CONDUIT:' + s.slice(i, i + 180));
    }
    end();
    section('TABLES');
    pair(0, 'TABLE');
    pair(2, 'LTYPE');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, 1);
    pair(0, 'LTYPE');
    pair(5, next());
    pair(100, 'AcDbSymbolTableRecord');
    pair(100, 'AcDbLinetypeTableRecord');
    pair(2, 'CONTINUOUS');
    pair(70, 0);
    pair(3, 'Solid line');
    pair(72, 65);
    pair(73, 0);
    pair(40, 0);
    const types = { ...doc.linetypes };
    for (const e of [...doc.entities, ...Object.values(doc.blocks).flatMap(b=>b.entities || [])])
        if (e.dash?.length)
            types['CC_DASH_' + e.dash.join('_')] = e.dash;
    for (const [name, pattern] of Object.entries(types)) {
        if (name === 'CONTINUOUS' || !pattern.length)
            continue;
        pair(0, 'LTYPE');
        pair(5, next());
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbLinetypeTableRecord');
        pair(2, name);
        pair(70, 0);
        pair(3, name);
        pair(72, 65);
        pair(73, pattern.length);
        pair(40, pattern.reduce((a, b) => a + Math.abs(b), 0));
        pattern.forEach((v, i) => { pair(49, doc.signedLinetypes && !name.startsWith('CC_DASH_') ? v : Math.abs(v) * (i % 2 ? -1 : 1)); pair(74, 0); });
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'LAYER');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, doc.layers.length);
    for (const l of doc.layers) {
        pair(0, 'LAYER');
        pair(5, next());
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbLayerTableRecord');
        pair(2, l.name);
        pair(70, l.locked ? 4 : 0);
        const layerACI = l.colorMode === 'aci' && l.colorIndex > 0 && l.colorIndex < 256 && aciColor(l.colorIndex).toLowerCase() === l.color?.toLowerCase();
        pair(62, (l.visible === false ? -1 : 1) * (layerACI ? l.colorIndex : 7));
        if (!layerACI) pair(420, parseInt((l.color || '#344755').slice(1), 16));
        pair(6, l.linetype || 'CONTINUOUS');
        if (l.lineweight !== undefined) pair(370, l.lineweight);
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'STYLE');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    const textStyles = { STANDARD: { font: 'txt', widthFactor: 1 }, ...doc.textStyles };
    pair(70, Object.keys(textStyles).length);
    for (const [name, style] of Object.entries(textStyles)) {
        pair(0, 'STYLE'); pair(5, next()); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbTextStyleTableRecord');
        pair(2, name); pair(70, 0); pair(40, style.height || 0); pair(41, style.widthFactor || 1);
        pair(50, style.oblique || 0); pair(71, style.flags || 0); pair(42, 2.5); pair(3, style.font || 'txt'); pair(4, style.bigFont || '');
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'APPID');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, 1);
    pair(0, 'APPID');
    pair(5, next());
    pair(100, 'AcDbSymbolTableRecord');
    pair(100, 'AcDbRegAppTableRecord');
    pair(2, 'CONDUITCAD');
    pair(70, 0);
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'BLOCK_RECORD');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, Object.keys(doc.blocks).length + 2);
    const blockRecords = {};
    for (const name of ['*Model_Space', '*Paper_Space', ...Object.keys(doc.blocks).filter(n => !['*Model_Space', '*Paper_Space'].includes(n))]) {
        blockRecords[name] = next();
        pair(0, 'BLOCK_RECORD');
        pair(5, blockRecords[name]);
        pair(100, 'AcDbSymbolTableRecord');
        pair(100, 'AcDbBlockTableRecord');
        pair(2, name);
    }
    pair(0, 'ENDTAB');
    end();
    const header = (e, t = e.type, owner) => {
        pair(0, t);
        const emittedHandle = next(); pair(5, emittedHandle);
        if (owner)
            pair(330, owner);
        pair(100, 'AcDbEntity');
        pair(8, e.layer || '0');
        if (e.layout && e.layout !== 'Model') {
            pair(67, 1);
            pair(410, e.layout);
        }
        if (e.color === 'BYBLOCK')
            pair(62, 0);
        else if (e.color && e.color !== 'BYLAYER' && e.colorMode==='aci' && e.colorIndex>0 && e.colorIndex<256 && aciColor(e.colorIndex).toLowerCase()===e.color.toLowerCase()) pair(62,e.colorIndex);
        else if (e.color && e.color !== 'BYLAYER') {
            pair(62, 7);
            pair(420, parseInt(e.color.slice(1), 16));
        }
        if (e.hidden)
            pair(60, 1);
        if (e.opacity !== undefined) pair(440, 0x02000000 | Math.round(255 * Math.max(0, Math.min(1, e.opacity))));
        else if (e.transparency != null) pair(440, e.transparency);
        if (e.linetypeScale !== undefined) pair(48, e.linetypeScale);
        if (e.lineweight !== undefined)
            pair(370, e.lineweight);
        if (e.dash?.length)
            pair(6, 'CC_DASH_' + e.dash.join('_'));
        else if (e.linetype && e.linetype !== 'BYLAYER')
            pair(6, e.linetype);
        return emittedHandle;
    };
    const emit = (e, owner) => {
        if (e.unsupported) {
            return;
        } // The original-source download is the lossless preservation path.
        if (e.type === 'DIMENSION' && !e.block) {
            const g = entityGeometry(e, doc);
            for (const p of g.paths)
                emit({ type: 'LWPOLYLINE', points: p.points, closed: p.closed, layer: e.layer, color: p.color }, owner);
            for (const t of g.texts)
                emit({ type: 'TEXT', ...t, layer: e.layer }, owner);
            return;
        }
        const type = e.type === 'POLYLINE' && !(e.flags & (8|16|64)) ? 'LWPOLYLINE' : e.type;
        const entityHandle = header(e, type, owner);
        switch (type) {
            case 'POLYLINE':
                pair(100,(e.flags&64)?'AcDbPolyFaceMesh':(e.flags&16)?'AcDbPolygonMesh':'AcDb3dPolyline');
                pair(66,1); pp(10,{x:0,y:0,z:e.elevation || 0}); pair(70,(e.flags || 8)|(e.closed?1:0));
                if(e.flags&16){pair(71,e.mCount || 0);pair(72,e.nCount || 0);}
                if(e.flags&64){pair(71,e.points.length);pair(72,e.faces?.length || 0);}
                break;
            case 'HATCH': writeHatchData(e, pair); break;
            case 'LEADER':
                pair(100, 'AcDbLeader'); pair(3, e.dimstyle || 'STANDARD'); pair(71, e.arrow === false ? 0 : 1); pair(72, e.spline ? 1 : 0); pair(73, 3); pair(74, 0); pair(75, 0); pair(76, e.points.length); for (const p of e.points) pp(10, p); break;
            case 'RAY':
            case 'XLINE': pair(100, type === 'RAY' ? 'AcDbRay' : 'AcDbXline'); pp(10, e.p); pp(11, e.direction); break;
            case 'LINE':
                pair(100, 'AcDbLine');
                pp(10, e.a);
                pp(11, e.b);
                break;
            case 'LWPOLYLINE':
                pair(100, 'AcDbPolyline');
                pair(90, e.points.length);
                pair(70, e.closed ? 1 : 0);
                if (e.elevation) pair(38, e.elevation);
                if (e.constantWidth)
                    pair(43, e.constantWidth);
                for (const p of e.points) {
                    pair(10, p.x);
                    pair(20, p.y);
                    if (p.startWidth) pair(40, p.startWidth);
                    if (p.endWidth) pair(41, p.endWidth);
                    if (p.bulge)
                        pair(42, p.bulge);
                }
                break;
            case 'CIRCLE':
            case 'ARC':
                pair(100, 'AcDbCircle');
                pp(10, e.c);
                pair(40, e.r);
                if (type === 'ARC') {
                    pair(100, 'AcDbArc');
                    pair(50, (e.clockwise ? e.end : e.start) * 180 / Math.PI);
                    pair(51, (e.clockwise ? e.start : e.end) * 180 / Math.PI);
                }
                break;
            case 'ELLIPSE':
                pair(100, 'AcDbEllipse');
                pp(10, e.c);
                pp(11, e.major);
                pair(40, e.ratio);
                pair(41, e.start || 0);
                pair(42, e.end ?? TAU);
                break;
            case 'SPLINE':
                pair(100, 'AcDbSpline');
                pair(70, (e.closed ? 1 : 0) | (e.weights?.length ? 4 : 0) | 8);
                pair(71, e.degree);
                pair(72, e.knots.length);
                pair(73, e.controlPoints.length);
                pair(74, e.fitPoints?.length || 0);
                for (const v of e.knots)
                    pair(40, v);
                for (const v of e.weights || [])
                    pair(41, v);
                for (const p of e.controlPoints)
                    pp(10, p);
                for (const p of e.fitPoints || [])
                    pp(11, p);
                break;
            case 'TEXT':
            case 'ATTRIB':
            case 'ATTDEF':
                pair(100, 'AcDbText');
                pp(10, e.p);
                pair(40, e.height || 12);
                pair(1, e.text || '');
                pair(50, e.rotation || 0);
                pair(41, e.widthFactor || 1);
                pair(7, e.styleName || 'STANDARD');
                if (e.oblique) pair(51, e.oblique); if (e.textFlags) pair(71, e.textFlags);
                if (e.halign || e.valign || (e.align && e.align !== 'left')) {
                    pair(72, e.halign ?? (e.align === 'center' ? 1 : e.align === 'right' ? 2 : 0));
                    pp(11, e.alignPoint || e.p);
                }
                if (type === 'TEXT') { pair(100, 'AcDbText'); pair(73, e.valign || 0); }
                else {
                    pair(100, type === 'ATTRIB' ? 'AcDbAttribute' : 'AcDbAttributeDefinition');
                    pair(2, e.attributeTag || 'TAG');
                    if (type === 'ATTDEF')
                        pair(3, 'Equipment tag');
                    pair(70, e.invisible ? 1 : 0); pair(74, e.valign || 0);
                }
                break;
            case 'MTEXT': {
                pair(100, 'AcDbMText'); pp(10, e.p); pair(40, e.height || 12); pair(41, e.mtextWidth || 0);
                pair(71, e.attachment || (e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1)); pair(7, e.styleName || 'STANDARD');
                const value = String(e.text || '').replace(/\r?\n/g, '\\P');
                for (let i = 0; i < value.length - 250; i += 250) pair(3, value.slice(i, i + 250));
                pair(1, value.slice(Math.max(0, Math.ceil((value.length - 250) / 250)) * 250));
                const a = (e.rotation || 0) * Math.PI / 180; pp(11, { x: Math.cos(a), y: Math.sin(a) });
                pair(73, e.lineSpacingStyle || 1); pair(44, e.lineSpacing || 1);
                if (e.backgroundFill) { pair(90, e.backgroundFill); pair(45, e.backgroundScale || 1.5); pair(63, 7); if (e.backgroundColor) pair(421, parseInt(e.backgroundColor.slice(1), 16)); }
                break;
            }
            case 'POINT':
                pair(100, 'AcDbPoint');
                pp(10, e.p);
                break;
            case 'SOLID':
            case 'TRACE':
            case '3DFACE':
                pair(100, type === '3DFACE' ? 'AcDbFace' : 'AcDbTrace');
                if (type === '3DFACE') pair(70, e.edgeFlags || 0);
                for (const [i, j] of (type === '3DFACE' ? [[0, 0], [1, 1], [2, 2], [3, 3]] : [[0, 0], [1, 1], [2, 3], [3, 2]]))
                    pp(10 + i, e.points[j] || e.points.at(-1));
                break;
            case 'DIMENSION':
                pair(100, 'AcDbDimension');
                pair(2, e.block);
                pp(10, e.a);
                pair(70, 32);
                pair(1, e.text || '<>');
                pair(100, 'AcDbAlignedDimension');
                pp(13, e.a);
                pp(14, e.b);
                break;
            case 'INSERT': {
                pair(100, 'AcDbBlockReference');
                pair(2, e.block);
                pp(10, { x: e.x, y: e.y, z: e.z });
                pair(41, e.sx ?? 1);
                pair(42, e.sy ?? 1);
                pair(43, e.sz ?? 1);
                pair(50, e.rotation || 0);
                if (e.columns > 1) {
                    pair(70, e.columns);
                    pair(44, e.columnSpacing || 0);
                }
                if (e.rows > 1) {
                    pair(71, e.rows);
                    pair(45, e.rowSpacing || 0);
                }
                if (e.attributes?.length || e.tag)
                    pair(66, 1);
                break;
            }
        }
        if (e.type !== 'HATCH' && e.extrusion) pp(210, e.extrusion);
        if (e.thickness) pair(39, e.thickness);
        const m = {};
        if (e.id)
            m.id = e.id;
        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked'])
            if (e[k] !== undefined)
                m[k] = e[k];
        meta(m);
        if (type === 'POLYLINE') {
            for (const p of e.points || []) {
                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbVertex');
                pair(100,(e.flags&64)?'AcDbPolyFaceMeshVertex':(e.flags&16)?'AcDbPolygonMeshVertex':'AcDb3dPolylineVertex');
                pp(10,p);pair(70,(e.flags&64)?192:(e.flags&16)?64:32);
            }
            for (const face of e.faces || []) {
                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbFaceRecord');pp(10,{x:0,y:0,z:0});pair(70,128);
                face.forEach((n,i)=>pair(71+i,n));
            }
            header({layer:e.layer},'SEQEND',entityHandle);
        }
        if (type === 'INSERT' && (e.attributes?.length || e.tag)) {
            for (const a of e.attributes || [])
                emit(a, owner);
            if (e.tag) {
                const block = doc.blocks[e.block], offset = block?.symbol?.labelOffset || 55;
                emit({ type: 'ATTRIB', p: { x: e.x, y: e.y - Math.abs((e.sy ?? 1) * offset) }, text: e.tag, height: e.tagHeight || 12, align: 'center', attributeTag: 'TAG', layer: e.layer }, owner);
            }
            pair(0, 'SEQEND');
            pair(5, next());
            pair(100, 'AcDbEntity');
            pair(8, e.layer || '0');
        }
    };
    section('BLOCKS');
    for (const name of Object.keys(blockRecords)) {
        const b = doc.blocks[name] || { base: { x: 0, y: 0 }, entities: [] };
        pair(0, 'BLOCK');
        pair(5, next());
        pair(330, blockRecords[name]);
        pair(100, 'AcDbEntity');
        pair(8, '0');
        pair(100, 'AcDbBlockBegin');
        pair(2, name);
        pair(70, 0);
        pp(10, b.base);
        pair(3, name);
        pair(1, '');
        meta({ ports: b.ports || [], symbol: b.symbol });
        for (const e of b.entities)
            emit(e, blockRecords[name]);
        pair(0, 'ENDBLK');
        pair(5, next());
        pair(330, blockRecords[name]);
        pair(100, 'AcDbEntity');
        pair(8, '0');
        pair(100, 'AcDbBlockEnd');
    }
    end();
    section('ENTITIES');
    for (const e of doc.entities)
        emit(e, blockRecords[e.layout && e.layout !== 'Model' ? '*Paper_Space' : '*Model_Space']);
    end();
    pair(0, 'EOF');
    return out.join('\r\n') + '\r\n';
}
function exportReport(doc) { const unsupported = doc.entities.filter(e => e.unsupported), hatches = doc.entities.filter(e => e.type === 'HATCH'), dims = doc.entities.filter(e => e.type === 'DIMENSION' && !e.block); return { format: 'ASCII DXF R2010', unsupported: unsupported.map(e => ({ id: e.id, type: e.type })), warnings: [...(unsupported.length ? [`${unsupported.length} unsupported entities omitted from normalized export. Use Original DXF to retain every record.`] : []), ...(hatches.some(e => e.associative) ? ['Hatch boundaries exported natively, but associativity is detached to avoid dangling handles.'] : []), ...(dims.length ? [`${dims.length} authored dimensions exported as visible line/text geometry.`] : []), ...(Object.keys(doc.rawSections || {}).length ? ['Original OBJECTS and other opaque sections are not regenerated.'] : [])], originalAvailable: !!doc.source }; }

return {aciColor,parseAsciiPairs,parseBinaryPairs,parseDXF,writeDXF,exportReport};
})();
// apps/studio/dxf-worker.js
__modules["apps/studio/dxf-worker.js"]=(()=>{
const {parseDXF} = __modules["packages/dxf/src/index.js"];
self.onmessage = event => {
    try {
        const { buffer, name, encoding } = event.data;
        self.postMessage({ document: parseDXF(buffer, { name, encoding }) });
    }
    catch (error) {
        self.postMessage({ error: error.message || String(error) });
    }
};

return {};
})();
})();
