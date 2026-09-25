import { entity, polyline, circle, editDimension } from '@conduitcad/model';
import { distance, bounds, TAU } from '@conduitcad/geometry';

const EPS = 1e-8;
const LIMIT = 1e12;
const MAX_POINTS = 512;
const normAngle = a => ((a % TAU) + TAU) % TAU;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const copy = value => JSON.parse(JSON.stringify(value));
function scalar(n, label, positive = false) {
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > LIMIT || (positive && n <= EPS))
        throw new Error(`${label} must be ${positive ? 'positive and ' : ''}finite within the drawing range`);
    return n;
}
function point(p) {
    if (!p || (p.z !== undefined && (!Number.isFinite(p.z) || Math.abs(p.z) > EPS))) throw new Error('Drawing tools require XY points at Z=0');
    return { x: scalar(p.x, 'X'), y: scalar(p.y, 'Y') };
}
function distinct(a, b) {
    if (distance(a, b) <= EPS) throw new Error('Choose distinct points');
}
function unit(v) { return mul(v, 1 / scalar(Math.hypot(v.x, v.y), 'Direction length', true)); }
const definition = (id, label, group, icon, steps, extra = {}) => Object.freeze({ id, label, group, icon, steps: Object.freeze(steps), count: steps.length, minPoints: steps.length, ...extra });
/** Descriptors are shared by headless hosts, menus, prompts and interaction tests. */
export const DRAWING_TOOLS = Object.freeze([
    definition('arc', 'Arc · 3 points', 'Curves', 'arc', ['Start point', 'Point on the arc', 'End point']),
    definition('arc-center', 'Arc · center / start / end', 'Curves', 'arc', ['Center', 'Start point', 'End direction · counterclockwise']),
    definition('circle-3p', 'Circle · 3 points', 'Curves', 'circle', ['First point', 'Second point', 'Third point']),
    definition('circle-diameter', 'Circle · diameter', 'Curves', 'circle', ['First diameter endpoint', 'Opposite endpoint'], { drag: true }),
    definition('ellipse', 'Ellipse', 'Curves', 'ellipse', ['Center', 'First axis endpoint', 'Other semi-axis · perpendicular distance']),
    definition('ellipse-arc', 'Elliptical arc', 'Curves', 'ellipse', ['Center', 'First axis endpoint', 'Other semi-axis', 'Start direction', 'End direction · counterclockwise']),
    definition('spline', 'Spline · through points', 'Curves', 'spline', ['First interpolation point', 'Next point · Finish or Close'], { count: null, minPoints: 2, canClose: true }),
    definition('bezier', 'Cubic Bézier · controls', 'Curves', 'spline', ['Start point', 'First control point', 'Second control point', 'End point']),
    definition('polygon', 'Regular polygon', 'Shapes & fills', 'polygon', ['Center', 'Vertex / side midpoint'], { drag: true, options: true }),
    definition('donut', 'Donut', 'Shapes & fills', 'donut', ['Center', 'Inner radius point · center for a disc', 'Outer radius point']),
    definition('solid', 'Filled triangle / quad', 'Shapes & fills', 'solid', ['First corner', 'Next corner · Finish after 3 or 4'], { count: null, minPoints: 3, maxPoints: 4 }),
    definition('face', 'Planar 3DFACE', 'Shapes & fills', 'solid', ['First corner', 'Next corner · Finish after 3 or 4'], { count: null, minPoints: 3, maxPoints: 4 }),
    definition('hatch', 'Hatch boundary', 'Shapes & fills', 'hatch', ['First boundary point', 'Next point · Finish closes boundary'], { count: null, minPoints: 3, options: true }),
    definition('wipeout', 'Wipeout mask', 'Shapes & fills', 'wipeout', ['First boundary point', 'Next point · Finish closes mask'], { count: null, minPoints: 3 }),
    definition('point', 'Point', 'Construction', 'point', ['Point location']),
    definition('ray', 'Ray', 'Construction', 'ray', ['Origin', 'Direction point'], { drag: true }),
    definition('xline', 'Infinite construction line', 'Construction', 'xline', ['Point on line', 'Direction point'], { drag: true }),
    definition('mtext', 'Multiline text', 'Annotation', 'mtext', ['Text-box first corner', 'Opposite corner'], { drag: true, options: true }),
    definition('leader', 'Leader', 'Annotation', 'leader', ['Arrow tip', 'Next vertex · Finish leader'], { count: null, minPoints: 2 }),
    definition('dim-aligned', 'Aligned · place dimension line', 'Dimensions', 'dimension', ['First witness', 'Second witness', 'Dimension-line location']),
    definition('dim-horizontal', 'Horizontal dimension', 'Dimensions', 'dimension', ['First witness', 'Second witness', 'Dimension-line location']),
    definition('dim-vertical', 'Vertical dimension', 'Dimensions', 'dimension', ['First witness', 'Second witness', 'Dimension-line location']),
    definition('dim-radius', 'Radius dimension', 'Dimensions', 'dimension', ['Center', 'Circumference point']),
    definition('dim-diameter', 'Diameter dimension', 'Dimensions', 'dimension', ['First diameter endpoint', 'Opposite endpoint']),
    definition('dim-angular', 'Angular · 3 points + label', 'Dimensions', 'dimension', ['Angle vertex', 'First ray point', 'Second ray point', 'Dimension arc location']),
    definition('dim-angular-lines', 'Angular · two lines', 'Dimensions', 'dimension', ['Line 1 start', 'Line 1 end', 'Line 2 start', 'Line 2 end', 'Dimension arc location']),
    definition('dim-ordinate-x', 'Ordinate X', 'Dimensions', 'dimension', ['Datum origin', 'Measured point', 'Leader endpoint']),
    definition('dim-ordinate-y', 'Ordinate Y', 'Dimensions', 'dimension', ['Datum origin', 'Measured point', 'Leader endpoint'])
]);
export function drawingTool(id) { return DRAWING_TOOLS.find(t => t.id === id) || null; }

/** Translation/scale-conditioned circumcircle, avoiding cancellation at survey coordinates. */
export function circumcircle(a, b, c) {
    [a, b, c] = [a, b, c].map(point);
    distinct(a, b); distinct(b, c); distinct(a, c);
    const scale = Math.max(distance(a, b), distance(a, c)), u = mul(sub(b, a), 1 / scale), v = mul(sub(c, a), 1 / scale);
    const d = 2 * cross(u, v);
    if (Math.abs(d) < 1e-10) throw new Error('Three nearly collinear points do not define a stable circle');
    const uu = dot(u, u), vv = dot(v, v), local = { x: (v.y * uu - u.y * vv) / d, y: (u.x * vv - v.x * uu) / d };
    const center = point(add(a, mul(local, scale)));
    return { c: center, r: scalar(Math.hypot(local.x, local.y) * scale, 'Radius', true) };
}

/** A clamped, piecewise cubic B-spline interpolating each supplied point.
 * Centered finite-chord tangents (one-sided endpoints), not an AutoCAD FIT algorithm.
 * Internal knots have multiplicity three; paired derivatives give C1 joins.
 */
export function interpolatingSpline(input, closed = false, props = {}) {
    let pts = input.map(point);
    if (closed && pts.length > 1 && distance(pts[0], pts.at(-1)) < EPS) pts.pop();
    if (pts.length < (closed ? 3 : 2) || pts.length > MAX_POINTS) throw new Error('Spline requires 2–512 points (at least 3 when closed)');
    for (let i = 1; i < pts.length; i++) distinct(pts[i - 1], pts[i]);
    const tangent = i => closed ? mul(sub(pts[(i + 1) % pts.length], pts[(i + pts.length - 1) % pts.length]), .5)
        : i === 0 ? sub(pts[1], pts[0]) : i === pts.length - 1 ? sub(pts[i], pts[i - 1]) : mul(sub(pts[i + 1], pts[i - 1]), .5);
    const controls = [pts[0]], knots = [0, 0, 0, 0], segments = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segments; i++) {
        const j = (i + 1) % pts.length;
        controls.push(point(add(pts[i], mul(tangent(i), 1 / 3))), point(sub(pts[j], mul(tangent(j), 1 / 3))), pts[j]);
        if (i + 1 < segments) knots.push(i + 1, i + 1, i + 1);
    }
    knots.push(segments, segments, segments, segments);
    return entity('SPLINE', { ...props, degree: 3, controlPoints: controls, knots, fitPoints: [], weights: [], closed, splineFlags: 8 });
}

/** Simple planar polygon validation, with local coordinates and bounded work. */
export function validateBoundary(input) {
    const pts = input.map(point);
    if (pts.length > 3 && distance(pts[0], pts.at(-1)) <= EPS) pts.pop();
    if (pts.length < 3 || pts.length > MAX_POINTS) throw new Error('Boundary requires 3–512 corners');
    const local = pts.map(p => sub(p, pts[0])), size = Math.max(1, ...local.map(p => Math.hypot(p.x, p.y)));
    const q = local.map(p => mul(p, 1 / size)), tolerance = 1e-12;
    const orient = (a, b, c) => cross(sub(b, a), sub(c, a));
    const on = (a, b, p) => Math.abs(orient(a, b, p)) <= tolerance && p.x >= Math.min(a.x, b.x) - tolerance && p.x <= Math.max(a.x, b.x) + tolerance && p.y >= Math.min(a.y, b.y) - tolerance && p.y <= Math.max(a.y, b.y) + tolerance;
    let area = 0;
    for (let i = 0; i < q.length; i++) {
        distinct(pts[i], pts[(i + 1) % pts.length]);
        const a = q[i], b = q[(i + 1) % q.length]; area += cross(a, b);
        // Adjacent collinear edges may continue, but may not double back.
        const prev = q[(i + q.length - 1) % q.length];
        if (Math.abs(orient(prev, a, b)) <= tolerance && dot(sub(prev, a), sub(b, a)) > tolerance) throw new Error('Boundary edges overlap');
        for (let j = i + 2; j < q.length; j++) {
            if (i === 0 && j === q.length - 1) continue;
            const c = q[j], d = q[(j + 1) % q.length], ab1 = orient(a, b, c), ab2 = orient(a, b, d), cd1 = orient(c, d, a), cd2 = orient(c, d, b);
            if ((ab1 * ab2 < 0 && cd1 * cd2 < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)) throw new Error('Boundary crosses or touches itself');
        }
    }
    if (Math.abs(area) <= tolerance) throw new Error('Boundary has zero area');
    return pts;
}

export function hatchPattern(options = {}) {
    const pattern = options.pattern ?? 'solid';
    if (!['solid', 'lines', 'cross'].includes(pattern)) throw new Error('Choose solid, lines or cross hatch');
    const angle = scalar(options.angle ?? 45, 'Hatch angle') * Math.PI / 180;
    const spacing = scalar(options.spacing ?? 10, 'Hatch spacing', true);
    const patternLines = pattern === 'solid' ? [] : [angle, ...(pattern === 'cross' ? [angle + Math.PI / 2] : [])].map(a => ({ angle: a, base: { x: 0, y: 0 }, offset: { x: -Math.sin(a) * spacing, y: Math.cos(a) * spacing }, dashes: [] }));
    return { solid: pattern === 'solid', pattern: pattern === 'solid' ? 'SOLID' : 'USER', patternType: 0, patternAngle: angle * 180 / Math.PI, patternScale: 1, patternDouble: false, patternLines, hatchStyle: 0, associative: false };
}
function hatch(loops, options, props) { return entity('HATCH', { ...props, ...hatchPattern(options), loops, elevation: 0 }); }

/** Native boundary copying: does not explode circles, ellipses or polyline bulges.
 * Regions use even-odd islands and are intentionally non-associative snapshots.
 */
export function hatchFromEntities(entities, doc, options = {}, props = {}) {
    if (!entities.length || entities.length > 64) throw new Error('Select 1–64 closed boundaries');
    const loops = entities.map(e => {
        const n = e.extrusion;
        if ((n && (Math.abs(n.x || 0) > EPS || Math.abs(n.y || 0) > EPS || Math.abs((n.z ?? 1) - 1) > EPS)) || Math.abs(e.elevation || e.c?.z || 0) > EPS)
            throw new Error('Hatch boundaries must lie in the XY plane at Z=0');
        if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.closed && !(e.flags & (8 | 16 | 64))) {
            if (!Array.isArray(e.points) || e.points.length < 2 || e.points.length > MAX_POINTS) throw new Error('Polyline boundary requires 2–512 vertices');
            if (e.constantWidth || e.points.some(p => p.startWidth || p.endWidth)) throw new Error('Wide polylines are not single hatch boundaries');
            if (!e.points.some(p => p.bulge)) validateBoundary(e.points);
            return { closed: true, flags: 2, points: e.points.map(p => ({ ...point(p), ...(p.bulge ? { bulge: scalar(p.bulge, 'Bulge') } : {}) })) };
        }
        if (e.type === 'CIRCLE') return { flags: 0, edges: [{ type: 2, c: point(e.c), r: scalar(e.r, 'Radius', true), start: 0, end: TAU, ccw: true }] };
        if (e.type === 'ELLIPSE' && Math.abs((e.end ?? TAU) - (e.start ?? 0) - TAU) < EPS) {
            scalar(Math.hypot(e.major.x,e.major.y), 'Ellipse major axis', true);
            if (e.ratio > 1) throw new Error('Ellipse major/minor ratio is invalid');
            return { flags: 0, edges: [{ type: 3, c: point(e.c), major: point(e.major), ratio: scalar(e.ratio, 'Ratio', true), start: 0, end: TAU, ccw: true }] };
        }
        throw new Error(`${e.type} is not a supported closed hatch boundary; use a circle, full ellipse or closed planar polyline`);
    });
    return hatch(loops, options, props);
}

/** Build a native entity without mutating the document. Geometric angles are radians internally. */
export function createDrawingEntity(id, input, options = {}, props = {}, doc = {}) {
    const tool = drawingTool(id);
    if (!tool) throw new Error(`Unknown drawing tool: ${id}`);
    if (!Array.isArray(input) || input.length < tool.minPoints || input.length > (tool.count ?? tool.maxPoints ?? MAX_POINTS)) throw new Error(`Invalid point count for ${tool.label}`);
    const pts = input.map(point), [a, b, c, d, f] = pts;
    let result;
    switch (id) {
        case 'point': result = entity('POINT', { ...props, p: a }); break;
        case 'arc': case 'circle-3p': {
            const circleData = circumcircle(a, b, c);
            if (id === 'circle-3p') result = circle(circleData.c, circleData.r, props);
            else {
                const start = normAngle(angle(circleData.c, a)), through = normAngle(angle(circleData.c, b) - start), end = normAngle(angle(circleData.c, c));
                result = entity('ARC', { ...props, ...circleData, start, end, clockwise: through > normAngle(end - start) });
            }
            break;
        }
        case 'arc-center': distinct(a, b); distinct(a, c); result = entity('ARC', { ...props, c: a, r: distance(a, b), start: normAngle(angle(a, b)), end: normAngle(angle(a, c)) });
            if (Math.abs(normAngle(result.end - result.start)) < EPS) throw new Error('Arc end direction equals its start direction');
            break;
        case 'circle-diameter': distinct(a, b); result = circle(mul(add(a, b), .5), distance(a, b) / 2, props); break;
        case 'ellipse': case 'ellipse-arc': {
            const axis = sub(b, a), majorLength = scalar(distance(a, b), 'First semi-axis', true), u = unit(axis), v = { x: -u.y, y: u.x };
            const minorLength = scalar(Math.abs(dot(sub(c, a), v)), 'Other semi-axis', true);
            // Canonical major/minor contract, even when the second picked semi-axis is longer.
            const swap = minorLength > majorLength, major = swap ? mul(v, minorLength) : axis;
            const ratio = swap ? majorLength / minorLength : minorLength / majorLength;
            const param = p => { distinct(a, p); const q = sub(p, a); return normAngle(Math.atan2(dot(q, v) / minorLength, dot(q, u) / majorLength) - (swap ? Math.PI / 2 : 0)); };
            const start = id === 'ellipse-arc' ? param(d) : 0, end = id === 'ellipse-arc' ? param(f) : TAU;
            if (id === 'ellipse-arc' && normAngle(end - start) < EPS) throw new Error('Elliptical arc requires different start/end directions');
            result = entity('ELLIPSE', { ...props, c: a, major, ratio, start, end }); break;
        }
        case 'spline': result = interpolatingSpline(pts, !!options.closed, props); break;
        case 'bezier':
            if (pts.every(p => distance(a, p) < EPS)) throw new Error('Bézier controls cannot all coincide');
            result = entity('SPLINE', { ...props, degree: 3, controlPoints: pts, knots: [0, 0, 0, 0, 1, 1, 1, 1], fitPoints: [], weights: [], closed: false, splineFlags: 8 }); break;
        case 'polygon': {
            const n = options.sides ?? 6;
            if (!Number.isInteger(n) || n < 3 || n > MAX_POINTS) throw new Error('Polygon sides must be an integer from 3 to 512');
            distinct(a, b);
            const circumscribed = options.circumscribed === true, r = distance(a, b) / (circumscribed ? Math.cos(Math.PI / n) : 1), theta = angle(a, b) + (circumscribed ? Math.PI / n : 0);
            result = polyline(Array.from({ length: n }, (_, i) => point(add(a, { x: r * Math.cos(theta + i * TAU / n), y: r * Math.sin(theta + i * TAU / n) }))), true, props); break;
        }
        case 'donut': {
            const inner = distance(a, b), outer = distance(a, c);
            if (outer <= inner + EPS) throw new Error('Outer radius must be larger than inner radius');
            const r = (outer + inner) / 2;
            result = polyline([{ x: a.x - r, y: a.y, bulge: 1 }, { x: a.x + r, y: a.y, bulge: 1 }], true, { ...props, constantWidth: outer - inner }); break;
        }
        case 'solid': case 'face': result = entity(id === 'solid' ? 'SOLID' : '3DFACE', { ...props, points: validateBoundary(pts) }); break;
        case 'hatch': result = hatch([{ flags: 2, closed: true, points: validateBoundary(pts) }], options, props); break;
        case 'wipeout': {
            const polygon = validateBoundary(pts), bb = bounds(polygon), scale = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
            result = entity('WIPEOUT', { ...props, p: { x: bb.minX, y: bb.minY }, uPixel: { x: scale, y: 0, z: 0 }, vPixel: { x: 0, y: scale, z: 0 }, imageSize: { x: 1, y: 1 }, boundaryType: 2,
                boundary: [...polygon, polygon[0]].map(p => ({ x: (p.x - bb.minX) / scale - .5, y: .5 - (p.y - bb.minY) / scale })), clipping: true, imageFlags: 7 }); break;
        }
        case 'ray': case 'xline': distinct(a, b); result = entity(id.toUpperCase(), { ...props, p: a, direction: unit(sub(b, a)) }); break;
        case 'mtext': {
            const width = scalar(Math.abs(b.x - a.x), 'Text-box width', true), height = scalar(options.height ?? 12, 'Text height', true), text = options.text ?? 'Multiline text';
            if (typeof text !== 'string' || !text.trim() || text.length > 16000) throw new Error('Enter 1–16000 text characters');
            result = entity('MTEXT', { ...props, p: { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) }, text: text.replace(/\r\n?/g, '\n').replace(/\n/g, '\\P'), mtextWidth: width, height, attachment: 1, rotation: 0, styleName: 'STANDARD' }); break;
        }
        case 'leader':
            for (let i = 1; i < pts.length; i++) distinct(pts[i - 1], pts[i]);
            result = entity('LEADER', { ...props, points: pts, arrow: true, spline: false, dimstyle: 'STANDARD' }); break;
        default: {
            const base = { ...props, dimstyle: 'STANDARD', dimension: { version: 1 }, text: '<>', height: options.height ?? 12 };
            if (['dim-aligned', 'dim-horizontal', 'dim-vertical'].includes(id)) {
                distinct(a, b);
                const theta = id === 'dim-horizontal' ? 0 : id === 'dim-vertical' ? Math.PI / 2 : angle(a, b), normal = { x: -Math.sin(theta), y: Math.cos(theta) };
                result = entity('DIMENSION', { ...base, dimtype: id === 'dim-aligned' ? 33 : 32, dimensionAngle: theta * 180 / Math.PI, a, b, offset: dot(sub(c, a), normal) });
            } else if (id === 'dim-radius' || id === 'dim-diameter') result = entity('DIMENSION', { ...base, dimtype: id === 'dim-radius' ? 36 : 35, definitionPoint: a, defpoint4: b });
            else if (id === 'dim-angular') result = entity('DIMENSION', { ...base, dimtype: 37, defpoint4: a, a: b, b: c, definitionPoint: d });
            else if (id === 'dim-angular-lines') result = entity('DIMENSION', { ...base, dimtype: 34, a, b, defpoint4: c, definitionPoint: d, defpoint5: f });
            else result = entity('DIMENSION', { ...base, dimtype: id === 'dim-ordinate-x' ? 102 : 38, definitionPoint: a, a: b, b: c });
            editDimension(result, doc);
        }
    }
    // Check derived as well as input coordinates. Keep the factory's data ownership independent.
    for(const p of [result.c,result.p,result.a,result.b,result.definitionPoint,result.defpoint4,result.defpoint5,...(result.points||[]),...(result.controlPoints||[])])if(p)point(p);
    if(result.r!==undefined)scalar(result.r,'Radius',true);
    if(result.major)point(result.major);
    return result;
}

/** Reusable point-driven state machine. Failed completion never consumes the point. */
export class DrawingSession {
    constructor(id, options = {}) {
        const tool = drawingTool(id);
        if (!tool) throw new Error(`Unknown drawing tool: ${id}`);
        this.tool = tool; this.options = copy(options); this.points = [];
    }
    get prompt() { return this.tool.steps[Math.min(this.points.length, this.tool.steps.length - 1)]; }
    get canFinish() { return this.tool.count === null && this.points.length >= this.tool.minPoints; }
    add(p, props = {}, doc = {}) {
        const candidate = [...this.points, point(p)], max = this.tool.count ?? this.tool.maxPoints ?? MAX_POINTS;
        if (candidate.length > max) throw new Error(`Point budget (${max}) exceeded`);
        if (this.tool.count !== null && candidate.length === this.tool.count) return createDrawingEntity(this.tool.id, candidate, this.options, props, doc);
        // Immediate rejection of repeated path points makes touch retry predictable.
        if (this.tool.count === null && this.points.length) distinct(this.points.at(-1), candidate.at(-1));
        this.points.push(candidate.at(-1)); return null;
    }
    finish(closed = false, props = {}, doc = {}) {
        if (!this.canFinish) throw new Error(`Choose at least ${this.tool.minPoints} points`);
        if (closed && !this.tool.canClose) throw new Error('This tool does not support Close');
        return createDrawingEntity(this.tool.id, this.points, { ...this.options, closed }, props, doc);
    }
    undo() { return this.points.pop() || null; }
    preview(p, props = {}, doc = {}) {
        const q = point(p), candidate = [...this.points, q];
        try {
            if (candidate.length >= this.tool.minPoints && candidate.length <= (this.tool.count ?? this.tool.maxPoints ?? MAX_POINTS)) return createDrawingEntity(this.tool.id, candidate, this.options, props, doc);
        } catch { /* An invalid hover produces only a construction guide; committed errors are not swallowed. */ }
        if (!this.points.length) return entity('POINT', { ...props, p: q });
        return polyline(candidate, false, props);
    }
}

/** Absolute, relative Cartesian, or relative polar coordinates. Evaluator is supplied by the host. */
export function parseDrawingPoint(source, previous = { x: 0, y: 0 }, evaluate = Number) {
    if (typeof source !== 'string' || source.length > 1000) throw new Error('Invalid point input');
    const relative = source.trim().startsWith('@'), s = source.trim().replace(/^@/, '');
    if (s.includes('<')) {
        if (!relative) throw new Error('Polar coordinates use @length<angle-in-degrees');
        const parts = s.split('<');
        if (parts.length !== 2 || parts.some(p => !p.trim())) throw new Error('Use @length<angle');
        const r = scalar(evaluate(parts[0]), 'Polar length'), a = scalar(evaluate(parts[1]), 'Polar angle') * Math.PI / 180;
        return point(add(point(previous), { x: r * Math.cos(a), y: r * Math.sin(a) }));
    }
    const parts = s.split(',');
    if (parts.length !== 2 || parts.some(p => !p.trim())) throw new Error('Use x,y or @dx,dy');
    const p = point({ x: evaluate(parts[0]), y: evaluate(parts[1]) });
    return relative ? point(add(point(previous), p)) : p;
}
