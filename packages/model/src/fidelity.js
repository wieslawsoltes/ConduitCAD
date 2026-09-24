import { arcPoints, tessellatePolyline, splinePoints, bounds, distance, TAU } from '@conduitcad/geometry';
const EPS = 1e-9;
/** XY projection of Autodesk's arbitrary-axis OCS basis. */
export function ocsTransform(normal = { x: 0, y: 0, z: 1 }, elevation = 0) {
    const length = Math.hypot(normal.x || 0, normal.y || 0, normal.z ?? 1);
    if (length < EPS) throw new Error('Invalid zero-length DXF extrusion normal');
    const n = { x: (normal.x || 0) / length, y: (normal.y || 0) / length, z: (normal.z ?? 1) / length };
    const a = Math.abs(n.x) < 1 / 64 && Math.abs(n.y) < 1 / 64 ? { x: n.z, y: 0, z: -n.x } : { x: -n.y, y: n.x, z: 0 };
    const l = Math.hypot(a.x, a.y, a.z); a.x /= l; a.y /= l; a.z /= l;
    const b = { x: n.y * a.z - n.z * a.y, y: n.z * a.x - n.x * a.z };
    return [a.x, a.y, b.x, b.y, n.x * elevation, n.y * elevation];
}
export function ellipseEdgePoints(edge, tolerance = .25) {
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
export function hatchContours(e, tolerance = .25) {
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
export function inPolygon(p, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
export function hatchRegionContours(e, tolerance) {
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
export function hatchPatternSegments(e, contours, { maxLines = 20000, maxSegments = 100000 } = {}) {
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
export function widePolylineContours(e, tolerance = .25) {
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
export function signedDashPattern(pattern = []) {
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
export function cadTextRuns(value, initial = {}) {
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
export function layoutCadText(t, measure) {
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
