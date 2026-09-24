import { ocsTransform, hatchRegionContours, hatchPatternSegments, widePolylineContours, signedDashPattern, layoutCadText } from './fidelity.js';
import { matrix, compose, identity, transform, bounds, union, emptyBounds, arcPoints, tessellatePolyline, splinePoints, TAU, distance, lerp, add, mul, normalize, sub, validBounds } from '@conduitcad/geometry';
export function textLayout(text, measure) { return layoutCadText(text, measure); }
export function objectCoordinateTransform(normal, elevation) { return ocsTransform(normal, elevation); }
let sequence = 0;
export const uid = (prefix = 'e') => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export function createDocument(name = 'Untitled drawing') { return { schema: 'conduitcad/1', name, units: 'mm', version: 0, entities: [], blocks: {}, layers: [{ name: '0', color: '#344755', visible: true, locked: false }, { name: 'Equipment', color: '#355463', visible: true, locked: false }, { name: 'Process', color: '#147c77', visible: true, locked: false }, { name: 'Instruments', color: '#9b7246', visible: true, locked: false, dash: [5, 4] }, { name: 'Electrical', color: '#6477ba', visible: true, locked: false }, { name: 'Annotations', color: '#71808a', visible: true, locked: false }], linetypes: { CONTINUOUS: [], DASHED: [8, 4], CENTER: [12, 3, 2, 3], HIDDEN: [4, 3] }, parameters: { grid: '10', pipeWidth: '2', valveSize: '64' }, constraints: [], metadata: { author: '', description: '' }, activeLayout: 'Model', layouts: ['Model'], importDiagnostics: [] }; }
export function validateDocument(doc) {
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
export function entity(type, props = {}) { return { id: uid(), type, layer: '0', ...props }; }
export const line = (a, b, props = {}) => entity('LINE', { a: { ...a }, b: { ...b }, ...props });
export const polyline = (points, closed = false, props = {}) => entity('LWPOLYLINE', { points: points.map(p => ({ ...p })), closed, ...props });
export const circle = (c, r, props = {}) => entity('CIRCLE', { c: { ...c }, r, ...props });
export const text = (p, value, height = 14, props = {}) => entity('TEXT', { p: { ...p }, text: value, height, rotation: 0, ...props });
export const rect = (x, y, w, h, props = {}) => polyline([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, props);
export function layerFor(e, doc) { return doc.layers.find(l => l.name === (e.layer || '0')) || doc.layers[0]; }
export function isVisible(e, doc) { return !e.hidden && layerFor(e, doc)?.visible !== false && (e.layout || 'Model') === (doc.activeLayout || 'Model'); }
export function isLocked(e, doc) { return !!e.locked || !!layerFor(e, doc)?.locked; }
export function cleanText(value = '') { return String(value).replace(/\\P/g, '\n').replace(/\\U\+([0-9a-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀').replace(/\\[ACFHQTW][^;]*;/g, '').replace(/\\[LlOoKk]/g, '').replace(/\\S([^;]+);/g, (_, s) => s.replace(/[\/#^]/g, '/')).replace(/[{}]/g, '').replace(/\\~/g, ' '); }
export function resolveStyle(e, doc, parentStyle = null, parentLayer = null) {
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
export function entityGeometry(e, doc, options = {}) {
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
            paths.push({ points: pts.map(p => transform(p, m)), closed, fill, ...style, ...extra, entityId: e.id });
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
export function entityBounds(e, doc) {
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
export function documentBounds(doc) {
    let b = emptyBounds();
    for (const e of doc.entities)
        if (isVisible(e, doc))
            b = union(b, entityBounds(e, doc));
    return validBounds(b) ? b : { minX: -100, minY: -100, maxX: 100, maxY: 100 };
}
export function ports(e, doc) {
    if (e.type !== 'INSERT')
        return [];
    const block = doc.blocks[e.block], base = block?.base || { x: 0, y: 0 };
    const m = compose(matrix(e), matrix({ x: -base.x, y: -base.y }));
    return (block?.ports || []).map(p => { const q = transform(p, m), v = transform({ x: p.x + (p.dx || 0), y: p.y + (p.dy || 0) }, m); return { ...p, ...q, dx: v.x - q.x, dy: v.y - q.y, entityId: e.id }; });
}
export function moveEntity(e, dx, dy) {
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
export function transformEntity(e, m) {
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
export function explodeEntity(e, doc) { const g = entityGeometry(e, doc, { tolerance: .05 }); return [...g.paths.map(p => polyline(p.points, p.closed, { layer: e.layer, color: p.color, width: p.width, dash: p.dash, fill: p.fill })), ...g.texts.map(t => text(t.p, t.text, t.height, { layer: e.layer, color: t.color, rotation: t.rotation, align: t.align }))]; }
export function detachReferences(doc, deleted) {
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
