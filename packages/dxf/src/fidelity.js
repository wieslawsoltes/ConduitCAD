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
export function parseHatchData(raw) {
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
export function readEntityFidelity(e, raw, diagnostics, options = {}) {
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
        if (e.gradient && ((get(e.gradient,470,'LINEAR')!=='LINEAR') || +get(e.gradient,461,0)!==0 || e.gradient.filter(p=>p[0]===421).length!==2)) diagnostics.push({ severity: 'warning', type: 'HATCH', message: 'This gradient distribution is retained but not rendered; the preview supports unshifted two-stop LINEAR gradients.' });
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
export function writeHatchData(e, pair) {
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
