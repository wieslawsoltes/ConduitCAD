globalThis.__CONDUIT_DXF_WORKER__="'use strict';\n(()=>{\nconst __modules=Object.create(null);\n// packages/geometry/src/index.js\n__modules[\"packages/geometry/src/index.js\"]=(()=>{\n/** Double-precision planar geometry. DXF coordinates are right-handed, Y up. */\nconst EPS = 1e-9;\nconst TAU = Math.PI * 2;\nconst clamp = (v, a, b) => Math.min(b, Math.max(a, v));\nconst point = (x = 0, y = 0) => ({ x, y });\nconst add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });\nconst sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });\nconst mul = (a, s) => ({ x: a.x * s, y: a.y * s });\nconst dot = (a, b) => a.x * b.x + a.y * b.y;\nconst cross = (a, b) => a.x * b.y - a.y * b.x;\nconst length = a => Math.hypot(a.x, a.y);\nconst distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);\nconst normalize = a => mul(a, 1 / (length(a) || 1));\nconst lerp = (a, b, t) => add(a, mul(sub(b, a), t));\nconst almost = (a, b, tolerance = EPS) => Math.abs(a - b) <= tolerance;\nconst equalPoint = (a, b, tolerance = EPS) => distance(a, b) <= tolerance;\nconst identity = () => [1, 0, 0, 1, 0, 0];\nconst transform = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });\nfunction matrix({ x = 0, y = 0, rotation = 0, sx = 1, sy = sx } = {}) { const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * sx, s * sx, -s * sy, c * sy, x, y]; }\nfunction compose(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }\nfunction inverse(m) {\n    const d = m[0] * m[3] - m[1] * m[2];\n    if (Math.abs(d) < EPS)\n        throw new Error('Singular transform');\n    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];\n}\nfunction bounds(points) {\n    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };\n    for (const p of points) {\n        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))\n            continue;\n        b.minX = Math.min(b.minX, p.x);\n        b.minY = Math.min(b.minY, p.y);\n        b.maxX = Math.max(b.maxX, p.x);\n        b.maxY = Math.max(b.maxY, p.y);\n    }\n    return b;\n}\nconst emptyBounds = () => bounds([]);\nconst validBounds = b => Number.isFinite(b.minX) && b.minX <= b.maxX && b.minY <= b.maxY;\nconst inflate = (b, n) => ({ minX: b.minX - n, minY: b.minY - n, maxX: b.maxX + n, maxY: b.maxY + n });\nconst intersects = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;\nconst contains = (b, p) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;\nconst union = (a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) });\nconst center = b => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });\nfunction projectPoint(p, a, b, segment = true) { const v = sub(b, a), n = dot(v, v); const t = n < EPS * EPS ? 0 : dot(sub(p, a), v) / n; return lerp(a, b, segment ? clamp(t, 0, 1) : t); }\nconst distanceToSegment = (p, a, b) => distance(p, projectPoint(p, a, b));\nfunction lineIntersection(a, b, c, d, segments = true) {\n    const r = sub(b, a), s = sub(d, c), det = cross(r, s);\n    if (Math.abs(det) <= EPS * Math.max(1, length(r) * length(s)))\n        return null;\n    const q = sub(c, a), t = cross(q, s) / det, u = cross(q, r) / det;\n    if (segments && (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS))\n        return null;\n    return { ...lerp(a, b, t), t, u };\n}\nfunction segmentIntersectsBox(a, b, box) {\n    if (contains(box, a) || contains(box, b))\n        return true;\n    const p = [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }];\n    return p.some((v, i) => lineIntersection(a, b, v, p[(i + 1) % 4]));\n}\nfunction polygonContains(p, points) {\n    let inside = false;\n    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {\n        const a = points[i], b = points[j];\n        if (distanceToSegment(p, a, b) < EPS)\n            return true;\n        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)\n            inside = !inside;\n    }\n    return inside;\n}\nfunction polygonArea(points) {\n    let n = 0;\n    for (let i = 0; i < points.length; i++)\n        n += cross(points[i], points[(i + 1) % points.length]);\n    return n / 2;\n}\nfunction polylineLength(points, closed = false) {\n    let n = 0;\n    for (let i = 1; i < points.length; i++)\n        n += distance(points[i - 1], points[i]);\n    if (closed && points.length > 1)\n        n += distance(points.at(-1), points[0]);\n    return n;\n}\nfunction simplifyOrthogonal(points) {\n    const r = [];\n    for (const p of points) {\n        if (r.length && equalPoint(r.at(-1), p))\n            continue;\n        if (r.length > 1) {\n            const a = r.at(-2), b = r.at(-1);\n            if (Math.abs(cross(sub(b, a), sub(p, b))) < EPS && dot(sub(b, a), sub(p, b)) >= 0)\n                r.pop();\n        }\n        r.push({ ...p });\n    }\n    return r;\n}\nfunction arcPoints(c, r, start = 0, end = TAU, tolerance = .2, clockwise = false) {\n    if (!Number.isFinite(r) || r <= 0)\n        return [c];\n    let sweep = end - start;\n    if (clockwise) {\n        while (sweep > 0)\n            sweep -= TAU;\n    }\n    else {\n        while (sweep < 0)\n            sweep += TAU;\n    }\n    if (Math.abs(sweep) < EPS)\n        sweep = clockwise ? -TAU : TAU;\n    const step = 2 * Math.acos(clamp(1 - Math.max(tolerance, 1e-7) / r, -1, 1));\n    const n = clamp(Math.ceil(Math.abs(sweep) / Math.max(step, .0005)), 2, 8192);\n    return Array.from({ length: n + 1 }, (_, i) => ({ x: c.x + r * Math.cos(start + sweep * i / n), y: c.y + r * Math.sin(start + sweep * i / n) }));\n}\nfunction bulgeArc(a, b, bulge) {\n    if (Math.abs(bulge) < EPS || distance(a, b) < EPS)\n        return null;\n    const chord = sub(b, a), mid = lerp(a, b, .5), c = add(mid, mul({ x: -chord.y, y: chord.x }, (1 - bulge * bulge) / (4 * bulge)));\n    return { c, r: distance(a, c), start: Math.atan2(a.y - c.y, a.x - c.x), sweep: 4 * Math.atan(bulge), clockwise: bulge < 0 };\n}\nfunction tessellatePolyline(points, closed = false, tolerance = .2) {\n    if (!points.length)\n        return [];\n    const out = [];\n    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {\n        const a = points[i], b = points[(i + 1) % points.length], arc = bulgeArc(a, b, a.bulge || 0);\n        if (arc)\n            out.push(...arcPoints(arc.c, arc.r, arc.start, arc.start + arc.sweep, tolerance, arc.clockwise).slice(0, -1));\n        else\n            out.push(a);\n    }\n    out.push(closed ? points[0] : points.at(-1));\n    return out;\n}\n/** Rational de Boor evaluation; input is never mutated. */\nfunction nurbsPoint(control, degree, knots, t, weights = []) {\n    const n = control.length - 1, p = Math.min(degree, n);\n    if (n < 0)\n        return point();\n    if (p < 1)\n        return { ...control[0] };\n    if (knots.length < n + p + 2)\n        throw new Error('Invalid NURBS knot vector');\n    const lo = knots[p], hi = knots[n + 1];\n    t = clamp(t, lo, hi);\n    let k = n;\n    if (t < hi) {\n        k = p;\n        while (k < n && !(t >= knots[k] && t < knots[k + 1]))\n            k++;\n    }\n    const d = [];\n    for (let j = 0; j <= p; j++) {\n        const i = k - p + j, w = weights[i] ?? 1;\n        d.push([control[i].x * w, control[i].y * w, w]);\n    }\n    for (let r = 1; r <= p; r++)\n        for (let j = p; j >= r; j--) {\n            const i = k - p + j, den = knots[i + p - r + 1] - knots[i], a = Math.abs(den) < EPS ? 0 : (t - knots[i]) / den;\n            d[j] = d[j].map((v, q) => (1 - a) * d[j - 1][q] + a * v);\n        }\n    const w = d[p][2];\n    return Math.abs(w) > EPS ? { x: d[p][0] / w, y: d[p][1] / w } : { ...control[Math.min(n, k)] };\n}\nfunction splinePoints(e, tolerance = .2) {\n    const cp = e.controlPoints || [];\n    if (cp.length < 2)\n        return cp;\n    const p = Math.min(e.degree || 3, cp.length - 1), n = cp.length;\n    let knots = e.knots;\n    if (!knots || knots.length < n + p + 1) {\n        knots = [];\n        for (let i = 0; i < n + p + 1; i++)\n            knots.push(i <= p ? 0 : i >= n ? 1 : (i - p) / (n - p));\n    }\n    const start = knots[p], end = knots[n], out = [nurbsPoint(cp, p, knots, start, e.weights)];\n    function split(t0, a, t1, b, depth) {\n        const tm = (t0 + t1) / 2, m = nurbsPoint(cp, p, knots, tm, e.weights), q1 = nurbsPoint(cp, p, knots, (t0 + tm) / 2, e.weights), q3 = nurbsPoint(cp, p, knots, (tm + t1) / 2, e.weights);\n        if (depth < 12 && Math.max(distanceToSegment(m, a, b), distanceToSegment(q1, a, b), distanceToSegment(q3, a, b)) > tolerance) {\n            split(t0, a, tm, m, depth + 1);\n            split(tm, m, t1, b, depth + 1);\n        }\n        else\n            out.push(b);\n    }\n    for (let i = p; i < n; i++) {\n        if (knots[i + 1] > knots[i])\n            split(knots[i], out.at(-1), knots[i + 1], nurbsPoint(cp, p, knots, knots[i + 1], e.weights), 0);\n    }\n    return out;\n}\n/** Planar polyline offset with bounded miters; not a polygon Boolean engine. */\nfunction offsetPolyline(points, amount, closed = false, miterLimit = 6) {\n    if (points.length < 2)\n        throw new Error('Offset requires two vertices');\n    const seg = [];\n    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {\n        const a = points[i], b = points[(i + 1) % points.length], v = normalize(sub(b, a)), o = mul({ x: -v.y, y: v.x }, amount);\n        seg.push([add(a, o), add(b, o)]);\n    }\n    const out = [];\n    for (let i = 0; i < points.length; i++) {\n        if (!closed && i === 0) {\n            out.push(seg[0][0]);\n            continue;\n        }\n        if (!closed && i === points.length - 1) {\n            out.push(seg.at(-1)[1]);\n            continue;\n        }\n        const prev = seg[(i - 1 + seg.length) % seg.length], next = seg[i % seg.length], hit = lineIntersection(...prev, ...next, false);\n        if (hit && distance(hit, points[i]) <= Math.abs(amount) * miterLimit + EPS)\n            out.push({ x: hit.x, y: hit.y });\n        else\n            out.push(prev[1], next[0]);\n    }\n    return out;\n}\nfunction filletLines(a, b, c, d, radius) {\n    const hit = lineIntersection(a, b, c, d, false);\n    if (!hit || radius <= 0)\n        throw new Error('Fillet needs intersecting nonparallel lines and positive radius');\n    const u = normalize(sub(distance(a, hit) > distance(b, hit) ? a : b, hit)), v = normalize(sub(distance(c, hit) > distance(d, hit) ? c : d, hit)), theta = Math.acos(clamp(dot(u, v), -1, 1));\n    if (theta < EPS || Math.abs(theta - Math.PI) < EPS)\n        throw new Error('Degenerate fillet');\n    const t = radius / Math.tan(theta / 2), p = add(hit, mul(u, t)), q = add(hit, mul(v, t)), cen = add(hit, mul(normalize(add(u, v)), radius / Math.sin(theta / 2)));\n    return { p, q, c: cen, r: radius, start: Math.atan2(p.y - cen.y, p.x - cen.x), end: Math.atan2(q.y - cen.y, q.x - cen.x), clockwise: cross(sub(p, cen), sub(q, cen)) < 0 };\n}\nfunction snapCandidates(entity) {\n    switch (entity.type) {\n        case 'LINE': return [{ ...entity.a, kind: 'endpoint' }, { ...entity.b, kind: 'endpoint' }, { ...lerp(entity.a, entity.b, .5), kind: 'midpoint' }];\n        case 'CIRCLE':\n        case 'ARC': {\n            const onArc = a => {\n                if (entity.type === 'CIRCLE')\n                    return true;\n                const norm = x => ((x % TAU) + TAU) % TAU;\n                return entity.clockwise ? norm(entity.start - a) <= norm(entity.start - entity.end) + EPS : norm(a - entity.start) <= norm(entity.end - entity.start) + EPS;\n            };\n            const at = a => ({ x: entity.c.x + entity.r * Math.cos(a), y: entity.c.y + entity.r * Math.sin(a) });\n            return [{ ...entity.c, kind: 'center' }, ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].filter(onArc).map(a => ({ ...at(a), kind: 'quadrant' })), ...(entity.type === 'ARC' ? [{ ...at(entity.start), kind: 'endpoint' }, { ...at(entity.end), kind: 'endpoint' }] : [])];\n        }\n        case 'LWPOLYLINE': return entity.points.flatMap((p, i) => [{ ...p, kind: 'endpoint' }, ...(i < entity.points.length - 1 || entity.closed ? [{ ...lerp(p, entity.points[(i + 1) % entity.points.length], .5), kind: 'midpoint' }] : [])]);\n        case 'INSERT': return [{ x: entity.x, y: entity.y, kind: 'insertion' }];\n        default: return [];\n    }\n}\n\nreturn {EPS,TAU,clamp,point,add,sub,mul,dot,cross,length,distance,normalize,lerp,almost,equalPoint,identity,transform,matrix,compose,inverse,bounds,emptyBounds,validBounds,inflate,intersects,contains,union,center,projectPoint,distanceToSegment,lineIntersection,segmentIntersectsBox,polygonContains,polygonArea,polylineLength,simplifyOrthogonal,arcPoints,bulgeArc,tessellatePolyline,nurbsPoint,splinePoints,offsetPolyline,filletLines,snapCandidates};\n})();\n// packages/model/src/index.js\n__modules[\"packages/model/src/index.js\"]=(()=>{\nconst {matrix, compose, identity, transform, bounds, union, emptyBounds, arcPoints, tessellatePolyline, splinePoints, TAU, distance, lerp, add, mul, normalize, sub, validBounds} = __modules[\"packages/geometry/src/index.js\"];\nlet sequence = 0;\nconst uid = (prefix = 'e') => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;\nconst clone = value => JSON.parse(JSON.stringify(value));\nfunction createDocument(name = 'Untitled drawing') { return { schema: 'conduitcad/1', name, units: 'mm', version: 0, entities: [], blocks: {}, layers: [{ name: '0', color: '#344755', visible: true, locked: false }, { name: 'Equipment', color: '#355463', visible: true, locked: false }, { name: 'Process', color: '#147c77', visible: true, locked: false }, { name: 'Instruments', color: '#9b7246', visible: true, locked: false, dash: [5, 4] }, { name: 'Electrical', color: '#6477ba', visible: true, locked: false }, { name: 'Annotations', color: '#71808a', visible: true, locked: false }], linetypes: { CONTINUOUS: [], DASHED: [8, 4], CENTER: [12, 3, 2, 3], HIDDEN: [4, 3] }, parameters: { grid: '10', pipeWidth: '2', valveSize: '64' }, constraints: [], metadata: { author: '', description: '' }, activeLayout: 'Model', layouts: ['Model'], importDiagnostics: [] }; }\nfunction validateDocument(doc) {\n    if (!doc || doc.schema !== 'conduitcad/1' || !Array.isArray(doc.entities) || !doc.blocks || !Array.isArray(doc.layers))\n        throw new Error('Not a Conduit CAD project');\n    if (doc.entities.length > 1000000)\n        throw new Error('Entity safety limit exceeded');\n    const ids = new Set();\n    for (const e of doc.entities) {\n        if (!e.id || ids.has(e.id))\n            throw new Error('Missing or duplicate entity ID');\n        ids.add(e.id);\n        if (!e.type)\n            throw new Error('Missing entity type');\n    }\n    return doc;\n}\nfunction entity(type, props = {}) { return { id: uid(), type, layer: '0', ...props }; }\nconst line = (a, b, props = {}) => entity('LINE', { a: { ...a }, b: { ...b }, ...props });\nconst polyline = (points, closed = false, props = {}) => entity('LWPOLYLINE', { points: points.map(p => ({ ...p })), closed, ...props });\nconst circle = (c, r, props = {}) => entity('CIRCLE', { c: { ...c }, r, ...props });\nconst text = (p, value, height = 14, props = {}) => entity('TEXT', { p: { ...p }, text: value, height, rotation: 0, ...props });\nconst rect = (x, y, w, h, props = {}) => polyline([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, props);\nfunction layerFor(e, doc) { return doc.layers.find(l => l.name === (e.layer || '0')) || doc.layers[0]; }\nfunction isVisible(e, doc) { return !e.hidden && layerFor(e, doc)?.visible !== false && (e.layout || 'Model') === (doc.activeLayout || 'Model'); }\nfunction isLocked(e, doc) { return !!e.locked || !!layerFor(e, doc)?.locked; }\nfunction cleanText(value = '') { return String(value).replace(/\\\\P/g, '\\n').replace(/\\\\U\\+([0-9a-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀').replace(/\\\\[ACFHQTW][^;]*;/g, '').replace(/\\\\[LlOoKk]/g, '').replace(/\\\\S([^;]+);/g, (_, s) => s.replace(/[\\/#^]/g, '/')).replace(/[{}]/g, '').replace(/\\\\~/g, ' '); }\nfunction resolveStyle(e, doc, parentStyle = null, parentLayer = null) { const layer = (e.layer === '0' && parentLayer) ? parentLayer : layerFor(e, doc); return { color: e.color === 'BYBLOCK' ? parentStyle?.color || layer?.color || '#344755' : (!e.color || e.color === 'BYLAYER' ? layer?.color || '#344755' : e.color), width: e.width ?? (e.lineweight > 0 ? Math.max(1, e.lineweight / 35) : 1.5), dash: e.dash ?? (e.linetype === 'BYBLOCK' ? parentStyle?.dash : null) ?? doc.linetypes?.[e.linetype] ?? doc.linetypes?.[layer?.linetype] ?? layer?.dash ?? [], opacity: e.opacity ?? 1 }; }\n/** Returns portable paths/text. Blocks retain their native definitions in the model. */\nfunction entityGeometry(e, doc, options = {}) {\n    const { tolerance = .25, depth = 0, parentStyle = null, parentLayer = null } = options, m = options.matrix || identity();\n    if (depth > 24)\n        return { paths: [], texts: [] };\n    const curveTolerance = tolerance / Math.max(1e-9, Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));\n    const style = resolveStyle(e, doc, parentStyle, parentLayer), paths = [], texts = [];\n    const path = (pts, closed = false, fill = null) => {\n        if (pts.length > 1)\n            paths.push({ points: pts.map(p => transform(p, m)), closed, fill, ...style, entityId: e.id });\n    };\n    const label = (p, value, height, rotation = 0, align = 'left') => { const q = transform(p, m), sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]); texts.push({ p: q, text: cleanText(value), height: height * sy, rotation: rotation + Math.atan2(m[1], m[0]) * 180 / Math.PI, align, color: style.color, entityId: e.id, font: e.font || 'sans-serif', widthFactor: (e.widthFactor || 1) * sx / (sy || 1) }); };\n    switch (e.type) {\n        case 'LINE':\n            path([e.a, e.b]);\n            break;\n        case 'LWPOLYLINE':\n        case 'POLYLINE':\n            path(tessellatePolyline(e.points || [], !!e.closed, curveTolerance), !!e.closed, e.fill);\n            break;\n        case 'CIRCLE':\n            path(arcPoints(e.c, e.r, 0, TAU, curveTolerance), true, e.fill);\n            break;\n        case 'ARC':\n            path(arcPoints(e.c, e.r, e.start, e.end, curveTolerance, !!e.clockwise));\n            break;\n        case 'ELLIPSE': {\n            const a = e.major || { x: e.rx || 1, y: 0 }, r = e.ratio ?? 1, s = e.start ?? 0;\n            let sweep = (e.end ?? TAU) - s;\n            while (sweep <= 0)\n                sweep += TAU;\n            const n = Math.min(4096, Math.max(24, Math.ceil(sweep * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(curveTolerance, .0000001)))));\n            path(Array.from({ length: n + 1 }, (_, i) => { const t = s + sweep * i / n; return { x: e.c.x + a.x * Math.cos(t) - a.y * r * Math.sin(t), y: e.c.y + a.y * Math.cos(t) + a.x * r * Math.sin(t) }; }), Math.abs(sweep - TAU) < 1e-6);\n            break;\n        }\n        case 'SPLINE':\n            path(splinePoints(e, curveTolerance), !!e.closed);\n            break;\n        case 'TEXT':\n        case 'MTEXT':\n        case 'ATTRIB':\n        case 'ATTDEF':\n            if (!e.invisible)\n                label(e.p, e.text || '', e.height || 12, e.rotation || 0, e.align || 'left');\n            break;\n        case 'POINT': {\n            const r = 1.5;\n            path([{ x: e.p.x - r, y: e.p.y }, { x: e.p.x + r, y: e.p.y }]);\n            path([{ x: e.p.x, y: e.p.y - r }, { x: e.p.x, y: e.p.y + r }]);\n            break;\n        }\n        case 'SOLID':\n        case 'TRACE':\n        case '3DFACE':\n            path(e.points || [], true, e.type === '3DFACE' ? null : style.color);\n            break;\n        case 'HATCH':\n            for (const loop of e.loops || [])\n                path(tessellatePolyline(loop.points || [], true, curveTolerance), true, e.solid ? style.color : null);\n            break;\n        case 'DIMENSION': {\n            if (e.block && doc.blocks[e.block]) {\n                const g = entityGeometry({ ...e, type: 'INSERT', x: 0, y: 0 }, doc, { ...options, depth: depth + 1 });\n                for (const p of g.paths)\n                    paths.push(p);\n                for (const t of g.texts)\n                    texts.push(t);\n                break;\n            }\n            const a = e.a, b = e.b;\n            if (!a || !b)\n                break;\n            const n = normalize({ x: -(b.y - a.y), y: b.x - a.x }), off = e.offset ?? 30, p = add(a, mul(n, off)), q = add(b, mul(n, off));\n            path([a, add(p, mul(n, 6))]);\n            path([b, add(q, mul(n, 6))]);\n            path([p, q]);\n            const u = normalize(sub(q, p));\n            for (const [v, dir] of [[p, 1], [q, -1]]) {\n                path([add(v, add(mul(u, dir * 7), mul(n, 3))), v, add(v, add(mul(u, dir * 7), mul(n, -3)))]);\n            }\n            label(add(lerp(p, q, .5), mul(n, 5)), e.text && e.text !== '<>' ? e.text : distance(a, b).toFixed(1), e.height || 12, Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, 'center');\n            break;\n        }\n        case 'INSERT': {\n            const block = doc.blocks[e.block];\n            if (!block)\n                break;\n            const base = block.base || { x: 0, y: 0 }, rows = Math.min(1000, e.rows || 1), cols = Math.min(1000, e.columns || 1);\n            if (rows * cols > 10000)\n                break;\n            // MINSERT spacing belongs to the rotated placement grid, not the scaled block.\n            const placement = matrix({ x: e.x || 0, y: e.y || 0, rotation: e.rotation || 0 });\n            const shape = compose(matrix({ sx: e.sx ?? 1, sy: e.sy ?? e.sx ?? 1 }), matrix({ x: -base.x, y: -base.y }));\n            const gridRotation = matrix({ rotation: e.rotation || 0 }), locations = new Set();\n            for (let row = 0; row < rows; row++)\n                for (let col = 0; col < cols; col++) {\n                    const offset = { x: col * (e.columnSpacing || 0), y: row * (e.rowSpacing || 0) };\n                    const key = offset.x + ':' + offset.y;\n                    if (locations.has(key))\n                        continue;\n                    locations.add(key);\n                    const mm = compose(m, compose(placement, compose(matrix(offset), shape)));\n                    const attributeOffset = transform(offset, gridRotation);\n                    for (const attribute of e.attributes || []) {\n                        if (attribute.invisible)\n                            continue;\n                        const g = entityGeometry(attribute, doc, { ...options, matrix: compose(m, matrix(attributeOffset)), depth: depth + 1 });\n                        for (const t of g.texts)\n                            texts.push({ ...t, entityId: e.id });\n                    }\n                    for (const child of block.entities || []) {\n                        if (child.type === 'ATTDEF' || child.hidden)\n                            continue;\n                        const cl = (child.layer === '0') ? (e.layer === '0' && parentLayer ? parentLayer : layerFor(e, doc)) : layerFor(child, doc);\n                        if (cl?.visible === false)\n                            continue;\n                        const g = entityGeometry(child, doc, { matrix: mm, tolerance, depth: depth + 1, parentStyle: style, parentLayer: cl });\n                        for (const p of g.paths)\n                            paths.push({ ...p, entityId: e.id });\n                        for (const t of g.texts)\n                            texts.push({ ...t, entityId: e.id });\n                    }\n                }\n            if (e.tag && block.symbol) {\n                const p = { x: e.x || 0, y: (e.y || 0) - Math.abs((e.sy ?? e.sx ?? 1) * (block.symbol.labelOffset || 55)) };\n                label(p, e.tag, e.tagHeight || 12, 0, 'center');\n            }\n            break;\n        }\n    }\n    if (e.connector && e.points?.length > 1) {\n        const ps = e.points;\n        const b = ps.at(-1), a = ps.at(-2), u = normalize(sub(a, b)), n = { x: -u.y, y: u.x };\n        if (e.connector.arrow !== 'none')\n            path([add(b, add(mul(u, 9), mul(n, 4))), b, add(b, add(mul(u, 9), mul(n, -4)))]);\n        if (e.label) {\n            const mid = ps[Math.floor((ps.length - 1) / 2)], next = ps[Math.min(ps.length - 1, Math.floor((ps.length - 1) / 2) + 1)];\n            label(add(lerp(mid, next, .5), { x: 0, y: 8 }), e.label, 11, 0, 'center');\n        }\n    }\n    return { paths, texts };\n}\nfunction entityBounds(e, doc) {\n    const g = entityGeometry(e, doc, { tolerance: 1 }), pts = g.paths.flatMap(p => p.points);\n    for (const t of g.texts) {\n        const w = t.text.split('\\n').reduce((a, s) => Math.max(a, s.length), 0) * t.height * .62, h = t.height * t.text.split('\\n').length;\n        const tm = matrix({ x: t.p.x, y: t.p.y, rotation: t.rotation }), x = t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0;\n        pts.push(...[{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: h }, { x, y: h }].map(p => transform(p, tm)));\n    }\n    if (!pts.length && e.type === 'INSERT')\n        pts.push({ x: e.x, y: e.y });\n    return bounds(pts);\n}\nfunction documentBounds(doc) {\n    let b = emptyBounds();\n    for (const e of doc.entities)\n        if (isVisible(e, doc))\n            b = union(b, entityBounds(e, doc));\n    return validBounds(b) ? b : { minX: -100, minY: -100, maxX: 100, maxY: 100 };\n}\nfunction ports(e, doc) {\n    if (e.type !== 'INSERT')\n        return [];\n    const block = doc.blocks[e.block], base = block?.base || { x: 0, y: 0 };\n    const m = compose(matrix(e), matrix({ x: -base.x, y: -base.y }));\n    return (block?.ports || []).map(p => { const q = transform(p, m), v = transform({ x: p.x + (p.dx || 0), y: p.y + (p.dy || 0) }, m); return { ...p, ...q, dx: v.x - q.x, dy: v.y - q.y, entityId: e.id }; });\n}\nfunction moveEntity(e, dx, dy) {\n    const mv = p => {\n        if (p) {\n            p.x += dx;\n            p.y += dy;\n        }\n    };\n    for (const key of ['a', 'b', 'c', 'p'])\n        mv(e[key]);\n    for (const key of ['points', 'controlPoints', 'fitPoints'])\n        for (const p of e[key] || [])\n            mv(p);\n    for (const l of e.loops || [])\n        for (const p of l.points || [])\n            mv(p);\n    if (e.type === 'INSERT') {\n        e.x += dx;\n        e.y += dy;\n        for (const a of e.attributes || [])\n            moveEntity(a, dx, dy);\n    }\n    e.dirty = true;\n}\nfunction transformEntity(e, m) {\n    const apply = p => {\n        if (p)\n            Object.assign(p, transform(p, m));\n    };\n    for (const key of ['a', 'b', 'c', 'p'])\n        apply(e[key]);\n    for (const key of ['points', 'controlPoints', 'fitPoints'])\n        for (const p of e[key] || [])\n            apply(p);\n    for (const l of e.loops || [])\n        for (const p of l.points || [])\n            apply(p);\n    const scale = Math.hypot(m[0], m[1]), rot = Math.atan2(m[1], m[0]) * 180 / Math.PI;\n    if (e.r)\n        e.r *= scale;\n    if (e.height)\n        e.height *= scale;\n    if (e.type === 'ARC') {\n        e.start += rot * Math.PI / 180;\n        e.end += rot * Math.PI / 180;\n        if (m[0] * m[3] - m[1] * m[2] < 0) {\n            e.start = -e.start;\n            e.end = -e.end;\n            e.clockwise = !e.clockwise;\n        }\n    }\n    if (e.type === 'INSERT') {\n        const p = transform({ x: e.x, y: e.y }, m);\n        e.x = p.x;\n        e.y = p.y;\n        e.sx = (e.sx ?? 1) * scale;\n        e.sy = (e.sy ?? 1) * scale;\n        e.rotation = (e.rotation || 0) + rot;\n    }\n    if (['TEXT', 'MTEXT'].includes(e.type))\n        e.rotation = (e.rotation || 0) + rot;\n    e.dirty = true;\n}\nfunction explodeEntity(e, doc) { const g = entityGeometry(e, doc, { tolerance: .05 }); return [...g.paths.map(p => polyline(p.points, p.closed, { layer: e.layer, color: p.color, width: p.width, dash: p.dash, fill: p.fill })), ...g.texts.map(t => text(t.p, t.text, t.height, { layer: e.layer, color: t.color, rotation: t.rotation, align: t.align }))]; }\nfunction detachReferences(doc, deleted) {\n    for (const e of doc.entities) {\n        const c = e.connector;\n        if (!c)\n            continue;\n        for (const end of ['from', 'to'])\n            if (c[end] && deleted.has(c[end].entityId))\n                c[end] = null;\n    }\n    doc.constraints = doc.constraints.filter(c => !(c.entities || [c.entityId]).some(id => deleted.has(id)));\n}\n\nreturn {uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences};\n})();\n// packages/dxf/src/index.js\n__modules[\"packages/dxf/src/index.js\"]=(()=>{\nconst {createDocument, entity, uid, cleanText, clone, entityGeometry} = __modules[\"packages/model/src/index.js\"];\nconst {TAU, arcPoints} = __modules[\"packages/geometry/src/index.js\"];\nconst NUMBER_CODES = c => (c >= 10 && c <= 59) || (c >= 110 && c <= 149) || (c >= 210 && c <= 239) || (c >= 460 && c <= 469) || (c >= 1010 && c <= 1059);\nconst INT16_CODES = c => (c >= 60 && c <= 79) || (c >= 170 && c <= 179) || (c >= 270 && c <= 289) || (c >= 370 && c <= 389) || (c >= 400 && c <= 409) || (c >= 1060 && c <= 1070);\nconst INT32_CODES = c => (c >= 90 && c <= 99) || (c >= 420 && c <= 429) || (c >= 440 && c <= 459) || c === 1071;\nconst INT64_CODES = c => c >= 160 && c <= 169;\nconst BINARY_CODES = c => (c >= 310 && c <= 319) || c === 1004;\n// Default ACI modelspace palette, verified against ezdxf 1.4.4.\n// ACI 7 follows this application's light canvas. Palette data attribution: THIRD_PARTY_NOTICES.md.\nconst ACI_PALETTE = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 10813440, 10834514, 8323072, 8339263, 4980736, 4990502, 2490368, 2495251, 16727808, 16752511, 10823936, 10839890, 8331008, 8343359, 4985600, 4992806, 2492672, 2496275, 16744192, 16760703, 10834432, 10845266, 8339200, 8347455, 4990464, 4995366, 2495232, 2497555, 16760576, 16768895, 10845184, 10850642, 8347392, 8351551, 4995328, 4997670, 2497536, 2498835, 16776960, 16777087, 10855680, 10855762, 8355584, 8355647, 5000192, 5000230, 2500096, 2500115, 12582656, 14679935, 8168704, 9545042, 6258432, 7307071, 3755008, 4344870, 1844736, 2172435, 8388352, 12582783, 5416192, 8168786, 4161280, 6258495, 2509824, 3755046, 1254912, 1844755, 4194048, 10485631, 2729216, 6792530, 2064128, 5209919, 1264640, 3099686, 599552, 1517075, 65280, 8388479, 42240, 5416274, 32512, 4161343, 19456, 2509862, 9728, 1254931, 65343, 8388511, 42281, 5416295, 32543, 4161359, 19475, 2509871, 9737, 1267735, 65407, 8388543, 42322, 5416316, 32575, 4161375, 19494, 2509881, 9747, 1267740, 65471, 8388575, 42364, 5416337, 32607, 4161391, 19513, 2509890, 9756, 1267800, 65535, 8388607, 42405, 5416357, 32639, 4161407, 19532, 2509900, 9766, 1267800, 49151, 8380415, 31909, 5411237, 24447, 4157311, 14668, 2507390, 7206, 1267800, 32767, 8372223, 21157, 5405861, 16255, 4153215, 9804, 2505086, 4902, 1252440, 16383, 8364031, 10661, 5400485, 8063, 4149119, 4940, 2502526, 2342, 1251160, 255, 8355839, 165, 5395109, 127, 4145023, 76, 2500222, 38, 1250136, 4129023, 10452991, 2687141, 6771365, 2031743, 5193599, 1245260, 3090046, 589862, 1512280, 8323327, 12550143, 5374117, 8147621, 4128895, 6242175, 2490444, 3745406, 1245222, 1839960, 12517631, 14647295, 8126629, 9523877, 6226047, 7290751, 3735628, 4335180, 1835046, 5772120, 16711935, 16744447, 10813605, 10834597, 8323199, 8339327, 4980812, 4990540, 2490406, 5772120, 16711871, 16744415, 10813564, 10834577, 8323167, 8339311, 4980793, 4990530, 2490396, 5772120, 16711807, 16744383, 10813522, 10834556, 8323135, 8339295, 4980774, 4990521, 2490387, 5772060, 16711743, 16744351, 10813481, 10834535, 8323103, 8339279, 4980755, 4990511, 2490377, 5772055, 0, 6645093, 6710886, 10066329, 13421772, 16777215];\nfunction aciColor(index) {\n    index = Math.abs(Math.trunc(index));\n    if (index === 7)\n        return '#000000';\n    return '#' + (ACI_PALETTE[index] ?? 0).toString(16).padStart(6, '0');\n}\nfunction parseAsciiPairs(source, { maxPairs = 8000000 } = {}) {\n    const lines = source.replace(/^\\uFEFF/, '').split(/\\r\\n|\\n|\\r/), pairs = [];\n    for (let i = 0; i + 1 < lines.length; i += 2) {\n        if (pairs.length >= maxPairs)\n            throw new Error('DXF group-code safety limit exceeded');\n        const code = Number(lines[i].trim());\n        if (!Number.isInteger(code) || code < 0 || code > 1071)\n            throw new Error(`Invalid DXF group code at line ${i + 1}`);\n        const raw = lines[i + 1], value = INT64_CODES(code) ? raw.trim() : (NUMBER_CODES(code) || INT16_CODES(code) || INT32_CODES(code) || INT64_CODES(code) || (code >= 290 && code <= 299)) ? Number(raw.trim()) : raw;\n        if (INT64_CODES(code) && !/^[-+]?\\d+$/.test(value))\n            throw new Error('Invalid DXF int64 value');\n        if (typeof value === 'number' && !Number.isFinite(value))\n            throw new Error(`Invalid DXF numeric value at line ${i + 2}`);\n        pairs.push([code, value]);\n    }\n    if (!pairs.some(([c, v]) => c === 0 && String(v).trim() === 'EOF'))\n        throw new Error('DXF EOF marker missing (file may be truncated)');\n    return pairs;\n}\nfunction parseBinaryPairs(input, { maxPairs = 8000000 } = {}) {\n    const u = input instanceof Uint8Array ? input : new Uint8Array(input), v = new DataView(u.buffer, u.byteOffset, u.byteLength);\n    let pos = 22;\n    const pairs = [], decoder = new TextDecoder('windows-1252');\n    const r12 = u[23] !== 0;\n    const need = n => {\n        if (pos + n > u.length)\n            throw new Error('Truncated binary DXF');\n    };\n    while (pos < u.length) {\n        if (pairs.length >= maxPairs)\n            throw new Error('DXF safety limit exceeded');\n        need(r12 ? 1 : 2);\n        let code;\n        if (r12) {\n            code = u[pos++];\n            if (code === 255) {\n                need(2);\n                code = v.getUint16(pos, true);\n                pos += 2;\n            }\n        }\n        else {\n            code = v.getUint16(pos, true);\n            pos += 2;\n        }\n        let value;\n        if (NUMBER_CODES(code)) {\n            need(8);\n            value = v.getFloat64(pos, true);\n            pos += 8;\n        }\n        else if (INT16_CODES(code)) {\n            need(2);\n            value = v.getInt16(pos, true);\n            pos += 2;\n        }\n        else if (INT32_CODES(code)) {\n            need(4);\n            value = v.getInt32(pos, true);\n            pos += 4;\n        }\n        else if (INT64_CODES(code)) {\n            need(8);\n            const n = v.getBigInt64(pos, true);\n            value = n.toString();\n            pos += 8;\n        }\n        else if (code >= 290 && code <= 299) {\n            need(1);\n            value = u[pos++];\n        }\n        else if (BINARY_CODES(code)) {\n            need(1);\n            const count = u[pos++];\n            need(count);\n            value = Array.from(u.subarray(pos, pos + count), n => n.toString(16).padStart(2, '0')).join('');\n            pos += count;\n        }\n        else {\n            const start = pos;\n            while (pos < u.length && u[pos] !== 0)\n                pos++;\n            need(1);\n            value = decoder.decode(u.subarray(start, pos));\n            pos++;\n        }\n        if (typeof value === 'number' && !Number.isFinite(value))\n            throw new Error('Non-finite binary DXF value');\n        pairs.push([code, value]);\n        if (code === 0 && value === 'EOF')\n            break;\n    }\n    if (!pairs.some(([c, v]) => c === 0 && v === 'EOF'))\n        throw new Error('Binary DXF EOF marker missing');\n    return pairs;\n}\nconst get = (r, c, d = undefined) => r.find(x => x[0] === c)?.[1] ?? d;\nconst all = (r, c) => r.filter(x => x[0] === c).map(x => x[1]);\nconst pt = (r, c = 10) => ({ x: Number(get(r, c, 0)), y: Number(get(r, c + 10, 0)), z: Number(get(r, c + 20, 0)) });\nconst points = (r, c = 10) => {\n    const p = [];\n    let current;\n    for (const [code, v] of r) {\n        if (code === c) {\n            current = { x: Number(v), y: 0 };\n            p.push(current);\n        }\n        else if (current && code === c + 10)\n            current.y = Number(v);\n        else if (current && code === c + 20)\n            current.z = Number(v);\n        else if (current && code === 42 && c === 10)\n            current.bulge = Number(v);\n    }\n    return p;\n};\nconst records = pairs => {\n    const result = [];\n    let r = [];\n    for (const pair of pairs) {\n        if (pair[0] === 0 && r.length) {\n            result.push(r);\n            r = [];\n        }\n        r.push(pair);\n    }\n    if (r.length)\n        result.push(r);\n    return result;\n};\nfunction metadata(raw) {\n    let active = false, s = '';\n    for (const [c, v] of raw) {\n        if (c === 1001)\n            active = v === 'CONDUITCAD';\n        else if (active && c === 1000)\n            s += v;\n    }\n    if (!s)\n        return {};\n    try {\n        const data = JSON.parse(s);\n        return data && typeof data === 'object' ? data : {};\n    }\n    catch {\n        return {};\n    }\n}\nfunction parseHatch(raw) {\n    const loops = [];\n    let i = raw.findIndex(([c]) => c === 91) + 1;\n    while (i > 0 && i < raw.length) {\n        if (raw[i][0] !== 92) {\n            i++;\n            continue;\n        }\n        const flags = Number(raw[i++][1]), loop = { points: [], closed: true, flags };\n        if (flags & 2) {\n            let n = 0;\n            while (i < raw.length && raw[i][0] !== 93)\n                i++;\n            if (i < raw.length)\n                n = Number(raw[i++][1]);\n            for (let j = 0; j < n && i < raw.length; j++) {\n                if (raw[i][0] !== 10)\n                    break;\n                const p = { x: Number(raw[i++][1]), y: 0 };\n                if (raw[i]?.[0] === 20)\n                    p.y = Number(raw[i++][1]);\n                if (raw[i]?.[0] === 42)\n                    p.bulge = Number(raw[i++][1]);\n                loop.points.push(p);\n            }\n        }\n        else {\n            while (i < raw.length && raw[i][0] !== 93)\n                i++;\n            const n = Number(raw[i++]?.[1] || 0);\n            for (let j = 0; j < n && i < raw.length; j++) {\n                if (raw[i][0] !== 72)\n                    break;\n                const type = Number(raw[i++][1]), edge = [];\n                while (i < raw.length && ![72, 92, 97, 75, 76, 98].includes(raw[i][0]))\n                    edge.push(raw[i++]);\n                if (type === 1)\n                    loop.points.push(pt(edge, 10), pt(edge, 11));\n                else if (type === 2) {\n                    const c = pt(edge), r = Number(get(edge, 40, 1)), s = Number(get(edge, 50, 0)) * Math.PI / 180, e = Number(get(edge, 51, 360)) * Math.PI / 180;\n                    loop.points.push(...arcPoints(c, r, s, e, .2, !get(edge, 73, 1)));\n                }\n            }\n        }\n        if (loop.points.length)\n            loops.push(loop);\n    }\n    return loops;\n}\nfunction parseEntity(raw, diagnostics) {\n    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw, handle: get(raw, 5) }, dirty: false };\n    const aci = Number(get(raw, 62, 256)), trueColor = get(raw, 420);\n    if (trueColor !== undefined)\n        e.color = '#' + Number(trueColor).toString(16).padStart(6, '0');\n    else if (aci === 0)\n        e.color = 'BYBLOCK';\n    else if (aci !== 256)\n        e.color = aciColor(aci);\n    e.lineweight = Number(get(raw, 370, -1));\n    e.linetype = get(raw, 6, 'BYLAYER');\n    if (get(raw, 60, 0))\n        e.hidden = true;\n    switch (type) {\n        case 'LINE':\n            e.a = pt(raw);\n            e.b = pt(raw, 11);\n            break;\n        case 'LWPOLYLINE':\n            e.points = points(raw);\n            e.closed = !!(get(raw, 70, 0) & 1);\n            e.constantWidth = get(raw, 43, 0);\n            break;\n        case 'POLYLINE':\n            e.points = [];\n            e.closed = !!(get(raw, 70, 0) & 1);\n            e.flags = get(raw, 70, 0);\n            break;\n        case 'CIRCLE':\n        case 'ARC':\n            e.c = pt(raw);\n            e.r = Number(get(raw, 40, 1));\n            if (type === 'ARC') {\n                e.start = Number(get(raw, 50, 0)) * Math.PI / 180;\n                e.end = Number(get(raw, 51, 360)) * Math.PI / 180;\n            }\n            break;\n        case 'ELLIPSE':\n            e.c = pt(raw);\n            e.major = pt(raw, 11);\n            e.ratio = Number(get(raw, 40, 1));\n            e.start = Number(get(raw, 41, 0));\n            e.end = Number(get(raw, 42, TAU));\n            break;\n        case 'SPLINE':\n            e.degree = Number(get(raw, 71, 3));\n            e.controlPoints = points(raw);\n            e.fitPoints = points(raw, 11);\n            e.knots = all(raw, 40).map(Number);\n            e.weights = all(raw, 41).map(Number);\n            e.closed = !!(get(raw, 70, 0) & 1);\n            break;\n        case 'POINT':\n            e.p = pt(raw);\n            break;\n        case 'TEXT':\n        case 'MTEXT':\n        case 'ATTRIB':\n        case 'ATTDEF':\n            e.p = pt(raw);\n            e.text = type === 'MTEXT' ? all(raw, 3).join('') + get(raw, 1, '') : get(raw, 1, '');\n            e.height = Number(get(raw, 40, 12));\n            e.rotation = Number(get(raw, 50, 0));\n            e.align = get(raw, 72, 0) === 1 ? 'center' : get(raw, 72, 0) === 2 ? 'right' : 'left';\n            if (type === 'MTEXT') {\n                const a = Number(get(raw, 71, 1));\n                e.align = [2, 5, 8].includes(a) ? 'center' : [3, 6, 9].includes(a) ? 'right' : 'left';\n                if (get(raw, 11) !== undefined)\n                    e.rotation = Math.atan2(get(raw, 21, 0), get(raw, 11, 1)) * 180 / Math.PI;\n                e.mtextWidth = get(raw, 41, 0);\n            }\n            if (['ATTRIB', 'ATTDEF'].includes(type)) {\n                e.attributeTag = get(raw, 2, '');\n                e.invisible = !!(get(raw, 70, 0) & 1);\n            }\n            e.widthFactor = Number(get(raw, 41, 1));\n            break;\n        case 'INSERT':\n            e.block = get(raw, 2, '');\n            e.x = get(raw, 10, 0);\n            e.y = get(raw, 20, 0);\n            e.z = get(raw, 30, 0);\n            e.sx = get(raw, 41, 1);\n            e.sy = get(raw, 42, 1);\n            e.sz = get(raw, 43, 1);\n            e.rotation = get(raw, 50, 0);\n            e.columns = get(raw, 70, 1);\n            e.rows = get(raw, 71, 1);\n            e.columnSpacing = get(raw, 44, 0);\n            e.rowSpacing = get(raw, 45, 0);\n            e.attributes = [];\n            break;\n        case 'SOLID':\n        case 'TRACE':\n        case '3DFACE':\n            e.points = [pt(raw, 10), pt(raw, 11), pt(raw, 13), pt(raw, 12)];\n            break;\n        case 'HATCH':\n            e.loops = parseHatch(raw);\n            e.solid = !!get(raw, 70, 0);\n            e.pattern = get(raw, 2, 'SOLID');\n            diagnostics.push({ severity: 'warning', type, message: `HATCH ${e.solid ? 'solid boundary' : 'pattern'} is displayed as boundary geometry; island/pattern fidelity is not complete.` });\n            break;\n        case 'DIMENSION':\n            e.block = get(raw, 2);\n            e.a = pt(raw, 13);\n            e.b = pt(raw, 14);\n            e.text = get(raw, 1, '<>');\n            break;\n        case 'VERTEX':\n            e.p = pt(raw);\n            e.p.bulge = get(raw, 42, 0);\n            break;\n        case 'SEQEND': break;\n        default:\n            e.unsupported = true;\n            diagnostics.push({ severity: 'warning', type, message: `${type}: retained in original source; no editable display implementation.` });\n    }\n    const meta = metadata(raw);\n    if (typeof meta.id === 'string' && meta.id.length <= 160)\n        e.id = meta.id;\n    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked'])\n        if (k in meta)\n            e[k] = meta[k];\n    if (get(raw, 210, 0) !== 0 || get(raw, 220, 0) !== 0 || get(raw, 230, 1) !== 1)\n        diagnostics.push({ severity: 'warning', type, message: `${type}: non-default extrusion/OCS is not fully projected; original records retained.` });\n    return e;\n}\nfunction base64(bytes) {\n    let s = '';\n    for (let i = 0; i < bytes.length; i += 8192)\n        s += String.fromCharCode(...bytes.subarray(i, i + 8192));\n    return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');\n}\nfunction parseDXF(input, options = {}) {\n    let rawText = '', pairs, source;\n    const bytes = typeof input === 'string' ? null : input instanceof Uint8Array ? input : new Uint8Array(input);\n    if (bytes && bytes.byteLength > 128 * 1024 * 1024)\n        throw new Error('File exceeds the 128 MiB import safety limit');\n    const binary = bytes && new TextDecoder().decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF';\n    if (binary) {\n        pairs = parseBinaryPairs(bytes, options);\n        source = { format: 'binary', base64: base64(bytes) };\n    }\n    else {\n        if (bytes) {\n            let enc = options.encoding;\n            const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 65536));\n            if (!enc) {\n                const ver = prefix.match(/\\$ACADVER\\s*\\r?\\n\\s*1\\s*\\r?\\n\\s*(AC\\d+)/)?.[1];\n                const cp = prefix.match(/ANSI_(\\d+)/)?.[1];\n                enc = ver && Number(ver.slice(2)) >= 1021 ? 'utf-8' : cp === '1250' ? 'windows-1250' : cp === '1251' ? 'windows-1251' : cp === '932' ? 'shift_jis' : 'windows-1252';\n            }\n            rawText = new TextDecoder(enc).decode(bytes);\n        }\n        else\n            rawText = String(input);\n        pairs = parseAsciiPairs(rawText, options);\n        source = bytes ? { format: 'ascii', base64: base64(bytes) } : { format: 'ascii', text: rawText };\n    }\n    const doc = createDocument(options.name || 'Imported DXF');\n    doc.layers = [];\n    doc.source = source;\n    doc.rawSections = {};\n    doc.importDiagnostics = [];\n    let section = '', current = [], sections = {};\n    for (let i = 0; i < pairs.length; i++) {\n        const [c, v] = pairs[i];\n        if (c === 0 && v === 'SECTION') {\n            section = String(pairs[++i]?.[1] || '');\n            current = [];\n        }\n        else if (c === 0 && v === 'ENDSEC') {\n            sections[section] = current;\n            section = '';\n        }\n        else if (section)\n            current.push(pairs[i]);\n    }\n    if (!sections.ENTITIES && !sections.BLOCKS)\n        throw new Error('DXF contains neither ENTITIES nor BLOCKS sections');\n    const header = sections.HEADER || [];\n    let key = '';\n    for (const [c, v] of header) {\n        if (c === 9)\n            key = String(v);\n        else if (key === '$INSUNITS' && c === 70)\n            doc.units = ({ 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' })[v] || 'unitless';\n        else if (key === '$ACADVER')\n            doc.importVersion = v;\n    }\n    let table = '';\n    for (const r of records(sections.TABLES || [])) {\n        const t = get(r, 0);\n        if (t === 'TABLE')\n            table = get(r, 2);\n        else if (t === 'ENDTAB')\n            table = '';\n        else if (table === 'LAYER' && t === 'LAYER') {\n            const n = get(r, 2, '0'), aci = Number(get(r, 62, 7));\n            doc.layers.push({ name: n, color: get(r, 420) !== undefined ? '#' + Number(get(r, 420)).toString(16).padStart(6, '0') : aciColor(Math.abs(aci)), visible: aci >= 0 && !(get(r, 70, 0) & 1), locked: !!(get(r, 70, 0) & 4), linetype: get(r, 6, 'CONTINUOUS') });\n        }\n        else if (table === 'LTYPE' && t === 'LTYPE')\n            doc.linetypes[get(r, 2, 'CONTINUOUS')] = all(r, 49).map(v => Math.abs(Number(v)));\n    }\n    if (!doc.layers.length)\n        doc.layers.push({ name: '0', color: '#344755', visible: true, locked: false });\n    const parseList = rs => {\n        const es = [];\n        let poly = null, insert = null;\n        for (const raw of rs) {\n            const e = parseEntity(raw, doc.importDiagnostics);\n            if (e.type === 'VERTEX' && poly) {\n                poly.points.push(e.p);\n                continue;\n            }\n            if (e.type === 'ATTRIB' && insert) {\n                insert.attributes.push(e);\n                continue;\n            }\n            if (e.type === 'SEQEND') {\n                poly = null;\n                insert = null;\n                continue;\n            }\n            poly = e.type === 'POLYLINE' ? e : null;\n            insert = e.type === 'INSERT' ? e : null;\n            es.push(e);\n        }\n        for (const e of es)\n            if (e.type === 'INSERT' && e.tag)\n                e.attributes = e.attributes.filter(a => !(a.attributeTag === 'TAG' && a.text === e.tag));\n        return es;\n    };\n    let block = null, blockRecords = [];\n    for (const raw of records(sections.BLOCKS || [])) {\n        const t = get(raw, 0);\n        if (t === 'BLOCK') {\n            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], ...metadata(raw) };\n            blockRecords = [];\n        }\n        else if (t === 'ENDBLK') {\n            if (block) {\n                block.entities = parseList(blockRecords);\n                doc.blocks[block.name] = block;\n            }\n            block = null;\n        }\n        else if (block)\n            blockRecords.push(raw);\n    }\n    doc.entities = parseList(records(sections.ENTITIES || []));\n    const seen = new Set();\n    for (const e of doc.entities) {\n        if (seen.has(e.id))\n            e.id = uid();\n        seen.add(e.id);\n        if (!doc.layers.some(l => l.name === e.layer))\n            doc.layers.push({ name: e.layer, color: '#344755', visible: true, locked: false });\n        if (!doc.layouts.includes(e.layout))\n            doc.layouts.push(e.layout);\n    }\n    const metaComments = all(header, 999).filter(s => String(s).startsWith('CONDUIT:')).map(s => String(s).slice(8)).join('');\n    if (metaComments) {\n        try {\n            const m = JSON.parse(metaComments);\n            doc.parameters = m.parameters || doc.parameters;\n            doc.constraints = m.constraints || [];\n            doc.metadata = m.metadata || doc.metadata;\n        }\n        catch {\n            doc.importDiagnostics.push({ severity: 'warning', message: 'Conduit header metadata could not be decoded.' });\n        }\n    }\n    const unsupported = doc.entities.filter(e => e.unsupported).length;\n    doc.importDiagnostics.unshift({ severity: 'info', message: `${doc.entities.length} model/layout entities, ${Object.keys(doc.blocks).length} blocks, ${doc.layers.length} layers; ${unsupported} unsupported entities.` });\n    for (const [name, p] of Object.entries(sections))\n        if (!['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(name))\n            doc.rawSections[name] = p;\n    doc.importDiagnostics.push({ severity: 'info', message: 'Original input remains available unchanged. Edited DXF export normalizes supported planar entities; arbitrary objects, dictionaries and ownership graphs are not losslessly rewritten.' });\n    return doc;\n}\nfunction asciiJson(data) { return JSON.stringify(data).replace(/[\\u007f-\\uffff]/g, c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); }\n/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */\nfunction writeDXF(doc, { version = 'AC1024', includeMetadata = true } = {}) {\n    if (!['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'].includes(version))\n        throw new Error('Supported export versions: R2000–R2018');\n    const out = [];\n    let handle = 0x100;\n    const used = new Set();\n    for (const e of doc.entities) {\n        if (e._dxf?.handle) {\n            used.add(e._dxf.handle.toUpperCase());\n            handle = Math.max(handle, parseInt(e._dxf.handle, 16) + 1 || 0x100);\n        }\n    }\n    const next = () => {\n        while (used.has(handle.toString(16).toUpperCase()))\n            handle++;\n        return (handle++).toString(16).toUpperCase();\n    };\n    const pair = (c, v) => {\n        if (typeof v === 'number' && !Number.isFinite(v))\n            throw new Error(`Nonfinite DXF value for code ${c}`);\n        let s = typeof v === 'number' ? Number(v.toPrecision(14)).toString() : String(v ?? '');\n        s = s.replace(/\\r?\\n/g, '\\\\P');\n        if (Number(version.slice(2)) < 1021)\n            s = s.replace(/[\\u007f-\\uffff]/g, c => '\\\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));\n        out.push(String(c), s);\n    };\n    const pp = (c, p) => { pair(c, p?.x || 0); pair(c + 10, p?.y || 0); pair(c + 20, p?.z || 0); };\n    const meta = data => {\n        if (!includeMetadata || !Object.keys(data).length)\n            return;\n        pair(1001, 'CONDUITCAD');\n        const s = asciiJson(data);\n        for (let i = 0; i < s.length; i += 200)\n            pair(1000, s.slice(i, i + 200));\n    };\n    const section = name => { pair(0, 'SECTION'); pair(2, name); };\n    const end = () => pair(0, 'ENDSEC');\n    section('HEADER');\n    pair(9, '$ACADVER');\n    pair(1, version);\n    pair(9, '$INSUNITS');\n    pair(70, ({ unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 })[doc.units] ?? 4);\n    pair(9, '$MEASUREMENT');\n    pair(70, doc.units === 'in' || doc.units === 'ft' ? 0 : 1);\n    if (includeMetadata) {\n        const s = asciiJson({ parameters: doc.parameters, constraints: doc.constraints, metadata: doc.metadata });\n        for (let i = 0; i < s.length; i += 180)\n            pair(999, 'CONDUIT:' + s.slice(i, i + 180));\n    }\n    end();\n    section('TABLES');\n    pair(0, 'TABLE');\n    pair(2, 'LTYPE');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, 1);\n    pair(0, 'LTYPE');\n    pair(5, next());\n    pair(100, 'AcDbSymbolTableRecord');\n    pair(100, 'AcDbLinetypeTableRecord');\n    pair(2, 'CONTINUOUS');\n    pair(70, 0);\n    pair(3, 'Solid line');\n    pair(72, 65);\n    pair(73, 0);\n    pair(40, 0);\n    const types = { ...doc.linetypes };\n    for (const e of doc.entities)\n        if (e.dash?.length)\n            types['CC_DASH_' + e.dash.join('_')] = e.dash;\n    for (const [name, pattern] of Object.entries(types)) {\n        if (name === 'CONTINUOUS' || !pattern.length)\n            continue;\n        pair(0, 'LTYPE');\n        pair(5, next());\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbLinetypeTableRecord');\n        pair(2, name);\n        pair(70, 0);\n        pair(3, name);\n        pair(72, 65);\n        pair(73, pattern.length);\n        pair(40, pattern.reduce((a, b) => a + Math.abs(b), 0));\n        pattern.forEach((v, i) => { pair(49, Math.abs(v) * (i % 2 ? -1 : 1)); pair(74, 0); });\n    }\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'LAYER');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, doc.layers.length);\n    for (const l of doc.layers) {\n        pair(0, 'LAYER');\n        pair(5, next());\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbLayerTableRecord');\n        pair(2, l.name);\n        pair(70, l.locked ? 4 : 0);\n        pair(62, l.visible === false ? -7 : 7);\n        pair(420, parseInt((l.color || '#344755').slice(1), 16));\n        pair(6, l.linetype || 'CONTINUOUS');\n    }\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'STYLE');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, 1);\n    pair(0, 'STYLE');\n    pair(5, next());\n    pair(100, 'AcDbSymbolTableRecord');\n    pair(100, 'AcDbTextStyleTableRecord');\n    pair(2, 'STANDARD');\n    pair(70, 0);\n    pair(40, 0);\n    pair(41, 1);\n    pair(50, 0);\n    pair(71, 0);\n    pair(42, 2.5);\n    pair(3, 'txt');\n    pair(4, '');\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'APPID');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, 1);\n    pair(0, 'APPID');\n    pair(5, next());\n    pair(100, 'AcDbSymbolTableRecord');\n    pair(100, 'AcDbRegAppTableRecord');\n    pair(2, 'CONDUITCAD');\n    pair(70, 0);\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'BLOCK_RECORD');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, Object.keys(doc.blocks).length + 2);\n    const blockRecords = {};\n    for (const name of ['*Model_Space', '*Paper_Space', ...Object.keys(doc.blocks).filter(n => !['*Model_Space', '*Paper_Space'].includes(n))]) {\n        blockRecords[name] = next();\n        pair(0, 'BLOCK_RECORD');\n        pair(5, blockRecords[name]);\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbBlockTableRecord');\n        pair(2, name);\n    }\n    pair(0, 'ENDTAB');\n    end();\n    const header = (e, t = e.type, owner) => {\n        pair(0, t);\n        pair(5, next());\n        if (owner)\n            pair(330, owner);\n        pair(100, 'AcDbEntity');\n        pair(8, e.layer || '0');\n        if (e.layout && e.layout !== 'Model') {\n            pair(67, 1);\n            pair(410, e.layout);\n        }\n        if (e.color === 'BYBLOCK')\n            pair(62, 0);\n        else if (e.color && e.color !== 'BYLAYER') {\n            pair(62, 7);\n            pair(420, parseInt(e.color.slice(1), 16));\n        }\n        if (e.hidden)\n            pair(60, 1);\n        if (e.lineweight > 0)\n            pair(370, e.lineweight);\n        if (e.dash?.length)\n            pair(6, 'CC_DASH_' + e.dash.join('_'));\n        else if (e.linetype && e.linetype !== 'BYLAYER')\n            pair(6, e.linetype);\n    };\n    const emit = (e, owner) => {\n        if (e.unsupported) {\n            return;\n        } // The original-source download is the lossless preservation path.\n        if (e.type === 'DIMENSION' && !e.block) {\n            const g = entityGeometry(e, doc);\n            for (const p of g.paths)\n                emit({ type: 'LWPOLYLINE', points: p.points, closed: p.closed, layer: e.layer, color: p.color }, owner);\n            for (const t of g.texts)\n                emit({ type: 'TEXT', ...t, layer: e.layer }, owner);\n            return;\n        }\n        if (e.type === 'HATCH') {\n            for (const l of e.loops || [])\n                emit({ type: 'LWPOLYLINE', points: l.points, closed: true, layer: e.layer, color: e.color }, owner);\n            return;\n        }\n        const type = e.type === 'POLYLINE' ? 'LWPOLYLINE' : e.type;\n        header(e, type, owner);\n        switch (type) {\n            case 'LINE':\n                pair(100, 'AcDbLine');\n                pp(10, e.a);\n                pp(11, e.b);\n                break;\n            case 'LWPOLYLINE':\n                pair(100, 'AcDbPolyline');\n                pair(90, e.points.length);\n                pair(70, e.closed ? 1 : 0);\n                if (e.constantWidth)\n                    pair(43, e.constantWidth);\n                for (const p of e.points) {\n                    pair(10, p.x);\n                    pair(20, p.y);\n                    if (p.bulge)\n                        pair(42, p.bulge);\n                }\n                break;\n            case 'CIRCLE':\n            case 'ARC':\n                pair(100, 'AcDbCircle');\n                pp(10, e.c);\n                pair(40, e.r);\n                if (type === 'ARC') {\n                    pair(100, 'AcDbArc');\n                    pair(50, (e.clockwise ? e.end : e.start) * 180 / Math.PI);\n                    pair(51, (e.clockwise ? e.start : e.end) * 180 / Math.PI);\n                }\n                break;\n            case 'ELLIPSE':\n                pair(100, 'AcDbEllipse');\n                pp(10, e.c);\n                pp(11, e.major);\n                pair(40, e.ratio);\n                pair(41, e.start || 0);\n                pair(42, e.end ?? TAU);\n                break;\n            case 'SPLINE':\n                pair(100, 'AcDbSpline');\n                pair(70, (e.closed ? 1 : 0) | (e.weights?.length ? 4 : 0) | 8);\n                pair(71, e.degree);\n                pair(72, e.knots.length);\n                pair(73, e.controlPoints.length);\n                pair(74, e.fitPoints?.length || 0);\n                for (const v of e.knots)\n                    pair(40, v);\n                for (const v of e.weights || [])\n                    pair(41, v);\n                for (const p of e.controlPoints)\n                    pp(10, p);\n                for (const p of e.fitPoints || [])\n                    pp(11, p);\n                break;\n            case 'TEXT':\n            case 'ATTRIB':\n            case 'ATTDEF':\n                pair(100, 'AcDbText');\n                pp(10, e.p);\n                pair(40, e.height || 12);\n                pair(1, e.text || '');\n                pair(50, e.rotation || 0);\n                pair(41, e.widthFactor || 1);\n                pair(7, 'STANDARD');\n                if (e.align && e.align !== 'left') {\n                    pair(72, e.align === 'center' ? 1 : 2);\n                    pp(11, e.p);\n                }\n                if (type === 'TEXT')\n                    pair(100, 'AcDbText');\n                else {\n                    pair(100, type === 'ATTRIB' ? 'AcDbAttribute' : 'AcDbAttributeDefinition');\n                    pair(2, e.attributeTag || 'TAG');\n                    if (type === 'ATTDEF')\n                        pair(3, 'Equipment tag');\n                    pair(70, e.invisible ? 1 : 0);\n                }\n                break;\n            case 'MTEXT':\n                pair(100, 'AcDbMText');\n                pp(10, e.p);\n                pair(40, e.height || 12);\n                pair(41, e.mtextWidth || 200);\n                pair(71, e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1);\n                pair(1, e.text || '');\n                pair(50, e.rotation || 0);\n                break;\n            case 'POINT':\n                pair(100, 'AcDbPoint');\n                pp(10, e.p);\n                break;\n            case 'SOLID':\n            case 'TRACE':\n            case '3DFACE':\n                pair(100, type === '3DFACE' ? 'AcDbFace' : 'AcDbTrace');\n                for (const [i, j] of [[0, 0], [1, 1], [2, 3], [3, 2]])\n                    pp(10 + i, e.points[j] || e.points.at(-1));\n                break;\n            case 'DIMENSION':\n                pair(100, 'AcDbDimension');\n                pair(2, e.block);\n                pp(10, e.a);\n                pair(70, 32);\n                pair(1, e.text || '<>');\n                pair(100, 'AcDbAlignedDimension');\n                pp(13, e.a);\n                pp(14, e.b);\n                break;\n            case 'INSERT': {\n                pair(100, 'AcDbBlockReference');\n                pair(2, e.block);\n                pp(10, { x: e.x, y: e.y, z: e.z });\n                pair(41, e.sx ?? 1);\n                pair(42, e.sy ?? 1);\n                pair(43, e.sz ?? 1);\n                pair(50, e.rotation || 0);\n                if (e.columns > 1) {\n                    pair(70, e.columns);\n                    pair(44, e.columnSpacing || 0);\n                }\n                if (e.rows > 1) {\n                    pair(71, e.rows);\n                    pair(45, e.rowSpacing || 0);\n                }\n                if (e.attributes?.length || e.tag)\n                    pair(66, 1);\n                break;\n            }\n        }\n        const m = {};\n        if (e.id)\n            m.id = e.id;\n        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked'])\n            if (e[k] !== undefined)\n                m[k] = e[k];\n        meta(m);\n        if (type === 'INSERT' && (e.attributes?.length || e.tag)) {\n            for (const a of e.attributes || [])\n                emit(a, owner);\n            if (e.tag) {\n                const block = doc.blocks[e.block], offset = block?.symbol?.labelOffset || 55;\n                emit({ type: 'ATTRIB', p: { x: e.x, y: e.y - Math.abs((e.sy ?? 1) * offset) }, text: e.tag, height: e.tagHeight || 12, align: 'center', attributeTag: 'TAG', layer: e.layer }, owner);\n            }\n            pair(0, 'SEQEND');\n            pair(5, next());\n            pair(100, 'AcDbEntity');\n            pair(8, e.layer || '0');\n        }\n    };\n    section('BLOCKS');\n    for (const name of Object.keys(blockRecords)) {\n        const b = doc.blocks[name] || { base: { x: 0, y: 0 }, entities: [] };\n        pair(0, 'BLOCK');\n        pair(5, next());\n        pair(330, blockRecords[name]);\n        pair(100, 'AcDbEntity');\n        pair(8, '0');\n        pair(100, 'AcDbBlockBegin');\n        pair(2, name);\n        pair(70, 0);\n        pp(10, b.base);\n        pair(3, name);\n        pair(1, '');\n        meta({ ports: b.ports || [], symbol: b.symbol });\n        for (const e of b.entities)\n            emit(e, blockRecords[name]);\n        pair(0, 'ENDBLK');\n        pair(5, next());\n        pair(330, blockRecords[name]);\n        pair(100, 'AcDbEntity');\n        pair(8, '0');\n        pair(100, 'AcDbBlockEnd');\n    }\n    end();\n    section('ENTITIES');\n    for (const e of doc.entities)\n        emit(e, blockRecords[e.layout && e.layout !== 'Model' ? '*Paper_Space' : '*Model_Space']);\n    end();\n    pair(0, 'EOF');\n    return out.join('\\r\\n') + '\\r\\n';\n}\nfunction exportReport(doc) { const unsupported = doc.entities.filter(e => e.unsupported), hatches = doc.entities.filter(e => e.type === 'HATCH'), dims = doc.entities.filter(e => e.type === 'DIMENSION' && !e.block); return { format: 'ASCII DXF R2010', unsupported: unsupported.map(e => ({ id: e.id, type: e.type })), warnings: [...(unsupported.length ? [`${unsupported.length} unsupported entities omitted from normalized export. Use Original DXF to retain every record.`] : []), ...(hatches.length ? [`${hatches.length} hatches exported as boundaries; fills/patterns are not retained.`] : []), ...(dims.length ? [`${dims.length} authored dimensions exported as visible line/text geometry.`] : []), ...(Object.keys(doc.rawSections || {}).length ? ['Original OBJECTS and other opaque sections are not regenerated.'] : [])], originalAvailable: !!doc.source }; }\n\nreturn {aciColor,parseAsciiPairs,parseBinaryPairs,parseDXF,writeDXF,exportReport};\n})();\n// apps/studio/dxf-worker.js\n__modules[\"apps/studio/dxf-worker.js\"]=(()=>{\nconst {parseDXF} = __modules[\"packages/dxf/src/index.js\"];\nself.onmessage = event => {\n    try {\n        const { buffer, name, encoding } = event.data;\n        self.postMessage({ document: parseDXF(buffer, { name, encoding }) });\n    }\n    catch (error) {\n        self.postMessage({ error: error.message || String(error) });\n    }\n};\n\nreturn {};\n})();\n})();\n";
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
// packages/history/src/index.js
__modules["packages/history/src/index.js"]=(()=>{
/** Atomic serializable transactions with bounded undo memory and redo invalidation. */
class History {
    constructor({ capture, restore, onChange = () => { }, limit = 80, maxBytes = 32 * 1024 * 1024 }) { this.capture = capture; this.restore = restore; this.onChange = onChange; this.limit = limit; this.maxBytes = maxBytes; this.undoStack = []; this.redoStack = []; this.pending = null; }
    begin(label = 'Edit') {
        if (this.pending)
            return;
        this.pending = { label, before: JSON.stringify(this.capture()) };
    }
    commit() {
        if (!this.pending)
            return false;
        const item = this.pending;
        this.pending = null;
        const after = JSON.stringify(this.capture());
        if (after === item.before)
            return false;
        item.after = after;
        this.undoStack.push(item);
        this.redoStack = [];
        let bytes = this.undoStack.reduce((n, x) => n + x.before.length + x.after.length, 0);
        while (this.undoStack.length > 1 && (this.undoStack.length > this.limit || bytes > this.maxBytes)) {
            const old = this.undoStack.shift();
            bytes -= old.before.length + old.after.length;
        }
        this.onChange();
        return true;
    }
    cancel() {
        if (!this.pending)
            return;
        const p = this.pending;
        this.pending = null;
        this.restore(JSON.parse(p.before));
        this.onChange();
    }
    run(label, action) {
        this.begin(label);
        try {
            const result = action();
            this.commit();
            return result;
        }
        catch (error) {
            this.cancel();
            throw error;
        }
    }
    undo() {
        if (this.pending)
            this.cancel();
        const item = this.undoStack.pop();
        if (!item)
            return false;
        this.restore(JSON.parse(item.before));
        this.redoStack.push(item);
        this.onChange();
        return true;
    }
    redo() {
        if (this.pending)
            this.cancel();
        const item = this.redoStack.pop();
        if (!item)
            return false;
        this.restore(JSON.parse(item.after));
        this.undoStack.push(item);
        this.onChange();
        return true;
    }
    clear() { this.pending = null; this.undoStack = []; this.redoStack = []; this.onChange(); }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
}

return {History};
})();
// packages/constraints/src/index.js
__modules["packages/constraints/src/index.js"]=(()=>{
const {distance, dot, cross, sub, length} = __modules["packages/geometry/src/index.js"];
/** Safe expression parser. No eval, property access, functions or executable code. */
function evaluateExpression(source, parameters = {}, stack = []) {
    if (typeof source === 'number') {
        if (!Number.isFinite(source))
            throw new Error('Parameter must be finite');
        return source;
    }
    const s = String(source), tokens = [];
    let pos = 0;
    while (pos < s.length) {
        if (/\s/.test(s[pos])) {
            pos++;
            continue;
        }
        const m = s.slice(pos).match(/^(?:(\d*\.?\d+(?:e[+-]?\d+)?)|([A-Za-z_]\w*)|([()+\-*/^]))/i);
        if (!m)
            throw new Error(`Invalid expression near “${s.slice(pos, pos + 12)}”`);
        tokens.push(m[0]);
        pos += m[0].length;
    }
    let i = 0;
    function primary() {
        const t = tokens[i++];
        if (t === undefined)
            throw new Error('Incomplete expression');
        if (t === '(') {
            const v = sum();
            if (tokens[i++] !== ')')
                throw new Error('Unclosed parenthesis');
            return v;
        }
        if (/^\d|^\./.test(t))
            return Number(t);
        if (/^[A-Za-z_]/.test(t)) {
            if (t === 'pi')
                return Math.PI;
            if (!Object.hasOwn(parameters, t))
                throw new Error(`Unknown parameter: ${t}`);
            if (stack.includes(t))
                throw new Error(`Parameter cycle: ${[...stack, t].join(' → ')}`);
            return evaluateExpression(parameters[t], parameters, [...stack, t]);
        }
        throw new Error(`Unexpected token: ${t}`);
    }
    function power() {
        let v = primary();
        if (tokens[i] === '^') {
            i++;
            v = v ** unary();
        }
        return v;
    }
    function unary() {
        if (tokens[i] === '+' || tokens[i] === '-') {
            const sign = tokens[i++];
            return (sign === '-' ? -1 : 1) * unary();
        }
        return power();
    }
    function product() {
        let v = unary();
        while (tokens[i] === '*' || tokens[i] === '/') {
            const o = tokens[i++], b = unary();
            v = o === '*' ? v * b : v / b;
        }
        return v;
    }
    function sum() {
        let v = product();
        while (tokens[i] === '+' || tokens[i] === '-') {
            const o = tokens[i++], b = product();
            v = o === '+' ? v + b : v - b;
        }
        return v;
    }
    const value = sum();
    if (i !== tokens.length || !Number.isFinite(value))
        throw new Error('Expression did not produce a finite number');
    return value;
}
function resolveParameters(parameters) {
    const result = {};
    for (const k of Object.keys(parameters))
        result[k] = evaluateExpression(parameters[k], parameters, [k]);
    return result;
}
/** Dense damped least-squares planar sketch solver for small selected sketches. */
class ConstraintSolver {
    constructor({ tolerance = 1e-6, maxIterations = 60 } = {}) { this.tolerance = tolerance; this.maxIterations = maxIterations; }
    solve(entities, constraints, parameters = {}) {
        const relevant = new Set(constraints.flatMap(c => c.entities || [c.entityId]).filter(Boolean)), map = new Map(entities.map(e => [e.id, e]));
        for (const c of constraints) {
            const ids = c.entities || [c.entityId];
            if (!ids.length || ids.some(id => !map.has(id)))
                throw new Error('Constraint references a missing entity');
            const [a, b] = ids.map(id => map.get(id));
            const line = e => !!(e?.a && e?.b);
            if (['horizontal', 'vertical', 'length', 'angle', 'parallel', 'perpendicular'].includes(c.type) && !line(a))
                throw new Error('Constraint requires a line');
            if (['parallel', 'perpendicular'].includes(c.type) && !line(b))
                throw new Error('Constraint requires two lines');
            if (c.type === 'radius' && a.r === undefined)
                throw new Error('Radius constraint requires a circle or arc');
            if (c.type === 'equal' && !((line(a) && line(b)) || (a.r !== undefined && b?.r !== undefined)))
                throw new Error('Equal constraint requires matching geometry');
            if (c.type === 'coincident' && (!a[c.pointA || 'b'] || !b?.[c.pointB || 'a']))
                throw new Error('Coincidence requires valid point references');
            if (['radius', 'length'].includes(c.type) && evaluateExpression(c.value, parameters) <= 0)
                throw new Error('Constraint size must be positive');
        }
        const variables = [];
        for (const id of relevant) {
            const e = map.get(id);
            if (!e)
                continue;
            for (const key of ['a', 'b', 'c', 'p'])
                if (e[key])
                    for (const axis of ['x', 'y'])
                        variables.push({ get: () => e[key][axis], set: v => e[key][axis] = v });
            if (e.type === 'CIRCLE' || e.type === 'ARC')
                variables.push({ get: () => e.r, set: v => e.r = Math.max(1e-8, v) });
        }
        if (variables.length > 180)
            throw new Error('Select a smaller sketch (180 scalar variables per solve)');
        const initial = variables.map(v => v.get());
        const residual = () => {
            const r = [];
            for (const c of constraints) {
                const es = (c.entities || [c.entityId]).map(id => map.get(id)), a = es[0], b = es[1];
                if (!a)
                    continue;
                const value = c.value === undefined ? 0 : evaluateExpression(c.value, parameters), v = a.a && a.b ? sub(a.b, a.a) : null, w = b?.a && b?.b ? sub(b.b, b.a) : null;
                switch (c.type) {
                    case 'horizontal':
                        if (v)
                            r.push(v.y);
                        break;
                    case 'vertical':
                        if (v)
                            r.push(v.x);
                        break;
                    case 'length':
                        if (v)
                            r.push(length(v) - value);
                        break;
                    case 'radius':
                        if (a.r !== undefined)
                            r.push(a.r - value);
                        break;
                    case 'coincident': {
                        const p = a[c.pointA || 'b'], q = b?.[c.pointB || 'a'];
                        if (p && q)
                            r.push(p.x - q.x, p.y - q.y);
                        break;
                    }
                    case 'parallel':
                        if (v && w)
                            r.push(cross(v, w) / Math.max(1, length(v), length(w)));
                        break;
                    case 'perpendicular':
                        if (v && w)
                            r.push(dot(v, w) / Math.max(1, length(v), length(w)));
                        break;
                    case 'equal':
                        if (v && w)
                            r.push(length(v) - length(w));
                        else if (a.r !== undefined && b?.r !== undefined)
                            r.push(a.r - b.r);
                        break;
                    case 'angle':
                        if (v) {
                            const current = Math.atan2(v.y, v.x), desired = value * Math.PI / 180;
                            let delta = current - desired;
                            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
                            r.push(delta * Math.max(1, length(v)));
                        }
                        break;
                    case 'fixed': {
                        const target = c.target || {};
                        for (const k of ['a', 'b', 'c', 'p'])
                            if (a[k] && target[k])
                                r.push(a[k].x - target[k].x, a[k].y - target[k].y);
                        if (a.r !== undefined && target.r !== undefined)
                            r.push(a.r - target.r);
                        break;
                    }
                    default: throw new Error(`Unknown constraint: ${c.type}`);
                }
            }
            return r;
        };
        let lambda = 1e-4, iterations = 0, error = Infinity, r = residual();
        const norm = v => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
        for (; iterations < this.maxIterations; iterations++) {
            error = norm(r);
            if (error < this.tolerance)
                break;
            const n = variables.length, m = r.length;
            if (!n || !m)
                break;
            const jac = Array.from({ length: m }, () => new Float64Array(n));
            for (let j = 0; j < n; j++) {
                const v = variables[j].get(), step = 1e-6 * Math.max(1, Math.abs(v));
                variables[j].set(v + step);
                const rr = residual();
                variables[j].set(v);
                for (let i = 0; i < m; i++)
                    jac[i][j] = (rr[i] - r[i]) / step;
            }
            const a = Array.from({ length: n }, () => new Float64Array(n + 1));
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    let sum = 0;
                    for (let i = 0; i < m; i++)
                        sum += jac[i][j] * jac[i][k];
                    a[j][k] = sum + (j === k ? lambda : 0);
                }
                for (let i = 0; i < m; i++)
                    a[j][n] -= jac[i][j] * r[i];
            }
            for (let j = 0; j < n; j++) {
                let pivot = j;
                for (let i = j + 1; i < n; i++)
                    if (Math.abs(a[i][j]) > Math.abs(a[pivot][j]))
                        pivot = i;
                [a[j], a[pivot]] = [a[pivot], a[j]];
                if (Math.abs(a[j][j]) < 1e-15)
                    continue;
                for (let i = j + 1; i < n; i++) {
                    const f = a[i][j] / a[j][j];
                    for (let k = j; k <= n; k++)
                        a[i][k] -= f * a[j][k];
                }
            }
            const delta = new Float64Array(n);
            for (let j = n - 1; j >= 0; j--) {
                let sum = a[j][n];
                for (let k = j + 1; k < n; k++)
                    sum -= a[j][k] * delta[k];
                delta[j] = Math.abs(a[j][j]) > 1e-15 ? sum / a[j][j] : 0;
            }
            const before = variables.map(v => v.get());
            for (let j = 0; j < n; j++)
                variables[j].set(before[j] + delta[j]);
            const next = residual();
            if (norm(next) < error) {
                r = next;
                lambda = Math.max(1e-10, lambda * .3);
            }
            else {
                for (let j = 0; j < n; j++)
                    variables[j].set(before[j]);
                lambda = Math.min(1e10, lambda * 10);
            }
        }
        error = norm(residual());
        const converged = error < this.tolerance * 10;
        if (!converged)
            variables.forEach((v, i) => v.set(initial[i]));
        return { converged, iterations, residual: error, variables: variables.length, equations: r.length, status: converged ? 'solved' : 'conflicting-or-unconverged', rolledBack: !converged };
    }
}

return {evaluateExpression,resolveParameters,ConstraintSolver};
})();
// packages/spatial/src/index.js
__modules["packages/spatial/src/index.js"]=(()=>{
const {intersects, union, emptyBounds, validBounds} = __modules["packages/geometry/src/index.js"];
/** Packed bounding-volume hierarchy with a bounded incremental-update overlay. */
class SpatialIndex {
    constructor(items = [], leafSize = 12) { this.leafSize = leafSize; this.load(items); }
    load(items) { const clean = items.filter(i => validBounds(i)); this.size = clean.length; this.root = this.build(clean, 0); this.items = clean; this.positions = new Map(clean.map((item, i) => [item.id, i]).filter(([id]) => id !== undefined)); this.overrides = new Map(); return this; }
    build(items, depth) {
        if (!items.length)
            return null;
        let b = emptyBounds();
        for (const i of items)
            b = union(b, i);
        if (items.length <= this.leafSize)
            return { ...b, items };
        const x = (b.maxX - b.minX) >= (b.maxY - b.minY);
        items.sort((a, b) => x ? (a.minX + a.maxX - b.minX - b.maxX) : (a.minY + a.maxY - b.minY - b.maxY));
        const m = items.length >> 1;
        return { ...b, left: this.build(items.slice(0, m), depth + 1), right: this.build(items.slice(m), depth + 1) };
    }
    update(items) {
        for (const item of items) {
            const position = this.positions.get(item.id);
            if (position === undefined)
                throw new Error('Spatial update requires an existing ID');
            if (!validBounds(item))
                throw new Error('Invalid spatial update bounds');
            this.items[position] = item;
            this.overrides.set(item.id, item);
        }
        if (this.overrides.size > Math.min(2048, Math.max(128, this.size / 4)))
            this.load(this.items);
        return this;
    }
    search(box) {
        const found = [], stack = this.root ? [this.root] : [];
        while (stack.length) {
            const n = stack.pop();
            if (!intersects(n, box))
                continue;
            if (n.items) {
                for (const i of n.items)
                    if (!this.overrides.has(i.id) && intersects(i, box))
                        found.push(i);
            }
            else {
                stack.push(n.left, n.right);
            }
        }
        for (const item of this.overrides.values())
            if (intersects(item, box))
                found.push(item);
        return found;
    }
}

return {SpatialIndex};
})();
// packages/routing/src/index.js
__modules["packages/routing/src/index.js"]=(()=>{
const {inflate, contains, segmentIntersectsBox, simplifyOrthogonal, distance, normalize, add, mul, bounds, intersects} = __modules["packages/geometry/src/index.js"];
const {SpatialIndex} = __modules["packages/spatial/src/index.js"];
class MinHeap {
    constructor() { this.a = []; }
    push(v) {
        const a = this.a;
        a.push(v);
        let i = a.length - 1;
        while (i) {
            const p = (i - 1) >> 1;
            if (a[p].f <= v.f)
                break;
            a[i] = a[p];
            i = p;
        }
        a[i] = v;
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            let i = 0;
            while (i * 2 + 1 < a.length) {
                let j = i * 2 + 1;
                if (j + 1 < a.length && a[j + 1].f < a[j].f)
                    j++;
                if (a[j].f >= last.f)
                    break;
                a[i] = a[j];
                i = j;
            }
            a[i] = last;
        }
        return top;
    }
    get size() { return this.a.length; }
}
/** Adaptive orthogonal visibility-grid A*. Bend cost is part of directional state. */
function routeOrthogonal(start, end, obstacles = [], options = {}) {
    const clearance = options.clearance ?? 14, bendCost = options.bendCost ?? 24, maxNodes = options.maxNodes ?? 80000;
    const boxes = obstacles.map(b => inflate(b, clearance));
    const index = new SpatialIndex(boxes);
    const clear = (a, b) => !index.search(bounds([a, b])).some(box => segmentIntersectsBox(a, b, box));
    const simple = [[start, { x: end.x, y: start.y }, end], [start, { x: start.x, y: end.y }, end]].map(simplifyOrthogonal);
    const viable = simple.filter(p => p.slice(1).every((b, i) => clear(p[i], b)));
    if (viable.length)
        return { points: viable.sort((a, b) => a.length - b.length)[0], status: 'routed', visited: 0 };
    const margin = 1e-3, xs = [start.x, end.x], ys = [start.y, end.y];
    for (const b of boxes) {
        xs.push(b.minX - margin, b.maxX + margin);
        ys.push(b.minY - margin, b.maxY + margin);
    }
    const unique = arr => [...new Set(arr)].sort((a, b) => a - b);
    const x = unique(xs), y = unique(ys);
    if (x.length * y.length > maxNodes)
        return { points: simple[0], status: 'blocked', reason: 'Routing grid safety limit', visited: 0 };
    const sx = x.indexOf(start.x), sy = y.indexOf(start.y), ex = x.indexOf(end.x), ey = y.indexOf(end.y), heap = new MinHeap(), best = new Map(), parents = new Map();
    const key = (i, j, d) => `${i},${j},${d}`;
    heap.push({ i: sx, j: sy, d: 2, g: 0, f: distance(start, end), key: key(sx, sy, 2) });
    best.set(key(sx, sy, 2), 0);
    let found = null, visited = 0;
    while (heap.size && visited < maxNodes) {
        const n = heap.pop();
        if (n.g !== best.get(n.key))
            continue;
        visited++;
        if (n.i === ex && n.j === ey) {
            found = n;
            break;
        }
        const a = { x: x[n.i], y: y[n.j] };
        for (const [di, dj, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]]) {
            const i = n.i + di, j = n.j + dj;
            if (i < 0 || j < 0 || i >= x.length || j >= y.length)
                continue;
            const b = { x: x[i], y: y[j] };
            if (!clear(a, b))
                continue;
            const k = key(i, j, d), g = n.g + distance(a, b) + (n.d !== 2 && n.d !== d ? bendCost : 0);
            if (g >= (best.get(k) ?? Infinity))
                continue;
            best.set(k, g);
            parents.set(k, n);
            heap.push({ i, j, d, g, key: k, f: g + Math.abs(b.x - end.x) + Math.abs(b.y - end.y) });
        }
    }
    if (!found)
        return { points: simple[0], status: 'blocked', reason: 'No collision-free route found', visited };
    const path = [];
    for (let n = found; n; n = parents.get(n.key))
        path.push({ x: x[n.i], y: y[n.j] });
    return { points: simplifyOrthogonal(path.reverse()), status: 'routed', visited };
}
function routePorts(from, to, obstacles = [], options = {}) {
    const lead = options.lead ?? 20;
    const a = add(from, mul(normalize({ x: from.dx || 0, y: from.dy || 0 }), lead)), b = add(to, mul(normalize({ x: to.dx || 0, y: to.dy || 0 }), lead));
    const filtered = obstacles.filter(o => o.id !== from.entityId && o.id !== to.entityId);
    const r = routeOrthogonal(a, b, filtered, options);
    return { ...r, points: simplifyOrthogonal([from, ...r.points, to]) };
}
function routeVia(start, end, waypoints, obstacles = [], options = {}) {
    const pts = [start, ...waypoints, end], out = [];
    let status = 'routed', visited = 0;
    for (let i = 1; i < pts.length; i++) {
        const r = routeOrthogonal(pts[i - 1], pts[i], obstacles, options);
        out.push(...r.points.slice(i === 1 ? 0 : 1));
        visited += r.visited;
        if (r.status !== 'routed')
            status = 'blocked';
    }
    return { points: simplifyOrthogonal(out), status, visited };
}
function graphFromDocument(doc) {
    const nodes = doc.entities.filter(e => e.type === 'INSERT').map(e => ({ id: e.id, tag: e.tag || e.block, block: e.block })), edges = doc.entities.filter(e => e.connector).map(e => ({ id: e.id, from: e.connector.from?.entityId || null, to: e.connector.to?.entityId || null, fromPort: e.connector.from?.port || null, toPort: e.connector.to?.port || null, style: e.connector.style || 'process', label: e.label || '' }));
    const adjacency = {};
    for (const n of nodes)
        adjacency[n.id] = [];
    for (const e of edges) {
        if (e.from && adjacency[e.from])
            adjacency[e.from].push({ edge: e.id, to: e.to });
    }
    return { nodes, edges, adjacency };
}

return {routeOrthogonal,routePorts,routeVia,graphFromDocument};
})();
// packages/symbols/src/index.js
__modules["packages/symbols/src/index.js"]=(()=>{
const {line, polyline, circle, rect, text, entity, uid, clone, createDocument, ports, entityBounds} = __modules["packages/model/src/index.js"];
const {arcPoints, TAU} = __modules["packages/geometry/src/index.js"];
const p = (x, y) => ({ x, y }), L = (x1, y1, x2, y2) => line(p(x1, y1), p(x2, y2)), P = (points, closed = false) => polyline(points.map(([x, y]) => p(x, y)), closed), C = (x, y, r) => circle(p(x, y), r), R = (x, y, w, h) => rect(x, y, w, h), T = (x, y, s, h = 15) => text(p(x, y), s, h, { align: 'center' });
const horizontal = [{ name: 'in', x: -45, y: 0, dx: -1, dy: 0 }, { name: 'out', x: 45, y: 0, dx: 1, dy: 0 }];
const four = [...horizontal, { name: 'top', x: 0, y: 45, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -45, dx: 0, dy: -1 }];
const lead = [L(-45, 0, -25, 0), L(25, 0, 45, 0)];
const valve = [...lead, P([[-25, -18], [25, 18], [25, -18], [-25, 18]], true)];
const symbols = [];
function def(id, name, category, geometry, ports = horizontal, extra = {}) { const symbol = { id, name, category, block: `CC_${id.toUpperCase().replace(/-/g, '_')}`, entities: geometry, ports, base: p(0, 0), symbol: { name, category, labelOffset: 57, ...extra } }; symbols.push(symbol); return symbol; }
def('gate-valve', 'Gate valve', 'P&ID', valve);
def('ball-valve', 'Ball valve', 'P&ID', [...lead, C(0, 0, 21), L(-15, -15, 15, 15)]);
def('globe-valve', 'Globe valve', 'P&ID', [...valve, C(0, 0, 7)]);
def('butterfly-valve', 'Butterfly valve', 'P&ID', [...lead, C(0, 0, 23), L(-16, -16, 16, 16), C(0, 0, 3)]);
def('check-valve', 'Check valve', 'P&ID', [...lead, P([[-22, -18], [18, 0], [-22, 18]], true), L(21, -22, 21, 22)]);
def('control-valve', 'Control valve', 'P&ID', [...valve, L(0, 0, 0, 35), P([[-22, 35], [-18, 44], [0, 50], [18, 44], [22, 35]], true)], [...horizontal, { name: 'signal', x: 0, y: 50, dx: 0, dy: 1 }]);
def('solenoid-valve', 'Solenoid valve', 'P&ID', [...valve, L(0, 0, 0, 35), R(-12, 35, 24, 20), T(0, 38, 'S', 13)]);
def('relief-valve', 'Relief valve', 'P&ID', [...valve, L(0, 0, 0, 22), P([[0, 22], [-9, 26], [9, 31], [-9, 36], [9, 41], [0, 45]]), L(-15, 48, 15, 48)]);
def('three-way-valve', 'Three-way valve', 'P&ID', [...valve, P([[-18, -25], [18, -25], [0, 0]], true), L(0, -25, 0, -45)], [...horizontal, { name: 'branch', x: 0, y: -45, dx: 0, dy: -1 }]);
def('pump', 'Centrifugal pump', 'P&ID', [...lead, C(0, 0, 27), P([[-15, -18], [23, 0], [-15, 18]], true), L(-22, -31, 22, -31)], four);
def('gear-pump', 'Gear pump', 'P&ID', [...lead, C(0, 0, 28), C(-9, 0, 11), C(9, 0, 11)], four);
def('compressor', 'Compressor', 'P&ID', [...lead, C(0, 0, 29), P([[-17, -20], [18, -10], [18, 10], [-17, 20]], true)], four);
def('fan', 'Fan / blower', 'P&ID', [...lead, C(0, 0, 29), C(0, 0, 6), P([[0, 6], [-16, 19], [-25, 5], [0, 0]]), P([[5, -3], [23, 9], [18, -17], [0, 0]]), P([[-4, -4], [-8, -24], [12, -22], [0, 0]])]);
def('strainer', 'Y strainer', 'P&ID', [...lead, R(-22, -15, 44, 30), L(-17, -12, 17, 12), P([[-8, -15], [5, -37], [18, -30], [12, -15]])]);
def('filter', 'Inline filter', 'P&ID', [...lead, R(-25, -28, 50, 56), L(-25, -28, 25, 28), L(-25, 28, 25, -28)], four);
def('heat-exchanger', 'Heat exchanger', 'P&ID', [...lead, C(0, 0, 33), P([[-32, 0], [-17, 15], [-5, -15], [8, 15], [21, -15], [33, 0]]), L(0, 33, 0, 45), L(0, -33, 0, -45)], four);
def('tank', 'Storage tank', 'P&ID', [L(-35, -43, -35, 40), L(35, -43, 35, 40), P(arcPoints(p(0, 40), 35, 0, Math.PI, .3).map(a => [a.x, a.y])), P(arcPoints(p(0, -43), 35, Math.PI, TAU, .3).map(a => [a.x, a.y])), L(-45, 0, -35, 0), L(35, 0, 45, 0), L(0, -78, 0, -88)], [...horizontal, { name: 'top', x: 0, y: 75, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -88, dx: 0, dy: -1 }], { labelOffset: 112 });
def('vessel', 'Pressure vessel', 'P&ID', [R(-27, -50, 54, 100), L(-15, -50, -15, -65), L(15, -50, 15, -65), L(-45, 0, -27, 0), L(27, 0, 45, 0), L(0, 50, 0, 65)], [...horizontal, { name: 'top', x: 0, y: 65, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -50, dx: 0, dy: -1 }], { labelOffset: 83 });
def('mixer', 'Agitated vessel', 'P&ID', [R(-32, -45, 64, 90), L(0, 45, 0, 65), R(-12, 65, 24, 18), L(0, 45, 0, -22), L(-23, -12, 23, -28), L(-45, 0, -32, 0), L(32, 0, 45, 0)], four, { labelOffset: 66 });
def('pressure-indicator', 'Pressure indicator', 'P&ID', [C(0, 0, 26), T(0, -5, 'PI'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('flow-transmitter', 'Flow transmitter', 'P&ID', [C(0, 0, 26), T(0, -5, 'FT'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('temperature', 'Temperature sensor', 'P&ID', [C(0, 0, 26), T(0, -5, 'TT'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('level-transmitter', 'Level transmitter', 'P&ID', [C(0, 0, 26), T(0, -5, 'LT'), L(-26, 0, -45, 0)], [{ name: 'sense', x: -45, y: 0, dx: -1, dy: 0 }]);
def('reducer', 'Concentric reducer', 'P&ID', [L(-45, 0, -28, 0), P([[-28, -20], [25, -10], [25, 10], [-28, 20]], true), L(25, 0, 45, 0)]);
def('flange', 'Flanged joint', 'P&ID', [L(-45, 0, -5, 0), L(5, 0, 45, 0), L(-5, -23, -5, 23), L(5, -23, 5, 23)]);
def('offpage', 'Off-page connector', 'P&ID', [P([[-40, -17], [24, -17], [44, 0], [24, 17], [-40, 17]], true), T(-4, -5, 'PW', 13)]);
// Original electrical drafting masters; names describe function, not standards certification.
def('resistor', 'Resistor', 'Electrical', [...lead, P([[-25, 0], [-19, 12], [-10, -12], [0, 12], [10, -12], [19, 12], [25, 0]])]);
def('resistor-iec', 'Resistor · rectangular', 'Electrical', [...lead, R(-25, -11, 50, 22)]);
def('capacitor', 'Capacitor', 'Electrical', [L(-45, 0, -6, 0), L(6, 0, 45, 0), L(-6, -25, -6, 25), L(6, -25, 6, 25)]);
def('inductor', 'Inductor', 'Electrical', [L(-45, 0, -30, 0), L(30, 0, 45, 0), ...[-22.5, -7.5, 7.5, 22.5].map(x => P(arcPoints(p(x, 0), 7.5, Math.PI, 0, .2, true).map(p => [p.x, p.y])))]);
def('diode', 'Diode', 'Electrical', [...lead, P([[-22, -22], [20, 0], [-22, 22]], true), L(22, -24, 22, 24)]);
def('led', 'LED', 'Electrical', [...lead, P([[-22, -22], [20, 0], [-22, 22]], true), L(22, -24, 22, 24), P([[4, 27], [21, 44], [14, 42]]), P([[18, 22], [35, 39], [28, 37]])]);
def('switch', 'Switch · normally open', 'Electrical', [L(-45, 0, -23, 0), L(23, 0, 45, 0), C(-22, 0, 3), C(22, 0, 3), L(-20, 2, 19, 26)]);
def('switch-nc', 'Switch · normally closed', 'Electrical', [L(-45, 0, -23, 0), L(23, 0, 45, 0), C(-22, 0, 3), C(22, 0, 3), L(-20, 2, 21, 2), L(0, 2, 0, 23)]);
def('fuse', 'Fuse', 'Electrical', [L(-45, 0, 45, 0), R(-24, -10, 48, 20)]);
def('relay', 'Relay coil', 'Electrical', [...lead, R(-25, -22, 50, 44), L(-20, -18, 20, 18)]);
def('motor', 'Motor', 'Electrical', [...lead, C(0, 0, 29), T(0, -7, 'M', 22)], four);
def('generator', 'Generator', 'Electrical', [...lead, C(0, 0, 29), T(0, -7, 'G', 22)], four);
def('transformer', 'Transformer', 'Electrical', [L(-45, 0, -27, 0), L(27, 0, 45, 0), C(-14, 0, 18), C(14, 0, 18), L(-3, -28, -3, 28), L(3, -28, 3, 28)]);
def('ground', 'Protective earth', 'Electrical', [L(0, 40, 0, 5), L(-26, 5, 26, 5), L(-17, -5, 17, -5), L(-8, -15, 8, -15)], [{ name: 'terminal', x: 0, y: 40, dx: 0, dy: 1 }]);
def('battery', 'Battery', 'Electrical', [L(-45, 0, -18, 0), L(18, 0, 45, 0), L(-18, -24, -18, 24), L(-6, -12, -6, 12), L(6, -24, 6, 24), L(18, -12, 18, 12)]);
def('terminal', 'Terminal block', 'Electrical', [L(-45, 0, 45, 0), C(0, 0, 12), R(-25, -25, 50, 50)]);
def('op-amp', 'Operational amplifier', 'Electrical', [P([[-30, -35], [35, 0], [-30, 35]], true), L(-45, 18, -30, 18), L(-45, -18, -30, -18), L(35, 0, 45, 0), T(-20, 13, '+', 12), T(-20, -23, '−', 12)], [{ name: 'positive', x: -45, y: 18, dx: -1, dy: 0 }, { name: 'negative', x: -45, y: -18, dx: -1, dy: 0 }, { name: 'out', x: 45, y: 0, dx: 1, dy: 0 }]);
def('lamp', 'Indicator lamp', 'Electrical', [...lead, C(0, 0, 24), L(-17, -17, 17, 17), L(-17, 17, 17, -17)]);
const flowPorts = [{ name: 'in', x: 0, y: 35, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -35, dx: 0, dy: -1 }, { name: 'left', x: -55, y: 0, dx: -1, dy: 0 }, { name: 'right', x: 55, y: 0, dx: 1, dy: 0 }];
def('process', 'Process', 'Flow', [R(-55, -35, 110, 70), T(0, -5, 'Process', 14)], flowPorts, { labelOffset: 55 });
def('decision', 'Decision', 'Flow', [P([[0, 42], [60, 0], [0, -42], [-60, 0]], true), T(0, -5, 'Decision', 13)], [{ name: 'in', x: 0, y: 42, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -42, dx: 0, dy: -1 }, { name: 'yes', x: 60, y: 0, dx: 1, dy: 0 }, { name: 'no', x: -60, y: 0, dx: -1, dy: 0 }]);
def('terminator', 'Start / end', 'Flow', [P([...arcPoints(p(-25, 0), 30, Math.PI / 2, 3 * Math.PI / 2, .3), ...arcPoints(p(25, 0), 30, -Math.PI / 2, Math.PI / 2, .3)].map(p => [p.x, p.y]), true), T(0, -5, 'Start / end', 13)], [{ name: 'in', x: 0, y: 30, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -30, dx: 0, dy: -1 }]);
def('data', 'Data / input', 'Flow', [P([[-42, -35], [65, -35], [42, 35], [-65, 35]], true), T(0, -5, 'Data', 14)], flowPorts);
def('document', 'Document', 'Flow', [P([[-55, 35], [55, 35], [55, -24], [30, -36], [0, -25], [-30, -34], [-55, -24]], true), T(0, -5, 'Document', 14)], flowPorts);
def('database', 'Database', 'Flow', [L(-45, -25, -45, 25), L(45, -25, 45, 25), entity('ELLIPSE', { c: p(0, 25), major: p(45, 0), ratio: 1 / 3 }), P(Array.from({ length: 31 }, (_, i) => { const t = Math.PI + Math.PI * i / 30; return [45 * Math.cos(t), -25 + 15 * Math.sin(t)]; })), T(0, -5, 'Database', 13)], flowPorts);
def('subprocess', 'Subprocess', 'Flow', [R(-55, -35, 110, 70), L(-43, -35, -43, 35), L(43, -35, 43, 35), T(0, -5, 'Subprocess', 12)], flowPorts);
def('manual', 'Manual input', 'Flow', [P([[-55, -35], [55, -35], [55, 42], [-55, 22]], true), T(0, -5, 'Input', 14)], flowPorts);
def('preparation', 'Preparation', 'Flow', [P([[-40, -35], [40, -35], [60, 0], [40, 35], [-40, 35], [-60, 0]], true), T(0, -5, 'Prepare', 14)], flowPorts);
def('delay', 'Delay', 'Flow', [P([[-50, -35], [5, -35], ...Array.from({ length: 31 }, (_, i) => { const t = -Math.PI / 2 + Math.PI * i / 30; return [5 + 35 * Math.cos(t), 35 * Math.sin(t)]; }), [-50, 35]], true), T(-5, -5, 'Delay', 14)], flowPorts);
def('junction', 'Junction', 'Flow', [C(0, 0, 16)], [{ name: 'in', x: 0, y: 16, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -16, dx: 0, dy: -1 }, { name: 'left', x: -16, y: 0, dx: -1, dy: 0 }, { name: 'right', x: 16, y: 0, dx: 1, dy: 0 }]);
def('note', 'Annotation', 'Flow', [P([[45, 35], [-45, 35], [-45, -35], [45, -35]]), T(0, -5, 'Note', 14)], flowPorts);
const SYMBOLS = symbols;
const LINE_STYLES = [
    { id: 'process', name: 'Process pipe', layer: 'Process', color: '#147c77', width: 2, dash: [], arrow: 'end' },
    { id: 'signal', name: 'Instrument signal', layer: 'Instruments', color: '#aa7c4b', width: 1.5, dash: [6, 4], arrow: 'none' },
    { id: 'electrical', name: 'Electrical wire', layer: 'Electrical', color: '#6979b4', width: 1.5, dash: [], arrow: 'none' },
    { id: 'data', name: 'Data / communication', layer: 'Electrical', color: '#8876a7', width: 1.5, dash: [10, 3, 2, 3], arrow: 'end' },
    { id: 'pneumatic', name: 'Pneumatic signal', layer: 'Instruments', color: '#a38560', width: 1.5, dash: [10, 3, 2, 3, 2, 3], arrow: 'none' },
    { id: 'hydraulic', name: 'Hydraulic line', layer: 'Process', color: '#557d99', width: 2.8, dash: [], arrow: 'end' },
    { id: 'drain', name: 'Drain / utility', layer: 'Process', color: '#75898d', width: 1.5, dash: [12, 5], arrow: 'end' },
    { id: 'center', name: 'Centerline', layer: 'Annotations', color: '#8e9298', width: 1, dash: [16, 3, 2, 3], arrow: 'none' },
    { id: 'hidden', name: 'Hidden edge', layer: '0', color: '#8e9298', width: 1.2, dash: [4, 3], arrow: 'none' },
    { id: 'boundary', name: 'Equipment boundary', layer: 'Annotations', color: '#9bacb3', width: 1, dash: [8, 4], arrow: 'none' }
];
function installSymbols(doc) {
    for (const s of SYMBOLS)
        if (!doc.blocks[s.block])
            doc.blocks[s.block] = clone({ name: s.block, base: s.base, entities: s.entities, ports: s.ports, symbol: s.symbol });
    return doc;
}
function insertSymbol(doc, id, x, y, options = {}) {
    const s = SYMBOLS.find(s => s.id === id) || Object.values(doc.blocks).find(b => b.name === id && b.symbol);
    if (!s)
        throw new Error(`Unknown symbol: ${id}`);
    if (s.block && !doc.blocks[s.block])
        doc.blocks[s.block] = clone({ name: s.block, base: s.base, entities: s.entities, ports: s.ports, symbol: s.symbol });
    return entity('INSERT', { block: s.block || s.name, x, y, sx: 1, sy: 1, rotation: 0, layer: s.category === 'Electrical' ? 'Electrical' : s.category === 'Flow' ? 'Process' : 'Equipment', tag: options.tag ?? '', ...options });
}
/** Three genuinely editable demonstration projects; no background image or mock canvas. */
function createDemo(kind = 'pid') {
    const doc = installSymbols(createDocument(kind === 'electrical' ? 'Motor control circuit' : kind === 'flow' ? 'Commissioning workflow' : 'Process water skid'));
    const E = doc.entities;
    const put = (id, x, y, tag, extra = {}) => { const e = insertSymbol(doc, id, x, y, { tag, ...extra }); E.push(e); return e; };
    const wire = (a, ap, b, bp, label = '', style = 'process', way = []) => {
        const aa = ports(a, doc).find(p => p.name === ap), bb = ports(b, doc).find(p => p.name === bp);
        if (!aa || !bb)
            throw new Error(`Demo port missing ${ap}/${bp}`);
        const s = LINE_STYLES.find(s => s.id === style);
        const pts = way.length ? [aa, ...way, bb] : [aa, { x: bb.x, y: aa.y }, bb];
        const e = polyline(pts, false, { layer: s.layer, color: s.color, width: s.width, dash: s.dash, label, connector: { from: { entityId: a.id, port: ap }, to: { entityId: b.id, port: bp }, style, arrow: s.arrow, waypoints: way, status: 'routed' } });
        E.push(e);
        return e;
    };
    const note = (x, y, t, h = 12, color = '#849298') => E.push(text(p(x, y), t, h, { layer: 'Annotations', color }));
    note(40, 650, 'CONDUIT / ENGINEERING WORKSPACE', 12, '#6d9693');
    note(40, 606, doc.name, 30, '#304c58');
    note(40, 576, kind === 'pid' ? 'PW-101   ·   PIPING & INSTRUMENTATION   ·   REV 01' : kind === 'flow' ? 'QA-204   ·   PROCESS FLOW   ·   REV 01' : 'EL-301   ·   ELECTRICAL SCHEMATIC   ·   REV 01', 12);
    E.push(line(p(40, 553), p(1100, 553), { layer: 'Annotations', color: '#ccd7db', width: 1 }));
    if (kind === 'pid') {
        note(40, 520, '01  /  INTAKE', 11);
        note(415, 520, '02  /  PRESSURIZATION', 11);
        note(795, 520, '03  /  CONDITIONING', 11);
        const inlet = put('offpage', 85, 330, 'SUPPLY'), v1 = put('gate-valve', 210, 330, 'HV-101'), str = put('strainer', 340, 330, 'ST-101'), pump = put('pump', 485, 330, 'P-101'), check = put('check-valve', 625, 330, 'NRV-101'), v2 = put('ball-valve', 755, 330, 'HV-102'), hx = put('heat-exchanger', 905, 330, 'E-101'), out = put('offpage', 1055, 330, 'RETURN');
        const seq = [inlet, v1, str, pump, check, v2, hx, out];
        for (let i = 1; i < seq.length; i++)
            wire(seq[i - 1], 'out', seq[i], 'in', i === 1 ? 'DN 50' : i === 5 ? 'PW-101' : '');
        const pi = put('pressure-indicator', 625, 455, 'PI-101', { tagHeight: 11 });
        wire(check, 'top', pi, 'sense', '', 'signal'); // Add explicit auxiliary check-valve port below.
        const ctrl = put('control-valve', 755, 170, 'FCV-101');
        wire(pump, 'bottom', ctrl, 'in', 'BYPASS', 'process', [p(485, 170), p(710, 170)]);
        wire(ctrl, 'out', hx, 'bottom', '', 'process', [p(905, 170)]);
        const ft = put('flow-transmitter', 905, 455, 'FT-101', { tagHeight: 11 });
        wire(hx, 'top', ft, 'sense', '', 'signal');
        const controller = put('process', 1060, 170, 'FIC-101', { sx: .75, sy: .75, layer: 'Instruments' });
        wire(ft, 'sense', controller, 'in', '', 'signal', [p(985, 410), p(985, 225), p(1060, 225)]);
        wire(controller, 'left', ctrl, 'signal', '', 'signal', [p(985, 170), p(985, 235), p(755, 235)]);
        note(47, 225, 'DESIGN BASIS', 10);
        note(47, 202, 'Flow       12.5 m³/h', 12, '#6a7e86');
        note(47, 181, 'Pressure   6 bar', 12, '#6a7e86');
        note(47, 160, 'Material   SS 316L', 12, '#6a7e86');
    }
    else if (kind === 'electrical') {
        const bat = put('battery', 130, 350, '24 VDC'), fuse = put('fuse', 310, 350, 'F1'), sw = put('switch', 490, 350, 'S1'), relay = put('relay', 700, 350, 'K1'), motor = put('motor', 930, 350, 'M1');
        const seq = [bat, fuse, sw, relay, motor];
        for (let i = 1; i < seq.length; i++)
            wire(seq[i - 1], 'out', seq[i], 'in', 'L+', 'electrical');
        const ground = put('ground', 930, 160, 'PE');
        wire(motor, 'bottom', ground, 'terminal', '', 'electrical');
        const lamp = put('lamp', 700, 200, 'H1');
        wire(sw, 'out', lamp, 'in', '', 'electrical', [p(560, 350), p(560, 200)]);
        wire(lamp, 'out', motor, 'bottom', '', 'electrical', [p(930, 200)]);
        note(80, 470, 'CONTROL POWER', 12);
        note(650, 470, 'OUTPUTS & INDICATION', 12);
    }
    else {
        const start = put('terminator', 160, 440, 'START'), proc = put('process', 400, 440, 'INSPECT'), dec = put('decision', 650, 440, 'PASS?'), end = put('terminator', 965, 440, 'APPROVE'), fix = put('process', 650, 245, 'REWORK'), db = put('database', 965, 245, 'RECORD');
        wire(start, 'out', proc, 'in', '', 'process', [p(160, 365), p(400, 365), p(400, 475)]);
        wire(proc, 'right', dec, 'no');
        wire(dec, 'yes', end, 'in', 'YES', 'process', [p(965, 440), p(965, 500)]);
        wire(dec, 'out', fix, 'in', 'NO');
        wire(fix, 'left', proc, 'out', '', 'process', [p(400, 245)]);
        wire(end, 'out', db, 'in');
        note(70, 165, 'Every shape is a DXF block. Connectors stay attached when equipment moves.', 14);
    }
    E.push(line(p(40, 92), p(1100, 92), { layer: 'Annotations', color: '#ccd7db', width: 1 }));
    note(40, 60, 'SCHEMATIC · NOT FOR CONSTRUCTION', 10);
    note(720, 60, 'UNITS: mm     |     MODEL SPACE     |     1 OF 1', 10);
    doc.metadata.description = 'Editable demonstration drawing. Symbols are illustrative, not standards-certified.';
    return doc;
}
// Instrument takeoff points remain explicit, inspectable block ports.
SYMBOLS.find(s => s.id === 'check-valve').ports = [...horizontal, { name: 'top', x: 0, y: 18, dx: 0, dy: 1 }];

return {SYMBOLS,LINE_STYLES,installSymbols,insertSymbol,createDemo};
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
// packages/renderer/src/index.js
__modules["packages/renderer/src/index.js"]=(()=>{
const {bounds, union, emptyBounds, intersects, distance, validBounds, center, clamp} = __modules["packages/geometry/src/index.js"];
const {entityGeometry, entityBounds, isVisible, documentBounds} = __modules["packages/model/src/index.js"];
const {SpatialIndex} = __modules["packages/spatial/src/index.js"];
class Camera {
    constructor() { this.x = 560; this.y = 340; this.scale = 1; this.width = 1000; this.height = 700; }
    world(p) { return { x: (p.x - this.width / 2) / this.scale + this.x, y: -(p.y - this.height / 2) / this.scale + this.y }; }
    screen(p) { return { x: (p.x - this.x) * this.scale + this.width / 2, y: -(p.y - this.y) * this.scale + this.height / 2 }; }
    zoom(factor, anchor = { x: this.width / 2, y: this.height / 2 }) { const p = this.world(anchor); this.scale = clamp(this.scale * factor, .00001, 5000); const after = this.world(anchor); this.x += p.x - after.x; this.y += p.y - after.y; }
    pan(dx, dy) { this.x -= dx / this.scale; this.y += dy / this.scale; }
    fit(b, padding = 75) {
        if (!validBounds(b))
            return;
        const c = center(b);
        this.x = c.x;
        this.y = c.y;
        this.scale = clamp(Math.min(Math.max(40, this.width - padding * 2) / Math.max(1, b.maxX - b.minX), Math.max(40, this.height - padding * 2) / Math.max(1, b.maxY - b.minY)), .00001, 5000);
    }
    get viewport() { return { minX: this.x - this.width / 2 / this.scale, minY: this.y - this.height / 2 / this.scale, maxX: this.x + this.width / 2 / this.scale, maxY: this.y + this.height / 2 / this.scale }; }
}
function colorRGBA(hex, alpha = 1) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || ''))
        hex = '#344755';
    return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, alpha];
}
function segmentCount(path) { return path.points.length - 1 + (path.closed && distance(path.points[0], path.points.at(-1)) > 1e-7 ? 1 : 0); }
function writeStrokeData(data, paths, origin, offset = 0) {
    let k = offset * 16;
    for (const p of paths) {
        const rgba = colorRGBA(p.color, p.opacity), pts = p.points;
        let phase = 0;
        const n = segmentCount(p);
        for (let i = 0; i < n; i++) {
            const a = pts[i], z = pts[(i + 1) % pts.length];
            data.set([a.x - origin.x, a.y - origin.y, z.x - origin.x, z.y - origin.y, ...rgba, p.width || 1.5, p.dash?.[0] || 0, p.dash?.[1] || 0, phase, p.dash?.[2] || 0, p.dash?.[3] || 0, p.dash?.[4] || 0, p.dash?.[5] || 0], k);
            k += 16;
            phase += distance(a, z);
        }
    }
}
function buildScene(doc, { tolerance = .25, origin = null } = {}) {
    const paths = [], texts = [], items = [], spans = new Map(), entities = new Map();
    let b = emptyBounds(), count = 0;
    const started = performance.now();
    for (const e of doc.entities) {
        if (!isVisible(e, doc))
            continue;
        const g = entityGeometry(e, doc, { tolerance }), span = { pathStart: paths.length, pathCount: g.paths.length, textStart: texts.length, textCount: g.texts.length, offset: count, count: 0, itemIndex: -1 };
        for (const path of g.paths) {
            paths.push(path);
            count += segmentCount(path);
        }
        for (const text of g.texts)
            texts.push(text);
        span.count = count - span.offset;
        const bb = entityBounds(e, doc);
        if (validBounds(bb)) {
            span.itemIndex = items.length;
            items.push({ ...bb, id: e.id, entity: e });
            b = union(b, bb);
        }
        spans.set(e.id, span);
        entities.set(e.id, e);
    }
    origin = origin || (validBounds(b) ? center(b) : { x: 0, y: 0 });
    const data = new Float32Array(count * 16);
    writeStrokeData(data, paths, origin);
    return { paths, texts, items, spans, entities, index: new SpatialIndex(items), bounds: b, origin, data, count, buildMs: performance.now() - started };
}
/** Patch equal-topology edits in place. A null result requests a full rebuild. */
function updateSceneEntities(scene, doc, ids, { tolerance = .25 } = {}) {
    const requested = new Set(ids), replacements = [];
    for (const e of doc.entities) {
        if (!requested.has(e.id))
            continue;
        const span = scene.spans.get(e.id);
        if (!span || !isVisible(e, doc))
            return null;
        const g = entityGeometry(e, doc, { tolerance }), count = g.paths.reduce((n, p) => n + segmentCount(p), 0);
        if (span.count !== count || span.pathCount !== g.paths.length || span.textCount !== g.texts.length)
            return null;
        const bb = entityBounds(e, doc);
        if (validBounds(bb) !== (span.itemIndex >= 0))
            return null;
        replacements.push({ e, span, g, bb });
    }
    if (replacements.length !== requested.size)
        return null;
    const ranges = [], items = [];
    for (const { e, span, g, bb } of replacements) {
        for (let i = 0; i < g.paths.length; i++)
            scene.paths[span.pathStart + i] = g.paths[i];
        for (let i = 0; i < g.texts.length; i++)
            scene.texts[span.textStart + i] = g.texts[i];
        writeStrokeData(scene.data, g.paths, scene.origin, span.offset);
        scene.entities.set(e.id, e);
        if (span.itemIndex >= 0) {
            const item = { ...bb, id: e.id, entity: e };
            scene.items[span.itemIndex] = item;
            items.push(item);
            scene.bounds = union(scene.bounds, bb);
        }
        if (span.count)
            ranges.push({ offset: span.offset, count: span.count });
    }
    if (items.length)
        scene.index.update(items);
    return ranges;
}
const WGSL_COMMON = `
struct Segment { ab:vec4f, color:vec4f, style:vec4f, dash:vec4f };
struct View { camera:vec2f, viewport:vec2f, scale:f32, ratio:f32, count:u32, pad:f32 };
@group(0) @binding(0) var<storage,read> segments:array<Segment>;
@group(0) @binding(1) var<uniform> view:View;
`;
const CULL_SHADER = WGSL_COMMON + `
struct Args { vertices:u32, instances:atomic<u32>, firstVertex:u32, firstInstance:u32 };
@group(0) @binding(2) var<storage,read_write> indices:array<u32>;
@group(0) @binding(3) var<storage,read_write> args:Args;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid:vec3u) {
 let id=gid.x; if(id>=view.count){return;}
 let s=segments[id]; let a=(s.ab.xy-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let b=(s.ab.zw-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let margin=max(s.style.x,2.0)+2.0;
 if(all(max(a,b)>=vec2f(-margin)) && all(min(a,b)<=view.viewport+vec2f(margin))){let n=atomicAdd(&args.instances,1u);indices[n]=id;}
}`;
const LINE_SHADER = WGSL_COMMON + `
@group(0) @binding(2) var<storage,read> indices:array<u32>;
struct Out { @builtin(position) position:vec4f, @location(0) local:vec2f, @location(1) @interpolate(flat) metrics:vec2f, @location(2) @interpolate(flat) color:vec4f, @location(3) @interpolate(flat) style:vec4f, @location(4) @interpolate(flat) dash:vec4f };
@vertex fn vs(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out {
 let s=segments[indices[instance]];let a=(s.ab.xy-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;
 let b=(s.ab.zw-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;let delta=b-a;let len=max(length(delta),0.0001);let dir=delta/len;let normal=vec2f(-dir.y,dir.x);
 let halfWidth=max(s.style.x*.5,.5);let pad=halfWidth+1.0;
 let corners=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(1,1),vec2f(0,-1),vec2f(1,1),vec2f(0,1));let corner=corners[vertex];let local=vec2f(mix(-pad,len+pad,corner.x),corner.y*pad);let pixel=a+dir*local.x+normal*local.y;
 var o:Out;o.position=vec4f(pixel/view.viewport*vec2f(2,-2)+vec2f(-1,1),0,1);o.local=local;o.metrics=vec2f(len,halfWidth);o.color=s.color;o.style=s.style;o.dash=s.dash;return o;
}
@fragment fn fs(o:Out)->@location(0) vec4f {
 let outside=length(vec2f(max(max(-o.local.x,o.local.x-o.metrics.x),0.0),o.local.y))-o.metrics.y;
 let alpha=1.0-smoothstep(-.55,.55,outside);
 if(o.style.y>0.0){let pattern=array<f32,6>(o.style.y,o.style.z,o.dash.x,o.dash.y,o.dash.z,o.dash.w);let cycle=o.style.y+o.style.z+o.dash.x+o.dash.y+o.dash.z+o.dash.w;var d=(max(o.local.x,0.0)/view.scale+o.style.w)%cycle;for(var i=0u;i<6u;i++){if(d<pattern[i]){if(i%2u==1u){discard;}break;}d-=pattern[i];}}
 return vec4f(o.color.rgb,o.color.a*alpha);
}`;
class GPUBackend {
    constructor(canvas, onLost) { this.canvas = canvas; this.onLost = onLost; this.batches = []; this.name = 'WebGPU'; }
    async init() {
        if (!navigator.gpu)
            throw new Error('WebGPU API unavailable');
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter)
            throw new Error('No WebGPU adapter');
        this.device = await adapter.requestDevice();
        const d = this.device;
        d.lost.then(info => {
            if (!this.disposed)
                this.onLost('WebGPU device lost: ' + info.message);
        });
        d.addEventListener('uncapturederror', event => {
            if (!this.disposed)
                this.onLost('WebGPU validation: ' + event.error.message);
        });
        const compute = d.createShaderModule({ label: 'Conduit viewport culling', code: CULL_SHADER }), render = d.createShaderModule({ label: 'Conduit antialiased CAD strokes', code: LINE_SHADER });
        for (const module of [compute, render]) {
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');
            if (errors.length)
                throw new Error(errors.map(e => e.message).join('; '));
        }
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.compute = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: compute, entryPoint: 'main' } });
        this.render = await d.createRenderPipelineAsync({ layout: 'auto', vertex: { module: render, entryPoint: 'vs' }, fragment: { module: render, entryPoint: 'fs', targets: [{ format: this.format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] }, primitive: { topology: 'triangle-list' } });
        this.context = this.canvas.getContext('webgpu');
        if (!this.context)
            throw new Error('GPU canvas context unavailable');
        this.context.configure({ device: d, format: this.format, alphaMode: 'premultiplied' });
        return this;
    }
    upload(scene) {
        const d = this.device;
        this.clear();
        this.scene = scene;
        const limit = Math.min(200000, Math.floor(d.limits.maxStorageBufferBindingSize / 64), d.limits.maxComputeWorkgroupsPerDimension * 64);
        for (let first = 0; first < scene.count; first += limit) {
            const count = Math.min(limit, scene.count - first), storage = d.createBuffer({ size: count * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }), uniform = d.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), indices = d.createBuffer({ size: Math.max(4, count * 4), usage: GPUBufferUsage.STORAGE }), args = d.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
            d.queue.writeBuffer(storage, 0, scene.data.buffer, scene.data.byteOffset + first * 64, count * 64);
            const entries = [{ binding: 0, resource: { buffer: storage } }, { binding: 1, resource: { buffer: uniform } }, { binding: 2, resource: { buffer: indices } }];
            this.batches.push({ first, count, storage, uniform, indices, args, computeGroup: d.createBindGroup({ layout: this.compute.getBindGroupLayout(0), entries: [...entries, { binding: 3, resource: { buffer: args } }] }), renderGroup: d.createBindGroup({ layout: this.render.getBindGroupLayout(0), entries }) });
        }
    }
    update(scene, ranges) {
        this.scene = scene;
        for (const range of ranges)
            for (const batch of this.batches) {
                const start = Math.max(range.offset, batch.first), end = Math.min(range.offset + range.count, batch.first + batch.count);
                if (end > start)
                    this.device.queue.writeBuffer(batch.storage, (start - batch.first) * 64, scene.data.buffer, scene.data.byteOffset + start * 64, (end - start) * 64);
            }
    }
    draw(camera, ratio) {
        const d = this.device, encoder = d.createCommandEncoder();
        for (const batch of this.batches) {
            const buffer = new ArrayBuffer(32), f = new Float32Array(buffer), u = new Uint32Array(buffer);
            f.set([camera.x - this.scene.origin.x, camera.y - this.scene.origin.y, camera.width, camera.height, camera.scale, ratio]);
            u[6] = batch.count;
            d.queue.writeBuffer(batch.uniform, 0, buffer);
            d.queue.writeBuffer(batch.args, 0, new Uint32Array([6, 0, 0, 0]));
            const pass = encoder.beginComputePass();
            pass.setPipeline(this.compute);
            pass.setBindGroup(0, batch.computeGroup);
            pass.dispatchWorkgroups(Math.ceil(batch.count / 64));
            pass.end();
        }
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(this.render);
        for (const b of this.batches) {
            pass.setBindGroup(0, b.renderGroup);
            pass.drawIndirect(b.args, 0);
        }
        pass.end();
        d.queue.submit([encoder.finish()]);
    }
    clear() {
        for (const b of this.batches)
            for (const k of ['storage', 'uniform', 'indices', 'args'])
                b[k].destroy();
        this.batches = [];
    }
    dispose() { this.disposed = true; this.clear(); this.context?.unconfigure(); this.device?.destroy(); }
}
const GLSL_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 ab;layout(location=1) in vec4 color;layout(location=2) in vec4 style;layout(location=3) in vec4 dash;
uniform vec2 camera;uniform vec2 viewport;uniform float scale;
out vec2 local;flat out vec2 metrics;flat out vec4 col;flat out vec4 sty;flat out vec4 dsh;
void main(){vec2 a=(ab.xy-camera)*vec2(scale,-scale)+viewport*.5,b=(ab.zw-camera)*vec2(scale,-scale)+viewport*.5;vec2 delta=b-a;float len=max(length(delta),.0001);vec2 dir=delta/len,n=vec2(-dir.y,dir.x);float halfWidth=max(style.x*.5,.5),pad=halfWidth+1.;vec2 corners[6]=vec2[6](vec2(0,-1),vec2(1,-1),vec2(1,1),vec2(0,-1),vec2(1,1),vec2(0,1));vec2 corner=corners[gl_VertexID];local=vec2(mix(-pad,len+pad,corner.x),corner.y*pad);vec2 pixel=a+dir*local.x+n*local.y;gl_Position=vec4(pixel/viewport*vec2(2,-2)+vec2(-1,1),0,1);metrics=vec2(len,halfWidth);col=color;sty=style;dsh=dash;}`;
const GLSL_FRAGMENT = `#version 300 es
precision highp float;in vec2 local;flat in vec2 metrics;flat in vec4 col;flat in vec4 sty;flat in vec4 dsh;uniform float scale;out vec4 frag;
void main(){float outside=length(vec2(max(max(-local.x,local.x-metrics.x),0.),local.y))-metrics.y;float alpha=1.-smoothstep(-.55,.55,outside);if(sty.y>0.){float pattern[6]=float[6](sty.y,sty.z,dsh.x,dsh.y,dsh.z,dsh.w);float cycle=sty.y+sty.z+dsh.x+dsh.y+dsh.z+dsh.w;float pos=mod(max(local.x,0.)/scale+sty.w,cycle);for(int i=0;i<6;i++){if(pos<pattern[i]){if(i%2==1)discard;break;}pos-=pattern[i];}}frag=vec4(col.rgb,col.a*alpha);}`;
class GLBackend {
    constructor(canvas, onLost) { this.canvas = canvas; this.name = 'WebGL2'; this.onLost = onLost; }
    async init() {
        const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
        if (!gl)
            throw new Error('WebGL2 unavailable');
        this.gl = gl;
        const shader = (kind, source) => {
            const s = gl.createShader(kind);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const vs = shader(gl.VERTEX_SHADER, GLSL_VERTEX), fs = shader(gl.FRAGMENT_SHADER, GLSL_FRAGMENT);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(this.program));
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        for (let i = 0; i < 4; i++) {
            gl.enableVertexAttribArray(i);
            gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 64, i * 16);
            gl.vertexAttribDivisor(i, 1);
        }
        this.uniforms = Object.fromEntries(['camera', 'viewport', 'scale'].map(k => [k, gl.getUniformLocation(this.program, k)]));
        this.canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            if (!this.disposed)
                this.onLost('WebGL context lost');
        });
        return this;
    }
    upload(scene) { this.scene = scene; this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer); this.gl.bufferData(this.gl.ARRAY_BUFFER, scene.data, this.gl.STATIC_DRAW); }
    update(scene, ranges) {
        this.scene = scene;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        for (const r of ranges)
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, r.offset * 64, scene.data.subarray(r.offset * 16, (r.offset + r.count) * 16));
    }
    draw(camera) { const g = this.gl; g.viewport(0, 0, this.canvas.width, this.canvas.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.useProgram(this.program); g.bindVertexArray(this.vao); g.enable(g.BLEND); g.blendFuncSeparate(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA); g.uniform2f(this.uniforms.camera, camera.x - this.scene.origin.x, camera.y - this.scene.origin.y); g.uniform2f(this.uniforms.viewport, camera.width, camera.height); g.uniform1f(this.uniforms.scale, camera.scale); g.drawArraysInstanced(g.TRIANGLES, 0, 6, this.scene.count); }
    dispose() { this.disposed = true; this.gl?.deleteBuffer(this.buffer); this.gl?.deleteProgram(this.program); this.gl?.deleteVertexArray(this.vao); }
}
class CanvasBackend {
    constructor(canvas) { this.canvas = canvas; this.name = 'Canvas 2D'; }
    async init() { this.ctx = this.canvas.getContext('2d'); return this; }
    upload(scene) { this.scene = scene; }
    draw(camera, ratio) {
        const c = this.ctx;
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, camera.width, camera.height);
        for (const p of this.scene.paths) {
            if (!intersects(bounds(p.points), camera.viewport))
                continue;
            drawPath(c, p, camera);
        }
    }
    dispose() { }
}
function drawPath(ctx, path, camera, override = {}) {
    const points = path.points;
    if (!points.length)
        return;
    ctx.beginPath();
    points.forEach((p, i) => {
        const s = camera.screen(p);
        if (i === 0)
            ctx.moveTo(s.x, s.y);
        else
            ctx.lineTo(s.x, s.y);
    });
    if (path.closed)
        ctx.closePath();
    ctx.strokeStyle = override.color || path.color || '#344755';
    ctx.lineWidth = override.width || path.width || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash((override.dash || path.dash || []).map(v => v * camera.scale));
    ctx.globalAlpha = path.opacity ?? 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
}
function drawText(ctx, t, camera) {
    const s = camera.screen(t.p), h = t.height * camera.scale;
    if (h < 2 || h > 2000)
        return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-(t.rotation || 0) * Math.PI / 180);
    ctx.scale(t.widthFactor || 1, 1);
    ctx.fillStyle = t.color || '#344755';
    ctx.textAlign = t.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${h}px Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`;
    String(t.text).split('\n').forEach((line, i) => ctx.fillText(line, 0, i * h * 1.3));
    ctx.restore();
}
/** Retained CAD renderer. Geometry uploads only after document/tessellation changes. */
class CadRenderer {
    constructor(host, { camera = new Camera(), backend = 'auto', onStatus = () => { } } = {}) {
        this.host = host;
        this.camera = camera;
        this.preferred = backend;
        this.onStatus = onStatus;
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
        this.grid = true;
        this.rulers = true;
        this.disposed = false;
        this.stats = { backend: 'Initializing', frameMs: 0, buildMs: 0, segments: 0, entities: 0, draws: 0 };
        this.background = document.createElement('canvas');
        this.background.className = 'cad-background';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cad-geometry';
        this.overlay = document.createElement('canvas');
        this.overlay.className = 'cad-overlay';
        for (const c of [this.background, this.canvas, this.overlay]) {
            Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
            host.append(c);
        }
        this.bg = this.background.getContext('2d');
        this.ctx = this.overlay.getContext('2d');
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(host);
        this.ready = this.initialize();
    }
    async initialize(skipGPU = false, skipGL = false) {
        this.engine?.dispose();
        let error = '';
        const candidates = [];
        if (!skipGPU && ['auto', 'webgpu'].includes(this.preferred))
            candidates.push(GPUBackend);
        if (!skipGL && ['auto', 'webgpu', 'webgl2'].includes(this.preferred))
            candidates.push(GLBackend);
        candidates.push(CanvasBackend);
        for (const Backend of candidates) {
            const old = this.canvas, newCanvas = document.createElement('canvas');
            newCanvas.className = 'cad-geometry';
            newCanvas.style.cssText = old.style.cssText;
            old.replaceWith(newCanvas);
            this.canvas = newCanvas;
            const e = new Backend(newCanvas, message => this.recover(message, e.name));
            try {
                await e.init();
                if (this.disposed) {
                    e.dispose();
                    return;
                }
                this.engine = e;
                if (this.scene)
                    e.upload(this.scene);
                this.stats.backend = e.name;
                this.resize();
                this.onStatus({ backend: e.name, message: error });
                this.invalidate();
                return;
            }
            catch (err) {
                error += Backend.name + ': ' + err.message + '; ';
                e.dispose();
            }
        }
    }
    recover(message, backend) {
        if (this.recovering || this.disposed)
            return;
        this.recovering = true;
        this.onStatus({ backend: 'Recovering', message });
        this.initialize(true, backend === 'WebGL2').finally(() => this.recovering = false);
    }
    resize() {
        const r = this.host.getBoundingClientRect();
        this.camera.width = Math.max(1, r.width);
        this.camera.height = Math.max(1, r.height);
        for (const c of [this.background, this.canvas, this.overlay]) {
            const w = Math.round(r.width * this.dpr), h = Math.round(r.height * this.dpr);
            if (c.width !== w)
                c.width = w;
            if (c.height !== h)
                c.height = h;
        }
        this.invalidate();
    }
    setDocument(doc) { this.doc = doc; this.sceneDirty = true; this.pendingEntities?.clear(); this.invalidate(); }
    updateEntities(ids) {
        this.pendingEntities ??= new Set();
        for (const id of ids)
            this.pendingEntities.add(id);
        this.invalidate();
    }
    invalidate() {
        if (!this.pending && !this.disposed) {
            this.pending = true;
            requestAnimationFrame(() => { this.pending = false; this.render(); });
        }
    }
    render() {
        if (!this.doc || !this.engine || this.disposed)
            return;
        const start = performance.now(), lod = Math.floor(Math.log2(this.camera.scale || 1));
        if (this.pendingEntities?.size && !this.sceneDirty && this.scene && Math.abs(lod - (this.lod ?? lod)) < 2) {
            const t = performance.now(), ranges = updateSceneEntities(this.scene, this.doc, this.pendingEntities, { tolerance: clamp(.22 / (this.camera.scale * this.dpr), .00001, 3) });
            this.pendingEntities.clear();
            if (ranges === null)
                this.sceneDirty = true;
            else {
                try {
                    this.engine.update?.(this.scene, ranges);
                }
                catch (e) {
                    this.recover(e.message, this.engine.name);
                    return;
                }
                this.stats.updateMs = performance.now() - t;
                this.stats.updatedSegments = ranges.reduce((n, r) => n + r.count, 0);
            }
        }
        if (this.sceneDirty || !this.scene || Math.abs(lod - (this.lod ?? lod)) >= 2) {
            this.lod = lod;
            this.scene = buildScene(this.doc, { tolerance: clamp(.22 / (this.camera.scale * this.dpr), .00001, 3) });
            try {
                this.engine.upload(this.scene);
            }
            catch (e) {
                this.recover(e.message, this.engine.name);
                return;
            }
            this.sceneDirty = false;
            this.pendingEntities?.clear();
            this.stats.buildMs = this.scene.buildMs;
            this.stats.segments = this.scene.count;
            this.stats.entities = this.scene.items.length;
        }
        this.drawBackground();
        try {
            this.engine.draw(this.camera, this.dpr);
        }
        catch (e) {
            this.recover(e.message, this.engine.name);
            return;
        }
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        const view = this.camera.viewport;
        for (const t of this.scene.texts) {
            const pad = t.text.length * t.height;
            if (t.p.x + pad >= view.minX && t.p.x - pad <= view.maxX && t.p.y + t.height >= view.minY && t.p.y - t.height <= view.maxY)
                drawText(ctx, t, this.camera);
        }
        this.drawOverlay?.(ctx, this.camera);
        this.stats.frameMs = performance.now() - start;
        this.stats.draws++;
        this.onFrame?.(this.stats);
    }
    drawBackground() {
        const c = this.bg, cam = this.camera;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, cam.width, cam.height);
        c.fillStyle = '#fbfcfb';
        c.fillRect(0, 0, cam.width, cam.height);
        // Solid fills are rendered behind batched GPU strokes; no painter-order claim is made.
        for (const p of this.scene.paths)
            if (p.fill && intersects(bounds(p.points), cam.viewport)) {
                c.beginPath();
                p.points.forEach((v, i) => { const s = cam.screen(v); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); });
                c.closePath();
                c.fillStyle = p.fill;
                c.globalAlpha = .15;
                c.fill('evenodd');
                c.globalAlpha = 1;
            }
        if (this.grid) {
            let step = 10;
            while (step * cam.scale < 18)
                step *= 5;
            while (step * cam.scale > 90)
                step /= 5;
            this.gridStep = step;
            const b = cam.viewport;
            c.fillStyle = '#cedcda';
            for (let x = Math.ceil(b.minX / step) * step; x <= b.maxX; x += step)
                for (let y = Math.ceil(b.minY / step) * step; y <= b.maxY; y += step) {
                    const p = cam.screen({ x, y });
                    c.beginPath();
                    c.arc(p.x, p.y, .65, 0, Math.PI * 2);
                    c.fill();
                }
        }
        if (this.rulers) {
            c.fillStyle = '#f3f6f4';
            c.fillRect(0, 0, cam.width, 22);
            c.fillRect(0, 0, 22, cam.height);
            c.strokeStyle = '#d9e3df';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(22, 22);
            c.lineTo(cam.width, 22);
            c.moveTo(22, 22);
            c.lineTo(22, cam.height);
            c.stroke();
            let step = 100;
            while (step * cam.scale < 55)
                step *= 2;
            while (step * cam.scale > 180)
                step /= 2;
            c.font = '9px ui-monospace, monospace';
            c.fillStyle = '#99a9a5';
            c.textAlign = 'left';
            c.textBaseline = 'middle';
            const v = cam.viewport;
            for (let x = Math.ceil(v.minX / step) * step; x < v.maxX; x += step) {
                const p = cam.screen({ x, y: 0 });
                if (p.x < 28)
                    continue;
                c.fillText(String(+x.toFixed(3)), p.x + 3, 10);
                c.beginPath();
                c.moveTo(p.x, 17);
                c.lineTo(p.x, 22);
                c.stroke();
            }
            for (let y = Math.ceil(v.minY / step) * step; y < v.maxY; y += step) {
                const p = cam.screen({ x: 0, y });
                if (p.y < 30)
                    continue;
                c.save();
                c.translate(10, p.y);
                c.rotate(-Math.PI / 2);
                c.fillText(String(+y.toFixed(3)), 3, 0);
                c.restore();
            }
        }
    }
    fit() {
        if (this.doc) {
            this.camera.fit(documentBounds(this.doc), Math.min(70, this.camera.width * .1, this.camera.height * .12));
            this.invalidate();
        }
    }
    dispose() {
        this.disposed = true;
        this.resizeObserver.disconnect();
        this.engine?.dispose();
        for (const c of [this.background, this.canvas, this.overlay])
            c.remove();
    }
}

return {Camera,colorRGBA,buildScene,updateSceneEntities,CULL_SHADER,LINE_SHADER,drawPath,drawText,CadRenderer};
})();
// packages/input/src/index.js
__modules["packages/input/src/index.js"]=(()=>{
/** Pointer capture + multi-pointer gesture arbitration, shared by touch, pen, and mouse. */
class PointerController {
    constructor(element, handlers = {}) {
        this.element = element;
        this.handlers = handlers;
        this.pointers = new Map();
        this.abort = new AbortController();
        this.gesture = null;
        this.longTimer = null;
        const opt = { signal: this.abort.signal };
        element.style.touchAction = 'none';
        element.addEventListener('pointerdown', e => this.down(e), opt);
        element.addEventListener('pointermove', e => this.move(e), opt);
        element.addEventListener('pointerup', e => this.up(e), opt);
        element.addEventListener('pointercancel', e => this.up(e, true), opt);
        element.addEventListener('lostpointercapture', e => {
            if (this.pointers.has(e.pointerId))
                this.up(e, true);
        }, opt);
        element.addEventListener('wheel', e => { e.preventDefault(); this.handlers.wheel?.({ ...this.info(e), deltaX: e.deltaX, deltaY: e.deltaY, ctrl: e.ctrlKey }); }, { passive: false, ...opt });
        element.addEventListener('contextmenu', e => { e.preventDefault(); this.handlers.context?.(this.info(e)); }, opt);
    }
    info(e) { const r = this.element.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, pointerType: e.pointerType || 'mouse', pressure: e.pressure || 0, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, button: e.button, buttons: e.buttons, original: e }; }
    pinchState() { const [a, b] = [...this.pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }; }
    down(e) {
        if (e.target.closest?.('button,input,select,textarea,[data-no-canvas]'))
            return;
        e.preventDefault();
        const p = this.info(e);
        try {
            this.element.setPointerCapture(e.pointerId);
        }
        catch { }
        this.pointers.set(e.pointerId, p);
        this.clearLong();
        if (this.pointers.size === 2) {
            this.handlers.cancel?.('pinch');
            this.gesture = this.pinchState();
            this.handlers.gestureStart?.(this.gesture);
            return;
        }
        if (this.pointers.size > 2)
            return;
        this.start = { ...p, time: performance.now() };
        this.handlers.down?.(p);
        if (p.pointerType === 'touch')
            this.longTimer = setTimeout(() => { this.handlers.longPress?.(p); this.longTimer = null; }, 550);
    }
    move(e) {
        const p = this.info(e);
        if (!this.pointers.has(e.pointerId)) {
            this.handlers.hover?.(p);
            return;
        }
        this.pointers.set(e.pointerId, p);
        if (this.gesture && this.pointers.size >= 2) {
            const next = this.pinchState();
            this.handlers.gesture?.({ previous: this.gesture, current: next, scale: next.distance / this.gesture.distance, dx: next.x - this.gesture.x, dy: next.y - this.gesture.y });
            this.gesture = next;
            return;
        }
        if (this.gesture)
            return;
        if (this.start && Math.hypot(p.x - this.start.x, p.y - this.start.y) > 7)
            this.clearLong();
        this.handlers.move?.(p);
    }
    up(e, cancelled = false) {
        if (!this.pointers.has(e.pointerId))
            return;
        const p = this.info(e);
        this.pointers.delete(e.pointerId);
        this.clearLong();
        if (this.gesture) {
            if (this.pointers.size === 0) {
                this.gesture = null;
                this.handlers.gestureEnd?.();
            }
            return;
        }
        if (cancelled)
            this.handlers.cancel?.('pointercancel');
        else
            this.handlers.up?.(p);
        try {
            if (this.element.hasPointerCapture(e.pointerId))
                this.element.releasePointerCapture(e.pointerId);
        }
        catch { }
    }
    clearLong() { clearTimeout(this.longTimer); this.longTimer = null; }
    dispose() { this.clearLong(); this.abort.abort(); this.pointers.clear(); }
}

return {PointerController};
})();
// packages/storage/src/index.js
__modules["packages/storage/src/index.js"]=(()=>{
/** Local-only recovery store. No accounts, telemetry, network upload, or cloud persistence. */
class ProjectStore {
    constructor({ database = 'conduit-cad', onStatus = () => { } } = {}) { this.database = database; this.onStatus = onStatus; this.timer = null; this.ready = this.open(); }
    async open() {
        if (!globalThis.indexedDB)
            return null;
        return new Promise(resolve => {
            const request = indexedDB.open(this.database, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('projects'))
                    db.createObjectStore('projects', { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
    }
    async save(document, id = 'autosave') {
        const value = { id, name: document.name, updatedAt: new Date().toISOString(), document: JSON.parse(JSON.stringify(document)) };
        this.onStatus('saving');
        try {
            const db = await this.ready;
            if (db)
                await new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted')); });
            else
                localStorage.setItem(this.database + ':' + id, JSON.stringify(value));
            this.onStatus('saved');
            return value;
        }
        catch (e) {
            this.onStatus('error', e);
            throw e;
        }
    }
    schedule(document, id = 'autosave') { clearTimeout(this.timer); this.timer = setTimeout(() => { this.save(document, id).catch(() => { }); }, 550); }
    async load(id = 'autosave') {
        try {
            const db = await this.ready;
            if (!db)
                return JSON.parse(localStorage.getItem(this.database + ':' + id) || 'null');
            return await new Promise((resolve, reject) => { const tx = db.transaction('projects', 'readonly'), r = tx.objectStore('projects').get(id); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); });
        }
        catch {
            return null;
        }
    }
    async list() {
        const db = await this.ready;
        if (!db) {
            const saved = await this.load();
            return saved ? [saved] : [];
        }
        return new Promise((resolve, reject) => { const r = db.transaction('projects', 'readonly').objectStore('projects').getAll(); r.onsuccess = () => resolve(r.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); r.onerror = () => reject(r.error); });
    }
    dispose() { clearTimeout(this.timer); this.ready.then(db => db?.close()); }
}
function downloadFile(filename, contents, type = 'application/octet-stream') { const blob = contents instanceof Blob ? contents : new Blob([contents], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }

return {ProjectStore,downloadFile};
})();
// packages/exchange/src/index.js
__modules["packages/exchange/src/index.js"]=(()=>{
const {documentBounds} = __modules["packages/model/src/index.js"];
const {buildScene, Camera, drawPath, drawText} = __modules["packages/renderer/src/index.js"];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function writeSVG(doc, { padding = 24, background = '#ffffff' } = {}) {
    const scene = buildScene(doc, { tolerance: .08 }), b = documentBounds(doc), x = b.minX - padding, y = b.minY - padding, w = b.maxX - b.minX + padding * 2, h = b.maxY - b.minY + padding * 2, parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${-y - h} ${w} ${h}"><title>${esc(doc.name)}</title><rect x="${x}" y="${-y - h}" width="${w}" height="${h}" fill="${esc(background)}"/>`];
    for (const p of scene.paths) {
        const d = p.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(4)} ${(-p.y).toFixed(4)}`).join(' ') + (p.closed ? ' Z' : '');
        parts.push(`<path d="${d}" fill="${p.fill ? esc(p.fill) : 'none'}" ${p.fill ? 'fill-opacity="0.15"' : ''} stroke="${esc(p.color)}" stroke-width="${p.width || 1.5}" stroke-linecap="round" stroke-linejoin="round" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`);
    }
    for (const t of scene.texts) {
        const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
        parts.push(`<text transform="translate(${t.p.x} ${-t.p.y}) rotate(${-t.rotation}) scale(${t.widthFactor || 1} 1)" fill="${esc(t.color)}" font-family="system-ui,sans-serif" font-size="${t.height}" text-anchor="${anchor}">${String(t.text).split('\n').map((line, i) => `<tspan x="0" dy="${i ? t.height * 1.3 : 0}">${esc(line)}</tspan>`).join('')}</text>`);
    }
    parts.push('</svg>');
    return parts.join('\n');
}
async function renderPNG(doc, { width = 2400, padding = 40, background = '#ffffff' } = {}) {
    const b = documentBounds(doc), scene = buildScene(doc, { tolerance: .08 }), aspect = (b.maxY - b.minY + padding * 2) / (b.maxX - b.minX + padding * 2), canvas = document.createElement('canvas');
    canvas.width = Math.min(8192, width);
    canvas.height = Math.min(8192, Math.round(width * aspect));
    const ctx = canvas.getContext('2d'), camera = new Camera();
    camera.width = canvas.width;
    camera.height = canvas.height;
    camera.fit(b, padding);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of scene.paths) {
        if (p.fill) {
            ctx.beginPath();
            p.points.forEach((p, i) => { const s = camera.screen(p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
            ctx.closePath();
            ctx.fillStyle = p.fill;
            ctx.globalAlpha = .15;
            ctx.fill('evenodd');
            ctx.globalAlpha = 1;
        }
        drawPath(ctx, p, camera);
    }
    for (const t of scene.texts)
        drawText(ctx, t, camera);
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
}
function writeBOM(doc) {
    const rows = [['Tag', 'Block', 'Layer', 'X', 'Y', 'Rotation']];
    for (const e of doc.entities)
        if (e.type === 'INSERT')
            rows.push([e.tag || '', e.block, e.layer, e.x, e.y, e.rotation || 0]);
    return rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

return {writeSVG,renderPNG,writeBOM};
})();
// packages/workbench/src/icons.js
__modules["packages/workbench/src/icons.js"]=(()=>{
const paths = {
    logo: 'M5 5h6v6H5z M19 13h6v6h-6z M5 21h6v6H5z M11 8h5a6 6 0 0 1 6 5 M8 11v10 M11 24h5a6 6 0 0 0 6-5',
    select: 'm5 3 14 11-7 1-4 7Z', pan: 'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 4-3 7-7 7h-1c-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l3 3',
    line: 'M5 19 19 5 M3 17h4v4H3z M17 3h4v4h-4z', polyline: 'M4 18 9 5l7 11 5-10 M2 16h4v4H2z M7 3h4v4H7z M14 14h4v4h-4z',
    connect: 'M3 7h5v5h8v5h5 M1 5h4v4H1z M19 15h4v4h-4z', rect: 'M4 5h16v14H4z', circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 9v6 M9 12h6', text: 'M4 5h16 M12 5v15 M8 20h8 M4 5v3 M20 5v3',
    undo: 'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12', redo: 'm15 5 5 5-5 5 M20 10H10a6 6 0 0 0 0 12',
    folder: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h8v3', export: 'M12 16V3 M7 8l5-5 5 5 M4 14v7h16v-7', save: 'M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8',
    plus: 'M12 5v14 M5 12h14', minus: 'M5 12h14', close: 'M5 5l14 14 M19 5 5 19', chevron: 'm8 4 8 8-8 8', down: 'm5 9 7 7 7-7', search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
    layers: 'm12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 17l10 5 10-5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', lock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4', unlock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0',
    properties: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6', grid: 'M4 4h16v16H4z M4 12h16 M12 4v16', snap: 'M5 4v10a7 7 0 0 0 14 0V4h-4v10a3 3 0 0 1-6 0V4z M5 8h4 M15 8h4', ortho: 'M5 4v16h15 M5 15h5v5',
    fit: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z', more: 'M5 12h.01 M12 12h.01 M19 12h.01', trash: 'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7', copy: 'M8 8h13v13H8z M4 16H2V2h14v2', rotate: 'M4 11a8 8 0 1 1 3 7 M4 4v7h7',
    symbols: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 13l5 4.5-5 4.5-5-4.5z', dimension: 'M4 3v18 M20 3v18 M4 12h16 m-11-4-5 4 5 4 m6-8 5 4-5 4', ruler: 'm3 17 14-14 4 4L7 21z M7 13l3 3 M11 9l3 3 M15 5l3 3',
    check: 'm4 12 5 5L20 6', warning: 'm12 3 10 18H2z M12 9v5 M12 17h.01', help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5 M12 17h.01',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-7z', code: 'm8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18', command: 'M8 8H5a3 3 0 1 1 3-3v14a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V5a3 3 0 1 1 3 3z',
    param: 'M3 6h18 M5 12h14 M7 18h10 M8 3v6 M16 9v6 M12 15v6', offset: 'M3 18 9 6h12 M7 21l6-11h10', trim: 'M4 4 20 20 M4 20 20 4 M12 4v16', fillet: 'M4 20V10a6 6 0 0 1 6-6h10', extend: 'M3 20 21 2 M13 3h8v8 M3 13v7h7',
    new: 'M14 2H4v20h16V8z M14 2v6h6 M8 15h8 M12 11v8', screen: 'M3 4h18v14H3z M8 22h8 M12 18v4', touch: 'M8 12V5a2 2 0 0 1 4 0v6l5-1 4 3-2 7H9l-6-7 2-2 3 3', graph: 'M5 5h5v5H5z M15 15h5v5h-5z M5 17h5v5H5z M10 8h7v7 M7 10v7', arrow: 'M4 12h16 M14 6l6 6-6 6',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 ${name === 'logo' ? 32 : 24} ${name === 'logo' ? 32 : 24}" fill="none" stroke="currentColor" stroke-width="${name === 'more' ? 3 : 1.65}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.rect}"/></svg>`; }
function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

return {icon,escapeHTML};
})();
// packages/workbench/src/index.js
__modules["packages/workbench/src/index.js"]=(()=>{
const {bounds, inflate, contains, distance, distanceToSegment, lerp, union, emptyBounds, center, validBounds, snapCandidates, lineIntersection, offsetPolyline, filletLines, matrix, compose, TAU, clamp} = __modules["packages/geometry/src/index.js"];
const {createDocument, validateDocument, entity, line, polyline, rect, circle, text, clone, uid, entityBounds, entityGeometry, documentBounds, layerFor, isVisible, isLocked, ports, moveEntity, transformEntity, explodeEntity, detachReferences} = __modules["packages/model/src/index.js"];
const {History} = __modules["packages/history/src/index.js"];
const {ConstraintSolver, evaluateExpression, resolveParameters} = __modules["packages/constraints/src/index.js"];
const {routeOrthogonal, routePorts, routeVia, graphFromDocument} = __modules["packages/routing/src/index.js"];
const {SYMBOLS, LINE_STYLES, installSymbols, insertSymbol, createDemo} = __modules["packages/symbols/src/index.js"];
const {parseDXF, writeDXF, exportReport} = __modules["packages/dxf/src/index.js"];
const {CadRenderer, Camera, drawPath, drawText} = __modules["packages/renderer/src/index.js"];
const {PointerController} = __modules["packages/input/src/index.js"];
const {ProjectStore, downloadFile} = __modules["packages/storage/src/index.js"];
const {writeSVG, renderPNG, writeBOM} = __modules["packages/exchange/src/index.js"];
const {icon, escapeHTML} = __modules["packages/workbench/src/icons.js"];
const E = escapeHTML;
const TOOL_INFO = { select: ['Select', 'Tap an object to select · drag to move'], pan: ['Pan', 'Drag the drawing · pinch to zoom'], line: ['Line', 'Tap two endpoints, or drag to draw a line'], polyline: ['Polyline', 'Tap vertices · Finish to complete the path'], rect: ['Rectangle', 'Tap opposite corners, or drag a rectangle'], circle: ['Circle', 'Tap the center, then set the radius'], connect: ['Connect', 'Tap a port, then a destination · routes avoid equipment'], text: ['Text', 'Tap the drawing to place editable text'], dimension: ['Dimension', 'Pick two points for an aligned dimension'], insert: ['Place symbol', 'Tap to place · Escape cancels'] };
const btn = (action, label, ic, cls = '', title = label) => `<button type="button" data-action="${action}" class="${cls}" title="${E(title)}" aria-label="${E(label)}">${ic ? icon(ic) : ''}<span>${E(label)}</span></button>`;
const iconButton = (action, ic, label, cls = '') => `<button type="button" data-action="${action}" class="icon-btn ${cls}" title="${E(label)}" aria-label="${E(label)}">${icon(ic)}</button>`;
const format = n => Number.isFinite(n) ? Number(n.toFixed(3)).toString() : '0';
function symbolSVG(block, doc, extra = '') {
    if (!block)
        return icon('symbols');
    const g = entityGeometry({ id: 'preview', type: 'INSERT', block: block.name || block.block, x: 0, y: 0, sx: 1, sy: 1, layer: 'Equipment' }, doc, { tolerance: .4 }), pts = g.paths.flatMap(p => p.points), b = bounds(pts);
    if (!validBounds(b))
        return icon('symbols');
    const pad = 8, view = `${b.minX - pad} ${-b.maxY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
    return `<svg viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${g.paths.map(p => `<path d="${p.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${-p.y}`).join(' ')}${p.closed ? 'Z' : ''}" stroke="currentColor" stroke-width="1.7" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${g.texts.map(t => `<text x="${t.p.x}" y="${-t.p.y}" fill="currentColor" font-size="${t.height}" font-family="system-ui" text-anchor="${t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start'}">${E(t.text)}</text>`).join('')}</svg>`;
}
class Workbench {
    constructor(root, options = {}) {
        if (!root)
            throw new Error('A host element is required');
        this.root = root;
        this.options = options;
        this.doc = options.document || createDemo('pid');
        this.selection = new Set();
        this.tool = 'select';
        this.category = 'P&ID';
        this.librarySearch = '';
        this.inspectorTab = 'properties';
        this.currentLayer = 'Process';
        this.lineStyle = 'process';
        this.gridSnap = true;
        this.objectSnap = true;
        this.ortho = false;
        this.draft = [];
        this.cursor = null;
        this.clipboard = null;
        this.pointer = null;
        this.connectionStart = null;
        this.multi = false;
        this.abort = new AbortController();
        this.solver = new ConstraintSolver();
        this.renderShell();
        const params = new URLSearchParams(globalThis.location?.search || '');
        this.camera = new Camera();
        this.renderer = new CadRenderer(this.$('.viewport'), { camera: this.camera, backend: options.backend || params.get('renderer') || 'auto', onStatus: status => this.rendererStatus(status) });
        this.renderer.drawOverlay = (ctx, cam) => this.drawOverlay(ctx, cam);
        this.renderer.onFrame = stats => this.updateFrame(stats);
        this.renderer.setDocument(this.doc);
        this.store = new ProjectStore({ onStatus: (s, error) => {
                const el = this.$('.save-status');
                if (el)
                    el.innerHTML = s === 'saved' ? `${icon('check')} Saved on device` : s === 'saving' ? 'Saving…' : 'Storage unavailable';
                if (error)
                    this.toast('Autosave unavailable. Export a project copy to keep your work.', true);
            } });
        this.history = new History({ capture: () => this.doc, restore: d => { this.doc = d; this.selection = new Set([...this.selection].filter(id => d.entities.some(e => e.id === id))); this.renderer.setDocument(d); this.updateUI(); }, onChange: () => { this.updateHistory(); this.store.schedule(this.doc); this.root.dispatchEvent(new CustomEvent('conduit:change', { detail: { document: this.doc } })); } });
        this.input = new PointerController(this.$('.viewport'), { down: p => this.pointerDown(p), move: p => this.pointerMove(p), up: p => this.pointerUp(p), hover: p => this.pointerHover(p), cancel: () => this.cancelGesture(), gesture: ({ previous, current, scale, dx, dy }) => { this.camera.zoom(scale, { x: previous.x, y: previous.y }); this.camera.pan(dx, dy); this.renderer.invalidate(); }, wheel: p => {
                if (p.original.shiftKey)
                    this.camera.pan(-p.deltaY, 0);
                else
                    this.camera.zoom(Math.exp(-p.deltaY * .0015), p);
                this.renderer.invalidate();
            }, longPress: p => this.showContext(p), context: p => this.showContext(p) });
        this.bindEvents();
        this.updateUI();
        this.ready = this.initialize(params);
    }
    $(selector) { return this.root.querySelector(selector); }
    async initialize(params) {
        await this.renderer.ready;
        if (!this.options.document && params.get('fresh') !== '1') {
            const saved = await this.store.load();
            if (saved?.document) {
                try {
                    this.doc = installSymbols(validateDocument(saved.document));
                    this.renderer.setDocument(this.doc);
                    this.updateUI();
                    this.toast('Recovered your last drawing from this device.');
                }
                catch { }
            }
        }
        this.renderer.resize();
        this.renderer.fit();
        this.renderer.invalidate();
        return this;
    }
    renderShell() {
        this.root.innerHTML = `<div class="app">
 <header class="appbar"><div class="brand"><span class="logo">${icon('logo')}</span><span class="brand-name">conduit</span><small>CAD</small></div><div class="document-title"><span class="divider"></span><button class="doc-title-button" data-action="rename" title="Rename drawing"><span class="doc-name"></span>${icon('down')}</button><span class="save-status">${icon('check')} Local workspace</span></div><div class="appbar-actions">${btn('new', 'New', 'plus', 'desktop-only', 'Create a drawing')}${btn('open', 'Open DXF', 'folder', 'btn')}${btn('export', 'Export', 'export', 'btn primary')}${iconButton('help', 'help', 'Help & shortcuts', 'desktop-only')}<div class="avatar" title="Local workspace · no account">CC</div></div></header>
 <nav class="workbar" aria-label="Workspace tools"><div class="workspace-label">${icon('symbols')} Design workspace</div>${btn('mode-draw', 'Draw', 'line', 'tab active')}${btn('mode-connect', 'Connect', 'connect', 'tab')}${btn('mode-inspect', 'Inspect', 'properties', 'tab')}<span class="spacer"></span>${btn('parameters', 'Parameters', 'param', 'compact optional')}${btn('line-styles', 'Line styles', 'line', 'compact optional')}<span class="separator desktop-only"></span>${btn('toggle-library', 'Library', 'symbols', 'compact mobile-only')}${iconButton('toggle-inspector', 'properties', 'Properties and layers', 'compact inspector-toggle')}${iconButton('command', 'command', 'Command palette', 'compact optional')}${iconButton('more', 'more', 'More drawing tools', 'compact mobile-only')}</nav>
 <main class="workspace"><aside class="library" aria-label="Symbol library"><div class="panel-heading"><h2>Symbol library <small class="library-count"></small></h2>${iconButton('toggle-library', 'close', 'Close library', 'mobile-only')}</div><p class="panel-subtitle">Drag a symbol. Make a connection.</p><div class="searchbox">${icon('search')}<input id="symbol-search" type="search" placeholder="Find a symbol…" aria-label="Search symbols" autocomplete="off"></div><div class="category-tabs"><button data-category="P&ID" class="active">P&ID</button><button data-category="Electrical">Electrical</button><button data-category="Flow">Flow</button><button data-category="Custom">Custom</button></div><div class="library-scroll"></div><div class="library-footer">${icon('check')} Native DXF blocks · editable geometry</div></aside>
 <section class="canvas-area" aria-label="Drawing canvas"><div class="viewport" tabindex="0" role="application" aria-label="CAD drawing. Use toolbar tools, touch gestures, or keyboard shortcuts."></div><div class="canvas-head"><div class="undo-group">${iconButton('undo', 'undo', 'Undo · Ctrl/⌘ Z')}${iconButton('redo', 'redo', 'Redo · Ctrl/⌘ Shift Z')}</div><div class="render-badge"><span class="dot"></span><span class="backend-name">Initializing</span><span class="stats-text quiet"> · retained renderer</span></div></div><div class="view-label">MODEL SPACE / TOP</div><div class="axis"><svg viewBox="0 0 38 38"><path d="M8 29V5m0 24h24M5 8l3-3 3 3m18 18 3 3-3 3" fill="none" stroke="#9aafa0" stroke-width="1.2"/><text x="2" y="4" font-size="6" fill="#94aa99">Y</text><text x="33" y="33" font-size="6" fill="#94aa99">X</text></svg><span class="unit-label">mm</span></div><div class="zoom-controls">${iconButton('zoom-out', 'minus', 'Zoom out')}<span class="zoom-value">100%</span>${iconButton('zoom-in', 'plus', 'Zoom in')}<span class="separator"></span>${iconButton('fit', 'fit', 'Fit drawing · F')}</div><div class="tool-hint"></div><button class="finish-button hide" data-action="finish">${icon('check')} Finish path</button><nav class="tool-dock" aria-label="Drawing tools">
 ${this.toolButton('select', 'Select', 'select')}${this.toolButton('pan', 'Pan', 'pan', 'mobile-hidden')}${this.toolButton('line', 'Line', 'line')}${this.toolButton('connect', 'Connect', 'connect')}<span class="dock-divider"></span>${this.toolButton('rect', 'Rectangle', 'rect', 'mobile-hidden')}${this.toolButton('circle', 'Circle', 'circle', 'mobile-hidden')}${this.toolButton('text', 'Text', 'text', 'mobile-hidden')}${this.toolButton('dimension', 'Measure', 'dimension', 'desktop-only')}${btn('shapes', 'Shapes', 'rect', 'mobile-only')}${btn('toggle-library', 'Symbols', 'symbols', 'mobile-only')}${btn('toggle-inspector', 'Edit', 'properties', 'mobile-only')}<span class="dock-divider"></span>${btn('more', 'More', 'more', '')}
 </nav></section>
 <aside class="inspector" aria-label="Drawing properties"><div class="inspector-tabs"><button data-inspector="properties" class="active">Properties</button><button data-inspector="layers">Layers</button><button data-inspector="qa">Check</button>${iconButton('toggle-inspector', 'close', 'Close properties', 'mobile-only')}</div><div class="inspector-content"></div></aside><div class="sheet-backdrop" data-action="close-panels"></div></main>
 <footer class="statusbar"><div class="left"><select class="layout-select" aria-label="Drawing layout"></select><span class="status-document"></span><span class="coords">X 0.0   Y 0.0</span></div><div class="right"><button data-action="toggle-grid">GRID</button><button data-action="toggle-snap">SNAP</button><button data-action="toggle-ortho">ORTHO</button><span class="status-extra">1:1</span><span class="stats"></span>${btn('command', 'Command', 'code', 'desktop-only')}</div></footer><input class="file-input hide" type="file" accept=".dxf,.json,.conduit" aria-label="Open DXF or Conduit project"><div class="toast" role="status" aria-live="polite"></div></div>`;
    }
    toolButton(tool, label, ic, cls = '') { return `<button data-tool="${tool}" class="${tool === 'select' ? 'active ' : ''}${cls}" title="${E(label)}" aria-label="${E(label)}" aria-pressed="${tool === 'select'}">${icon(ic)}<span>${E(label)}</span></button>`; }
    bindEvents() {
        const opt = { signal: this.abort.signal };
        this.root.addEventListener('click', e => this.onClick(e), opt);
        this.root.addEventListener('change', e => this.onChange(e), opt);
        this.$('#symbol-search').addEventListener('input', e => { this.librarySearch = e.target.value; this.renderLibrary(); }, opt);
        this.$('.file-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (file)
                this.openFile(file);
            e.target.value = '';
        }, opt);
        this.$('.library-scroll').addEventListener('pointerdown', e => this.libraryPointerDown(e), opt);
        this.$('.viewport').addEventListener('dblclick', () => {
            if (this.tool === 'polyline')
                this.finishPath();
            else if (this.tool === 'select' && this.selection.size === 1) {
                const e = this.selected()[0];
                if (['TEXT', 'MTEXT'].includes(e.type))
                    this.editText(e);
                else
                    this.openPanel('inspector');
            }
        }, opt);
        this.$('.viewport').addEventListener('dragover', e => { e.preventDefault(); }, opt);
        this.$('.viewport').addEventListener('drop', e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file)
                this.openFile(file);
        }, opt);
        document.addEventListener('keydown', e => this.keyDown(e), opt);
        document.addEventListener('keyup', e => {
            if (e.code === 'Space')
                this.space = false;
        }, opt);
        window.addEventListener('blur', () => { this.space = false; this.cancelGesture(); }, opt);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden)
                this.store.save(this.doc).catch(() => { });
        }, opt);
    }
    async onClick(event) {
        const target = event.target.closest('button,[data-action]');
        if (!target)
            return;
        if (target.disabled)
            return;
        if (target.dataset.tool) {
            this.setTool(target.dataset.tool);
            return;
        }
        if (target.dataset.category) {
            this.category = target.dataset.category;
            this.renderLibrary();
            return;
        }
        if (target.dataset.inspector) {
            this.inspectorTab = target.dataset.inspector;
            this.renderInspector();
            return;
        }
        if (target.dataset.symbol) {
            if (this.suppressLibraryClick) {
                this.suppressLibraryClick = false;
                return;
            }
            this.pickSymbol(target.dataset.symbol);
            return;
        }
        if (target.dataset.export) {
            await this.doExport(target.dataset.export);
            return;
        }
        if (target.dataset.selectEntity) {
            this.selectEntity(target.dataset.selectEntity, true);
            return;
        }
        if (target.dataset.layerVisible) {
            this.edit('Layer visibility', () => { const l = this.doc.layers.find(l => l.name === target.dataset.layerVisible); l.visible = !l.visible; });
            return;
        }
        if (target.dataset.layerLock) {
            this.edit('Layer lock', () => { const l = this.doc.layers.find(l => l.name === target.dataset.layerLock); l.locked = !l.locked; });
            return;
        }
        if (target.dataset.constraintDelete) {
            this.edit('Remove constraint', () => { this.doc.constraints = this.doc.constraints.filter(c => c.id !== target.dataset.constraintDelete); });
            return;
        }
        if (target.dataset.demo) {
            this.newDocument(target.dataset.demo);
            return;
        }
        if (target.dataset.style) {
            this.lineStyle = target.dataset.style;
            this.closeModal();
            this.setTool('connect');
            this.toast(LINE_STYLES.find(s => s.id === this.lineStyle).name + ' selected');
            return;
        }
        const action = target.dataset.action;
        if (!action)
            return;
        try {
            await this.action(action);
        }
        catch (error) {
            this.toast(error.message, true);
        }
    }
    async action(action) {
        switch (action) {
            case 'undo':
                this.history.undo();
                break;
            case 'redo':
                this.history.redo();
                break;
            case 'open':
                this.$('.file-input').click();
                break;
            case 'export':
                this.exportDialog();
                break;
            case 'new':
                this.newDialog();
                break;
            case 'rename':
                this.ask('Drawing name', [{ name: 'name', label: 'Name', value: this.doc.name }], v => this.edit('Rename drawing', () => this.doc.name = v.name || 'Untitled drawing'));
                break;
            case 'zoom-in':
                this.camera.zoom(1.25);
                this.renderer.invalidate();
                break;
            case 'zoom-out':
                this.camera.zoom(.8);
                this.renderer.invalidate();
                break;
            case 'fit':
                this.renderer.fit();
                break;
            case 'toggle-library':
                this.togglePanel('library');
                break;
            case 'toggle-inspector':
                this.togglePanel('inspector');
                break;
            case 'close-panels':
                this.closePanels();
                break;
            case 'toggle-grid':
                this.renderer.grid = !this.renderer.grid;
                this.renderer.invalidate();
                this.updateStatus();
                break;
            case 'toggle-snap':
                this.objectSnap = !this.objectSnap;
                this.gridSnap = this.objectSnap;
                this.updateStatus();
                break;
            case 'toggle-ortho':
                this.ortho = !this.ortho;
                this.updateStatus();
                break;
            case 'mode-draw':
                this.setTool('select');
                break;
            case 'mode-connect':
                this.setTool('connect');
                break;
            case 'mode-inspect':
                this.inspectorTab = 'qa';
                this.openPanel('inspector');
                this.renderInspector();
                break;
            case 'line-styles':
                this.lineStylesDialog();
                break;
            case 'more':
                this.moreDialog();
                break;
            case 'shapes':
                this.moreDialog(true);
                break;
            case 'parameters':
                this.parametersDialog();
                break;
            case 'command':
                this.commandDialog();
                break;
            case 'help':
                this.helpDialog();
                break;
            case 'delete':
                this.deleteSelection();
                break;
            case 'duplicate':
                this.duplicateSelection();
                break;
            case 'copy':
                this.copySelection();
                break;
            case 'paste':
                this.pasteSelection();
                break;
            case 'rotate':
                this.rotateSelection(90);
                break;
            case 'rotate-angle':
                this.ask('Rotate selection', [{ name: 'angle', label: 'Angle · degrees or expression', value: '90' }], v => this.rotateSelection(this.eval(v.angle)));
                break;
            case 'offset':
                this.ask('Offset geometry', [{ name: 'amount', label: 'Distance · expression supported', value: '10' }], v => this.offsetSelection(this.eval(v.amount)));
                break;
            case 'fillet':
                this.ask('Fillet two lines', [{ name: 'radius', label: 'Radius', value: '20' }], v => this.filletSelection(this.eval(v.radius)));
                break;
            case 'trim':
                this.trimSelection(false);
                break;
            case 'extend':
                this.trimSelection(true);
                break;
            case 'explode':
                this.explodeSelection();
                break;
            case 'make-symbol':
                this.makeSymbolDialog();
                break;
            case 'constraint':
                this.constraintDialog();
                break;
            case 'finish':
                this.finishPath();
                break;
            case 'add-layer':
                this.ask('Add a layer', [{ name: 'name', label: 'Layer name', value: 'New layer' }], v => this.edit('Add layer', () => {
                    if (this.doc.layers.some(l => l.name === v.name))
                        throw new Error('That layer already exists');
                    this.doc.layers.push({ name: v.name || 'New layer', color: '#4f8c7c', visible: true, locked: false });
                    this.currentLayer = v.name;
                }));
                break;
            case 'select-all':
                this.selection = new Set(this.doc.entities.filter(e => isVisible(e, this.doc)).map(e => e.id));
                this.updateSelection();
                break;
            case 'multi-select':
                this.multi = !this.multi;
                this.setTool('select');
                this.toast(this.multi ? 'Multi-select on: tap objects to add or remove.' : 'Multi-select off');
                break;
            case 'reroute':
                this.edit('Reroute connectors', () => this.reroute());
                break;
            case 'graph':
                downloadFile(this.basename() + '.graph.json', JSON.stringify(graphFromDocument(this.doc), null, 2), 'application/json');
                break;
            case 'precision':
                this.precisionDialog();
                break;
            case 'modal-close':
                this.closeModal();
                break;
            case 'modal-confirm':
                await this.modalConfirm?.();
                break;
            case 'tool-line':
            case 'tool-polyline':
            case 'tool-rect':
            case 'tool-circle':
            case 'tool-text':
            case 'tool-dimension':
            case 'tool-pan':
                this.closeModal();
                this.setTool(action.slice(5));
                break;
            case 'edit-text':
                if (this.selected()[0])
                    this.editText(this.selected()[0]);
                break;
            case 'clear-constraints':
                this.edit('Clear sketch constraints', () => { this.doc.constraints = []; });
                break;
            case 'save-project':
                await this.doExport('project');
                break;
            case 'cancel':
                this.setTool('select');
                break;
            default: throw new Error('Unknown command: ' + action);
        }
        this.hideContext();
    }
    updateUI() { this.$('.doc-name').textContent = this.doc.name; this.$('.unit-label').textContent = this.doc.units; this.$('.layout-select').innerHTML = (this.doc.layouts || ['Model']).map(l => `<option ${l === this.doc.activeLayout ? 'selected' : ''}>${E(l)}</option>`).join(''); this.renderLibrary(); this.renderInspector(); this.updateStatus(); this.updateTools(); this.updateHistory(); }
    updateStatus() {
        this.$('.status-document').textContent = `${this.doc.entities.length} entities · ${this.doc.units}`;
        for (const [action, on] of [['toggle-grid', this.renderer?.grid], ['toggle-snap', this.objectSnap], ['toggle-ortho', this.ortho]]) {
            const b = this.$(`[data-action="${action}"]`);
            b?.classList.toggle('on', !!on);
            b?.setAttribute('aria-pressed', String(!!on));
        }
    }
    updateHistory() {
        for (const action of ['undo', 'redo']) {
            const b = this.$(`[data-action="${action}"]`);
            if (b)
                b.disabled = !(action === 'undo' ? this.history?.canUndo : this.history?.canRedo);
        }
    }
    updateFrame(stats) {
        this.$('.zoom-value').textContent = Math.round(this.camera.scale * 100) + '%';
        this.$('.stats').textContent = `${stats.segments.toLocaleString()} segments · ${stats.frameMs.toFixed(1)} ms CPU`;
        if (this.cursor)
            this.$('.coords').textContent = `X ${this.cursor.x.toFixed(1)}   Y ${this.cursor.y.toFixed(1)}`;
    }
    rendererStatus(s) {
        const el = this.$('.backend-name');
        if (el)
            el.textContent = s.backend;
        this.rendererMessage = s.message || '';
        if (s.message)
            this.$('.render-badge')?.setAttribute('title', s.message);
    }
    selected() { return this.doc.entities.filter(e => this.selection.has(e.id)); }
    eval(source) { return evaluateExpression(source, this.doc.parameters); }
    touch(changed = null) {
        this.doc.version = (this.doc.version || 0) + 1;
        if (changed)
            this.renderer.updateEntities(new Set([...changed, ...(this.lastRoutedIds || [])]));
        else
            this.renderer.setDocument(this.doc);
        this.updateStatus();
    }
    edit(label, action) { this.history.run(label, () => { action(); this.touch(); }); this.updateUI(); }
    updateSelection() { this.renderInspector(); this.renderer.invalidate(); this.root.dispatchEvent(new CustomEvent('conduit:selection', { detail: { ids: [...this.selection] } })); }
    selectEntity(id, focus = false) {
        this.selection = new Set([id]);
        if (focus) {
            const e = this.doc.entities.find(e => e.id === id);
            if (e) {
                const b = entityBounds(e, this.doc);
                if (validBounds(b)) {
                    const c = center(b);
                    this.camera.x = c.x;
                    this.camera.y = c.y;
                    this.camera.scale = Math.max(this.camera.scale, Math.min(2, 150 / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1)));
                }
            }
        }
        this.updateSelection();
    }
    setTool(tool) {
        if (!TOOL_INFO[tool])
            return;
        this.cancelGesture();
        this.tool = tool;
        if (tool !== 'insert')
            this.previewSymbol = null;
        this.draft = [];
        this.connectionStart = null;
        this.preview = null;
        this.snap = null;
        this.closeModal();
        this.hideContext();
        this.updateTools();
        this.renderer.invalidate();
    }
    updateTools() {
        this.root.querySelectorAll('[data-tool]').forEach(b => { b.classList.toggle('active', b.dataset.tool === this.tool); b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool)); });
        this.$('.viewport')?.classList.toggle('drawing', !['select', 'pan'].includes(this.tool));
        this.$('.viewport')?.classList.toggle('panning', this.tool === 'pan');
        let hint = TOOL_INFO[this.tool]?.[1] || '';
        if (this.tool === 'insert')
            hint = `Tap to place ${this.symbolName(this.pendingSymbol)} · drag for precise placement`;
        if (this.tool === 'connect' && this.connectionStart)
            hint = 'Choose a destination port · Escape cancels';
        if (this.draft.length && this.tool !== 'polyline')
            hint = 'Choose the next point · Precision entry is available under More';
        this.$('.tool-hint').textContent = hint;
        this.$('.tool-hint').classList.toggle('working', this.tool !== 'select' && this.tool !== 'pan');
        this.$('.finish-button').classList.toggle('hide', !(this.tool === 'polyline' && this.draft.length >= 2));
        this.root.querySelectorAll('.workbar .tab').forEach(b => b.classList.toggle('active', b.dataset.action === (this.tool === 'connect' ? 'mode-connect' : this.inspectorTab === 'qa' && this.$('.inspector').classList.contains('open') ? 'mode-inspect' : 'mode-draw')));
    }
    isMobile() { return matchMedia('(max-width:720px)').matches; }
    togglePanel(name) {
        const panel = this.$('.' + name);
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
            this.$('.sheet-backdrop').classList.remove('visible');
        }
        else
            this.openPanel(name);
    }
    openPanel(name) {
        if (this.isMobile()) {
            this.$('.library').classList.remove('open');
            this.$('.inspector').classList.remove('open');
            this.$('.sheet-backdrop').classList.add('visible');
        }
        this.$('.' + name).classList.add('open');
        if (name === 'inspector')
            this.renderInspector();
    }
    closePanels() { this.$('.library').classList.remove('open'); this.$('.inspector').classList.remove('open'); this.$('.sheet-backdrop').classList.remove('visible'); }
    symbolName(id) { return SYMBOLS.find(s => s.id === id)?.name || this.doc.blocks[id]?.symbol?.name || id || 'symbol'; }
    renderLibrary() {
        this.$('.library-count').textContent = String(SYMBOLS.length);
        this.root.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b.dataset.category === this.category));
        let items = this.category === 'Custom' ? Object.values(this.doc.blocks).filter(b => !SYMBOLS.some(s => s.block === b.name)).map(b => ({ id: b.name, name: b.symbol?.name || b.name, block: b.name, category: 'Custom' })) : SYMBOLS.filter(s => s.category === this.category);
        const query = this.librarySearch.trim().toLowerCase();
        if (query)
            items = (this.category === 'Custom' ? items : SYMBOLS).filter(s => (s.name + ' ' + s.category + ' ' + s.id).toLowerCase().includes(query));
        const groups = {};
        for (const s of items) {
            let group = this.category === 'P&ID' && !query ? (s.id.includes('valve') ? 'Valves & actuators' : ['pressure-indicator', 'flow-transmitter', 'temperature', 'level-transmitter'].includes(s.id) ? 'Instruments' : s.id === 'reducer' || s.id === 'flange' || s.id === 'offpage' ? 'Fittings & connections' : 'Equipment') : query ? s.category : this.category === 'Custom' ? 'Your DXF blocks' : this.category === 'Electrical' ? 'Components' : 'Diagram shapes';
            (groups[group] ??= []).push(s);
        }
        this.$('.library-scroll').innerHTML = Object.entries(groups).map(([name, items]) => `<section class="library-group"><div class="section-label">${E(name)}<span>${items.length}</span></div><div class="symbol-grid">${items.map(s => `<button class="symbol-card ${this.pendingSymbol === s.id && this.tool === 'insert' ? 'selected' : ''}" data-symbol="${E(s.id)}" title="Place ${E(s.name)}" aria-label="Place ${E(s.name)}">${symbolSVG(this.doc.blocks[s.block], this.doc)}<span>${E(s.name)}</span></button>`).join('')}</div></section>`).join('') || `<div class="list-empty">${icon('symbols')}<br>${this.category === 'Custom' ? 'Select geometry and use Make symbol, or open a DXF with blocks.' : 'No matching symbols.'}</div>`;
    }
    pickSymbol(id) {
        this.pendingSymbol = id;
        this.setTool('insert');
        this.pendingSymbol = id;
        this.previewSymbol = this.symbolAt(id, this.camera.x, this.camera.y, false);
        if (this.isMobile())
            this.closePanels();
        this.renderLibrary();
        this.updateTools();
        this.renderer.invalidate();
    }
    symbolAt(id, x, y, tag = true) {
        const built = SYMBOLS.find(s => s.id === id);
        if (built)
            return insertSymbol(this.doc, id, x, y, { tag: tag ? this.nextTag(id) : '' });
        const block = this.doc.blocks[id];
        if (!block)
            throw new Error('Symbol block is missing');
        return entity('INSERT', { block: id, x, y, sx: 1, sy: 1, rotation: 0, layer: this.currentLayer, tag: tag ? this.nextTag(id) : '' });
    }
    nextTag(id) {
        const prefix = id.includes('valve') ? 'HV' : id.includes('pump') ? 'P' : id === 'heat-exchanger' ? 'E' : id === 'pressure-indicator' ? 'PI' : id === 'flow-transmitter' ? 'FT' : id === 'temperature' ? 'TT' : id.includes('tank') ? 'TK' : id === 'motor' ? 'M' : id === 'resistor' ? 'R' : id === 'capacitor' ? 'C' : 'S';
        let i = 101;
        const tags = new Set(this.doc.entities.map(e => e.tag));
        while (tags.has(prefix + '-' + i))
            i++;
        return prefix + '-' + i;
    }
    placeSymbol(id, p) { let added; this.edit('Insert ' + this.symbolName(id), () => { added = this.symbolAt(id, p.x, p.y); added.layout = this.doc.activeLayout; this.doc.entities.push(added); this.selection = new Set([added.id]); }); this.setTool('select'); this.updateSelection(); this.toast(`${this.symbolName(id)} placed · drag a port to connect`); return added; }
    libraryPointerDown(event) {
        const card = event.target.closest('[data-symbol]');
        if (!card || event.button !== 0)
            return;
        const id = card.dataset.symbol, start = { x: event.clientX, y: event.clientY }, type = event.pointerType;
        let dragging = false, timer = null;
        const abort = new AbortController();
        const begin = () => {
            dragging = true;
            card.style.touchAction = 'none';
            this.pendingSymbol = id;
            this.previewSymbol = this.symbolAt(id, this.camera.x, this.camera.y, false);
            if (this.isMobile())
                this.closePanels();
        };
        if (type === 'touch')
            timer = setTimeout(begin, 280);
        const move = e => {
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!dragging && type !== 'touch' && Math.hypot(dx, dy) > 7)
                begin();
            if (!dragging && type === 'touch' && Math.hypot(dx, dy) > 12) {
                clearTimeout(timer);
                return;
            }
            if (!dragging)
                return;
            e.preventDefault();
            const r = this.$('.viewport').getBoundingClientRect(), screen = { x: e.clientX - r.left, y: e.clientY - r.top };
            this.cursor = this.snapPoint(this.camera.world(screen), new Set());
            this.previewSymbol = this.symbolAt(id, this.cursor.x, this.cursor.y, false);
            this.renderer.invalidate();
        };
        const up = e => {
            clearTimeout(timer);
            abort.abort();
            card.style.touchAction = 'pan-y';
            if (dragging) {
                this.suppressLibraryClick = true;
                this.previewSymbol = null;
                const r = this.$('.viewport').getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                    const p = this.snapPoint(this.camera.world({ x: e.clientX - r.left, y: e.clientY - r.top }), new Set());
                    this.placeSymbol(id, p);
                }
                else
                    this.renderer.invalidate();
            }
        };
        window.addEventListener('pointermove', move, { signal: abort.signal, passive: false });
        window.addEventListener('pointerup', up, { signal: abort.signal, once: true });
        window.addEventListener('pointercancel', () => { clearTimeout(timer); abort.abort(); this.previewSymbol = null; this.renderer.invalidate(); }, { signal: abort.signal, once: true });
    }
    field(name, label, value, full = false, unit = '') { return `<label class="field ${full ? 'full' : ''}"><span>${E(label)}${unit ? `<span class="unit">${E(unit)}</span>` : ''}</span><input data-prop="${name}" value="${E(value ?? '')}" autocomplete="off" spellcheck="false" inputmode="${['tag', 'text'].includes(name) ? 'text' : 'decimal'}" aria-label="${E(label)}"></label>`; }
    renderInspector() {
        const host = this.$('.inspector-content');
        if (!host)
            return;
        const scroll = host.scrollTop;
        this.root.querySelectorAll('[data-inspector]').forEach(b => b.classList.toggle('active', b.dataset.inspector === this.inspectorTab));
        if (this.inspectorTab === 'layers') {
            host.innerHTML = `<div class="section-label">DRAWING LAYERS <span>${this.doc.layers.length}</span></div><p class="muted-note">Hidden layers do not render. Locked layers can be inspected but not moved.</p>${this.doc.layers.map(l => `<div class="layer-row"><input type="color" value="${E(l.color)}" data-layer-color="${E(l.name)}" aria-label="Color of ${E(l.name)}"><span title="${E(l.name)}">${E(l.name)}</span><button data-layer-visible="${E(l.name)}" class="${l.visible ? 'active' : ''}" title="${l.visible ? 'Hide' : 'Show'} ${E(l.name)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${E(l.name)}" aria-pressed="${l.visible}">${icon('eye')}</button><button data-layer-lock="${E(l.name)}" class="${l.locked ? 'active' : ''}" title="${l.locked ? 'Unlock' : 'Lock'} ${E(l.name)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${E(l.name)}" aria-pressed="${l.locked}">${icon(l.locked ? 'lock' : 'unlock')}</button></div>`).join('')}<div style="margin-top:14px">${btn('add-layer', 'Add layer', 'plus', 'btn')}</div><div class="inspector-section"><h3>Active drawing layer</h3><select data-active-layer aria-label="Active drawing layer">${this.doc.layers.map(l => `<option ${l.name === this.currentLayer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></div>`;
            return;
        }
        if (this.inspectorTab === 'qa') {
            const issues = this.checkDrawing();
            host.innerHTML = `<div class="section-label">DRAWING CHECK <span>${issues.length} finding${issues.length !== 1 ? 's' : ''}</span></div>${issues.length ? issues.map(i => `<button class="issue" ${i.entityId ? `data-select-entity="${E(i.entityId)}"` : ''}>${icon(i.severity === 'info' ? 'help' : 'warning')}<span>${E(i.message)}${i.detail ? `<small>${E(i.detail)}</small>` : ''}</span></button>`).join('') : `<div class="list-empty">${icon('check')}<br>No problems found by the implemented checks.</div>`}<div class="hint-box">Checks cover dangling connections, duplicate tags, blocked routes, missing blocks, degenerate geometry and DXF import warnings. This is not engineering or standards certification.</div><div style="margin-top:14px">${btn('reroute', 'Reroute connections', 'connect', 'btn')}${btn('graph', 'Export graph', 'graph', 'btn')}</div>`;
            return;
        }
        const selected = this.selected();
        if (!selected.length) {
            host.innerHTML = `<div class="object-card"><div class="object-preview">${icon('graph')}</div><div class="object-meta"><strong>${E(this.doc.name)}</strong><small>DXF NATIVE · 2D ENGINEERING DRAWING</small></div></div><section class="inspector-section"><h3>Drawing overview</h3><div class="property-list"><div class="property-row"><span>Entities</span><b>${this.doc.entities.length}</b></div><div class="property-row"><span>Symbol instances</span><b>${this.doc.entities.filter(e => e.type === 'INSERT').length}</b></div><div class="property-row"><span>Smart connections</span><b>${this.doc.entities.filter(e => e.connector).length}</b></div><div class="property-row"><span>Units</span><b>${E(this.doc.units)}</b></div><div class="property-row"><span>Current layer</span><b>${E(this.currentLayer)}</b></div></div></section><section class="inspector-section"><h3>Precision tools</h3><div class="operation-grid">${btn('parameters', 'Parameters', 'param')}${btn('precision', 'Draw by values', 'ruler')}${btn('line-styles', 'Line styles', 'line')}${btn('multi-select', 'Multi-select', 'select')}</div></section><section class="inspector-section"><h3>Made for direct editing</h3><div class="hint-box"><strong>Start with a symbol.</strong><br>Drag from the library, or tap one and place it on the canvas. Drag a port to create a routed connection.<br><br>Two fingers pan and zoom. Select an object to reveal its geometry.</div></section><p class="muted-note">Everything stays on this device. Export a project file to preserve constraints, ports and recovery data.</p>`;
            return;
        }
        if (selected.length > 1) {
            let b = emptyBounds();
            for (const e of selected)
                b = union(b, entityBounds(e, this.doc));
            host.innerHTML = `<div class="section-label">${selected.length} OBJECTS SELECTED</div><div class="hint-box">Selection: ${format(b.maxX - b.minX)} × ${format(b.maxY - b.minY)} ${E(this.doc.units)}<br>Shift-click or enable Multi-select to add objects.</div><div class="inspector-section"><h3>Transform & edit</h3><div class="operation-grid">${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate 90°', 'rotate')}${btn('constraint', 'Constrain', 'param')}${btn('make-symbol', 'Make symbol', 'symbols')}${btn('fillet', 'Fillet', 'fillet')}${btn('trim', 'Trim', 'trim')}${btn('extend', 'Extend', 'extend')}${btn('delete', 'Delete', 'trash')}</div></div>${this.constraintsHTML(selected)}`;
            return;
        }
        const e = selected[0], b = entityBounds(e, this.doc), block = e.type === 'INSERT' ? this.doc.blocks[e.block] : null, anchor = e.type === 'INSERT' ? { x: e.x, y: e.y } : e.c || e.p || e.a || e.points?.[0] || { x: 0, y: 0 };
        let fields = this.field('x', 'Position X', format(anchor.x), false, this.doc.units) + this.field('y', 'Position Y', format(anchor.y), false, this.doc.units);
        if (e.type === 'INSERT') {
            fields += this.field('sx', 'Scale X', format(e.sx ?? 1)) + this.field('sy', 'Scale Y', format(e.sy ?? 1)) + this.field('rotation', 'Rotation', format(e.rotation || 0), true, 'deg');
        }
        if (e.type === 'LINE') {
            fields += this.field('x2', 'End X', format(e.b.x)) + this.field('y2', 'End Y', format(e.b.y)) + this.field('length', 'Length', e.parametric?.length ?? format(distance(e.a, e.b)), true, this.doc.units);
        }
        if (e.r !== undefined)
            fields += this.field('radius', 'Radius', e.parametric?.radius ?? format(e.r), true, this.doc.units);
        if (e.parametric?.kind === 'rectangle')
            fields += this.field('rectWidth', 'Width', e.parametric.width, false, this.doc.units) + this.field('rectHeight', 'Height', e.parametric.height, false, this.doc.units);
        if (e.type === 'TEXT' || e.type === 'MTEXT')
            fields += this.field('text', 'Text', e.text, true) + this.field('height', 'Text height', format(e.height)) + this.field('rotation', 'Rotation', format(e.rotation || 0));
        host.innerHTML = `<div class="object-card"><div class="object-preview">${block ? symbolSVG(block, this.doc) : icon(e.connector ? 'connect' : e.type === 'LINE' ? 'line' : e.type === 'CIRCLE' ? 'circle' : 'rect')}</div><div class="object-meta"><strong>${E(e.tag || block?.symbol?.name || e.type)}</strong><small>${E(e.type)}${e.connector ? ' · ROUTED CONNECTION' : e.type === 'INSERT' ? ' · BLOCK REFERENCE' : ' · CAD ENTITY'}</small></div></div><div class="inspector-section"><h3>Identity</h3><div class="fields">${e.type === 'INSERT' ? this.field('tag', 'Equipment tag', e.tag || '', true) : ''}${e.connector ? this.field('label', 'Line label', e.label || '', true) : ''}<label class="field full">Layer<select data-prop="layer">${this.doc.layers.map(l => `<option ${l.name === e.layer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></label></div></div><div class="inspector-section"><h3>Geometry ${isLocked(e, this.doc) ? '· locked' : ''}</h3><div class="fields">${fields}</div></div>${e.connector ? `<div class="inspector-section"><h3>Connection</h3><div class="property-list"><div class="property-row"><span>Routing</span><b>${E(e.connector.status || 'routed')}</b></div><div class="property-row"><span>Start</span><b>${E(e.connector.from?.port || 'Free endpoint')}</b></div><div class="property-row"><span>End</span><b>${E(e.connector.to?.port || 'Free endpoint')}</b></div></div><div style="margin-top:12px">${btn('reroute', 'Reroute', 'connect', 'btn')}</div></div>` : ''}<div class="inspector-section"><h3>Actions</h3><div class="operation-grid">${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate 90°', 'rotate')}${btn('offset', 'Offset', 'offset')}${btn('constraint', 'Constrain', 'param')}${e.type === 'INSERT' ? btn('explode', 'Explode', 'symbols') : btn('make-symbol', 'Make symbol', 'symbols')}${btn('delete', 'Delete', 'trash')}</div></div>${this.constraintsHTML(selected)}<p class="muted-note">Numeric fields accept expressions such as <code>valveSize / 2</code>. Named parameters are managed in Parameters.</p>`;
        host.scrollTop = scroll;
    }
    constraintsHTML(selected) { const ids = new Set(selected.map(e => e.id)), cs = this.doc.constraints.filter(c => (c.entities || [c.entityId]).some(id => ids.has(id))); return cs.length ? `<div class="inspector-section"><h3>Sketch constraints</h3>${cs.map(c => `<div class="constraint-item">${icon('param')}<span>${E(c.type)}${c.value !== undefined ? ' = ' + E(c.value) : ''}</span><button data-constraint-delete="${E(c.id)}" title="Remove constraint">${icon('close')}</button></div>`).join('')}</div>` : ''; }
    onChange(event) {
        const t = event.target;
        try {
            if (t.dataset.activeLayer !== undefined) {
                this.currentLayer = t.value;
                this.updateStatus();
                return;
            }
            if (t.classList.contains('layout-select')) {
                this.doc.activeLayout = t.value;
                this.selection.clear();
                this.renderer.setDocument(this.doc);
                this.renderer.fit();
                this.updateSelection();
                return;
            }
            if (t.dataset.layerColor) {
                this.edit('Layer color', () => this.doc.layers.find(l => l.name === t.dataset.layerColor).color = t.value);
                return;
            }
            if (t.dataset.prop) {
                const selected = this.selected();
                if (selected.length !== 1)
                    return;
                const e = selected[0];
                if (isLocked(e, this.doc))
                    throw new Error('Unlock the layer before editing geometry');
                this.edit('Edit ' + t.dataset.prop, () => { this.setProperty(e, t.dataset.prop, t.value); this.solveConstraints(); this.reroute(new Set([e.id])); });
            }
        }
        catch (error) {
            this.toast(error.message, true);
            this.renderInspector();
        }
    }
    setProperty(e, key, source) {
        if (['tag', 'text', 'label', 'layer'].includes(key)) {
            e[key] = source;
            e.dirty = true;
            return;
        }
        const v = this.eval(source);
        if (Math.abs(v) > 1e12)
            throw new Error('Value is outside the supported drawing range');
        const anchor = e.type === 'INSERT' ? { x: e.x, y: e.y } : e.c || e.p || e.a || e.points?.[0];
        if (key === 'x' || key === 'y') {
            if (!anchor)
                throw new Error('Entity has no editable anchor');
            moveEntity(e, key === 'x' ? v - anchor.x : 0, key === 'y' ? v - anchor.y : 0);
        }
        else if (key === 'x2' || key === 'y2') {
            if (e.b)
                e.b[key === 'x2' ? 'x' : 'y'] = v;
        }
        else if (key === 'radius') {
            if (v <= 0)
                throw new Error('Radius must be positive');
            e.r = v;
            e.parametric = { ...e.parametric, radius: source };
        }
        else if (key === 'length') {
            if (v <= 0)
                throw new Error('Length must be positive');
            const d = distance(e.a, e.b) || 1;
            e.b = { x: e.a.x + (e.b.x - e.a.x) * v / d, y: e.a.y + (e.b.y - e.a.y) * v / d };
            e.parametric = { ...e.parametric, length: source };
        }
        else if (key === 'rectWidth' || key === 'rectHeight') {
            if (v <= 0)
                throw new Error('Rectangle dimensions must be positive');
            e.parametric[key === 'rectWidth' ? 'width' : 'height'] = source;
            this.evaluateParametric(e);
        }
        else if (key === 'rotation') {
            e.rotation = v;
        }
        else if (key === 'height') {
            if (v <= 0)
                throw new Error('Text height must be positive');
            e.height = v;
        }
        else if (key === 'sx' || key === 'sy') {
            if (Math.abs(v) < 1e-8)
                throw new Error('Scale must be nonzero');
            e[key] = v;
        }
        e.dirty = true;
    }
    evaluateParametric(e) {
        const p = e.parametric;
        if (!p)
            return;
        if (p.radius !== undefined) {
            e.r = this.eval(p.radius);
            if (e.r <= 0)
                throw new Error('Radius must be positive');
        }
        if (p.length !== undefined && e.a && e.b) {
            const n = this.eval(p.length), d = distance(e.a, e.b) || 1;
            if (n <= 0)
                throw new Error('Line length must be positive');
            e.b = { x: e.a.x + (e.b.x - e.a.x) * n / d, y: e.a.y + (e.b.y - e.a.y) * n / d };
        }
        if (p.kind === 'rectangle') {
            const w = this.eval(p.width), h = this.eval(p.height);
            if (w <= 0 || h <= 0)
                throw new Error('Rectangle dimensions must be positive');
            const a = e.points[0], angle = Math.atan2(e.points[1].y - a.y, e.points[1].x - a.x), c = Math.cos(angle), s = Math.sin(angle);
            e.points = [{ ...a }, { x: a.x + c * w, y: a.y + s * w }, { x: a.x + c * w - s * h, y: a.y + s * w + c * h }, { x: a.x - s * h, y: a.y + c * h }];
        }
    }
    solveConstraints() {
        if (!this.doc.constraints.length)
            return;
        const result = this.solver.solve(this.doc.entities, this.doc.constraints, this.doc.parameters);
        this.lastSolve = result;
        if (!result.converged)
            throw new Error(`Constraints conflict or did not converge (residual ${result.residual.toPrecision(3)}). The edit was rolled back.`);
    }
    checkDrawing() {
        const issues = [], tags = new Map(), map = new Map(this.doc.entities.map(e => [e.id, e]));
        for (const e of this.doc.entities) {
            if (e.tag) {
                if (tags.has(e.tag))
                    issues.push({ severity: 'warning', entityId: e.id, message: 'Duplicate equipment tag: ' + e.tag });
                tags.set(e.tag, e.id);
            }
            if (e.type === 'INSERT' && !this.doc.blocks[e.block])
                issues.push({ severity: 'warning', entityId: e.id, message: 'Missing block definition: ' + e.block });
            if (e.type === 'LINE' && distance(e.a, e.b) < 1e-7)
                issues.push({ severity: 'warning', entityId: e.id, message: 'Zero-length line' });
            if (e.r !== undefined && e.r <= 0)
                issues.push({ severity: 'warning', entityId: e.id, message: 'Nonpositive radius' });
            if (e.connector) {
                for (const key of ['from', 'to']) {
                    const ref = e.connector[key], target = ref && map.get(ref.entityId);
                    if (!target)
                        issues.push({ severity: 'warning', entityId: e.id, message: `Connection has a free ${key === 'from' ? 'start' : 'end'} endpoint`, detail: e.label || e.id });
                    else if (!ports(target, this.doc).some(p => p.name === ref.port))
                        issues.push({ severity: 'warning', entityId: e.id, message: 'Connection references a missing port' });
                }
                if (e.connector.status === 'blocked')
                    issues.push({ severity: 'warning', entityId: e.id, message: 'No collision-free orthogonal route was found', detail: 'Move equipment or edit the connector route.' });
            }
        }
        const seen = new Set();
        for (const i of this.doc.importDiagnostics || [])
            if (i.severity === 'warning' && !seen.has(i.message)) {
                issues.push(i);
                seen.add(i.message);
            }
        return issues;
    }
    nearby(p, tolerance = 18) { const r = tolerance / this.camera.scale; return this.renderer.scene?.index.search({ minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r }) || []; }
    hitTest(p, tolerance = 12) {
        let hit = null, best = tolerance / this.camera.scale;
        for (const item of this.nearby(p, tolerance).reverse()) {
            const e = item.entity;
            if (!e || !isVisible(e, this.doc))
                continue;
            const g = entityGeometry(e, this.doc, { tolerance: .5 / this.camera.scale });
            let d = Infinity;
            for (const path of g.paths)
                for (let i = 1; i < path.points.length; i++)
                    d = Math.min(d, distanceToSegment(p, path.points[i - 1], path.points[i]));
            if (['INSERT', 'TEXT', 'MTEXT', 'SOLID'].includes(e.type) && contains(item, p))
                d = Math.min(d, 3 / this.camera.scale);
            if (d <= best) {
                best = d;
                hit = e;
            }
        }
        return hit;
    }
    portAt(p, { selectedOnly = false, tolerance = 20 } = {}) {
        let found = null, best = tolerance / this.camera.scale;
        for (const item of this.nearby(p, tolerance + 20)) {
            const e = item.entity;
            if (e.type !== 'INSERT' || (selectedOnly && !this.selection.has(e.id)))
                continue;
            for (const port of ports(e, this.doc)) {
                const d = distance(p, port);
                if (d < best) {
                    best = d;
                    found = port;
                }
            }
        }
        return found;
    }
    snapPoint(p, exclude = new Set(), base = null) {
        let best = null, bestDistance = 14 / this.camera.scale;
        this.snap = null;
        if (this.objectSnap) {
            const near = this.nearby(p, 20).filter(i => !exclude.has(i.id)), lines = [];
            for (const item of near) {
                const e = item.entity, candidates = [...snapCandidates(e), ...ports(e, this.doc).map(p => ({ ...p, kind: 'port' }))];
                if (e.type === 'LINE')
                    lines.push(e);
                for (const c of candidates) {
                    const d = distance(c, p);
                    if (d < bestDistance) {
                        bestDistance = d;
                        best = { ...c, entityId: e.id };
                    }
                }
            }
            for (let i = 0; i < Math.min(lines.length, 16); i++)
                for (let j = i + 1; j < Math.min(lines.length, 16); j++) {
                    const q = lineIntersection(lines[i].a, lines[i].b, lines[j].a, lines[j].b);
                    if (q && distance(q, p) < bestDistance) {
                        bestDistance = distance(q, p);
                        best = { x: q.x, y: q.y, kind: 'intersection' };
                    }
                }
        }
        if (best) {
            this.snap = best;
            return { x: best.x, y: best.y };
        }
        let result = { ...p };
        if (this.gridSnap) {
            let step = 10;
            try {
                step = Math.abs(this.eval(this.doc.parameters.grid || 10)) || 10;
            }
            catch { }
            result = { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
        }
        if ((this.ortho || this.shift) && base) {
            if (Math.abs(result.x - base.x) > Math.abs(result.y - base.y))
                result.y = base.y;
            else
                result.x = base.x;
        }
        return result;
    }
    connectionPoint(p) {
        const port = this.portAt(p);
        if (port)
            return { p: { x: port.x, y: port.y, dx: port.dx, dy: port.dy, entityId: port.entityId }, ref: { entityId: port.entityId, port: port.name }, port };
        const hit = this.hitTest(p);
        if (hit?.type === 'INSERT') {
            const nearest = ports(hit, this.doc).sort((a, b) => distance(p, a) - distance(p, b))[0];
            if (nearest)
                return { p: nearest, ref: { entityId: hit.id, port: nearest.name }, port: nearest };
        }
        return { p: this.snapPoint(p), ref: null };
    }
    obstacles() { return this.doc.entities.filter(e => e.type === 'INSERT' && isVisible(e, this.doc)).map(e => { const points = entityGeometry(e, this.doc, { tolerance: 1 }).paths.flatMap(p => p.points); return { ...bounds(points), id: e.id }; }).filter(validBounds); }
    routeConnection(start, end, waypoints = []) {
        const obstacles = this.obstacles();
        if (waypoints.length)
            return routeVia(start.p, end.p, waypoints, obstacles.filter(b => b.id !== start.ref?.entityId && b.id !== end.ref?.entityId), { clearance: 12 });
        return routePorts({ ...start.p, entityId: start.ref?.entityId }, { ...end.p, entityId: end.ref?.entityId }, obstacles, { clearance: 12, lead: 22 });
    }
    createConnector(start, end) {
        if (distance(start.p, end.p) < 1e-6) {
            this.toast('Choose a different destination.');
            return;
        }
        const style = LINE_STYLES.find(s => s.id === this.lineStyle) || LINE_STYLES[0], route = this.routeConnection(start, end);
        let added;
        this.edit('Create routed connector', () => { added = polyline(route.points, false, { layer: style.layer, color: style.color, width: style.width, dash: style.dash, layout: this.doc.activeLayout, label: '', connector: { from: start.ref, to: end.ref, style: style.id, arrow: style.arrow, status: route.status, waypoints: [] } }); this.doc.entities.push(added); this.selection = new Set([added.id]); });
        if (route.status === 'blocked')
            this.toast('A clear route was not found. The connection is flagged in Check.', true);
        this.connectionStart = null;
        this.preview = null;
        this.updateTools();
        return added;
    }
    reroute(changed = null) {
        this.lastRoutedIds = new Set();
        const obstacles = this.obstacles(), map = new Map(this.doc.entities.map(e => [e.id, e]));
        for (const e of this.doc.entities) {
            const c = e.connector;
            if (!c || (!c.from && !c.to))
                continue;
            if (changed && !changed.has(c.from?.entityId) && !changed.has(c.to?.entityId) && !changed.has(e.id))
                continue;
            const endpoint = (ref, fallback) => { const p = ref && ports(map.get(ref.entityId) || {}, this.doc).find(p => p.name === ref.port); return { p: p || fallback, ref: p ? ref : null }; };
            const a = endpoint(c.from, e.points[0]), b = endpoint(c.to, e.points.at(-1)), obs = obstacles.filter(o => o.id !== a.ref?.entityId && o.id !== b.ref?.entityId);
            const route = c.waypoints?.length ? routeVia(a.p, b.p, c.waypoints, obs, { clearance: 12 }) : routePorts({ ...a.p, entityId: a.ref?.entityId }, { ...b.p, entityId: b.ref?.entityId }, obstacles, { clearance: 12, lead: 22 });
            e.points = route.points;
            c.status = route.status;
            e.dirty = true;
            this.lastRoutedIds.add(e.id);
        }
    }
    grips(e) {
        if (e.type === 'LINE' || e.type === 'DIMENSION')
            return [{ ...e.a, key: 'a' }, { ...e.b, key: 'b' }];
        if (e.type === 'CIRCLE' || e.type === 'ARC')
            return [{ ...e.c, key: 'c' }, { x: e.c.x + e.r, y: e.c.y, key: 'radius' }];
        if (e.type === 'INSERT') {
            const b = bounds(entityGeometry(e, this.doc, { tolerance: 1 }).paths.flatMap(p => p.points));
            return validBounds(b) ? [{ x: b.maxX, y: b.minY, key: 'scale' }, { x: (b.minX + b.maxX) / 2, y: b.maxY + 25 / this.camera.scale, key: 'rotate' }] : [];
        }
        if (e.points)
            return e.points.map((p, i) => ({ ...p, key: 'point', index: i }));
        if (e.p)
            return [{ ...e.p, key: 'p' }];
        return [];
    }
    pointerDown(p) {
        if (this.modal)
            return;
        this.hideContext();
        this.shift = p.shift;
        const world = this.camera.world(p);
        this.pointer = p;
        this.lastScreen = p;
        this.downScreen = { x: p.x, y: p.y };
        const tolerance = p.pointerType === 'touch' ? 22 : 12;
        if (this.tool === 'pan' || this.space || p.button === 1) {
            this.drag = { kind: 'pan', last: p };
            return;
        }
        if (this.tool === 'select') {
            if (this.selection.size === 1) {
                const e = this.selected()[0];
                if (e && !isLocked(e, this.doc)) {
                    const grip = this.grips(e).find(g => distance(g, world) < tolerance / this.camera.scale);
                    if (grip) {
                        this.history.begin('Edit grip');
                        this.drag = { kind: 'grip', id: e.id, grip, original: clone(e), start: world };
                        return;
                    }
                }
            }
            const port = this.portAt(world, { selectedOnly: true, tolerance: p.pointerType === 'touch' ? 18 : 10 });
            if (port) {
                this.connectionStart = { p: port, ref: { entityId: port.entityId, port: port.name } };
                this.drag = { kind: 'connect-start', fromSelect: true, start: world };
                return;
            }
            const hit = this.hitTest(world, tolerance);
            if (hit) {
                if (p.shift || this.multi) {
                    if (this.selection.has(hit.id))
                        this.selection.delete(hit.id);
                    else
                        this.selection.add(hit.id);
                }
                else if (!this.selection.has(hit.id))
                    this.selection = new Set([hit.id]);
                this.updateSelection();
                if (!isLocked(hit, this.doc) && this.selection.has(hit.id)) {
                    this.history.begin('Move selection');
                    this.drag = { kind: 'move', start: world, originals: this.selected().filter(e => !isLocked(e, this.doc)).map(clone) };
                }
                else
                    this.drag = { kind: 'tap' };
            }
            else {
                if (!p.shift && !this.multi) {
                    this.selection.clear();
                    this.updateSelection();
                }
                this.drag = p.pointerType === 'touch' && !this.multi ? { kind: 'pan', last: p } : { kind: 'marquee', start: world, current: world, additive: p.shift || this.multi };
            }
            return;
        }
        if (this.tool === 'connect') {
            if (!this.connectionStart) {
                this.connectionStart = this.connectionPoint(world);
                this.drag = { kind: 'connect-start', start: world };
            }
            else
                this.drag = { kind: 'connect-end', start: world };
            this.updateTools();
            return;
        }
        if (this.tool === 'insert') {
            this.drag = { kind: 'insert' };
            this.cursor = this.snapPoint(world);
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
            this.renderer.invalidate();
            return;
        }
        if (this.tool === 'text') {
            this.drag = { kind: 'text', p: this.snapPoint(world) };
            return;
        }
        const q = this.snapPoint(world, new Set(), this.draft.at(-1));
        this.cursor = q;
        this.drag = { kind: 'draw', start: q, wasDraft: !!this.draft.length };
        this.preview = this.makePreview(q, q);
        this.renderer.invalidate();
    }
    pointerMove(p) {
        this.shift = p.shift;
        this.pointer = p;
        this.lastScreen = p;
        const raw = this.camera.world(p), drag = this.drag;
        if (!drag) {
            this.pointerHover(p);
            return;
        }
        if (drag.kind === 'pan') {
            this.camera.pan(p.x - drag.last.x, p.y - drag.last.y);
            drag.last = p;
            this.renderer.invalidate();
            return;
        }
        if (drag.kind === 'move') {
            const start = drag.start;
            let dx = raw.x - start.x, dy = raw.y - start.y;
            const original = drag.originals[0];
            if (original) {
                const anchor = original.type === 'INSERT' ? { x: original.x, y: original.y } : original.a || original.c || original.p || original.points?.[0] || start, q = this.snapPoint({ x: anchor.x + dx, y: anchor.y + dy }, this.selection, anchor);
                dx = q.x - anchor.x;
                dy = q.y - anchor.y;
            }
            for (const old of drag.originals) {
                const i = this.doc.entities.findIndex(e => e.id === old.id), next = clone(old);
                moveEntity(next, dx, dy);
                this.doc.entities[i] = next;
            }
            this.cursor = { x: start.x + dx, y: start.y + dy };
            this.reroute(this.selection);
            this.touch(this.selection);
            return;
        }
        if (drag.kind === 'grip') {
            const i = this.doc.entities.findIndex(e => e.id === drag.id), e = clone(drag.original), g = drag.grip, q = this.snapPoint(raw, this.selection);
            if (g.key === 'radius') {
                e.r = Math.max(.001, distance(e.c, q));
                e.parametric = { ...e.parametric, radius: String(e.r) };
            }
            else if (g.key === 'scale') {
                const startLength = distance(drag.start, { x: e.x, y: e.y }) || 1, scale = Math.max(.01, distance(q, { x: e.x, y: e.y }) / startLength);
                e.sx = (e.sx ?? 1) * scale;
                e.sy = (e.sy ?? 1) * scale;
            }
            else if (g.key === 'rotate') {
                const startAngle = Math.atan2(drag.start.y - e.y, drag.start.x - e.x), angle = Math.atan2(q.y - e.y, q.x - e.x);
                e.rotation = (e.rotation || 0) + (angle - startAngle) * 180 / Math.PI;
                if (this.gridSnap)
                    e.rotation = Math.round(e.rotation / 15) * 15;
            }
            else if (g.key === 'point') {
                if (e.parametric?.kind === 'rectangle') {
                    const opposite = e.points[(g.index + 2) % 4], x = Math.min(q.x, opposite.x), y = Math.min(q.y, opposite.y), w = Math.abs(q.x - opposite.x), h = Math.abs(q.y - opposite.y);
                    if (w > .001 && h > .001) {
                        e.points = rect(x, y, w, h).points;
                        e.parametric = { kind: 'rectangle', width: String(w), height: String(h) };
                    }
                }
                else {
                    e.points[g.index] = { ...q };
                    if (e.connector) {
                        if (g.index === 0)
                            e.connector.from = this.connectionPoint(raw).ref;
                        else if (g.index === e.points.length - 1)
                            e.connector.to = this.connectionPoint(raw).ref;
                        e.connector.waypoints = e.points.slice(1, -1).map(p => ({ ...p }));
                        e.connector.status = 'manual';
                    }
                    e.parametric = undefined;
                }
            }
            else
                e[g.key] = { ...q };
            this.doc.entities[i] = e;
            e.dirty = true;
            this.cursor = q;
            this.reroute(new Set([e.id]));
            this.touch(new Set([e.id]));
            return;
        }
        if (drag.kind === 'marquee') {
            drag.current = raw;
            this.renderer.invalidate();
            return;
        }
        this.cursor = this.snapPoint(raw, new Set(), this.draft.at(-1) || drag.start);
        if (drag.kind === 'connect-start' || drag.kind === 'connect-end') {
            const end = this.connectionPoint(raw), route = this.routeConnection(this.connectionStart, end), style = LINE_STYLES.find(s => s.id === this.lineStyle);
            this.preview = polyline(route.points, false, { color: style.color, dash: style.dash, width: style.width });
            this.snap = end.port ? { ...end.port, kind: 'port' } : this.snap;
        }
        else if (drag.kind === 'insert')
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
        else if (drag.kind === 'draw')
            this.preview = this.makePreview(this.draft[0] || drag.start, this.cursor);
        this.renderer.invalidate();
    }
    pointerHover(p) {
        this.lastScreen = p;
        this.shift = p.shift;
        const world = this.camera.world(p);
        this.cursor = this.snapPoint(world, new Set(), this.draft.at(-1));
        if (this.tool === 'insert' && this.pendingSymbol)
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
        else if (this.tool === 'connect' && this.connectionStart) {
            const end = this.connectionPoint(world), r = this.routeConnection(this.connectionStart, end), s = LINE_STYLES.find(s => s.id === this.lineStyle);
            this.preview = polyline(r.points, false, { color: s.color, width: s.width, dash: s.dash });
            this.snap = end.port ? { ...end.port, kind: 'port' } : this.snap;
        }
        else if (this.draft.length)
            this.preview = this.makePreview(this.draft[0], this.cursor);
        else if (this.tool === 'select') {
            this.hoveredPort = this.portAt(world, { selectedOnly: true, tolerance: 14 });
        }
        this.renderer.invalidate();
    }
    pointerUp(p) {
        const drag = this.drag;
        if (!drag)
            return;
        const moved = Math.hypot(p.x - this.downScreen.x, p.y - this.downScreen.y), raw = this.camera.world(p);
        this.pointer = null;
        this.drag = null;
        try {
            if (drag.kind === 'move' || drag.kind === 'grip') {
                if (moved > 2) {
                    try {
                        this.solveConstraints();
                        this.reroute(this.selection);
                        this.touch();
                        this.history.commit();
                    }
                    catch (e) {
                        this.history.cancel();
                        throw e;
                    }
                }
                else
                    this.history.cancel();
                this.renderInspector();
                this.preview = null;
                this.snap = null;
                this.renderer.invalidate();
                return;
            }
            if (drag.kind === 'marquee') {
                const b = bounds([drag.start, drag.current]), crossing = drag.current.x < drag.start.x;
                for (const item of this.renderer.scene.index.search(b)) {
                    if (crossing || (item.minX >= b.minX && item.maxX <= b.maxX && item.minY >= b.minY && item.maxY <= b.maxY))
                        this.selection.add(item.id);
                }
                this.updateSelection();
                return;
            }
            if (drag.kind === 'connect-start' || drag.kind === 'connect-end') {
                if (drag.kind === 'connect-end' || moved > 6) {
                    const added = this.createConnector(this.connectionStart, this.connectionPoint(raw));
                    if (added && drag.fromSelect)
                        this.setTool('select');
                }
                else if (drag.fromSelect) {
                    const start = this.connectionStart;
                    this.setTool('connect');
                    this.connectionStart = start;
                }
                this.preview = null;
                this.updateTools();
                this.renderer.invalidate();
                return;
            }
            if (drag.kind === 'insert') {
                const id = this.pendingSymbol;
                this.previewSymbol = null;
                this.placeSymbol(id, this.snapPoint(raw));
                return;
            }
            if (drag.kind === 'text') {
                this.ask('Place text', [{ name: 'text', label: 'Text', value: 'Label' }, { name: 'height', label: 'Text height · ' + this.doc.units, value: '14' }], v => { this.edit('Add text', () => this.doc.entities.push(text(drag.p, v.text, this.eval(v.height), { layer: 'Annotations', layout: this.doc.activeLayout }))); this.setTool('select'); });
                return;
            }
            if (drag.kind === 'draw') {
                const end = this.snapPoint(raw, new Set(), this.draft.at(-1) || drag.start);
                if (this.tool === 'polyline') {
                    if (!this.draft.length)
                        this.draft.push(drag.start);
                    if (moved > 5 || drag.wasDraft) {
                        if (distance(this.draft.at(-1), end) > .001)
                            this.draft.push(end);
                    }
                    this.preview = null;
                    this.updateTools();
                    this.renderer.invalidate();
                    return;
                }
                if (drag.wasDraft) {
                    this.finishShape(this.draft[0], end);
                    this.draft = [];
                }
                else if (moved > 6)
                    this.finishShape(drag.start, end);
                else
                    this.draft = [drag.start];
                this.preview = null;
                this.updateTools();
                this.renderer.invalidate();
            }
        }
        catch (error) {
            if (this.history.pending)
                this.history.cancel();
            this.toast(error.message, true);
        }
    }
    makePreview(a, b) {
        const props = { layer: this.currentLayer, color: '#259e87', width: 1.7 };
        if (this.tool === 'line')
            return line(a, b, props);
        if (this.tool === 'polyline')
            return polyline([...this.draft, b], false, props);
        if (this.tool === 'rect')
            return rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), props);
        if (this.tool === 'circle')
            return circle(a, distance(a, b), props);
        if (this.tool === 'dimension')
            return entity('DIMENSION', { a, b, offset: 30, height: 12, ...props });
        return null;
    }
    finishShape(a, b) {
        if (distance(a, b) < .001)
            return;
        let added = this.makePreview(a, b);
        if (!added)
            return;
        delete added.color;
        added.layout = this.doc.activeLayout;
        if (added.type === 'LWPOLYLINE' && this.tool === 'rect') {
            const box = bounds(added.points);
            if (box.maxX - box.minX < .001 || box.maxY - box.minY < .001)
                return;
            added.parametric = { kind: 'rectangle', width: String(box.maxX - box.minX), height: String(box.maxY - box.minY) };
        }
        if (added.type === 'DIMENSION')
            added.layer = 'Annotations';
        this.edit('Draw ' + TOOL_INFO[this.tool][0], () => { this.doc.entities.push(added); this.selection = new Set([added.id]); });
        this.updateSelection();
    }
    finishPath() {
        if (this.tool !== 'polyline' || this.draft.length < 2)
            return;
        this.edit('Draw polyline', () => { const e = polyline(this.draft, false, { layer: this.currentLayer, layout: this.doc.activeLayout }); this.doc.entities.push(e); this.selection = new Set([e.id]); });
        this.draft = [];
        this.preview = null;
        this.setTool('select');
    }
    cancelGesture() {
        if (this.history?.pending)
            this.history.cancel();
        this.drag = null;
        this.pointer = null;
        this.preview = null;
        this.snap = null;
        this.renderer?.invalidate();
    }
    drawOverlay(ctx, cam) {
        ctx.save();
        const selected = this.selected();
        for (const e of selected) {
            if (!isVisible(e, this.doc))
                continue;
            const g = entityGeometry(e, this.doc, { tolerance: .4 / cam.scale });
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#279b80', width: 2.3 });
            const b = entityBounds(e, this.doc);
            if (validBounds(b)) {
                const a = cam.screen({ x: b.minX, y: b.maxY }), z = cam.screen({ x: b.maxX, y: b.minY });
                ctx.strokeStyle = '#77bfa8';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(a.x - 7, a.y - 7, z.x - a.x + 14, z.y - a.y + 14);
                ctx.setLineDash([]);
            }
            if (selected.length === 1 && !isLocked(e, this.doc))
                for (const g of this.grips(e)) {
                    const s = cam.screen(g);
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#16846e';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    if (g.key === 'rotate')
                        ctx.arc(s.x, s.y, 5, 0, TAU);
                    else
                        ctx.rect(s.x - 4, s.y - 4, 8, 8);
                    ctx.fill();
                    ctx.stroke();
                }
        }
        if (this.tool === 'connect' || this.tool === 'select') {
            const visible = this.tool === 'connect' ? this.doc.entities.filter(e => e.type === 'INSERT' && isVisible(e, this.doc)) : selected;
            for (const e of visible)
                for (const port of ports(e, this.doc)) {
                    const s = cam.screen(port);
                    if (s.x < 0 || s.x > cam.width || s.y < 0 || s.y > cam.height)
                        continue;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, this.tool === 'connect' ? 4.5 : 4, 0, TAU);
                    ctx.fillStyle = '#fafffb';
                    ctx.strokeStyle = '#57af91';
                    ctx.lineWidth = 1.4;
                    ctx.fill();
                    ctx.stroke();
                }
        }
        if (this.preview) {
            const g = entityGeometry(this.preview, this.doc, { tolerance: .25 / cam.scale });
            ctx.globalAlpha = .8;
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#239b80', width: 1.8 });
            for (const t of g.texts)
                drawText(ctx, t, cam);
            ctx.globalAlpha = 1;
        }
        if (this.previewSymbol) {
            const g = entityGeometry(this.previewSymbol, this.doc, { tolerance: .25 / cam.scale });
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#28a082', width: 2 });
            for (const port of ports(this.previewSymbol, this.doc)) {
                const s = cam.screen(port);
                ctx.fillStyle = '#1c9c7c';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 3, 0, TAU);
                ctx.fill();
            }
        }
        if (this.drag?.kind === 'marquee') {
            const a = cam.screen(this.drag.start), b = cam.screen(this.drag.current);
            ctx.fillStyle = '#3c9b8514';
            ctx.strokeStyle = '#399e85';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.setLineDash([]);
        }
        if (this.cursor && !['select', 'pan'].includes(this.tool)) {
            const s = cam.screen(this.cursor);
            ctx.strokeStyle = '#7eaf96';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.x - 12, s.y);
            ctx.lineTo(s.x + 12, s.y);
            ctx.moveTo(s.x, s.y - 12);
            ctx.lineTo(s.x, s.y + 12);
            ctx.stroke();
            if (this.draft.length && this.tool !== 'polyline') {
                const n = distance(this.draft[0], this.cursor);
                ctx.fillStyle = '#f5fff1';
                ctx.fillRect(s.x + 13, s.y - 31, 90, 23);
                ctx.font = '11px ui-monospace,monospace';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#277d61';
                ctx.fillText(`${format(n)} ${this.doc.units}`, s.x + 18, s.y - 15);
            }
        }
        if (this.snap && this.cursor && (this.drag || this.tool !== 'select')) {
            const s = cam.screen(this.snap);
            ctx.strokeStyle = '#d69c45';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
            ctx.font = '10px system-ui';
            ctx.fillStyle = '#9b773f';
            ctx.textAlign = 'left';
            ctx.fillText(this.snap.kind || 'snap', s.x + 11, s.y - 11);
        }
        if (this.pointer?.pointerType === 'touch' && this.drag && this.drag.kind !== 'pan') {
            const screen = this.lastScreen, at = { x: screen.x > cam.width / 2 ? 77 : cam.width - 77, y: 117 }, r = 48, dpr = this.renderer.dpr;
            ctx.save();
            ctx.shadowColor = '#1e533d33';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, TAU);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.clip();
            const source = this.camera.screen(this.cursor || this.camera.world(screen));
            for (const canvas of [this.renderer.background, this.renderer.canvas])
                try {
                    ctx.drawImage(canvas, (source.x - 24) * dpr, (source.y - 24) * dpr, 48 * dpr, 48 * dpr, at.x - r, at.y - r, r * 2, r * 2);
                }
                catch { }
            ctx.strokeStyle = '#27866d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(at.x - 10, at.y);
            ctx.lineTo(at.x + 10, at.y);
            ctx.moveTo(at.x, at.y - 10);
            ctx.lineTo(at.x, at.y + 10);
            ctx.stroke();
            ctx.restore();
            ctx.strokeStyle = '#64a78a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
    }
    showContext(p) {
        this.cancelGesture();
        const e = this.hitTest(this.camera.world(p), 20);
        if (e)
            this.selection = new Set([e.id]);
        this.updateSelection();
        this.hideContext();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = this.selection.size ? `${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate', 'rotate')}${btn('constraint', 'Constrain', 'param')}${btn('delete', 'Delete', 'trash')}` : `${btn('toggle-library', 'Symbols', 'symbols')}${btn('precision', 'Draw by values', 'ruler')}${btn('paste', 'Paste', 'copy')}${btn('fit', 'Fit drawing', 'fit')}`;
        menu.style.left = clamp(p.x - 95, 25, this.camera.width - 215) + 'px';
        menu.style.top = clamp(p.y - 75, 25, this.camera.height - 145) + 'px';
        this.$('.canvas-area').append(menu);
    }
    hideContext() { this.$('.context-menu')?.remove(); }
    requireSelection(count = 1) {
        const es = this.selected().filter(e => !isLocked(e, this.doc));
        if (es.length < count)
            throw new Error(`Select ${count === 1 ? 'an editable object' : count + ' editable objects'} first`);
        return es;
    }
    deleteSelection() { const es = this.requireSelection(), ids = new Set(es.map(e => e.id)); this.edit('Delete selection', () => { this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id)); detachReferences(this.doc, ids); this.selection.clear(); }); }
    duplicateSelection() {
        const es = this.requireSelection();
        this.edit('Duplicate selection', () => {
            const map = new Map(es.map(e => [e.id, uid()])), copies = es.map(old => {
                const e = clone(old);
                e.id = map.get(old.id);
                delete e._dxf;
                moveEntity(e, 30, -30);
                if (e.tag)
                    e.tag += '-COPY';
                if (e.connector)
                    for (const key of ['from', 'to']) {
                        const ref = e.connector[key];
                        e.connector[key] = ref && map.has(ref.entityId) ? { ...ref, entityId: map.get(ref.entityId) } : null;
                    }
                return e;
            });
            this.doc.entities.push(...copies);
            this.selection = new Set(copies.map(e => e.id));
            this.reroute(this.selection);
        });
    }
    copySelection() { const es = this.requireSelection(); this.clipboard = { entities: clone(es), blocks: clone(this.doc.blocks) }; this.toast(`${es.length} object${es.length === 1 ? '' : 's'} copied to the app clipboard`); }
    pasteSelection() {
        if (!this.clipboard)
            throw new Error('Copy objects in this workspace first');
        const cb = this.clipboard;
        this.edit('Paste', () => {
            Object.assign(this.doc.blocks, clone(cb.blocks));
            const map = new Map(cb.entities.map(e => [e.id, uid()])), es = clone(cb.entities);
            for (const e of es) {
                e.id = map.get(e.id);
                delete e._dxf;
                moveEntity(e, 40, -40);
                if (e.tag)
                    e.tag += '-COPY';
                if (e.connector)
                    for (const key of ['from', 'to']) {
                        const ref = e.connector[key];
                        e.connector[key] = ref && map.has(ref.entityId) ? { ...ref, entityId: map.get(ref.entityId) } : null;
                    }
            }
            this.doc.entities.push(...es);
            this.selection = new Set(es.map(e => e.id));
        });
    }
    rotateSelection(angle) {
        const es = this.requireSelection();
        let b = emptyBounds();
        for (const e of es)
            b = union(b, entityBounds(e, this.doc));
        const origin = es.length === 1 && es[0].type === 'INSERT' ? { x: es[0].x, y: es[0].y } : center(b), m = compose(matrix({ x: origin.x, y: origin.y, rotation: angle }), matrix({ x: -origin.x, y: -origin.y }));
        this.edit('Rotate selection', () => {
            for (const e of es) {
                if (e.type === 'INSERT') {
                    const x = e.x, y = e.y;
                    transformEntity(e, m);
                    if (es.length === 1) {
                        e.x = x;
                        e.y = y;
                    }
                }
                else
                    transformEntity(e, m);
            }
            this.solveConstraints();
            this.reroute(this.selection);
        });
    }
    offsetSelection(amount) {
        const es = this.requireSelection();
        if (!Number.isFinite(amount) || Math.abs(amount) < 1e-9)
            throw new Error('Offset distance must be nonzero');
        this.edit('Offset geometry', () => {
            const created = [];
            for (const e of es) {
                let out;
                if (e.type === 'CIRCLE') {
                    if (e.r + amount <= 0)
                        throw new Error('Offset would make the circle radius nonpositive');
                    out = circle(e.c, e.r + amount, { layer: e.layer });
                }
                else if (e.type === 'LINE') {
                    const p = offsetPolyline([e.a, e.b], amount);
                    out = line(p[0], p[1], { layer: e.layer });
                }
                else if (e.type === 'LWPOLYLINE' && !e.points.some(p => p.bulge)) {
                    out = polyline(offsetPolyline(e.points, amount, e.closed), e.closed, { layer: e.layer });
                }
                else
                    throw new Error('Offset currently supports lines, circles and straight-segment polylines');
                out.layout = this.doc.activeLayout;
                created.push(out);
            }
            this.doc.entities.push(...created);
            this.selection = new Set(created.map(e => e.id));
        });
    }
    trimSelection(extend = false) {
        const es = this.requireSelection(2);
        if (es.length !== 2 || es.some(e => e.type !== 'LINE'))
            throw new Error('Select exactly two lines; the first selected line is the trim/extend target');
        const ordered = [...this.selection].map(id => es.find(e => e.id === id)).filter(Boolean), a = ordered[0], b = ordered[1], hit = lineIntersection(a.a, a.b, b.a, b.b, !extend);
        if (!hit)
            throw new Error(extend ? 'The lines do not intersect' : 'The selected line segments do not cross');
        this.edit(extend ? 'Extend line' : 'Trim line', () => {
            const p = { x: hit.x, y: hit.y };
            if (distance(a.a, p) < distance(a.b, p))
                a.a = p;
            else
                a.b = p;
            a.parametric = undefined;
            this.solveConstraints();
        });
    }
    filletSelection(radius) {
        const es = this.requireSelection(2);
        if (es.length !== 2 || es.some(e => e.type !== 'LINE'))
            throw new Error('Select exactly two lines to fillet');
        const a = es[0], b = es[1], f = filletLines(a.a, a.b, b.a, b.b, radius);
        this.edit('Fillet lines', () => {
            if (distance(a.a, f.p) < distance(a.b, f.p))
                a.a = f.p;
            else
                a.b = f.p;
            if (distance(b.a, f.q) < distance(b.b, f.q))
                b.a = f.q;
            else
                b.b = f.q;
            a.parametric = undefined;
            b.parametric = undefined;
            this.doc.entities.push(entity('ARC', { c: f.c, r: radius, start: f.start, end: f.end, clockwise: f.clockwise, layer: a.layer, layout: this.doc.activeLayout }));
            this.solveConstraints();
        });
    }
    explodeSelection() { const es = this.requireSelection(); this.edit('Explode selected geometry', () => { const ids = new Set(es.map(e => e.id)), newEntities = es.flatMap(e => explodeEntity(e, this.doc).map(x => ({ ...x, layout: e.layout || 'Model' }))); this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id)); detachReferences(this.doc, ids); this.doc.entities.push(...newEntities); this.selection = new Set(newEntities.map(e => e.id)); }); this.toast('Exploded to editable polylines and text. Curves are tessellated.'); }
    makeSymbolDialog() {
        const es = this.requireSelection();
        this.ask('Create a reusable symbol', [{ name: 'name', label: 'Block / symbol name', value: 'Custom component' }], v => {
            const name = v.name.trim().replace(/[<>/\\":;?*|,=`]/g, '_');
            if (!name)
                throw new Error('Enter a block name');
            if (this.doc.blocks[name])
                throw new Error('A block with that name already exists');
            this.edit('Create symbol', () => {
                let b = emptyBounds();
                for (const e of es)
                    b = union(b, entityBounds(e, this.doc));
                const c = center(b), children = es.flatMap(e => explodeEntity(e, this.doc));
                for (const e of children) {
                    moveEntity(e, -c.x, -c.y);
                    e.layer = '0';
                }
                const w = (b.maxX - b.minX) / 2, h = (b.maxY - b.minY) / 2;
                this.doc.blocks[name] = { name, base: { x: 0, y: 0 }, entities: children, ports: [{ name: 'in', x: -w, y: 0, dx: -1, dy: 0 }, { name: 'out', x: w, y: 0, dx: 1, dy: 0 }, { name: 'top', x: 0, y: h, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -h, dx: 0, dy: -1 }], symbol: { name, category: 'Custom', labelOffset: h + 20 } };
                const ids = new Set(es.map(e => e.id));
                this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id));
                detachReferences(this.doc, ids);
                const inserted = entity('INSERT', { block: name, x: c.x, y: c.y, sx: 1, sy: 1, rotation: 0, layer: this.currentLayer, layout: this.doc.activeLayout });
                this.doc.entities.push(inserted);
                this.selection = new Set([inserted.id]);
                this.category = 'Custom';
            });
        });
    }
    constraintDialog() {
        const es = this.requireSelection();
        if (es.some(e => !['LINE', 'CIRCLE', 'ARC'].includes(e.type)))
            throw new Error('Sketch constraints currently support lines, circles and arcs. Symbol dimensions can be edited in Properties.');
        const body = `<p>Apply a geometric constraint to the selected sketch. Edits with conflicting constraints are rolled back.</p><label class="field">Constraint<select id="constraint-type"><option value="horizontal">Horizontal line</option><option value="vertical">Vertical line</option><option value="length">Line length</option><option value="radius">Circle / arc radius</option><option value="angle">Line angle · degrees</option><option value="coincident">Coincident · first line end to second start</option><option value="parallel">Parallel lines</option><option value="perpendicular">Perpendicular lines</option><option value="equal">Equal lengths / radii</option><option value="fixed">Fixed geometry</option></select></label><label class="field">Value or parameter expression<input id="constraint-value" value="100" inputmode="decimal"></label><div class="error-text"></div>`;
        this.openModal('Constrain sketch', body, { confirm: 'Apply constraint', onConfirm: () => {
                const type = this.modal.querySelector('#constraint-type').value, value = this.modal.querySelector('#constraint-value').value, two = ['coincident', 'parallel', 'perpendicular', 'equal'].includes(type);
                if (two && es.length !== 2)
                    throw new Error('This constraint requires exactly two objects');
                if (['horizontal', 'vertical', 'length', 'angle', 'parallel', 'perpendicular', 'coincident'].includes(type) && es.some(e => e.type !== 'LINE'))
                    throw new Error('This constraint requires line entities');
                if (type === 'radius' && es.some(e => e.r === undefined))
                    throw new Error('Select circles or arcs for a radius constraint');
                this.edit('Add ' + type + ' constraint', () => {
                    if (two)
                        this.doc.constraints.push({ id: uid('constraint'), type, entities: es.map(e => e.id) });
                    else
                        for (const e of es)
                            this.doc.constraints.push({ id: uid('constraint'), type, entities: [e.id], ...(['length', 'radius', 'angle'].includes(type) ? { value } : {}), ...(type === 'fixed' ? { target: clone(e) } : {}) });
                    this.solveConstraints();
                    this.reroute(this.selection);
                });
                this.closeModal();
                this.toast('Constraint solved');
            } });
    }
    parametersDialog() {
        const values = this.doc.parameters, rows = Object.entries(values).map(([name, value]) => `<div class="param-row"><input class="param-name" value="${E(name)}" aria-label="Parameter name"><input class="param-expression" value="${E(value)}" aria-label="Expression for ${E(name)}"><button type="button" class="remove-param icon-btn" title="Remove parameter" aria-label="Remove parameter">${icon('close')}</button></div>`).join('');
        this.openModal('Named parameters', `<p>Use names in dimension fields and sketch constraints. Arithmetic supports + − × / ^ and parentheses; cycles and invalid expressions are rejected.</p><div id="parameter-rows">${rows}</div><button class="btn" id="add-parameter">${icon('plus')} Add parameter</button><div class="hint-box">Example: <code>valveSize = 64</code>, then use <code>valveSize / 2</code> in a radius field. Applying re-evaluates authored dimensions and solves the sketch.</div><div class="error-text"></div>`, { confirm: 'Apply parameters', onConfirm: () => {
                const next = {};
                for (const row of this.modal.querySelectorAll('.param-row')) {
                    const name = row.querySelector('.param-name').value.trim(), value = row.querySelector('.param-expression').value.trim();
                    if (!/^[A-Za-z_]\w*$/.test(name) || ['__proto__', 'constructor', 'prototype', 'pi'].includes(name))
                        throw new Error('Use unique parameter names containing letters, digits and underscores');
                    if (name in next)
                        throw new Error('Duplicate parameter: ' + name);
                    next[name] = value;
                }
                resolveParameters(next);
                this.edit('Update parameters', () => {
                    this.doc.parameters = next;
                    for (const e of this.doc.entities)
                        this.evaluateParametric(e);
                    this.solveConstraints();
                    this.reroute();
                });
                this.closeModal();
                this.toast('Parameters applied; constrained geometry updated.');
            } });
        this.modal.querySelector('#add-parameter').onclick = () => { const row = document.createElement('div'); row.className = 'param-row'; row.innerHTML = `<input class="param-name" value="size${this.modal.querySelectorAll('.param-row').length}" aria-label="Parameter name"><input class="param-expression" value="100" aria-label="Parameter expression"><button class="remove-param icon-btn" aria-label="Remove parameter">${icon('close')}</button>`; this.modal.querySelector('#parameter-rows').append(row); };
        this.modal.addEventListener('click', e => e.target.closest('.remove-param')?.closest('.param-row').remove());
    }
    precisionDialog() {
        this.openModal('Draw with exact values', `<p>World coordinates use the drawing’s ${E(this.doc.units)} units. All values accept named parameter expressions.</p><label class="field">Geometry<select id="precision-type"><option value="line">Line</option><option value="rect">Rectangle</option><option value="circle">Circle</option></select></label><div class="fields"><label class="field">X<input id="precision-x" value="${format(this.camera.x)}" inputmode="decimal"></label><label class="field">Y<input id="precision-y" value="${format(this.camera.y)}" inputmode="decimal"></label><label class="field">End X / width / radius<input id="precision-a" value="100" inputmode="decimal"></label><label class="field">End Y / height<input id="precision-b" value="80" inputmode="decimal"></label></div><div class="error-text"></div>`, { confirm: 'Create geometry', onConfirm: () => {
                const get = id => this.modal.querySelector('#precision-' + id).value, kind = get('type'), x = this.eval(get('x')), y = this.eval(get('y')), a = this.eval(get('a')), b = this.eval(get('b'));
                let e;
                if (kind === 'line')
                    e = line({ x, y }, { x: a, y: b });
                else if (kind === 'circle') {
                    if (a <= 0)
                        throw new Error('Radius must be positive');
                    e = circle({ x, y }, a, { parametric: { radius: get('a') } });
                }
                else {
                    if (a <= 0 || b <= 0)
                        throw new Error('Width and height must be positive');
                    e = rect(x, y, a, b, { parametric: { kind: 'rectangle', width: get('a'), height: get('b') } });
                }
                this.edit('Precision ' + kind, () => { e.layer = this.currentLayer; e.layout = this.doc.activeLayout; this.doc.entities.push(e); this.selection = new Set([e.id]); });
                this.closeModal();
                this.setTool('select');
            } });
    }
    lineStylesDialog() { this.openModal('Line & connection library', `<p>Choose a line type, then connect symbol ports or free points. Every connector is a native DXF polyline with optional application metadata.</p><div class="line-style-list">${LINE_STYLES.map(s => `<button data-style="${s.id}"><svg viewBox="0 0 90 20"><path d="M3 10h84" stroke="${s.color}" stroke-width="${s.width}" ${s.dash.length ? `stroke-dasharray="${s.dash.join(' ')}"` : ''}/>${s.arrow === 'end' ? `<path d="m77 5 9 5-9 5" fill="none" stroke="${s.color}" stroke-width="${s.width}"/>` : ''}</svg><span>${E(s.name)}</span>${s.id === this.lineStyle ? icon('check') : ''}</button>`).join('')}</div>`); }
    moreDialog(shapesOnly = false) { const drawing = [['tool-line', 'Line', 'line'], ['tool-polyline', 'Polyline', 'polyline'], ['tool-rect', 'Rectangle', 'rect'], ['tool-circle', 'Circle', 'circle'], ['tool-text', 'Text', 'text'], ['tool-dimension', 'Dimension', 'dimension'], ['tool-pan', 'Pan', 'pan'], ['precision', 'Exact values', 'ruler']]; const editing = [['duplicate', 'Duplicate', 'copy'], ['rotate-angle', 'Rotate', 'rotate'], ['offset', 'Offset', 'offset'], ['trim', 'Trim', 'trim'], ['extend', 'Extend', 'extend'], ['fillet', 'Fillet', 'fillet'], ['constraint', 'Constraints', 'param'], ['make-symbol', 'Make symbol', 'symbols'], ['explode', 'Explode', 'symbols'], ['parameters', 'Parameters', 'param'], ['multi-select', 'Multi-select', 'select'], ['select-all', 'Select all', 'select'], ['delete', 'Delete', 'trash'], ['command', 'Command', 'command'], ['help', 'Help', 'help']]; this.openModal(shapesOnly ? 'Draw a shape' : 'Drawing & editing tools', `<div class="section-label">DRAW</div><div class="operation-grid">${drawing.map(([a, l, i]) => btn(a, l, i)).join('')}</div>${shapesOnly ? '' : `<div class="section-label" style="margin-top:22px">EDIT & ORGANIZE</div><div class="operation-grid">${editing.map(([a, l, i]) => btn(a, l, i)).join('')}</div>`}`, { wide: !shapesOnly }); }
    editText(e) { this.ask('Edit text', [{ name: 'text', label: 'Content', value: e.text || '', multiline: true }], v => this.edit('Edit text', () => { e.text = v.text; e.dirty = true; })); }
    openModal(title, body, { confirm = null, onConfirm = null, wide = false } = {}) {
        this.closeModal();
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `<section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${E(title)}</h2>${iconButton('modal-close', 'close', 'Close dialog')}</header><div class="modal-body">${body}</div>${confirm ? `<footer class="modal-foot">${btn('modal-close', 'Cancel', null, 'btn')}${btn('modal-confirm', confirm, 'check', 'btn primary')}</footer>` : ''}</section>`;
        document.body.append(backdrop);
        this.modal = backdrop;
        this.previousFocus = document.activeElement;
        this.modalConfirm = async () => {
            try {
                await onConfirm?.();
            }
            catch (e) {
                const target = backdrop.querySelector('.error-text');
                if (target)
                    target.textContent = e.message;
                else
                    this.toast(e.message, true);
            }
        };
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) {
                this.closeModal();
                return;
            }
            this.onClick(e);
        });
        backdrop.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                const focus = [...backdrop.querySelectorAll('button:not([disabled]),input,select,textarea,[tabindex="0"]')], first = focus[0], last = focus.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
            if (e.key === 'Enter' && confirm && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                this.modalConfirm?.();
            }
        });
        setTimeout(() => backdrop.querySelector('input,textarea,select,button')?.focus(), 30);
    }
    closeModal() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
            this.modalConfirm = null;
            this.previousFocus?.focus?.({ preventScroll: true });
        }
    }
    ask(title, fields, onConfirm) { const body = fields.map(f => `<label class="field">${E(f.label)}${f.multiline ? `<textarea data-field="${f.name}">${E(f.value)}</textarea>` : `<input data-field="${f.name}" value="${E(f.value)}" autocomplete="off" spellcheck="false">`}</label>`).join('') + '<div class="error-text"></div>'; this.openModal(title, body, { confirm: 'Apply', onConfirm: async () => { const values = Object.fromEntries([...this.modal.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value])); await onConfirm(values); this.closeModal(); } }); }
    toast(message, error = false) { const el = this.$('.toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.classList.remove('show'), error ? 6500 : 3500); }
    newDialog() { this.openModal('Create a drawing', `<p>Your current drawing is saved to this device before switching. Export a project copy for a portable backup.</p><div class="export-grid"><button class="export-option" data-demo="blank">${icon('new')}<span><strong>Blank drawing</strong><small>Start with a clean DXF-native model.</small></span></button><button class="export-option" data-demo="pid">${icon('connect')}<span><strong>Process water skid</strong><small>P&ID equipment and instrument connections.</small></span></button><button class="export-option" data-demo="electrical">${icon('bolt')}<span><strong>Motor control circuit</strong><small>Electrical component and wire example.</small></span></button><button class="export-option" data-demo="flow">${icon('graph')}<span><strong>Commissioning workflow</strong><small>Flowchart shapes and routed decisions.</small></span></button></div>`); }
    async newDocument(kind) {
        try {
            await this.store.save(this.doc, uid('project'));
        }
        catch {
            this.toast('Previous project could not be saved. Export it before starting a new drawing.', true);
            return;
        }
        this.closeModal();
        this.cancelGesture();
        this.doc = kind === 'blank' ? installSymbols(createDocument()) : createDemo(kind);
        this.selection.clear();
        this.history.clear();
        this.currentLayer = 'Process';
        this.renderer.setDocument(this.doc);
        this.setTool('select');
        this.updateUI();
        this.renderer.fit();
        this.store.schedule(this.doc);
    }
    basename() { return (this.doc.name || 'drawing').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'); }
    exportDialog() { const report = exportReport(this.doc); this.openModal('Export your drawing', `<p>Choose an editable CAD file, a full project, or a presentation format. Files are generated locally.</p><label class="field">DXF target version<select id="dxf-version"><option value="AC1015">AutoCAD 2000 · AC1015</option><option value="AC1018">AutoCAD 2004 · AC1018</option><option value="AC1021">AutoCAD 2007 · AC1021</option><option value="AC1024" selected>AutoCAD 2010 · AC1024</option><option value="AC1027">AutoCAD 2013 · AC1027</option><option value="AC1032">AutoCAD 2018 · AC1032</option></select></label><div class="export-grid"><button class="export-option" data-export="dxf">${icon('line')}<span><strong>DXF drawing</strong><small>Normalized planar CAD entities, blocks, layers and tags.</small></span></button><button class="export-option" data-export="project">${icon('save')}<span><strong>Conduit project</strong><small>Full document, ports, constraints, parameters and original input.</small></span></button><button class="export-option" data-export="svg">${icon('screen')}<span><strong>SVG vector</strong><small>Scalable engineering artwork and text.</small></span></button><button class="export-option" data-export="png">${icon('rect')}<span><strong>PNG image</strong><small>Full drawing, 2400 pixels wide.</small></span></button><button class="export-option" data-export="bom">${icon('layers')}<span><strong>Equipment schedule</strong><small>CSV: block, tag, layer, position and rotation.</small></span></button><button class="export-option" data-export="graph">${icon('graph')}<span><strong>Connection graph</strong><small>JSON: nodes, ports, edges and adjacency.</small></span></button>${report.originalAvailable ? `<button class="export-option" data-export="original">${icon('folder')}<span><strong>Original DXF</strong><small>Exact imported source, without your edits. Preserves unsupported records.</small></span></button>` : ''}</div>${report.warnings.length ? `<div class="hint-box"><strong>Normalized DXF export limitations</strong><br>${report.warnings.map(E).join('<br>')}</div>` : ''}<p class="muted-note">Conduit metadata is application-specific. Other CAD tools will not automatically solve Conduit constraints or reroute connections. Keep the project file as your editable master.</p>`, { wide: true }); }
    async doExport(format) {
        const name = this.basename(), version = this.modal?.querySelector('#dxf-version')?.value || 'AC1024';
        if (format === 'project')
            downloadFile(name + '.conduit.json', JSON.stringify(this.doc, null, 2), 'application/json');
        else if (format === 'dxf') {
            const report = exportReport(this.doc);
            downloadFile(name + '.dxf', writeDXF(this.doc, { version }), 'application/dxf');
            if (report.warnings.length)
                this.toast('DXF exported with the limitations shown in Export. Keep a project copy.', true);
            else
                this.toast('DXF drawing exported');
        }
        else if (format === 'svg')
            downloadFile(name + '.svg', writeSVG(this.doc), 'image/svg+xml');
        else if (format === 'png') {
            downloadFile(name + '.png', await renderPNG(this.doc));
        }
        else if (format === 'bom')
            downloadFile(name + '-equipment.csv', '\uFEFF' + writeBOM(this.doc), 'text/csv;charset=utf-8');
        else if (format === 'graph')
            downloadFile(name + '.graph.json', JSON.stringify(graphFromDocument(this.doc), null, 2), 'application/json');
        else if (format === 'original') {
            if (!this.doc.source)
                throw new Error('No original DXF was imported');
            if (this.doc.source.base64) {
                const s = atob(this.doc.source.base64), bytes = Uint8Array.from(s, c => c.charCodeAt(0));
                downloadFile(name + '-original.dxf', bytes);
            }
            else
                downloadFile(name + '-original.dxf', this.doc.source.text, 'application/dxf');
        }
        else
            throw new Error('Unknown export format');
    }
    async openFile(file) {
        if (file.size > 128 * 1024 * 1024) {
            this.toast('The import limit is 128 MiB.', true);
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'loading';
        overlay.innerHTML = '<div class="spinner"></div><span>Reading drawing on this device…</span>';
        document.body.append(overlay);
        let worker, url;
        try {
            const buffer = await file.arrayBuffer();
            let doc;
            if (/\.(json|conduit)$/i.test(file.name)) {
                doc = validateDocument(JSON.parse(new TextDecoder().decode(buffer)));
            }
            else if (globalThis.__CONDUIT_DXF_WORKER__) {
                url = URL.createObjectURL(new Blob([globalThis.__CONDUIT_DXF_WORKER__], { type: 'text/javascript' }));
                worker = new Worker(url);
                doc = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Import exceeded the safety timeout')), 120000); worker.onmessage = e => { clearTimeout(timer); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.document); }; worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message || 'Import worker failed')); }; worker.postMessage({ buffer, name: file.name.replace(/\.dxf$/i, '') }, [buffer]); });
            }
            else {
                await new Promise(r => setTimeout(r, 0));
                doc = parseDXF(buffer, { name: file.name.replace(/\.dxf$/i, '') });
            }
            try {
                await this.store.save(this.doc, uid('project'));
            }
            catch {
                throw new Error('Current drawing could not be backed up locally. Export it before replacing it.');
            }
            this.cancelGesture();
            this.doc = installSymbols(doc);
            this.selection.clear();
            this.history.clear();
            this.currentLayer = this.doc.layers.find(l => l.visible && !l.locked)?.name || '0';
            this.renderer.setDocument(this.doc);
            this.setTool('select');
            this.updateUI();
            this.renderer.fit();
            this.store.schedule(this.doc);
            const warnings = (doc.importDiagnostics || []).filter(i => i.severity === 'warning');
            this.toast(`${file.name} opened · ${doc.entities.length} entities${warnings.length ? ' · ' + warnings.length + ' import warnings (Check)' : ''}`, warnings.length > 0);
            if (warnings.length) {
                this.inspectorTab = 'qa';
                this.renderInspector();
            }
        }
        catch (e) {
            this.toast('Could not open drawing: ' + e.message, true);
        }
        finally {
            worker?.terminate();
            if (url)
                URL.revokeObjectURL(url);
            overlay.remove();
        }
    }
    commandDialog() { this.openModal('Command palette', `<div class="command-input">${icon('code')}<input id="cad-command" placeholder="LINE 0,0 100,50" autocomplete="off" spellcheck="false" aria-label="CAD command"></div><div class="error-text"></div><p class="muted-note">Enter executes. Commands use drawing units and comma-separated point coordinates.</p><table class="keyboard-table"><tr><td>Line with exact endpoints</td><td>LINE 0,0 100,50</td></tr><tr><td>Circle with center and radius</td><td>CIRCLE 0,0 25</td></tr><tr><td>Rectangle · x, y, width, height</td><td>RECT 0 0 120 80</td></tr><tr><td>Move selected objects</td><td>MOVE 10 -20</td></tr><tr><td>Transforms and editing</td><td>ROTATE 45 / OFFSET 10</td></tr><tr><td>Named parameter</td><td>PARAM size=100</td></tr><tr><td>History and view</td><td>UNDO / REDO / FIT</td></tr></table>`, { confirm: 'Run command', onConfirm: () => { this.executeCommand(this.modal.querySelector('#cad-command').value); this.closeModal(); } }); }
    executeCommand(source) {
        const s = source.trim(), split = s.indexOf(' '), cmd = (split < 0 ? s : s.slice(0, split)).toUpperCase(), rest = split < 0 ? '' : s.slice(split + 1).trim(), args = rest.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        const nums = () => args.map(v => this.eval(v));
        if (['LINE', 'L'].includes(cmd)) {
            const n = nums();
            if (n.length !== 4)
                throw new Error('Use LINE x1,y1 x2,y2');
            this.edit('LINE command', () => this.doc.entities.push(line({ x: n[0], y: n[1] }, { x: n[2], y: n[3] }, { layer: this.currentLayer, layout: this.doc.activeLayout })));
        }
        else if (['CIRCLE', 'C'].includes(cmd)) {
            const n = nums();
            if (n.length !== 3 || n[2] <= 0)
                throw new Error('Use CIRCLE x,y radius, with positive radius');
            this.edit('CIRCLE command', () => this.doc.entities.push(circle({ x: n[0], y: n[1] }, n[2], { layer: this.currentLayer, layout: this.doc.activeLayout, parametric: { radius: args[2] } })));
        }
        else if (['RECT', 'RECTANGLE'].includes(cmd)) {
            const n = nums();
            if (n.length !== 4 || n[2] <= 0 || n[3] <= 0)
                throw new Error('Use RECT x y width height with positive dimensions');
            this.edit('RECT command', () => this.doc.entities.push(rect(...n, { layer: this.currentLayer, layout: this.doc.activeLayout, parametric: { kind: 'rectangle', width: args[2], height: args[3] } })));
        }
        else if (cmd === 'MOVE') {
            const n = nums(), es = this.requireSelection();
            if (n.length !== 2)
                throw new Error('Use MOVE dx dy');
            this.edit('MOVE command', () => { es.forEach(e => moveEntity(e, n[0], n[1])); this.solveConstraints(); this.reroute(this.selection); });
        }
        else if (cmd === 'ROTATE')
            this.rotateSelection(this.eval(rest));
        else if (cmd === 'OFFSET')
            this.offsetSelection(this.eval(rest));
        else if (cmd === 'FILLET')
            this.filletSelection(this.eval(rest));
        else if (cmd === 'TRIM')
            this.trimSelection();
        else if (cmd === 'EXTEND')
            this.trimSelection(true);
        else if (cmd === 'PARAM') {
            const m = rest.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
            if (!m || ['__proto__', 'constructor', 'prototype', 'pi'].includes(m[1]))
                throw new Error('Use PARAM name=expression');
            this.edit('Parameter command', () => { this.doc.parameters[m[1]] = m[2]; resolveParameters(this.doc.parameters); this.doc.entities.forEach(e => this.evaluateParametric(e)); this.solveConstraints(); this.reroute(); });
        }
        else if (cmd === 'UNDO')
            this.history.undo();
        else if (cmd === 'REDO')
            this.history.redo();
        else if (cmd === 'FIT' || cmd === 'ZOOM')
            this.renderer.fit();
        else if (cmd === 'DELETE' || cmd === 'ERASE')
            this.deleteSelection();
        else if (cmd === 'SELECT' && rest.toUpperCase() === 'ALL') {
            this.selection = new Set(this.doc.entities.filter(e => isVisible(e, this.doc)).map(e => e.id));
            this.updateSelection();
        }
        else if (cmd === 'LAYER') {
            if (!this.doc.layers.some(l => l.name === rest))
                throw new Error('Unknown layer');
            this.currentLayer = rest;
            this.updateUI();
        }
        else
            throw new Error('Unknown command: ' + cmd);
        this.toast(cmd + ' completed');
    }
    keyDown(e) {
        const input = e.target.closest?.('input,textarea,select,[contenteditable=true]');
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.modal) {
                this.closeModal();
                return;
            }
            this.closePanels();
            this.setTool('select');
            return;
        }
        if (input || this.modal)
            return;
        const cmd = e.ctrlKey || e.metaKey;
        try {
            if (cmd) {
                const key = e.key.toLowerCase();
                if (['z', 'y', 's', 'o', 'n', 'a', 'd', 'c', 'v', 'x', 'k'].includes(key))
                    e.preventDefault();
                switch (key) {
                    case 'z':
                        e.shiftKey ? this.history.redo() : this.history.undo();
                        return;
                    case 'y':
                        this.history.redo();
                        return;
                    case 's':
                        this.doExport('project');
                        return;
                    case 'o':
                        this.$('.file-input').click();
                        return;
                    case 'n':
                        this.newDialog();
                        return;
                    case 'a':
                        this.action('select-all');
                        return;
                    case 'd':
                        this.duplicateSelection();
                        return;
                    case 'c':
                        this.copySelection();
                        return;
                    case 'v':
                        this.pasteSelection();
                        return;
                    case 'x':
                        this.copySelection();
                        this.deleteSelection();
                        return;
                    case 'k':
                        this.commandDialog();
                        return;
                }
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.space = true;
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (this.draft.length) {
                    this.draft.pop();
                    this.updateTools();
                    this.renderer.invalidate();
                }
                else if (this.selection.size)
                    this.deleteSelection();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishPath();
                return;
            }
            const key = e.key.toLowerCase(), tools = { v: 'select', h: 'pan', l: 'line', p: 'polyline', r: 'rect', c: 'circle', k: 'connect', t: 'text', d: 'dimension' };
            if (tools[key]) {
                this.setTool(tools[key]);
                e.preventDefault();
            }
            else if (key === 'f') {
                this.renderer.fit();
                e.preventDefault();
            }
            else if (key === 'g')
                this.action('toggle-grid');
            else if (key === 's')
                this.action('toggle-snap');
            else if (key === 'o')
                this.action('toggle-ortho');
            else if (key === '?' || key === 'f1')
                this.helpDialog();
            else if (key === ':')
                this.commandDialog();
        }
        catch (error) {
            this.toast(error.message, true);
        }
    }
    helpDialog() { const stats = this.renderer.stats; this.openModal('Conduit CAD · 0.1.0', `<p><strong>Touch-first drafting and diagramming, built on native DXF entities.</strong> All drawing, import, routing, rendering and saving run on your device.</p><div class="about-stats"><div><b>56</b><small>SYMBOL MASTERS</small></div><div><b>13</b><small>ES MODULE PACKAGES</small></div><div><b>${E(stats.backend)}</b><small>ACTIVE RENDERER</small></div></div><div class="section-label">TOUCH & PEN</div><p>Tap a tool, then tap points or drag to draw. Drag a selected object to move it. Use two fingers to pan and zoom without drawing. Hold a library symbol briefly, then drag it onto the canvas; a simple tap arms placement. Hold the canvas for object actions. Drag a visible port to connect. A magnifier appears during touch editing.</p><div class="section-label">KEYBOARD</div><table class="keyboard-table">${[['Select / Pan', 'V / H or Space'], ['Line / Polyline / Rectangle', 'L / P / R'], ['Circle / Text / Dimension', 'C / T / D'], ['Connect / Fit', 'K / F'], ['Grid / Snap / Ortho', 'G / S / O'], ['Add to selection', 'Shift-click'], ['Undo / Redo', 'Ctrl/⌘ Z / Shift Z'], ['Duplicate / Copy / Paste', 'Ctrl/⌘ D / C / V'], ['Open / Save project', 'Ctrl/⌘ O / S'], ['Command palette', 'Ctrl/⌘ K'], ['Complete polyline / Cancel', 'Enter / Escape']].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><div class="section-label" style="margin-top:20px">COMPATIBILITY BOUNDARY</div><p>This release is a planar CAD and diagram editor, not full AutoCAD or Visio parity. It imports common ASCII/binary DXF entities and preserves the original input. Normalized export is not a lossless rewrite of every DXF feature. DWG, full 3D/OCS, ACIS solids, dynamic blocks, XREF resolution, complex hatch patterns, complete paper-layout behavior, font fidelity and industry certification remain outside this release.</p><div class="section-label">RENDERER DIAGNOSTICS</div><p>${stats.segments.toLocaleString()} compiled segments · ${stats.buildMs.toFixed(2)} ms scene build · ${stats.frameMs.toFixed(2)} ms last CPU frame submission. These are CPU wall times, not GPU timestamps.</p><p class="muted-note">${E(this.rendererMessage || 'No backend initialization warnings.')}<br>Use HTTPS or localhost for the WebGPU path. Fallbacks are selected automatically when initialization or device recovery fails.</p>`, { wide: true }); }
    dispose() { this.abort.abort(); this.input.dispose(); this.renderer.dispose(); this.store.dispose(); this.closeModal(); clearTimeout(this.toastTimer); this.root.innerHTML = ''; }
}
function mountWorkbench(element, options = {}) { return new Workbench(element, options); }

return {symbolSVG,Workbench,mountWorkbench};
})();
// apps/studio/main.js
__modules["apps/studio/main.js"]=(()=>{
const {mountWorkbench} = __modules["packages/workbench/src/index.js"];
try {
    globalThis.conduit = mountWorkbench(document.getElementById('app'));
    globalThis.conduit.ready.then(() => { document.documentElement.dataset.ready = 'true'; });
}
catch (error) {
    const host = document.getElementById('app');
    host.textContent = 'Conduit CAD could not initialize: ' + error.message;
    console.error(error);
}
if (!globalThis.__CONDUIT_STANDALONE__ && location.protocol !== 'file:' && 'serviceWorker' in navigator && !new URLSearchParams(location.search).has('no-sw'))
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { }); });

return {};
})();
})();
