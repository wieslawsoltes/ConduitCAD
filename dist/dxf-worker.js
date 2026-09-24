'use strict';
(()=>{
const __modules=Object.create(null);
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
// packages/model/src/index.js
__modules["packages/model/src/index.js"]=(()=>{
const {matrix, compose, identity, transform, bounds, union, emptyBounds, arcPoints, tessellatePolyline, splinePoints, TAU, distance, lerp, add, mul, normalize, sub, validBounds} = __modules["packages/geometry/src/index.js"];
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
function resolveStyle(e, doc, parentStyle = null, parentLayer = null) { const layer = (e.layer === '0' && parentLayer) ? parentLayer : layerFor(e, doc); return { color: e.color === 'BYBLOCK' ? parentStyle?.color || layer?.color || '#344755' : (!e.color || e.color === 'BYLAYER' ? layer?.color || '#344755' : e.color), width: e.width ?? (e.lineweight > 0 ? Math.max(1, e.lineweight / 35) : 1.5), dash: e.dash ?? (e.linetype === 'BYBLOCK' ? parentStyle?.dash : null) ?? doc.linetypes?.[e.linetype] ?? doc.linetypes?.[layer?.linetype] ?? layer?.dash ?? [], opacity: e.opacity ?? 1 }; }
/** Returns portable paths/text. Blocks retain their native definitions in the model. */
function entityGeometry(e, doc, options = {}) {
    const { tolerance = .25, depth = 0, parentStyle = null, parentLayer = null } = options, m = options.matrix || identity();
    if (depth > 24)
        return { paths: [], texts: [] };
    const curveTolerance = tolerance / Math.max(1e-9, Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
    const style = resolveStyle(e, doc, parentStyle, parentLayer), paths = [], texts = [];
    const path = (pts, closed = false, fill = null) => {
        if (pts.length > 1)
            paths.push({ points: pts.map(p => transform(p, m)), closed, fill, ...style, entityId: e.id });
    };
    const label = (p, value, height, rotation = 0, align = 'left') => { const q = transform(p, m), sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]); texts.push({ p: q, text: cleanText(value), height: height * sy, rotation: rotation + Math.atan2(m[1], m[0]) * 180 / Math.PI, align, color: style.color, entityId: e.id, font: e.font || 'sans-serif', widthFactor: (e.widthFactor || 1) * sx / (sy || 1) }); };
    switch (e.type) {
        case 'LINE':
            path([e.a, e.b]);
            break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
            path(tessellatePolyline(e.points || [], !!e.closed, curveTolerance), !!e.closed, e.fill);
            break;
        case 'CIRCLE':
            path(arcPoints(e.c, e.r, 0, TAU, curveTolerance), true, e.fill);
            break;
        case 'ARC':
            path(arcPoints(e.c, e.r, e.start, e.end, curveTolerance, !!e.clockwise));
            break;
        case 'ELLIPSE': {
            const a = e.major || { x: e.rx || 1, y: 0 }, r = e.ratio ?? 1, s = e.start ?? 0;
            let sweep = (e.end ?? TAU) - s;
            while (sweep <= 0)
                sweep += TAU;
            const n = Math.min(4096, Math.max(24, Math.ceil(sweep * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(curveTolerance, .0000001)))));
            path(Array.from({ length: n + 1 }, (_, i) => { const t = s + sweep * i / n; return { x: e.c.x + a.x * Math.cos(t) - a.y * r * Math.sin(t), y: e.c.y + a.y * Math.cos(t) + a.x * r * Math.sin(t) }; }), Math.abs(sweep - TAU) < 1e-6);
            break;
        }
        case 'SPLINE':
            path(splinePoints(e, curveTolerance), !!e.closed);
            break;
        case 'TEXT':
        case 'MTEXT':
        case 'ATTRIB':
        case 'ATTDEF':
            if (!e.invisible)
                label(e.p, e.text || '', e.height || 12, e.rotation || 0, e.align || 'left');
            break;
        case 'POINT': {
            const r = 1.5;
            path([{ x: e.p.x - r, y: e.p.y }, { x: e.p.x + r, y: e.p.y }]);
            path([{ x: e.p.x, y: e.p.y - r }, { x: e.p.x, y: e.p.y + r }]);
            break;
        }
        case 'SOLID':
        case 'TRACE':
        case '3DFACE':
            path(e.points || [], true, e.type === '3DFACE' ? null : style.color);
            break;
        case 'HATCH':
            for (const loop of e.loops || [])
                path(tessellatePolyline(loop.points || [], true, curveTolerance), true, e.solid ? style.color : null);
            break;
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
                        const g = entityGeometry(child, doc, { matrix: mm, tolerance, depth: depth + 1, parentStyle: style, parentLayer: cl });
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
    return { paths, texts };
}
function entityBounds(e, doc) {
    const g = entityGeometry(e, doc, { tolerance: 1 }), pts = g.paths.flatMap(p => p.points);
    for (const t of g.texts) {
        const w = t.text.split('\n').reduce((a, s) => Math.max(a, s.length), 0) * t.height * .62, h = t.height * t.text.split('\n').length;
        const tm = matrix({ x: t.p.x, y: t.p.y, rotation: t.rotation }), x = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;
        pts.push(...[{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: h }, { x, y: h }].map(p => transform(p, tm)));
    }
    if (!pts.length && e.type === 'INSERT')
        pts.push({ x: e.x, y: e.y });
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
    const mv = p => {
        if (p) {
            p.x += dx;
            p.y += dy;
        }
    };
    for (const key of ['a', 'b', 'c', 'p'])
        mv(e[key]);
    for (const key of ['points', 'controlPoints', 'fitPoints'])
        for (const p of e[key] || [])
            mv(p);
    for (const l of e.loops || [])
        for (const p of l.points || [])
            mv(p);
    if (e.type === 'INSERT') {
        e.x += dx;
        e.y += dy;
        for (const a of e.attributes || [])
            moveEntity(a, dx, dy);
    }
    e.dirty = true;
}
function transformEntity(e, m) {
    const apply = p => {
        if (p)
            Object.assign(p, transform(p, m));
    };
    for (const key of ['a', 'b', 'c', 'p'])
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
        e.start += rot * Math.PI / 180;
        e.end += rot * Math.PI / 180;
        if (m[0] * m[3] - m[1] * m[2] < 0) {
            e.start = -e.start;
            e.end = -e.end;
            e.clockwise = !e.clockwise;
        }
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

return {uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences};
})();
// packages/dxf/src/index.js
__modules["packages/dxf/src/index.js"]=(()=>{
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
    const pairs = [], decoder = new TextDecoder('windows-1252');
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
function parseHatch(raw) {
    const loops = [];
    let i = raw.findIndex(([c]) => c === 91) + 1;
    while (i > 0 && i < raw.length) {
        if (raw[i][0] !== 92) {
            i++;
            continue;
        }
        const flags = Number(raw[i++][1]), loop = { points: [], closed: true, flags };
        if (flags & 2) {
            let n = 0;
            while (i < raw.length && raw[i][0] !== 93)
                i++;
            if (i < raw.length)
                n = Number(raw[i++][1]);
            for (let j = 0; j < n && i < raw.length; j++) {
                if (raw[i][0] !== 10)
                    break;
                const p = { x: Number(raw[i++][1]), y: 0 };
                if (raw[i]?.[0] === 20)
                    p.y = Number(raw[i++][1]);
                if (raw[i]?.[0] === 42)
                    p.bulge = Number(raw[i++][1]);
                loop.points.push(p);
            }
        }
        else {
            while (i < raw.length && raw[i][0] !== 93)
                i++;
            const n = Number(raw[i++]?.[1] || 0);
            for (let j = 0; j < n && i < raw.length; j++) {
                if (raw[i][0] !== 72)
                    break;
                const type = Number(raw[i++][1]), edge = [];
                while (i < raw.length && ![72, 92, 97, 75, 76, 98].includes(raw[i][0]))
                    edge.push(raw[i++]);
                if (type === 1)
                    loop.points.push(pt(edge, 10), pt(edge, 11));
                else if (type === 2) {
                    const c = pt(edge), r = Number(get(edge, 40, 1)), s = Number(get(edge, 50, 0)) * Math.PI / 180, e = Number(get(edge, 51, 360)) * Math.PI / 180;
                    loop.points.push(...arcPoints(c, r, s, e, .2, !get(edge, 73, 1)));
                }
            }
        }
        if (loop.points.length)
            loops.push(loop);
    }
    return loops;
}
function parseEntity(raw, diagnostics) {
    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw, handle: get(raw, 5) }, dirty: false };
    const aci = Number(get(raw, 62, 256)), trueColor = get(raw, 420);
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
            e.flags = get(raw, 70, 0);
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
            e.loops = parseHatch(raw);
            e.solid = !!get(raw, 70, 0);
            e.pattern = get(raw, 2, 'SOLID');
            diagnostics.push({ severity: 'warning', type, message: `HATCH ${e.solid ? 'solid boundary' : 'pattern'} is displayed as boundary geometry; island/pattern fidelity is not complete.` });
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
            break;
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
    if (get(raw, 210, 0) !== 0 || get(raw, 220, 0) !== 0 || get(raw, 230, 1) !== 1)
        diagnostics.push({ severity: 'warning', type, message: `${type}: non-default extrusion/OCS is not fully projected; original records retained.` });
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
    doc.layers = [];
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
            doc.layers.push({ name: n, color: get(r, 420) !== undefined ? '#' + Number(get(r, 420)).toString(16).padStart(6, '0') : aciColor(Math.abs(aci)), visible: aci >= 0 && !(get(r, 70, 0) & 1), locked: !!(get(r, 70, 0) & 4), linetype: get(r, 6, 'CONTINUOUS') });
        }
        else if (table === 'LTYPE' && t === 'LTYPE')
            doc.linetypes[get(r, 2, 'CONTINUOUS')] = all(r, 49).map(v => Math.abs(Number(v)));
    }
    if (!doc.layers.length)
        doc.layers.push({ name: '0', color: '#344755', visible: true, locked: false });
    const parseList = rs => {
        const es = [];
        let poly = null, insert = null;
        for (const raw of rs) {
            const e = parseEntity(raw, doc.importDiagnostics);
            if (e.type === 'VERTEX' && poly) {
                poly.points.push(e.p);
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
        let s = typeof v === 'number' ? Number(v.toPrecision(14)).toString() : String(v ?? '');
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
    for (const e of doc.entities)
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
        pattern.forEach((v, i) => { pair(49, Math.abs(v) * (i % 2 ? -1 : 1)); pair(74, 0); });
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
        pair(62, l.visible === false ? -7 : 7);
        pair(420, parseInt((l.color || '#344755').slice(1), 16));
        pair(6, l.linetype || 'CONTINUOUS');
    }
    pair(0, 'ENDTAB');
    pair(0, 'TABLE');
    pair(2, 'STYLE');
    pair(5, next());
    pair(330, '0');
    pair(100, 'AcDbSymbolTable');
    pair(70, 1);
    pair(0, 'STYLE');
    pair(5, next());
    pair(100, 'AcDbSymbolTableRecord');
    pair(100, 'AcDbTextStyleTableRecord');
    pair(2, 'STANDARD');
    pair(70, 0);
    pair(40, 0);
    pair(41, 1);
    pair(50, 0);
    pair(71, 0);
    pair(42, 2.5);
    pair(3, 'txt');
    pair(4, '');
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
        pair(5, next());
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
        else if (e.color && e.color !== 'BYLAYER') {
            pair(62, 7);
            pair(420, parseInt(e.color.slice(1), 16));
        }
        if (e.hidden)
            pair(60, 1);
        if (e.lineweight > 0)
            pair(370, e.lineweight);
        if (e.dash?.length)
            pair(6, 'CC_DASH_' + e.dash.join('_'));
        else if (e.linetype && e.linetype !== 'BYLAYER')
            pair(6, e.linetype);
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
        if (e.type === 'HATCH') {
            for (const l of e.loops || [])
                emit({ type: 'LWPOLYLINE', points: l.points, closed: true, layer: e.layer, color: e.color }, owner);
            return;
        }
        const type = e.type === 'POLYLINE' ? 'LWPOLYLINE' : e.type;
        header(e, type, owner);
        switch (type) {
            case 'LINE':
                pair(100, 'AcDbLine');
                pp(10, e.a);
                pp(11, e.b);
                break;
            case 'LWPOLYLINE':
                pair(100, 'AcDbPolyline');
                pair(90, e.points.length);
                pair(70, e.closed ? 1 : 0);
                if (e.constantWidth)
                    pair(43, e.constantWidth);
                for (const p of e.points) {
                    pair(10, p.x);
                    pair(20, p.y);
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
                pair(7, 'STANDARD');
                if (e.align && e.align !== 'left') {
                    pair(72, e.align === 'center' ? 1 : 2);
                    pp(11, e.p);
                }
                if (type === 'TEXT')
                    pair(100, 'AcDbText');
                else {
                    pair(100, type === 'ATTRIB' ? 'AcDbAttribute' : 'AcDbAttributeDefinition');
                    pair(2, e.attributeTag || 'TAG');
                    if (type === 'ATTDEF')
                        pair(3, 'Equipment tag');
                    pair(70, e.invisible ? 1 : 0);
                }
                break;
            case 'MTEXT':
                pair(100, 'AcDbMText');
                pp(10, e.p);
                pair(40, e.height || 12);
                pair(41, e.mtextWidth || 200);
                pair(71, e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1);
                pair(1, e.text || '');
                pair(50, e.rotation || 0);
                break;
            case 'POINT':
                pair(100, 'AcDbPoint');
                pp(10, e.p);
                break;
            case 'SOLID':
            case 'TRACE':
            case '3DFACE':
                pair(100, type === '3DFACE' ? 'AcDbFace' : 'AcDbTrace');
                for (const [i, j] of [[0, 0], [1, 1], [2, 3], [3, 2]])
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
        const m = {};
        if (e.id)
            m.id = e.id;
        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked'])
            if (e[k] !== undefined)
                m[k] = e[k];
        meta(m);
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
function exportReport(doc) { const unsupported = doc.entities.filter(e => e.unsupported), hatches = doc.entities.filter(e => e.type === 'HATCH'), dims = doc.entities.filter(e => e.type === 'DIMENSION' && !e.block); return { format: 'ASCII DXF R2010', unsupported: unsupported.map(e => ({ id: e.id, type: e.type })), warnings: [...(unsupported.length ? [`${unsupported.length} unsupported entities omitted from normalized export. Use Original DXF to retain every record.`] : []), ...(hatches.length ? [`${hatches.length} hatches exported as boundaries; fills/patterns are not retained.`] : []), ...(dims.length ? [`${dims.length} authored dimensions exported as visible line/text geometry.`] : []), ...(Object.keys(doc.rawSections || {}).length ? ['Original OBJECTS and other opaque sections are not regenerated.'] : [])], originalAvailable: !!doc.source }; }

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
