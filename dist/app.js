globalThis.__CONDUIT_DXF_WORKER__="'use strict';\n(()=>{\nconst __modules=Object.create(null);\n// packages/geometry/src/index.js\n__modules[\"packages/geometry/src/index.js\"]=(()=>{\n/** Double-precision planar geometry. DXF coordinates are right-handed, Y up. */\nconst EPS = 1e-9;\nconst TAU = Math.PI * 2;\nconst clamp = (v, a, b) => Math.min(b, Math.max(a, v));\nconst point = (x = 0, y = 0) => ({ x, y });\nconst add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });\nconst sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });\nconst mul = (a, s) => ({ x: a.x * s, y: a.y * s });\nconst dot = (a, b) => a.x * b.x + a.y * b.y;\nconst cross = (a, b) => a.x * b.y - a.y * b.x;\nconst length = a => Math.hypot(a.x, a.y);\nconst distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);\nconst normalize = a => mul(a, 1 / (length(a) || 1));\nconst lerp = (a, b, t) => add(a, mul(sub(b, a), t));\nconst almost = (a, b, tolerance = EPS) => Math.abs(a - b) <= tolerance;\nconst equalPoint = (a, b, tolerance = EPS) => distance(a, b) <= tolerance;\nconst identity = () => [1, 0, 0, 1, 0, 0];\nconst transform = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });\nfunction matrix({ x = 0, y = 0, rotation = 0, sx = 1, sy = sx } = {}) { const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * sx, s * sx, -s * sy, c * sy, x, y]; }\nfunction compose(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }\nfunction inverse(m) {\n    const d = m[0] * m[3] - m[1] * m[2];\n    if (Math.abs(d) < EPS)\n        throw new Error('Singular transform');\n    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];\n}\nfunction bounds(points) {\n    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };\n    for (const p of points) {\n        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))\n            continue;\n        b.minX = Math.min(b.minX, p.x);\n        b.minY = Math.min(b.minY, p.y);\n        b.maxX = Math.max(b.maxX, p.x);\n        b.maxY = Math.max(b.maxY, p.y);\n    }\n    return b;\n}\nconst emptyBounds = () => bounds([]);\nconst validBounds = b => Number.isFinite(b.minX) && b.minX <= b.maxX && b.minY <= b.maxY;\nconst inflate = (b, n) => ({ minX: b.minX - n, minY: b.minY - n, maxX: b.maxX + n, maxY: b.maxY + n });\nconst intersects = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;\nconst contains = (b, p) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;\nconst union = (a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) });\nconst center = b => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });\nfunction projectPoint(p, a, b, segment = true) { const v = sub(b, a), n = dot(v, v); const t = n < EPS * EPS ? 0 : dot(sub(p, a), v) / n; return lerp(a, b, segment ? clamp(t, 0, 1) : t); }\nconst distanceToSegment = (p, a, b) => distance(p, projectPoint(p, a, b));\nfunction lineIntersection(a, b, c, d, segments = true) {\n    const r = sub(b, a), s = sub(d, c), det = cross(r, s);\n    if (Math.abs(det) <= EPS * Math.max(1, length(r) * length(s)))\n        return null;\n    const q = sub(c, a), t = cross(q, s) / det, u = cross(q, r) / det;\n    if (segments && (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS))\n        return null;\n    return { ...lerp(a, b, t), t, u };\n}\nfunction segmentIntersectsBox(a, b, box) {\n    if (contains(box, a) || contains(box, b))\n        return true;\n    const p = [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY }, { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY }];\n    return p.some((v, i) => lineIntersection(a, b, v, p[(i + 1) % 4]));\n}\nfunction polygonContains(p, points) {\n    let inside = false;\n    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {\n        const a = points[i], b = points[j];\n        if (distanceToSegment(p, a, b) < EPS)\n            return true;\n        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)\n            inside = !inside;\n    }\n    return inside;\n}\nfunction polygonArea(points) {\n    let n = 0;\n    for (let i = 0; i < points.length; i++)\n        n += cross(points[i], points[(i + 1) % points.length]);\n    return n / 2;\n}\nfunction polylineLength(points, closed = false) {\n    let n = 0;\n    for (let i = 1; i < points.length; i++)\n        n += distance(points[i - 1], points[i]);\n    if (closed && points.length > 1)\n        n += distance(points.at(-1), points[0]);\n    return n;\n}\nfunction simplifyOrthogonal(points) {\n    const r = [];\n    for (const p of points) {\n        if (r.length && equalPoint(r.at(-1), p))\n            continue;\n        if (r.length > 1) {\n            const a = r.at(-2), b = r.at(-1);\n            if (Math.abs(cross(sub(b, a), sub(p, b))) < EPS && dot(sub(b, a), sub(p, b)) >= 0)\n                r.pop();\n        }\n        r.push({ ...p });\n    }\n    return r;\n}\nfunction arcPoints(c, r, start = 0, end = TAU, tolerance = .2, clockwise = false) {\n    if (!Number.isFinite(r) || r <= 0)\n        return [c];\n    let sweep = end - start;\n    if (clockwise) {\n        while (sweep > 0)\n            sweep -= TAU;\n    }\n    else {\n        while (sweep < 0)\n            sweep += TAU;\n    }\n    if (Math.abs(sweep) < EPS)\n        sweep = clockwise ? -TAU : TAU;\n    const step = 2 * Math.acos(clamp(1 - Math.max(tolerance, 1e-7) / r, -1, 1));\n    const n = clamp(Math.ceil(Math.abs(sweep) / Math.max(step, .0005)), 2, 8192);\n    return Array.from({ length: n + 1 }, (_, i) => ({ x: c.x + r * Math.cos(start + sweep * i / n), y: c.y + r * Math.sin(start + sweep * i / n) }));\n}\nfunction bulgeArc(a, b, bulge) {\n    if (Math.abs(bulge) < EPS || distance(a, b) < EPS)\n        return null;\n    const chord = sub(b, a), mid = lerp(a, b, .5), c = add(mid, mul({ x: -chord.y, y: chord.x }, (1 - bulge * bulge) / (4 * bulge)));\n    return { c, r: distance(a, c), start: Math.atan2(a.y - c.y, a.x - c.x), sweep: 4 * Math.atan(bulge), clockwise: bulge < 0 };\n}\nfunction tessellatePolyline(points, closed = false, tolerance = .2) {\n    if (!points.length)\n        return [];\n    const out = [];\n    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {\n        const a = points[i], b = points[(i + 1) % points.length], arc = bulgeArc(a, b, a.bulge || 0);\n        if (arc)\n            out.push(...arcPoints(arc.c, arc.r, arc.start, arc.start + arc.sweep, tolerance, arc.clockwise).slice(0, -1));\n        else\n            out.push(a);\n    }\n    out.push(closed ? points[0] : points.at(-1));\n    return out;\n}\n/** Rational de Boor evaluation; input is never mutated. */\nfunction nurbsPoint(control, degree, knots, t, weights = []) {\n    const n = control.length - 1, p = Math.min(degree, n);\n    if (n < 0)\n        return point();\n    if (p < 1)\n        return { ...control[0] };\n    if (knots.length < n + p + 2)\n        throw new Error('Invalid NURBS knot vector');\n    const lo = knots[p], hi = knots[n + 1];\n    t = clamp(t, lo, hi);\n    let k = n;\n    if (t < hi) {\n        k = p;\n        while (k < n && !(t >= knots[k] && t < knots[k + 1]))\n            k++;\n    }\n    const d = [];\n    for (let j = 0; j <= p; j++) {\n        const i = k - p + j, w = weights[i] ?? 1;\n        d.push([control[i].x * w, control[i].y * w, w]);\n    }\n    for (let r = 1; r <= p; r++)\n        for (let j = p; j >= r; j--) {\n            const i = k - p + j, den = knots[i + p - r + 1] - knots[i], a = Math.abs(den) < EPS ? 0 : (t - knots[i]) / den;\n            d[j] = d[j].map((v, q) => (1 - a) * d[j - 1][q] + a * v);\n        }\n    const w = d[p][2];\n    return Math.abs(w) > EPS ? { x: d[p][0] / w, y: d[p][1] / w } : { ...control[Math.min(n, k)] };\n}\nfunction splinePoints(e, tolerance = .2) {\n    const cp = e.controlPoints || [];\n    if (cp.length < 2)\n        return cp;\n    const p = Math.min(e.degree || 3, cp.length - 1), n = cp.length;\n    let knots = e.knots;\n    if (!knots || knots.length < n + p + 1) {\n        knots = [];\n        for (let i = 0; i < n + p + 1; i++)\n            knots.push(i <= p ? 0 : i >= n ? 1 : (i - p) / (n - p));\n    }\n    const start = knots[p], end = knots[n], out = [nurbsPoint(cp, p, knots, start, e.weights)];\n    function split(t0, a, t1, b, depth) {\n        const tm = (t0 + t1) / 2, m = nurbsPoint(cp, p, knots, tm, e.weights), q1 = nurbsPoint(cp, p, knots, (t0 + tm) / 2, e.weights), q3 = nurbsPoint(cp, p, knots, (tm + t1) / 2, e.weights);\n        if (depth < 12 && Math.max(distanceToSegment(m, a, b), distanceToSegment(q1, a, b), distanceToSegment(q3, a, b)) > tolerance) {\n            split(t0, a, tm, m, depth + 1);\n            split(tm, m, t1, b, depth + 1);\n        }\n        else\n            out.push(b);\n    }\n    for (let i = p; i < n; i++) {\n        if (knots[i + 1] > knots[i])\n            split(knots[i], out.at(-1), knots[i + 1], nurbsPoint(cp, p, knots, knots[i + 1], e.weights), 0);\n    }\n    return out;\n}\n/** Planar polyline offset with bounded miters; not a polygon Boolean engine. */\nfunction offsetPolyline(points, amount, closed = false, miterLimit = 6) {\n    if (points.length < 2)\n        throw new Error('Offset requires two vertices');\n    const seg = [];\n    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {\n        const a = points[i], b = points[(i + 1) % points.length], v = normalize(sub(b, a)), o = mul({ x: -v.y, y: v.x }, amount);\n        seg.push([add(a, o), add(b, o)]);\n    }\n    const out = [];\n    for (let i = 0; i < points.length; i++) {\n        if (!closed && i === 0) {\n            out.push(seg[0][0]);\n            continue;\n        }\n        if (!closed && i === points.length - 1) {\n            out.push(seg.at(-1)[1]);\n            continue;\n        }\n        const prev = seg[(i - 1 + seg.length) % seg.length], next = seg[i % seg.length], hit = lineIntersection(...prev, ...next, false);\n        if (hit && distance(hit, points[i]) <= Math.abs(amount) * miterLimit + EPS)\n            out.push({ x: hit.x, y: hit.y });\n        else\n            out.push(prev[1], next[0]);\n    }\n    return out;\n}\nfunction filletLines(a, b, c, d, radius) {\n    const hit = lineIntersection(a, b, c, d, false);\n    if (!hit || radius <= 0)\n        throw new Error('Fillet needs intersecting nonparallel lines and positive radius');\n    const u = normalize(sub(distance(a, hit) > distance(b, hit) ? a : b, hit)), v = normalize(sub(distance(c, hit) > distance(d, hit) ? c : d, hit)), theta = Math.acos(clamp(dot(u, v), -1, 1));\n    if (theta < EPS || Math.abs(theta - Math.PI) < EPS)\n        throw new Error('Degenerate fillet');\n    const t = radius / Math.tan(theta / 2), p = add(hit, mul(u, t)), q = add(hit, mul(v, t)), cen = add(hit, mul(normalize(add(u, v)), radius / Math.sin(theta / 2)));\n    return { p, q, c: cen, r: radius, start: Math.atan2(p.y - cen.y, p.x - cen.x), end: Math.atan2(q.y - cen.y, q.x - cen.x), clockwise: cross(sub(p, cen), sub(q, cen)) < 0 };\n}\nfunction snapCandidates(entity) {\n    const n=entity.extrusion;\n    // OCS data is not WCS. Do not offer incorrect planar snaps on projected planes.\n    if(n&&['ARC','CIRCLE','LWPOLYLINE','POLYLINE','SOLID','TRACE','TEXT'].includes(entity.type)&&(Math.abs(n.x||0)>1e-12||Math.abs(n.y||0)>1e-12||Math.abs((n.z??1)-1)>1e-12))return [];\n    switch (entity.type) {\n        case 'LINE': return [{ ...entity.a, kind: 'endpoint' }, { ...entity.b, kind: 'endpoint' }, { ...lerp(entity.a, entity.b, .5), kind: 'midpoint' }];\n        case 'CIRCLE':\n        case 'ARC': {\n            const onArc = a => {\n                if (entity.type === 'CIRCLE')\n                    return true;\n                const norm = x => ((x % TAU) + TAU) % TAU;\n                return entity.clockwise ? norm(entity.start - a) <= norm(entity.start - entity.end) + EPS : norm(a - entity.start) <= norm(entity.end - entity.start) + EPS;\n            };\n            const at = a => ({ x: entity.c.x + entity.r * Math.cos(a), y: entity.c.y + entity.r * Math.sin(a) });\n            return [{ ...entity.c, kind: 'center' }, ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].filter(onArc).map(a => ({ ...at(a), kind: 'quadrant' })), ...(entity.type === 'ARC' ? [{ ...at(entity.start), kind: 'endpoint' }, { ...at(entity.end), kind: 'endpoint' }] : [])];\n        }\n        case 'ELLIPSE': {\n            const a=entity.major,c=entity.c,r=entity.ratio,n=entity.extrusion||{x:0,y:0,z:1};\n            const v={x:(n.y||0)*(a.z||0)-(n.z??1)*a.y,y:(n.z??1)*a.x-(n.x||0)*(a.z||0),z:(n.x||0)*a.y-(n.y||0)*a.x};\n            const f=Math.hypot(a.x,a.y,a.z||0)*r/Math.hypot(v.x,v.y,v.z);\n            if(!Number.isFinite(f))return [];\n            const start=entity.start??0,end=entity.end??TAU,norm=t=>(t%TAU+TAU)%TAU,full=Math.abs(end-start)>=TAU-1e-9;\n            const at=t=>({x:c.x+a.x*Math.cos(t)+v.x*f*Math.sin(t),y:c.y+a.y*Math.cos(t)+v.y*f*Math.sin(t)});\n            return [{...c,kind:'center'},...[0,Math.PI/2,Math.PI,Math.PI*1.5].filter(t=>full||norm(t-start)<=norm(end-start)+EPS).map(t=>({...at(t),kind:'quadrant'})),...(!full?[{...at(start),kind:'endpoint'},{...at(end),kind:'endpoint'}]:[])];\n        }\n        case 'SPLINE': {\n            const cp=entity.controlPoints||[],knots=entity.knots||[],degree=entity.degree;\n            if(cp.length<2||knots.length!==cp.length+degree+1)return [];\n            const a=knots[degree],b=knots[cp.length];\n            return [a,b].map(t=>({...nurbsPoint(cp,degree,knots,t,entity.weights),kind:'endpoint'}));\n        }\n        case 'POINT': case 'RAY': case 'XLINE': return [{...entity.p,kind:entity.type==='POINT'?'node':'origin'}];\n        case 'TEXT': case 'MTEXT': return [{...entity.p,kind:'insertion'}];\n        case 'SOLID': case '3DFACE': case 'LEADER': case 'POLYLINE':\n        case 'LWPOLYLINE': return (entity.points||[]).flatMap((p,i)=>{\n            const q=entity.points[(i+1)%entity.points.length],closed=entity.closed||['SOLID','3DFACE'].includes(entity.type);\n            let midpoint=lerp(p,q,.5);\n            if(entity.type==='LWPOLYLINE'&&p.bulge){const arc=bulgeArc(p,q,p.bulge);if(arc){const t=arc.start+arc.sweep/2;midpoint={x:arc.c.x+arc.r*Math.cos(t),y:arc.c.y+arc.r*Math.sin(t)};}}\n            return [{...p,kind:'endpoint'},...(i<entity.points.length-1||closed?[{...midpoint,kind:'midpoint'}]:[])];\n        });\n        case 'INSERT': return [{ x: entity.x, y: entity.y, kind: 'insertion' }];\n        default: return [];\n    }\n}\n\nreturn {EPS,TAU,clamp,point,add,sub,mul,dot,cross,length,distance,normalize,lerp,almost,equalPoint,identity,transform,matrix,compose,inverse,bounds,emptyBounds,validBounds,inflate,intersects,contains,union,center,projectPoint,distanceToSegment,lineIntersection,segmentIntersectsBox,polygonContains,polygonArea,polylineLength,simplifyOrthogonal,arcPoints,bulgeArc,tessellatePolyline,nurbsPoint,splinePoints,offsetPolyline,filletLines,snapCandidates};\n})();\n// packages/model/src/dimensions.js\n__modules[\"packages/model/src/dimensions.js\"]=(()=>{\nconst {arcPoints, distance, matrix, transform, TAU} = __modules[\"packages/geometry/src/index.js\"];\nconst EPS = 1e-9;\nconst copy = v => JSON.parse(JSON.stringify(v));\nconst add = (a,b) => ({x:a.x+b.x,y:a.y+b.y});\nconst sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});\nconst mul = (a,s) => ({x:a.x*s,y:a.y*s});\nconst normal = a => ({x:-a.y,y:a.x});\nconst dot = (a,b) => a.x*b.x+a.y*b.y;\nconst unit = a => { const l=Math.hypot(a.x,a.y); if(l<EPS)throw new Error('Coincident dimension definition points'); return mul(a,1/l); };\nconst finite = (v,label) => { if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error(`Invalid dimension ${label}`); return v; };\nconst point = (p,label) => { if(!p)throw new Error(`Missing dimension ${label}`); finite(p.x,label);finite(p.y,label);if(Math.abs(p.z||0)>EPS)throw new Error('Dimension regeneration currently requires the XY plane at Z=0');return {x:p.x,y:p.y}; };\nconst angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);\nconst positiveAngle = x => (x%TAU+TAU)%TAU;\nconst STYLE_KEYS = new Set(['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimdec','dimrnd','dimpost','dimzin','dimdsep']);\nconst POINT_KEYS = ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'];\n\n/** Declarative dimension picture generator. It never mutates the document. */\nfunction dimensionPicture(e,doc={}) {\n    if(e.type!=='DIMENSION')throw new Error('Expected DIMENSION');\n    const n=e.extrusion||{x:0,y:0,z:1};\n    if(Math.abs(n.x||0)>EPS||Math.abs(n.y||0)>EPS||Math.abs((n.z??1)-1)>EPS)throw new Error('Non-default dimension OCS cannot be regenerated in the planar editor');\n    if(e.dimensionInsert && Math.hypot(e.dimensionInsert.x||0,e.dimensionInsert.y||0,e.dimensionInsert.z||0)>EPS)throw new Error('Translated dimension pictures require conversion before regeneration');\n    if(e.obliqueAngle || e.horizontalDirection)throw new Error('Oblique or rotated-UCS dimension regeneration is not supported');\n    finite(e.dimtype??33,'subtype');if(!Number.isInteger(e.dimtype??33))throw new Error('Dimension subtype must be an integer');\n    finite(e.dimensionAngle??0,'angle');\n    const type=(e.dimtype??33)&15;\n    if(type>6)throw new Error('Unknown dimension subtype');\n    const style={dimtxt:e.height||12,dimasz:5,dimexe:5,dimexo:1,dimgap:3,dimscale:1,dimlfac:1,dimdec:1,dimrnd:0,dimpost:'<>',dimzin:0,...doc.dimstyles?.[e.dimstyle||'STANDARD'],...e.dimstyleOverrides,...e.dimension?.style};\n    for(const k of ['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimrnd']) {\n        finite(style[k],k); if(style[k]<0)throw new Error(`Dimension ${k} cannot be negative`);\n    }\n    if(style.dimtxt<=0||style.dimscale<=0||style.dimlfac<=0)throw new Error('Dimension text, scale and measurement factor must be positive');\n    if(!Number.isInteger(style.dimdec)||style.dimdec<0||style.dimdec>8)throw new Error('Dimension precision must be an integer from 0 to 8');\n    if(typeof style.dimpost!=='string'||style.dimpost.length>1000||!Number.isInteger(style.dimzin)||style.dimzin<0||style.dimzin>15)throw new Error('Invalid dimension text formatting');\n    if(style.dimdsep!==undefined&&(!Number.isInteger(style.dimdsep)||style.dimdsep<1||style.dimdsep>255))throw new Error('Invalid dimension decimal separator');\n    if(e.text!==undefined&&(typeof e.text!=='string'||e.text.length>1000))throw new Error('Invalid dimension text');\n    const scale=style.dimscale,h=style.dimtxt*scale,arrow=style.dimasz*scale,gap=style.dimgap*scale;\n    const entities=[];let measurement,definitionPoint=e.definitionPoint,textMidpoint,textRotation=0;\n    const put=(type,props) => entities.push({id:`${e.id||'dimension'}:picture:${entities.length}`,type,layer:'0',color:'BYBLOCK',linetype:'CONTINUOUS',...props});\n    const line=(a,b) => {if(distance(a,b)>EPS)put('LINE',{a,b});};\n    const head=(tip,inside) => {if(!arrow)return;const u=unit(inside),n=normal(u);put('SOLID',{points:[tip,add(tip,add(mul(u,arrow),mul(n,arrow*.28))),add(tip,add(mul(u,arrow),mul(n,-arrow*.28)))]});};\n    const extension=(origin,end,outward) => {if(distance(origin,end)>EPS)line(add(origin,mul(outward,style.dimexo*scale)),add(end,mul(outward,style.dimexe*scale)));};\n    if(type===0||type===1) {\n        const a=point(e.a,'first endpoint'),b=point(e.b,'second endpoint');\n        const u=type===0?{x:Math.cos((e.dimensionAngle||0)*Math.PI/180),y:Math.sin((e.dimensionAngle||0)*Math.PI/180)}:unit(sub(b,a)),n=normal(u);\n        const off=e.offset!==undefined?finite(e.offset,'offset'):e.definitionPoint?dot(sub(point(e.definitionPoint,'dimension line'),a),n):30;\n        const p=add(a,mul(n,off)),q=add(p,mul(u,dot(sub(b,a),u)));\n        measurement=Math.abs(dot(sub(b,a),u));if(measurement<EPS)throw new Error('Zero projected dimension length');\n        const side=mul(n,off<0?-1:1);extension(a,p,side);extension(b,q,mul(n,dot(sub(q,b),n)<0?-1:1));\n        line(p,q);const inside=unit(sub(q,p));head(p,inside);head(q,mul(inside,-1));\n        textMidpoint=add(mul(add(p,q),.5),mul(side,gap+h*.5));textRotation=Math.atan2(u.y,u.x)*180/Math.PI;\n        if(textRotation>90||textRotation<=-90)textRotation+=180;\n        definitionPoint=q;\n    } else if(type===3||type===4) {\n        const a=point(e.definitionPoint,'radial origin'),b=point(e.defpoint4,'radial endpoint'),u=unit(sub(b,a));\n        measurement=distance(a,b);line(a,b);head(b,mul(u,-1));if(type===3)head(a,u);\n        const lead=Math.max(0,finite(e.leaderLength??0,'leader length'));\n        if(lead>0)line(b,add(b,mul(u,lead)));\n        textMidpoint=add(type===3?mul(add(a,b),.5):add(b,mul(u,lead)),mul(normal(u),gap+h*.5));\n    } else if(type===2||type===5) {\n        let center,a,b,location;\n        if(type===5){center=point(e.defpoint4,'angle center');a=point(e.a,'first ray');b=point(e.b,'second ray');location=point(e.definitionPoint,'angle location');}\n        else {\n            const p=point(e.a,'line 1 start'),q=point(e.b,'line 1 end'),r=point(e.defpoint4,'line 2 start'),s=point(e.definitionPoint,'line 2 end');\n            const u=sub(q,p),v=sub(s,r),det=u.x*v.y-u.y*v.x;\n            if(Math.abs(det)<EPS)throw new Error('Parallel angular dimension lines');\n            const w=sub(r,p),f=(w.x*v.y-w.y*v.x)/det;center=add(p,mul(u,f));\n            a=distance(center,q)>EPS?q:p;b=distance(center,s)>EPS?s:r;location=point(e.defpoint5,'angle location');\n        }\n        let start=angle(center,a),end=angle(center,b),sweep=positiveAngle(end-start),loc=positiveAngle(angle(center,location)-start);\n        if(loc>sweep+EPS){[a,b]=[b,a];[start,end]=[end,start];sweep=positiveAngle(end-start);}\n        if(sweep<EPS)throw new Error('Zero angular dimension');\n        const radius=distance(center,location);if(radius<EPS)throw new Error('Angular dimension arc must have a positive radius');\n        const p=add(center,{x:Math.cos(start)*radius,y:Math.sin(start)*radius}),q=add(center,{x:Math.cos(start+sweep)*radius,y:Math.sin(start+sweep)*radius});\n        extension(a,p,unit(sub(p,center)));extension(b,q,unit(sub(q,center)));\n        put('ARC',{c:center,r:radius,start,end:start+sweep});head(p,{x:-Math.sin(start),y:Math.cos(start)});head(q,{x:Math.sin(end),y:-Math.cos(end)});\n        const mid=start+sweep/2;textMidpoint=add(center,{x:Math.cos(mid)*(radius+gap+h*.5),y:Math.sin(mid)*(radius+gap+h*.5)});measurement=sweep*180/Math.PI;\n    } else {\n        const origin=point(e.definitionPoint,'ordinate origin'),a=point(e.a,'ordinate feature'),b=point(e.b,'ordinate leader'),x=!!((e.dimtype||0)&64);\n        measurement=x?a.x-origin.x:a.y-origin.y;\n        const elbow=x?{x:a.x,y:b.y}:{x:b.x,y:a.y};line(a,elbow);line(elbow,b);textMidpoint=add(b,{x:gap+h*.5,y:gap+h*.5});\n    }\n    let value=measurement*([2,5].includes(type)?1:style.dimlfac);\n    if(style.dimrnd>0)value=Math.round(value/style.dimrnd)*style.dimrnd;\n    let content=value.toFixed(style.dimdec);if(style.dimzin&8)content=content.replace(/(\\.\\d*?)0+$/,'$1').replace(/\\.$/,'');\n    if(style.dimzin&4)content=content.replace(/^(-?)0\\./,'$1.');\n    if(style.dimdsep)content=content.replace('.',String.fromCharCode(style.dimdsep));\n    content=(type===3?'⌀':type===4?'R':'')+content+([2,5].includes(type)?'°':'');\n    content=String(style.dimpost||'<>').replace(/<>/g,content);\n    if(e.text && e.text!=='<>')content=String(e.text).replace(/<>/g,content);\n    if(e.dimension?.manualText && e.textMidpoint)textMidpoint=point(e.textMidpoint,'text midpoint');\n    textRotation=e.textRotation??textRotation;\n    finite(textRotation,'text rotation');\n    if(e.text!==' ')put('TEXT',{p:textMidpoint,text:content,height:h,rotation:textRotation,align:'center',halign:1,valign:2,alignPoint:textMidpoint});\n    finite(measurement,'measurement');point(textMidpoint,'generated text midpoint');\n    for(const entity of entities)for(const p of [entity.a,entity.b,entity.p,entity.c,...entity.points||[]])if(p)point(p,'generated coordinate');\n    return {entities,measurement,definitionPoint,textMidpoint,style};\n}\n\n/** Atomic opt-in adoption or edit. Imported pictures are left untouched until this succeeds. */\nfunction editDimension(e,doc,patch={}) {\n    if(e.dimension&&e.dimension.version!==1)throw new Error('Unsupported Conduit dimension schema');\n    const next=copy(e);next.dimension={version:1,manualText:!!((next.dimtype||0)&128),...next.dimension};\n    for(const [key,value] of Object.entries(patch)) {\n        if(key==='style') {\n            if(!value||typeof value!=='object')throw new Error('Invalid dimension style');\n            for(const k of Object.keys(value))if(!STYLE_KEYS.has(k))throw new Error(`Unsupported dimension style field: ${k}`);\n            next.dimension.style={...next.dimension.style,...value};\n        } else if(POINT_KEYS.includes(key))next[key]=point(value,key);\n        else if(['offset','text','textRotation','dimensionAngle','leaderLength','dimstyle','dimtype'].includes(key))next[key]=value;\n        else if(key==='manualText')next.dimension.manualText=!!value;\n        else throw new Error(`Unsupported dimension edit: ${key}`);\n    }\n    for(const key of POINT_KEYS)if(key in patch && next.dimension.references)delete next.dimension.references[key];\n    // A moved dimension line supersedes its authored signed offset.\n    if('definitionPoint' in patch && !('offset' in patch))delete next.offset;\n    if('textMidpoint' in patch)next.dimension.manualText=true;\n    const picture=dimensionPicture(next,doc);\n    next.dimension.resolvedScale=picture.style.dimscale;\n    next.definitionPoint=picture.definitionPoint;next.textMidpoint=picture.textMidpoint;next.measurement=picture.measurement;\n    next.dimtype=(next.dimtype??33)|32;\n    if(next.dimension.manualText)next.dimtype|=128;else next.dimtype&=~128;\n    delete next.block;next.dirty=true;for(const key of Object.keys(e))if(!(key in next))delete e[key];Object.assign(e,next);\n    return e;\n}\nfunction dimensionGrips(e,doc) {\n    if(e.type!=='DIMENSION'||e.dimension?.version!==1)return [];\n    const picture=dimensionPicture(e,doc),type=(e.dimtype??33)&15;\n    const keys=type===0||type===1?['a','b','definitionPoint']:type===3||type===4?['definitionPoint','defpoint4']:type===2?['a','b','definitionPoint','defpoint4','defpoint5']:['a','b','definitionPoint',...(type===5?['defpoint4']:[])];\n    return [...keys.filter(k=>e[k]).map(k=>({...e[k],key:'dim:'+k})),{...picture.textMidpoint,key:'dim:textMidpoint'}];\n}\n/** Refresh authored point associations without mutating anything on failure. */\nfunction regenerateDimensions(doc) {\n    const map=new Map(doc.entities.map(e=>[e.id,e])),changes=[];\n    for(const e of doc.entities) {\n        if(e.type!=='DIMENSION'||e.dimension?.version!==1)continue;\n        const refs=e.dimension.references;if(!refs)continue;\n        const next=copy(e);\n        for(const [key,ref]of Object.entries(refs)) {\n            if(!POINT_KEYS.includes(key))throw new Error('Invalid dimension reference slot');\n            const source=map.get(ref.entityId);\n            if(!source||source.type==='DIMENSION')throw new Error('Missing or cyclic dimension reference');\n            const p=ref.point==='circle'&&['CIRCLE','ARC'].includes(source.type)?{x:source.c.x+source.r*Math.cos(ref.angle||0),y:source.c.y+source.r*Math.sin(ref.angle||0),z:source.c.z||0}:ref.point==='vertex'?source.points?.[ref.index]:['a','b','c','p'].includes(ref.point)?source[ref.point]:null;\n            next[key]=point(p,'associated point');\n        }\n        editDimension(next,doc);if(JSON.stringify(next)!==JSON.stringify(e))changes.push([e,next]);\n    }\n    for(const [e,next]of changes){Object.assign(e,next);delete e.block;}\n    return changes.map(([e])=>e.id);\n}\n\nreturn {dimensionPicture,editDimension,dimensionGrips,regenerateDimensions};\n})();\n// packages/constraints/src/expressions.js\n__modules[\"packages/constraints/src/expressions.js\"]=(()=>{\n/** Bounded arithmetic parser. No eval, property access, or executable user code. */\nconst functions = Object.freeze({\n    abs: [1, Math.abs], sqrt: [1, Math.sqrt], sin: [1, Math.sin], cos: [1, Math.cos],\n    tan: [1, Math.tan], asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],\n    atan2: [2, Math.atan2], hypot: [2, Math.hypot], min: [2, Math.min], max: [2, Math.max],\n    floor: [1, Math.floor], ceil: [1, Math.ceil], round: [1, Math.round], exp: [1, Math.exp],\n    ln: [1, Math.log], log10: [1, Math.log10], pow: [2, Math.pow],\n    rad: [1, x => x * Math.PI / 180], deg: [1, x => x * 180 / Math.PI],\n    clamp: [3, (x, lo, hi) => { if (lo > hi) throw new Error('Invalid clamp range'); return Math.min(hi, Math.max(lo, x)); }]\n});\nconst constants = Object.freeze({ pi: Math.PI, tau: Math.PI * 2, e: Math.E });\nconst forbidden = new Set(['__proto__', 'constructor', 'prototype']);\nconst finite = n => { if (!Number.isFinite(n)) throw new Error('Expression did not produce a finite number'); return n; };\nfunction expressionNames() { return [...Object.keys(constants), ...Object.keys(functions), ...forbidden]; }\nfunction expressionDependencies(source) {\n    const tokens = String(source).match(/[A-Za-z_]\\w*|(?:\\d*\\.?\\d+(?:e[+-]?\\d+)?)/gi) || [];\n    return [...new Set(tokens.filter(t => /^[A-Za-z_]/.test(t) && !Object.hasOwn(constants, t) && !Object.hasOwn(functions, t)))];\n}\nfunction parseExpression(source, parameters = {}, stack = [], budget = {remaining: 20000, cache: new Map()}) {\n    if (--budget.remaining < 0) throw new Error('Expression evaluation budget exceeded');\n    if (typeof source === 'number') return finite(source);\n    if (stack.length > 64) throw new Error('Parameter dependency depth exceeds 64');\n    if (source && typeof source === 'object') source = source.expression ?? source.value;\n    const s = String(source), tokens = []; let offset = 0;\n    if (s.length > 4096) throw new Error('Expression exceeds 4096 characters');\n    while (offset < s.length) {\n        if (/\\s/.test(s[offset])) { offset++; continue; }\n        const m = s.slice(offset).match(/^(?:\\d*\\.?\\d+(?:e[+-]?\\d+)?|[A-Za-z_]\\w*|[(),+\\-*/^])/i);\n        if (!m) throw new Error(`Invalid expression near “${s.slice(offset, offset + 12)}”`);\n        tokens.push(m[0]); offset += m[0].length;\n        if (tokens.length > 1024) throw new Error('Expression token budget exceeded');\n    }\n    let i = 0, depth = 0;\n    function primary() {\n        if (++depth > 64) throw new Error('Expression nesting exceeds 64');\n        try {\n            const t = tokens[i++];\n            if (t === undefined) throw new Error('Incomplete expression');\n            if (t === '(') { const v = sum(); if (tokens[i++] !== ')') throw new Error('Unclosed parenthesis'); return v; }\n            if (/^\\d|^\\./.test(t)) return finite(Number(t));\n            if (/^[A-Za-z_]/.test(t)) {\n                if (forbidden.has(t)) throw new Error('Reserved parameter name');\n                if (tokens[i] === '(') {\n                    if (!Object.hasOwn(functions, t)) throw new Error(`Unknown function: ${t}`);\n                    i++; const args = [];\n                    if (tokens[i] !== ')') { args.push(sum()); while (tokens[i] === ',') { i++; args.push(sum()); if (args.length > 3) throw new Error('Too many function arguments'); } }\n                    if (tokens[i++] !== ')') throw new Error('Unclosed function');\n                    const [arity, fn] = functions[t]; if (args.length !== arity) throw new Error(`${t} requires ${arity} arguments`);\n                    return finite(fn(...args));\n                }\n                if (Object.hasOwn(constants, t)) return constants[t];\n                if (!Object.hasOwn(parameters, t)) throw new Error(`Unknown parameter: ${t}`);\n                if (stack.includes(t)) throw new Error(`Parameter cycle: ${[...stack, t].join(' → ')}`);\n                if(budget.cache.has(t))return budget.cache.get(t);\n                const value=parseExpression(parameters[t], parameters, [...stack, t], budget);budget.cache.set(t,value);return value;\n            }\n            throw new Error(`Unexpected token: ${t}`);\n        } finally { depth--; }\n    }\n    function power() { const a = primary(); if (tokens[i] !== '^') return a; i++; return finite(a ** unary()); }\n    function unary() {\n        let sign = 1, count = 0;\n        while (tokens[i] === '+' || tokens[i] === '-') { if (tokens[i++] === '-') sign = -sign; if (++count > 64) throw new Error('Unary nesting exceeds 64'); }\n        return sign * power();\n    }\n    function product() { let v = unary(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], b = unary(); v = finite(op === '*' ? v * b : v / b); } return v; }\n    function sum() { let v = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], b = product(); v = finite(op === '+' ? v + b : v - b); } return v; }\n    const result = sum(); if (i !== tokens.length) throw new Error('Unexpected expression token: ' + tokens[i]); return finite(result);\n}\n/** Values and dependency lists suitable for a parameter/calculation inspector. */\nfunction parameterReport(parameters) {\n    if (Object.keys(parameters).length > 1024) throw new Error('Parameter count exceeds 1024');\n    return Object.entries(parameters).map(([name, expression]) => ({ name, expression, value: parseExpression(expression, parameters, [name]), dependencies: expressionDependencies(expression?.expression ?? expression) }));\n}\n\nreturn {expressionNames,expressionDependencies,parseExpression,parameterReport};\n})();\n// packages/constraints/src/solver.js\n__modules[\"packages/constraints/src/solver.js\"]=(()=>{\nconst {parseExpression, expressionNames} = __modules[\"packages/constraints/src/expressions.js\"];\nconst idsOf = c => c.entities || (c.entityId ? [c.entityId] : []);\nconst types = new Set(['horizontal','vertical','length','radius','diameter','coincident','concentric','parallel','perpendicular','collinear','equal','angle','angle-between','fixed','fixed-point','distance','distance-x','distance-y','point-on-line','point-on-circle','midpoint','tangent','symmetric']);\nconst numeric = new Set(['length','radius','diameter','angle','angle-between','distance','distance-x','distance-y']);\nconst refMode = c => c.reference === true || c.mode === 'reference';\nconst drivingParameters = (constraints, parameters) => ({...parameters,...Object.fromEntries(constraints.filter(c=>c.name&&!c.suppressed&&!refMode(c)&&numeric.has(c.type)).map(c=>[c.name,c.value]))});\nconst pointKeys = e => ['a','b','c','p'].filter(k => e[k]).concat((e.points || []).map((_, i) => `points.${i}`));\nfunction point(e, key) {\n    if (!e) throw new Error('Constraint references a missing entity');\n    if (key === 'start') key = 'a'; if (key === 'end') key = 'b'; if (key === 'center') key = 'c';\n    const p = /^points\\.\\d+$/.test(key) ? e.points?.[Number(key.slice(7))] : ['a','b','c','p'].includes(key) ? e[key] : null;\n    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`Constraint needs a valid point: ${e.id}.${key}`);\n    return p;\n}\nconst defaultPoint = e => e?.b ? 'b' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';\nconst secondPoint = e => e?.a ? 'a' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';\nconst norm = a => Math.hypot(...a);\nconst wrap = x => Math.atan2(Math.sin(x), Math.cos(x));\n\n/** Rank-revealing column-pivoted Householder QR; never forms JᵀJ. */\nfunction qr(matrix, rhs = null, tolerance = 1e-10) {\n    const m = matrix.length, n = matrix[0]?.length || 0;\n    const a = matrix.map(r => Float64Array.from(r)), b = rhs ? Float64Array.from(rhs) : new Float64Array(m), permutation = Array.from({length:n}, (_,i)=>i);\n    let rank = 0, largest = 0;\n    for (let k=0;k<Math.min(m,n);k++) {\n        let pivot=k, best=-1;\n        for(let j=k;j<n;j++){let s=0;for(let i=k;i<m;i++)s+=a[i][j]*a[i][j];if(s>best){best=s;pivot=j;}}\n        const size=Math.sqrt(best);if(k===0)largest=size;\n        if(size<=Math.max(largest*tolerance,1e-15))break;\n        if(pivot!==k){for(let i=0;i<m;i++)[a[i][k],a[i][pivot]]=[a[i][pivot],a[i][k]];[permutation[k],permutation[pivot]]=[permutation[pivot],permutation[k]];}\n        const alpha=a[k][k]>=0?-size:size, v=new Float64Array(m-k);v[0]=a[k][k]-alpha;\n        for(let i=k+1;i<m;i++)v[i-k]=a[i][k];let vv=0;for(const x of v)vv+=x*x;\n        const beta=2/vv;\n        for(let j=k+1;j<n;j++){let d=0;for(let i=k;i<m;i++)d+=v[i-k]*a[i][j];d*=beta;for(let i=k;i<m;i++)a[i][j]-=d*v[i-k];}\n        let d=0;for(let i=k;i<m;i++)d+=v[i-k]*b[i];d*=beta;for(let i=k;i<m;i++)b[i]-=d*v[i-k];\n        a[k][k]=alpha;for(let i=k+1;i<m;i++)a[i][k]=0;rank++;\n    }\n    const z=new Float64Array(n),x=new Float64Array(n);\n    for(let i=rank-1;i>=0;i--){let v=b[i];for(let j=i+1;j<rank;j++)v-=a[i][j]*z[j];z[i]=v/a[i][i];}\n    for(let i=0;i<n;i++)x[permutation[i]]=z[i];\n    return {x,rank,permutation};\n}\n/** Dense forward-mode derivatives inside one bounded connected component. */\nfunction algebra(n) {\n    let singular=false;\n    const c = v => ({v,d:new Float64Array(n)});\n    const add = (a,b) => {const r=c(a.v+b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]+b.d[i];return r;};\n    const sub = (a,b) => {const r=c(a.v-b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]-b.d[i];return r;};\n    const mul = (a,b) => {const r=c(a.v*b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]*b.v+b.d[i]*a.v;return r;};\n    const div = (a,b) => {if(Math.abs(b.v)<1e-20)throw new Error('Degenerate constraint geometry');const r=c(a.v/b.v);for(let i=0;i<n;i++)r.d[i]=(a.d[i]-r.v*b.d[i])/b.v;return r;};\n    const hypot = (a,b) => {const h=Math.hypot(a.v,b.v),r=c(h);if(h<=1e-20)singular=true;if(h>1e-20)for(let i=0;i<n;i++)r.d[i]=(a.v*a.d[i]+b.v*b.d[i])/h;return r;};\n    const atan2 = (y,x) => {const r=c(Math.atan2(y.v,x.v)),den=x.v*x.v+y.v*y.v;if(den<1e-24)throw new Error('Degenerate line direction');for(let i=0;i<n;i++)r.d[i]=(x.v*y.d[i]-y.v*x.d[i])/den;return r;};\n    const delta = (a,b) => ({x:sub(a.x,b.x),y:sub(a.y,b.y)});\n    return {c,add,sub,mul,div,hypot,atan2,delta,clearSingular:()=>{singular=false;},isSingular:()=>singular};\n}\nfunction compile(entities, constraints, parameters, maxVariables) {\n    const map=new Map(entities.map(e=>[e.id,e]));\n    const xs=[],ys=[],sizes=[];\n    for(const e of entities){for(const k of pointKeys(e)){const p=point(e,k);xs.push(p.x);ys.push(p.y);}if(e.r!==undefined)sizes.push(e.r);}\n    const ox=xs.length?Math.min(...xs):0,oy=ys.length?Math.min(...ys):0;\n    const targets=constraints.map(c=>numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):0);\n    const scale=Math.max(1e-6,Math.max(...xs,ox)-ox,Math.max(...ys,oy)-oy,...sizes,...targets.filter((_,i)=>!['angle','angle-between'].includes(constraints[i].type)).map(Math.abs));\n    const descriptors=[],index=new Map();\n    for(const e of entities){\n        if(!['LINE','CIRCLE','ARC','POINT','LWPOLYLINE','POLYLINE'].includes(e.type))throw new Error(`Unsupported constrained geometry: ${e.type}`);\n        if(e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Constraints require default planar OCS');\n        if(e.elevation)throw new Error('Constraints require XY geometry at Z=0');\n        if(e.type==='POLYLINE'&&(e.flags&(8|16|64))||e.points?.some(p=>p.bulge))throw new Error('Constraints require a straight planar polyline');\n        for(const k of pointKeys(e)){const p=point(e,k);if(p.z)throw new Error('Constraints require XY geometry at Z=0');for(const axis of ['x','y']){index.set(`${e.id}/${k}/${axis}`,descriptors.length);descriptors.push({value:(p[axis]-(axis==='x'?ox:oy))/scale,object:p,key:axis,origin:axis==='x'?ox:oy});}}\n        if(e.r!==undefined){if(!(e.r>0))throw new Error('Radius must be positive');index.set(`${e.id}/r`,descriptors.length);descriptors.push({value:e.r/scale,object:e,key:'r',origin:0});}\n        if(e.type==='LINE'&&Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)<scale*1e-12)throw new Error('Constraint requires a nondegenerate line');\n    }\n    if(descriptors.length>maxVariables)throw new Error(`Connected sketch exceeds ${maxVariables} scalar variables`);\n    const n=descriptors.length,{c,add,sub,mul,div,hypot,atan2,delta,clearSingular,isSingular}=algebra(n);\n    const radius=(e,v)=>{if(!e?.c||e.r===undefined)throw new Error('Constraint requires a circle or arc');return variable(`${e.id}/r`,v);};\n    function variable(key,v){const i=index.get(key);if(i===undefined)throw new Error(`Missing constrained coordinate: ${key}`);const r=c(v[i]);r.d[i]=1;return r;}\n    function pos(e,key,v){point(e,key);key=key==='start'?'a':key==='end'?'b':key==='center'?'c':key;return {x:variable(`${e.id}/${key}/x`,v),y:variable(`${e.id}/${key}/y`,v)};}\n    function start(e,segment=0){return e?.type==='LINE'?'a':`points.${segment}`;}\n    function direction(e,v,segment=0){\n        if(e?.type==='LINE')return delta(pos(e,'b',v),pos(e,'a',v));\n        if(!['LWPOLYLINE','POLYLINE'].includes(e?.type)||!Number.isInteger(segment)||segment<0||segment>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid straight polyline segment');\n        return delta(pos(e,`points.${(segment+1)%e.points.length}`,v),pos(e,`points.${segment}`,v));\n    }\n    const length = u=>hypot(u.x,u.y),dot=(u,v)=>add(mul(u.x,v.x),mul(u.y,v.y)),cross=(u,v)=>sub(mul(u.x,v.y),mul(u.y,v.x));\n    function residual(v, includeReferences=false){\n        clearSingular();const rows=[],owners=[];\n        constraints.forEach((con,k)=>{\n            if(con.suppressed||refMode(con)&&!includeReferences)return;\n            const es=idsOf(con).map(id=>map.get(id)),[a,b,z]=es,value=targets[k],out=[];\n            const pp=()=>pos(a,con.pointA||defaultPoint(a),v),qq=()=>pos(b,con.pointB||secondPoint(b),v);\n            const dir=e=>direction(e,v,e===a?(con.segmentA??0):(con.segmentB??0)),first=e=>pos(e,start(e,e===a?(con.segmentA??0):(con.segmentB??0)),v);\n            const pushPoint=(p,q)=>out.push(sub(p.x,q.x),sub(p.y,q.y));\n            switch(con.type){\n                case 'horizontal':out.push(dir(a).y);break;\n                case 'vertical':out.push(dir(a).x);break;\n                case 'length':out.push(sub(length(dir(a)),c(value/scale)));break;\n                case 'radius':out.push(sub(radius(a,v),c(value/scale)));break;\n                case 'diameter':out.push(sub(mul(c(2),radius(a,v)),c(value/scale)));break;\n                case 'coincident':pushPoint(pp(),qq());break;\n                case 'concentric':radius(a,v);radius(b,v);pushPoint(pos(a,'c',v),pos(b,'c',v));break;\n                case 'parallel':case 'perpendicular':case 'collinear':{\n                    const u=dir(a),w=dir(b),den=mul(length(u),length(w));\n                    out.push(div(con.type==='perpendicular'?dot(u,w):cross(u,w),den));\n                    if(con.type==='collinear')out.push(div(cross(delta(first(b),first(a)),u),length(u)));break;\n                }\n                case 'equal':if((a.r!==undefined)!==(b?.r!==undefined))throw new Error('Equal requires matching geometry');out.push(sub(a.r!==undefined?radius(a,v):length(dir(a)),b?.r!==undefined?radius(b,v):length(dir(b))));break;\n                case 'angle':case 'angle-between':{\n                    const u=dir(a);let angle=atan2(u.y,u.x);\n                    if(con.type==='angle-between'){const w=dir(b);angle=sub(atan2(w.y,w.x),angle);}\n                    const r=sub(angle,c(value*Math.PI/180));r.v=wrap(r.v);out.push(r);break;\n                }\n                case 'distance':case 'distance-x':case 'distance-y':{\n                    const u=delta(qq(),pp());out.push(sub(con.type==='distance'?length(u):u[con.type==='distance-x'?'x':'y'],c(value/scale)));break;\n                }\n                case 'point-on-line':case 'midpoint':{\n                    const u=dir(b),start=first(b);\n                    if(con.type==='midpoint')pushPoint(pp(),{x:add(start.x,mul(u.x,c(.5))),y:add(start.y,mul(u.y,c(.5)))});\n                    else out.push(div(cross(delta(pp(),start),u),length(u)));break;\n                }\n                case 'point-on-circle':out.push(sub(length(delta(pp(),pos(b,'c',v))),radius(b,v)));break;\n                case 'tangent':{\n                    if(a.type==='LINE'||b?.type==='LINE'){\n                        const l=a.type==='LINE'?a:b,ring=a.type==='LINE'?b:a,u=direction(l,v);\n                        const r=div(cross(u,delta(pos(ring,'c',v),pos(l,'a',v))),length(u));\n                        const side=con.side??(Math.sign((l.b.x-l.a.x)*(ring.c.y-l.a.y)-(l.b.y-l.a.y)*(ring.c.x-l.a.x))||1);\n                        out.push(sub(r,mul(c(side),radius(ring,v))));\n                    }else{const r1=radius(a,v),r2=radius(b,v);out.push(sub(length(delta(pos(a,'c',v),pos(b,'c',v))),con.internal?mul(c(con.side??(a.r>=b.r?1:-1)),sub(r1,r2)):add(r1,r2)));}break;\n                }\n                case 'symmetric':{\n                    const u=direction(z,v,con.segmentC??0),p=pp(),q=qq(),mid={x:mul(add(p.x,q.x),c(.5)),y:mul(add(p.y,q.y),c(.5))};\n                    out.push(div(cross(delta(mid,pos(z,start(z,con.segmentC??0),v)),u),length(u)),div(dot(delta(q,p),u),length(u)));break;\n                }\n                case 'fixed-point':{\n                    const t=con.target;if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.y))throw new Error('Fixed point requires an explicit target');pushPoint(pp(),{x:c((t.x-ox)/scale),y:c((t.y-oy)/scale)});break;\n                }\n                case 'fixed':{\n                    const t=con.target;if(!t)throw new Error('Fixed geometry requires an explicit target');\n                    for(const key of pointKeys(a)){const p=point(t,key);pushPoint(pos(a,key,v),{x:c((p.x-ox)/scale),y:c((p.y-oy)/scale)});}\n                    if(a.r!==undefined){if(!Number.isFinite(t.r))throw new Error('Missing fixed radius target');out.push(sub(radius(a,v),c(t.r/scale)));}break;\n                }\n                default:throw new Error(`Unknown constraint: ${con.type}`);\n            }\n            for(const row of out){if(!Number.isFinite(row.v)||row.d.some(v=>!Number.isFinite(v)))throw new Error('Non-finite constraint residual');rows.push(row);owners.push(k);}\n        });return {r:rows.map(v=>v.v),j:rows.map(v=>v.d),owners,singular:isSingular()};\n    }\n    const initial=descriptors.map(v=>v.value);residual(initial);\n    return {initial,descriptors,scale,residual,constraints,valid:v=>v.every(Number.isFinite)&&descriptors.every((d,i)=>d.key!=='r'||v[i]>1e-12),apply:v=>descriptors.forEach((d,i)=>{d.object[d.key]=v[i]*scale+d.origin;})};\n}\nfunction solveComponent(problem, options, analyzeOnly=false){\n    let x=problem.initial.slice(),current=problem.residual(x),cost=norm(current.r),lambda=1e-3,iterations=0,rejected=0;\n    const threshold=options.tolerance/problem.scale+options.relativeTolerance;\n    let singularStartPerturbed=false;\n    if(!analyzeOnly&&current.singular&&cost>threshold){\n        // Break only a nondifferentiable zero-distance initial state. The deterministic\n        // trial stays private and is accepted only if it lowers the original residual.\n        const seed=x.map((v,i)=>problem.descriptors[i].key==='r'?v:v+1e-4*(i%7+1)*(i%2?1:-1));\n        if(problem.valid(seed))try{const trial=problem.residual(seed),value=norm(trial.r);if(value<cost){x=seed;current=trial;cost=value;singularStartPerturbed=true;}}catch{}\n    }\n    if(!analyzeOnly)for(;iterations<options.maxIterations&&Math.max(0,...current.r.map(Math.abs))>threshold;iterations++){\n        const n=x.length,col=Array.from({length:n},(_,k)=>Math.max(1e-6,Math.hypot(...current.j.map(r=>r[k]))));\n        const augmented=current.j.map(r=>Array.from(r)),rhs=current.r.map(v=>-v);\n        for(let k=0;k<n;k++){const row=new Float64Array(n);row[k]=Math.sqrt(lambda)*col[k];augmented.push(row);rhs.push(0);}\n        const step=qr(augmented,rhs).x;let max=Math.max(0,...step.map(Math.abs));if(max>10)for(let k=0;k<n;k++)step[k]*=10/max;\n        const candidate=x.map((v,k)=>v+step[k]);let trial=null,nextCost=Infinity;\n        if(problem.valid(candidate))try{trial=problem.residual(candidate);nextCost=norm(trial.r);}catch{/* Reject a degenerate trial without touching source. */}\n        if(nextCost<cost){x=candidate;current=trial;cost=nextCost;lambda=Math.max(1e-12,lambda*.25);}else{lambda=Math.min(1e16,lambda*8);rejected++;if(lambda===1e16)break;}\n    }\n    const rank=qr(current.j,null,options.rankTolerance).rank,n=x.length,m=current.r.length;\n    const equationQR=qr(Array.from({length:n},(_,k)=>current.j.map(row=>row[k])),null,options.rankTolerance);\n    const dependent=new Set(equationQR.permutation.slice(rank).map(i=>current.owners[i]));\n    const converged=Math.max(0,...current.r.map(Math.abs))<=threshold;\n    const perConstraint=problem.constraints.map((c,k)=>{const rs=current.r.filter((_,i)=>current.owners[i]===k),error=Math.max(0,...rs.map(Math.abs));return {id:c.id??`constraint-${k}`,type:c.type,mode:refMode(c)?'reference':'driving',suppressed:!!c.suppressed,residual:error*problem.scale,satisfied:error<=threshold,redundant:converged&&dependent.has(k)};});\n    return {x,converged,iterations,singularStartPerturbed,rejectedSteps:rejected,residual:cost*problem.scale,normalizedResidual:cost,variables:n,equations:m,rank,degreesOfFreedom:n-rank,redundantEquations:m-rank,constraints:perConstraint,status:converged?(rank===n?'fully-constrained':'under-constrained'):'conflicting-or-unconverged'};\n}\nclass SketchSolver {\n    constructor({tolerance=1e-7,relativeTolerance=1e-10,maxIterations=100,maxVariables=256,rankTolerance=1e-9}={}){\n        if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(relativeTolerance)||relativeTolerance<0||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>1000||!Number.isInteger(maxVariables)||maxVariables<1||maxVariables>512||!Number.isFinite(rankTolerance)||rankTolerance<=0)throw new Error('Invalid solver options');\n        Object.assign(this,{tolerance,relativeTolerance,maxIterations,maxVariables,rankTolerance});\n    }\n    analyze(entities,constraints,parameters={}){return this.solve(entities,constraints,parameters,{analyzeOnly:true});}\n    solve(entities,constraints,parameters={}, {analyzeOnly=false}={}){\n        if(!Array.isArray(entities)||!Array.isArray(constraints)||constraints.length>4096)throw new Error('Invalid sketch or constraint budget');\n        const attached=new Set(constraints.filter(c=>!c.suppressed&&!refMode(c)).flatMap(idsOf));\n        constraints=[...constraints,...entities.filter(e=>e.locked&&attached.has(e.id)).map(e=>({id:'locked-'+e.id,type:'fixed',entityId:e.id,target:structuredClone(e),visible:false}))];\n        const map=new Map(entities.map(e=>[e.id,e]));if(map.size!==entities.length)throw new Error('Duplicate sketch entity IDs');\n        const parent=new Map(),find=id=>{if(!parent.has(id))parent.set(id,id);const p=parent.get(id);if(p!==id)parent.set(id,find(p));return parent.get(id);};\n        const constraintNames=new Set();\n        for(const c of constraints){\n            if(c.name){if(!/^[A-Za-z_]\\w*$/.test(c.name)||expressionNames().includes(c.name)||constraintNames.has(c.name)||Object.hasOwn(parameters,c.name))throw new Error('Invalid or duplicate constraint name: '+c.name);constraintNames.add(c.name);}\n        }\n        parameters=drivingParameters(constraints,parameters);\n        for(const c of constraints){\n            if(c.type==='tangent'&&c.side!==undefined&&![1,-1].includes(c.side))throw new Error('Tangent side must be +1 or -1');\n            if(c.suppressed)continue;if(!types.has(c.type))throw new Error(`Unknown constraint: ${c.type}`);\n            const ids=idsOf(c);if(!ids.length||ids.some(id=>!map.has(id)))throw new Error('Constraint references a missing entity');\n            if(numeric.has(c.type)&&!refMode(c)){const v=parseExpression(c.value,parameters);if(['length','radius','diameter','distance'].includes(c.type)&&v<=0)throw new Error('Constraint size must be positive');}\n            if(refMode(c)){measureConstraint(entities,c);continue;}\n            ids.forEach(id=>{const root=find(ids[0]);parent.set(find(id),root);});\n        }\n        const groups=new Map();for(const id of parent.keys()){const root=find(id);if(!groups.has(root))groups.set(root,{ids:[],constraints:[]});groups.get(root).ids.push(id);}\n        for(const c of constraints)if(!c.suppressed&&!refMode(c))groups.get(find(idsOf(c)[0])).constraints.push(c);\n        const problems=[...groups.values()].map(g=>compile(g.ids.map(id=>map.get(id)),g.constraints,parameters,this.maxVariables));\n        if(problems.reduce((n,p)=>n+p.initial.length,0)>4096)throw new Error('Sketch exceeds 4096 scalar variables');\n        sketchAnnotations(entities,constraints,parameters);\n        const results=problems.map(p=>solveComponent(p,this,analyzeOnly)),converged=results.every(r=>r.converged);\n        if(converged&&!analyzeOnly)problems.forEach((p,i)=>p.apply(results[i].x));\n        const sum=k=>results.reduce((n,r)=>n+r[k],0);\n        const unconstrainedVariables=entities.filter(e=>!e.locked&&!parent.has(e.id)&&['LINE','CIRCLE','ARC','POINT','LWPOLYLINE'].includes(e.type)).reduce((n,e)=>n+pointKeys(e).length*2+(e.r!==undefined?1:0),0);\n        const dof=sum('degreesOfFreedom')+unconstrainedVariables;\n        const annotated=sketchAnnotations(entities,constraints,parameters);\n        const diagnostics=results.flatMap(r=>r.constraints);\n        return {converged,iterations:Math.max(0,...results.map(r=>r.iterations)),residual:Math.hypot(...results.map(r=>r.residual)),variables:sum('variables')+unconstrainedVariables,unconstrainedVariables,affectedVariables:sum('variables'),equations:sum('equations'),rank:sum('rank'),degreesOfFreedom:dof,redundantEquations:sum('redundantEquations'),components:results.map(({x,...r})=>r),constraints:diagnostics,annotations:annotated,conflicts:diagnostics.filter(c=>!c.satisfied).map(c=>c.id),status:!results.length?'unconstrained':converged?(dof?'under-constrained':'fully-constrained'):'conflicting-or-unconverged',rolledBack:!converged&&!analyzeOnly,analysisOnly:analyzeOnly,jacobian:'analytic-forward-mode',linearSolver:'column-pivoted-householder-qr'};\n    }\n}\n/** Read-only driving/reference values; measurements never solve or mutate. */\nfunction measureConstraint(entities,c){\n    const [a,b]=idsOf(c).map(id=>entities.find(e=>e.id===id));if(!a)throw new Error('Constraint references a missing entity');\n    const ends=e=>{if(e?.a&&e?.b)return [e.a,e.b];const i=e===a?(c.segmentA??0):(c.segmentB??0);if(!e?.points||!Number.isInteger(i)||i<0||i>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid polyline segment');return [e.points[i],e.points[(i+1)%e.points.length]];};\n    const len=e=>{const [p,q]=ends(e);return Math.hypot(q.x-p.x,q.y-p.y);};\n    if(c.type==='length')return len(a);\n    if(c.type==='radius'||c.type==='diameter'){if(a.r===undefined)throw new Error('Constraint requires a circle');return a.r*(c.type==='diameter'?2:1);}\n    if(c.type==='angle'||c.type==='angle-between'){const [p,q]=ends(a);let angle=Math.atan2(q.y-p.y,q.x-p.x);if(c.type==='angle-between'){const [r,s]=ends(b);angle=wrap(Math.atan2(s.y-r.y,s.x-r.x)-angle);}return angle*180/Math.PI;}\n    if(c.type.startsWith('distance')){const p=point(a,c.pointA||defaultPoint(a)),q=point(b,c.pointB||secondPoint(b));return c.type==='distance-x'?q.x-p.x:c.type==='distance-y'?q.y-p.y:Math.hypot(q.x-p.x,q.y-p.y);}\n    return null;\n}\nfunction sketchAnnotations(entities,constraints,parameters={}){\n    parameters=drivingParameters(constraints,parameters);\n    return constraints.filter(c=>!c.suppressed).map((c,i)=>{\n        const a=entities.find(e=>e.id===idsOf(c)[0]),b=entities.find(e=>e.id===idsOf(c)[1]);\n        let value=measureConstraint(entities,c),target=numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):null;\n        const p=a?.c||a?.p||(a?.a&&a?.b?{x:(a.a.x+a.b.x)/2,y:(a.a.y+a.b.y)/2}:a?.points?.[0])||{x:0,y:0};\n        const name=c.name||c.type,text=value===null?name:`${name}${refMode(c)?' (ref)':''} = ${Number(value.toPrecision(8))}${['angle','angle-between'].includes(c.type)?'°':''}`;\n        return {id:c.id??`constraint-${i}`,entityIds:idsOf(c),position:{...p},text,value,target,expression:c.value??null,reference:refMode(c),visible:c.visible!==false};\n    });\n}\n\nreturn {SketchSolver,measureConstraint,sketchAnnotations};\n})();\n// packages/constraints/src/index.js\n__modules[\"packages/constraints/src/index.js\"]=(()=>{\nconst {parseExpression, parameterReport, expressionDependencies, expressionNames} = __modules[\"packages/constraints/src/expressions.js\"];\nconst {SketchSolver, measureConstraint, sketchAnnotations} = __modules[\"packages/constraints/src/solver.js\"];\nfunction evaluateExpression(source, parameters = {}, stack = []) { return parseExpression(source, parameters, stack); }\nfunction resolveParameters(parameters) { return Object.fromEntries(parameterReport(parameters).map(p => [p.name, p.value])); }\nfunction describeParameters(parameters) { return parameterReport(parameters); }\nfunction parameterDependencies(source) { return expressionDependencies(source); }\nfunction reservedParameterNames() { return expressionNames(); }\nfunction constraintMeasurement(entities, constraint) { return measureConstraint(entities, constraint); }\nfunction constraintAnnotations(entities, constraints, parameters = {}) { return sketchAnnotations(entities, constraints, parameters); }\n/** Analytic-Jacobian, component-partitioned, damped QR planar constraint solver. */\nclass ConstraintSolver extends SketchSolver {}\n/** Suggest horizontal/vertical and endpoint coincidences. Application is an explicit transaction. */\nfunction inferSketchConstraints(entities, existing = [], {linearTolerance = 1e-5, angularTolerance = 1e-5} = {}) {\n    if(!Number.isFinite(linearTolerance)||linearTolerance<=0||!Number.isFinite(angularTolerance)||angularTolerance<=0||entities.length>1000)throw new Error('Invalid automatic constraint budget or tolerance');\n    const result=[],known=new Set(existing.map(c=>JSON.stringify([c.type,c.entities||[c.entityId],c.pointA,c.pointB,c.segmentA]))),points=[],buckets=new Map(),connected=new Map(),ids=new Set(existing.map(c=>c.id));\n    let sequence=0;\n    const root=id=>{if(!connected.has(id))connected.set(id,id);const r=connected.get(id);if(r!==id)connected.set(id,root(r));return connected.get(id);};\n    const append=c=>{const key=JSON.stringify([c.type,c.entities,c.pointA,c.pointB,c.segmentA]);if(!known.has(key)){known.add(key);let id;do{id=`auto-${sequence++}-${c.entities[0]}-${c.type}`;}while(ids.has(id));ids.add(id);if(result.length>=4096)throw new Error('Automatic constraint count exceeds 4096');result.push({id,...c});}};\n    for(const e of entities){\n        if(e.locked||e.a?.z||e.b?.z||e.elevation||e.points?.some(p=>p.z)||e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))continue;\n        const segments=e.type==='LINE'?[[e.a,e.b,undefined]]:e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge)?e.points.slice(0,e.closed?undefined:-1).map((p,i)=>[p,e.points[(i+1)%e.points.length],i]):[];\n        for(const [a,b,segment]of segments){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<linearTolerance)continue;\n            if(Math.abs(dy)/l<angularTolerance)append({type:'horizontal',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});\n            else if(Math.abs(dx)/l<angularTolerance)append({type:'vertical',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});\n        }\n        if(e.type==='LINE')points.push({id:e.id,key:'a',p:e.a},{id:e.id,key:'b',p:e.b});\n        if(e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge))e.points.forEach((p,i)=>points.push({id:e.id,key:`points.${i}`,p}));\n    }\n    if(points.length>8192)throw new Error('Automatic endpoint budget exceeds 8192');\n    for(const c of existing)if(c.type==='coincident'&&!c.suppressed&&!c.reference&&c.entities?.length===2){const [a,b]=c.entities;connected.set(root(a+'/'+(c.pointA||'b')),root(b+'/'+(c.pointB||'a')));}\n    for(const p of points){const ix=Math.floor(p.p.x/linearTolerance),iy=Math.floor(p.p.y/linearTolerance),identity=p.id+'/'+p.key;\n        for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(const q of buckets.get(`${x},${y}`)||[]){\n            if(q.id===p.id||Math.hypot(q.p.x-p.p.x,q.p.y-p.p.y)>linearTolerance)continue;const previous=q.id+'/'+q.key;\n            if(root(identity)!==root(previous)){append({type:'coincident',entities:[q.id,p.id],pointA:q.key,pointB:p.key});connected.set(root(identity),root(previous));}\n        }\n        const key=`${ix},${iy}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);\n    }\n    return result;\n}\n/** Resolve and atomically apply computed TEXT values from parameters and named measurements. */\nfunction evaluateCalculations(entities, constraints, parameters) {\n    const values={...resolveParameters(parameters)},updates=[];\n    for(const c of constraints)if(c.name&&!c.suppressed){const value=measureConstraint(entities,c);if(value!==null)values[c.name]=value;}\n    for(const e of entities)if(e.calculation){if(!['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(e.type))throw new Error('Calculated annotations require a text entity');const spec=e.calculation,value=parseExpression(spec.expression,values),precision=spec.precision??3;if(!Number.isInteger(precision)||precision<0||precision>12)throw new Error('Annotation precision must be 0–12');updates.push({entity:e,value,text:`${spec.prefix||''}${Number(value.toFixed(precision))}${spec.suffix||''}`});}\n    for(const {entity,text,value}of updates){entity.text=text;entity.calculation.value=value;}\n    return updates.map(({entity,value,text})=>({entityId:entity.id,value,text}));\n}\n\nreturn {evaluateExpression,resolveParameters,describeParameters,parameterDependencies,reservedParameterNames,constraintMeasurement,constraintAnnotations,ConstraintSolver,inferSketchConstraints,evaluateCalculations};\n})();\n// packages/model/src/blocks.js\n__modules[\"packages/model/src/blocks.js\"]=(()=>{\nconst {matrix, compose, transform} = __modules[\"packages/geometry/src/index.js\"];\nconst {regenerateDimensions} = __modules[\"packages/model/src/dimensions.js\"];\nconst {ConstraintSolver, resolveParameters, evaluateCalculations} = __modules[\"packages/constraints/src/index.js\"];\nconst clone = x => structuredClone(x);\nconst own = (o,k) => Object.hasOwn(o,k);\nconst attributeTag = e => String(e.attributeTag ?? e.tag ?? '');\nconst constantAttribute = e => !!(e.constant || ((e.attributeFlags ?? e.flags ?? 0) & 2));\nconst validName = name => typeof name==='string' && name.trim()===name && name.length>0 && name.length<=255 && !/[<>/\\\\\":;?*|,=`\\x00-\\x1f]/.test(name) && !['__proto__','constructor','prototype'].includes(name);\nconst point = (p,label) => {if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e12||Math.abs(p.y)>1e12||p.z)throw new Error(`Invalid planar ${label}`);};\nfunction blockSignature(block) { return JSON.stringify(block); }\n/** Returns direct/nested references without flattening the database or invoking evaluators. */\nfunction blockReferences(document, name) {\n    if(!own(document.blocks,name))throw new Error('Missing block definition: '+name);\n    const affected=new Set([name]);let changed=true;\n    while(changed){changed=false;for(const [key,b]of Object.entries(document.blocks))if(!affected.has(key)&&(b.entities||[]).some(e=>e.type==='INSERT'&&affected.has(e.block))){affected.add(key);changed=true;}}\n    const direct=document.entities.filter(e=>e.type==='INSERT'&&e.block===name).map(e=>e.id);\n    const inserts=document.entities.filter(e=>e.type==='INSERT'&&affected.has(e.block)).map(e=>e.id);\n    const nested=Object.entries(document.blocks).flatMap(([owner,b])=>(b.entities||[]).filter(e=>e.type==='INSERT'&&e.block===name).map(e=>({owner,entityId:e.id})));\n    return {name,direct,inserts,nested,definitions:[...affected]};\n}\nfunction checkTree(blocks,root) {\n    const done=new Set(),active=new Set();\n    const visit=(name,depth)=>{\n        if(depth>32)throw new Error('Block nesting exceeds 32 levels');if(active.has(name))throw new Error('Cyclic block nesting: '+[...active,name].join(' → '));if(done.has(name))return;\n        const b=blocks[name];if(!b)throw new Error('Missing nested block: '+name);active.add(name);\n        for(const e of b.entities||[])if(e.type==='INSERT')visit(e.block,depth+1);\n        active.delete(name);done.add(name);\n    };visit(root,0);\n}\nfunction validateBlockDraft(block, blocks, evaluate) {\n    if(!block||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Block must contain at most 10,000 entities');\n    point(block.base||{x:0,y:0},'block base');const ids=new Set(),ports=new Set(),tags=new Set();\n    const walk=(value,depth=0)=>{if(depth>32)throw new Error('Block data nesting exceeds 32');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite block data');if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Reserved block property');walk(v,depth+1);}};\n    walk(block);\n    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Missing or duplicate block entity ID');ids.add(e.id);for(const key of ['a','b','c','p'])if(key in e)point(e[key],'entity '+key);for(const p of e.points||[])point(p,'vertex');if(['CIRCLE','ARC'].includes(e.type)&&!(e.r>0))throw new Error('Radius must be positive');if(e.type==='LINE'&&(!e.a||!e.b))throw new Error('Line needs endpoints');if(e.type==='ATTDEF'){const tag=attributeTag(e);if(!tag||tag.length>255||/\\s/.test(tag)||tags.has(tag.toUpperCase()))throw new Error('Attribute tags must be unique and contain no whitespace');tags.add(tag.toUpperCase());e.attributeTag=tag;}}\n    for(const p of block.ports||[]){point(p,'port');if(!p.name||ports.has(p.name)||!Number.isFinite(p.dx)||!Number.isFinite(p.dy)||Math.hypot(p.dx,p.dy)<1e-12)throw new Error('Invalid or duplicate block port');ports.add(p.name);if(p.anchor&&!ids.has(p.anchor.entityId))throw new Error('Port anchor references missing geometry');}\n    checkTree({...blocks,[block.name]:block},block.name);\n    resolveParameters(block.parameters||{});\n    if(block.dynamic)evaluate(block,{});\n    else if(block.constraints?.length){const report=new ConstraintSolver().solve(block.entities,block.constraints,block.parameters||{});if(!report.converged)throw new Error('Block constraints conflict: '+report.conflicts.join(', '));}\n    if(!block.dynamic){\n        for(const p of block.ports||[])if(p.anchor){const e=block.entities.find(e=>e.id===p.anchor.entityId),k=p.anchor.point,point=/^points\\.\\d+$/.test(k)?e?.points?.[Number(k.slice(7))]:['a','b','c','p'].includes(k)?e?.[k]:null;if(!point)throw new Error('Invalid port anchor');p.x=point.x;p.y=point.y;if(p.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=p.anchor.reverse?-1:1;if(n<1e-12)throw new Error('Degenerate port direction');p.dx=sign*(e.b.x-e.a.x)/n;p.dy=sign*(e.b.y-e.a.y)/n;}}\n        regenerateDimensions({entities:block.entities,dimstyles:block.dimstyles||{}});\n        evaluateCalculations(block.entities,block.constraints||[],block.parameters||{});\n    }\n    return block;\n}\n/** Isolated copy for a graphical editing session. Does not mutate the source. */\nfunction beginBlockDraft(document,name) {\n    const block=document.blocks[name];if(!block)throw new Error('Missing block: '+name);\n    if(block.flags&4)throw new Error('External reference definitions must be resolved before editing');\n    const draft={...clone(document),name:`Block: ${name}`,entities:clone(block.entities||[]),constraints:clone(block.constraints||block.dynamic?.constraints||[]),parameters:clone(block.parameters||{}),activeLayout:'Model',layouts:['Model'],metadata:{}};\n    delete draft.original;delete draft.originalSource;delete draft.dxfSource;\n    for(const e of draft.entities)e.layout='Model';\n    draft.blockEditing={name,base:clone(block.base||{x:0,y:0}),ports:clone(block.ports||[]),dynamic:clone(block.dynamic||null)};\n    for(const p of block.dynamic?.parameters||[])if(['number','distance','angle','integer'].includes(p.type))draft.parameters[p.name]=p.expression??p.default;\n    return {name,signature:blockSignature(block),draft,referenceInfo:blockReferences(document,name)};\n}\nfunction blockFromDraft(session) {\n    const old=session.draft.blocks[session.name]||{},info=session.draft.blockEditing;\n    const result={...clone(old),name:session.name,base:clone(info.base),ports:clone(info.ports),entities:clone(session.draft.entities),constraints:clone(session.draft.constraints),parameters:clone(session.draft.parameters)};\n    if(info.dynamic){result.dynamic=clone(info.dynamic);result.dynamic.constraints=clone(result.constraints);for(const p of result.dynamic.parameters)delete result.parameters[p.name];}\n    else delete result.dynamic;\n    for(const e of result.entities){delete e.layout;delete e.handle;delete e.owner;delete e.raw;}\n    delete result.raw;return result;\n}\n/** Synchronize native attribute values while retaining existing user text and identity.\n * Decompose the complete affine text frame, including mirrored and rotated nonuniform inserts.\n */\nfunction syncAttributes(insert,block,nextId) {\n    const old=new Map((insert.attributes||[]).map(a=>[attributeTag(a).toUpperCase(),a]));\n    const m=compose(matrix(insert),matrix({x:-(block.base?.x||0),y:-(block.base?.y||0)}));\n    const definitions=(block.entities||[]).filter(e=>e.type==='ATTDEF'&&!constantAttribute(e));\n    const transformed=definitions.map(def=>{\n        const tag=attributeTag(def);if(!tag)throw new Error('Missing native attribute tag');\n        if(def.extrusion&&(def.extrusion.x||def.extrusion.y||def.extrusion.z!==1))throw new Error('Attribute synchronization requires default OCS');\n        const previous=old.get(tag.toUpperCase()),a={...clone(def),id:previous?.id||nextId(),type:'ATTRIB',attributeTag:tag,tag,layer:def.layer==='0'?insert.layer||'0':def.layer||insert.layer||'0',text:def.calculation?def.text??'':previous?.text??def.text??'',p:transform(def.p,m)};\n        if(def.alignPoint)a.alignPoint=transform(def.alignPoint,m);\n        const angle=(def.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),width=(def.widthFactor||1)*((def.textFlags&2)?-1:1),vertical=(def.textFlags&4)?-1:1,slant=Math.tan((def.oblique||0)*Math.PI/180);\n        const ux=m[0]*c*width+m[2]*s*width,uy=m[1]*c*width+m[3]*s*width;\n        const vx=(m[0]*(c*slant-s)+m[2]*(s*slant+c))*vertical,vy=(m[1]*(c*slant-s)+m[3]*(s*slant+c))*vertical;\n        const baseline=Math.hypot(ux,uy),rise=(ux*vy-uy*vx)/baseline,h=Math.abs(rise);\n        if(!Number.isFinite(h)||h<1e-12||baseline<1e-12)throw new Error('Singular attribute frame');\n        a.height=(def.height||12)*h;a.widthFactor=baseline/h;a.rotation=Math.atan2(uy,ux)*180/Math.PI;\n        a.oblique=Math.atan((ux*vx+uy*vy)/baseline/rise)*180/Math.PI;a.textFlags=((def.textFlags||0)&~6)|(rise<0?4:0);\n        a.invisible=!!(def.invisible||def.hidden);delete a.handle;delete a.owner;delete a.raw;return a;\n    });\n    insert.attributes=transformed;\n}\n/** Prepare an entire database update, validate all variants and references, then commit once. */\nfunction prepareBlockDraft(document,name,replacement,{expectedSignature,attributes=true}={},evaluate,nextId) {\n    const original=document.blocks[name];if(original?.flags&4)throw new Error('External reference definitions are read-only');if(!original)throw new Error('Missing block definition');\n    if(expectedSignature!==undefined&&blockSignature(original)!==expectedSignature)throw new Error('Block changed since editing began. Reopen it before saving.');\n    const next=clone(document),block=clone(replacement);block.name=name;block.revision=(original.revision||0)+1;\n    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;\n    const info=blockReferences(next,name),names=new Set(info.definitions),affectedIds=new Set(info.inserts);\n    for(const root of names)checkTree(next.blocks,root);\n    const validateInsert=e=>{\n        const b=next.blocks[e.block];if(!b)throw new Error('Missing insert definition');\n        const evaluated=b.dynamic?evaluate(b,e.dynamicParameters||{}):b;\n        if(e.block===name&&attributes)syncAttributes(e,evaluated,nextId);\n        e.dirty=true;return evaluated;\n    };\n    for(const e of next.entities)if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);\n    for(const b of Object.values(next.blocks))for(const e of b.entities||[])if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);\n    for(const e of next.entities)if(e.connector)for(const end of ['from','to']){\n        const reference=e.connector[end];if(!reference||!affectedIds.has(reference.entityId))continue;\n        const insert=next.entities.find(e=>e.id===reference.entityId),b=next.blocks[insert.block],evaluated=b.dynamic?evaluate(b,insert.dynamicParameters||{}):b;\n        const portName=reference.port??reference.portName??reference.name;\n        if(!(evaluated.ports||[]).some(p=>p.name===portName))throw new Error(`Block update would remove connected port: ${portName}`);\n    }\n    next.version=(next.version||0)+1;return {document:next,report:{...info,revision:block.revision,updatedInserts:info.inserts.length,attributesSynchronized:attributes}};\n}\nfunction renameBlockInDocument(document,oldName,newName) {\n    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');\n    if(!own(document.blocks,oldName))throw new Error('Missing block definition');\n    const next=clone(document);next.blocks[newName]={...next.blocks[oldName],name:newName};delete next.blocks[oldName];\n    for(const e of [...next.entities,...Object.values(next.blocks).flatMap(b=>b.entities||[])]){if(e.block===oldName)e.block=newName;if(e.dynamicSource===oldName)e.dynamicSource=newName;}\n    return next;\n}\nfunction copyBlockInDocument(document,name,newName) {\n    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');\n    if(!own(document.blocks,name))throw new Error('Missing block definition');\n    const next=clone(document);next.blocks[newName]={...clone(next.blocks[name]),name:newName,revision:0};delete next.blocks[newName].symbol;delete next.blocks[newName].handle;return next;\n}\n/** Create a validated definition without modifying an existing database object. */\nfunction createBlockInDocument(document,name,definition,evaluate) {\n    if(!validName(name)||own(document.blocks,name))throw new Error('Invalid or existing block name');\n    const next=clone(document),block={base:{x:0,y:0},ports:[],entities:[],...clone(definition||{}),name,revision:0};\n    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;return next;\n}\nfunction removeBlockInDocument(document,name) {\n    const info=blockReferences(document,name);if(info.direct.length||info.nested.length)throw new Error('Referenced blocks cannot be deleted');\n    const next=clone(document);delete next.blocks[name];return next;\n}\n\nreturn {blockSignature,blockReferences,validateBlockDraft,beginBlockDraft,blockFromDraft,syncAttributes,prepareBlockDraft,renameBlockInDocument,copyBlockInDocument,createBlockInDocument,removeBlockInDocument};\n})();\n// packages/model/src/gradients.js\n__modules[\"packages/model/src/gradients.js\"]=(()=>{\n/** Portable native LINEAR gradient descriptor. Unknown distributions are not approximated silently. */\nfunction linearHatchGradient(tags,contours,frame) {\n    if(!Array.isArray(tags))return null;\n    const value=(code,fallback)=>tags.find(p=>p[0]===code)?.[1]??fallback;\n    if(value(450,0)!==1||value(470,'LINEAR')!=='LINEAR'||value(461,0)!==0||value(453,2)!==2)return null;\n    const colors=tags.filter(p=>p[0]===421).map(p=>p[1]);\n    if(colors.length!==2||colors.some(c=>!Number.isInteger(c)||c<0||c>0xffffff))return null;\n    const rotation=value(460,0);if(!Number.isFinite(rotation))return null;\n    const u={x:Math.cos(rotation),y:Math.sin(rotation)};\n    let lo=Infinity,hi=-Infinity;\n    for(const polygon of contours)for(const p of polygon){const t=p.x*u.x+p.y*u.y;lo=Math.min(lo,t);hi=Math.max(hi,t);}\n    if(!Number.isFinite(lo)||hi-lo<1e-12)return null;\n    return {kind:'linear',start:{x:u.x*lo,y:u.y*lo},end:{x:u.x*hi,y:u.y*hi},frame:frame.slice(),colors:colors.map(c=>'#'+c.toString(16).padStart(6,'0'))};\n}\n\nreturn {linearHatchGradient};\n})();\n// packages/model/src/dynamic.js\n__modules[\"packages/model/src/dynamic.js\"]=(()=>{\nconst {regenerateDimensions} = __modules[\"packages/model/src/dimensions.js\"];\nconst {ConstraintSolver, evaluateExpression, parameterDependencies, resolveParameters, evaluateCalculations} = __modules[\"packages/constraints/src/index.js\"];\nconst {matrix, compose, transform} = __modules[\"packages/geometry/src/index.js\"];\nconst clone=v=>JSON.parse(JSON.stringify(v));\nconst own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);\nconst forbidden=new Set(['__proto__','prototype','constructor']);\nconst finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e12)throw new Error(`Invalid dynamic ${name}`);return x;};\nconst inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;\nconst pivot=(m,p={x:0,y:0})=>compose(matrix({x:p.x,y:p.y}),compose(m,matrix({x:-p.x,y:-p.y})));\nconst equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);\n\nfunction validateDynamicDefinition(block) {\n    const d=block.dynamic;\n    if(!d||![1,2].includes(d.version)||!Array.isArray(d.parameters)||!Array.isArray(d.actions))throw new Error('Expected Conduit dynamic-block schema version 1 or 2');\n    if(d.parameters.length>64||d.actions.length>256||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Dynamic block complexity limit exceeded');\n    const names=new Set(),ids=new Set();\n    for(const p of d.parameters){if(!/^[A-Za-z][\\w-]{0,63}$/.test(p.name)||forbidden.has(p.name)||names.has(p.name))throw new Error('Invalid or duplicate parameter name');names.add(p.name);valueOf(p,p.default);\n        if(p.grip){for(const key of ['base','direction'])if(p.grip[key]){finite(p.grip[key].x,'grip '+key);finite(p.grip[key].y,'grip '+key);}\n            if(p.grip.direction&&Math.hypot(p.grip.direction.x,p.grip.direction.y)<1e-9)throw new Error('Grip direction must be nonzero');\n            if(p.grip.radius!==undefined&&finite(p.grip.radius,'grip radius')<=0)throw new Error('Grip radius must be positive');}\n    }\n    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Dynamic geometry needs unique entity IDs');ids.add(e.id);}\n    const portNames=new Set();for(const port of block.ports||[]){if(!port.name||portNames.has(port.name))throw new Error('Dynamic ports need unique names');portNames.add(port.name);for(const k of ['x','y','dx','dy'])finite(port[k],'port '+k);}\n    const types=new Set(['move','stretch','rotate','scale','flip','visibility','array','lookup','polar','polar-array']);\n    for(const a of d.actions){\n        if(!types.has(a.type)||!names.has(a.parameter))throw new Error('Unknown dynamic action or parameter');\n        if(a.entities && (!Array.isArray(a.entities)||a.entities.some(id=>!ids.has(id))))throw new Error('Dynamic action references missing geometry');\n        if(a.ports && (!Array.isArray(a.ports)||a.ports.some(n=>!(block.ports||[]).some(p=>p.name===n))))throw new Error('Dynamic action references missing port');\n        for(const k of ['base','direction','step'])if(a[k]){finite(a[k].x,k);finite(a[k].y,k);}\n        const parameter= d.parameters.find(p=>p.name===a.parameter);\n        if(['move','stretch','rotate','scale','array','polar','polar-array'].includes(a.type)&&!['number','distance','angle','integer'].includes(parameter.type))throw new Error('Geometric action requires a numeric parameter');\n        if(a.angleParameter&&!names.has(a.angleParameter))throw new Error('Missing polar angle parameter');\n        if(a.type==='flip'&&parameter.type!=='boolean')throw new Error('Flip requires a boolean parameter');\n        if(a.type==='stretch') {\n            if(!a.box)throw new Error('Stretch requires a crossing box');\n            for(const k of ['minX','minY','maxX','maxY'])finite(a.box[k],k);\n            if(a.box.minX>a.box.maxX||a.box.minY>a.box.maxY)throw new Error('Invalid stretch box');\n        }\n        if(a.type==='visibility'&&(!a.states||typeof a.states!=='object'||Object.values(a.states).some(v=>!Array.isArray(v)||v.some(id=>!ids.has(id)))))throw new Error('Invalid visibility state');\n    }\n    return block;\n}\nfunction valueOf(p,v) {\n    if(p.type==='boolean'){if(typeof v!=='boolean')throw new Error(`Parameter ${p.name} requires a boolean`);}\n    else if(p.type==='enum'){if(!Array.isArray(p.values)||!p.values.some(x=>equal(x,v)))throw new Error(`Unknown ${p.name} option`);if(typeof v!=='string'&&typeof v!=='number')throw new Error('Enum values must be scalar');if(typeof v==='number')finite(v,p.name);}\n    else {\n        if(!['number','distance','angle','integer'].includes(p.type))throw new Error(`Unknown parameter type: ${p.type}`);\n        finite(v,p.name);if(p.type==='integer'&&!Number.isInteger(v))throw new Error(`${p.name} must be an integer`);\n        if(p.min!==undefined&&(finite(p.min,'minimum'),v<p.min)||p.max!==undefined&&(finite(p.max,'maximum'),v>p.max))throw new Error(`${p.name} is outside its allowed range`);\n        if(p.values && !p.values.includes(v))throw new Error(`${p.name} must be a listed value`);\n    }\n    return v;\n}\nfunction resolveDynamicValues(block,input={}) {\n    validateDynamicDefinition(block);\n    if(!input||Array.isArray(input)||typeof input!=='object')throw new Error('Invalid dynamic parameter values');\n    const definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p])), values=Object.create(null), writers=new Map();\n    const constants=resolveParameters(block.parameters||{});\n    for(const key of Object.keys(input))if(!definitions.has(key))throw new Error(`Unknown dynamic parameter: ${key}`);\n    for(const p of definitions.values())values[p.name]=valueOf(p,own(input,p.name)?input[p.name]:p.default);\n    const lookups=block.dynamic.actions.filter(a=>a.type==='lookup');\n    for(const a of lookups){\n        if(!a.rows||typeof a.rows!=='object')throw new Error('Lookup action requires rows');\n        for(const row of Object.values(a.rows))for(const key of Object.keys(row)){\n            if(!definitions.has(key)||key===a.parameter||writers.has(key)&&writers.get(key)!==a||definitions.get(key).expression!==undefined)throw new Error('Invalid or ambiguous lookup dependency');\n            writers.set(key,a);valueOf(definitions.get(key),row[key]);\n        }\n    }\n    const visited=new Set(),active=new Set();\n    function resolve(name){\n        if(!definitions.has(name)){if(own(constants,name))return constants[name];throw new Error('Unknown dynamic expression parameter: '+name);}\n        if(visited.has(name))return values[name];if(active.has(name))throw new Error('Dynamic parameter / lookup cycle: '+[...active,name].join(' → '));active.add(name);\n        const p=definitions.get(name),writer=writers.get(name);\n        if(p.expression!==undefined){\n            if(!['number','distance','angle','integer'].includes(p.type))throw new Error('Expressions require numeric parameters');\n            const dependencies=Object.fromEntries(parameterDependencies(p.expression).map(key=>[key,resolve(key)]));\n            values[name]=valueOf(p,evaluateExpression(p.expression,dependencies));\n        }else if(writer){\n            const key=String(resolve(writer.parameter));if(!own(writer.rows,key)||!own(writer.rows[key],name))throw new Error('No lookup row for selected value');\n            values[name]=valueOf(p,writer.rows[key][name]);\n        }\n        active.delete(name);visited.add(name);return values[name];\n    }\n    for(const p of definitions.values())resolve(p.name);\n    return values;\n}\n/** Pure bounded evaluation. Geometric transforms are supplied by the host model. */\nfunction evaluateDynamicDefinition(block,input,transformEntity,{maxEntities=10000}={}) {\n    if(!Number.isSafeInteger(maxEntities)||maxEntities<1||maxEntities>100000||block.entities.length>maxEntities)throw new Error('Invalid dynamic entity budget');\n    const values=resolveDynamicValues(block,input),definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p]));\n    const result={...block,entities:clone(block.entities),ports:clone(block.ports||[])};\n    delete result.dynamic;\n    for(const a of block.dynamic.actions) {\n        if(a.type==='lookup')continue;\n        const p=definitions.get(a.parameter),value=values[a.parameter],delta=typeof value==='number'?value-p.default:0;\n        const selected=e=>!a.entities||a.entities.includes(e.id),portSelected=p=>!a.ports||a.ports.includes(p.name);\n        if(a.type==='visibility'){\n            const key=String(value);if(!own(a.states,key))throw new Error('No visibility state for selected value');\n            const scope=new Set(a.entities||Object.values(a.states).flat());\n            for(const e of result.entities)if(scope.has(e.id))e.hidden=!!e.hidden||!a.states[key].includes(e.id);\n            continue;\n        }\n        if(a.type==='stretch') {\n            const direction=a.direction||{x:1,y:0},m=matrix({x:direction.x*delta,y:direction.y*delta});\n            for(const e of result.entities.filter(selected)){\n                if(e.extrusion && (e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Stretch requires default OCS');\n                const points=e.type==='LINE'?[e.a,e.b]:['LWPOLYLINE','POLYLINE'].includes(e.type)?e.points:e.type==='SPLINE'?e.controlPoints:null;\n                if(points){\n                    const chosen=points.filter(p=>inside(p,a.box));\n                    if(chosen.length===0)continue;\n                    if(chosen.length===points.length)transformEntity(e,m);\n                    else {\n                        if(points.some(p=>p.bulge)||e.type==='POLYLINE'&&(e.flags&(16|64)))throw new Error('Partial stretch would invalidate curved or mesh topology');\n                        for(const p of chosen)Object.assign(p,transform(p,m));\n                    }\n                } else if(['CIRCLE','ARC','TEXT','MTEXT','POINT'].includes(e.type)){\n                    if(inside(e.c||e.p,a.box))transformEntity(e,m);\n                } else throw new Error(`Stretch is not supported for ${e.type}`);\n            }\n            for(const p of result.ports)if(portSelected(p)&&inside(p,a.box))Object.assign(p,transform(p,m));\n            continue;\n        }\n        if(a.type==='polar-array'){\n            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Polar array count must be 1–256');\n            const originals=result.entities.filter(selected),sweep=a.angleParameter?values[a.angleParameter]:(a.angle??360);\n            finite(sweep,'array sweep');if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');\n            for(let i=1;i<value;i++)for(const e of originals){const copy=clone(e);copy.id=`${e.id}:polar:${i}`;transformEntity(copy,pivot(matrix({rotation:sweep*i/value}),a.base));result.entities.push(copy);}\n            continue;\n        }\n        if(a.type==='array'){\n            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Array count must be 1–256');\n            const originals=result.entities.filter(selected);if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');\n            const step=a.step||{x:10,y:0};\n            for(let i=1;i<value;i++)for(const e of originals){const c=clone(e);c.id=`${e.id}:array:${i}`;transformEntity(c,matrix({x:step.x*i,y:step.y*i}));result.entities.push(c);}\n            continue; // Named terminals describe the original cell; no implicit port duplication.\n        }\n        let m;\n        if(a.type==='polar'){\n            const angle=a.angleParameter?values[a.angleParameter]:(a.angle??0);finite(angle,'polar angle');\n            const initialAngle=a.angleParameter?definitions.get(a.angleParameter).default:(a.angle??0),r=angle*Math.PI/180,q=initialAngle*Math.PI/180;\n            m=matrix({x:value*Math.cos(r)-p.default*Math.cos(q),y:value*Math.sin(r)-p.default*Math.sin(q)});\n        }\n        if(a.type==='move'){const d=a.direction||{x:1,y:0};m=matrix({x:d.x*delta,y:d.y*delta});}\n        if(a.type==='rotate')m=pivot(matrix({rotation:delta}),a.base);\n        if(a.type==='scale'){const ratio=value/p.default;if(!(ratio>0)||!Number.isFinite(ratio))throw new Error('Dynamic scale requires positive nonzero reference and value');m=pivot(matrix({sx:ratio,sy:ratio}),a.base);}\n        if(a.type==='flip'){\n            if(typeof value!=='boolean')throw new Error('Flip needs a boolean parameter');if(value===p.default)continue;\n            const d=a.direction||{x:0,y:1},len=Math.hypot(d.x,d.y);if(len<1e-9)throw new Error('Flip axis must be nonzero');\n            const x=d.x/len,y=d.y/len;m=pivot([2*x*x-1,2*x*y,2*x*y,2*y*y-1,0,0],a.base);\n        }\n        if(!m||!m.every(Number.isFinite))throw new Error('Invalid dynamic transform');\n        for(const e of result.entities.filter(selected)){\n            if(a.type==='flip'&&['INSERT','TEXT','MTEXT','ELLIPSE','HATCH'].includes(e.type))throw new Error(`Mirrored ${e.type} needs a specialized transform`);\n            transformEntity(e,m);\n        }\n        for(const p of result.ports.filter(portSelected)){\n            const q=transform(p,m),v=transform({x:p.x+(p.dx||0),y:p.y+(p.dy||0)},m);Object.assign(p,q,{dx:v.x-q.x,dy:v.y-q.y});\n        }\n    }\n    // Constraint-based blocks solve a pristine post-action sketch for each parameter set.\n    const constraints=block.dynamic.constraints||block.constraints||[];\n    if(constraints.length){\n        const parameters={...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))};\n        const report=new ConstraintSolver().solve(result.entities,constraints,parameters);\n        if(!report.converged)throw new Error('Dynamic block constraints conflict: '+report.conflicts.join(', '));\n        result.solveReport=report;\n    }\n    regenerateDimensions({entities:result.entities,dimstyles:block.dimstyles||{}});\n    evaluateCalculations(result.entities,constraints,{...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))});\n    for(const port of result.ports)if(port.anchor){\n        const e=result.entities.find(e=>e.id===port.anchor.entityId),key=port.anchor.point;\n        const p=/^points\\.\\d+$/.test(key)?e?.points?.[Number(key.slice(7))]:['a','b','c','p'].includes(key)?e?.[key]:null;\n        if(!p)throw new Error('Invalid solved port anchor');port.x=p.x;port.y=p.y;\n        if(port.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=port.anchor.reverse?-1:1;port.dx=sign*(e.b.x-e.a.x)/n;port.dy=sign*(e.b.y-e.a.y)/n;}\n    }\n    // Guard every coordinate, not only parameters. Prevent invalid buffers downstream.\n    const check=v=>{if(typeof v==='number')finite(v,'geometry');else if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};\n    for(const e of result.entities)check(e);for(const p of result.ports)check(p);result.dynamicValues=values;return result;\n}\n\nreturn {validateDynamicDefinition,resolveDynamicValues,evaluateDynamicDefinition};\n})();\n// packages/model/src/fidelity.js\n__modules[\"packages/model/src/fidelity.js\"]=(()=>{\nconst {arcPoints, tessellatePolyline, splinePoints, bounds, distance, TAU} = __modules[\"packages/geometry/src/index.js\"];\nconst EPS = 1e-9;\n/** XY projection of Autodesk's arbitrary-axis OCS basis. */\nfunction ocsTransform(normal = { x: 0, y: 0, z: 1 }, elevation = 0) {\n    const length = Math.hypot(normal.x || 0, normal.y || 0, normal.z ?? 1);\n    if (length < EPS) throw new Error('Invalid zero-length DXF extrusion normal');\n    const n = { x: (normal.x || 0) / length, y: (normal.y || 0) / length, z: (normal.z ?? 1) / length };\n    const a = Math.abs(n.x) < 1 / 64 && Math.abs(n.y) < 1 / 64 ? { x: n.z, y: 0, z: -n.x } : { x: -n.y, y: n.x, z: 0 };\n    const l = Math.hypot(a.x, a.y, a.z); a.x /= l; a.y /= l; a.z /= l;\n    const b = { x: n.y * a.z - n.z * a.y, y: n.z * a.x - n.x * a.z };\n    return [a.x, a.y, b.x, b.y, n.x * elevation, n.y * elevation];\n}\nfunction ellipseEdgePoints(edge, tolerance = .25) {\n    const a = edge.major, ratio = edge.ratio ?? 1;\n    let start = edge.start ?? 0, end = edge.end ?? TAU;\n    // Hatch ellipse group 50/51 use geometric angles, unlike ELLIPSE parameters.\n    if (edge.type === 3) {\n        const convert = v => Math.atan2(Math.sin(v) / Math.max(Math.abs(ratio), EPS), Math.cos(v));\n        start = convert(start); end = convert(end);\n    }\n    let sweep = end - start;\n    if (edge.ccw === false) { while (sweep >= 0) sweep -= TAU; }\n    else { while (sweep <= 0) sweep += TAU; }\n    const n = Math.min(8192, Math.max(8, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(tolerance, 1e-8)))));\n    return Array.from({ length: n + 1 }, (_, i) => {\n        const t = start + sweep * i / n;\n        return { x: edge.c.x + a.x * Math.cos(t) - a.y * ratio * Math.sin(t), y: edge.c.y + a.y * Math.cos(t) + a.x * ratio * Math.sin(t) };\n    });\n}\nfunction hatchContours(e, tolerance = .25) {\n    return (e.loops || []).map(loop => {\n        if (!loop.edges?.length) return tessellatePolyline(loop.points || [], true, tolerance);\n        const result = [];\n        for (const edge of loop.edges) {\n            let points = [];\n            if (edge.type === 1) points = [edge.a, edge.b];\n            if (edge.type === 2) points = arcPoints(edge.c, edge.r, edge.start, edge.end, tolerance, edge.ccw === false);\n            if (edge.type === 3) points = ellipseEdgePoints(edge, tolerance);\n            if (edge.type === 4) points = splinePoints(edge, tolerance);\n            if (result.length && points.length && distance(result.at(-1), points[0]) < EPS) points = points.slice(1);\n            result.push(...points);\n        }\n        return result;\n    }).filter(p => p.length >= 3);\n}\nfunction inPolygon(p, polygon) {\n    let inside = false;\n    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {\n        const a = polygon[i], b = polygon[j];\n        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;\n    }\n    return inside;\n}\nfunction hatchRegionContours(e, tolerance) {\n    const contours = hatchContours(e, tolerance);\n    if (!e.hatchStyle) return contours;\n    return contours.filter((p, i) => {\n        const depth = contours.reduce((n, q, j) => n + (i !== j && inPolygon(p[0], q) ? 1 : 0), 0);\n        return e.hatchStyle === 2 ? depth === 0 : depth <= 1;\n    });\n}\n/** Scanline hatch clipping with half-open crossings and parity across islands.\n * Definitions are already transformed by the DXF producer: do not apply scale twice.\n */\nfunction hatchPatternSegments(e, contours, { maxLines = 20000, maxSegments = 100000 } = {}) {\n    const segments = [], vertices = contours.flat(), bb = bounds(vertices);\n    if (!vertices.length) return { segments, limited: false };\n    let lines = 0;\n    for (const definition of e.patternLines || []) {\n        const u = { x: Math.cos(definition.angle), y: Math.sin(definition.angle) }, n = { x: -u.y, y: u.x }, base = definition.base, offset = definition.offset;\n        const step = offset.x * n.x + offset.y * n.y, origin = base.x * n.x + base.y * n.y;\n        if (Math.abs(step) < EPS) continue;\n        const corners = [{ x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.minY }, { x: bb.minX, y: bb.maxY }, { x: bb.maxX, y: bb.maxY }];\n        const projections = corners.map(p => (p.x * n.x + p.y * n.y - origin) / step);\n        const first = Math.ceil(Math.min(...projections) - EPS), last = Math.floor(Math.max(...projections) + EPS);\n        if (!Number.isSafeInteger(first) || last - first + lines > maxLines) return { segments: [], limited: true };\n        for (let k = first; k <= last; k++) {\n            lines++;\n            const b = { x: base.x + k * offset.x, y: base.y + k * offset.y }, hits = [];\n            for (const polygon of contours) for (let i = 0; i < polygon.length; i++) {\n                const a = polygon[i], z = polygon[(i + 1) % polygon.length];\n                const da = (a.x - b.x) * n.x + (a.y - b.y) * n.y, dz = (z.x - b.x) * n.x + (z.y - b.y) * n.y;\n                if ((da > 0) === (dz > 0)) continue;\n                const t = da / (da - dz), x = a.x + (z.x - a.x) * t - b.x, y = a.y + (z.y - a.y) * t - b.y;\n                hits.push(x * u.x + y * u.y);\n            }\n            hits.sort((a, b) => a - b);\n            for (let i = 0; i + 1 < hits.length; i += 2) {\n                const lo = hits[i], hi = hits[i + 1];\n                if (hi - lo <= EPS) continue;\n                const emit = (a, z) => segments.push([{ x: b.x + a * u.x, y: b.y + a * u.y }, { x: b.x + z * u.x, y: b.y + z * u.y }]);\n                const dashes = definition.dashes || [], cycle = dashes.reduce((a, d) => a + Math.abs(d), 0);\n                if (cycle < EPS) emit(lo, hi);\n                else {\n                    if ((hi - lo) / cycle * dashes.length > maxSegments) return { segments: [], limited: true };\n                    for (let c = Math.floor(lo / cycle) * cycle; c < hi; c += cycle) {\n                        let p = c;\n                        for (const dash of dashes) {\n                            if (dash >= 0 && p + dash >= lo && p <= hi) emit(Math.max(lo, p), Math.min(hi, p + Math.max(dash, EPS)));\n                            p += Math.abs(dash);\n                        }\n                        if (segments.length > maxSegments) return { segments: [], limited: true };\n                    }\n                }\n                if (segments.length > maxSegments) return { segments: [], limited: true };\n            }\n        }\n    }\n    return { segments, limited: false };\n}\n/** Variable width arc/polyline ribbons, retaining original analytic model data. */\nfunction widePolylineContours(e, tolerance = .25) {\n    const result = [], points = e.points || [], n = points.length - (e.closed ? 0 : 1);\n    for (let i = 0; i < n; i++) {\n        const a = points[i], b = points[(i + 1) % points.length];\n        const w0 = e.constantWidth || (a.startWidth ?? e.startWidth ?? 0), w1 = e.constantWidth || (a.endWidth ?? e.endWidth ?? w0);\n        if (!(w0 > 0 || w1 > 0)) continue;\n        const center = tessellatePolyline([a, b], false, tolerance), left = [], right = [];\n        for (let j = 0; j < center.length; j++) {\n            const prev = center[Math.max(0, j - 1)], next = center[Math.min(center.length - 1, j + 1)], len = Math.hypot(next.x - prev.x, next.y - prev.y);\n            if (len < EPS) continue;\n            const w = (w0 + (w1 - w0) * j / (center.length - 1)) / 2, nx = -(next.y - prev.y) / len * w, ny = (next.x - prev.x) / len * w;\n            left.push({ x: center[j].x + nx, y: center[j].y + ny }); right.push({ x: center[j].x - nx, y: center[j].y - ny });\n        }\n        if (left.length >= 2) result.push([...left, ...right.reverse()]);\n    }\n    return result;\n}\nfunction signedDashPattern(pattern = []) {\n    if (!pattern.length) return [];\n    const result = []; let ink = true;\n    for (const value of pattern) {\n        const nextInk = value >= 0, size = Math.abs(value);\n        if (nextInk !== ink) { if (!result.length) result.push(0); ink = nextInk; result.push(size); }\n        else if (!result.length) result.push(size); else result[result.length - 1] += size;\n    }\n    if (result.length % 2) result.push(0);\n    return result;\n}\nconst plainText = s => String(s).replace(/\\\\U\\+([\\da-f]{4})/gi, (_, v) => String.fromCharCode(parseInt(v, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀');\n/** Bounded, no-eval MTEXT formatting lexer with group-local formatting state. */\nfunction cadTextRuns(value, initial = {}) {\n    const source = plainText(value), result = [], stack = [];\n    let style = { scale: 1, width: 1, underline: false, overline: false, ...initial }, text = '';\n    const flush = () => { if (text) result.push({ text, ...style }); text = ''; };\n    for (let i = 0; i < source.length; i++) {\n        const ch = source[i];\n        if (ch === '{') { flush(); if (stack.length < 64) stack.push({ ...style }); continue; }\n        if (ch === '}') { flush(); style = stack.pop() || style; continue; }\n        if (ch !== '\\\\') { text += ch; continue; }\n        const command = source[++i];\n        if (command === undefined) break;\n        if (['\\\\', '{', '}'].includes(command)) { text += command; continue; }\n        if (command === 'P' || command === 'X') { text += '\\n'; continue; }\n        if (command === '~') { text += '\\u00a0'; continue; }\n        if ('LlOoKk'.includes(command)) { flush(); const key = /[Ll]/.test(command) ? 'underline' : /[Oo]/.test(command) ? 'overline' : 'strike'; style[key] = command === command.toUpperCase(); continue; }\n        if ('ACcFfHhQqTtWwSs'.includes(command)) {\n            const end = source.indexOf(';', i + 1); if (end < 0) { text += '\\\\' + command; continue; }\n            const arg = source.slice(i + 1, end); i = end; flush(); const num = parseFloat(arg);\n            if (/[Hh]/.test(command) && num > 0 && Number.isFinite(num)) style.scale = /x$/i.test(arg) ? num : num / (initial.height || 1);\n            else if (/[Ww]/.test(command) && num > 0 && Number.isFinite(num)) style.width = num;\n            else if (/[Qq]/.test(command) && Number.isFinite(num)) style.oblique = Math.max(-85, Math.min(85, num));\n            else if (/[Ff]/.test(command)) { style.font = arg.split('|')[0]; style.bold = /\\|b1/i.test(arg); style.italic = /\\|i1/i.test(arg); }\n            else if (command === 'c' && Number.isFinite(num)) style.color = '#' + (num & 0xffffff).toString(16).padStart(6, '0');\n            else if (command === 'C' && num >= 1 && num <= 7) style.color = ['','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#000000'][num];\n            else if (/[Ss]/.test(command)) result.push({ text: arg.replace(/[\\/#^]/g, '/'), ...style, scale: style.scale * .8 });\n            continue;\n        }\n        text += '\\\\' + command;\n    }\n    flush(); return result;\n}\n/** Deterministic text layout; canvas may supply measured glyph advances. */\nfunction layoutCadText(t, measure) {\n    const h = t.nominalHeight || t.height || 12, multiline = !!t.mtext;\n    const runs = multiline ? cadTextRuns(t.rawText ?? t.text, { height: h }) : [{ text: plainText(t.text), scale: 1, width: 1 }];\n    const width = multiline && t.mtextWidth > 0 ? t.mtextWidth : Infinity;\n    const lines = [{ runs: [], width: 0, height: h }];\n    let line = lines[0];\n    const add = (text, style) => {\n        if (!text) return;\n        const height = h * style.scale, w = (measure ? measure(text, height, style) : [...text].reduce((n, c) => n + (/\\s/.test(c) ? .33 : /[ilI.,'!:;]/.test(c) ? .28 : /[MW@%]/.test(c) ? .9 : .6), 0) * height) * style.width;\n        if (w > width && Number.isFinite(width) && [...text].length > 1) {\n            for (const ch of text) add(ch, style);\n            return;\n        }\n        if (line.width > 0 && line.width + w > width && !/^\\s+$/.test(text)) { line = { runs: [], width: 0, height: h }; lines.push(line); }\n        line.runs.push({ ...style, text, x: line.width, width: w, height }); line.width += w; line.height = Math.max(line.height, height);\n    };\n    for (const run of runs) for (const token of run.text.split(/(\\n|[ \\t]+)/)) {\n        if (token === '\\n') { line = { runs: [], width: 0, height: h }; lines.push(line); }\n        else add(token, run);\n    }\n    const lineFactor = multiline ? (5 / 3) * Math.max(.25, Math.min(4, t.lineSpacing || 1)) : 1.3;\n    let y = 0;\n    for (const line of lines) { line.y = y; y += (t.lineSpacingStyle === 2 ? h : line.height) * lineFactor; }\n    const height = lines.at(-1).y + lines.at(-1).height, w = lines.reduce((n, l) => Math.max(n, l.width), 0);\n    const vertical = multiline ? Math.floor(((t.attachment || 1) - 1) / 3) : t.valign === 3 ? 0 : t.valign === 2 ? 1 : t.valign === 1 ? 2 : -1;\n    const baseline = vertical === 0 ? h * .8 : vertical === 1 ? h * .8 - height / 2 : vertical === 2 ? h * .8 - height : 0;\n    const boxWidth = Number.isFinite(width) ? width : w;\n    const align = t.align || 'left', offsetX = align === 'center' ? -boxWidth / 2 : align === 'right' ? -boxWidth : 0;\n    for (const line of lines) {\n        const start = offsetX + (align === 'center' ? (boxWidth - line.width) / 2 : align === 'right' ? boxWidth - line.width : 0);\n        for (const r of line.runs) { r.x += start; r.y = baseline + line.y; }\n    }\n    return { lines, width: boxWidth, height, minX: offsetX, minY: baseline - h * .8, maxX: offsetX + boxWidth, maxY: baseline + height - h * .8 };\n}\n\nreturn {ocsTransform,ellipseEdgePoints,hatchContours,inPolygon,hatchRegionContours,hatchPatternSegments,widePolylineContours,signedDashPattern,cadTextRuns,layoutCadText};\n})();\n// packages/model/src/interop.js\n__modules[\"packages/model/src/interop.js\"]=(()=>{\nconst {matrix, compose, bounds, splinePoints} = __modules[\"packages/geometry/src/index.js\"];\nconst {inPolygon} = __modules[\"packages/model/src/fidelity.js\"];\n/** Top-view WCS -> paper DCS. Twist is applied before the DCS center offset. */\nfunction viewportTransform(e) {\n    const d=e.viewDirection||{x:0,y:0,z:1};\n    if((e.viewportFlags&7)||Math.abs(d.x)>1e-9||Math.abs(d.y)>1e-9||d.z<=0) return null;\n    const s=e.viewportHeight/e.viewHeight;\n    if(!(s>0)||!Number.isFinite(s))return null;\n    const c=e.viewCenter||{x:0,y:0},target=e.viewTarget||{x:0,y:0};\n    return compose(matrix({x:e.c.x-c.x*s,y:e.c.y-c.y*s}),compose(matrix({sx:s,sy:s,rotation:e.viewTwist||0}),matrix({x:-target.x,y:-target.y})));\n}\nfunction viewportRectangle(e) {\n    const {x,y}=e.c,w=e.viewportWidth/2,h=e.viewportHeight/2;\n    return [{x:x-w,y:y-h},{x:x+w,y:y-h},{x:x+w,y:y+h},{x:x-w,y:y+h}];\n}\nfunction insideClips(p,clips) {\n    return !clips || clips.every(polygon=>inPolygon(p,polygon));\n}\nfunction wipeoutPoints(e) {\n    let vertices=e.boundary||[];\n    if(e.boundaryType===1&&vertices.length===2) {\n        const [a,b]=vertices;vertices=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];\n    }\n    const p=e.p,u=e.uPixel,v=e.vPixel,height=e.imageSize?.y??1;\n    return vertices.map(q=>({x:p.x+u.x*(q.x+.5)+v.x*(height-q.y-.5),y:p.y+u.y*(q.x+.5)+v.y*(height-q.y-.5)}));\n}\nfunction helixPoints(e,tolerance=.25) {\n    const spline=e.helixSpline;\n    if(spline?.controlPoints?.length && spline.knots?.length)return splinePoints(spline,tolerance);\n    const a=e.axis||{x:0,y:0,z:1},l=Math.hypot(a.x,a.y,a.z);if(!l)return [];\n    const n={x:a.x/l,y:a.y/l,z:a.z/l},b=e.axisBase,s=e.startPoint;\n    if(!b||!s||!(e.radius>0)||!Number.isFinite(e.turns)||!Number.isFinite(e.turnHeight))return [];\n    const v={x:s.x-b.x,y:s.y-b.y,z:(s.z||0)-(b.z||0)},dot=v.x*n.x+v.y*n.y+v.z*n.z;\n    const radial={x:v.x-dot*n.x,y:v.y-dot*n.y,z:v.z-dot*n.z},r=Math.hypot(radial.x,radial.y,radial.z);if(!r)return [];\n    const u={x:radial.x/r*e.radius,y:radial.y/r*e.radius,z:radial.z/r*e.radius};\n    const w={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};\n    const steps=Math.min(8192,Math.max(16,Math.ceil(Math.abs(e.turns)*Math.PI*2*Math.sqrt(e.radius/Math.max(tolerance,1e-8))))),sign=e.handedness===false?-1:1;\n    return Array.from({length:steps+1},(_,i)=>{const f=i/steps,theta=sign*f*e.turns*Math.PI*2,z=f*e.turns*e.turnHeight;return {x:s.x-u.x+u.x*Math.cos(theta)+w.x*Math.sin(theta)+n.x*z,y:s.y-u.y+u.y*Math.cos(theta)+w.y*Math.sin(theta)+n.y*z,z:(s.z||0)-u.z+u.z*Math.cos(theta)+w.z*Math.sin(theta)+n.z*z};});\n}\n\nreturn {viewportTransform,viewportRectangle,insideClips,wipeoutPoints,helixPoints};\n})();\n// packages/model/src/index.js\n__modules[\"packages/model/src/index.js\"]=(()=>{\nconst {blockSignature, blockReferences, beginBlockDraft, blockFromDraft, prepareBlockDraft, renameBlockInDocument, copyBlockInDocument, syncAttributes, createBlockInDocument, removeBlockInDocument} = __modules[\"packages/model/src/blocks.js\"];\nconst {linearHatchGradient} = __modules[\"packages/model/src/gradients.js\"];\nconst {dimensionPicture:buildDimensionPicture, editDimension:applyDimensionEdit, dimensionGrips:getDimensionGrips, regenerateDimensions:refreshDimensions} = __modules[\"packages/model/src/dimensions.js\"];\nconst {validateDynamicDefinition, resolveDynamicValues, evaluateDynamicDefinition} = __modules[\"packages/model/src/dynamic.js\"];\nconst {viewportTransform, viewportRectangle, wipeoutPoints, helixPoints} = __modules[\"packages/model/src/interop.js\"];\nconst {ocsTransform, hatchRegionContours, hatchPatternSegments, widePolylineContours, signedDashPattern, layoutCadText} = __modules[\"packages/model/src/fidelity.js\"];\nconst {matrix, compose, identity, transform, bounds, union, emptyBounds, arcPoints, tessellatePolyline, splinePoints, TAU, distance, lerp, add, mul, normalize, sub, validBounds} = __modules[\"packages/geometry/src/index.js\"];\nfunction textLayout(text, measure) { return layoutCadText(text, measure); }\nfunction objectCoordinateTransform(normal, elevation) { return ocsTransform(normal, elevation); }\nlet sequence = 0;\nconst uid = (prefix = 'e') => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;\nconst clone = value => JSON.parse(JSON.stringify(value));\nfunction createDocument(name = 'Untitled drawing') { return { schema: 'conduitcad/1', name, units: 'mm', version: 0, entities: [], blocks: {}, layers: [{ name: '0', color: '#344755', visible: true, locked: false }, { name: 'Equipment', color: '#355463', visible: true, locked: false }, { name: 'Process', color: '#147c77', visible: true, locked: false }, { name: 'Instruments', color: '#9b7246', visible: true, locked: false, dash: [5, 4] }, { name: 'Electrical', color: '#6477ba', visible: true, locked: false }, { name: 'Annotations', color: '#71808a', visible: true, locked: false }], linetypes: { CONTINUOUS: [], DASHED: [8, 4], CENTER: [12, 3, 2, 3], HIDDEN: [4, 3] }, parameters: { grid: '10', pipeWidth: '2', valveSize: '64' }, constraints: [], metadata: { author: '', description: '' }, activeLayout: 'Model', layouts: ['Model'], importDiagnostics: [] }; }\nfunction validateDocument(doc) {\n    if (!doc || doc.schema !== 'conduitcad/1' || !Array.isArray(doc.entities) || !doc.blocks || !Array.isArray(doc.layers))\n        throw new Error('Not a Conduit CAD project');\n    if (doc.entities.length > 1000000)\n        throw new Error('Entity safety limit exceeded');\n    const ids = new Set();\n    for (const e of doc.entities) {\n        if (!e.id || ids.has(e.id))\n            throw new Error('Missing or duplicate entity ID');\n        ids.add(e.id);\n        if (!e.type)\n            throw new Error('Missing entity type');\n    }\n    return doc;\n}\nfunction entity(type, props = {}) { return { id: uid(), type, layer: '0', ...props }; }\nconst line = (a, b, props = {}) => entity('LINE', { a: { ...a }, b: { ...b }, ...props });\nconst polyline = (points, closed = false, props = {}) => entity('LWPOLYLINE', { points: points.map(p => ({ ...p })), closed, ...props });\nconst circle = (c, r, props = {}) => entity('CIRCLE', { c: { ...c }, r, ...props });\nconst text = (p, value, height = 14, props = {}) => entity('TEXT', { p: { ...p }, text: value, height, rotation: 0, ...props });\nconst rect = (x, y, w, h, props = {}) => polyline([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, props);\nfunction layerFor(e, doc) { return doc.layers.find(l => l.name === (e.layer || '0')) || doc.layers[0]; }\nfunction isVisible(e, doc) { return !e.hidden && layerFor(e, doc)?.visible !== false && (e.layout || 'Model') === (doc.activeLayout || 'Model'); }\nfunction isLocked(e, doc) { return !!e.locked || !!layerFor(e, doc)?.locked; }\nfunction cleanText(value = '') { return String(value).replace(/\\\\P/g, '\\n').replace(/\\\\U\\+([0-9a-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))).replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, '⌀').replace(/\\\\[ACFHQTW][^;]*;/g, '').replace(/\\\\[LlOoKk]/g, '').replace(/\\\\S([^;]+);/g, (_, s) => s.replace(/[\\/#^]/g, '/')).replace(/[{}]/g, '').replace(/\\\\~/g, ' '); }\nfunction resolveStyle(e, doc, parentStyle = null, parentLayer = null) {\n    const layer = (e.layer === '0' && parentLayer) ? parentLayer : layerFor(e, doc);\n    const lineweight = e.lineweight === -2 ? parentStyle?.lineweight : e.lineweight == null || e.lineweight === -1 ? layer?.lineweight : e.lineweight;\n    const type = e.linetype === 'BYBLOCK' ? null : (!e.linetype || e.linetype === 'BYLAYER' ? layer?.linetype : e.linetype);\n    const raw = doc.linetypes?.[type];\n    const dash = e.dash ?? (e.linetype === 'BYBLOCK' ? parentStyle?.dash : null) ?? (raw ? (doc.signedLinetypes ? signedDashPattern(raw) : raw) : null) ?? layer?.dash ?? [];\n    const factor = (e.linetypeScale ?? 1) * (e.dash || e.linetype === 'BYBLOCK' ? 1 : doc.linetypeScale ?? 1);\n    return { color: e.color === 'BYBLOCK' ? parentStyle?.color || layer?.color || '#344755' : (!e.color || e.color === 'BYLAYER' ? layer?.color || '#344755' : e.color),\n        width: e.width ?? (lineweight >= 0 ? Math.max(.5, lineweight * 96 / 2540) : 1.5), lineweight,\n        dash: dash.map(v => Math.max(0, v * factor)), opacity: e.transparency === 0x01000000 ? parentStyle?.opacity ?? 1 : e.opacity ?? 1 };\n}\n/** Returns portable paths/text. Blocks retain their native definitions in the model. */\nfunction entityGeometry(e, doc, options = {}) {\n    const { tolerance = .25, depth = 0, parentStyle = null, parentLayer = null } = options;\n    let m = options.matrix || identity();\n    if (e.extrusion && ['CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'TEXT', 'ATTRIB', 'ATTDEF', 'SOLID', 'TRACE', 'HATCH', 'INSERT'].includes(e.type) && !(e.type === 'POLYLINE' && (e.flags & (8|16|64))))\n        m = compose(m, ocsTransform(e.extrusion, e.elevation ?? e.c?.z ?? e.p?.z ?? e.z ?? 0));\n    if (depth > 24)\n        return { paths: [], texts: [] };\n    const curveTolerance = tolerance / Math.max(1e-9, Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));\n    const style = resolveStyle(e, doc, parentStyle, parentLayer), paths = [], texts = [], warnings = [];\n    let hasInfinite = false;\n    const path = (pts, closed = false, fill = null, extra = {}) => {\n        if (pts.length > 1)\n            paths.push({ points: pts.map(p => transform(p, m)), closed, fill: fill === 'BYBLOCK' || fill === 'BYLAYER' ? style.color : fill, ...style, ...extra, entityId: e.id });\n    };\n    const label = (p, value, height, rotation = 0, align = 'left') => {\n        const textStyle = doc.textStyles?.[e.styleName] || {}, q = transform(p, m), angle = rotation * Math.PI / 180;\n        const sx = (e.textFlags & 2) ? -1 : 1, sy = (e.textFlags & 4) ? -1 : 1;\n        const width = e.widthFactor ?? textStyle.widthFactor ?? 1, oblique = (e.oblique || textStyle.oblique || 0) * Math.PI / 180;\n        const local = compose(matrix({ rotation }), [sx * width, 0, Math.tan(oblique) * sy, sy, 0, 0]);\n        const affine = compose(m, local), frame = affine.slice(0, 4);\n        texts.push({ p: q, text: cleanText(value), rawText: value, height: height * Math.hypot(frame[2], frame[3]), nominalHeight: height,\n            rotation: Math.atan2(frame[1], frame[0]) * 180 / Math.PI, align, color: style.color, opacity: style.opacity, entityId: e.id,\n            font: e.font || textStyle.font || 'sans-serif', frame, widthFactor: width,\n            mtext: e.type === 'MTEXT', mtextWidth: e.mtextWidth, attachment: e.attachment, valign: e.valign,\n            lineSpacing: e.lineSpacing, lineSpacingStyle: e.lineSpacingStyle, backgroundFill: e.backgroundFill, backgroundColor: e.backgroundColor, backgroundScale: e.backgroundScale });\n    };\n    switch (e.type) {\n        case 'MESH': {\n            const edges=new Set();\n            const edge=(a,b)=>{const id=a<b?a+':'+b:b+':'+a;if(edges.has(id))return;edges.add(id);if(e.points?.[a]&&e.points?.[b])path([e.points[a],e.points[b]]);};\n            for(const face of e.faces||[])for(let i=0;i<face.length;i++)edge(face[i],face[(i+1)%face.length]);\n            for(const [a,b] of e.edges||[])edge(a,b);\n            break;\n        }\n        case 'HELIX': path(helixPoints(e,curveTolerance)); break;\n        case 'WIPEOUT': path(wipeoutPoints(e),true,'#fbfcfb',{stroke:false}); break;\n        case 'VIEWPORT': {\n            if(e.viewportId===1)break;\n            const rectangle=viewportRectangle(e);\n            path(rectangle,true);\n            if(e.viewportStatus===0||(e.viewportFlags&131072))break;\n            const projection=viewportTransform(e);\n            if(!projection){warnings.push({severity:'warning',type:'VIEWPORT',message:'Only top-view orthographic viewport contents can be rendered.'});break;}\n            let clip=rectangle;\n            if(e.clipHandle) {\n                const boundary=doc.entities.find(q=>String(q._dxf?.handle||'').toUpperCase()===String(e.clipHandle).toUpperCase());\n                const candidate=boundary && boundary.type!=='VIEWPORT' ? entityGeometry(boundary,doc,{tolerance:curveTolerance,depth:depth+1}).paths.find(p=>p.closed):null;\n                if(!candidate){warnings.push({severity:'warning',type:'VIEWPORT',message:'Unresolved or unsupported viewport clipping boundary; content is not drawn.'});break;}\n                clip=candidate.points;\n            }\n            const worldClip=clip.map(p=>transform(p,m)), rectangularClip=rectangle.map(p=>transform(p,m));\n            const frozen=new Set((e.frozenLayers||[]).map(n=>n.toUpperCase()));\n            const model={...doc,activeLayout:'Model',layers:doc.layers.map(l=>frozen.has(l.name.toUpperCase())?{...l,visible:false}:l)};\n            for(const child of doc.entities) {\n                if(child.type==='VIEWPORT'||!isVisible(child,model))continue;\n                const g=entityGeometry(child,model,{matrix:compose(m,projection),tolerance,depth:depth+1});\n                hasInfinite ||= !!g.hasInfinite;\n                warnings.push(...(g.warnings||[]));\n                const clips=[rectangularClip,worldClip];\n                for(const p of g.paths)paths.push({...p,clips:[...(p.clips||[]),...clips],entityId:e.id});\n                for(const t of g.texts)texts.push({...t,clips:[...(t.clips||[]),...clips],entityId:e.id});\n            }\n            break;\n        }\n        case 'LINE':\n            path([e.a, e.b]);\n            break;\n        case 'LWPOLYLINE':\n        case 'POLYLINE':\n            if(e.type==='POLYLINE' && (e.flags & 64)) {\n                for(const face of e.faces || []) for(let i=0;i<face.length;i++) { const a=e.points[Math.abs(face[i])-1], b=e.points[Math.abs(face[(i+1)%face.length])-1]; if(face[i]>0&&a&&b)path([a,b]); }\n                break;\n            }\n            if(e.type==='POLYLINE' && (e.flags & 16)) {\n                const mCount=e.mCount || 0,nCount=e.nCount || 0;\n                if(mCount*nCount===e.points.length)for(let m=0;m<mCount;m++)for(let n=0;n<nCount;n++) {\n                    const a=e.points[m*nCount+n];\n                    if(m+1<mCount || (e.flags&1))path([a,e.points[((m+1)%mCount)*nCount+n]]);\n                    if(n+1<nCount || (e.flags&32))path([a,e.points[m*nCount+(n+1)%nCount]]);\n                }\n                break;\n            }\n            { const ribbons = widePolylineContours(e, curveTolerance);\n              if (ribbons.length) { for (const ribbon of ribbons) path(ribbon, true, style.color, { stroke: false }); }\n              else path(tessellatePolyline(e.points || [], !!e.closed, curveTolerance), !!e.closed, e.fill); }\n            break;\n        case 'CIRCLE':\n            path(arcPoints(e.c, e.r, 0, TAU, curveTolerance), true, e.fill);\n            break;\n        case 'ARC':\n            path(arcPoints(e.c, e.r, e.start, e.end, curveTolerance, !!e.clockwise));\n            break;\n        case 'ELLIPSE': {\n            const a = e.major || { x: e.rx || 1, y: 0 }, r = e.ratio ?? 1, s = e.start ?? 0;\n            const normal=e.extrusion || {x:0,y:0,z:1}, minor={x:(normal.y || 0)*(a.z || 0)-(normal.z ?? 1)*a.y,y:(normal.z ?? 1)*a.x-(normal.x || 0)*(a.z || 0),z:(normal.x || 0)*a.y-(normal.y || 0)*a.x};\n            const factor=Math.hypot(a.x,a.y,a.z || 0)*r/(Math.hypot(minor.x,minor.y,minor.z) || 1); minor.x*=factor;minor.y*=factor;\n            let sweep = (e.end ?? TAU) - s;\n            while (sweep <= 0)\n                sweep += TAU;\n            const n = Math.min(4096, Math.max(24, Math.ceil(sweep * Math.sqrt(Math.hypot(a.x, a.y) / Math.max(curveTolerance, .0000001)))));\n            path(Array.from({ length: n + 1 }, (_, i) => { const t = s + sweep * i / n; return { x: e.c.x + a.x * Math.cos(t) + minor.x * Math.sin(t), y: e.c.y + a.y * Math.cos(t) + minor.y * Math.sin(t) }; }), Math.abs(sweep - TAU) < 1e-6);\n            break;\n        }\n        case 'SPLINE':\n            path(splinePoints(e, curveTolerance), !!e.closed);\n            break;\n        case 'TEXT':\n        case 'MTEXT':\n        case 'ATTRIB':\n        case 'ATTDEF':\n            if (!e.invisible) {\n                let p = ((e.halign || e.valign) && e.alignPoint) ? e.alignPoint : e.p, height = e.height || doc.textStyles?.[e.styleName]?.height || 12, rotation = e.rotation || 0;\n                let value = e.text || '', alignment = e.halign === 4 ? 'center' : e.align || 'left';\n                if ([3, 5].includes(e.halign) && e.alignPoint) {\n                    const target = distance(e.p, e.alignPoint), measured = layoutCadText({ text: cleanText(value), height }).width || 1;\n                    rotation = Math.atan2(e.alignPoint.y - e.p.y, e.alignPoint.x - e.p.x) * 180 / Math.PI;\n                    p = e.p; alignment = 'left';\n                    label(p, value, height, rotation, alignment);\n                    const t = texts.at(-1), factor = target / measured; t.frame[0] *= factor; t.frame[1] *= factor;\n                    if (e.halign === 3) { t.frame[2] *= factor; t.frame[3] *= factor; t.height *= factor; }\n                } else label(p, value, height, rotation, alignment);\n            }\n            break;\n        case 'POINT': {\n            const r = 1.5;\n            path([{ x: e.p.x - r, y: e.p.y }, { x: e.p.x + r, y: e.p.y }]);\n            path([{ x: e.p.x, y: e.p.y - r }, { x: e.p.x, y: e.p.y + r }]);\n            break;\n        }\n        case 'SOLID':\n        case 'TRACE':\n            path(e.points || [], true, style.color, { stroke: false });\n            break;\n        case '3DFACE':\n            for (let i = 0; i < (e.points?.length || 0); i++) if (!(e.edgeFlags & (1 << i))) path([e.points[i], e.points[(i + 1) % e.points.length]]);\n            break;\n        case 'HATCH': {\n            const contours = hatchRegionContours(e, curveTolerance);\n            if (e.solid || e.gradient) {\n                if (contours.length) path(contours[0], true, style.color, { stroke: false, contours: contours.map(p => p.map(v => transform(v, m))), fillRule: 'evenodd', gradient: linearHatchGradient(e.gradient,contours,m) });\n            } else {\n                const pattern = hatchPatternSegments(e, contours);\n                if (pattern.limited || !e.patternLines?.length) {\n                    for (const contour of contours) path(contour, true);\n                    warnings.push({ entityId: e.id, message: pattern.limited ? 'Hatch density exceeds bounded tessellation budget; showing boundaries.' : 'Hatch has no pattern line definitions; showing boundaries.' });\n                } else for (const points of pattern.segments) path(points, false, null, { dash: [] });\n            }\n            break;\n        }\n        case 'LEADER': {\n            path(e.points || []);\n            if (e.arrow !== false && e.points?.length > 1) {\n                const tip = e.points[0], d = normalize(sub(e.points[1], tip)), n = { x: -d.y, y: d.x }, length = e.arrowSize || 6;\n                path([tip, add(tip, add(mul(d, length), mul(n, length / 3))), add(tip, add(mul(d, length), mul(n, -length / 3)))], true, style.color, { stroke: false });\n            }\n            break;\n        }\n        case 'RAY':\n        case 'XLINE': {\n            hasInfinite = true;\n            const p = transform(e.p, m), q = transform(add(e.p, e.direction), m), d = sub(q, p), v = options.view || { minX: p.x - 10000, maxX: p.x + 10000, minY: p.y - 10000, maxY: p.y + 10000 };\n            let lo = e.type === 'RAY' ? 0 : -Infinity, hi = Infinity;\n            for (const axis of ['x', 'y']) {\n                const min = v[axis === 'x' ? 'minX' : 'minY'], max = v[axis === 'x' ? 'maxX' : 'maxY'];\n                if (Math.abs(d[axis]) < 1e-12) { if (p[axis] < min || p[axis] > max) hi = -Infinity; }\n                else { const a = (min - p[axis]) / d[axis], b = (max - p[axis]) / d[axis]; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }\n            }\n            if (hi >= lo && Number.isFinite(lo) && Number.isFinite(hi)) paths.push({ points: [add(p, mul(d, lo)), add(p, mul(d, hi))], ...style, infinite: true, entityId: e.id });\n            break;\n        }\n        case 'DIMENSION': {\n            if (e.dimension?.version === 1) {\n                try {\n                    const picture = buildDimensionPicture(e,doc);\n                    for (const child of picture.entities) {\n                        const g=entityGeometry(child,doc,{...options,matrix:m,depth:depth+1,parentStyle:style,parentLayer:layerFor(e,doc)});\n                        hasInfinite ||= !!g.hasInfinite;\n                        paths.push(...g.paths.map(p=>({...p,entityId:e.id})));texts.push(...g.texts.map(t=>({...t,entityId:e.id})));\n                    }\n                } catch(error) { warnings.push({entityId:e.id,message:error.message}); }\n                break;\n            }\n            if (e.block && doc.blocks[e.block]) {\n                const g = entityGeometry({ ...e, type: 'INSERT', x: e.dimensionInsert?.x || 0, y: e.dimensionInsert?.y || 0, z: e.dimensionInsert?.z || 0 }, doc, { ...options, depth: depth + 1 });\n                hasInfinite ||= !!g.hasInfinite;\n                for (const p of g.paths)\n                    paths.push(p);\n                for (const t of g.texts)\n                    texts.push(t);\n                break;\n            }\n            const a = e.a, b = e.b;\n            if (!a || !b)\n                break;\n            const n = normalize({ x: -(b.y - a.y), y: b.x - a.x }), off = e.offset ?? 30, p = add(a, mul(n, off)), q = add(b, mul(n, off));\n            path([a, add(p, mul(n, 6))]);\n            path([b, add(q, mul(n, 6))]);\n            path([p, q]);\n            const u = normalize(sub(q, p));\n            for (const [v, dir] of [[p, 1], [q, -1]]) {\n                path([add(v, add(mul(u, dir * 7), mul(n, 3))), v, add(v, add(mul(u, dir * 7), mul(n, -3)))]);\n            }\n            label(add(lerp(p, q, .5), mul(n, 5)), e.text && e.text !== '<>' ? e.text : distance(a, b).toFixed(1), e.height || 12, Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, 'center');\n            break;\n        }\n        case 'INSERT': {\n            let block;try{block=effectiveBlock(e,doc);}catch(error){warnings.push({entityId:e.id,message:error.message});break;}\n            if (!block)\n                break;\n            const base = block.base || { x: 0, y: 0 }, rows = Math.min(1000, e.rows || 1), cols = Math.min(1000, e.columns || 1);\n            if (rows * cols > 10000)\n                break;\n            // MINSERT spacing belongs to the rotated placement grid, not the scaled block.\n            const placement = matrix({ x: e.x || 0, y: e.y || 0, rotation: e.rotation || 0 });\n            const shape = compose(matrix({ sx: e.sx ?? 1, sy: e.sy ?? e.sx ?? 1 }), matrix({ x: -base.x, y: -base.y }));\n            const gridRotation = matrix({ rotation: e.rotation || 0 }), locations = new Set();\n            for (let row = 0; row < rows; row++)\n                for (let col = 0; col < cols; col++) {\n                    const offset = { x: col * (e.columnSpacing || 0), y: row * (e.rowSpacing || 0) };\n                    const key = offset.x + ':' + offset.y;\n                    if (locations.has(key))\n                        continue;\n                    locations.add(key);\n                    const mm = compose(m, compose(placement, compose(matrix(offset), shape)));\n                    const attributeOffset = transform(offset, gridRotation);\n                    for (const attribute of e.attributes || []) {\n                        if (attribute.invisible)\n                            continue;\n                        const g = entityGeometry(attribute, doc, { ...options, matrix: compose(m, matrix(attributeOffset)), depth: depth + 1 });\n                        hasInfinite ||= !!g.hasInfinite;\n                        for (const t of g.texts)\n                            texts.push({ ...t, entityId: e.id });\n                    }\n                    for (const child of block.entities || []) {\n                        if ((child.type === 'ATTDEF' && !(child.constant || ((child.attributeFlags ?? child.flags ?? 0)&2))) || child.hidden)\n                            continue;\n                        const cl = (child.layer === '0') ? (e.layer === '0' && parentLayer ? parentLayer : layerFor(e, doc)) : layerFor(child, doc);\n                        if (cl?.visible === false)\n                            continue;\n                        const g = entityGeometry(child, doc, { matrix: mm, tolerance, depth: depth + 1, parentStyle: style, parentLayer: cl, view: options.view });\n                        hasInfinite ||= !!g.hasInfinite;\n                        warnings.push(...(g.warnings || []));\n                        for (const p of g.paths)\n                            paths.push({ ...p, entityId: e.id });\n                        for (const t of g.texts)\n                            texts.push({ ...t, entityId: e.id });\n                    }\n                }\n            if (e.tag && block.symbol) {\n                const p = { x: e.x || 0, y: (e.y || 0) - Math.abs((e.sy ?? e.sx ?? 1) * (block.symbol.labelOffset || 55)) };\n                label(p, e.tag, e.tagHeight || 12, 0, 'center');\n            }\n            break;\n        }\n    }\n    if (e.connector && e.points?.length > 1) {\n        const ps = e.points;\n        const b = ps.at(-1), a = ps.at(-2), u = normalize(sub(a, b)), n = { x: -u.y, y: u.x };\n        if (e.connector.arrow !== 'none')\n            path([add(b, add(mul(u, 9), mul(n, 4))), b, add(b, add(mul(u, 9), mul(n, -4)))]);\n        if (e.label) {\n            const mid = ps[Math.floor((ps.length - 1) / 2)], next = ps[Math.min(ps.length - 1, Math.floor((ps.length - 1) / 2) + 1)];\n            label(add(lerp(mid, next, .5), { x: 0, y: 8 }), e.label, 11, 0, 'center');\n        }\n    }\n    return { paths, texts, ...(warnings.length ? { warnings } : {}), ...(hasInfinite ? { hasInfinite: true } : {}) };\n}\nfunction entityBounds(e, doc) {\n    if(e.type==='VIEWPORT')return e.viewportId===1?emptyBounds():bounds(viewportRectangle(e));\n    if (['RAY', 'XLINE'].includes(e.type)) return bounds([e.p]);\n    const g = entityGeometry(e, doc, { tolerance: 1 }), pts = g.paths.filter(p => !p.infinite).flatMap(p => p.contours ? p.contours.flat() : p.points);\n    for (const t of g.texts) {\n        const layout = layoutCadText(t), frame = t.frame || matrix({ rotation: t.rotation }).slice(0, 4), tm = [...frame, t.p.x, t.p.y];\n        // Layout coordinates are font coordinates (Y down); model coordinates are Y up.\n        for (const x of [layout.minX, layout.maxX]) for (const y of [layout.minY, layout.maxY]) pts.push(transform({ x, y: -y }, tm));\n    }\n    if (!pts.length && e.type === 'INSERT') pts.push({ x: e.x, y: e.y });\n    return bounds(pts);\n}\nfunction documentBounds(doc) {\n    let b = emptyBounds();\n    for (const e of doc.entities)\n        if (isVisible(e, doc))\n            b = union(b, entityBounds(e, doc));\n    return validBounds(b) ? b : { minX: -100, minY: -100, maxX: 100, maxY: 100 };\n}\nfunction ports(e, doc) {\n    if (e.type !== 'INSERT')\n        return [];\n    const block = effectiveBlock(e,doc), base = block?.base || { x: 0, y: 0 };\n    const m = compose(matrix(e), matrix({ x: -base.x, y: -base.y }));\n    return (block?.ports || []).map(p => { const q = transform(p, m), v = transform({ x: p.x + (p.dx || 0), y: p.y + (p.dy || 0) }, m); return { ...p, ...q, dx: v.x - q.x, dy: v.y - q.y, entityId: e.id }; });\n}\nfunction moveEntity(e, dx, dy) {\n    if(e.type==='VIEWPORT'&&e.clipHandle)throw new Error('Moving a clipped viewport requires moving its boundary in the same transaction; no coordinates were changed.');\n    if(e.type==='DIMENSION'&&e.block&&e.dimension?.version!==1)throw new Error('Moving a dimension with a graphics block requires regeneration; no coordinates were changed.');\n    if(e.type==='DIMENSION'&&e.dimension?.version===1){delete e.block;delete e.dimension.references;}\n    const worldDX = dx, worldDY = dy;\n    if (e.extrusion && ['CIRCLE','ARC','LWPOLYLINE','POLYLINE','TEXT','ATTRIB','ATTDEF','SOLID','TRACE','HATCH','INSERT'].includes(e.type) && !(e.type === 'POLYLINE' && (e.flags & (8|16|64)))) {\n        const m = ocsTransform(e.extrusion, 0), det = m[0]*m[3]-m[1]*m[2];\n        if (Math.abs(det) < 1e-10) throw new Error('Cannot drag an edge-on OCS plane in the top view.');\n        dx = (m[3]*worldDX-m[2]*worldDY)/det; dy = (-m[1]*worldDX+m[0]*worldDY)/det;\n    }\n    const mv = p => {\n        if (p) {\n            p.x += dx;\n            p.y += dy;\n        }\n    };\n    for (const key of ['a', 'b', 'c', 'p', 'alignPoint', 'axisBase', 'startPoint', 'definitionPoint', 'textMidpoint', 'dimensionInsert', 'defpoint4', 'defpoint5'])\n        mv(e[key]);\n    for (const key of ['points', 'controlPoints', 'fitPoints'])\n        for (const p of e[key] || [])\n            mv(p);\n    for (const l of e.loops || [])\n        for (const p of l.points || [])\n            mv(p);\n    for (const loop of e.loops || []) for (const edge of loop.edges || []) {\n        for (const key of ['a', 'b', 'c']) mv(edge[key]);\n        for (const key of ['controlPoints', 'fitPoints']) for (const p of edge[key] || []) mv(p);\n    }\n    for (const definition of e.patternLines || []) mv(definition.base);\n    if(e.type==='HELIX')for(const key of ['controlPoints','fitPoints'])for(const p of e.helixSpline?.[key]||[])mv(p);\n    if (e.type === 'INSERT') {\n        e.x += dx;\n        e.y += dy;\n        for (const a of e.attributes || [])\n            moveEntity(a, worldDX, worldDY);\n    }\n    e.dirty = true;\n}\nfunction transformEntity(e, m) {\n    if(['VIEWPORT','HELIX','WIPEOUT'].includes(e.type)||(e.type==='DIMENSION'&&e.block&&e.dimension?.version!==1))throw new Error('This native entity requires a specialized transform; no coordinates were changed.');\n    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]), determinant = m[0]*m[3]-m[1]*m[2];\n    if (!m.every(Number.isFinite) || sx < 1e-12 || sy < 1e-12) throw new Error('Singular or nonfinite CAD transform.');\n    if (e.extrusion && (Math.abs(e.extrusion.x || 0) > 1e-9 || Math.abs(e.extrusion.y || 0) > 1e-9 || e.extrusion.z < 0))\n        throw new Error('Rotation of non-default OCS geometry requires a 3D transform; coordinates were not modified.');\n    if (['HATCH','CIRCLE','ARC','INSERT'].includes(e.type) && (Math.abs(sx-sy) > 1e-8*Math.max(sx,sy) || Math.abs(m[0]*m[2]+m[1]*m[3]) > 1e-8*sx*sy))\n        throw new Error('This entity requires a similarity transform; nonuniform scale would change its native type.');\n    if (e.type === 'HATCH' && determinant < 0) throw new Error('Mirroring native hatch edge paths is not supported; coordinates were not modified.');\n    if(e.type==='DIMENSION' && e.dimension?.version===1) {\n        if(determinant<=0||Math.abs(sx-sy)>1e-8*Math.max(sx,sy)||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-8*sx*sy)throw new Error('Dimensions require an orientation-preserving similarity transform');\n        for(const k of ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'])if(e[k])Object.assign(e[k],transform(e[k],m));\n        if(e.offset!==undefined)e.offset*=sx;\n        if(((e.dimtype??33)&15)===0)e.dimensionAngle=(e.dimensionAngle||0)+Math.atan2(m[1],m[0])*180/Math.PI;\n        if(e.textRotation!==undefined)e.textRotation+=Math.atan2(m[1],m[0])*180/Math.PI;\n        e.dimension.style={...e.dimension.style,dimscale:(e.dimension.style?.dimscale??e.dimension.resolvedScale??e.dimstyleOverrides?.dimscale??1)*sx};\n        delete e.block;delete e.dimension.references;e.dirty=true;return;\n    }\n    const vector = p => ({x:m[0]*p.x+m[2]*p.y,y:m[1]*p.x+m[3]*p.y});\n    if (e.direction) Object.assign(e.direction, vector(e.direction));\n    if (e.major) Object.assign(e.major, vector(e.major));\n    for (const loop of e.loops || []) for (const edge of loop.edges || []) {\n        for (const key of ['a','b','c']) if (edge[key]) Object.assign(edge[key], transform(edge[key], m));\n        for (const key of ['controlPoints','fitPoints']) for (const p of edge[key] || []) Object.assign(p, transform(p, m));\n        for (const key of ['major','startTangent','endTangent']) if (edge[key]) Object.assign(edge[key], vector(edge[key]));\n        if (edge.r) edge.r *= sx;\n        if (edge.type === 2) { const angle = Math.atan2(m[1],m[0]); edge.start += angle; edge.end += angle; }\n    }\n    for (const definition of e.patternLines || []) {\n        Object.assign(definition.base, transform(definition.base, m)); Object.assign(definition.offset, vector(definition.offset));\n        definition.angle += Math.atan2(m[1],m[0]); definition.dashes = (definition.dashes || []).map(v=>v*sx);\n    }\n    if(e.type==='HATCH' && e.gradient){const rotation=Math.atan2(m[1],m[0]);const angle=e.gradient.find(p=>p[0]===460);if(angle)angle[1]+=rotation;else e.gradient.push([460,rotation]);}\n    if (e.type === 'HATCH') { e.patternScale = (e.patternScale || 1)*sx; e.patternAngle = (e.patternAngle || 0) + Math.atan2(m[1],m[0])*180/Math.PI; }\n    for (const p of e.points || []) { if (p.bulge && determinant < 0) p.bulge *= -1; for (const k of ['startWidth','endWidth']) if (p[k]) p[k] *= sx; }\n    for (const k of ['constantWidth','startWidth','endWidth','mtextWidth']) if (e[k]) e[k] *= sx;\n    const apply = p => {\n        if (p)\n            Object.assign(p, transform(p, m));\n    };\n    for (const key of ['a', 'b', 'c', 'p', 'alignPoint'])\n        apply(e[key]);\n    for (const key of ['points', 'controlPoints', 'fitPoints'])\n        for (const p of e[key] || [])\n            apply(p);\n    for (const l of e.loops || [])\n        for (const p of l.points || [])\n            apply(p);\n    const scale = Math.hypot(m[0], m[1]), rot = Math.atan2(m[1], m[0]) * 180 / Math.PI;\n    if (e.r)\n        e.r *= scale;\n    if (e.height)\n        e.height *= scale;\n    if (e.type === 'ARC') {\n        const angle = a => { const v=vector({x:Math.cos(a),y:Math.sin(a)}); return Math.atan2(v.y,v.x); };\n        e.start = angle(e.start); e.end = angle(e.end);\n        if (determinant < 0) e.clockwise = !e.clockwise;\n    }\n    if (e.type === 'INSERT') {\n        const p = transform({ x: e.x, y: e.y }, m);\n        e.x = p.x;\n        e.y = p.y;\n        e.sx = (e.sx ?? 1) * scale;\n        e.sy = (e.sy ?? 1) * scale;\n        e.rotation = (e.rotation || 0) + rot;\n    }\n    if (['TEXT', 'MTEXT'].includes(e.type))\n        e.rotation = (e.rotation || 0) + rot;\n    e.dirty = true;\n}\nfunction explodeEntity(e, doc) { if (e.type === 'VIEWPORT') throw new Error('A clipped viewport cannot be exploded without clipping its native geometry'); const g = entityGeometry(e, doc, { tolerance: .05 }); if(g.paths.some(p=>p.gradient))throw new Error('Gradient hatch explosion requires retaining native fill semantics'); return [...g.paths.map(p => polyline(p.points, p.closed, { layer: e.layer, color: p.color, width: p.width, dash: p.dash, fill: p.fill })), ...g.texts.map(t => text(t.p, t.text, t.height, { layer: e.layer, color: t.color, rotation: t.rotation, align: t.align }))]; }\nfunction detachReferences(doc, deleted) {\n    for (const e of doc.entities) {\n        if(e.dimension?.references)for(const [key,ref]of Object.entries(e.dimension.references))if(deleted.has(ref.entityId))delete e.dimension.references[key];\n        const c = e.connector;\n        if (!c)\n            continue;\n        for (const end of ['from', 'to'])\n            if (c[end] && deleted.has(c[end].entityId))\n                c[end] = null;\n    }\n    doc.constraints = doc.constraints.filter(c => !(c.entities || [c.entityId]).some(id => deleted.has(id)));\n}\n\n// Reusable editing/evaluation APIs. Cyclic module imports are intentionally avoided.\nfunction dimensionPicture(e,doc) { return buildDimensionPicture(e,doc); }\nfunction editDimension(e,doc,patch) { return applyDimensionEdit(e,doc,patch); }\nfunction dimensionGrips(e,doc) { return getDimensionGrips(e,doc); }\nfunction regenerateDimensions(doc) { return refreshDimensions(doc); }\nfunction validateDynamicBlock(block) { return validateDynamicDefinition(block); }\nfunction dynamicValues(block,values={}) { return resolveDynamicValues(block,values); }\nfunction evaluateDynamicBlock(block,values={},options={}) { return evaluateDynamicDefinition(block,values,transformEntity,options); }\nfunction setDynamicParameters(e,doc,patch) {\n    if(e.type!=='INSERT'||!doc.blocks[e.block]?.dynamic)throw new Error('Select a Conduit parameterized block');\n    const values={...e.dynamicParameters,...patch};\n    const evaluated=evaluateDynamicBlock(doc.blocks[e.block],values);\n    const updated=structuredClone(e);syncAttributes(updated,evaluated,()=>uid('attribute'));\n    e.attributes=updated.attributes;e.dynamicParameters={...evaluated.dynamicValues};e.dirty=true;return evaluated;\n}\nconst dynamicCache=new WeakMap();\nfunction effectiveBlock(e,doc) {\n    const block=doc.blocks[e.block];if(!block?.dynamic)return block;\n    const signature=JSON.stringify([block.entities,block.ports,block.dynamic,block.base,block.parameters,block.constraints]);\n    let cache=dynamicCache.get(block);\n    if(!cache||cache.signature!==signature){cache={signature,values:new Map()};dynamicCache.set(block,cache);}\n    const key=JSON.stringify(e.dynamicParameters||{});\n    if(!cache.values.has(key)){\n        const evaluated=evaluateDynamicBlock(block,e.dynamicParameters||{});\n        if(cache.values.size>=64)cache.values.delete(cache.values.keys().next().value);\n        cache.values.set(key,evaluated);\n    }\n    return cache.values.get(key);\n}\n\nfunction dynamicParameterGrips(e,doc) {\n    const b=doc.blocks[e.block];if(!b?.dynamic)return [];\n    const values=dynamicValues(b,e.dynamicParameters||{}),m=compose(matrix(e),matrix({x:-(b.base?.x||0),y:-(b.base?.y||0)}));\n    return b.dynamic.parameters.filter(p=>p.grip&&['distance','number','angle'].includes(p.type)).map(p=>{\n        const g=p.grip,base=g.base||{x:0,y:0},d=g.direction||{x:1,y:0},v=values[p.name];\n        const q=p.type==='angle'?{x:base.x+Math.cos(v*Math.PI/180)*(g.radius||40),y:base.y+Math.sin(v*Math.PI/180)*(g.radius||40)}:{x:base.x+d.x*v,y:base.y+d.y*v};\n        return {...transform(q,m),key:'dyn:'+p.name};\n    });\n}\nfunction dynamicGripValue(e,doc,name,world) {\n    const b=doc.blocks[e.block],p=b?.dynamic?.parameters.find(p=>p.name===name),g=p?.grip;\n    if(!g)throw new Error('Missing dynamic parameter grip');\n    const m=compose(matrix(e),matrix({x:-(b.base?.x||0),y:-(b.base?.y||0)})),det=m[0]*m[3]-m[1]*m[2];\n    if(Math.abs(det)<1e-12)throw new Error('Singular block transform');\n    const dx=world.x-m[4],dy=world.y-m[5],q={x:(m[3]*dx-m[2]*dy)/det,y:(-m[1]*dx+m[0]*dy)/det};\n    const base=g.base||{x:0,y:0},d=g.direction||{x:1,y:0},length=d.x*d.x+d.y*d.y;\n    if(length<1e-12)throw new Error('Invalid grip direction');\n    let value=p.type==='angle'?Math.atan2(q.y-base.y,q.x-base.x)*180/Math.PI:((q.x-base.x)*d.x+(q.y-base.y)*d.y)/length;\n    value=Math.max(p.min??-Infinity,Math.min(p.max??Infinity,value));\n    if(p.values?.length)value=p.values.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a);\n    return value;\n}\n\nfunction blockDefinitionSignature(block) { return blockSignature(block); }\nfunction inspectBlockReferences(doc,name) { return blockReferences(doc,name); }\nfunction beginBlockEdit(doc,name) { return beginBlockDraft(doc,name); }\nfunction editedBlockDefinition(session) { return blockFromDraft(session); }\nfunction prepareBlockUpdate(doc,name,block,options={}) { return prepareBlockDraft(doc,name,block,options,evaluateDynamicBlock,()=>uid('attribute')); }\nfunction updateBlockDefinition(doc,name,block,options={}) {\n    const result=prepareBlockUpdate(doc,name,block,options);\n    // Validate before touching any live object. Host history owns the transaction.\n    Object.assign(doc,result.document);return result.report;\n}\nfunction renameBlockDefinition(doc,oldName,newName) { Object.assign(doc,renameBlockInDocument(doc,oldName,newName)); }\nfunction duplicateBlockDefinition(doc,name,newName) { Object.assign(doc,copyBlockInDocument(doc,name,newName)); }\n\nfunction createBlockDefinition(doc,name,definition={}) { Object.assign(doc,createBlockInDocument(doc,name,definition,evaluateDynamicBlock)); }\nfunction deleteBlockDefinition(doc,name) { Object.assign(doc,removeBlockInDocument(doc,name)); }\nfunction syncInsertAttributes(e,doc) {\n    if(e.type!=='INSERT'||!doc.blocks[e.block])throw new Error('Select a valid block reference');\n    const block=doc.blocks[e.block],evaluated=block.dynamic?evaluateDynamicBlock(block,e.dynamicParameters||{}):block,next=structuredClone(e);\n    syncAttributes(next,evaluated,()=>uid('attribute'));e.attributes=next.attributes;e.dirty=true;return e.attributes;\n}\n\nreturn {textLayout,objectCoordinateTransform,uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences,dimensionPicture,editDimension,dimensionGrips,regenerateDimensions,validateDynamicBlock,dynamicValues,evaluateDynamicBlock,setDynamicParameters,dynamicParameterGrips,dynamicGripValue,blockDefinitionSignature,inspectBlockReferences,beginBlockEdit,editedBlockDefinition,prepareBlockUpdate,updateBlockDefinition,renameBlockDefinition,duplicateBlockDefinition,createBlockDefinition,deleteBlockDefinition,syncInsertAttributes};\n})();\n// packages/dxf/src/codec.js\n__modules[\"packages/dxf/src/codec.js\"]=(()=>{\n/** Lossless tag values and bounded ASCII/binary transport. DXF R13+ uses\n * two-byte group codes; R12 uses one-byte codes with a 255 escape. */\nconst SIGNATURE = 'AutoCAD Binary DXF\\r\\n\\x1a\\0';\nconst between = (c, a, b) => c >= a && c <= b;\nfunction groupType(c) {\n    if (!Number.isInteger(c) || c < 0 || c > 1071) throw new Error(`Invalid DXF group code ${c}`);\n    if (between(c, 310, 319) || c === 1004) return 'binary';\n    if (between(c, 10, 59) || between(c, 110, 149) || between(c, 210, 239) || between(c, 460, 469) || between(c, 1010, 1059)) return 'double';\n    if (between(c, 60, 79) || between(c, 170, 179) || between(c, 270, 289) || between(c, 370, 389) || between(c, 400, 409) || between(c, 1060, 1070)) return 'int16';\n    if (between(c, 90, 99) || between(c, 420, 429) || between(c, 440, 459) || c === 1071) return 'int32';\n    if (between(c, 160, 169)) return 'int64';\n    if (between(c, 290, 299)) return 'byte';\n    return 'string';\n}\nfunction checkedValue(c, value) {\n    const type = groupType(c);\n    if (type === 'string') { const s=String(value); if (/[\\r\\n\\0]/.test(s)) throw new Error(`Control character in DXF group ${c}`); return s; }\n    if (type === 'binary') { const s=String(value).trim(); if (!/^(?:[\\da-f]{2}){0,127}$/i.test(s)) throw new Error(`Invalid binary chunk in group ${c}`); return s; }\n    const s=String(value).trim();\n    if (!s || !(type !== 'int64' ? /^[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?$/ : /^[-+]?\\d+$/).test(s)) throw new Error(`Invalid ${type} in group ${c}`);\n    if (type === 'int64') { const n=BigInt(s); if(n<-(1n<<63n)||n>=(1n<<63n))throw new Error(`Int64 overflow in group ${c}`);return s; }\n    const n=Number(s); if(!Number.isFinite(n))throw new Error(`Non-finite DXF value in group ${c}`);\n    if (type!=='double') { const lo=type==='byte'?0:type==='int16'?-32768:-2147483648, hi=type==='byte'?1:type==='int16'?32767:2147483647;\n        if(!Number.isInteger(n)||n<lo||n>hi)throw new Error(`DXF ${type} overflow in group ${c}`); }\n    return n;\n}\nfunction limitOptions(options) {\n    const n=options.maxPairs??8000000;\n    if(!Number.isSafeInteger(n)||n<1||n>8000000)throw new Error('Invalid DXF maxPairs limit');\n    return n;\n}\nfunction readAsciiTags(source, options={}) {\n    if(typeof source!=='string'||source.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB text limit');\n    const max=limitOptions(options), lines=source.replace(/^\\uFEFF/,'').split(/\\r\\n|\\n|\\r/), pairs=[];\n    while(lines.length&&lines.at(-1)==='')lines.pop();\n    if(lines.length%2)throw new Error('Truncated DXF group/value pair');\n    let eof=false;\n    for(let i=0;i<lines.length;i+=2) {\n        if(pairs.length>=max)throw new Error('DXF group-code safety limit exceeded');\n        if(!/^\\s*\\d+\\s*$/.test(lines[i]))throw new Error(`Invalid DXF group code at line ${i+1}`);\n        const c=Number(lines[i]), value=checkedValue(c,lines[i+1]);\n        if(eof) { if(c!==999)throw new Error('Data after DXF EOF marker'); else {pairs.push([c,value]);continue;} }\n        pairs.push([c,value]); if(c===0&&String(value).trim()==='EOF')eof=true;\n    }\n    if(!eof)throw new Error('DXF EOF marker missing (file may be truncated)');\n    return pairs;\n}\nfunction decodeCodePage(page='ANSI_1252') {\n    const p=String(page).toUpperCase().replace(/^ANSI_/, '');\n    const names={'874':'windows-874','932':'shift_jis','936':'gbk','949':'euc-kr','950':'big5','1361':'euc-kr','UTF-8':'utf-8','UTF8':'utf-8'};\n    return names[p] || (/^125[0-8]$/.test(p)?'windows-'+p:/^DOS(?:_|)(\\d+)$/.test(p)?'ibm'+p.match(/\\d+/)[0]:'windows-1252');\n}\nfunction readBinaryTags(input, options={}) {\n    const u=input instanceof Uint8Array?input:new Uint8Array(input);\n    if(u.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB limit');\n    if(u.length<24 || SIGNATURE.split('').some((s,i)=>u[i]!==s.charCodeAt(0)))throw new Error('Invalid binary DXF signature');\n    const v=new DataView(u.buffer,u.byteOffset,u.byteLength), max=limitOptions(options), result=[];\n    // Structural SECTION/999 tag at the beginning disambiguates the code width.\n    const r12=options.r12??(u[23]!==0); let pos=22,eof=false;\n    const need=n=>{if(pos+n>u.length)throw new Error('Truncated binary DXF');};\n    const strings=[];\n    while(pos<u.length) {\n        if(result.length>=max)throw new Error('DXF group-code safety limit exceeded');\n        need(r12?1:2);let c;\n        if(r12) {c=u[pos++];if(c===255){need(2);c=v.getUint16(pos,true);pos+=2;}}else {c=v.getUint16(pos,true);pos+=2;}\n        const t=groupType(c);let value;\n        if(t==='string') {const start=pos;while(pos<u.length&&u[pos])pos++;need(1);value=new TextDecoder('windows-1252').decode(u.subarray(start,pos));strings.push([result.length,start,pos]);pos++;}\n        else if(t==='binary'){need(1);const n=u[pos++];need(n);value=Array.from(u.subarray(pos,pos+n),b=>b.toString(16).padStart(2,'0')).join('');pos+=n;}\n        else if(t==='double'){need(8);value=v.getFloat64(pos,true);pos+=8;}\n        else if(t==='int16'){need(2);value=v.getInt16(pos,true);pos+=2;}\n        else if(t==='int32'){need(4);value=v.getInt32(pos,true);pos+=4;}\n        else if(t==='int64'){need(8);value=v.getBigInt64(pos,true).toString();pos+=8;}\n        else {need(1);value=u[pos++];}\n        checkedValue(c,value);result.push([c,value]);\n        if(c===0&&value==='EOF'){eof=true;break;}\n    }\n    if(!eof)throw new Error('Binary DXF EOF marker missing');\n    if(pos!==u.length)throw new Error('Data after binary DXF EOF marker');\n    // Decode *after* scanning the header, including strings preceding $DWGCODEPAGE.\n    let key='',ver='AC1009',page='ANSI_1252';\n    for(const [c,x] of result){if(c===9)key=x;else if(key==='$ACADVER'&&c===1)ver=x;else if(key==='$DWGCODEPAGE'&&c===3)page=x;}\n    const decoder=new TextDecoder(options.encoding || (ver>='AC1021'?'utf-8':decodeCodePage(page)),{fatal:true});\n    for(const [i,a,b] of strings)result[i][1]=decoder.decode(u.subarray(a,b));\n    return result;\n}\nfunction writeAsciiTags(pairs,{version='AC1024'}={}) {\n    return pairs.map(([c,v])=>{let s=String(checkedValue(c,v));if(version<'AC1021')s=s.replace(/[\\u0080-\\uffff]/g,x=>'\\\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));return `${c}\\r\\n${s}\\r\\n`;}).join('');\n}\nfunction writeBinaryTags(pairs,{version='AC1024',r12=version<='AC1009'}={}) {\n    const bytes=[],encoder=new TextEncoder();let size=22;\n    for(const [c,v] of pairs) {\n        if(c===999)continue; // Binary DXF does not carry ASCII comments.\n        const value=checkedValue(c,v),t=groupType(c),codeSize=r12?(c<255?1:3):2;\n        let payload;\n        if(t==='string') {let s=String(value);if(version<'AC1021')s=s.replace(/[\\u0080-\\uffff]/g,x=>'\\\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));payload=encoder.encode(s+'\\0');}\n        else if(t==='binary'){const s=String(value);payload=new Uint8Array(1+s.length/2);payload[0]=s.length/2;for(let i=0;i<s.length;i+=2)payload[1+i/2]=parseInt(s.slice(i,i+2),16);}\n        else {payload=new Uint8Array(t==='double'||t==='int64'?8:t==='int32'?4:t==='int16'?2:1);const d=new DataView(payload.buffer);if(t==='double')d.setFloat64(0,value,true);else if(t==='int64')d.setBigInt64(0,BigInt(value),true);else if(t==='int32')d.setInt32(0,value,true);else if(t==='int16')d.setInt16(0,value,true);else payload[0]=value;}\n        size+=codeSize+payload.length;if(size>128*1024*1024)throw new Error('Binary DXF output exceeds safety limit');bytes.push([c,codeSize,payload]);\n    }\n    const out=new Uint8Array(size),view=new DataView(out.buffer);out.set(encoder.encode(SIGNATURE));let i=22;\n    for(const [c,n,p] of bytes){if(n===1)out[i++]=c;else {if(n===3)out[i++]=255;view.setUint16(i,c,true);i+=2;}out.set(p,i);i+=p.length;}return out;\n}\nfunction splitSections(pairs) {\n    const sections=Object.create(null);let name=null,ended=false;\n    for(let i=0;i<pairs.length;i++) {const [c,v]=pairs[i];\n        if(c===0&&v==='SECTION'){if(name!==null||pairs[i+1]?.[0]!==2)throw new Error('Malformed DXF SECTION nesting');name=String(pairs[++i][1]).trim();if(Object.hasOwn(sections,name))throw new Error('Duplicate DXF section '+name);sections[name]=[];}\n        else if(c===0&&v==='ENDSEC'){if(name===null)throw new Error('Unmatched DXF ENDSEC');name=null;}\n        else if(c===0&&v==='EOF'){if(name!==null)throw new Error('Unclosed DXF section '+name);ended=true;break;}\n        else if(name!==null)sections[name].push(pairs[i]);else if(c!==999)throw new Error('DXF tag outside section');\n    }\n    if(!ended)throw new Error('DXF EOF marker missing');return sections;\n}\nfunction splitRecords(pairs) {\n    const result=[];let r=[];for(const p of pairs){if(p[0]===0&&r.length){result.push(r);r=[];}r.push(p);}if(r.length)result.push(r);return result;\n}\n\n/** Semantic string decoding; raw transport tags remain unchanged for preservation. */\nfunction decodeTextEscapes(value) {\n    return typeof value === 'string' ? value.replace(/\\\\U\\+([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))) : value;\n}\n\nreturn {groupType,checkedValue,readAsciiTags,decodeCodePage,readBinaryTags,writeAsciiTags,writeBinaryTags,splitSections,splitRecords,decodeTextEscapes};\n})();\n// packages/dxf/src/interop.js\n__modules[\"packages/dxf/src/interop.js\"]=(()=>{\nconst {splitRecords, decodeTextEscapes} = __modules[\"packages/dxf/src/codec.js\"];\nconst get = (r,c,d=undefined) => decodeTextEscapes(r.find(p=>p[0]===c)?.[1] ?? d);\nconst all = (r,c) => r.filter(p=>p[0]===c).map(p=>p[1]);\nconst point = (r,c=10) => ({x:+get(r,c,0),y:+get(r,c+10,0),z:+get(r,c+20,0)});\nconst has = (r,c) => r.some(p=>p[0]===c);\nconst key = v => String(v ?? '').toUpperCase();\nfunction subclassTags(raw,name) {\n    const i=raw.findIndex(p=>p[0]===100 && p[1]===name);\n    if(i<0) return [];\n    let end=i+1;\n    while(end<raw.length && raw[end][0]!==100 && raw[end][0]<1000) end++;\n    return raw.slice(i+1,end);\n}\n/** Reactor/extension and XDATA fields do not share the entity field namespace. */\nfunction graphicalTags(raw) {\n    const result=[]; let depth=0;\n    for(const [c,v] of raw) {\n        if(c>=1000) break;\n        if(c===102) {\n            if(String(v).startsWith('{')) depth++;\n            else if(v==='}') { if(!depth) throw new Error('Unmatched extension-data closing brace'); depth--; }\n            else if(!depth) result.push([c,v]);\n        } else if(!depth) result.push([c,v]);\n    }\n    if(depth) throw new Error('Unclosed extension-data group');\n    return result;\n}\nconst DIMSTYLE_FIELDS = {dimscale:40,dimasz:41,dimexo:42,dimdli:43,dimexe:44,dimrnd:45,dimdle:46,dimtp:47,dimtm:48,dimtxt:140,dimcen:141,dimtsz:142,dimaltf:143,dimlfac:144,dimtvp:145,dimtfac:146,dimgap:147,dimpost:3,dimapost:4,dimtad:77,dimzin:78,dimdec:271,dimtdec:272,dimaltu:273,dimlunit:277,dimdsep:278,dimclrd:176,dimclre:177,dimclrt:178};\nconst DIM_POINTS = {definitionPoint:10,textMidpoint:11,dimensionInsert:12,a:13,b:14,defpoint4:15,defpoint5:16};\nconst DIM_SCALARS = {dimensionAngle:50,obliqueAngle:52,textRotation:53,horizontalDirection:51,leaderLength:40,measurement:42,attachment:71,dimensionVersion:280};\nconst points = (r,c=10) => {\n    const result=[]; let p;\n    for(const [code,v] of r) {\n        if(code===c) { p={x:+v,y:0,z:0}; result.push(p); }\n        else if(p && code===c+10) p.y=+v;\n        else if(p && code===c+20) p.z=+v;\n    }\n    return result;\n};\nconst count = n => {\n    if(!Number.isSafeInteger(n) || n<0 || n>1000000) throw new Error('Invalid DXF collection count');\n    return n;\n};\nfunction readSpline(r) {\n    return {degree:+get(r,71,3),splineFlags:+get(r,70,0),knots:all(r,40).map(Number),weights:all(r,41).map(Number),controlPoints:points(r),fitPoints:points(r,11)};\n}\nfunction readInteropEntity(e,r) {\n    if(e.type==='DIMENSION') {\n        e.dimtype=+get(r,70,0); e.dimstyle=get(r,3,'STANDARD');\n        for(const [k,c] of Object.entries(DIM_POINTS)) if(has(r,c)) e[k]=point(r,c);\n        for(const [k,c] of Object.entries(DIM_SCALARS)) if(has(r,c)) e[k]=+get(r,c);\n    } else if(e.type==='VIEWPORT') {\n        const sub=subclassTags(r,'AcDbViewport'), v=sub.length?sub:r;\n        Object.assign(e,{c:point(v),viewportWidth:+get(v,40,1),viewportHeight:+get(v,41,1),viewHeight:+get(v,45,1),viewportId:+get(v,69,2),viewportStatus:+get(v,68,1),viewCenter:point(v,12),viewTarget:point(v,17),viewDirection:has(v,16)?point(v,16):{x:0,y:0,z:1},viewTwist:+get(v,51,0),viewportFlags:+get(v,90,0),frozenLayerHandles:all(v,331).map(String),clipHandle:get(v,340)});\n        if(e.viewportWidth<0 || e.viewportHeight<0 || e.viewHeight<=0) throw new Error('Invalid VIEWPORT dimensions');\n    } else if(e.type==='MESH') {\n        const v=subclassTags(r,'AcDbSubDMesh'); let i=0;\n        const read=c=>{if(v[i]?.[0]!==c) throw new Error(`Malformed MESH: expected group ${c}`);return v[i++][1];};\n        e.meshVersion=+read(71); e.blendCrease=+read(72); e.subdivision=+read(91);\n        const n=count(+read(92)); e.points=[];\n        for(let k=0;k<n;k++) e.points.push({x:+read(10),y:+read(20),z:+read(30)});\n        const size=count(+read(93)); let used=0; e.faces=[];\n        const index=()=>{const x=+read(90);if(!Number.isSafeInteger(x)||x<0||x>=n) throw new Error('Invalid MESH vertex index');return x;};\n        while(used<size) {\n            const length=count(+read(90)); used++;\n            if(length<3 || used+length>size) throw new Error('Invalid MESH face size');\n            const face=[];for(let k=0;k<length;k++) face.push(index());\n            used+=length; e.faces.push(face);\n        }\n        const ne=count(+read(94)); e.edges=[];\n        for(let k=0;k<ne;k++) e.edges.push([index(),index()]);\n        const nc=count(+read(95)); e.creases=[];\n        for(let k=0;k<nc;k++) e.creases.push(+read(140));\n        if(nc!==ne) throw new Error('MESH crease/edge count mismatch');\n        e.meshOverrides=v.slice(i);\n    } else if(e.type==='HELIX') {\n        e.helixSpline=readSpline(subclassTags(r,'AcDbSpline'));\n        const v=subclassTags(r,'AcDbHelix');\n        Object.assign(e,{helixMajor:+get(v,90,29),helixMinor:+get(v,91,63),axisBase:point(v),startPoint:point(v,11),axis:point(v,12),radius:+get(v,40,1),turns:+get(v,41,1),turnHeight:+get(v,42,1),handedness:!!get(v,290,1),helixConstraint:+get(v,280,1)});\n    } else if(e.type==='WIPEOUT') {\n        const v=subclassTags(r,'AcDbWipeout');\n        Object.assign(e,{p:point(v),uPixel:point(v,11),vPixel:point(v,12),imageSize:point(v,13),boundary:points(v,14),boundaryType:+get(v,71,2),imageFlags:+get(v,70,7),clipping:!!get(v,280,1)});\n        if(e.boundary.length!==count(+get(v,91,e.boundary.length))) throw new Error('WIPEOUT boundary count mismatch');\n        if(e.boundaryType===1 && e.boundary.length!==2) throw new Error('WIPEOUT rectangle requires two corners');\n        if(e.boundaryType===2 && e.boundary.length<3) throw new Error('WIPEOUT polygon requires at least three points');\n    }\n}\nfunction writeInteropEntity(e,pair,pp) {\n    if(e.type==='DIMENSION') {\n        const type=(e.dimtype??33)&15;\n        if(type>6) throw new Error(`Unsupported DIMENSION subtype ${type}`);\n        pair(100,'AcDbDimension');pair(2,e.block);pp(10,e.definitionPoint || e.a);pp(11,e.textMidpoint || e.definitionPoint || e.a);\n        pair(70,(e.dimtype??33)|32);pair(1,e.text??'<>');pair(3,e.dimstyle||'STANDARD');\n        for(const [k,c] of Object.entries(DIM_SCALARS)) if(e[k]!==undefined && ![50,52,40].includes(c)) pair(c,e[k]);\n        if(e.dimensionInsert)pp(12,e.dimensionInsert);\n        const names=['AcDbAlignedDimension','AcDbAlignedDimension','AcDb2LineAngularDimension','AcDbDiametricDimension','AcDbRadialDimension','AcDb3PointAngularDimension','AcDbOrdinateDimension'];\n        pair(100,names[type]);\n        if([0,1,2,5,6].includes(type)) {if(e.a)pp(13,e.a);if(e.b)pp(14,e.b);}\n        if([2,3,4,5].includes(type)&&e.defpoint4)pp(15,e.defpoint4);\n        if(type===2&&e.defpoint5)pp(16,e.defpoint5);\n        if([0,1].includes(type)&&e.obliqueAngle!==undefined)pair(52,e.obliqueAngle);\n        if(type===0){pair(50,e.dimensionAngle||0);pair(100,'AcDbRotatedDimension');}\n        if([3,4].includes(type))pair(40,e.leaderLength||0);\n    } else if(e.type==='VIEWPORT') {\n        pair(100,'AcDbViewport');pp(10,e.c);pair(40,e.viewportWidth);pair(41,e.viewportHeight);pair(68,e.viewportStatus??1);pair(69,e.viewportId??2);\n        pair(12,e.viewCenter?.x||0);pair(22,e.viewCenter?.y||0);pp(16,e.viewDirection||{x:0,y:0,z:1});pp(17,e.viewTarget);\n        pair(45,e.viewHeight);pair(51,e.viewTwist||0);pair(90,e.viewportFlags||0);\n        for(const h of e.frozenLayerHandles||[])pair(331,h);\n        if(e.clipHandle)pair(340,e.clipHandle);\n        pair(281,0);\n    } else if(e.type==='MESH') {\n        pair(100,'AcDbSubDMesh');pair(71,e.meshVersion??2);pair(72,e.blendCrease??0);pair(91,e.subdivision??0);pair(92,count(e.points.length));\n        for(const p of e.points)pp(10,p);\n        pair(93,(e.faces||[]).reduce((n,f)=>n+1+f.length,0));\n        const index=x=>{if(!Number.isSafeInteger(x)||x<0||x>=e.points.length)throw new Error('Invalid MESH vertex index');pair(90,x);};\n        for(const f of e.faces||[]){if(f.length<3)throw new Error('Invalid MESH face');pair(90,count(f.length));for(const x of f)index(x);}\n        pair(94,count(e.edges?.length||0));for(const edge of e.edges||[]){if(edge.length!==2)throw new Error('Invalid MESH edge');for(const x of edge)index(x);}\n        const creases=e.creases||new Array(e.edges?.length||0).fill(0);\n        if(creases.length!==(e.edges?.length||0))throw new Error('MESH crease/edge count mismatch');\n        pair(95,count(creases.length));for(const c of creases)pair(140,c);\n        for(const [c,v] of e.meshOverrides||[[90,0]])pair(c,v);\n    } else if(e.type==='HELIX') {\n        const s=e.helixSpline||{};pair(100,'AcDbSpline');pair(70,s.splineFlags||0);pair(71,s.degree||3);\n        pair(72,s.knots?.length||0);pair(73,s.controlPoints?.length||0);pair(74,s.fitPoints?.length||0);\n        for(const v of s.knots||[])pair(40,v);for(const v of s.weights||[])pair(41,v);\n        for(const p of s.controlPoints||[])pp(10,p);for(const p of s.fitPoints||[])pp(11,p);\n        pair(100,'AcDbHelix');pair(90,e.helixMajor??29);pair(91,e.helixMinor??63);pp(10,e.axisBase);pp(11,e.startPoint);pp(12,e.axis||{x:0,y:0,z:1});\n        pair(40,e.radius);pair(41,e.turns);pair(42,e.turnHeight);pair(290,e.handedness===false?0:1);pair(280,e.helixConstraint??1);\n    } else if(e.type==='WIPEOUT') {\n        pair(100,'AcDbWipeout');pair(90,0);pp(10,e.p);pp(11,e.uPixel);pp(12,e.vPixel);pair(13,e.imageSize?.x||1);pair(23,e.imageSize?.y||1);\n        pair(70,e.imageFlags??7);pair(280,e.clipping===false?0:1);pair(281,50);pair(282,50);pair(283,0);pair(71,e.boundaryType??2);pair(91,e.boundary.length);\n        for(const p of e.boundary){pair(14,p.x);pair(24,p.y);}\n    } else return false;\n    return true;\n}\nfunction readDocumentInterop(doc,sections) {\n    const tableRecords=splitRecords(sections.TABLES||[]), objects=splitRecords(sections.OBJECTS||[]);\n    doc.dimstyles=Object.create(null);doc.layoutSettings=Object.create(null);\n    const blockNames=new Map(), layerNames=new Map(), layoutByOwner=new Map();\n    for(const r of tableRecords) {\n        const type=get(r,0), handle=key(get(r,type==='DIMSTYLE'?105:5));\n        if(type==='BLOCK_RECORD')blockNames.set(handle,get(r,2));\n        if(type==='LAYER')layerNames.set(handle,get(r,2));\n        if(type==='DIMSTYLE') {\n            const s={};for(const [k,c] of Object.entries(DIMSTYLE_FIELDS))if(has(r,c))s[k]=get(r,c);\n            doc.dimstyles[get(r,2,'STANDARD')]=s;\n        }\n    }\n    for(const raw of objects) {\n        if(get(raw,0)!=='LAYOUT')continue;\n        const l=subclassTags(raw,'AcDbLayout'),p=subclassTags(raw,'AcDbPlotSettings'),name=get(l,1,'Layout1');\n        doc.layoutSettings[name]={tabOrder:+get(l,71,0),paperWidth:+get(p,44,420),paperHeight:+get(p,45,297),paperUnits:+get(p,72,1),rotation:+get(p,73,0)};\n        layoutByOwner.set(key(get(l,330)),name);\n    }\n    // Inactive paper layouts are stored inside special BLOCKs, not ENTITIES.\n    for(const [owner,name] of layoutByOwner) {\n        const blockName=blockNames.get(owner), b=doc.blocks[blockName];\n        if(b && /^\\*(Model|Paper)_Space/i.test(blockName)) {\n            for(const e of b.entities||[]){e.layout=name;doc.entities.push(e);}\n            delete doc.blocks[blockName];\n        }\n    }\n    for(const [name,b] of Object.entries(doc.blocks))if(/^\\*(Model|Paper)_Space(?:\\d+)?$/i.test(name)) {\n        const layout=/Model/i.test(name)?'Model':'Layout1';\n        for(const e of b.entities||[]){e.layout=layout;doc.entities.push(e);}delete doc.blocks[name];\n    }\n    for(const e of doc.entities) {\n        const owner=get(graphicalTags(e._dxf?.raw||[]),330);\n        if(layoutByOwner.has(key(owner)))e.layout=layoutByOwner.get(key(owner));\n        if(e.type==='VIEWPORT') {\n            e.frozenLayers=(e.frozenLayerHandles||[]).map(h=>layerNames.get(key(h))).filter(Boolean);\n            const d=e.viewDirection;\n            if((e.viewportFlags&7)||Math.abs(d?.x||0)>1e-9||Math.abs(d?.y||0)>1e-9||(d?.z??1)<=0)doc.importDiagnostics.push({severity:'warning',type:'VIEWPORT',message:'Perspective, tilted and depth-clipped viewport contents are not rendered; native fields remain available.'});\n        }\n    }\n    doc.layouts=[...new Set(['Model',...Object.keys(doc.layoutSettings),...doc.entities.map(e=>e.layout||'Model')])].sort((a,b)=>a==='Model'?-1:b==='Model'?1:(doc.layoutSettings[a]?.tabOrder||0)-(doc.layoutSettings[b]?.tabOrder||0));\n    let variable='';for(const [c,v]of sections.HEADER||[]){if(c===9)variable=v;else if(variable==='$INSUNITS'&&c===70)doc.insunits=v;}\n    // Application metadata is an XRECORD, so binary DXF need not depend on 999 comments.\n    const root=objects.find(r=>get(r,0)==='DICTIONARY' && key(get(graphicalTags(r),330,'0'))==='0');\n    const entry=root?.findIndex(p=>p[0]===3&&p[1]==='CONDUITCAD_METADATA');\n    if(entry>=0) {\n        const h=root[entry+1]?.[1],rec=objects.find(r=>key(get(r,5))===key(h)&&get(r,0)==='XRECORD');\n        if(rec)try{const value=JSON.parse(all(subclassTags(rec,'AcDbXrecord'),1).join(''));for(const k of ['parameters','constraints','metadata'])if(value[k]!==undefined)doc[k]=value[k];}catch{doc.importDiagnostics.push({severity:'warning',message:'Invalid Conduit XRECORD metadata.'});}\n    }\n}\n\n/** ACAD/DSTYLE data uses dimvar IDs followed by correctly typed XDATA values. */\nfunction readDimensionOverrides(raw) {\n    const names=new Map(Object.entries(DIMSTYLE_FIELDS).map(([k,c])=>[c,k]));\n    const result={};let app='',active=false;\n    for(let i=0;i<raw.length;i++) {\n        const [c,v]=raw[i];\n        if(c===1001){app=v;active=false;}\n        if(app!=='ACAD')continue;\n        if(c===1000&&v==='DSTYLE'&&raw[i+1]?.[0]===1002&&raw[i+1][1]==='{'){active=true;i++;continue;}\n        if(active&&c===1002&&v==='}'){active=false;continue;}\n        if(active&&c===1070&&raw[i+1]) {\n            const [type,value]=raw[++i],name=names.get(v);\n            if(name&&type===(v===3||v===4?1000:v>=40&&v<=48||v>=140&&v<=148?1040:1070))result[name]=value;\n        }\n    }\n    return result;\n}\nfunction writeDimensionOverrides(style,pair) {\n    const entries=Object.entries(style||{}).filter(([k])=>DIMSTYLE_FIELDS[k]!==undefined);\n    if(!entries.length)return;\n    pair(1001,'ACAD');pair(1000,'DSTYLE');pair(1002,'{');\n    for(const [name,value]of entries) {\n        const code=DIMSTYLE_FIELDS[name],type=code===3||code===4?1000:code>=40&&code<=48||code>=140&&code<=148?1040:1070;\n        if(type!==1000&&(!Number.isFinite(value)||type===1070&&!Number.isInteger(value)))throw new Error('Invalid dimension override '+name);\n        pair(1070,code);pair(type,value);\n    }\n    pair(1002,'}');\n}\n\nreturn {subclassTags,graphicalTags,DIMSTYLE_FIELDS,readInteropEntity,writeInteropEntity,readDocumentInterop,readDimensionOverrides,writeDimensionOverrides};\n})();\n// packages/dxf/src/structure.js\n__modules[\"packages/dxf/src/structure.js\"]=(()=>{\nconst {splitSections, splitRecords, writeAsciiTags} = __modules[\"packages/dxf/src/codec.js\"];\nconst {DIMSTYLE_FIELDS} = __modules[\"packages/dxf/src/interop.js\"];\nconst get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;\nconst set=(r,c,v)=>{const i=r.findIndex(p=>p[0]===c);if(i<0)r.push([c,v]);else r[i]=[c,v];};\nconst handle=r=>String(get(r,get(r,0)==='DIMSTYLE'?105:5,'')).toUpperCase();\n/** Normalize table ownership and the layout database, never guessing foreign handles. */\nfunction completeDXFStructure(pairs,doc,version,{includeMetadata=true}={}) {\n    const sections=splitSections(pairs), tables=splitRecords(sections.TABLES||[]), entities=splitRecords(sections.ENTITIES||[]),blocks=splitRecords(sections.BLOCKS||[]);\n    let seed=0x100n;\n    for(const r of [...tables,...entities,...blocks])if(/^[\\dA-F]+$/.test(handle(r)))seed=seed>BigInt('0x'+handle(r))?seed:BigInt('0x'+handle(r))+1n;\n    const next=()=>{const h=seed.toString(16).toUpperCase();seed++;return h;};\n    const tableMap=new Map();let current=null;\n    for(const r of tables) {\n        if(get(r,0)==='TABLE') {current={header:r,records:[]};tableMap.set(get(r,2),current);}\n        else if(get(r,0)==='ENDTAB')current=null;\n        else if(current)current.records.push(r);\n    }\n    function ensureTable(name) {\n        if(!tableMap.has(name))tableMap.set(name,{header:[[0,'TABLE'],[2,name],[5,next()],[330,'0'],[100,'AcDbSymbolTable'],[70,0]],records:[]});\n        return tableMap.get(name);\n    }\n    const styleTable=ensureTable('STYLE'),styles=new Map(styleTable.records.map(r=>[get(r,2),handle(r)]));\n    for(const name of ['VPORT','VIEW','UCS','DIMSTYLE','APPID'])ensureTable(name);\n    const dim=ensureTable('DIMSTYLE');\n    set(dim.header,100,'AcDbSymbolTable');dim.header.push([100,'AcDbDimStyleTable'],[71,0]);\n    for(const [name,style]of Object.entries({STANDARD:{},...doc.dimstyles})) {\n        const r=[[0,'DIMSTYLE'],[105,next()],[330,handle(dim.header)],[100,'AcDbSymbolTableRecord'],[100,'AcDbDimStyleTableRecord'],[2,name],[70,0]];\n        for(const [k,c]of Object.entries(DIMSTYLE_FIELDS))if(style[k]!==undefined)r.push([c,style[k]]);\n        if(styles.get('STANDARD'))r.push([340,styles.get('STANDARD')]);\n        dim.records.push(r);\n    }\n    const app=ensureTable('APPID');\n    if(!app.records.some(r=>get(r,2)==='ACAD'))app.records.push([[0,'APPID'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbRegAppTableRecord'],[2,'ACAD'],[70,0]]);\n    const layouts=[...new Set(['Model',...(doc.layouts||[]),...doc.entities.map(e=>e.layout||'Model')])];\n    if(layouts.length===1)layouts.push('Layout1');\n    const br=ensureTable('BLOCK_RECORD'), brMap=new Map(br.records.map(r=>[get(r,2),r]));\n    const definitions=new Map();let block;\n    for(const r of blocks) {\n        if(get(r,0)==='BLOCK'){block={begin:r,entities:[],end:null};definitions.set(get(r,2),block);}\n        else if(get(r,0)==='ENDBLK'){if(block)block.end=r;block=null;}\n        else if(block)block.entities.push(r);\n    }\n    const layoutBlocks=new Map();let paper=0;\n    for(const name of layouts) {\n        const blockName=name==='Model'?'*Model_Space':paper++===0?'*Paper_Space':`*Paper_Space${paper-1}`;\n        let record=brMap.get(blockName);\n        if(!record){record=[[0,'BLOCK_RECORD'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,blockName],[70,0],[280,1],[281,0]];br.records.push(record);brMap.set(blockName,record);}\n        if(!definitions.has(blockName))definitions.set(blockName,{begin:[[0,'BLOCK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockBegin'],[2,blockName],[70,0],[10,0],[20,0],[30,0],[3,blockName],[1,'']],entities:[],end:[[0,'ENDBLK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockEnd']]});\n        layoutBlocks.set(name,record);\n    }\n    // Only top-level records get layout owners; ATTRIB/VERTEX/SEQEND keep entity owners.\n    let lastLayout='Model';\n    const activePaper=layouts.find(l=>l!=='Model'), modelEntities=[];\n    for(const r of entities) {\n        const type=get(r,0),child=['VERTEX','ATTRIB','SEQEND'].includes(type);\n        const name=child?lastLayout:get(r,410,get(r,67,0)?activePaper:'Model');\n        if(!child){lastLayout=name;set(r,330,handle(layoutBlocks.get(name)||layoutBlocks.get('Model')));}\n        if(name!=='Model'&&name!==activePaper)definitions.get(get(layoutBlocks.get(name),2)).entities.push(r);\n        else modelEntities.push(r);\n    }\n    const root=next(),layoutDictionary=next(),groupDictionary=next();\n    const rootRecord=[[0,'DICTIONARY'],[5,root],[330,'0'],[100,'AcDbDictionary'],[281,1],[3,'ACAD_LAYOUT'],[350,layoutDictionary],[3,'ACAD_GROUP'],[350,groupDictionary]];\n    const layoutRecord=[[0,'DICTIONARY'],[5,layoutDictionary],[330,root],[100,'AcDbDictionary'],[281,1]],objects=[rootRecord,layoutRecord,[[0,'DICTIONARY'],[5,groupDictionary],[330,root],[100,'AcDbDictionary'],[281,1]]];\n    for(let i=0;i<layouts.length;i++) {\n        const name=layouts[i],h=next(),record=layoutBlocks.get(name),s=doc.layoutSettings?.[name]||{},w=s.paperWidth??420,height=s.paperHeight??297;\n        layoutRecord.push([3,name],[350,h]);set(record,340,h);\n        objects.push([[0,'LAYOUT'],[5,h],[330,layoutDictionary],[100,'AcDbPlotSettings'],[1,''],[2,''],[4,''],[6,''],[40,0],[41,0],[42,0],[43,0],[44,w],[45,height],[46,0],[47,0],[48,0],[49,0],[140,0],[141,0],[142,1],[143,1],[70,0],[72,s.paperUnits??1],[73,s.rotation??0],[74,5],[7,''],[75,16],[76,0],[77,0],[78,300],[147,1],[148,0],[149,0],[100,'AcDbLayout'],[1,name],[70,1],[71,i],[10,0],[20,0],[11,w],[21,height],[12,0],[22,0],[32,0],[14,0],[24,0],[34,0],[15,w],[25,height],[35,0],[146,0],[13,0],[23,0],[33,0],[16,1],[26,0],[36,0],[17,0],[27,1],[37,0],[76,0],[330,handle(record)]]);\n    }\n    if(includeMetadata) {\n        const h=next(),value=JSON.stringify({parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata}).replace(/[\\u007f-\\uffff]/g,c=>'\\\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));\n        rootRecord.push([3,'CONDUITCAD_METADATA'],[350,h]);\n        const r=[[0,'XRECORD'],[5,h],[330,root],[100,'AcDbXrecord'],[280,1]];\n        for(let i=0;i<value.length;i+=200)r.push([1,value.slice(i,i+200)]);objects.push(r);\n    }\n    for(const t of tableMap.values()) {\n        set(t.header,70,t.records.length);\n        const h=handle(t.header);for(const r of t.records)set(r,330,h);\n    }\n    const header=sections.HEADER||[];\n    const headerSet=(name,c,value)=>{const i=header.findIndex(p=>p[0]===9&&p[1]===name);if(i<0)header.push([9,name],[c,value]);else header[i+1]=[c,value];};\n    headerSet('$HANDSEED',5,seed.toString(16).toUpperCase());headerSet('$DWGCODEPAGE',3,'ANSI_1252');headerSet('$CLAYER',8,'0');headerSet('$TILEMODE',70,1);\n    const out=[];\n    const section=(name,content)=>{out.push([0,'SECTION'],[2,name]);for(const p of content)out.push(p);out.push([0,'ENDSEC']);};\n    section('HEADER',header);\n    section('TABLES',[...tableMap.values()].flatMap(t=>[...t.header,...t.records.flat(),[0,'ENDTAB']]));\n    section('BLOCKS',[...definitions.values()].flatMap(b=>[...b.begin,...b.entities.flat(),...(b.end||[])]));\n    section('ENTITIES',modelEntities.flat());section('OBJECTS',objects.flat());out.push([0,'EOF']);\n    return writeAsciiTags(out,{version});\n}\n\nreturn {completeDXFStructure};\n})();\n// packages/dxf/src/preservation.js\n__modules[\"packages/dxf/src/preservation.js\"]=(()=>{\nconst {splitSections, splitRecords, writeAsciiTags} = __modules[\"packages/dxf/src/codec.js\"];\nconst {graphicalTags} = __modules[\"packages/dxf/src/interop.js\"];\nconst copy = v => JSON.parse(JSON.stringify(v));\nconst key = h => String(h??'').toUpperCase();\nconst get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;\nconst stable = value => {\n    if(Array.isArray(value))return value.map(stable);\n    if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));\n    return value;\n};\nconst same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));\nconst cleanEntity=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['_dxf','dirty'].includes(k)));\nconst state=doc=>({units:doc.units,insunits:doc.insunits,parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata,layers:doc.layers,blocks:doc.blocks,linetypes:doc.linetypes,linetypeScale:doc.linetypeScale,signedLinetypes:doc.signedLinetypes,textStyles:doc.textStyles,dimstyles:doc.dimstyles,layouts:doc.layouts,layoutSettings:doc.layoutSettings,rawSections:doc.rawSections,source:doc.source});\n/** Capture an immutable-by-convention, serializable source database and semantic baseline.\n * The original input remains a separate exact-byte export path. */\nfunction capturePreservation(doc,pairs) {\n    if(!pairs)throw new Error('Source tags required for DXF preservation');\n    doc._dxfPreservation={pairs:copy(pairs),state:copy(state(doc)),entities:doc.entities.map(e=>({id:e.id,handle:e._dxf?.handle,raw:copy(e._dxf?.raw||[]),value:copy(cleanEntity(e))}))};\n}\nfunction inspectDXFGraph(doc) {\n    const source=doc._dxfPreservation?.pairs;\n    if(!source)return {nodes:[],diagnostics:[]};\n    const nodes=[],diagnostics=[],handles=new Set();\n    for(const [section,pairs]of Object.entries(splitSections(source)))for(const tags of splitRecords(pairs)) {\n        const type=get(tags,0);if(!type)continue;\n        const identity=get(tags,type==='DIMSTYLE'?105:5);if(!identity)continue;\n        const h=key(identity);\n        if(!/^[0-9A-F]{1,16}$/.test(h))diagnostics.push({severity:'error',message:`Invalid handle ${h}`});\n        if(handles.has(h))diagnostics.push({severity:'error',message:`Duplicate handle ${h}`});handles.add(h);\n        const references=[];\n        for(let i=0;i<tags.length;i++) {\n            const [code,v]=tags[i];\n            if((code>=320&&code<=369)||(code>=390&&code<=399)||code===480||code===481||code===1005)if(key(v)!=='0')references.push({code,target:key(v),index:i});\n        }\n        nodes.push({handle:h,type,section,references,tags:copy(tags)});\n    }\n    for(const node of nodes)for(const r of node.references)if(!handles.has(r.target))diagnostics.push({severity:'warning',code:r.code,message:`${node.handle} references missing handle ${r.target}`});\n    return {nodes,diagnostics};\n}\nconst EDITS = {\n    LINE:{a:10,b:11},CIRCLE:{c:10,r:40},ARC:{c:10,r:40,start:50,end:51},\n    POINT:{p:10},TEXT:{p:10,alignPoint:11,text:1,height:40,rotation:50,widthFactor:41,oblique:51},\n    MTEXT:{p:10,height:40,mtextWidth:41}\n};\n/** Safe edits are deliberately a whitelist. Unknown dependency semantics never get guessed. */\nfunction writePreservedDXF(doc,{version=doc.importVersion}={}) {\n    const saved=doc._dxfPreservation;\n    if(!saved)throw new Error('This document has no preserved DXF source');\n    if(version!==doc.importVersion)throw new Error('Record-preserving export requires the original DXF version');\n    if(!same(state(doc),saved.state))throw new Error('Record-preserving export cannot merge changed tables, blocks, metadata, layouts or source sections');\n    if(doc.entities.length!==saved.entities.length)throw new Error('Record-preserving export rejects added or deleted entities');\n    const graph=inspectDXFGraph(doc);\n    if(graph.diagnostics.some(d=>d.severity==='error'))throw new Error('Source object graph contains invalid or duplicate handles');\n    const incoming=new Set(graph.nodes.flatMap(n=>n.references.map(r=>r.target)));\n    const replacements=new Map();\n    for(let i=0;i<doc.entities.length;i++) {\n        const e=doc.entities[i],before=saved.entities[i],after=cleanEntity(e);\n        if(e.id!==before.id||key(e._dxf?.handle)!==key(before.handle)||!same(e._dxf?.raw||[],before.raw))throw new Error('Record-preserving export rejects changed entity order, identity or raw records');\n        if(same(after,before.value))continue;\n        if(!before.handle || incoming.has(key(before.handle)))throw new Error('Entity has incoming references; dependency-sensitive edits require a native evaluator');\n        if(before.raw.some(([c])=>c===102||c>=1000))throw new Error('Extended entity semantics make this edit unsafe to merge');\n        const fields=EDITS[e.type];if(!fields)throw new Error(`Record-preserving edits are not implemented for ${e.type}`);\n        const changed=[...new Set([...Object.keys(after),...Object.keys(before.value)])].filter(k=>!same(after[k],before.value[k]));\n        if(changed.some(k=>!(k in fields)))throw new Error(`Unmapped record-preserving edit: ${changed.filter(k=>!(k in fields)).join(', ')}`);\n        const raw=copy(before.raw), scope=graphicalTags(raw);\n        const set=(code,v)=>{const positions=[];for(let j=0;j<raw.length;j++)if(raw[j][0]===code)positions.push(j);if(positions.length>1)throw new Error(`Ambiguous source field ${code}`);if(positions.length)raw[positions[0]]=[code,v];else {const last=raw.findIndex(p=>p[0]>=1000);raw.splice(last<0?raw.length:last,0,[code,v]);}};\n        for(const name of changed) {\n            const c=fields[name],value=after[name];\n            if(value===undefined)throw new Error('Removing a native field is not a safe preserving edit');\n            if(typeof value==='object') {\n                if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(value.z??0))throw new Error('Invalid preserved point');\n                set(c,value.x);set(c+10,value.y);if(scope.some(p=>p[0]===c+20)||(value.z??0)!==0)set(c+20,value.z??0);\n            } else {if(['r','height','widthFactor'].includes(name)&&!(value>0))throw new Error('Invalid preserved size');set(c,['start','end'].includes(name)?value*180/Math.PI:value);}\n        }\n        replacements.set(key(before.handle),raw);\n    }\n    const records=splitRecords(saved.pairs);\n    const result=records.flatMap(r=>replacements.get(key(get(r,5)))||r);\n    return writeAsciiTags(result,{version});\n}\n\nreturn {capturePreservation,inspectDXFGraph,writePreservedDXF};\n})();\n// packages/dxf/src/fidelity.js\n__modules[\"packages/dxf/src/fidelity.js\"]=(()=>{\n/** DXF entity fidelity helpers. Native values remain native: OCS coordinates,\n * signed linetype elements and hatch edge records are not flattened on import.\n * Autodesk DXF reference links and explicit limitations: docs/DXF_COMPATIBILITY.md.\n */\nconst get = (r, c, fallback = 0) => r.find(p => p[0] === c)?.[1] ?? fallback;\nconst point = (r, c = 10) => ({ x: +get(r, c), y: +get(r, c + 10), z: +get(r, c + 20) });\nconst all = (r, c) => r.filter(p => p[0] === c).map(p => p[1]);\nconst rad = d => d * Math.PI / 180;\nfunction count(n, limit = 100000) {\n    if (!Number.isSafeInteger(n) || n < 0 || n > limit) throw new Error('Invalid DXF collection length: ' + n);\n    return n;\n}\nfunction parseHatchData(raw) {\n    let i = raw.findIndex(p => p[0] === 91);\n    if (i < 0) return { loops: [], patternLines: [] };\n    const read = (code, fallback) => {\n        if (raw[i]?.[0] === code) return raw[i++][1];\n        if (fallback !== undefined) return fallback;\n        throw new Error(`Malformed HATCH: expected group ${code}, got ${raw[i]?.[0]}`);\n    };\n    const p2 = (c = 10) => ({ x: +read(c), y: +read(c + 10) });\n    const loops = [], n = count(+read(91));\n    for (let k = 0; k < n; k++) {\n        const flags = +read(92), loop = { flags, closed: true, points: [], edges: [] };\n        if (flags & 2) {\n            const bulge = +read(72); loop.closed = !!read(73);\n            const vertices = count(+read(93));\n            for (let j = 0; j < vertices; j++) {\n                const p = p2(); if (bulge || raw[i]?.[0] === 42) p.bulge = +read(42, 0);\n                loop.points.push(p);\n            }\n        } else {\n            const edges = count(+read(93));\n            for (let j = 0; j < edges; j++) {\n                const type = +read(72); let edge;\n                if (type === 1) edge = { type, a: p2(), b: p2(11) };\n                else if (type === 2 || type === 3) {\n                    edge = { type, c: p2() };\n                    if (type === 3) edge.major = p2(11);\n                    edge[type === 2 ? 'r' : 'ratio'] = +read(40);\n                    edge.start = rad(+read(50)); edge.end = rad(+read(51)); edge.ccw = !!read(73);\n                    if (!edge.ccw) { edge.start = 2*Math.PI-edge.start; edge.end = 2*Math.PI-edge.end; }\n                } else if (type === 4) {\n                    edge = { type, degree: +read(94), rational: !!read(73), periodic: !!read(74) };\n                    const knots = count(+read(95)), controls = count(+read(96));\n                    edge.knots = Array.from({ length: knots }, () => +read(40));\n                    edge.controlPoints = []; edge.weights = [];\n                    for (let q = 0; q < controls; q++) {\n                        edge.controlPoints.push(p2());\n                        if (edge.rational) edge.weights.push(+read(42, 1));\n                    }\n                    // Group 97 here is spline fit data; the later 97 belongs to the path.\n                    const fits = count(+read(97, 0));\n                    edge.fitPoints = Array.from({ length: fits }, () => p2(11));\n                    if (raw[i]?.[0] === 12) edge.startTangent = p2(12);\n                    if (raw[i]?.[0] === 13) edge.endTangent = p2(13);\n                } else throw new Error('Unsupported HATCH edge type ' + type);\n                loop.edges.push(edge);\n            }\n        }\n        const refs = count(+read(97, 0));\n        loop.sourceHandles = Array.from({ length: refs }, () => String(read(330)));\n        loops.push(loop);\n    }\n    const tail = raw.slice(i), patternLines = [];\n    const hatchStyle = +get(tail, 75), patternType = +get(tail, 76, 1);\n    const pstart = tail.findIndex(p => p[0] === 78);\n    if (pstart >= 0) {\n        i += pstart;\n        const lines = count(+read(78), 1024);\n        for (let k = 0; k < lines; k++) {\n            const angle = rad(+read(53)), base = { x: +read(43), y: +read(44) }, offset = { x: +read(45), y: +read(46) };\n            const n = count(+read(79), 1024);\n            patternLines.push({ angle, base, offset, dashes: Array.from({ length: n }, () => +read(49)) });\n        }\n    }\n    return { loops, hatchStyle, patternType, patternAngle: +get(tail, 52), patternScale: +get(tail, 41, 1), patternDouble: !!get(tail, 77),\n        elevation: +get(raw, 30), associative: !!get(raw, 71), patternLines,\n        gradient: +get(tail, 450) ? tail.slice(tail.findIndex(p => p[0] === 450)).filter(p => p[0] < 1000) : null };\n}\nfunction readEntityFidelity(e, raw, diagnostics, options = {}) {\n    e.extrusion = { x: +get(raw, 210), y: +get(raw, 220), z: +get(raw, 230, 1) };\n    e.thickness = +get(raw, 39); e.linetypeScale = +get(raw, 48, 1);\n    e.transparency = get(raw, 440, null);\n    if (e.transparency !== null && (e.transparency & 0x02000000)) e.opacity = (e.transparency & 255) / 255;\n    if (e.type === 'LWPOLYLINE' || e.type === 'VERTEX') {\n        e.elevation = +get(raw, 38); let p = -1;\n        for (const [c, v] of raw) {\n            if (c === 10) p++;\n            if ((c === 40 || c === 41) && p >= 0) {\n                const q = e.points?.[p] || e.p;\n                if (q) q[c === 40 ? 'startWidth' : 'endWidth'] = +v;\n            }\n        }\n    }\n    if (e.type === 'POLYLINE') { e.elevation = +get(raw, 30); e.startWidth = +get(raw, 40); e.endWidth = +get(raw, 41); }\n    if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(e.type)) {\n        e.styleName = String(get(raw, 7, 'STANDARD')); e.oblique = +get(raw, 51);\n        e.textFlags = e.type === 'MTEXT' ? 0 : +get(raw, 71);\n        if (e.type === 'MTEXT') {\n            e.widthFactor = 1; // Group 41 is the reference box width, never an X-scale.\n            e.attachment = +get(raw, 71, 1); e.lineSpacing = +get(raw, 44, 1); e.lineSpacingStyle = +get(raw, 73, 1);\n            e.backgroundFill = +get(raw, 90); e.backgroundScale = +get(raw, 45, 1.5);\n            const start = raw.findIndex(p => p[0] === 100 && p[1] === 'AcDbMText');\n            const common = start >= 0 ? raw.slice(0, start) : raw, content = start >= 0 ? raw.slice(start) : [];\n            const bg = get(content, 421, get(content, 420, null));\n            e.backgroundColor = bg === null ? '#ffffff' : '#' + (Number(bg) & 0xffffff).toString(16).padStart(6, '0');\n            const fg = get(common, 420, null);\n            if (fg === null && bg !== null && +get(common, 62, 256) === 256) delete e.color;\n            const directionIndex = raw.findIndex(p => p[0] === 11), angleIndex = raw.findIndex(p => p[0] === 50);\n            // Wire DXF angle groups are degrees; callers can explicitly opt into the APP-radians convention.\n            if (angleIndex > directionIndex && !get(raw, 75)) e.rotation = +raw[angleIndex][1] * (options.mtextRotationUnit === 'radians' ? 180 / Math.PI : 1);\n            if (+get(raw, 75) || +get(raw, 72) === 3) diagnostics.push({ severity: 'warning', type: e.type, message: 'MTEXT columns/vertical flow preserved in source; displayed as a single horizontal text box.' });\n        } else {\n            e.halign = +get(raw, 72); e.valign = +get(raw, e.type === 'TEXT' ? 73 : 74);\n            if (raw.some(p => p[0] === 11)) e.alignPoint = point(raw, 11);\n        }\n    }\n    if (e.type === 'HATCH') {\n        Object.assign(e, parseHatchData(raw));\n        if (e.gradient && ((get(e.gradient,470,'LINEAR')!=='LINEAR') || +get(e.gradient,461,0)!==0 || e.gradient.filter(p=>p[0]===421).length!==2)) diagnostics.push({ severity: 'warning', type: 'HATCH', message: 'This gradient distribution is retained but not rendered; the preview supports unshifted two-stop LINEAR gradients.' });\n    }\n    if (e.type === '3DFACE') { e.points = [point(raw), point(raw, 11), point(raw, 12), point(raw, 13)]; e.edgeFlags = +get(raw, 70); }\n    if (e.type === 'LEADER') {\n        e.points = []; let p;\n        for (const [c, v] of raw) { if (c === 10) { p = { x: +v, y: 0, z: 0 }; e.points.push(p); } else if (p && c === 20) p.y = +v; else if (p && c === 30) p.z = +v; }\n        e.arrow = !!get(raw, 71, 1); e.spline = !!get(raw, 72); e.dimstyle = get(raw, 3, 'STANDARD');\n        if (e.spline) diagnostics.push({ severity: 'warning', type: e.type, message: 'Spline leader retained; displayed using its control polygon.' });\n    }\n    if (e.type === 'RAY' || e.type === 'XLINE') { e.p = point(raw); e.direction = point(raw, 11); }\n}\nfunction writeHatchData(e, pair) {\n    const p2 = (c, p) => { pair(c, p.x); pair(c + 10, p.y); };\n    pair(100, 'AcDbHatch'); pair(10, 0); pair(20, 0); pair(30, e.elevation || 0);\n    pair(210, e.extrusion?.x || 0); pair(220, e.extrusion?.y || 0); pair(230, e.extrusion?.z ?? 1);\n    pair(2, e.pattern || (e.solid ? 'SOLID' : 'USER')); pair(70, e.solid ? 1 : 0); pair(71, 0);\n    pair(91, e.loops?.length || 0);\n    for (const loop of e.loops || []) {\n        const native = !!loop.edges?.length;\n        pair(92, native ? (loop.flags || 0) & ~2 : (loop.flags || 0) | 2);\n        if (native) {\n            pair(93, loop.edges.length);\n            for (const edge of loop.edges) {\n                pair(72, edge.type);\n                if (edge.type === 1) { p2(10, edge.a); p2(11, edge.b); }\n                else if (edge.type === 2 || edge.type === 3) {\n                    p2(10, edge.c); if (edge.type === 3) p2(11, edge.major);\n                    pair(40, edge.type === 2 ? edge.r : edge.ratio); pair(50, (edge.ccw === false ? 2*Math.PI-edge.start : edge.start) * 180 / Math.PI); pair(51, (edge.ccw === false ? 2*Math.PI-edge.end : edge.end) * 180 / Math.PI); pair(73, edge.ccw === false ? 0 : 1);\n                } else if (edge.type === 4) {\n                    pair(94, edge.degree); pair(73, edge.rational ? 1 : 0); pair(74, edge.periodic ? 1 : 0);\n                    pair(95, edge.knots.length); pair(96, edge.controlPoints.length);\n                    edge.knots.forEach(v => pair(40, v));\n                    edge.controlPoints.forEach((p, j) => { p2(10, p); if (edge.rational) pair(42, edge.weights?.[j] ?? 1); });\n                    pair(97, edge.fitPoints?.length || 0); (edge.fitPoints || []).forEach(p => p2(11, p));\n                    if (edge.startTangent) p2(12, edge.startTangent); if (edge.endTangent) p2(13, edge.endTangent);\n                } else throw new Error('Unsupported HATCH edge export ' + edge.type);\n            }\n        } else {\n            const points = loop.points || [], bulges = points.some(p => p.bulge);\n            pair(72, bulges ? 1 : 0); pair(73, loop.closed === false ? 0 : 1); pair(93, points.length);\n            for (const p of points) { p2(10, p); if (bulges) pair(42, p.bulge || 0); }\n        }\n        pair(97, 0); // Detached boundary references cannot safely reference regenerated handles.\n    }\n    pair(75, e.hatchStyle || 0); pair(76, e.patternType ?? 1);\n    if (!e.solid) {\n        pair(52, e.patternAngle || 0); pair(41, e.patternScale || 1); pair(77, e.patternDouble ? 1 : 0);\n        pair(78, e.patternLines?.length || 0);\n        for (const line of e.patternLines || []) {\n            pair(53, line.angle * 180 / Math.PI); pair(43, line.base.x); pair(44, line.base.y); pair(45, line.offset.x); pair(46, line.offset.y);\n            pair(79, line.dashes?.length || 0); for (const d of line.dashes || []) pair(49, d);\n        }\n    }\n    pair(98, 0); for (const p of e.gradient || []) pair(...p);\n}\n\nreturn {parseHatchData,readEntityFidelity,writeHatchData};\n})();\n// packages/dxf/src/index.js\n__modules[\"packages/dxf/src/index.js\"]=(()=>{\nconst {dimensionPicture, evaluateDynamicBlock} = __modules[\"packages/model/src/index.js\"];\nconst {readAsciiTags, readBinaryTags, writeBinaryTags, splitSections, decodeCodePage, decodeTextEscapes} = __modules[\"packages/dxf/src/codec.js\"];\nconst {readInteropEntity, writeInteropEntity, readDocumentInterop, graphicalTags, readDimensionOverrides, writeDimensionOverrides} = __modules[\"packages/dxf/src/interop.js\"];\nconst {completeDXFStructure} = __modules[\"packages/dxf/src/structure.js\"];\nconst {capturePreservation, writePreservedDXF, inspectDXFGraph} = __modules[\"packages/dxf/src/preservation.js\"];\nconst {readEntityFidelity, writeHatchData} = __modules[\"packages/dxf/src/fidelity.js\"];\nconst {createDocument, entity, uid, cleanText, clone, entityGeometry} = __modules[\"packages/model/src/index.js\"];\nconst {TAU, arcPoints} = __modules[\"packages/geometry/src/index.js\"];\n// Default ACI modelspace palette, verified against ezdxf 1.4.4.\n// ACI 7 follows this application's light canvas. Palette data attribution: THIRD_PARTY_NOTICES.md.\nconst ACI_PALETTE = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 10813440, 10834514, 8323072, 8339263, 4980736, 4990502, 2490368, 2495251, 16727808, 16752511, 10823936, 10839890, 8331008, 8343359, 4985600, 4992806, 2492672, 2496275, 16744192, 16760703, 10834432, 10845266, 8339200, 8347455, 4990464, 4995366, 2495232, 2497555, 16760576, 16768895, 10845184, 10850642, 8347392, 8351551, 4995328, 4997670, 2497536, 2498835, 16776960, 16777087, 10855680, 10855762, 8355584, 8355647, 5000192, 5000230, 2500096, 2500115, 12582656, 14679935, 8168704, 9545042, 6258432, 7307071, 3755008, 4344870, 1844736, 2172435, 8388352, 12582783, 5416192, 8168786, 4161280, 6258495, 2509824, 3755046, 1254912, 1844755, 4194048, 10485631, 2729216, 6792530, 2064128, 5209919, 1264640, 3099686, 599552, 1517075, 65280, 8388479, 42240, 5416274, 32512, 4161343, 19456, 2509862, 9728, 1254931, 65343, 8388511, 42281, 5416295, 32543, 4161359, 19475, 2509871, 9737, 1267735, 65407, 8388543, 42322, 5416316, 32575, 4161375, 19494, 2509881, 9747, 1267740, 65471, 8388575, 42364, 5416337, 32607, 4161391, 19513, 2509890, 9756, 1267800, 65535, 8388607, 42405, 5416357, 32639, 4161407, 19532, 2509900, 9766, 1267800, 49151, 8380415, 31909, 5411237, 24447, 4157311, 14668, 2507390, 7206, 1267800, 32767, 8372223, 21157, 5405861, 16255, 4153215, 9804, 2505086, 4902, 1252440, 16383, 8364031, 10661, 5400485, 8063, 4149119, 4940, 2502526, 2342, 1251160, 255, 8355839, 165, 5395109, 127, 4145023, 76, 2500222, 38, 1250136, 4129023, 10452991, 2687141, 6771365, 2031743, 5193599, 1245260, 3090046, 589862, 1512280, 8323327, 12550143, 5374117, 8147621, 4128895, 6242175, 2490444, 3745406, 1245222, 1839960, 12517631, 14647295, 8126629, 9523877, 6226047, 7290751, 3735628, 4335180, 1835046, 5772120, 16711935, 16744447, 10813605, 10834597, 8323199, 8339327, 4980812, 4990540, 2490406, 5772120, 16711871, 16744415, 10813564, 10834577, 8323167, 8339311, 4980793, 4990530, 2490396, 5772120, 16711807, 16744383, 10813522, 10834556, 8323135, 8339295, 4980774, 4990521, 2490387, 5772060, 16711743, 16744351, 10813481, 10834535, 8323103, 8339279, 4980755, 4990511, 2490377, 5772055, 0, 6645093, 6710886, 10066329, 13421772, 16777215];\nfunction aciColor(index) {\n    index = Math.abs(Math.trunc(index));\n    if (index === 7)\n        return '#000000';\n    return '#' + (ACI_PALETTE[index] ?? 0).toString(16).padStart(6, '0');\n}\nfunction parseAsciiPairs(source, options = {}) { return readAsciiTags(source, options); }\nfunction parseBinaryPairs(input, options = {}) { return readBinaryTags(input, options); }\nfunction inspectObjectGraph(doc) { return inspectDXFGraph(doc); }\nfunction writeDXFBinary(doc, options = {}) {\n    const version=options.version || (options.mode==='preserve' ? doc.importVersion : 'AC1024');\n    return writeBinaryTags(readAsciiTags(writeDXF(doc,{...options,version})),{version});\n}\nconst get = (r, c, d = undefined) => decodeTextEscapes(r.find(x => x[0] === c)?.[1] ?? d);\nconst all = (r, c) => r.filter(x => x[0] === c).map(x => x[1]);\nconst pt = (r, c = 10) => ({ x: Number(get(r, c, 0)), y: Number(get(r, c + 10, 0)), z: Number(get(r, c + 20, 0)) });\nconst points = (r, c = 10) => {\n    const p = [];\n    let current;\n    for (const [code, v] of r) {\n        if (code === c) {\n            current = { x: Number(v), y: 0 };\n            p.push(current);\n        }\n        else if (current && code === c + 10)\n            current.y = Number(v);\n        else if (current && code === c + 20)\n            current.z = Number(v);\n        else if (current && code === 42 && c === 10)\n            current.bulge = Number(v);\n    }\n    return p;\n};\nconst records = pairs => {\n    const result = [];\n    let r = [];\n    for (const pair of pairs) {\n        if (pair[0] === 0 && r.length) {\n            result.push(r);\n            r = [];\n        }\n        r.push(pair);\n    }\n    if (r.length)\n        result.push(r);\n    return result;\n};\nfunction metadata(raw) {\n    let active = false, s = '';\n    for (const [c, v] of raw) {\n        if (c === 1001)\n            active = v === 'CONDUITCAD';\n        else if (active && c === 1000)\n            s += v;\n    }\n    if (!s)\n        return {};\n    try {\n        const data = JSON.parse(s);\n        return data && typeof data === 'object' ? data : {};\n    }\n    catch {\n        return {};\n    }\n}\nfunction parseEntity(original, diagnostics, options = {}) {\n    const raw = graphicalTags(original);\n    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw: original, handle: get(raw, 5) }, dirty: false };\n    const aci = Number(get(raw, 62, 256)), trueColor = get(raw, 420);\n    e.colorIndex = aci; e.colorMode = trueColor === undefined ? 'aci' : 'truecolor';\n    if (trueColor !== undefined)\n        e.color = '#' + Number(trueColor).toString(16).padStart(6, '0');\n    else if (aci === 0)\n        e.color = 'BYBLOCK';\n    else if (aci !== 256)\n        e.color = aciColor(aci);\n    e.lineweight = Number(get(raw, 370, -1));\n    e.linetype = get(raw, 6, 'BYLAYER');\n    if (get(raw, 60, 0) || aci < 0)\n        e.hidden = true;\n    switch (type) {\n        case 'LINE':\n            e.a = pt(raw);\n            e.b = pt(raw, 11);\n            break;\n        case 'LWPOLYLINE':\n            e.points = points(raw);\n            e.closed = !!(get(raw, 70, 0) & 1);\n            e.constantWidth = get(raw, 43, 0);\n            break;\n        case 'POLYLINE':\n            e.points = [];\n            e.closed = !!(get(raw, 70, 0) & 1);\n            e.flags = get(raw, 70, 0); e.mCount = +get(raw,71,0); e.nCount = +get(raw,72,0);\n            break;\n        case 'CIRCLE':\n        case 'ARC':\n            e.c = pt(raw);\n            e.r = Number(get(raw, 40, 1));\n            if (type === 'ARC') {\n                e.start = Number(get(raw, 50, 0)) * Math.PI / 180;\n                e.end = Number(get(raw, 51, 360)) * Math.PI / 180;\n            }\n            break;\n        case 'ELLIPSE':\n            e.c = pt(raw);\n            e.major = pt(raw, 11);\n            e.ratio = Number(get(raw, 40, 1));\n            e.start = Number(get(raw, 41, 0));\n            e.end = Number(get(raw, 42, TAU));\n            break;\n        case 'SPLINE':\n            e.degree = Number(get(raw, 71, 3));\n            e.controlPoints = points(raw);\n            e.fitPoints = points(raw, 11);\n            e.knots = all(raw, 40).map(Number);\n            e.weights = all(raw, 41).map(Number);\n            e.closed = !!(get(raw, 70, 0) & 1);\n            break;\n        case 'POINT':\n            e.p = pt(raw);\n            break;\n        case 'TEXT':\n        case 'MTEXT':\n        case 'ATTRIB':\n        case 'ATTDEF':\n            e.p = pt(raw);\n            e.text = type === 'MTEXT' ? decodeTextEscapes(all(raw, 3).join('') + (raw.find(p=>p[0]===1)?.[1] ?? '')) : get(raw, 1, '');\n            e.height = Number(get(raw, 40, 12));\n            e.rotation = Number(get(raw, 50, 0));\n            e.align = get(raw, 72, 0) === 1 ? 'center' : get(raw, 72, 0) === 2 ? 'right' : 'left';\n            if (type === 'MTEXT') {\n                const a = Number(get(raw, 71, 1));\n                e.align = [2, 5, 8].includes(a) ? 'center' : [3, 6, 9].includes(a) ? 'right' : 'left';\n                if (get(raw, 11) !== undefined)\n                    e.rotation = Math.atan2(get(raw, 21, 0), get(raw, 11, 1)) * 180 / Math.PI;\n                e.mtextWidth = get(raw, 41, 0);\n            }\n            if (['ATTRIB', 'ATTDEF'].includes(type)) {\n                e.attributeTag = get(raw, 2, '');\n                e.attributeFlags = Number(get(raw, 70, 0));e.constant=!!(e.attributeFlags&2);\n                if(type==='ATTDEF')e.prompt=get(raw,3,'');\n                e.invisible = !!(get(raw, 70, 0) & 1);\n            }\n            e.widthFactor = Number(get(raw, 41, 1));\n            break;\n        case 'INSERT':\n            e.block = get(raw, 2, '');\n            e.x = get(raw, 10, 0);\n            e.y = get(raw, 20, 0);\n            e.z = get(raw, 30, 0);\n            e.sx = get(raw, 41, 1);\n            e.sy = get(raw, 42, 1);\n            e.sz = get(raw, 43, 1);\n            e.rotation = get(raw, 50, 0);\n            e.columns = get(raw, 70, 1);\n            e.rows = get(raw, 71, 1);\n            e.columnSpacing = get(raw, 44, 0);\n            e.rowSpacing = get(raw, 45, 0);\n            e.attributes = [];\n            break;\n        case 'SOLID':\n        case 'TRACE':\n        case '3DFACE':\n            e.points = [pt(raw, 10), pt(raw, 11), pt(raw, 13), pt(raw, 12)];\n            break;\n        case 'HATCH':\n            e.loops = [];\n            e.solid = !!get(raw, 70, 0);\n            e.pattern = get(raw, 2, 'SOLID');\n            break;\n        case 'DIMENSION':\n            e.block = get(raw, 2);\n            e.a = pt(raw, 13);\n            e.b = pt(raw, 14);\n            e.text = get(raw, 1, '<>');\n            break;\n        case 'VERTEX':\n            e.p = pt(raw);\n            e.p.bulge = get(raw, 42, 0);\n            e.p.startWidth = get(raw, 40, 0); e.p.endWidth = get(raw, 41, 0);\n            e.vertexFlags=+get(raw,70,0); e.faceIndices=[71,72,73,74].map(c=>+get(raw,c,0)).filter(Boolean);\n            break;\n        case 'LEADER':\n        case 'RAY':\n        case 'XLINE':\n        case 'SEQEND':\n        case 'VIEWPORT':\n        case 'WIPEOUT':\n        case 'MESH':\n        case 'HELIX': break;\n        default:\n            e.unsupported = true;\n            diagnostics.push({ severity: 'warning', type, message: `${type}: retained in original source; no editable display implementation.` });\n    }\n    readInteropEntity(e, raw);\n    if(type==='DIMENSION')e.dimstyleOverrides=readDimensionOverrides(original);\n    const meta = metadata(original);\n    if (typeof meta.id === 'string' && meta.id.length <= 160)\n        e.id = meta.id;\n    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource', 'calculation'])\n        if (k in meta)\n            e[k] = meta[k];\n    readEntityFidelity(e, raw, diagnostics, options);\n    if(type === 'MTEXT') {\n        const pos=raw.findIndex(p=>p[0]===100&&p[1]==='AcDbMText');\n        if(pos>=0) { const common=raw.slice(0,pos), value=get(common,420), index=+get(common,62,256);\n            e.colorMode = value===undefined ? 'aci' : 'truecolor';\n            if(value!==undefined)e.color='#'+(+value&0xffffff).toString(16).padStart(6,'0');\n            else if(index===256)delete e.color; else e.color=index===0?'BYBLOCK':aciColor(index);\n        }\n    }\n    return e;\n}\nfunction base64(bytes) {\n    let s = '';\n    for (let i = 0; i < bytes.length; i += 8192)\n        s += String.fromCharCode(...bytes.subarray(i, i + 8192));\n    return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');\n}\nfunction parseDXF(input, options = {}) {\n    let rawText = '', pairs, source;\n    const bytes = typeof input === 'string' ? null : input instanceof Uint8Array ? input : new Uint8Array(input);\n    if (bytes && bytes.byteLength > 128 * 1024 * 1024)\n        throw new Error('File exceeds the 128 MiB import safety limit');\n    const binary = bytes && new TextDecoder().decode(bytes.subarray(0, 18)) === 'AutoCAD Binary DXF';\n    if (binary) {\n        pairs = parseBinaryPairs(bytes, options);\n        source = { format: 'binary', base64: base64(bytes) };\n    }\n    else {\n        if (bytes) {\n            let enc = options.encoding;\n            const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 65536));\n            if (!enc) {\n                const ver = prefix.match(/\\$ACADVER\\s*\\r?\\n\\s*1\\s*\\r?\\n\\s*(AC\\d+)/)?.[1];\n                const cp = prefix.match(/ANSI_(\\d+)/)?.[1];\n                enc = ver && Number(ver.slice(2)) >= 1021 ? 'utf-8' : decodeCodePage('ANSI_' + (cp || '1252'));\n            }\n            rawText = new TextDecoder(enc, {fatal:true}).decode(bytes);\n            source = {format:'ascii',base64:base64(bytes),encoding:enc};\n        }\n        else\n            rawText = String(input);\n        pairs = parseAsciiPairs(rawText, options);\n        source = bytes ? source : { format: 'ascii', text: rawText };\n    }\n    const doc = createDocument(options.name || 'Imported DXF');\n    doc.blocks = Object.create(null); doc.layers = []; doc.textStyles = Object.create(null); doc.linetypes = Object.assign(Object.create(null), { CONTINUOUS: [] }); doc.signedLinetypes = true;\n    doc.source = source;\n    doc.rawSections = Object.create(null);\n    doc.importDiagnostics = [];\n    const sections = splitSections(pairs);\n    if (!sections.ENTITIES && !sections.BLOCKS)\n        throw new Error('DXF contains neither ENTITIES nor BLOCKS sections');\n    const header = sections.HEADER || [];\n    let key = '';\n    for (const [c, v] of header) {\n        if (c === 9)\n            key = String(v);\n        else if (key === '$INSUNITS' && c === 70)\n            doc.units = ({ 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' })[v] || 'unitless';\n        else if (key === '$LTSCALE' && c === 40) doc.linetypeScale = v;\n        else if (key === '$ACADVER')\n            doc.importVersion = v;\n    }\n    let table = '';\n    for (const r of records(sections.TABLES || [])) {\n        const t = get(r, 0);\n        if (t === 'TABLE')\n            table = get(r, 2);\n        else if (t === 'ENDTAB')\n            table = '';\n        else if (table === 'LAYER' && t === 'LAYER') {\n            const n = get(r, 2, '0'), aci = Number(get(r, 62, 7));\n            doc.layers.push({ name: n, colorIndex:Math.abs(aci), colorMode:get(r,420)===undefined?'aci':'truecolor', color: get(r, 420) !== undefined ? '#' + Number(get(r, 420)).toString(16).padStart(6, '0') : aciColor(Math.abs(aci)), visible: aci >= 0 && !(get(r, 70, 0) & 1), locked: !!(get(r, 70, 0) & 4), linetype: get(r, 6, 'CONTINUOUS'), lineweight: +get(r, 370, -3) });\n        }\n        else if (table === 'LTYPE' && t === 'LTYPE')\n            doc.linetypes[get(r, 2, 'CONTINUOUS')] = all(r, 49).map(Number);\n        else if (table === 'STYLE' && t === 'STYLE')\n            doc.textStyles[get(r, 2, 'STANDARD')] = { font: get(r, 3, 'sans-serif'), bigFont: get(r, 4, ''), height: +get(r, 40, 0), widthFactor: +get(r, 41, 1), oblique: +get(r, 50, 0), flags: +get(r, 71, 0) };\n    }\n    if (!doc.layers.length)\n        doc.layers.push({ name: '0', color: '#344755', visible: true, locked: false });\n    const parseList = rs => {\n        const es = [];\n        let poly = null, insert = null;\n        for (const raw of rs) {\n            const e = parseEntity(raw, doc.importDiagnostics, options);\n            if (e.type === 'VERTEX' && poly) {\n                if ((poly.flags & 64) && e.faceIndices.length) { poly.faces ??= []; poly.faces.push(e.faceIndices); }\n                else poly.points.push(e.p);\n                continue;\n            }\n            if (e.type === 'ATTRIB' && insert) {\n                insert.attributes.push(e);\n                continue;\n            }\n            if (e.type === 'SEQEND') {\n                poly = null;\n                insert = null;\n                continue;\n            }\n            poly = e.type === 'POLYLINE' ? e : null;\n            insert = e.type === 'INSERT' ? e : null;\n            es.push(e);\n        }\n        for (const e of es)\n            if (e.type === 'INSERT' && e.tag)\n                e.attributes = e.attributes.filter(a => !(a.attributeTag === 'TAG' && a.text === e.tag));\n        return es;\n    };\n    let block = null, blockRecords = [];\n    for (const raw of records(sections.BLOCKS || [])) {\n        const t = get(raw, 0);\n        if (t === 'BLOCK') {\n            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], flags: +get(raw,70,0), ports: metadata(raw).ports || [], symbol: metadata(raw).symbol, dynamic: metadata(raw).dynamic, parameters: metadata(raw).parameters, constraints: metadata(raw).constraints, revision: metadata(raw).revision, dynamicInstance: metadata(raw).dynamicInstance, dimensionPicture: metadata(raw).dimensionPicture };\n            blockRecords = [];\n        }\n        else if (t === 'ENDBLK') {\n            if (block) {\n                block.entities = parseList(blockRecords);\n                doc.blocks[block.name] = block;\n            }\n            block = null;\n        }\n        else if (block)\n            blockRecords.push(raw);\n    }\n    doc.entities = parseList(records(sections.ENTITIES || []));\n    const seen = new Set();\n    for (const e of doc.entities) {\n        if (seen.has(e.id))\n            e.id = uid();\n        seen.add(e.id);\n        if (!doc.layers.some(l => l.name.toUpperCase() === e.layer.toUpperCase()))\n            doc.layers.push({ name: e.layer, color: '#344755', visible: true, locked: false });\n        if (!doc.layouts.includes(e.layout))\n            doc.layouts.push(e.layout);\n    }\n    const metaComments = all(header, 999).filter(s => String(s).startsWith('CONDUIT:')).map(s => String(s).slice(8)).join('');\n    if (metaComments) {\n        try {\n            const m = JSON.parse(metaComments);\n            doc.parameters = m.parameters || doc.parameters;\n            doc.constraints = m.constraints || [];\n            doc.metadata = m.metadata || doc.metadata;\n        }\n        catch {\n            doc.importDiagnostics.push({ severity: 'warning', message: 'Conduit header metadata could not be decoded.' });\n        }\n    }\n    readDocumentInterop(doc,sections);\n    const unsupported = doc.entities.filter(e => e.unsupported).length;\n    doc.importDiagnostics.unshift({ severity: 'info', message: `${doc.entities.length} model/layout entities, ${Object.keys(doc.blocks).length} blocks, ${doc.layers.length} layers; ${unsupported} unsupported entities.` });\n    for (const [name, p] of Object.entries(sections))\n        if (!['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(name))\n            doc.rawSections[name] = p;\n    doc.importDiagnostics.push({ severity: 'info', message: 'Original input remains available unchanged. Edited DXF export normalizes supported planar entities; normalized export rebuilds represented objects. Record-preserving export retains foreign graphs but rejects unsafe edits.' });\n    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {\n        if(e.type==='INSERT' && e.dynamicSource && doc.blocks[e.dynamicSource]?.dynamic)e.block=e.dynamicSource;\n    }\n    capturePreservation(doc,pairs);\n    return doc;\n}\n/** Remove only unreachable app-generated evaluation pictures in normalized copies. */\nfunction pruneGeneratedPictures(document) {\n    const blocks={...document.blocks},candidates=new Set(Object.entries(blocks).filter(([name,b])=>b.dynamicInstance||b.dimensionPicture).map(([name])=>name));\n    const keep=new Set(),queue=[];\n    const visit=e=>{if(e.type==='INSERT'||e.type==='DIMENSION'&&e.dimension?.version!==1){if(e.block&&!keep.has(e.block)){keep.add(e.block);queue.push(e.block);}}};\n    document.entities.forEach(visit);\n    for(const [name,b]of Object.entries(blocks))if(!candidates.has(name))(b.entities||[]).forEach(visit);\n    for(let i=0;i<queue.length;i++)(blocks[queue[i]]?.entities||[]).forEach(visit);\n    for(const name of candidates)if(!keep.has(name))delete blocks[name];\n    return {...document,blocks};\n}\nfunction prepareDynamicBlocks(document) {\n    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()},cache=new Map();let serial=0;\n    const bake=(e,stack=[])=>{\n        if(e.type!=='INSERT')return e;\n        const master=doc.blocks[e.block];if(!master)return e;\n        if(stack.includes(e.block))throw new Error('Cyclic dynamic block nesting');\n        if(stack.length>24)throw new Error('Dynamic block nesting limit exceeded');\n        if(!master.dynamic)return e;\n        const key=JSON.stringify([e.block,e.dynamicParameters||{}]);let name=cache.get(key);\n        if(!name){\n            const evaluated=evaluateDynamicBlock(master,e.dynamicParameters||{});\n            do{name='*UCC'+(++serial);}while(doc.blocks[name]);\n            cache.set(key,name);\n            doc.blocks[name]={...evaluated,name,entities:evaluated.entities.filter(c=>!c.hidden).map(c=>bake(c,[...stack,e.block])),dynamicInstance:{master:e.block,values:evaluated.dynamicValues}};\n        }\n        return {...e,block:name,dynamicSource:e.block};\n    };\n    doc.entities=doc.entities.map(e=>bake(e));\n    // Static parents may contain dynamic references. Retain each original master for metadata-aware editors.\n    for(const [name,b]of Object.entries(document.blocks))if(!b.dynamic)doc.blocks[name]={...b,entities:(b.entities||[]).map(e=>bake(e))};\n    return doc;\n}\nfunction prepareNativeDimensions(document) {\n    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()};let serial=0;\n    const prepare=e=>{\n        if(e.type!=='DIMENSION'||(e.block&&doc.blocks[e.block]&&e.dimension?.version!==1))return e;\n        const picture=dimensionPicture(e,doc);\n        let name;do{name='*DCC'+(++serial);}while(doc.blocks[name]);\n        doc.blocks[name]={name,base:{x:0,y:0},entities:picture.entities,dimensionPicture:{version:1,ownerId:e.id}};\n        return {...e,block:name,dimtype:(e.dimtype??33)|32,definitionPoint:picture.definitionPoint,textMidpoint:picture.textMidpoint,measurement:picture.measurement,dimstyleOverrides:picture.style};\n    };\n    doc.entities=doc.entities.map(prepare);for(const [name,b]of Object.entries(document.blocks))doc.blocks[name]={...b,entities:(b.entities||[]).map(prepare)};\n    return doc;\n}\nfunction asciiJson(data) { return JSON.stringify(data).replace(/[\\u007f-\\uffff]/g, c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); }\n/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */\nfunction writeDXF(doc, options = {}) {\n    const { version = options.mode==='preserve' ? doc.importVersion || 'AC1024' : 'AC1024', includeMetadata = true, mode = 'normalized', strict = false } = options;\n    if(mode === 'preserve')return writePreservedDXF(doc,{version});\n    if(mode !== 'normalized')throw new Error('Unknown DXF export mode');\n    if(strict && exportReport(doc).warnings.length)throw new Error(exportReport(doc).warnings.join(' '));\n    doc = prepareNativeDimensions(prepareDynamicBlocks(pruneGeneratedPictures(doc)));\n    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {\n        if(e.type==='MESH' && version<'AC1024')throw new Error('MESH requires DXF R2010 or newer');\n        if(e.type==='HELIX' && version<'AC1021')throw new Error('HELIX requires DXF R2007 or newer');\n        if(e.gradient && version<'AC1018')throw new Error('Gradient HATCH requires DXF R2004 or newer');\n    }\n    if (!['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'].includes(version))\n        throw new Error('Supported export versions: R2000–R2018');\n    const out = [];\n    // Normalized output allocates new handles; never convert a 64-bit source\n    // handle to Number (incrementing a rounded value can otherwise loop forever).\n    let handle = 0x100;\n    const next = () => (handle++).toString(16).toUpperCase();\n    const nativeHandles=new WeakMap(), sourceHandles=new Map(), layerHandles=new Map();\n    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) { const h=next(); nativeHandles.set(e,h);if(e._dxf?.handle)sourceHandles.set(String(e._dxf.handle).toUpperCase(),h); }\n    const pair = (c, v) => {\n        if (typeof v === 'number' && !Number.isFinite(v))\n            throw new Error(`Nonfinite DXF value for code ${c}`);\n        let s = typeof v === 'number' ? String(v) : String(v ?? '');\n        s = s.replace(/\\r?\\n/g, '\\\\P');\n        if (Number(version.slice(2)) < 1021)\n            s = s.replace(/[\\u007f-\\uffff]/g, c => '\\\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));\n        out.push(String(c), s);\n    };\n    const pp = (c, p) => { pair(c, p?.x || 0); pair(c + 10, p?.y || 0); pair(c + 20, p?.z || 0); };\n    const meta = data => {\n        if (!includeMetadata || !Object.keys(data).length)\n            return;\n        pair(1001, 'CONDUITCAD');\n        const s = asciiJson(data);\n        // Leave room for group/app overhead within the native 16 KiB XDATA limit.\n        if(s.length>15000)throw new Error('Conduit metadata exceeds the safe DXF XDATA budget; save the native project or export without metadata.');\n        for (let i = 0; i < s.length; i += 200)\n            pair(1000, s.slice(i, i + 200));\n    };\n    const section = name => { pair(0, 'SECTION'); pair(2, name); };\n    const end = () => pair(0, 'ENDSEC');\n    section('HEADER');\n    pair(9, '$ACADVER');\n    pair(1, version);\n    pair(9, '$INSUNITS');\n    const knownUnits = { 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };\n    const unitCode = doc.insunits !== undefined && (knownUnits[doc.insunits] || 'unitless') === doc.units ? doc.insunits : ({ unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 })[doc.units] ?? 4;\n    pair(70, unitCode);\n    pair(9, '$LTSCALE'); pair(40, doc.linetypeScale || 1);\n    pair(9, '$MEASUREMENT');\n    pair(70, doc.units === 'in' || doc.units === 'ft' ? 0 : 1);\n    if (includeMetadata) {\n        const s = asciiJson({ parameters: doc.parameters, constraints: doc.constraints, metadata: doc.metadata });\n        for (let i = 0; i < s.length; i += 180)\n            pair(999, 'CONDUIT:' + s.slice(i, i + 180));\n    }\n    end();\n    section('TABLES');\n    pair(0, 'TABLE');\n    pair(2, 'LTYPE');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, 1);\n    pair(0, 'LTYPE');\n    pair(5, next());\n    pair(100, 'AcDbSymbolTableRecord');\n    pair(100, 'AcDbLinetypeTableRecord');\n    pair(2, 'CONTINUOUS');\n    pair(70, 0);\n    pair(3, 'Solid line');\n    pair(72, 65);\n    pair(73, 0);\n    pair(40, 0);\n    const types = { ...doc.linetypes };\n    for (const e of [...doc.entities, ...Object.values(doc.blocks).flatMap(b=>b.entities || [])])\n        if (e.dash?.length)\n            types['CC_DASH_' + e.dash.join('_')] = e.dash;\n    for (const [name, pattern] of Object.entries(types)) {\n        if (name === 'CONTINUOUS' || !pattern.length)\n            continue;\n        pair(0, 'LTYPE');\n        pair(5, next());\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbLinetypeTableRecord');\n        pair(2, name);\n        pair(70, 0);\n        pair(3, name);\n        pair(72, 65);\n        pair(73, pattern.length);\n        pair(40, pattern.reduce((a, b) => a + Math.abs(b), 0));\n        pattern.forEach((v, i) => { pair(49, doc.signedLinetypes && !name.startsWith('CC_DASH_') ? v : Math.abs(v) * (i % 2 ? -1 : 1)); pair(74, 0); });\n    }\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'LAYER');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, doc.layers.length);\n    for (const l of doc.layers) {\n        pair(0, 'LAYER');\n        const layerHandle=next();layerHandles.set(l.name,layerHandle);pair(5, layerHandle);\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbLayerTableRecord');\n        pair(2, l.name);\n        pair(70, l.locked ? 4 : 0);\n        const layerACI = l.colorMode === 'aci' && l.colorIndex > 0 && l.colorIndex < 256 && aciColor(l.colorIndex).toLowerCase() === l.color?.toLowerCase();\n        pair(62, (l.visible === false ? -1 : 1) * (layerACI ? l.colorIndex : 7));\n        if (!layerACI) pair(420, parseInt((l.color || '#344755').slice(1), 16));\n        pair(6, l.linetype || 'CONTINUOUS');\n        if (l.lineweight !== undefined) pair(370, l.lineweight);\n    }\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'STYLE');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    const textStyles = { ...doc.textStyles };\n    if(!Object.keys(textStyles).some(n=>n.toUpperCase()==='STANDARD'))textStyles.STANDARD={font:'txt',widthFactor:1};\n    pair(70, Object.keys(textStyles).length);\n    for (const [name, style] of Object.entries(textStyles)) {\n        pair(0, 'STYLE'); pair(5, next()); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbTextStyleTableRecord');\n        pair(2, name); pair(70, 0); pair(40, style.height || 0); pair(41, style.widthFactor || 1);\n        pair(50, style.oblique || 0); pair(71, style.flags || 0); pair(42, 2.5); pair(3, style.font || 'txt'); pair(4, style.bigFont || '');\n    }\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'APPID');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, 1);\n    pair(0, 'APPID');\n    pair(5, next());\n    pair(100, 'AcDbSymbolTableRecord');\n    pair(100, 'AcDbRegAppTableRecord');\n    pair(2, 'CONDUITCAD');\n    pair(70, 0);\n    pair(0, 'ENDTAB');\n    pair(0, 'TABLE');\n    pair(2, 'BLOCK_RECORD');\n    pair(5, next());\n    pair(330, '0');\n    pair(100, 'AcDbSymbolTable');\n    pair(70, Object.keys(doc.blocks).length + 2);\n    const blockRecords = Object.create(null);\n    for (const name of ['*Model_Space', '*Paper_Space', ...Object.keys(doc.blocks).filter(n => !['*Model_Space', '*Paper_Space'].includes(n))]) {\n        blockRecords[name] = next();\n        pair(0, 'BLOCK_RECORD');\n        pair(5, blockRecords[name]);\n        pair(100, 'AcDbSymbolTableRecord');\n        pair(100, 'AcDbBlockTableRecord');\n        pair(2, name);\n    }\n    pair(0, 'ENDTAB');\n    end();\n    const header = (e, t = e.type, owner) => {\n        pair(0, t);\n        const emittedHandle = nativeHandles.get(e) || next(); pair(5, emittedHandle);\n        if (owner)\n            pair(330, owner);\n        pair(100, 'AcDbEntity');\n        pair(8, e.layer || '0');\n        if (e.layout && e.layout !== 'Model') {\n            pair(67, 1);\n            pair(410, e.layout);\n        }\n        if (e.color === 'BYBLOCK')\n            pair(62, 0);\n        else if (e.color && e.color !== 'BYLAYER' && e.colorMode==='aci' && e.colorIndex>0 && e.colorIndex<256 && aciColor(e.colorIndex).toLowerCase()===e.color.toLowerCase()) pair(62,e.colorIndex);\n        else if (e.color && e.color !== 'BYLAYER') {\n            pair(62, 7);\n            pair(420, parseInt(e.color.slice(1), 16));\n        }\n        if (e.hidden)\n            pair(60, 1);\n        if (e.opacity !== undefined) pair(440, 0x02000000 | Math.round(255 * Math.max(0, Math.min(1, e.opacity))));\n        else if (e.transparency != null) pair(440, e.transparency);\n        if (e.linetypeScale !== undefined) pair(48, e.linetypeScale);\n        if (e.lineweight !== undefined)\n            pair(370, e.lineweight);\n        if (e.dash?.length)\n            pair(6, 'CC_DASH_' + e.dash.join('_'));\n        else if (e.linetype && e.linetype !== 'BYLAYER')\n            pair(6, e.linetype);\n        return emittedHandle;\n    };\n    const emit = (e, owner) => {\n        if (e.unsupported) {\n            return;\n        } // The original-source download is the lossless preservation path.\n        const type = e.type === 'POLYLINE' && !(e.flags & (8|16|64)) ? 'LWPOLYLINE' : e.type;\n        const entityHandle = header(e, type, owner);\n        const native=e.type==='VIEWPORT'?{...e,clipHandle:e.clipHandle?sourceHandles.get(String(e.clipHandle).toUpperCase()):undefined,frozenLayerHandles:(e.frozenLayers||[]).map(n=>layerHandles.get(n)).filter(Boolean)}:e;\n        if(e.type==='VIEWPORT'&&e.clipHandle&&!native.clipHandle)throw new Error('Cannot export unresolved viewport clipping boundary');\n        if (!writeInteropEntity(native, pair, pp)) switch (type) {\n            case 'POLYLINE':\n                pair(100,(e.flags&64)?'AcDbPolyFaceMesh':(e.flags&16)?'AcDbPolygonMesh':'AcDb3dPolyline');\n                pair(66,1); pp(10,{x:0,y:0,z:e.elevation || 0}); pair(70,(e.flags || 8)|(e.closed?1:0));\n                if(e.flags&16){pair(71,e.mCount || 0);pair(72,e.nCount || 0);}\n                if(e.flags&64){pair(71,e.points.length);pair(72,e.faces?.length || 0);}\n                break;\n            case 'HATCH': writeHatchData(e, pair); break;\n            case 'LEADER':\n                pair(100, 'AcDbLeader'); pair(3, e.dimstyle || 'STANDARD'); pair(71, e.arrow === false ? 0 : 1); pair(72, e.spline ? 1 : 0); pair(73, 3); pair(74, 0); pair(75, 0); pair(76, e.points.length); for (const p of e.points) pp(10, p); break;\n            case 'RAY':\n            case 'XLINE': pair(100, type === 'RAY' ? 'AcDbRay' : 'AcDbXline'); pp(10, e.p); pp(11, e.direction); break;\n            case 'LINE':\n                pair(100, 'AcDbLine');\n                pp(10, e.a);\n                pp(11, e.b);\n                break;\n            case 'LWPOLYLINE':\n                pair(100, 'AcDbPolyline');\n                pair(90, e.points.length);\n                pair(70, e.closed ? 1 : 0);\n                if (e.elevation) pair(38, e.elevation);\n                if (e.constantWidth)\n                    pair(43, e.constantWidth);\n                for (const p of e.points) {\n                    pair(10, p.x);\n                    pair(20, p.y);\n                    if (p.startWidth) pair(40, p.startWidth);\n                    if (p.endWidth) pair(41, p.endWidth);\n                    if (p.bulge)\n                        pair(42, p.bulge);\n                }\n                break;\n            case 'CIRCLE':\n            case 'ARC':\n                pair(100, 'AcDbCircle');\n                pp(10, e.c);\n                pair(40, e.r);\n                if (type === 'ARC') {\n                    pair(100, 'AcDbArc');\n                    pair(50, (e.clockwise ? e.end : e.start) * 180 / Math.PI);\n                    pair(51, (e.clockwise ? e.start : e.end) * 180 / Math.PI);\n                }\n                break;\n            case 'ELLIPSE':\n                pair(100, 'AcDbEllipse');\n                pp(10, e.c);\n                pp(11, e.major);\n                pair(40, e.ratio);\n                pair(41, e.start || 0);\n                pair(42, e.end ?? TAU);\n                break;\n            case 'SPLINE':\n                pair(100, 'AcDbSpline');\n                pair(70, ((e.splineFlags || 0) & ~5) | (e.closed ? 1 : 0) | (e.weights?.length ? 4 : 0));\n                pair(71, e.degree);\n                pair(72, e.knots.length);\n                pair(73, e.controlPoints.length);\n                pair(74, e.fitPoints?.length || 0);\n                for (const v of e.knots)\n                    pair(40, v);\n                for (const v of e.weights || [])\n                    pair(41, v);\n                for (const p of e.controlPoints)\n                    pp(10, p);\n                for (const p of e.fitPoints || [])\n                    pp(11, p);\n                break;\n            case 'TEXT':\n            case 'ATTRIB':\n            case 'ATTDEF':\n                pair(100, 'AcDbText');\n                pp(10, e.p);\n                pair(40, e.height || 12);\n                pair(1, e.text || '');\n                pair(50, e.rotation || 0);\n                pair(41, e.widthFactor || 1);\n                pair(7, e.styleName || 'STANDARD');\n                if (e.oblique) pair(51, e.oblique); if (e.textFlags) pair(71, e.textFlags);\n                if (e.halign || e.valign || (e.align && e.align !== 'left')) {\n                    pair(72, e.halign ?? (e.align === 'center' ? 1 : e.align === 'right' ? 2 : 0));\n                    pp(11, e.alignPoint || e.p);\n                }\n                if (type === 'TEXT') { pair(100, 'AcDbText'); pair(73, e.valign || 0); }\n                else {\n                    pair(100, type === 'ATTRIB' ? 'AcDbAttribute' : 'AcDbAttributeDefinition');\n                    pair(2, e.attributeTag || e.tag || 'TAG');\n                    if (type === 'ATTDEF')\n                        pair(3, e.prompt ?? 'Equipment tag');\n                    pair(70, ((e.attributeFlags ?? e.flags ?? 0)&~3) | (e.invisible?1:0) | (e.constant||((e.attributeFlags ?? e.flags ?? 0)&2)?2:0)); pair(74, e.valign || 0);\n                }\n                break;\n            case 'MTEXT': {\n                pair(100, 'AcDbMText'); pp(10, e.p); pair(40, e.height || 12); pair(41, e.mtextWidth || 0);\n                pair(71, e.attachment || (e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1)); pair(7, e.styleName || 'STANDARD');\n                const value = String(e.text || '').replace(/\\r?\\n/g, '\\\\P');\n                const chunks=[];let chunk='',size=0;const encoder=new TextEncoder();\n                for(const char of value){const bytes=Number(version.slice(2))<1021?char.split('').reduce((n,c)=>n+(c.charCodeAt(0)>127?7:1),0):encoder.encode(char).length;if(size+bytes>250){chunks.push(chunk);chunk='';size=0;}chunk+=char;size+=bytes;}\n                chunks.push(chunk);chunks.forEach((v,i)=>pair(i===chunks.length-1?1:3,v));\n                const a = (e.rotation || 0) * Math.PI / 180; pp(11, { x: Math.cos(a), y: Math.sin(a) });\n                pair(73, e.lineSpacingStyle || 1); pair(44, e.lineSpacing || 1);\n                if (e.backgroundFill) { pair(90, e.backgroundFill); pair(45, e.backgroundScale || 1.5); pair(63, 7); if (e.backgroundColor) pair(421, parseInt(e.backgroundColor.slice(1), 16)); }\n                break;\n            }\n            case 'POINT':\n                pair(100, 'AcDbPoint');\n                pp(10, e.p);\n                break;\n            case 'SOLID':\n            case 'TRACE':\n            case '3DFACE':\n                pair(100, type === '3DFACE' ? 'AcDbFace' : 'AcDbTrace');\n                if (type === '3DFACE') pair(70, e.edgeFlags || 0);\n                for (const [i, j] of (type === '3DFACE' ? [[0, 0], [1, 1], [2, 2], [3, 3]] : [[0, 0], [1, 1], [2, 3], [3, 2]]))\n                    pp(10 + i, e.points[j] || e.points.at(-1));\n                break;\n            case 'DIMENSION':\n                pair(100, 'AcDbDimension');\n                pair(2, e.block);\n                pp(10, e.a);\n                pair(70, 32);\n                pair(1, e.text || '<>');\n                pair(100, 'AcDbAlignedDimension');\n                pp(13, e.a);\n                pp(14, e.b);\n                break;\n            case 'INSERT': {\n                pair(100, 'AcDbBlockReference');\n                pair(2, e.block);\n                pp(10, { x: e.x, y: e.y, z: e.z });\n                pair(41, e.sx ?? 1);\n                pair(42, e.sy ?? 1);\n                pair(43, e.sz ?? 1);\n                pair(50, e.rotation || 0);\n                if (e.columns > 1) {\n                    pair(70, e.columns);\n                    pair(44, e.columnSpacing || 0);\n                }\n                if (e.rows > 1) {\n                    pair(71, e.rows);\n                    pair(45, e.rowSpacing || 0);\n                }\n                if (e.attributes?.length || e.tag)\n                    pair(66, 1);\n                break;\n            }\n        }\n        if (e.type !== 'HATCH' && e.extrusion) pp(210, e.extrusion);\n        if (e.thickness) pair(39, e.thickness);\n        const m = {};\n        if (e.id)\n            m.id = e.id;\n        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource', 'calculation'])\n            if (e[k] !== undefined)\n                m[k] = e[k];\n        if(e.type==='DIMENSION')writeDimensionOverrides(e.dimstyleOverrides,pair);\n        meta(m);\n        if (type === 'POLYLINE') {\n            for (const p of e.points || []) {\n                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbVertex');\n                pair(100,(e.flags&64)?'AcDbPolyFaceMeshVertex':(e.flags&16)?'AcDbPolygonMeshVertex':'AcDb3dPolylineVertex');\n                pp(10,p);pair(70,(e.flags&64)?192:(e.flags&16)?64:32);\n            }\n            for (const face of e.faces || []) {\n                header({layer:e.layer},'VERTEX',entityHandle);pair(100,'AcDbFaceRecord');pp(10,{x:0,y:0,z:0});pair(70,128);\n                face.forEach((n,i)=>pair(71+i,n));\n            }\n            header({layer:e.layer},'SEQEND',entityHandle);\n        }\n        if (type === 'INSERT' && (e.attributes?.length || e.tag)) {\n            for (const a of e.attributes || [])\n                emit(a, entityHandle);\n            if (e.tag) {\n                const block = doc.blocks[e.block], offset = block?.symbol?.labelOffset || 55;\n                emit({ type: 'ATTRIB', p: { x: e.x, y: e.y - Math.abs((e.sy ?? 1) * offset) }, text: e.tag, height: e.tagHeight || 12, align: 'center', attributeTag: 'TAG', layer: e.layer }, entityHandle);\n            }\n            pair(0, 'SEQEND');\n            pair(5, next());\n            pair(330, entityHandle);\n            pair(100, 'AcDbEntity');\n            pair(8, e.layer || '0');\n        }\n    };\n    section('BLOCKS');\n    for (const name of Object.keys(blockRecords)) {\n        const b = doc.blocks[name] || { base: { x: 0, y: 0 }, entities: [] };\n        pair(0, 'BLOCK');\n        pair(5, next());\n        pair(330, blockRecords[name]);\n        pair(100, 'AcDbEntity');\n        pair(8, '0');\n        pair(100, 'AcDbBlockBegin');\n        pair(2, name);\n        pair(70, name.startsWith('*') ? 1 : 0);\n        pp(10, b.base);\n        pair(3, name);\n        pair(1, '');\n        meta({ ports: b.ports || [], symbol: b.symbol, dynamic: b.dynamic, parameters: b.parameters, constraints: b.constraints, revision: b.revision, dynamicInstance: b.dynamicInstance, dimensionPicture: b.dimensionPicture });\n        for (const e of b.entities)\n            emit(e, blockRecords[name]);\n        pair(0, 'ENDBLK');\n        pair(5, next());\n        pair(330, blockRecords[name]);\n        pair(100, 'AcDbEntity');\n        pair(8, '0');\n        pair(100, 'AcDbBlockEnd');\n    }\n    end();\n    section('ENTITIES');\n    for (const e of doc.entities)\n        emit(e, blockRecords[e.layout && e.layout !== 'Model' ? '*Paper_Space' : '*Model_Space']);\n    end();\n    pair(0, 'EOF');\n    return completeDXFStructure(readAsciiTags(out.join('\\r\\n')+'\\r\\n'), doc, version, {includeMetadata});\n}\nfunction exportReport(doc) {\n    const entities=[...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])],unsupported=entities.filter(e=>e.unsupported);\n    return {format:'ASCII or binary DXF R2000–R2018',unsupported:unsupported.map(e=>({id:e.id,type:e.type})),warnings:[\n        ...(unsupported.length?[`${unsupported.length} unsupported entities omitted from normalized export (including block contents). Use record-preserving or original DXF export.`]:[]),\n        ...(entities.some(e=>e.type==='HATCH'&&e.associative)?['Hatch associations are detached in normalized export.']:[]),\n        ...(entities.some(e=>e._dxf?.raw?.some(p=>p[0]===1001&&p[1]!=='CONDUITCAD'))?['Foreign application XDATA is retained only by record-preserving export.']:[]),\n        ...(Object.keys(doc.rawSections||{}).length?['Foreign OBJECTS/CLASSES sections are rebuilt, not merged, in normalized export. Record-preserving mode retains original graphs and refuses unsafe changes.']:[])\n    ],originalAvailable:!!doc.source,preservationAvailable:!!doc._dxfPreservation};\n}\n\nreturn {aciColor,parseAsciiPairs,parseBinaryPairs,inspectObjectGraph,writeDXFBinary,parseDXF,writeDXF,exportReport};\n})();\n// apps/studio/dxf-worker.js\n__modules[\"apps/studio/dxf-worker.js\"]=(()=>{\nconst {parseDXF} = __modules[\"packages/dxf/src/index.js\"];\nself.onmessage = event => {\n    try {\n        const { buffer, name, encoding } = event.data;\n        self.postMessage({ document: parseDXF(buffer, { name, encoding }) });\n    }\n    catch (error) {\n        self.postMessage({ error: error.message || String(error) });\n    }\n};\n\nreturn {};\n})();\n})();\n";
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
    const n=entity.extrusion;
    // OCS data is not WCS. Do not offer incorrect planar snaps on projected planes.
    if(n&&['ARC','CIRCLE','LWPOLYLINE','POLYLINE','SOLID','TRACE','TEXT'].includes(entity.type)&&(Math.abs(n.x||0)>1e-12||Math.abs(n.y||0)>1e-12||Math.abs((n.z??1)-1)>1e-12))return [];
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
        case 'ELLIPSE': {
            const a=entity.major,c=entity.c,r=entity.ratio,n=entity.extrusion||{x:0,y:0,z:1};
            const v={x:(n.y||0)*(a.z||0)-(n.z??1)*a.y,y:(n.z??1)*a.x-(n.x||0)*(a.z||0),z:(n.x||0)*a.y-(n.y||0)*a.x};
            const f=Math.hypot(a.x,a.y,a.z||0)*r/Math.hypot(v.x,v.y,v.z);
            if(!Number.isFinite(f))return [];
            const start=entity.start??0,end=entity.end??TAU,norm=t=>(t%TAU+TAU)%TAU,full=Math.abs(end-start)>=TAU-1e-9;
            const at=t=>({x:c.x+a.x*Math.cos(t)+v.x*f*Math.sin(t),y:c.y+a.y*Math.cos(t)+v.y*f*Math.sin(t)});
            return [{...c,kind:'center'},...[0,Math.PI/2,Math.PI,Math.PI*1.5].filter(t=>full||norm(t-start)<=norm(end-start)+EPS).map(t=>({...at(t),kind:'quadrant'})),...(!full?[{...at(start),kind:'endpoint'},{...at(end),kind:'endpoint'}]:[])];
        }
        case 'SPLINE': {
            const cp=entity.controlPoints||[],knots=entity.knots||[],degree=entity.degree;
            if(cp.length<2||knots.length!==cp.length+degree+1)return [];
            const a=knots[degree],b=knots[cp.length];
            return [a,b].map(t=>({...nurbsPoint(cp,degree,knots,t,entity.weights),kind:'endpoint'}));
        }
        case 'POINT': case 'RAY': case 'XLINE': return [{...entity.p,kind:entity.type==='POINT'?'node':'origin'}];
        case 'TEXT': case 'MTEXT': return [{...entity.p,kind:'insertion'}];
        case 'SOLID': case '3DFACE': case 'LEADER': case 'POLYLINE':
        case 'LWPOLYLINE': return (entity.points||[]).flatMap((p,i)=>{
            const q=entity.points[(i+1)%entity.points.length],closed=entity.closed||['SOLID','3DFACE'].includes(entity.type);
            let midpoint=lerp(p,q,.5);
            if(entity.type==='LWPOLYLINE'&&p.bulge){const arc=bulgeArc(p,q,p.bulge);if(arc){const t=arc.start+arc.sweep/2;midpoint={x:arc.c.x+arc.r*Math.cos(t),y:arc.c.y+arc.r*Math.sin(t)};}}
            return [{...p,kind:'endpoint'},...(i<entity.points.length-1||closed?[{...midpoint,kind:'midpoint'}]:[])];
        });
        case 'INSERT': return [{ x: entity.x, y: entity.y, kind: 'insertion' }];
        default: return [];
    }
}

return {EPS,TAU,clamp,point,add,sub,mul,dot,cross,length,distance,normalize,lerp,almost,equalPoint,identity,transform,matrix,compose,inverse,bounds,emptyBounds,validBounds,inflate,intersects,contains,union,center,projectPoint,distanceToSegment,lineIntersection,segmentIntersectsBox,polygonContains,polygonArea,polylineLength,simplifyOrthogonal,arcPoints,bulgeArc,tessellatePolyline,nurbsPoint,splinePoints,offsetPolyline,filletLines,snapCandidates};
})();
// packages/model/src/dimensions.js
__modules["packages/model/src/dimensions.js"]=(()=>{
const {arcPoints, distance, matrix, transform, TAU} = __modules["packages/geometry/src/index.js"];
const EPS = 1e-9;
const copy = v => JSON.parse(JSON.stringify(v));
const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y});
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
const mul = (a,s) => ({x:a.x*s,y:a.y*s});
const normal = a => ({x:-a.y,y:a.x});
const dot = (a,b) => a.x*b.x+a.y*b.y;
const unit = a => { const l=Math.hypot(a.x,a.y); if(l<EPS)throw new Error('Coincident dimension definition points'); return mul(a,1/l); };
const finite = (v,label) => { if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error(`Invalid dimension ${label}`); return v; };
const point = (p,label) => { if(!p)throw new Error(`Missing dimension ${label}`); finite(p.x,label);finite(p.y,label);if(Math.abs(p.z||0)>EPS)throw new Error('Dimension regeneration currently requires the XY plane at Z=0');return {x:p.x,y:p.y}; };
const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);
const positiveAngle = x => (x%TAU+TAU)%TAU;
const STYLE_KEYS = new Set(['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimdec','dimrnd','dimpost','dimzin','dimdsep']);
const POINT_KEYS = ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'];

/** Declarative dimension picture generator. It never mutates the document. */
function dimensionPicture(e,doc={}) {
    if(e.type!=='DIMENSION')throw new Error('Expected DIMENSION');
    const n=e.extrusion||{x:0,y:0,z:1};
    if(Math.abs(n.x||0)>EPS||Math.abs(n.y||0)>EPS||Math.abs((n.z??1)-1)>EPS)throw new Error('Non-default dimension OCS cannot be regenerated in the planar editor');
    if(e.dimensionInsert && Math.hypot(e.dimensionInsert.x||0,e.dimensionInsert.y||0,e.dimensionInsert.z||0)>EPS)throw new Error('Translated dimension pictures require conversion before regeneration');
    if(e.obliqueAngle || e.horizontalDirection)throw new Error('Oblique or rotated-UCS dimension regeneration is not supported');
    finite(e.dimtype??33,'subtype');if(!Number.isInteger(e.dimtype??33))throw new Error('Dimension subtype must be an integer');
    finite(e.dimensionAngle??0,'angle');
    const type=(e.dimtype??33)&15;
    if(type>6)throw new Error('Unknown dimension subtype');
    const style={dimtxt:e.height||12,dimasz:5,dimexe:5,dimexo:1,dimgap:3,dimscale:1,dimlfac:1,dimdec:1,dimrnd:0,dimpost:'<>',dimzin:0,...doc.dimstyles?.[e.dimstyle||'STANDARD'],...e.dimstyleOverrides,...e.dimension?.style};
    for(const k of ['dimtxt','dimasz','dimexe','dimexo','dimgap','dimscale','dimlfac','dimrnd']) {
        finite(style[k],k); if(style[k]<0)throw new Error(`Dimension ${k} cannot be negative`);
    }
    if(style.dimtxt<=0||style.dimscale<=0||style.dimlfac<=0)throw new Error('Dimension text, scale and measurement factor must be positive');
    if(!Number.isInteger(style.dimdec)||style.dimdec<0||style.dimdec>8)throw new Error('Dimension precision must be an integer from 0 to 8');
    if(typeof style.dimpost!=='string'||style.dimpost.length>1000||!Number.isInteger(style.dimzin)||style.dimzin<0||style.dimzin>15)throw new Error('Invalid dimension text formatting');
    if(style.dimdsep!==undefined&&(!Number.isInteger(style.dimdsep)||style.dimdsep<1||style.dimdsep>255))throw new Error('Invalid dimension decimal separator');
    if(e.text!==undefined&&(typeof e.text!=='string'||e.text.length>1000))throw new Error('Invalid dimension text');
    const scale=style.dimscale,h=style.dimtxt*scale,arrow=style.dimasz*scale,gap=style.dimgap*scale;
    const entities=[];let measurement,definitionPoint=e.definitionPoint,textMidpoint,textRotation=0;
    const put=(type,props) => entities.push({id:`${e.id||'dimension'}:picture:${entities.length}`,type,layer:'0',color:'BYBLOCK',linetype:'CONTINUOUS',...props});
    const line=(a,b) => {if(distance(a,b)>EPS)put('LINE',{a,b});};
    const head=(tip,inside) => {if(!arrow)return;const u=unit(inside),n=normal(u);put('SOLID',{points:[tip,add(tip,add(mul(u,arrow),mul(n,arrow*.28))),add(tip,add(mul(u,arrow),mul(n,-arrow*.28)))]});};
    const extension=(origin,end,outward) => {if(distance(origin,end)>EPS)line(add(origin,mul(outward,style.dimexo*scale)),add(end,mul(outward,style.dimexe*scale)));};
    if(type===0||type===1) {
        const a=point(e.a,'first endpoint'),b=point(e.b,'second endpoint');
        const u=type===0?{x:Math.cos((e.dimensionAngle||0)*Math.PI/180),y:Math.sin((e.dimensionAngle||0)*Math.PI/180)}:unit(sub(b,a)),n=normal(u);
        const off=e.offset!==undefined?finite(e.offset,'offset'):e.definitionPoint?dot(sub(point(e.definitionPoint,'dimension line'),a),n):30;
        const p=add(a,mul(n,off)),q=add(p,mul(u,dot(sub(b,a),u)));
        measurement=Math.abs(dot(sub(b,a),u));if(measurement<EPS)throw new Error('Zero projected dimension length');
        const side=mul(n,off<0?-1:1);extension(a,p,side);extension(b,q,mul(n,dot(sub(q,b),n)<0?-1:1));
        line(p,q);const inside=unit(sub(q,p));head(p,inside);head(q,mul(inside,-1));
        textMidpoint=add(mul(add(p,q),.5),mul(side,gap+h*.5));textRotation=Math.atan2(u.y,u.x)*180/Math.PI;
        if(textRotation>90||textRotation<=-90)textRotation+=180;
        definitionPoint=q;
    } else if(type===3||type===4) {
        const a=point(e.definitionPoint,'radial origin'),b=point(e.defpoint4,'radial endpoint'),u=unit(sub(b,a));
        measurement=distance(a,b);line(a,b);head(b,mul(u,-1));if(type===3)head(a,u);
        const lead=Math.max(0,finite(e.leaderLength??0,'leader length'));
        if(lead>0)line(b,add(b,mul(u,lead)));
        textMidpoint=add(type===3?mul(add(a,b),.5):add(b,mul(u,lead)),mul(normal(u),gap+h*.5));
    } else if(type===2||type===5) {
        let center,a,b,location;
        if(type===5){center=point(e.defpoint4,'angle center');a=point(e.a,'first ray');b=point(e.b,'second ray');location=point(e.definitionPoint,'angle location');}
        else {
            const p=point(e.a,'line 1 start'),q=point(e.b,'line 1 end'),r=point(e.defpoint4,'line 2 start'),s=point(e.definitionPoint,'line 2 end');
            const u=sub(q,p),v=sub(s,r),det=u.x*v.y-u.y*v.x;
            if(Math.abs(det)<EPS)throw new Error('Parallel angular dimension lines');
            const w=sub(r,p),f=(w.x*v.y-w.y*v.x)/det;center=add(p,mul(u,f));
            a=distance(center,q)>EPS?q:p;b=distance(center,s)>EPS?s:r;location=point(e.defpoint5,'angle location');
        }
        let start=angle(center,a),end=angle(center,b),sweep=positiveAngle(end-start),loc=positiveAngle(angle(center,location)-start);
        if(loc>sweep+EPS){[a,b]=[b,a];[start,end]=[end,start];sweep=positiveAngle(end-start);}
        if(sweep<EPS)throw new Error('Zero angular dimension');
        const radius=distance(center,location);if(radius<EPS)throw new Error('Angular dimension arc must have a positive radius');
        const p=add(center,{x:Math.cos(start)*radius,y:Math.sin(start)*radius}),q=add(center,{x:Math.cos(start+sweep)*radius,y:Math.sin(start+sweep)*radius});
        extension(a,p,unit(sub(p,center)));extension(b,q,unit(sub(q,center)));
        put('ARC',{c:center,r:radius,start,end:start+sweep});head(p,{x:-Math.sin(start),y:Math.cos(start)});head(q,{x:Math.sin(end),y:-Math.cos(end)});
        const mid=start+sweep/2;textMidpoint=add(center,{x:Math.cos(mid)*(radius+gap+h*.5),y:Math.sin(mid)*(radius+gap+h*.5)});measurement=sweep*180/Math.PI;
    } else {
        const origin=point(e.definitionPoint,'ordinate origin'),a=point(e.a,'ordinate feature'),b=point(e.b,'ordinate leader'),x=!!((e.dimtype||0)&64);
        measurement=x?a.x-origin.x:a.y-origin.y;
        const elbow=x?{x:a.x,y:b.y}:{x:b.x,y:a.y};line(a,elbow);line(elbow,b);textMidpoint=add(b,{x:gap+h*.5,y:gap+h*.5});
    }
    let value=measurement*([2,5].includes(type)?1:style.dimlfac);
    if(style.dimrnd>0)value=Math.round(value/style.dimrnd)*style.dimrnd;
    let content=value.toFixed(style.dimdec);if(style.dimzin&8)content=content.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
    if(style.dimzin&4)content=content.replace(/^(-?)0\./,'$1.');
    if(style.dimdsep)content=content.replace('.',String.fromCharCode(style.dimdsep));
    content=(type===3?'⌀':type===4?'R':'')+content+([2,5].includes(type)?'°':'');
    content=String(style.dimpost||'<>').replace(/<>/g,content);
    if(e.text && e.text!=='<>')content=String(e.text).replace(/<>/g,content);
    if(e.dimension?.manualText && e.textMidpoint)textMidpoint=point(e.textMidpoint,'text midpoint');
    textRotation=e.textRotation??textRotation;
    finite(textRotation,'text rotation');
    if(e.text!==' ')put('TEXT',{p:textMidpoint,text:content,height:h,rotation:textRotation,align:'center',halign:1,valign:2,alignPoint:textMidpoint});
    finite(measurement,'measurement');point(textMidpoint,'generated text midpoint');
    for(const entity of entities)for(const p of [entity.a,entity.b,entity.p,entity.c,...entity.points||[]])if(p)point(p,'generated coordinate');
    return {entities,measurement,definitionPoint,textMidpoint,style};
}

/** Atomic opt-in adoption or edit. Imported pictures are left untouched until this succeeds. */
function editDimension(e,doc,patch={}) {
    if(e.dimension&&e.dimension.version!==1)throw new Error('Unsupported Conduit dimension schema');
    const next=copy(e);next.dimension={version:1,manualText:!!((next.dimtype||0)&128),...next.dimension};
    for(const [key,value] of Object.entries(patch)) {
        if(key==='style') {
            if(!value||typeof value!=='object')throw new Error('Invalid dimension style');
            for(const k of Object.keys(value))if(!STYLE_KEYS.has(k))throw new Error(`Unsupported dimension style field: ${k}`);
            next.dimension.style={...next.dimension.style,...value};
        } else if(POINT_KEYS.includes(key))next[key]=point(value,key);
        else if(['offset','text','textRotation','dimensionAngle','leaderLength','dimstyle','dimtype'].includes(key))next[key]=value;
        else if(key==='manualText')next.dimension.manualText=!!value;
        else throw new Error(`Unsupported dimension edit: ${key}`);
    }
    for(const key of POINT_KEYS)if(key in patch && next.dimension.references)delete next.dimension.references[key];
    // A moved dimension line supersedes its authored signed offset.
    if('definitionPoint' in patch && !('offset' in patch))delete next.offset;
    if('textMidpoint' in patch)next.dimension.manualText=true;
    const picture=dimensionPicture(next,doc);
    next.dimension.resolvedScale=picture.style.dimscale;
    next.definitionPoint=picture.definitionPoint;next.textMidpoint=picture.textMidpoint;next.measurement=picture.measurement;
    next.dimtype=(next.dimtype??33)|32;
    if(next.dimension.manualText)next.dimtype|=128;else next.dimtype&=~128;
    delete next.block;next.dirty=true;for(const key of Object.keys(e))if(!(key in next))delete e[key];Object.assign(e,next);
    return e;
}
function dimensionGrips(e,doc) {
    if(e.type!=='DIMENSION'||e.dimension?.version!==1)return [];
    const picture=dimensionPicture(e,doc),type=(e.dimtype??33)&15;
    const keys=type===0||type===1?['a','b','definitionPoint']:type===3||type===4?['definitionPoint','defpoint4']:type===2?['a','b','definitionPoint','defpoint4','defpoint5']:['a','b','definitionPoint',...(type===5?['defpoint4']:[])];
    return [...keys.filter(k=>e[k]).map(k=>({...e[k],key:'dim:'+k})),{...picture.textMidpoint,key:'dim:textMidpoint'}];
}
/** Refresh authored point associations without mutating anything on failure. */
function regenerateDimensions(doc) {
    const map=new Map(doc.entities.map(e=>[e.id,e])),changes=[];
    for(const e of doc.entities) {
        if(e.type!=='DIMENSION'||e.dimension?.version!==1)continue;
        const refs=e.dimension.references;if(!refs)continue;
        const next=copy(e);
        for(const [key,ref]of Object.entries(refs)) {
            if(!POINT_KEYS.includes(key))throw new Error('Invalid dimension reference slot');
            const source=map.get(ref.entityId);
            if(!source||source.type==='DIMENSION')throw new Error('Missing or cyclic dimension reference');
            const p=ref.point==='circle'&&['CIRCLE','ARC'].includes(source.type)?{x:source.c.x+source.r*Math.cos(ref.angle||0),y:source.c.y+source.r*Math.sin(ref.angle||0),z:source.c.z||0}:ref.point==='vertex'?source.points?.[ref.index]:['a','b','c','p'].includes(ref.point)?source[ref.point]:null;
            next[key]=point(p,'associated point');
        }
        editDimension(next,doc);if(JSON.stringify(next)!==JSON.stringify(e))changes.push([e,next]);
    }
    for(const [e,next]of changes){Object.assign(e,next);delete e.block;}
    return changes.map(([e])=>e.id);
}

return {dimensionPicture,editDimension,dimensionGrips,regenerateDimensions};
})();
// packages/constraints/src/expressions.js
__modules["packages/constraints/src/expressions.js"]=(()=>{
/** Bounded arithmetic parser. No eval, property access, or executable user code. */
const functions = Object.freeze({
    abs: [1, Math.abs], sqrt: [1, Math.sqrt], sin: [1, Math.sin], cos: [1, Math.cos],
    tan: [1, Math.tan], asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],
    atan2: [2, Math.atan2], hypot: [2, Math.hypot], min: [2, Math.min], max: [2, Math.max],
    floor: [1, Math.floor], ceil: [1, Math.ceil], round: [1, Math.round], exp: [1, Math.exp],
    ln: [1, Math.log], log10: [1, Math.log10], pow: [2, Math.pow],
    rad: [1, x => x * Math.PI / 180], deg: [1, x => x * 180 / Math.PI],
    clamp: [3, (x, lo, hi) => { if (lo > hi) throw new Error('Invalid clamp range'); return Math.min(hi, Math.max(lo, x)); }]
});
const constants = Object.freeze({ pi: Math.PI, tau: Math.PI * 2, e: Math.E });
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const finite = n => { if (!Number.isFinite(n)) throw new Error('Expression did not produce a finite number'); return n; };
function expressionNames() { return [...Object.keys(constants), ...Object.keys(functions), ...forbidden]; }
function expressionDependencies(source) {
    const tokens = String(source).match(/[A-Za-z_]\w*|(?:\d*\.?\d+(?:e[+-]?\d+)?)/gi) || [];
    return [...new Set(tokens.filter(t => /^[A-Za-z_]/.test(t) && !Object.hasOwn(constants, t) && !Object.hasOwn(functions, t)))];
}
function parseExpression(source, parameters = {}, stack = [], budget = {remaining: 20000, cache: new Map()}) {
    if (--budget.remaining < 0) throw new Error('Expression evaluation budget exceeded');
    if (typeof source === 'number') return finite(source);
    if (stack.length > 64) throw new Error('Parameter dependency depth exceeds 64');
    if (source && typeof source === 'object') source = source.expression ?? source.value;
    const s = String(source), tokens = []; let offset = 0;
    if (s.length > 4096) throw new Error('Expression exceeds 4096 characters');
    while (offset < s.length) {
        if (/\s/.test(s[offset])) { offset++; continue; }
        const m = s.slice(offset).match(/^(?:\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_]\w*|[(),+\-*/^])/i);
        if (!m) throw new Error(`Invalid expression near “${s.slice(offset, offset + 12)}”`);
        tokens.push(m[0]); offset += m[0].length;
        if (tokens.length > 1024) throw new Error('Expression token budget exceeded');
    }
    let i = 0, depth = 0;
    function primary() {
        if (++depth > 64) throw new Error('Expression nesting exceeds 64');
        try {
            const t = tokens[i++];
            if (t === undefined) throw new Error('Incomplete expression');
            if (t === '(') { const v = sum(); if (tokens[i++] !== ')') throw new Error('Unclosed parenthesis'); return v; }
            if (/^\d|^\./.test(t)) return finite(Number(t));
            if (/^[A-Za-z_]/.test(t)) {
                if (forbidden.has(t)) throw new Error('Reserved parameter name');
                if (tokens[i] === '(') {
                    if (!Object.hasOwn(functions, t)) throw new Error(`Unknown function: ${t}`);
                    i++; const args = [];
                    if (tokens[i] !== ')') { args.push(sum()); while (tokens[i] === ',') { i++; args.push(sum()); if (args.length > 3) throw new Error('Too many function arguments'); } }
                    if (tokens[i++] !== ')') throw new Error('Unclosed function');
                    const [arity, fn] = functions[t]; if (args.length !== arity) throw new Error(`${t} requires ${arity} arguments`);
                    return finite(fn(...args));
                }
                if (Object.hasOwn(constants, t)) return constants[t];
                if (!Object.hasOwn(parameters, t)) throw new Error(`Unknown parameter: ${t}`);
                if (stack.includes(t)) throw new Error(`Parameter cycle: ${[...stack, t].join(' → ')}`);
                if(budget.cache.has(t))return budget.cache.get(t);
                const value=parseExpression(parameters[t], parameters, [...stack, t], budget);budget.cache.set(t,value);return value;
            }
            throw new Error(`Unexpected token: ${t}`);
        } finally { depth--; }
    }
    function power() { const a = primary(); if (tokens[i] !== '^') return a; i++; return finite(a ** unary()); }
    function unary() {
        let sign = 1, count = 0;
        while (tokens[i] === '+' || tokens[i] === '-') { if (tokens[i++] === '-') sign = -sign; if (++count > 64) throw new Error('Unary nesting exceeds 64'); }
        return sign * power();
    }
    function product() { let v = unary(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], b = unary(); v = finite(op === '*' ? v * b : v / b); } return v; }
    function sum() { let v = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], b = product(); v = finite(op === '+' ? v + b : v - b); } return v; }
    const result = sum(); if (i !== tokens.length) throw new Error('Unexpected expression token: ' + tokens[i]); return finite(result);
}
/** Values and dependency lists suitable for a parameter/calculation inspector. */
function parameterReport(parameters) {
    if (Object.keys(parameters).length > 1024) throw new Error('Parameter count exceeds 1024');
    return Object.entries(parameters).map(([name, expression]) => ({ name, expression, value: parseExpression(expression, parameters, [name]), dependencies: expressionDependencies(expression?.expression ?? expression) }));
}

return {expressionNames,expressionDependencies,parseExpression,parameterReport};
})();
// packages/constraints/src/solver.js
__modules["packages/constraints/src/solver.js"]=(()=>{
const {parseExpression, expressionNames} = __modules["packages/constraints/src/expressions.js"];
const idsOf = c => c.entities || (c.entityId ? [c.entityId] : []);
const types = new Set(['horizontal','vertical','length','radius','diameter','coincident','concentric','parallel','perpendicular','collinear','equal','angle','angle-between','fixed','fixed-point','distance','distance-x','distance-y','point-on-line','point-on-circle','midpoint','tangent','symmetric']);
const numeric = new Set(['length','radius','diameter','angle','angle-between','distance','distance-x','distance-y']);
const refMode = c => c.reference === true || c.mode === 'reference';
const drivingParameters = (constraints, parameters) => ({...parameters,...Object.fromEntries(constraints.filter(c=>c.name&&!c.suppressed&&!refMode(c)&&numeric.has(c.type)).map(c=>[c.name,c.value]))});
const pointKeys = e => ['a','b','c','p'].filter(k => e[k]).concat((e.points || []).map((_, i) => `points.${i}`));
function point(e, key) {
    if (!e) throw new Error('Constraint references a missing entity');
    if (key === 'start') key = 'a'; if (key === 'end') key = 'b'; if (key === 'center') key = 'c';
    const p = /^points\.\d+$/.test(key) ? e.points?.[Number(key.slice(7))] : ['a','b','c','p'].includes(key) ? e[key] : null;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`Constraint needs a valid point: ${e.id}.${key}`);
    return p;
}
const defaultPoint = e => e?.b ? 'b' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';
const secondPoint = e => e?.a ? 'a' : e?.c ? 'c' : e?.p ? 'p' : 'points.0';
const norm = a => Math.hypot(...a);
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));

/** Rank-revealing column-pivoted Householder QR; never forms JᵀJ. */
function qr(matrix, rhs = null, tolerance = 1e-10) {
    const m = matrix.length, n = matrix[0]?.length || 0;
    const a = matrix.map(r => Float64Array.from(r)), b = rhs ? Float64Array.from(rhs) : new Float64Array(m), permutation = Array.from({length:n}, (_,i)=>i);
    let rank = 0, largest = 0;
    for (let k=0;k<Math.min(m,n);k++) {
        let pivot=k, best=-1;
        for(let j=k;j<n;j++){let s=0;for(let i=k;i<m;i++)s+=a[i][j]*a[i][j];if(s>best){best=s;pivot=j;}}
        const size=Math.sqrt(best);if(k===0)largest=size;
        if(size<=Math.max(largest*tolerance,1e-15))break;
        if(pivot!==k){for(let i=0;i<m;i++)[a[i][k],a[i][pivot]]=[a[i][pivot],a[i][k]];[permutation[k],permutation[pivot]]=[permutation[pivot],permutation[k]];}
        const alpha=a[k][k]>=0?-size:size, v=new Float64Array(m-k);v[0]=a[k][k]-alpha;
        for(let i=k+1;i<m;i++)v[i-k]=a[i][k];let vv=0;for(const x of v)vv+=x*x;
        const beta=2/vv;
        for(let j=k+1;j<n;j++){let d=0;for(let i=k;i<m;i++)d+=v[i-k]*a[i][j];d*=beta;for(let i=k;i<m;i++)a[i][j]-=d*v[i-k];}
        let d=0;for(let i=k;i<m;i++)d+=v[i-k]*b[i];d*=beta;for(let i=k;i<m;i++)b[i]-=d*v[i-k];
        a[k][k]=alpha;for(let i=k+1;i<m;i++)a[i][k]=0;rank++;
    }
    const z=new Float64Array(n),x=new Float64Array(n);
    for(let i=rank-1;i>=0;i--){let v=b[i];for(let j=i+1;j<rank;j++)v-=a[i][j]*z[j];z[i]=v/a[i][i];}
    for(let i=0;i<n;i++)x[permutation[i]]=z[i];
    return {x,rank,permutation};
}
/** Dense forward-mode derivatives inside one bounded connected component. */
function algebra(n) {
    let singular=false;
    const c = v => ({v,d:new Float64Array(n)});
    const add = (a,b) => {const r=c(a.v+b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]+b.d[i];return r;};
    const sub = (a,b) => {const r=c(a.v-b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]-b.d[i];return r;};
    const mul = (a,b) => {const r=c(a.v*b.v);for(let i=0;i<n;i++)r.d[i]=a.d[i]*b.v+b.d[i]*a.v;return r;};
    const div = (a,b) => {if(Math.abs(b.v)<1e-20)throw new Error('Degenerate constraint geometry');const r=c(a.v/b.v);for(let i=0;i<n;i++)r.d[i]=(a.d[i]-r.v*b.d[i])/b.v;return r;};
    const hypot = (a,b) => {const h=Math.hypot(a.v,b.v),r=c(h);if(h<=1e-20)singular=true;if(h>1e-20)for(let i=0;i<n;i++)r.d[i]=(a.v*a.d[i]+b.v*b.d[i])/h;return r;};
    const atan2 = (y,x) => {const r=c(Math.atan2(y.v,x.v)),den=x.v*x.v+y.v*y.v;if(den<1e-24)throw new Error('Degenerate line direction');for(let i=0;i<n;i++)r.d[i]=(x.v*y.d[i]-y.v*x.d[i])/den;return r;};
    const delta = (a,b) => ({x:sub(a.x,b.x),y:sub(a.y,b.y)});
    return {c,add,sub,mul,div,hypot,atan2,delta,clearSingular:()=>{singular=false;},isSingular:()=>singular};
}
function compile(entities, constraints, parameters, maxVariables) {
    const map=new Map(entities.map(e=>[e.id,e]));
    const xs=[],ys=[],sizes=[];
    for(const e of entities){for(const k of pointKeys(e)){const p=point(e,k);xs.push(p.x);ys.push(p.y);}if(e.r!==undefined)sizes.push(e.r);}
    const ox=xs.length?Math.min(...xs):0,oy=ys.length?Math.min(...ys):0;
    const targets=constraints.map(c=>numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):0);
    const scale=Math.max(1e-6,Math.max(...xs,ox)-ox,Math.max(...ys,oy)-oy,...sizes,...targets.filter((_,i)=>!['angle','angle-between'].includes(constraints[i].type)).map(Math.abs));
    const descriptors=[],index=new Map();
    for(const e of entities){
        if(!['LINE','CIRCLE','ARC','POINT','LWPOLYLINE','POLYLINE'].includes(e.type))throw new Error(`Unsupported constrained geometry: ${e.type}`);
        if(e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Constraints require default planar OCS');
        if(e.elevation)throw new Error('Constraints require XY geometry at Z=0');
        if(e.type==='POLYLINE'&&(e.flags&(8|16|64))||e.points?.some(p=>p.bulge))throw new Error('Constraints require a straight planar polyline');
        for(const k of pointKeys(e)){const p=point(e,k);if(p.z)throw new Error('Constraints require XY geometry at Z=0');for(const axis of ['x','y']){index.set(`${e.id}/${k}/${axis}`,descriptors.length);descriptors.push({value:(p[axis]-(axis==='x'?ox:oy))/scale,object:p,key:axis,origin:axis==='x'?ox:oy});}}
        if(e.r!==undefined){if(!(e.r>0))throw new Error('Radius must be positive');index.set(`${e.id}/r`,descriptors.length);descriptors.push({value:e.r/scale,object:e,key:'r',origin:0});}
        if(e.type==='LINE'&&Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)<scale*1e-12)throw new Error('Constraint requires a nondegenerate line');
    }
    if(descriptors.length>maxVariables)throw new Error(`Connected sketch exceeds ${maxVariables} scalar variables`);
    const n=descriptors.length,{c,add,sub,mul,div,hypot,atan2,delta,clearSingular,isSingular}=algebra(n);
    const radius=(e,v)=>{if(!e?.c||e.r===undefined)throw new Error('Constraint requires a circle or arc');return variable(`${e.id}/r`,v);};
    function variable(key,v){const i=index.get(key);if(i===undefined)throw new Error(`Missing constrained coordinate: ${key}`);const r=c(v[i]);r.d[i]=1;return r;}
    function pos(e,key,v){point(e,key);key=key==='start'?'a':key==='end'?'b':key==='center'?'c':key;return {x:variable(`${e.id}/${key}/x`,v),y:variable(`${e.id}/${key}/y`,v)};}
    function start(e,segment=0){return e?.type==='LINE'?'a':`points.${segment}`;}
    function direction(e,v,segment=0){
        if(e?.type==='LINE')return delta(pos(e,'b',v),pos(e,'a',v));
        if(!['LWPOLYLINE','POLYLINE'].includes(e?.type)||!Number.isInteger(segment)||segment<0||segment>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid straight polyline segment');
        return delta(pos(e,`points.${(segment+1)%e.points.length}`,v),pos(e,`points.${segment}`,v));
    }
    const length = u=>hypot(u.x,u.y),dot=(u,v)=>add(mul(u.x,v.x),mul(u.y,v.y)),cross=(u,v)=>sub(mul(u.x,v.y),mul(u.y,v.x));
    function residual(v, includeReferences=false){
        clearSingular();const rows=[],owners=[];
        constraints.forEach((con,k)=>{
            if(con.suppressed||refMode(con)&&!includeReferences)return;
            const es=idsOf(con).map(id=>map.get(id)),[a,b,z]=es,value=targets[k],out=[];
            const pp=()=>pos(a,con.pointA||defaultPoint(a),v),qq=()=>pos(b,con.pointB||secondPoint(b),v);
            const dir=e=>direction(e,v,e===a?(con.segmentA??0):(con.segmentB??0)),first=e=>pos(e,start(e,e===a?(con.segmentA??0):(con.segmentB??0)),v);
            const pushPoint=(p,q)=>out.push(sub(p.x,q.x),sub(p.y,q.y));
            switch(con.type){
                case 'horizontal':out.push(dir(a).y);break;
                case 'vertical':out.push(dir(a).x);break;
                case 'length':out.push(sub(length(dir(a)),c(value/scale)));break;
                case 'radius':out.push(sub(radius(a,v),c(value/scale)));break;
                case 'diameter':out.push(sub(mul(c(2),radius(a,v)),c(value/scale)));break;
                case 'coincident':pushPoint(pp(),qq());break;
                case 'concentric':radius(a,v);radius(b,v);pushPoint(pos(a,'c',v),pos(b,'c',v));break;
                case 'parallel':case 'perpendicular':case 'collinear':{
                    const u=dir(a),w=dir(b),den=mul(length(u),length(w));
                    out.push(div(con.type==='perpendicular'?dot(u,w):cross(u,w),den));
                    if(con.type==='collinear')out.push(div(cross(delta(first(b),first(a)),u),length(u)));break;
                }
                case 'equal':if((a.r!==undefined)!==(b?.r!==undefined))throw new Error('Equal requires matching geometry');out.push(sub(a.r!==undefined?radius(a,v):length(dir(a)),b?.r!==undefined?radius(b,v):length(dir(b))));break;
                case 'angle':case 'angle-between':{
                    const u=dir(a);let angle=atan2(u.y,u.x);
                    if(con.type==='angle-between'){const w=dir(b);angle=sub(atan2(w.y,w.x),angle);}
                    const r=sub(angle,c(value*Math.PI/180));r.v=wrap(r.v);out.push(r);break;
                }
                case 'distance':case 'distance-x':case 'distance-y':{
                    const u=delta(qq(),pp());out.push(sub(con.type==='distance'?length(u):u[con.type==='distance-x'?'x':'y'],c(value/scale)));break;
                }
                case 'point-on-line':case 'midpoint':{
                    const u=dir(b),start=first(b);
                    if(con.type==='midpoint')pushPoint(pp(),{x:add(start.x,mul(u.x,c(.5))),y:add(start.y,mul(u.y,c(.5)))});
                    else out.push(div(cross(delta(pp(),start),u),length(u)));break;
                }
                case 'point-on-circle':out.push(sub(length(delta(pp(),pos(b,'c',v))),radius(b,v)));break;
                case 'tangent':{
                    if(a.type==='LINE'||b?.type==='LINE'){
                        const l=a.type==='LINE'?a:b,ring=a.type==='LINE'?b:a,u=direction(l,v);
                        const r=div(cross(u,delta(pos(ring,'c',v),pos(l,'a',v))),length(u));
                        const side=con.side??(Math.sign((l.b.x-l.a.x)*(ring.c.y-l.a.y)-(l.b.y-l.a.y)*(ring.c.x-l.a.x))||1);
                        out.push(sub(r,mul(c(side),radius(ring,v))));
                    }else{const r1=radius(a,v),r2=radius(b,v);out.push(sub(length(delta(pos(a,'c',v),pos(b,'c',v))),con.internal?mul(c(con.side??(a.r>=b.r?1:-1)),sub(r1,r2)):add(r1,r2)));}break;
                }
                case 'symmetric':{
                    const u=direction(z,v,con.segmentC??0),p=pp(),q=qq(),mid={x:mul(add(p.x,q.x),c(.5)),y:mul(add(p.y,q.y),c(.5))};
                    out.push(div(cross(delta(mid,pos(z,start(z,con.segmentC??0),v)),u),length(u)),div(dot(delta(q,p),u),length(u)));break;
                }
                case 'fixed-point':{
                    const t=con.target;if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.y))throw new Error('Fixed point requires an explicit target');pushPoint(pp(),{x:c((t.x-ox)/scale),y:c((t.y-oy)/scale)});break;
                }
                case 'fixed':{
                    const t=con.target;if(!t)throw new Error('Fixed geometry requires an explicit target');
                    for(const key of pointKeys(a)){const p=point(t,key);pushPoint(pos(a,key,v),{x:c((p.x-ox)/scale),y:c((p.y-oy)/scale)});}
                    if(a.r!==undefined){if(!Number.isFinite(t.r))throw new Error('Missing fixed radius target');out.push(sub(radius(a,v),c(t.r/scale)));}break;
                }
                default:throw new Error(`Unknown constraint: ${con.type}`);
            }
            for(const row of out){if(!Number.isFinite(row.v)||row.d.some(v=>!Number.isFinite(v)))throw new Error('Non-finite constraint residual');rows.push(row);owners.push(k);}
        });return {r:rows.map(v=>v.v),j:rows.map(v=>v.d),owners,singular:isSingular()};
    }
    const initial=descriptors.map(v=>v.value);residual(initial);
    return {initial,descriptors,scale,residual,constraints,valid:v=>v.every(Number.isFinite)&&descriptors.every((d,i)=>d.key!=='r'||v[i]>1e-12),apply:v=>descriptors.forEach((d,i)=>{d.object[d.key]=v[i]*scale+d.origin;})};
}
function solveComponent(problem, options, analyzeOnly=false){
    let x=problem.initial.slice(),current=problem.residual(x),cost=norm(current.r),lambda=1e-3,iterations=0,rejected=0;
    const threshold=options.tolerance/problem.scale+options.relativeTolerance;
    let singularStartPerturbed=false;
    if(!analyzeOnly&&current.singular&&cost>threshold){
        // Break only a nondifferentiable zero-distance initial state. The deterministic
        // trial stays private and is accepted only if it lowers the original residual.
        const seed=x.map((v,i)=>problem.descriptors[i].key==='r'?v:v+1e-4*(i%7+1)*(i%2?1:-1));
        if(problem.valid(seed))try{const trial=problem.residual(seed),value=norm(trial.r);if(value<cost){x=seed;current=trial;cost=value;singularStartPerturbed=true;}}catch{}
    }
    if(!analyzeOnly)for(;iterations<options.maxIterations&&Math.max(0,...current.r.map(Math.abs))>threshold;iterations++){
        const n=x.length,col=Array.from({length:n},(_,k)=>Math.max(1e-6,Math.hypot(...current.j.map(r=>r[k]))));
        const augmented=current.j.map(r=>Array.from(r)),rhs=current.r.map(v=>-v);
        for(let k=0;k<n;k++){const row=new Float64Array(n);row[k]=Math.sqrt(lambda)*col[k];augmented.push(row);rhs.push(0);}
        const step=qr(augmented,rhs).x;let max=Math.max(0,...step.map(Math.abs));if(max>10)for(let k=0;k<n;k++)step[k]*=10/max;
        const candidate=x.map((v,k)=>v+step[k]);let trial=null,nextCost=Infinity;
        if(problem.valid(candidate))try{trial=problem.residual(candidate);nextCost=norm(trial.r);}catch{/* Reject a degenerate trial without touching source. */}
        if(nextCost<cost){x=candidate;current=trial;cost=nextCost;lambda=Math.max(1e-12,lambda*.25);}else{lambda=Math.min(1e16,lambda*8);rejected++;if(lambda===1e16)break;}
    }
    const rank=qr(current.j,null,options.rankTolerance).rank,n=x.length,m=current.r.length;
    const equationQR=qr(Array.from({length:n},(_,k)=>current.j.map(row=>row[k])),null,options.rankTolerance);
    const dependent=new Set(equationQR.permutation.slice(rank).map(i=>current.owners[i]));
    const converged=Math.max(0,...current.r.map(Math.abs))<=threshold;
    const perConstraint=problem.constraints.map((c,k)=>{const rs=current.r.filter((_,i)=>current.owners[i]===k),error=Math.max(0,...rs.map(Math.abs));return {id:c.id??`constraint-${k}`,type:c.type,mode:refMode(c)?'reference':'driving',suppressed:!!c.suppressed,residual:error*problem.scale,satisfied:error<=threshold,redundant:converged&&dependent.has(k)};});
    return {x,converged,iterations,singularStartPerturbed,rejectedSteps:rejected,residual:cost*problem.scale,normalizedResidual:cost,variables:n,equations:m,rank,degreesOfFreedom:n-rank,redundantEquations:m-rank,constraints:perConstraint,status:converged?(rank===n?'fully-constrained':'under-constrained'):'conflicting-or-unconverged'};
}
class SketchSolver {
    constructor({tolerance=1e-7,relativeTolerance=1e-10,maxIterations=100,maxVariables=256,rankTolerance=1e-9}={}){
        if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(relativeTolerance)||relativeTolerance<0||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>1000||!Number.isInteger(maxVariables)||maxVariables<1||maxVariables>512||!Number.isFinite(rankTolerance)||rankTolerance<=0)throw new Error('Invalid solver options');
        Object.assign(this,{tolerance,relativeTolerance,maxIterations,maxVariables,rankTolerance});
    }
    analyze(entities,constraints,parameters={}){return this.solve(entities,constraints,parameters,{analyzeOnly:true});}
    solve(entities,constraints,parameters={}, {analyzeOnly=false}={}){
        if(!Array.isArray(entities)||!Array.isArray(constraints)||constraints.length>4096)throw new Error('Invalid sketch or constraint budget');
        const attached=new Set(constraints.filter(c=>!c.suppressed&&!refMode(c)).flatMap(idsOf));
        constraints=[...constraints,...entities.filter(e=>e.locked&&attached.has(e.id)).map(e=>({id:'locked-'+e.id,type:'fixed',entityId:e.id,target:structuredClone(e),visible:false}))];
        const map=new Map(entities.map(e=>[e.id,e]));if(map.size!==entities.length)throw new Error('Duplicate sketch entity IDs');
        const parent=new Map(),find=id=>{if(!parent.has(id))parent.set(id,id);const p=parent.get(id);if(p!==id)parent.set(id,find(p));return parent.get(id);};
        const constraintNames=new Set();
        for(const c of constraints){
            if(c.name){if(!/^[A-Za-z_]\w*$/.test(c.name)||expressionNames().includes(c.name)||constraintNames.has(c.name)||Object.hasOwn(parameters,c.name))throw new Error('Invalid or duplicate constraint name: '+c.name);constraintNames.add(c.name);}
        }
        parameters=drivingParameters(constraints,parameters);
        for(const c of constraints){
            if(c.type==='tangent'&&c.side!==undefined&&![1,-1].includes(c.side))throw new Error('Tangent side must be +1 or -1');
            if(c.suppressed)continue;if(!types.has(c.type))throw new Error(`Unknown constraint: ${c.type}`);
            const ids=idsOf(c);if(!ids.length||ids.some(id=>!map.has(id)))throw new Error('Constraint references a missing entity');
            if(numeric.has(c.type)&&!refMode(c)){const v=parseExpression(c.value,parameters);if(['length','radius','diameter','distance'].includes(c.type)&&v<=0)throw new Error('Constraint size must be positive');}
            if(refMode(c)){measureConstraint(entities,c);continue;}
            ids.forEach(id=>{const root=find(ids[0]);parent.set(find(id),root);});
        }
        const groups=new Map();for(const id of parent.keys()){const root=find(id);if(!groups.has(root))groups.set(root,{ids:[],constraints:[]});groups.get(root).ids.push(id);}
        for(const c of constraints)if(!c.suppressed&&!refMode(c))groups.get(find(idsOf(c)[0])).constraints.push(c);
        const problems=[...groups.values()].map(g=>compile(g.ids.map(id=>map.get(id)),g.constraints,parameters,this.maxVariables));
        if(problems.reduce((n,p)=>n+p.initial.length,0)>4096)throw new Error('Sketch exceeds 4096 scalar variables');
        sketchAnnotations(entities,constraints,parameters);
        const results=problems.map(p=>solveComponent(p,this,analyzeOnly)),converged=results.every(r=>r.converged);
        if(converged&&!analyzeOnly)problems.forEach((p,i)=>p.apply(results[i].x));
        const sum=k=>results.reduce((n,r)=>n+r[k],0);
        const unconstrainedVariables=entities.filter(e=>!e.locked&&!parent.has(e.id)&&['LINE','CIRCLE','ARC','POINT','LWPOLYLINE'].includes(e.type)).reduce((n,e)=>n+pointKeys(e).length*2+(e.r!==undefined?1:0),0);
        const dof=sum('degreesOfFreedom')+unconstrainedVariables;
        const annotated=sketchAnnotations(entities,constraints,parameters);
        const diagnostics=results.flatMap(r=>r.constraints);
        return {converged,iterations:Math.max(0,...results.map(r=>r.iterations)),residual:Math.hypot(...results.map(r=>r.residual)),variables:sum('variables')+unconstrainedVariables,unconstrainedVariables,affectedVariables:sum('variables'),equations:sum('equations'),rank:sum('rank'),degreesOfFreedom:dof,redundantEquations:sum('redundantEquations'),components:results.map(({x,...r})=>r),constraints:diagnostics,annotations:annotated,conflicts:diagnostics.filter(c=>!c.satisfied).map(c=>c.id),status:!results.length?'unconstrained':converged?(dof?'under-constrained':'fully-constrained'):'conflicting-or-unconverged',rolledBack:!converged&&!analyzeOnly,analysisOnly:analyzeOnly,jacobian:'analytic-forward-mode',linearSolver:'column-pivoted-householder-qr'};
    }
}
/** Read-only driving/reference values; measurements never solve or mutate. */
function measureConstraint(entities,c){
    const [a,b]=idsOf(c).map(id=>entities.find(e=>e.id===id));if(!a)throw new Error('Constraint references a missing entity');
    const ends=e=>{if(e?.a&&e?.b)return [e.a,e.b];const i=e===a?(c.segmentA??0):(c.segmentB??0);if(!e?.points||!Number.isInteger(i)||i<0||i>=e.points.length-(e.closed?0:1))throw new Error('Constraint requires a line or valid polyline segment');return [e.points[i],e.points[(i+1)%e.points.length]];};
    const len=e=>{const [p,q]=ends(e);return Math.hypot(q.x-p.x,q.y-p.y);};
    if(c.type==='length')return len(a);
    if(c.type==='radius'||c.type==='diameter'){if(a.r===undefined)throw new Error('Constraint requires a circle');return a.r*(c.type==='diameter'?2:1);}
    if(c.type==='angle'||c.type==='angle-between'){const [p,q]=ends(a);let angle=Math.atan2(q.y-p.y,q.x-p.x);if(c.type==='angle-between'){const [r,s]=ends(b);angle=wrap(Math.atan2(s.y-r.y,s.x-r.x)-angle);}return angle*180/Math.PI;}
    if(c.type.startsWith('distance')){const p=point(a,c.pointA||defaultPoint(a)),q=point(b,c.pointB||secondPoint(b));return c.type==='distance-x'?q.x-p.x:c.type==='distance-y'?q.y-p.y:Math.hypot(q.x-p.x,q.y-p.y);}
    return null;
}
function sketchAnnotations(entities,constraints,parameters={}){
    parameters=drivingParameters(constraints,parameters);
    return constraints.filter(c=>!c.suppressed).map((c,i)=>{
        const a=entities.find(e=>e.id===idsOf(c)[0]),b=entities.find(e=>e.id===idsOf(c)[1]);
        let value=measureConstraint(entities,c),target=numeric.has(c.type)&&!refMode(c)?parseExpression(c.value,parameters):null;
        const p=a?.c||a?.p||(a?.a&&a?.b?{x:(a.a.x+a.b.x)/2,y:(a.a.y+a.b.y)/2}:a?.points?.[0])||{x:0,y:0};
        const name=c.name||c.type,text=value===null?name:`${name}${refMode(c)?' (ref)':''} = ${Number(value.toPrecision(8))}${['angle','angle-between'].includes(c.type)?'°':''}`;
        return {id:c.id??`constraint-${i}`,entityIds:idsOf(c),position:{...p},text,value,target,expression:c.value??null,reference:refMode(c),visible:c.visible!==false};
    });
}

return {SketchSolver,measureConstraint,sketchAnnotations};
})();
// packages/constraints/src/index.js
__modules["packages/constraints/src/index.js"]=(()=>{
const {parseExpression, parameterReport, expressionDependencies, expressionNames} = __modules["packages/constraints/src/expressions.js"];
const {SketchSolver, measureConstraint, sketchAnnotations} = __modules["packages/constraints/src/solver.js"];
function evaluateExpression(source, parameters = {}, stack = []) { return parseExpression(source, parameters, stack); }
function resolveParameters(parameters) { return Object.fromEntries(parameterReport(parameters).map(p => [p.name, p.value])); }
function describeParameters(parameters) { return parameterReport(parameters); }
function parameterDependencies(source) { return expressionDependencies(source); }
function reservedParameterNames() { return expressionNames(); }
function constraintMeasurement(entities, constraint) { return measureConstraint(entities, constraint); }
function constraintAnnotations(entities, constraints, parameters = {}) { return sketchAnnotations(entities, constraints, parameters); }
/** Analytic-Jacobian, component-partitioned, damped QR planar constraint solver. */
class ConstraintSolver extends SketchSolver {}
/** Suggest horizontal/vertical and endpoint coincidences. Application is an explicit transaction. */
function inferSketchConstraints(entities, existing = [], {linearTolerance = 1e-5, angularTolerance = 1e-5} = {}) {
    if(!Number.isFinite(linearTolerance)||linearTolerance<=0||!Number.isFinite(angularTolerance)||angularTolerance<=0||entities.length>1000)throw new Error('Invalid automatic constraint budget or tolerance');
    const result=[],known=new Set(existing.map(c=>JSON.stringify([c.type,c.entities||[c.entityId],c.pointA,c.pointB,c.segmentA]))),points=[],buckets=new Map(),connected=new Map(),ids=new Set(existing.map(c=>c.id));
    let sequence=0;
    const root=id=>{if(!connected.has(id))connected.set(id,id);const r=connected.get(id);if(r!==id)connected.set(id,root(r));return connected.get(id);};
    const append=c=>{const key=JSON.stringify([c.type,c.entities,c.pointA,c.pointB,c.segmentA]);if(!known.has(key)){known.add(key);let id;do{id=`auto-${sequence++}-${c.entities[0]}-${c.type}`;}while(ids.has(id));ids.add(id);if(result.length>=4096)throw new Error('Automatic constraint count exceeds 4096');result.push({id,...c});}};
    for(const e of entities){
        if(e.locked||e.a?.z||e.b?.z||e.elevation||e.points?.some(p=>p.z)||e.extrusion&&(e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))continue;
        const segments=e.type==='LINE'?[[e.a,e.b,undefined]]:e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge)?e.points.slice(0,e.closed?undefined:-1).map((p,i)=>[p,e.points[(i+1)%e.points.length],i]):[];
        for(const [a,b,segment]of segments){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<linearTolerance)continue;
            if(Math.abs(dy)/l<angularTolerance)append({type:'horizontal',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});
            else if(Math.abs(dx)/l<angularTolerance)append({type:'vertical',entities:[e.id],...(segment!==undefined?{segmentA:segment}:{})});
        }
        if(e.type==='LINE')points.push({id:e.id,key:'a',p:e.a},{id:e.id,key:'b',p:e.b});
        if(e.type==='LWPOLYLINE'&&!e.points.some(p=>p.bulge))e.points.forEach((p,i)=>points.push({id:e.id,key:`points.${i}`,p}));
    }
    if(points.length>8192)throw new Error('Automatic endpoint budget exceeds 8192');
    for(const c of existing)if(c.type==='coincident'&&!c.suppressed&&!c.reference&&c.entities?.length===2){const [a,b]=c.entities;connected.set(root(a+'/'+(c.pointA||'b')),root(b+'/'+(c.pointB||'a')));}
    for(const p of points){const ix=Math.floor(p.p.x/linearTolerance),iy=Math.floor(p.p.y/linearTolerance),identity=p.id+'/'+p.key;
        for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(const q of buckets.get(`${x},${y}`)||[]){
            if(q.id===p.id||Math.hypot(q.p.x-p.p.x,q.p.y-p.p.y)>linearTolerance)continue;const previous=q.id+'/'+q.key;
            if(root(identity)!==root(previous)){append({type:'coincident',entities:[q.id,p.id],pointA:q.key,pointB:p.key});connected.set(root(identity),root(previous));}
        }
        const key=`${ix},${iy}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);
    }
    return result;
}
/** Resolve and atomically apply computed TEXT values from parameters and named measurements. */
function evaluateCalculations(entities, constraints, parameters) {
    const values={...resolveParameters(parameters)},updates=[];
    for(const c of constraints)if(c.name&&!c.suppressed){const value=measureConstraint(entities,c);if(value!==null)values[c.name]=value;}
    for(const e of entities)if(e.calculation){if(!['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(e.type))throw new Error('Calculated annotations require a text entity');const spec=e.calculation,value=parseExpression(spec.expression,values),precision=spec.precision??3;if(!Number.isInteger(precision)||precision<0||precision>12)throw new Error('Annotation precision must be 0–12');updates.push({entity:e,value,text:`${spec.prefix||''}${Number(value.toFixed(precision))}${spec.suffix||''}`});}
    for(const {entity,text,value}of updates){entity.text=text;entity.calculation.value=value;}
    return updates.map(({entity,value,text})=>({entityId:entity.id,value,text}));
}

return {evaluateExpression,resolveParameters,describeParameters,parameterDependencies,reservedParameterNames,constraintMeasurement,constraintAnnotations,ConstraintSolver,inferSketchConstraints,evaluateCalculations};
})();
// packages/model/src/blocks.js
__modules["packages/model/src/blocks.js"]=(()=>{
const {matrix, compose, transform} = __modules["packages/geometry/src/index.js"];
const {regenerateDimensions} = __modules["packages/model/src/dimensions.js"];
const {ConstraintSolver, resolveParameters, evaluateCalculations} = __modules["packages/constraints/src/index.js"];
const clone = x => structuredClone(x);
const own = (o,k) => Object.hasOwn(o,k);
const attributeTag = e => String(e.attributeTag ?? e.tag ?? '');
const constantAttribute = e => !!(e.constant || ((e.attributeFlags ?? e.flags ?? 0) & 2));
const validName = name => typeof name==='string' && name.trim()===name && name.length>0 && name.length<=255 && !/[<>/\\":;?*|,=`\x00-\x1f]/.test(name) && !['__proto__','constructor','prototype'].includes(name);
const point = (p,label) => {if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e12||Math.abs(p.y)>1e12||p.z)throw new Error(`Invalid planar ${label}`);};
function blockSignature(block) { return JSON.stringify(block); }
/** Returns direct/nested references without flattening the database or invoking evaluators. */
function blockReferences(document, name) {
    if(!own(document.blocks,name))throw new Error('Missing block definition: '+name);
    const affected=new Set([name]);let changed=true;
    while(changed){changed=false;for(const [key,b]of Object.entries(document.blocks))if(!affected.has(key)&&(b.entities||[]).some(e=>e.type==='INSERT'&&affected.has(e.block))){affected.add(key);changed=true;}}
    const direct=document.entities.filter(e=>e.type==='INSERT'&&e.block===name).map(e=>e.id);
    const inserts=document.entities.filter(e=>e.type==='INSERT'&&affected.has(e.block)).map(e=>e.id);
    const nested=Object.entries(document.blocks).flatMap(([owner,b])=>(b.entities||[]).filter(e=>e.type==='INSERT'&&e.block===name).map(e=>({owner,entityId:e.id})));
    return {name,direct,inserts,nested,definitions:[...affected]};
}
function checkTree(blocks,root) {
    const done=new Set(),active=new Set();
    const visit=(name,depth)=>{
        if(depth>32)throw new Error('Block nesting exceeds 32 levels');if(active.has(name))throw new Error('Cyclic block nesting: '+[...active,name].join(' → '));if(done.has(name))return;
        const b=blocks[name];if(!b)throw new Error('Missing nested block: '+name);active.add(name);
        for(const e of b.entities||[])if(e.type==='INSERT')visit(e.block,depth+1);
        active.delete(name);done.add(name);
    };visit(root,0);
}
function validateBlockDraft(block, blocks, evaluate) {
    if(!block||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Block must contain at most 10,000 entities');
    point(block.base||{x:0,y:0},'block base');const ids=new Set(),ports=new Set(),tags=new Set();
    const walk=(value,depth=0)=>{if(depth>32)throw new Error('Block data nesting exceeds 32');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite block data');if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Reserved block property');walk(v,depth+1);}};
    walk(block);
    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Missing or duplicate block entity ID');ids.add(e.id);for(const key of ['a','b','c','p'])if(key in e)point(e[key],'entity '+key);for(const p of e.points||[])point(p,'vertex');if(['CIRCLE','ARC'].includes(e.type)&&!(e.r>0))throw new Error('Radius must be positive');if(e.type==='LINE'&&(!e.a||!e.b))throw new Error('Line needs endpoints');if(e.type==='ATTDEF'){const tag=attributeTag(e);if(!tag||tag.length>255||/\s/.test(tag)||tags.has(tag.toUpperCase()))throw new Error('Attribute tags must be unique and contain no whitespace');tags.add(tag.toUpperCase());e.attributeTag=tag;}}
    for(const p of block.ports||[]){point(p,'port');if(!p.name||ports.has(p.name)||!Number.isFinite(p.dx)||!Number.isFinite(p.dy)||Math.hypot(p.dx,p.dy)<1e-12)throw new Error('Invalid or duplicate block port');ports.add(p.name);if(p.anchor&&!ids.has(p.anchor.entityId))throw new Error('Port anchor references missing geometry');}
    checkTree({...blocks,[block.name]:block},block.name);
    resolveParameters(block.parameters||{});
    if(block.dynamic)evaluate(block,{});
    else if(block.constraints?.length){const report=new ConstraintSolver().solve(block.entities,block.constraints,block.parameters||{});if(!report.converged)throw new Error('Block constraints conflict: '+report.conflicts.join(', '));}
    if(!block.dynamic){
        for(const p of block.ports||[])if(p.anchor){const e=block.entities.find(e=>e.id===p.anchor.entityId),k=p.anchor.point,point=/^points\.\d+$/.test(k)?e?.points?.[Number(k.slice(7))]:['a','b','c','p'].includes(k)?e?.[k]:null;if(!point)throw new Error('Invalid port anchor');p.x=point.x;p.y=point.y;if(p.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=p.anchor.reverse?-1:1;if(n<1e-12)throw new Error('Degenerate port direction');p.dx=sign*(e.b.x-e.a.x)/n;p.dy=sign*(e.b.y-e.a.y)/n;}}
        regenerateDimensions({entities:block.entities,dimstyles:block.dimstyles||{}});
        evaluateCalculations(block.entities,block.constraints||[],block.parameters||{});
    }
    return block;
}
/** Isolated copy for a graphical editing session. Does not mutate the source. */
function beginBlockDraft(document,name) {
    const block=document.blocks[name];if(!block)throw new Error('Missing block: '+name);
    if(block.flags&4)throw new Error('External reference definitions must be resolved before editing');
    const draft={...clone(document),name:`Block: ${name}`,entities:clone(block.entities||[]),constraints:clone(block.constraints||block.dynamic?.constraints||[]),parameters:clone(block.parameters||{}),activeLayout:'Model',layouts:['Model'],metadata:{}};
    delete draft.original;delete draft.originalSource;delete draft.dxfSource;
    for(const e of draft.entities)e.layout='Model';
    draft.blockEditing={name,base:clone(block.base||{x:0,y:0}),ports:clone(block.ports||[]),dynamic:clone(block.dynamic||null)};
    for(const p of block.dynamic?.parameters||[])if(['number','distance','angle','integer'].includes(p.type))draft.parameters[p.name]=p.expression??p.default;
    return {name,signature:blockSignature(block),draft,referenceInfo:blockReferences(document,name)};
}
function blockFromDraft(session) {
    const old=session.draft.blocks[session.name]||{},info=session.draft.blockEditing;
    const result={...clone(old),name:session.name,base:clone(info.base),ports:clone(info.ports),entities:clone(session.draft.entities),constraints:clone(session.draft.constraints),parameters:clone(session.draft.parameters)};
    if(info.dynamic){result.dynamic=clone(info.dynamic);result.dynamic.constraints=clone(result.constraints);for(const p of result.dynamic.parameters)delete result.parameters[p.name];}
    else delete result.dynamic;
    for(const e of result.entities){delete e.layout;delete e.handle;delete e.owner;delete e.raw;}
    delete result.raw;return result;
}
/** Synchronize native attribute values while retaining existing user text and identity.
 * Decompose the complete affine text frame, including mirrored and rotated nonuniform inserts.
 */
function syncAttributes(insert,block,nextId) {
    const old=new Map((insert.attributes||[]).map(a=>[attributeTag(a).toUpperCase(),a]));
    const m=compose(matrix(insert),matrix({x:-(block.base?.x||0),y:-(block.base?.y||0)}));
    const definitions=(block.entities||[]).filter(e=>e.type==='ATTDEF'&&!constantAttribute(e));
    const transformed=definitions.map(def=>{
        const tag=attributeTag(def);if(!tag)throw new Error('Missing native attribute tag');
        if(def.extrusion&&(def.extrusion.x||def.extrusion.y||def.extrusion.z!==1))throw new Error('Attribute synchronization requires default OCS');
        const previous=old.get(tag.toUpperCase()),a={...clone(def),id:previous?.id||nextId(),type:'ATTRIB',attributeTag:tag,tag,layer:def.layer==='0'?insert.layer||'0':def.layer||insert.layer||'0',text:def.calculation?def.text??'':previous?.text??def.text??'',p:transform(def.p,m)};
        if(def.alignPoint)a.alignPoint=transform(def.alignPoint,m);
        const angle=(def.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),width=(def.widthFactor||1)*((def.textFlags&2)?-1:1),vertical=(def.textFlags&4)?-1:1,slant=Math.tan((def.oblique||0)*Math.PI/180);
        const ux=m[0]*c*width+m[2]*s*width,uy=m[1]*c*width+m[3]*s*width;
        const vx=(m[0]*(c*slant-s)+m[2]*(s*slant+c))*vertical,vy=(m[1]*(c*slant-s)+m[3]*(s*slant+c))*vertical;
        const baseline=Math.hypot(ux,uy),rise=(ux*vy-uy*vx)/baseline,h=Math.abs(rise);
        if(!Number.isFinite(h)||h<1e-12||baseline<1e-12)throw new Error('Singular attribute frame');
        a.height=(def.height||12)*h;a.widthFactor=baseline/h;a.rotation=Math.atan2(uy,ux)*180/Math.PI;
        a.oblique=Math.atan((ux*vx+uy*vy)/baseline/rise)*180/Math.PI;a.textFlags=((def.textFlags||0)&~6)|(rise<0?4:0);
        a.invisible=!!(def.invisible||def.hidden);delete a.handle;delete a.owner;delete a.raw;return a;
    });
    insert.attributes=transformed;
}
/** Prepare an entire database update, validate all variants and references, then commit once. */
function prepareBlockDraft(document,name,replacement,{expectedSignature,attributes=true}={},evaluate,nextId) {
    const original=document.blocks[name];if(original?.flags&4)throw new Error('External reference definitions are read-only');if(!original)throw new Error('Missing block definition');
    if(expectedSignature!==undefined&&blockSignature(original)!==expectedSignature)throw new Error('Block changed since editing began. Reopen it before saving.');
    const next=clone(document),block=clone(replacement);block.name=name;block.revision=(original.revision||0)+1;
    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;
    const info=blockReferences(next,name),names=new Set(info.definitions),affectedIds=new Set(info.inserts);
    for(const root of names)checkTree(next.blocks,root);
    const validateInsert=e=>{
        const b=next.blocks[e.block];if(!b)throw new Error('Missing insert definition');
        const evaluated=b.dynamic?evaluate(b,e.dynamicParameters||{}):b;
        if(e.block===name&&attributes)syncAttributes(e,evaluated,nextId);
        e.dirty=true;return evaluated;
    };
    for(const e of next.entities)if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);
    for(const b of Object.values(next.blocks))for(const e of b.entities||[])if(e.type==='INSERT'&&names.has(e.block))validateInsert(e);
    for(const e of next.entities)if(e.connector)for(const end of ['from','to']){
        const reference=e.connector[end];if(!reference||!affectedIds.has(reference.entityId))continue;
        const insert=next.entities.find(e=>e.id===reference.entityId),b=next.blocks[insert.block],evaluated=b.dynamic?evaluate(b,insert.dynamicParameters||{}):b;
        const portName=reference.port??reference.portName??reference.name;
        if(!(evaluated.ports||[]).some(p=>p.name===portName))throw new Error(`Block update would remove connected port: ${portName}`);
    }
    next.version=(next.version||0)+1;return {document:next,report:{...info,revision:block.revision,updatedInserts:info.inserts.length,attributesSynchronized:attributes}};
}
function renameBlockInDocument(document,oldName,newName) {
    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');
    if(!own(document.blocks,oldName))throw new Error('Missing block definition');
    const next=clone(document);next.blocks[newName]={...next.blocks[oldName],name:newName};delete next.blocks[oldName];
    for(const e of [...next.entities,...Object.values(next.blocks).flatMap(b=>b.entities||[])]){if(e.block===oldName)e.block=newName;if(e.dynamicSource===oldName)e.dynamicSource=newName;}
    return next;
}
function copyBlockInDocument(document,name,newName) {
    if(!validName(newName)||own(document.blocks,newName))throw new Error('Invalid or existing block name');
    if(!own(document.blocks,name))throw new Error('Missing block definition');
    const next=clone(document);next.blocks[newName]={...clone(next.blocks[name]),name:newName,revision:0};delete next.blocks[newName].symbol;delete next.blocks[newName].handle;return next;
}
/** Create a validated definition without modifying an existing database object. */
function createBlockInDocument(document,name,definition,evaluate) {
    if(!validName(name)||own(document.blocks,name))throw new Error('Invalid or existing block name');
    const next=clone(document),block={base:{x:0,y:0},ports:[],entities:[],...clone(definition||{}),name,revision:0};
    validateBlockDraft(block,next.blocks,evaluate);next.blocks[name]=block;return next;
}
function removeBlockInDocument(document,name) {
    const info=blockReferences(document,name);if(info.direct.length||info.nested.length)throw new Error('Referenced blocks cannot be deleted');
    const next=clone(document);delete next.blocks[name];return next;
}

return {blockSignature,blockReferences,validateBlockDraft,beginBlockDraft,blockFromDraft,syncAttributes,prepareBlockDraft,renameBlockInDocument,copyBlockInDocument,createBlockInDocument,removeBlockInDocument};
})();
// packages/model/src/gradients.js
__modules["packages/model/src/gradients.js"]=(()=>{
/** Portable native LINEAR gradient descriptor. Unknown distributions are not approximated silently. */
function linearHatchGradient(tags,contours,frame) {
    if(!Array.isArray(tags))return null;
    const value=(code,fallback)=>tags.find(p=>p[0]===code)?.[1]??fallback;
    if(value(450,0)!==1||value(470,'LINEAR')!=='LINEAR'||value(461,0)!==0||value(453,2)!==2)return null;
    const colors=tags.filter(p=>p[0]===421).map(p=>p[1]);
    if(colors.length!==2||colors.some(c=>!Number.isInteger(c)||c<0||c>0xffffff))return null;
    const rotation=value(460,0);if(!Number.isFinite(rotation))return null;
    const u={x:Math.cos(rotation),y:Math.sin(rotation)};
    let lo=Infinity,hi=-Infinity;
    for(const polygon of contours)for(const p of polygon){const t=p.x*u.x+p.y*u.y;lo=Math.min(lo,t);hi=Math.max(hi,t);}
    if(!Number.isFinite(lo)||hi-lo<1e-12)return null;
    return {kind:'linear',start:{x:u.x*lo,y:u.y*lo},end:{x:u.x*hi,y:u.y*hi},frame:frame.slice(),colors:colors.map(c=>'#'+c.toString(16).padStart(6,'0'))};
}

return {linearHatchGradient};
})();
// packages/model/src/dynamic.js
__modules["packages/model/src/dynamic.js"]=(()=>{
const {regenerateDimensions} = __modules["packages/model/src/dimensions.js"];
const {ConstraintSolver, evaluateExpression, parameterDependencies, resolveParameters, evaluateCalculations} = __modules["packages/constraints/src/index.js"];
const {matrix, compose, transform} = __modules["packages/geometry/src/index.js"];
const clone=v=>JSON.parse(JSON.stringify(v));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const forbidden=new Set(['__proto__','prototype','constructor']);
const finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e12)throw new Error(`Invalid dynamic ${name}`);return x;};
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
const pivot=(m,p={x:0,y:0})=>compose(matrix({x:p.x,y:p.y}),compose(m,matrix({x:-p.x,y:-p.y})));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function validateDynamicDefinition(block) {
    const d=block.dynamic;
    if(!d||![1,2].includes(d.version)||!Array.isArray(d.parameters)||!Array.isArray(d.actions))throw new Error('Expected Conduit dynamic-block schema version 1 or 2');
    if(d.parameters.length>64||d.actions.length>256||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Dynamic block complexity limit exceeded');
    const names=new Set(),ids=new Set();
    for(const p of d.parameters){if(!/^[A-Za-z][\w-]{0,63}$/.test(p.name)||forbidden.has(p.name)||names.has(p.name))throw new Error('Invalid or duplicate parameter name');names.add(p.name);valueOf(p,p.default);
        if(p.grip){for(const key of ['base','direction'])if(p.grip[key]){finite(p.grip[key].x,'grip '+key);finite(p.grip[key].y,'grip '+key);}
            if(p.grip.direction&&Math.hypot(p.grip.direction.x,p.grip.direction.y)<1e-9)throw new Error('Grip direction must be nonzero');
            if(p.grip.radius!==undefined&&finite(p.grip.radius,'grip radius')<=0)throw new Error('Grip radius must be positive');}
    }
    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Dynamic geometry needs unique entity IDs');ids.add(e.id);}
    const portNames=new Set();for(const port of block.ports||[]){if(!port.name||portNames.has(port.name))throw new Error('Dynamic ports need unique names');portNames.add(port.name);for(const k of ['x','y','dx','dy'])finite(port[k],'port '+k);}
    const types=new Set(['move','stretch','rotate','scale','flip','visibility','array','lookup','polar','polar-array']);
    for(const a of d.actions){
        if(!types.has(a.type)||!names.has(a.parameter))throw new Error('Unknown dynamic action or parameter');
        if(a.entities && (!Array.isArray(a.entities)||a.entities.some(id=>!ids.has(id))))throw new Error('Dynamic action references missing geometry');
        if(a.ports && (!Array.isArray(a.ports)||a.ports.some(n=>!(block.ports||[]).some(p=>p.name===n))))throw new Error('Dynamic action references missing port');
        for(const k of ['base','direction','step'])if(a[k]){finite(a[k].x,k);finite(a[k].y,k);}
        const parameter= d.parameters.find(p=>p.name===a.parameter);
        if(['move','stretch','rotate','scale','array','polar','polar-array'].includes(a.type)&&!['number','distance','angle','integer'].includes(parameter.type))throw new Error('Geometric action requires a numeric parameter');
        if(a.angleParameter&&!names.has(a.angleParameter))throw new Error('Missing polar angle parameter');
        if(a.type==='flip'&&parameter.type!=='boolean')throw new Error('Flip requires a boolean parameter');
        if(a.type==='stretch') {
            if(!a.box)throw new Error('Stretch requires a crossing box');
            for(const k of ['minX','minY','maxX','maxY'])finite(a.box[k],k);
            if(a.box.minX>a.box.maxX||a.box.minY>a.box.maxY)throw new Error('Invalid stretch box');
        }
        if(a.type==='visibility'&&(!a.states||typeof a.states!=='object'||Object.values(a.states).some(v=>!Array.isArray(v)||v.some(id=>!ids.has(id)))))throw new Error('Invalid visibility state');
    }
    return block;
}
function valueOf(p,v) {
    if(p.type==='boolean'){if(typeof v!=='boolean')throw new Error(`Parameter ${p.name} requires a boolean`);}
    else if(p.type==='enum'){if(!Array.isArray(p.values)||!p.values.some(x=>equal(x,v)))throw new Error(`Unknown ${p.name} option`);if(typeof v!=='string'&&typeof v!=='number')throw new Error('Enum values must be scalar');if(typeof v==='number')finite(v,p.name);}
    else {
        if(!['number','distance','angle','integer'].includes(p.type))throw new Error(`Unknown parameter type: ${p.type}`);
        finite(v,p.name);if(p.type==='integer'&&!Number.isInteger(v))throw new Error(`${p.name} must be an integer`);
        if(p.min!==undefined&&(finite(p.min,'minimum'),v<p.min)||p.max!==undefined&&(finite(p.max,'maximum'),v>p.max))throw new Error(`${p.name} is outside its allowed range`);
        if(p.values && !p.values.includes(v))throw new Error(`${p.name} must be a listed value`);
    }
    return v;
}
function resolveDynamicValues(block,input={}) {
    validateDynamicDefinition(block);
    if(!input||Array.isArray(input)||typeof input!=='object')throw new Error('Invalid dynamic parameter values');
    const definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p])), values=Object.create(null), writers=new Map();
    const constants=resolveParameters(block.parameters||{});
    for(const key of Object.keys(input))if(!definitions.has(key))throw new Error(`Unknown dynamic parameter: ${key}`);
    for(const p of definitions.values())values[p.name]=valueOf(p,own(input,p.name)?input[p.name]:p.default);
    const lookups=block.dynamic.actions.filter(a=>a.type==='lookup');
    for(const a of lookups){
        if(!a.rows||typeof a.rows!=='object')throw new Error('Lookup action requires rows');
        for(const row of Object.values(a.rows))for(const key of Object.keys(row)){
            if(!definitions.has(key)||key===a.parameter||writers.has(key)&&writers.get(key)!==a||definitions.get(key).expression!==undefined)throw new Error('Invalid or ambiguous lookup dependency');
            writers.set(key,a);valueOf(definitions.get(key),row[key]);
        }
    }
    const visited=new Set(),active=new Set();
    function resolve(name){
        if(!definitions.has(name)){if(own(constants,name))return constants[name];throw new Error('Unknown dynamic expression parameter: '+name);}
        if(visited.has(name))return values[name];if(active.has(name))throw new Error('Dynamic parameter / lookup cycle: '+[...active,name].join(' → '));active.add(name);
        const p=definitions.get(name),writer=writers.get(name);
        if(p.expression!==undefined){
            if(!['number','distance','angle','integer'].includes(p.type))throw new Error('Expressions require numeric parameters');
            const dependencies=Object.fromEntries(parameterDependencies(p.expression).map(key=>[key,resolve(key)]));
            values[name]=valueOf(p,evaluateExpression(p.expression,dependencies));
        }else if(writer){
            const key=String(resolve(writer.parameter));if(!own(writer.rows,key)||!own(writer.rows[key],name))throw new Error('No lookup row for selected value');
            values[name]=valueOf(p,writer.rows[key][name]);
        }
        active.delete(name);visited.add(name);return values[name];
    }
    for(const p of definitions.values())resolve(p.name);
    return values;
}
/** Pure bounded evaluation. Geometric transforms are supplied by the host model. */
function evaluateDynamicDefinition(block,input,transformEntity,{maxEntities=10000}={}) {
    if(!Number.isSafeInteger(maxEntities)||maxEntities<1||maxEntities>100000||block.entities.length>maxEntities)throw new Error('Invalid dynamic entity budget');
    const values=resolveDynamicValues(block,input),definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p]));
    const result={...block,entities:clone(block.entities),ports:clone(block.ports||[])};
    delete result.dynamic;
    for(const a of block.dynamic.actions) {
        if(a.type==='lookup')continue;
        const p=definitions.get(a.parameter),value=values[a.parameter],delta=typeof value==='number'?value-p.default:0;
        const selected=e=>!a.entities||a.entities.includes(e.id),portSelected=p=>!a.ports||a.ports.includes(p.name);
        if(a.type==='visibility'){
            const key=String(value);if(!own(a.states,key))throw new Error('No visibility state for selected value');
            const scope=new Set(a.entities||Object.values(a.states).flat());
            for(const e of result.entities)if(scope.has(e.id))e.hidden=!!e.hidden||!a.states[key].includes(e.id);
            continue;
        }
        if(a.type==='stretch') {
            const direction=a.direction||{x:1,y:0},m=matrix({x:direction.x*delta,y:direction.y*delta});
            for(const e of result.entities.filter(selected)){
                if(e.extrusion && (e.extrusion.x||e.extrusion.y||e.extrusion.z!==1))throw new Error('Stretch requires default OCS');
                const points=e.type==='LINE'?[e.a,e.b]:['LWPOLYLINE','POLYLINE'].includes(e.type)?e.points:e.type==='SPLINE'?e.controlPoints:null;
                if(points){
                    const chosen=points.filter(p=>inside(p,a.box));
                    if(chosen.length===0)continue;
                    if(chosen.length===points.length)transformEntity(e,m);
                    else {
                        if(points.some(p=>p.bulge)||e.type==='POLYLINE'&&(e.flags&(16|64)))throw new Error('Partial stretch would invalidate curved or mesh topology');
                        for(const p of chosen)Object.assign(p,transform(p,m));
                    }
                } else if(['CIRCLE','ARC','TEXT','MTEXT','POINT'].includes(e.type)){
                    if(inside(e.c||e.p,a.box))transformEntity(e,m);
                } else throw new Error(`Stretch is not supported for ${e.type}`);
            }
            for(const p of result.ports)if(portSelected(p)&&inside(p,a.box))Object.assign(p,transform(p,m));
            continue;
        }
        if(a.type==='polar-array'){
            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Polar array count must be 1–256');
            const originals=result.entities.filter(selected),sweep=a.angleParameter?values[a.angleParameter]:(a.angle??360);
            finite(sweep,'array sweep');if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');
            for(let i=1;i<value;i++)for(const e of originals){const copy=clone(e);copy.id=`${e.id}:polar:${i}`;transformEntity(copy,pivot(matrix({rotation:sweep*i/value}),a.base));result.entities.push(copy);}
            continue;
        }
        if(a.type==='array'){
            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Array count must be 1–256');
            const originals=result.entities.filter(selected);if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');
            const step=a.step||{x:10,y:0};
            for(let i=1;i<value;i++)for(const e of originals){const c=clone(e);c.id=`${e.id}:array:${i}`;transformEntity(c,matrix({x:step.x*i,y:step.y*i}));result.entities.push(c);}
            continue; // Named terminals describe the original cell; no implicit port duplication.
        }
        let m;
        if(a.type==='polar'){
            const angle=a.angleParameter?values[a.angleParameter]:(a.angle??0);finite(angle,'polar angle');
            const initialAngle=a.angleParameter?definitions.get(a.angleParameter).default:(a.angle??0),r=angle*Math.PI/180,q=initialAngle*Math.PI/180;
            m=matrix({x:value*Math.cos(r)-p.default*Math.cos(q),y:value*Math.sin(r)-p.default*Math.sin(q)});
        }
        if(a.type==='move'){const d=a.direction||{x:1,y:0};m=matrix({x:d.x*delta,y:d.y*delta});}
        if(a.type==='rotate')m=pivot(matrix({rotation:delta}),a.base);
        if(a.type==='scale'){const ratio=value/p.default;if(!(ratio>0)||!Number.isFinite(ratio))throw new Error('Dynamic scale requires positive nonzero reference and value');m=pivot(matrix({sx:ratio,sy:ratio}),a.base);}
        if(a.type==='flip'){
            if(typeof value!=='boolean')throw new Error('Flip needs a boolean parameter');if(value===p.default)continue;
            const d=a.direction||{x:0,y:1},len=Math.hypot(d.x,d.y);if(len<1e-9)throw new Error('Flip axis must be nonzero');
            const x=d.x/len,y=d.y/len;m=pivot([2*x*x-1,2*x*y,2*x*y,2*y*y-1,0,0],a.base);
        }
        if(!m||!m.every(Number.isFinite))throw new Error('Invalid dynamic transform');
        for(const e of result.entities.filter(selected)){
            if(a.type==='flip'&&['INSERT','TEXT','MTEXT','ELLIPSE','HATCH'].includes(e.type))throw new Error(`Mirrored ${e.type} needs a specialized transform`);
            transformEntity(e,m);
        }
        for(const p of result.ports.filter(portSelected)){
            const q=transform(p,m),v=transform({x:p.x+(p.dx||0),y:p.y+(p.dy||0)},m);Object.assign(p,q,{dx:v.x-q.x,dy:v.y-q.y});
        }
    }
    // Constraint-based blocks solve a pristine post-action sketch for each parameter set.
    const constraints=block.dynamic.constraints||block.constraints||[];
    if(constraints.length){
        const parameters={...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))};
        const report=new ConstraintSolver().solve(result.entities,constraints,parameters);
        if(!report.converged)throw new Error('Dynamic block constraints conflict: '+report.conflicts.join(', '));
        result.solveReport=report;
    }
    regenerateDimensions({entities:result.entities,dimstyles:block.dimstyles||{}});
    evaluateCalculations(result.entities,constraints,{...block.parameters,...Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number'))});
    for(const port of result.ports)if(port.anchor){
        const e=result.entities.find(e=>e.id===port.anchor.entityId),key=port.anchor.point;
        const p=/^points\.\d+$/.test(key)?e?.points?.[Number(key.slice(7))]:['a','b','c','p'].includes(key)?e?.[key]:null;
        if(!p)throw new Error('Invalid solved port anchor');port.x=p.x;port.y=p.y;
        if(port.anchor.followDirection&&e.type==='LINE'){const n=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),sign=port.anchor.reverse?-1:1;port.dx=sign*(e.b.x-e.a.x)/n;port.dy=sign*(e.b.y-e.a.y)/n;}
    }
    // Guard every coordinate, not only parameters. Prevent invalid buffers downstream.
    const check=v=>{if(typeof v==='number')finite(v,'geometry');else if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};
    for(const e of result.entities)check(e);for(const p of result.ports)check(p);result.dynamicValues=values;return result;
}

return {validateDynamicDefinition,resolveDynamicValues,evaluateDynamicDefinition};
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
// packages/model/src/interop.js
__modules["packages/model/src/interop.js"]=(()=>{
const {matrix, compose, bounds, splinePoints} = __modules["packages/geometry/src/index.js"];
const {inPolygon} = __modules["packages/model/src/fidelity.js"];
/** Top-view WCS -> paper DCS. Twist is applied before the DCS center offset. */
function viewportTransform(e) {
    const d=e.viewDirection||{x:0,y:0,z:1};
    if((e.viewportFlags&7)||Math.abs(d.x)>1e-9||Math.abs(d.y)>1e-9||d.z<=0) return null;
    const s=e.viewportHeight/e.viewHeight;
    if(!(s>0)||!Number.isFinite(s))return null;
    const c=e.viewCenter||{x:0,y:0},target=e.viewTarget||{x:0,y:0};
    return compose(matrix({x:e.c.x-c.x*s,y:e.c.y-c.y*s}),compose(matrix({sx:s,sy:s,rotation:e.viewTwist||0}),matrix({x:-target.x,y:-target.y})));
}
function viewportRectangle(e) {
    const {x,y}=e.c,w=e.viewportWidth/2,h=e.viewportHeight/2;
    return [{x:x-w,y:y-h},{x:x+w,y:y-h},{x:x+w,y:y+h},{x:x-w,y:y+h}];
}
function insideClips(p,clips) {
    return !clips || clips.every(polygon=>inPolygon(p,polygon));
}
function wipeoutPoints(e) {
    let vertices=e.boundary||[];
    if(e.boundaryType===1&&vertices.length===2) {
        const [a,b]=vertices;vertices=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];
    }
    const p=e.p,u=e.uPixel,v=e.vPixel,height=e.imageSize?.y??1;
    return vertices.map(q=>({x:p.x+u.x*(q.x+.5)+v.x*(height-q.y-.5),y:p.y+u.y*(q.x+.5)+v.y*(height-q.y-.5)}));
}
function helixPoints(e,tolerance=.25) {
    const spline=e.helixSpline;
    if(spline?.controlPoints?.length && spline.knots?.length)return splinePoints(spline,tolerance);
    const a=e.axis||{x:0,y:0,z:1},l=Math.hypot(a.x,a.y,a.z);if(!l)return [];
    const n={x:a.x/l,y:a.y/l,z:a.z/l},b=e.axisBase,s=e.startPoint;
    if(!b||!s||!(e.radius>0)||!Number.isFinite(e.turns)||!Number.isFinite(e.turnHeight))return [];
    const v={x:s.x-b.x,y:s.y-b.y,z:(s.z||0)-(b.z||0)},dot=v.x*n.x+v.y*n.y+v.z*n.z;
    const radial={x:v.x-dot*n.x,y:v.y-dot*n.y,z:v.z-dot*n.z},r=Math.hypot(radial.x,radial.y,radial.z);if(!r)return [];
    const u={x:radial.x/r*e.radius,y:radial.y/r*e.radius,z:radial.z/r*e.radius};
    const w={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};
    const steps=Math.min(8192,Math.max(16,Math.ceil(Math.abs(e.turns)*Math.PI*2*Math.sqrt(e.radius/Math.max(tolerance,1e-8))))),sign=e.handedness===false?-1:1;
    return Array.from({length:steps+1},(_,i)=>{const f=i/steps,theta=sign*f*e.turns*Math.PI*2,z=f*e.turns*e.turnHeight;return {x:s.x-u.x+u.x*Math.cos(theta)+w.x*Math.sin(theta)+n.x*z,y:s.y-u.y+u.y*Math.cos(theta)+w.y*Math.sin(theta)+n.y*z,z:(s.z||0)-u.z+u.z*Math.cos(theta)+w.z*Math.sin(theta)+n.z*z};});
}

return {viewportTransform,viewportRectangle,insideClips,wipeoutPoints,helixPoints};
})();
// packages/model/src/index.js
__modules["packages/model/src/index.js"]=(()=>{
const {blockSignature, blockReferences, beginBlockDraft, blockFromDraft, prepareBlockDraft, renameBlockInDocument, copyBlockInDocument, syncAttributes, createBlockInDocument, removeBlockInDocument} = __modules["packages/model/src/blocks.js"];
const {linearHatchGradient} = __modules["packages/model/src/gradients.js"];
const {dimensionPicture:buildDimensionPicture, editDimension:applyDimensionEdit, dimensionGrips:getDimensionGrips, regenerateDimensions:refreshDimensions} = __modules["packages/model/src/dimensions.js"];
const {validateDynamicDefinition, resolveDynamicValues, evaluateDynamicDefinition} = __modules["packages/model/src/dynamic.js"];
const {viewportTransform, viewportRectangle, wipeoutPoints, helixPoints} = __modules["packages/model/src/interop.js"];
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
    let hasInfinite = false;
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
        case 'MESH': {
            const edges=new Set();
            const edge=(a,b)=>{const id=a<b?a+':'+b:b+':'+a;if(edges.has(id))return;edges.add(id);if(e.points?.[a]&&e.points?.[b])path([e.points[a],e.points[b]]);};
            for(const face of e.faces||[])for(let i=0;i<face.length;i++)edge(face[i],face[(i+1)%face.length]);
            for(const [a,b] of e.edges||[])edge(a,b);
            break;
        }
        case 'HELIX': path(helixPoints(e,curveTolerance)); break;
        case 'WIPEOUT': path(wipeoutPoints(e),true,'#fbfcfb',{stroke:false}); break;
        case 'VIEWPORT': {
            if(e.viewportId===1)break;
            const rectangle=viewportRectangle(e);
            path(rectangle,true);
            if(e.viewportStatus===0||(e.viewportFlags&131072))break;
            const projection=viewportTransform(e);
            if(!projection){warnings.push({severity:'warning',type:'VIEWPORT',message:'Only top-view orthographic viewport contents can be rendered.'});break;}
            let clip=rectangle;
            if(e.clipHandle) {
                const boundary=doc.entities.find(q=>String(q._dxf?.handle||'').toUpperCase()===String(e.clipHandle).toUpperCase());
                const candidate=boundary && boundary.type!=='VIEWPORT' ? entityGeometry(boundary,doc,{tolerance:curveTolerance,depth:depth+1}).paths.find(p=>p.closed):null;
                if(!candidate){warnings.push({severity:'warning',type:'VIEWPORT',message:'Unresolved or unsupported viewport clipping boundary; content is not drawn.'});break;}
                clip=candidate.points;
            }
            const worldClip=clip.map(p=>transform(p,m)), rectangularClip=rectangle.map(p=>transform(p,m));
            const frozen=new Set((e.frozenLayers||[]).map(n=>n.toUpperCase()));
            const model={...doc,activeLayout:'Model',layers:doc.layers.map(l=>frozen.has(l.name.toUpperCase())?{...l,visible:false}:l)};
            for(const child of doc.entities) {
                if(child.type==='VIEWPORT'||!isVisible(child,model))continue;
                const g=entityGeometry(child,model,{matrix:compose(m,projection),tolerance,depth:depth+1});
                hasInfinite ||= !!g.hasInfinite;
                warnings.push(...(g.warnings||[]));
                const clips=[rectangularClip,worldClip];
                for(const p of g.paths)paths.push({...p,clips:[...(p.clips||[]),...clips],entityId:e.id});
                for(const t of g.texts)texts.push({...t,clips:[...(t.clips||[]),...clips],entityId:e.id});
            }
            break;
        }
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
                if (contours.length) path(contours[0], true, style.color, { stroke: false, contours: contours.map(p => p.map(v => transform(v, m))), fillRule: 'evenodd', gradient: linearHatchGradient(e.gradient,contours,m) });
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
            hasInfinite = true;
            const p = transform(e.p, m), q = transform(add(e.p, e.direction), m), d = sub(q, p), v = options.view || { minX: p.x - 10000, maxX: p.x + 10000, minY: p.y - 10000, maxY: p.y + 10000 };
            let lo = e.type === 'RAY' ? 0 : -Infinity, hi = Infinity;
            for (const axis of ['x', 'y']) {
                const min = v[axis === 'x' ? 'minX' : 'minY'], max = v[axis === 'x' ? 'maxX' : 'maxY'];
                if (Math.abs(d[axis]) < 1e-12) { if (p[axis] < min || p[axis] > max) hi = -Infinity; }
                else { const a = (min - p[axis]) / d[axis], b = (max - p[axis]) / d[axis]; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }
            }
            if (hi >= lo && Number.isFinite(lo) && Number.isFinite(hi)) paths.push({ points: [add(p, mul(d, lo)), add(p, mul(d, hi))], ...style, infinite: true, entityId: e.id });
            break;
        }
        case 'DIMENSION': {
            if (e.dimension?.version === 1) {
                try {
                    const picture = buildDimensionPicture(e,doc);
                    for (const child of picture.entities) {
                        const g=entityGeometry(child,doc,{...options,matrix:m,depth:depth+1,parentStyle:style,parentLayer:layerFor(e,doc)});
                        hasInfinite ||= !!g.hasInfinite;
                        paths.push(...g.paths.map(p=>({...p,entityId:e.id})));texts.push(...g.texts.map(t=>({...t,entityId:e.id})));
                    }
                } catch(error) { warnings.push({entityId:e.id,message:error.message}); }
                break;
            }
            if (e.block && doc.blocks[e.block]) {
                const g = entityGeometry({ ...e, type: 'INSERT', x: e.dimensionInsert?.x || 0, y: e.dimensionInsert?.y || 0, z: e.dimensionInsert?.z || 0 }, doc, { ...options, depth: depth + 1 });
                hasInfinite ||= !!g.hasInfinite;
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
            let block;try{block=effectiveBlock(e,doc);}catch(error){warnings.push({entityId:e.id,message:error.message});break;}
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
                        hasInfinite ||= !!g.hasInfinite;
                        for (const t of g.texts)
                            texts.push({ ...t, entityId: e.id });
                    }
                    for (const child of block.entities || []) {
                        if ((child.type === 'ATTDEF' && !(child.constant || ((child.attributeFlags ?? child.flags ?? 0)&2))) || child.hidden)
                            continue;
                        const cl = (child.layer === '0') ? (e.layer === '0' && parentLayer ? parentLayer : layerFor(e, doc)) : layerFor(child, doc);
                        if (cl?.visible === false)
                            continue;
                        const g = entityGeometry(child, doc, { matrix: mm, tolerance, depth: depth + 1, parentStyle: style, parentLayer: cl, view: options.view });
                        hasInfinite ||= !!g.hasInfinite;
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
    return { paths, texts, ...(warnings.length ? { warnings } : {}), ...(hasInfinite ? { hasInfinite: true } : {}) };
}
function entityBounds(e, doc) {
    if(e.type==='VIEWPORT')return e.viewportId===1?emptyBounds():bounds(viewportRectangle(e));
    if (['RAY', 'XLINE'].includes(e.type)) return bounds([e.p]);
    const g = entityGeometry(e, doc, { tolerance: 1 }), pts = g.paths.filter(p => !p.infinite).flatMap(p => p.contours ? p.contours.flat() : p.points);
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
    const block = effectiveBlock(e,doc), base = block?.base || { x: 0, y: 0 };
    const m = compose(matrix(e), matrix({ x: -base.x, y: -base.y }));
    return (block?.ports || []).map(p => { const q = transform(p, m), v = transform({ x: p.x + (p.dx || 0), y: p.y + (p.dy || 0) }, m); return { ...p, ...q, dx: v.x - q.x, dy: v.y - q.y, entityId: e.id }; });
}
function moveEntity(e, dx, dy) {
    if(e.type==='VIEWPORT'&&e.clipHandle)throw new Error('Moving a clipped viewport requires moving its boundary in the same transaction; no coordinates were changed.');
    if(e.type==='DIMENSION'&&e.block&&e.dimension?.version!==1)throw new Error('Moving a dimension with a graphics block requires regeneration; no coordinates were changed.');
    if(e.type==='DIMENSION'&&e.dimension?.version===1){delete e.block;delete e.dimension.references;}
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
    for (const key of ['a', 'b', 'c', 'p', 'alignPoint', 'axisBase', 'startPoint', 'definitionPoint', 'textMidpoint', 'dimensionInsert', 'defpoint4', 'defpoint5'])
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
    if(e.type==='HELIX')for(const key of ['controlPoints','fitPoints'])for(const p of e.helixSpline?.[key]||[])mv(p);
    if (e.type === 'INSERT') {
        e.x += dx;
        e.y += dy;
        for (const a of e.attributes || [])
            moveEntity(a, worldDX, worldDY);
    }
    e.dirty = true;
}
function transformEntity(e, m) {
    if(['VIEWPORT','HELIX','WIPEOUT'].includes(e.type)||(e.type==='DIMENSION'&&e.block&&e.dimension?.version!==1))throw new Error('This native entity requires a specialized transform; no coordinates were changed.');
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]), determinant = m[0]*m[3]-m[1]*m[2];
    if (!m.every(Number.isFinite) || sx < 1e-12 || sy < 1e-12) throw new Error('Singular or nonfinite CAD transform.');
    if (e.extrusion && (Math.abs(e.extrusion.x || 0) > 1e-9 || Math.abs(e.extrusion.y || 0) > 1e-9 || e.extrusion.z < 0))
        throw new Error('Rotation of non-default OCS geometry requires a 3D transform; coordinates were not modified.');
    if (['HATCH','CIRCLE','ARC','INSERT'].includes(e.type) && (Math.abs(sx-sy) > 1e-8*Math.max(sx,sy) || Math.abs(m[0]*m[2]+m[1]*m[3]) > 1e-8*sx*sy))
        throw new Error('This entity requires a similarity transform; nonuniform scale would change its native type.');
    if (e.type === 'HATCH' && determinant < 0) throw new Error('Mirroring native hatch edge paths is not supported; coordinates were not modified.');
    if(e.type==='DIMENSION' && e.dimension?.version===1) {
        if(determinant<=0||Math.abs(sx-sy)>1e-8*Math.max(sx,sy)||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-8*sx*sy)throw new Error('Dimensions require an orientation-preserving similarity transform');
        for(const k of ['a','b','definitionPoint','defpoint4','defpoint5','textMidpoint'])if(e[k])Object.assign(e[k],transform(e[k],m));
        if(e.offset!==undefined)e.offset*=sx;
        if(((e.dimtype??33)&15)===0)e.dimensionAngle=(e.dimensionAngle||0)+Math.atan2(m[1],m[0])*180/Math.PI;
        if(e.textRotation!==undefined)e.textRotation+=Math.atan2(m[1],m[0])*180/Math.PI;
        e.dimension.style={...e.dimension.style,dimscale:(e.dimension.style?.dimscale??e.dimension.resolvedScale??e.dimstyleOverrides?.dimscale??1)*sx};
        delete e.block;delete e.dimension.references;e.dirty=true;return;
    }
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
    if(e.type==='HATCH' && e.gradient){const rotation=Math.atan2(m[1],m[0]);const angle=e.gradient.find(p=>p[0]===460);if(angle)angle[1]+=rotation;else e.gradient.push([460,rotation]);}
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
function explodeEntity(e, doc) { if (e.type === 'VIEWPORT') throw new Error('A clipped viewport cannot be exploded without clipping its native geometry'); const g = entityGeometry(e, doc, { tolerance: .05 }); if(g.paths.some(p=>p.gradient))throw new Error('Gradient hatch explosion requires retaining native fill semantics'); return [...g.paths.map(p => polyline(p.points, p.closed, { layer: e.layer, color: p.color, width: p.width, dash: p.dash, fill: p.fill })), ...g.texts.map(t => text(t.p, t.text, t.height, { layer: e.layer, color: t.color, rotation: t.rotation, align: t.align }))]; }
function detachReferences(doc, deleted) {
    for (const e of doc.entities) {
        if(e.dimension?.references)for(const [key,ref]of Object.entries(e.dimension.references))if(deleted.has(ref.entityId))delete e.dimension.references[key];
        const c = e.connector;
        if (!c)
            continue;
        for (const end of ['from', 'to'])
            if (c[end] && deleted.has(c[end].entityId))
                c[end] = null;
    }
    doc.constraints = doc.constraints.filter(c => !(c.entities || [c.entityId]).some(id => deleted.has(id)));
}

// Reusable editing/evaluation APIs. Cyclic module imports are intentionally avoided.
function dimensionPicture(e,doc) { return buildDimensionPicture(e,doc); }
function editDimension(e,doc,patch) { return applyDimensionEdit(e,doc,patch); }
function dimensionGrips(e,doc) { return getDimensionGrips(e,doc); }
function regenerateDimensions(doc) { return refreshDimensions(doc); }
function validateDynamicBlock(block) { return validateDynamicDefinition(block); }
function dynamicValues(block,values={}) { return resolveDynamicValues(block,values); }
function evaluateDynamicBlock(block,values={},options={}) { return evaluateDynamicDefinition(block,values,transformEntity,options); }
function setDynamicParameters(e,doc,patch) {
    if(e.type!=='INSERT'||!doc.blocks[e.block]?.dynamic)throw new Error('Select a Conduit parameterized block');
    const values={...e.dynamicParameters,...patch};
    const evaluated=evaluateDynamicBlock(doc.blocks[e.block],values);
    const updated=structuredClone(e);syncAttributes(updated,evaluated,()=>uid('attribute'));
    e.attributes=updated.attributes;e.dynamicParameters={...evaluated.dynamicValues};e.dirty=true;return evaluated;
}
const dynamicCache=new WeakMap();
function effectiveBlock(e,doc) {
    const block=doc.blocks[e.block];if(!block?.dynamic)return block;
    const signature=JSON.stringify([block.entities,block.ports,block.dynamic,block.base,block.parameters,block.constraints]);
    let cache=dynamicCache.get(block);
    if(!cache||cache.signature!==signature){cache={signature,values:new Map()};dynamicCache.set(block,cache);}
    const key=JSON.stringify(e.dynamicParameters||{});
    if(!cache.values.has(key)){
        const evaluated=evaluateDynamicBlock(block,e.dynamicParameters||{});
        if(cache.values.size>=64)cache.values.delete(cache.values.keys().next().value);
        cache.values.set(key,evaluated);
    }
    return cache.values.get(key);
}

function dynamicParameterGrips(e,doc) {
    const b=doc.blocks[e.block];if(!b?.dynamic)return [];
    const values=dynamicValues(b,e.dynamicParameters||{}),m=compose(matrix(e),matrix({x:-(b.base?.x||0),y:-(b.base?.y||0)}));
    return b.dynamic.parameters.filter(p=>p.grip&&['distance','number','angle'].includes(p.type)).map(p=>{
        const g=p.grip,base=g.base||{x:0,y:0},d=g.direction||{x:1,y:0},v=values[p.name];
        const q=p.type==='angle'?{x:base.x+Math.cos(v*Math.PI/180)*(g.radius||40),y:base.y+Math.sin(v*Math.PI/180)*(g.radius||40)}:{x:base.x+d.x*v,y:base.y+d.y*v};
        return {...transform(q,m),key:'dyn:'+p.name};
    });
}
function dynamicGripValue(e,doc,name,world) {
    const b=doc.blocks[e.block],p=b?.dynamic?.parameters.find(p=>p.name===name),g=p?.grip;
    if(!g)throw new Error('Missing dynamic parameter grip');
    const m=compose(matrix(e),matrix({x:-(b.base?.x||0),y:-(b.base?.y||0)})),det=m[0]*m[3]-m[1]*m[2];
    if(Math.abs(det)<1e-12)throw new Error('Singular block transform');
    const dx=world.x-m[4],dy=world.y-m[5],q={x:(m[3]*dx-m[2]*dy)/det,y:(-m[1]*dx+m[0]*dy)/det};
    const base=g.base||{x:0,y:0},d=g.direction||{x:1,y:0},length=d.x*d.x+d.y*d.y;
    if(length<1e-12)throw new Error('Invalid grip direction');
    let value=p.type==='angle'?Math.atan2(q.y-base.y,q.x-base.x)*180/Math.PI:((q.x-base.x)*d.x+(q.y-base.y)*d.y)/length;
    value=Math.max(p.min??-Infinity,Math.min(p.max??Infinity,value));
    if(p.values?.length)value=p.values.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a);
    return value;
}

function blockDefinitionSignature(block) { return blockSignature(block); }
function inspectBlockReferences(doc,name) { return blockReferences(doc,name); }
function beginBlockEdit(doc,name) { return beginBlockDraft(doc,name); }
function editedBlockDefinition(session) { return blockFromDraft(session); }
function prepareBlockUpdate(doc,name,block,options={}) { return prepareBlockDraft(doc,name,block,options,evaluateDynamicBlock,()=>uid('attribute')); }
function updateBlockDefinition(doc,name,block,options={}) {
    const result=prepareBlockUpdate(doc,name,block,options);
    // Validate before touching any live object. Host history owns the transaction.
    Object.assign(doc,result.document);return result.report;
}
function renameBlockDefinition(doc,oldName,newName) { Object.assign(doc,renameBlockInDocument(doc,oldName,newName)); }
function duplicateBlockDefinition(doc,name,newName) { Object.assign(doc,copyBlockInDocument(doc,name,newName)); }

function createBlockDefinition(doc,name,definition={}) { Object.assign(doc,createBlockInDocument(doc,name,definition,evaluateDynamicBlock)); }
function deleteBlockDefinition(doc,name) { Object.assign(doc,removeBlockInDocument(doc,name)); }
function syncInsertAttributes(e,doc) {
    if(e.type!=='INSERT'||!doc.blocks[e.block])throw new Error('Select a valid block reference');
    const block=doc.blocks[e.block],evaluated=block.dynamic?evaluateDynamicBlock(block,e.dynamicParameters||{}):block,next=structuredClone(e);
    syncAttributes(next,evaluated,()=>uid('attribute'));e.attributes=next.attributes;e.dirty=true;return e.attributes;
}

return {textLayout,objectCoordinateTransform,uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences,dimensionPicture,editDimension,dimensionGrips,regenerateDimensions,validateDynamicBlock,dynamicValues,evaluateDynamicBlock,setDynamicParameters,dynamicParameterGrips,dynamicGripValue,blockDefinitionSignature,inspectBlockReferences,beginBlockEdit,editedBlockDefinition,prepareBlockUpdate,updateBlockDefinition,renameBlockDefinition,duplicateBlockDefinition,createBlockDefinition,deleteBlockDefinition,syncInsertAttributes};
})();
// packages/drawing/src/index.js
__modules["packages/drawing/src/index.js"]=(()=>{
const {entity, polyline, circle, editDimension} = __modules["packages/model/src/index.js"];
const {distance, bounds, TAU} = __modules["packages/geometry/src/index.js"];
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
const DRAWING_TOOLS = Object.freeze([
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
function drawingTool(id) { return DRAWING_TOOLS.find(t => t.id === id) || null; }

/** Translation/scale-conditioned circumcircle, avoiding cancellation at survey coordinates. */
function circumcircle(a, b, c) {
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
function interpolatingSpline(input, closed = false, props = {}) {
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
function validateBoundary(input) {
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

function hatchPattern(options = {}) {
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
function hatchFromEntities(entities, doc, options = {}, props = {}) {
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
function createDrawingEntity(id, input, options = {}, props = {}, doc = {}) {
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
class DrawingSession {
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
function parseDrawingPoint(source, previous = { x: 0, y: 0 }, evaluate = Number) {
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

return {DRAWING_TOOLS,drawingTool,circumcircle,interpolatingSpline,validateBoundary,hatchPattern,hatchFromEntities,createDrawingEntity,DrawingSession,parseDrawingPoint};
})();
// packages/workbench/src/icons.js
__modules["packages/workbench/src/icons.js"]=(()=>{
const paths = {
    arc: 'M3 18A9 9 0 0 1 21 18 M2 16h3v4H2z M19 16h3v4h-3z',
    ellipse: 'M22 12a10 6 0 1 1-20 0 10 6 0 0 1 20 0 M12 4v16 M2 12h20',
    spline: 'M3 18C5-3 18 28 21 6 M3 18 7 3 M17 21l4-15 M5 1h4v4H5z M15 19h4v4h-4z',
    polygon: 'M12 2l9 5v10l-9 5-9-5V7z',
    donut: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M17 12a5 5 0 1 0-10 0 5 5 0 0 0 10 0',
    solid: 'M3 20 9 3l12 14-18 3 M5 16l5-11 M8 19l5-11 M12 18l4-6 M16 17l2-2',
    hatch: 'M3 3h18v18H3z M3 11l8-8 M3 19 19 3 M9 21 21 9 M17 21l4-4',
    wipeout: 'M3 5h18v14H3z M8 9l8 6 M16 9l-8 6',
    point: 'M12 3v7 M12 14v7 M3 12h7 M14 12h7 M12 12h.01',
    ray: 'M3 19 21 1 M2 17h4v4H2z M15 1h6v6',
    xline: 'M2 22 22 2 M2 15v7h7 M15 2h7v7',
    mtext: 'M3 4h18 M3 9h18 M3 14h14 M3 19h10',
    leader: 'M3 20l9-12h10 M3 14v6h6',

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
// packages/workbench/src/drawing-workbench.js
__modules["packages/workbench/src/drawing-workbench.js"]=(()=>{
const {DRAWING_TOOLS, drawingTool, DrawingSession, createDrawingEntity, parseDrawingPoint, hatchFromEntities, validateBoundary} = __modules["packages/drawing/src/index.js"];
const {entity, polyline, clone, isLocked} = __modules["packages/model/src/index.js"];
const {distance, TAU} = __modules["packages/geometry/src/index.js"];
const {icon, escapeHTML} = __modules["packages/workbench/src/icons.js"];
const E = escapeHTML;
const number = n => Number(n.toFixed(6)).toString();
const action = (id, label, ic = 'properties') => `<button type="button" data-action="${id}" aria-label="${E(label)}">${icon(ic)}<span>${E(label)}</span></button>`;
const finite = (value, name, positive = false) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12 || (positive && value <= 1e-8)) throw new Error(`Invalid ${name}`);
    return value;
};
const defaults = { sides: 6, circumscribed: false, pattern: 'solid', angle: 45, spacing: 10, height: 12, text: 'Multiline text' };

function beginDrawing(w, id) {
    w.drawingSession = drawingTool(id) ? new DrawingSession(id, { ...defaults, ...w.drawingOptions?.[id] }) : null;
    if (w.drawingSession) w.draft = w.drawingSession.points;
}
function properties(w) {
    const layer = w.doc.layers.find(l => l.name === w.currentLayer) || w.doc.layers.find(l => l.name === '0') || w.doc.layers[0];
    if (!layer || layer.locked || layer.visible === false) throw new Error('Choose a visible, unlocked drawing layer');
    return { layer: layer.name, layout: w.doc.activeLayout };
}
function commitDrawing(w, e) {
    const p = properties(w); Object.assign(e, p);
    w.edit('Draw ' + (drawingTool(w.tool)?.label || e.type), () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
    // Leave the command armed for repeated placement, with no stale preview or points.
    beginDrawing(w, w.tool); w.preview = null; w.snap = null;
    w.updateTools(); w.updateSelection(); w.renderer.invalidate();
    return e;
}
function acceptDrawingPoint(w, p) {
    if (!w.drawingSession) throw new Error('Choose a drawing tool first');
    const e = w.drawingSession.add(p, properties(w), w.doc);
    if (e) commitDrawing(w, e);
    else { w.draft = w.drawingSession.points; w.preview = null; w.updateTools(); w.renderer.invalidate(); }
    return e;
}
function drawingPointerUp(w, drag, end, moved) {
    const session = w.drawingSession;
    if (!session) return;
    if (session.tool.drag && !session.points.length && moved > 6) acceptDrawingPoint(w, drag.start);
    acceptDrawingPoint(w, end);
}
function drawingPreview(w, a, b) {
    const session = w.drawingSession, props = { id: 'drawing-preview', layer: w.currentLayer, color: '#259e87', width: 1.7 };
    if (w.drag?.kind === 'native-draw' && session.tool.drag && !session.points.length) {
        try { return createDrawingEntity(w.tool, [a, b], session.options, props, w.doc); } catch { return polyline([a, b], false, props); }
    }
    return session.preview(b, props, w.doc);
}
function updateDrawingControls(w) {
    const session = w.drawingSession, path = w.tool === 'polyline', active = !!session || path;
    const hint = w.$('.tool-hint');
    if (session) hint.textContent = `${session.tool.label} · ${session.points.length + 1}${session.tool.count ? '/' + session.tool.count : ''}: ${session.prompt}`;
    const controls = w.$('.drawing-session-controls');
    if (!controls) return;
    controls.classList.toggle('hide', !active);
    controls.querySelector('[data-action="draw-back"]').disabled = !w.draft.length;
    controls.querySelector('[data-action="draw-close"]').classList.toggle('hide', !(path || session?.tool.canClose));
    controls.querySelector('[data-action="draw-close"]').disabled = w.draft.length < 3;
    controls.querySelector('[data-action="draw-options"]').classList.toggle('hide', !session?.tool.options);
    const finish = w.$('.finish-button');
    finish.classList.toggle('hide', !(path && w.draft.length >= 2 || session?.canFinish));
    finish.innerHTML = `${icon('check')} Finish`;
}
function finishDrawing(w, closed = false) {
    if (w.drawingSession) { commitDrawing(w, w.drawingSession.finish(closed, properties(w), w.doc)); return true; }
    if (closed && w.tool === 'polyline') {
        const points = validateBoundary(w.draft);
        const e = polyline(points, true, properties(w));
        w.edit('Draw closed polyline', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
        w.setTool('select'); return true;
    }
    return false;
}

function drawingToolSections(w) {
    const groups = new Map();
    for (const t of DRAWING_TOOLS) { if (!groups.has(t.group)) groups.set(t.group, []); groups.get(t.group).push(t); }
    return `<label class="field drawing-tool-search">Find a drawing tool<input data-drawing-search type="search" placeholder="Arc, hatch, spline, ordinate…" aria-label="Find a drawing tool"></label>` +
        [...groups].map(([group, tools]) => `<section class="drawing-tool-group"><h3>${E(group)}</h3><div class="operation-grid">${tools.map(t => `<button type="button" data-tool="${t.id}" data-tool-search="${E((t.label + ' ' + group + ' ' + t.id).toLowerCase())}" title="${E(t.steps.join(' → '))}">${icon(t.icon)}<span>${E(t.label)}</span></button>`).join('')}</div></section>`).join('') +
        `<div class="operation-grid">${action('hatch-selection', 'Hatch selected boundaries', 'hatch')}</div>`;
}
function bindDrawingSearch(w) {
    w.modal?.querySelector('[data-drawing-search]')?.addEventListener('input', event => {
        const q = event.target.value.toLowerCase().trim();
        for (const b of w.modal.querySelectorAll('[data-tool-search]')) b.hidden = !b.dataset.toolSearch.includes(q);
        for (const section of w.modal.querySelectorAll('.drawing-tool-group')) section.hidden = ![...section.querySelectorAll('[data-tool-search]')].some(b => !b.hidden);
    });
}
function drawingOptionsDialog(w, selected = false) {
    const id = selected ? 'hatch' : w.tool, current = { ...defaults, ...w.drawingOptions?.[id], ...(!selected ? w.drawingSession?.options : {}) };
    let fields = '';
    if (id === 'polygon') fields = `<label class="field">Sides<input name="sides" value="${current.sides}" inputmode="numeric"></label><label class="field">Construction<select name="circumscribed"><option value="false">Inscribed · pick vertex</option><option value="true" ${current.circumscribed ? 'selected' : ''}>Circumscribed · pick side midpoint</option></select></label>`;
    if (id === 'hatch') fields = `<label class="field">Fill<select name="pattern">${['solid', 'lines', 'cross'].map(p => `<option ${p === current.pattern ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label class="field">Line spacing<input name="spacing" value="${current.spacing}" inputmode="decimal"></label><label class="field">Angle · degrees<input name="angle" value="${current.angle}" inputmode="decimal"></label>`;
    if (id === 'mtext') fields = `<label class="field full">Text<textarea name="text" rows="5">${E(current.text)}</textarea></label><label class="field">Text height<input name="height" value="${current.height}" inputmode="decimal"></label>`;
    w.openModal(selected ? 'Hatch selected closed boundaries' : 'Drawing tool options', `<div class="fields">${fields}</div><p class="muted-note">${id === 'hatch' ? 'Closed circles, ellipses and planar polylines become native hatch boundaries with even-odd islands. The hatch is a non-associative snapshot. Line/cross patterns are user-defined.' : 'Numeric values accept parameter expressions. Settings are retained for this tool.'}</p><div class="error-text"></div>`, { confirm: selected ? 'Create hatch' : 'Apply', onConfirm: () => {
        const next = { ...current }, modal = w.modal;
        for (const input of modal.querySelectorAll('[name]')) next[input.name] = input.name === 'text' || input.name === 'pattern' ? input.value : input.name === 'circumscribed' ? input.value === 'true' : w.eval(input.value);
        if (id === 'polygon' && (!Number.isInteger(next.sides) || next.sides < 3 || next.sides > 512)) throw new Error('Use 3–512 polygon sides');
        if (id === 'hatch') { finite(next.spacing, 'spacing', true); finite(next.angle, 'angle'); }
        if (id === 'mtext') { finite(next.height, 'text height', true); if (!next.text.trim() || next.text.length > 16000) throw new Error('Enter 1–16000 text characters'); }
        if (selected) {
            const e = hatchFromEntities(w.selected(), w.doc, next, properties(w));
            w.edit('Hatch selected boundaries', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
        } else w.drawingSession.options = next;
        w.drawingOptions = { ...w.drawingOptions, [id]: next }; w.preview = null;
        w.closeModal(); w.updateTools(); w.renderer.invalidate();
    } });
}
function drawingAction(w, id) {
    if (id === 'draw-back') {
        if (w.drawingSession) w.drawingSession.undo(); else w.draft.pop();
        w.preview = null; w.updateTools(); w.renderer.invalidate(); return true;
    }
    if (id === 'draw-close') { finishDrawing(w, true); return true; }
    if (id === 'draw-cancel') { w.setTool('select'); return true; }
    if (id === 'draw-options' || id === 'hatch-selection') { drawingOptionsDialog(w, id === 'hatch-selection'); return true; }
    if (id === 'draw-exact-point') {
        w.ask('Next drawing point', [{ name: 'point', label: 'x,y · @dx,dy · @length<degrees', value: w.cursor ? `${number(w.cursor.x)},${number(w.cursor.y)}` : '0,0' }], values => {
            const p = parseDrawingPoint(values.point, w.draft.at(-1), s => w.eval(s));
            if (w.drawingSession) acceptDrawingPoint(w, p);
            else if (w.tool === 'polyline') { if (w.draft.length && distance(w.draft.at(-1), p) < 1e-8) throw new Error('Choose a distinct point'); w.draft.push(p); w.updateTools(); w.renderer.invalidate(); }
        }); return true;
    }
    if (id === 'native-vertices') { editVertices(w); return true; }
    return false;
}

/** Commands with no arguments arm their point-driven tool; arguments use the same factories. */
function drawingCommand(w, command, rest) {
    const aliases = { ARC: 'arc', A: 'arc', ARC3P: 'arc', ARCCENTER: 'arc-center', CIRCLE3P: 'circle-3p', CIRCLE2P: 'circle-diameter', ELLIPSE: 'ellipse', EL: 'ellipse', ELLIPSEARC: 'ellipse-arc', SPLINE: 'spline', SPL: 'spline', BEZIER: 'bezier', POLYGON: 'polygon', POINT: 'point', PO: 'point', RAY: 'ray', XLINE: 'xline', XL: 'xline', DONUT: 'donut', SOLID: 'solid', '3DFACE': 'face', HATCH: 'hatch', WIPEOUT: 'wipeout', LEADER: 'leader', MTEXT: 'mtext', DIMALI: 'dim-aligned', DIMLINEAR: 'dim-horizontal', DIMHORIZONTAL: 'dim-horizontal', DIMVERTICAL: 'dim-vertical', DIMRADIUS: 'dim-radius', DIMDIAMETER: 'dim-diameter', DIMANGULAR: 'dim-angular', DIMANGULAR2: 'dim-angular-lines', DIMORDINATEX: 'dim-ordinate-x', DIMORDINATEY: 'dim-ordinate-y' };
    if (command === 'NEXT') { acceptDrawingPoint(w, parseDrawingPoint(rest, w.draft.at(-1), s => w.eval(s))); return true; }
    if (command === 'FINISH') { w.finishPath(); return true; }
    if (command === 'CLOSE') { if (!finishDrawing(w, true)) throw new Error('No closable path is active'); return true; }
    const id = aliases[command]; if (!id) return false;
    if (!rest) { w.setTool(id); return true; }
    const pieces = rest.split(/\s+/), options = { ...defaults, ...w.drawingOptions?.[id] };
    if (id === 'polygon') options.sides = w.eval(pieces.shift());
    const pts = []; for (const piece of pieces) pts.push(parseDrawingPoint(piece, pts.at(-1), s => w.eval(s)));
    const e = createDrawingEntity(id, pts, options, properties(w), w.doc);
    // Exact commands do not destroy an unfinished interactive session on a rejected edit.
    w.edit(command + ' command', () => { w.doc.entities.push(e); w.selection = new Set([e.id]); });
    return true;
}

function planar(e) {
    const n = e.extrusion;
    return !(n && (Math.abs(n.x || 0) > 1e-10 || Math.abs(n.y || 0) > 1e-10 || Math.abs((n.z ?? 1) - 1) > 1e-10));
}
function nativeGrips(e) {
    if (!planar(e)) return [];
    if (e.type === 'ARC') return [{ ...e.c, key: 'c' }, ...['start', 'end'].map(k => ({ x: e.c.x + e.r * Math.cos(e[k]), y: e.c.y + e.r * Math.sin(e[k]), key: `native:${k}` })), { x: e.c.x + e.r, y: e.c.y, key: 'radius' }];
    if (e.type === 'ELLIPSE') {
        const a = e.major, n = { x: -a.y * e.ratio, y: a.x * e.ratio };
        return [{ ...e.c, key: 'c' }, { x: e.c.x + a.x, y: e.c.y + a.y, key: 'native:major' }, { x: e.c.x + n.x, y: e.c.y + n.y, key: 'native:minor' }];
    }
    if (e.type === 'SPLINE') return (e.controlPoints || []).slice(0, 512).map((p, i) => ({ ...p, key: 'native:control', index: i }));
    if (e.type === 'XLINE' || e.type === 'RAY') return [{ ...e.p, key: 'p' }, { x: e.p.x + e.direction.x * 50, y: e.p.y + e.direction.y * 50, key: 'native:direction' }];
    if (e.type === 'HATCH' && !e.associative && !e.loops?.some(l => l.edges?.length)) return (e.loops || []).flatMap((l, i) => (l.points || []).map((p, j) => ({ ...p, key: 'native:hatch-point', loop: i, index: j }))).slice(0, 512);
    return null;
}
function changeNativeGrip(e, g, q) {
    if (!g.key.startsWith('native:')) return false;
    if (!planar(e)) throw new Error('Projected OCS geometry has no planar native grips');
    const key = g.key.slice(7);
    if (key === 'start' || key === 'end') { if (distance(e.c, q) < 1e-8) throw new Error('Arc endpoint cannot be its center'); e[key] = Math.atan2(q.y - e.c.y, q.x - e.c.x); }
    else if (key === 'major') { const x = q.x - e.c.x, y = q.y - e.c.y; finite(Math.hypot(x, y), 'major axis', true); e.major = { ...e.major, x, y }; }
    else if (key === 'minor') { const a = e.major, r = Math.abs((q.x - e.c.x) * -a.y + (q.y - e.c.y) * a.x) / (a.x * a.x + a.y * a.y); if (r > 1) throw new Error('Minor radius cannot exceed the major radius'); e.ratio = finite(r, 'minor axis', true); }
    else if (key === 'control') {
        const closed = e.closed && distance(e.controlPoints[0], e.controlPoints.at(-1)) < 1e-8;
        e.controlPoints[g.index] = { ...e.controlPoints[g.index], ...q };
        if (closed && (g.index === 0 || g.index === e.controlPoints.length - 1)) { e.controlPoints[0] = { ...q }; e.controlPoints[e.controlPoints.length - 1] = { ...q }; }
        e.fitPoints = []; // Controls now define the edited spline; stale fit data must not survive.
    } else if (key === 'direction') { const dx = q.x - e.p.x, dy = q.y - e.p.y, l = finite(Math.hypot(dx, dy), 'direction', true); e.direction = { x: dx / l, y: dy / l, z: 0 }; }
    else if (key === 'hatch-point') { e.loops[g.loop].points[g.index] = { ...e.loops[g.loop].points[g.index], ...q }; if (!e.loops[g.loop].points.some(p => p.bulge)) validateBoundary(e.loops[g.loop].points); }
    else throw new Error('Unknown native grip');
    return true;
}
function renderDrawingInspector(w, e, host) {
    if (!e || w.inspectorTab !== 'properties') return;
    const field = (key, label, value) => `<label class="field"><span>${E(label)}</span><input data-native-prop="${key}" value="${E(value)}" inputmode="decimal"></label>`;
    let fields = '', content = '';
    if (e.type === 'ARC') fields = field('start', 'Start · degrees', number(e.start * 180 / Math.PI)) + field('end', 'End · degrees', number(e.end * 180 / Math.PI));
    if (e.type === 'ELLIPSE') fields = field('majorX', 'Major axis X', number(e.major.x)) + field('majorY', 'Major axis Y', number(e.major.y)) + field('ratio', 'Minor / major', number(e.ratio)) + field('ellipseStart', 'Start parameter · degrees', number((e.start || 0) * 180 / Math.PI)) + field('ellipseEnd', 'End parameter · degrees', number((e.end ?? TAU) * 180 / Math.PI));
    if (e.type === 'RAY' || e.type === 'XLINE') fields = field('directionAngle', 'Direction · degrees', number(Math.atan2(e.direction.y, e.direction.x) * 180 / Math.PI));
    if (e.type === 'MTEXT') fields = `<label class="field full">Multiline content<textarea data-native-prop="mtextContent" rows="4">${E(e.text.replace(/\\P/g, '\n'))}</textarea></label>` + field('mtextWidth', 'Reference-box width', number(e.mtextWidth || 0)) + field('attachment', 'Attachment · 1–9', e.attachment || 1);
    if (e.type === 'LWPOLYLINE') fields = field('constantWidth', 'Constant width', e.constantWidth || 0);
    const hasVertices = ['LWPOLYLINE', 'POLYLINE', 'LEADER', 'SOLID', '3DFACE', 'SPLINE'].includes(e.type);
    if (hasVertices) content = `<p class="muted-note">${e.controlPoints?.length || e.points?.length || 0} ${e.type === 'SPLINE' ? 'native control points; edits preserve knots and weights' : 'native vertices'}. Grip editing and exact coordinates retain the entity type.</p>${action('native-vertices', 'Edit vertices / controls', 'polyline')}`;
    if (e.type === 'CIRCLE' || e.type === 'ELLIPSE' || ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.closed)) content += action('hatch-selection', 'Hatch this boundary', 'hatch');
    if (!fields && !content) return;
    const section = document.createElement('section'); section.className = 'inspector-section native-entity-editor';
    section.innerHTML = `<h3>Native ${E(e.type)} editing</h3><div class="fields">${fields}</div>${content}`; host.append(section);
}
function nativePropertyChange(w, target) {
    const key = target.dataset.nativeProp;
    if (!key) return false;
    const e = w.selected()[0]; if (!e || w.selection.size !== 1) return true;
    if (isLocked(e, w.doc) || !planar(e)) throw new Error('Unlock and use planar geometry before editing native parameters');
    const v = key === 'mtextContent' ? target.value : finite(w.eval(target.value), key);
    w.edit('Edit native ' + key, () => {
        if (key === 'mtextContent') { if (v.length > 16000) throw new Error('Text is too long'); e.text = v.replace(/\r\n?/g, '\n').replace(/\n/g, '\\P'); }
        else if (key === 'start' || key === 'end') e[key] = v * Math.PI / 180;
        else if (key === 'ellipseStart' || key === 'ellipseEnd') e[key === 'ellipseStart' ? 'start' : 'end'] = v * Math.PI / 180;
        else if (key === 'majorX' || key === 'majorY') { e.major[key === 'majorX' ? 'x' : 'y'] = v; finite(Math.hypot(e.major.x, e.major.y), 'major axis', true); }
        else if (key === 'ratio') { if (v > 1) throw new Error('Ellipse ratio must not exceed 1'); e.ratio = finite(v, 'ratio', true); }
        else if (key === 'directionAngle') e.direction = { x: Math.cos(v * Math.PI / 180), y: Math.sin(v * Math.PI / 180), z: 0 };
        else if (key === 'attachment') { if (!Number.isInteger(v) || v < 1 || v > 9) throw new Error('Attachment must be an integer 1–9'); e.attachment = v; }
        else if (key === 'mtextWidth' || key === 'constantWidth') { if (v < 0) throw new Error('Width cannot be negative'); e[key] = v; }
        else throw new Error('Unknown native property');
        e.dirty = true; w.reroute(new Set([e.id]));
    });
    return true;
}
function editVertices(w) {
    const e = w.selected()[0]; if (!e || isLocked(e, w.doc) || !planar(e)) throw new Error('Select one unlocked planar entity');
    if (e.type === 'POLYLINE' && (e.flags & (16 | 64))) throw new Error('Mesh topology is not editable in the vertex table');
    const controls = e.type === 'SPLINE', points = controls ? e.controlPoints : e.points;
    if (!points?.length || points.length > (controls ? 2048 : 512)) throw new Error('Exact editor supports 512 vertices or 2048 spline controls');
    const rows = points.map((p, i) => `<tr><th>${i + 1}</th><td><input data-vertex="${i}" data-axis="x" aria-label="Point ${i + 1} X" value="${p.x}" inputmode="decimal"></td><td><input data-vertex="${i}" data-axis="y" aria-label="Point ${i + 1} Y" value="${p.y}" inputmode="decimal"></td>${e.type === 'LWPOLYLINE' ? `<td><input data-vertex="${i}" data-axis="bulge" aria-label="Point ${i + 1} bulge" value="${p.bulge || 0}" inputmode="decimal"></td>` : ''}</tr>`).join('');
    w.openModal(controls ? 'Edit native spline control points' : 'Edit native vertices', `<p>Values accept expressions. Point count, Z and topology remain unchanged.</p><div class="native-vertex-scroll"><table><thead><tr><th>#</th><th>X</th><th>Y</th>${e.type === 'LWPOLYLINE' ? '<th>Bulge</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div><div class="error-text"></div>`, { confirm: 'Apply vertices', wide: true, onConfirm: () => {
        const next = clone(points);
        for (const input of w.modal.querySelectorAll('[data-vertex]')) next[+input.dataset.vertex][input.dataset.axis] = finite(w.eval(input.value), 'vertex');
        if (e.type === 'SOLID' || e.type === '3DFACE') {
            const triangle = points.length === 4 && distance(points[2], points[3]) < 1e-8;
            if (triangle && distance(next[3], points[3]) < 1e-8) next[3] = { ...next[2] };
            validateBoundary(next.length === 4 && distance(next[2], next[3]) < 1e-8 ? next.slice(0, 3) : next);
        }
        if (controls && e.closed && distance(points[0], points.at(-1)) < 1e-8 && distance(next[0], next.at(-1)) > 1e-8) {
            const firstChanged=distance(next[0],points[0])>1e-8, lastChanged=distance(next.at(-1),points.at(-1))>1e-8;
            if(firstChanged && lastChanged) throw new Error('Closed spline endpoint controls must coincide');
            if(firstChanged)next[next.length-1]={...next[0]};else next[0]={...next.at(-1)};
        }
        w.edit('Edit native vertices', () => { if (controls) { e.controlPoints = next; e.fitPoints = []; } else e.points = next; e.dirty = true; w.reroute(new Set([e.id])); });
        w.closeModal();
    } });
}

return {beginDrawing,commitDrawing,acceptDrawingPoint,drawingPointerUp,drawingPreview,updateDrawingControls,finishDrawing,drawingToolSections,bindDrawingSearch,drawingOptionsDialog,drawingAction,drawingCommand,nativeGrips,changeNativeGrip,renderDrawingInspector,nativePropertyChange};
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
// packages/workbench/src/parametric-workbench.js
__modules["packages/workbench/src/parametric-workbench.js"]=(()=>{
const {beginBlockEdit, editedBlockDefinition, updateBlockDefinition, inspectBlockReferences, duplicateBlockDefinition, renameBlockDefinition, evaluateDynamicBlock, clone, entity, uid, entityBounds, isLocked, regenerateDimensions, createBlockDefinition, deleteBlockDefinition, syncInsertAttributes} = __modules["packages/model/src/index.js"];
const {ConstraintSolver, resolveParameters, describeParameters, reservedParameterNames, constraintAnnotations, constraintMeasurement, evaluateExpression, inferSketchConstraints, evaluateCalculations} = __modules["packages/constraints/src/index.js"];
const {History} = __modules["packages/history/src/index.js"];
const {bounds} = __modules["packages/geometry/src/index.js"];
const {escapeHTML:E} = __modules["packages/workbench/src/icons.js"];
const B=(action,label)=>`<button class="btn" data-action="${action}">${label}</button>`;
const number=n=>Number.isFinite(n)?Number(n.toPrecision(8)).toString():'—';
const field=(name,label,value,type='input')=>`<label class="field">${E(label)}<${type} data-block-field="${name}" ${type==='input'?`value="${E(value)}"`:''}>${type==='textarea'?E(value):''}</${type}></label>`;
const readFields=w=>Object.fromEntries([...w.modal.querySelectorAll('[data-block-field]')].map(e=>[e.dataset.blockField,e.value]));
function cameraState(w){return {x:w.camera.x,y:w.camera.y,scale:w.camera.scale};}
function restoreHistory(w){return new History({capture:()=>w.doc,restore:d=>{w.doc=d;w.selection=new Set([...w.selection].filter(id=>d.entities.some(e=>e.id===id)));w.renderer.setDocument(d);w.updateUI();},onChange:()=>{w.updateHistory();w.updateUI();}});}
function startBlockEditor(w,name){
    if(w.blockSession)throw new Error('Save or close the current block editor first');
    const session=beginBlockEdit(w.doc,name);
    session.parentDocument=w.doc;session.parentHistory=w.history;session.parentSelection=[...w.selection];session.parentCamera=cameraState(w);session.parentLayer=w.currentLayer;session.parentCategory=w.category;
    w.closeModal();w.setTool('select');w.closePanels();w.blockSession=session;w.doc=session.draft;w.selection.clear();w.lastSolve=null;w.currentLayer='0';w.category='Custom';
    w.history=restoreHistory(w);w.renderer.setDocument(w.doc);w.updateUI();w.renderer.fit();renderBlockBar(w);w.openPanel('inspector');
}
function finishBlockEditor(w,save=false,stay=false,newName=null){
    const s=w.blockSession;if(!s)throw new Error('The block editor is not open');
    if(s.testing){endBlockTest(w);if(!save)return;}
    s.draft=w.doc;let report=null;
    if(save){
        const replacement=editedBlockDefinition(s),parent=s.parentDocument;
        const temporary=clone(parent);
        for(const [key,definition]of Object.entries(s.draft.blocks))if(!Object.hasOwn(temporary.blocks,key))temporary.blocks[key]=clone(definition);
        for(const layer of s.draft.layers)if(!temporary.layers.some(l=>l.name===layer.name))temporary.layers.push(clone(layer));
        let name=s.name,options={expectedSignature:s.signature};
        if(newName){duplicateBlockDefinition(temporary,name,newName);name=newName;options={};}
        report=updateBlockDefinition(temporary,name,replacement,options);
        // Re-evaluate complete nested geometry before publishing a shared definition.
        for(const id of report.inserts){const insert=temporary.entities.find(e=>e.id===id);entityBounds(insert,temporary);}
        const scratch=w.doc;w.doc=parent;
        try{
            s.parentHistory.run(newName?'Save block as '+newName:'Update block '+s.name,()=>{
                w.doc=temporary;w.reroute(new Set(report.inserts));regenerateDimensions(w.doc);
            });
            s.parentDocument=w.doc;
        }catch(error){s.parentDocument=w.doc;w.doc=scratch;throw error;}
        w.doc=scratch;
        if(stay&&!newName){const again=beginBlockEdit(s.parentDocument,s.name);s.signature=again.signature;w.toast(`Saved block; ${report.updatedInserts} inserts updated`);renderBlockBar(w);return report;}
    }
    w.setTool('select');w.doc=s.parentDocument;w.history=s.parentHistory;w.selection=new Set(s.parentSelection);w.currentLayer=s.parentLayer;w.category=s.parentCategory;Object.assign(w.camera,s.parentCamera);w.blockSession=null;w.lastSolve=null;
    w.$('.block-editor-bar')?.remove();for(const button of w.root.querySelectorAll('.appbar button:disabled'))button.disabled=false;w.renderer.setDocument(w.doc);w.updateUI();w.renderer.resize();w.renderer.invalidate();w.store.schedule(w.doc);
    if(save)w.toast(`Block saved; ${report.updatedInserts} direct/nested inserts updated`);else w.toast('Block edit cancelled; drawing unchanged');
    return report;
}
function renderBlockBar(w){
    w.$('.block-editor-bar')?.remove();if(!w.blockSession)return;
    for(const button of w.root.querySelectorAll('.appbar [data-action="open"],.appbar [data-action="new"],.appbar [data-action="export"]')){button.disabled=true;button.title='Save or close the block editor first';}
    const bar=document.createElement('nav');bar.className='block-editor-bar';bar.setAttribute('aria-label','Block editor');
    bar.innerHTML=`<strong>${w.blockSession.testing?'TEST BLOCK':'BLOCK EDITOR'} · ${E(w.blockSession.name)}</strong><div>${w.blockSession.testing?B('block-test-close','Return to editor'):`${B('block-save','Save block')}${B('block-save-close','Save & close')}${B('block-test','Test block')}${B('block-settings','Base / ports / attributes')}${B('block-author','Parameters & actions')}${B('block-close','Discard & close')}`}</div>`;
    w.$('.workbar').after(bar);w.renderer.resize();
}
function testBlock(w){
    const s=w.blockSession;if(!s||s.testing)throw new Error('Open a block for editing first');s.draft=w.doc;
    const definition=editedBlockDefinition(s);if(definition.dynamic)evaluateDynamicBlock(definition,{});
    s.testDraft=w.doc;s.testHistory=w.history;s.testSelection=[...w.selection];s.testCamera=cameraState(w);s.testing=true;
    w.doc={...clone(w.doc),entities:[entity('INSERT',{block:s.name,x:0,y:0,sx:1,sy:1,layer:'0'})],constraints:[],blockEditing:undefined};w.doc.blocks[s.name]=definition;syncInsertAttributes(w.doc.entities[0],w.doc);w.selection=new Set([w.doc.entities[0].id]);w.history=restoreHistory(w);w.renderer.setDocument(w.doc);w.updateUI();w.renderer.fit();renderBlockBar(w);
}
function endBlockTest(w){const s=w.blockSession;if(!s?.testing)return;w.doc=s.testDraft;w.history=s.testHistory;w.selection=new Set(s.testSelection);Object.assign(w.camera,s.testCamera);delete s.testing;w.renderer.setDocument(w.doc);w.updateUI();renderBlockBar(w);}
function renderParametricInspector(w,host){
    if(w.inspectorTab!=='properties')return;
    const selected=w.selected(),section=document.createElement('section');section.className='inspector-section parametric-tools';
    if(w.blockSession&&!w.blockSession.testing){
        section.innerHTML=`<h3>Block authoring</h3><p>Editing shared definition <strong>${E(w.blockSession.name)}</strong>. Save updates all direct and nested inserts atomically.</p><div class="operation-grid">${B('block-author','Parameters & actions')}${B('block-attribute','Add attribute')}${B('block-port','Add anchored port')}${B('constraint','Constrain selection')}${B('auto-constrain','Auto constrain selection')}${B('solver-report','Solve status')}${B('block-save-as','Save block as')}</div>`;
    }else if(selected.length===1&&selected[0].type==='INSERT'){
        const info=inspectBlockReferences(w.doc,selected[0].block);
        section.innerHTML=`<h3>Shared block definition</h3><p>${info.direct.length} direct inserts · ${info.nested.length} nested references.</p><div class="operation-grid">${B('block-edit','Edit block geometry')}${B('block-copy','Make unique')}${B('block-rename','Rename definition')}${B('block-sync-attributes','Synchronize attributes')}</div>`;
    }else section.innerHTML=`<h3>Parametric sketch</h3><div class="operation-grid">${B('solver-report','Solve status')}${B('constraint','Add constraint')}${B('auto-constrain','Auto constrain')}${B('calculated-text','Calculated annotation')}${B('constraint-display','Show / hide constraints')}${B('blocks','Block manager')}${B('parametric-demo','Constrained bracket')}</div>`;
    if(selected.length===1&&selected[0].calculation)section.innerHTML+=`<p>Calculated value: <strong>${E(selected[0].text)}</strong></p>${B('calculation-bake','Convert to static text')}`;
    const card=host.querySelector('.object-card');if(card)card.after(section);else host.prepend(section);
    if(w.doc.constraints?.length){const report=w.lastSolve,diagnostic=document.createElement('div');diagnostic.className='solve-summary';diagnostic.setAttribute('role','status');diagnostic.innerHTML=report?`<strong>${E(report.status)}</strong> · ${report.degreesOfFreedom} free variables<br>${report.equations} equations · rank ${report.rank} · residual ${number(report.residual)}`:`${w.doc.constraints.length} constraints · ${B('solver-report','Analyze sketch')}`;section.append(diagnostic);}
}
function settings(w){
    const info=w.doc.blockEditing;if(!info)throw new Error('Open the block editor first');
    w.openModal('Block base and connection ports',`${field('x','Base X',info.base.x)}${field('y','Base Y',info.base.y)}${field('ports','Ports · name, x, y, dx, dy; optional anchor {entityId, point}',JSON.stringify(info.ports,null,2),'textarea')}<p>Insert anchors remain unchanged. Changing the base moves the geometry relative to every insertion point. Connected terminals may not be deleted.</p><div class="error-text"></div>`,{confirm:'Apply',onConfirm:()=>{const v=readFields(w),ports=JSON.parse(v.ports);if(!Array.isArray(ports))throw new Error('Ports must be an array');w.edit('Edit block base and ports',()=>{info.base={x:w.eval(v.x),y:w.eval(v.y)};info.ports=ports;});w.closeModal();}});
}
function addPort(w){
    const e=w.selected()[0];if(!w.doc.blockEditing)throw new Error('Open the block editor first');
    const p=e?.b||e?.c||e?.p||e?.points?.[0]||{x:0,y:0},key=e?.b?'b':e?.c?'c':e?.p?'p':'points.0';
    w.ask('Add block connection port',[{name:'name',label:'Unique port name',value:'port'+(w.doc.blockEditing.ports.length+1)},{name:'x',label:'X',value:p.x},{name:'y',label:'Y',value:p.y},{name:'angle',label:'Outward direction · degrees',value:0}],v=>w.edit('Add connection port',()=>{
        if(w.doc.blockEditing.ports.some(p=>p.name===v.name))throw new Error('Duplicate port name');const a=w.eval(v.angle)*Math.PI/180;
        w.doc.blockEditing.ports.push({name:v.name,x:w.eval(v.x),y:w.eval(v.y),dx:Math.cos(a),dy:Math.sin(a),...(e?{anchor:{entityId:e.id,point:key}}:{})});
    }));
}
function addAttribute(w){
    if(!w.doc.blockEditing)throw new Error('Open the block editor first');
    w.ask('Add attribute definition',[{name:'tag',label:'Unique tag',value:'TAG'},{name:'text',label:'Default text',value:'Value'},{name:'x',label:'X',value:w.camera.x},{name:'y',label:'Y',value:w.camera.y},{name:'height',label:'Text height',value:12}],v=>w.edit('Add attribute definition',()=>{
        if(!v.tag.trim()||w.doc.entities.some(e=>e.type==='ATTDEF'&&e.tag.toUpperCase()===v.tag.toUpperCase()))throw new Error('Duplicate or empty attribute tag');
        const height=w.eval(v.height);if(height<=0)throw new Error('Text height must be positive');w.doc.entities.push(entity('ATTDEF',{attributeTag:v.tag,tag:v.tag,text:v.text,p:{x:w.eval(v.x),y:w.eval(v.y)},height,layer:'0'}));
    }));
}
function blockAuthor(w){
    if(!w.doc.blockEditing)throw new Error('Open the block editor first');const spec=w.doc.blockEditing.dynamic||{version:2,parameters:[],actions:[],constraints:[]};
    w.openModal('Block parameters & actions',`<p>Selection becomes the action selection set. Add a parameter, then attach an action. Sketch constraints may reference numeric parameter names.</p><div class="author-grid">${field('name','Parameter name','Length')}<label class="field">Type<select data-block-field="type">${['distance','angle','number','integer','boolean','enum'].map(t=>`<option>${t}</option>`).join('')}</select></label>${field('default','Default value','100')}${field('min','Minimum (optional)','')}${field('max','Maximum (optional)','')}${field('expression','Derived expression (optional)','')}${field('values','Enum / discrete values · JSON','')}</div><button class="btn" id="author-add-parameter">Add parameter</button><hr><div class="author-grid"><label class="field">Parameter<select id="author-parameter">${spec.parameters.map(p=>`<option>${E(p.name)}</option>`).join('')}</select></label><label class="field">Action<select id="author-action">${['stretch','move','rotate','scale','flip','array','polar','polar-array','visibility','lookup'].map(t=>`<option>${t}</option>`).join('')}</select></label>${field('dx','Direction / array step X','1')}${field('dy','Direction / array step Y','0')}${field('states','Visibility states / lookup rows (JSON)', '{}','textarea')}</div><button class="btn" id="author-add-action">Add action using selection (${w.selection.size})</button><div id="author-message" role="status"></div><h3>Definition</h3><textarea id="author-schema" aria-label="Complete block behavior schema">${E(JSON.stringify(spec,null,2))}</textarea><p class="muted-note">The full schema remains editable for selection sets, crossing windows, polar angles and ordered actions. Unsupported transformations are rejected. This authors Conduit behavior, not proprietary Autodesk action graphs.</p><div class="error-text"></div>`,{wide:true,confirm:'Apply behavior',onConfirm:()=>{
        const dynamic=JSON.parse(w.modal.querySelector('#author-schema').value);w.edit('Update block behavior',()=>{const candidate=editedBlockDefinition({...w.blockSession,draft:w.doc});candidate.dynamic={...dynamic,constraints:w.doc.constraints};evaluateDynamicBlock(candidate,{});w.doc.blockEditing.dynamic=dynamic;for(const p of dynamic.parameters)if(['number','distance','angle','integer'].includes(p.type))w.doc.parameters[p.name]=p.expression??p.default;});w.closeModal();
    }});
    const save=(modify)=>{try{const d=JSON.parse(w.modal.querySelector('#author-schema').value);modify(d);w.modal.querySelector('#author-schema').value=JSON.stringify(d,null,2);w.modal.querySelector('#author-parameter').innerHTML=d.parameters.map(p=>`<option>${E(p.name)}</option>`).join('');w.modal.querySelector('#author-message').textContent='Staged in definition. Apply to validate.';}catch(e){w.modal.querySelector('.error-text').textContent=e.message;}};
    w.modal.querySelector('#author-add-parameter').onclick=()=>save(d=>{
        const v=readFields(w),p={name:v.name,type:v.type,default:v.type==='enum'?v.default:v.type==='boolean'?v.default==='true':w.eval(v.default)};
        if(v.type==='boolean'&&!['true','false'].includes(v.default))throw new Error('Boolean default must be true or false');
        if(d.parameters.some(p=>p.name===v.name))throw new Error('Duplicate parameter');if(v.values)p.values=JSON.parse(v.values);if(v.expression)p.expression=v.expression;if(v.min)p.min=w.eval(v.min);if(v.max)p.max=w.eval(v.max);
        if(['distance','angle'].includes(p.type))p.grip={base:{x:0,y:0},direction:{x:1,y:0},radius:40};d.version=2;d.parameters.push(p);
    });
    w.modal.querySelector('#author-add-action').onclick=()=>save(d=>{
        const v=readFields(w),type=w.modal.querySelector('#author-action').value,parameter=w.modal.querySelector('#author-parameter').value;
        if(!parameter)throw new Error('Add a parameter first');if(!w.selection.size&&type!=='lookup')throw new Error('Select the geometry affected by this action before opening authoring');
        const a={type,parameter,entities:[...w.selection],direction:{x:w.eval(v.dx),y:w.eval(v.dy)},base:clone(w.doc.blockEditing.base)};
        if(type==='stretch'){let points=[];for(const e of w.selected()){const b=entityBounds(e,w.doc);points.push({x:b.minX,y:b.minY},{x:b.maxX,y:b.maxY});}const b=bounds(points);a.box={minX:(b.minX+b.maxX)/2,minY:b.minY-1,maxX:b.maxX+1,maxY:b.maxY+1};}
        if(type==='array')a.step={x:w.eval(v.dx),y:w.eval(v.dy)};if(type==='visibility')a.states=JSON.parse(v.states);if(type==='lookup'){a.rows=JSON.parse(v.states);delete a.entities;}d.actions.push(a);
    });
}
function blockManager(w){
    if(w.blockSession)throw new Error('Save or close the active block editor first');
    const names=Object.keys(w.doc.blocks).filter(n=>!w.doc.blocks[n].dimensionPicture&&!w.doc.blocks[n].dynamicInstance).sort();
    w.openModal('Block definitions',`<label class="field">Definition<select id="block-name">${names.map(n=>`<option>${E(n)}</option>`).join('')}</select></label><div class="operation-grid"><button class="btn" id="manager-insert">Insert at view center</button><button class="btn" id="manager-delete">Delete unused definition</button></div><hr><label class="field">New block name<input id="manager-name" value="NewBlock"></label><button class="btn" id="manager-create">Create and edit block</button><p>Edit geometry, constrain sketches, define ports and attributes. Save refreshes every placement. Referenced definitions cannot be deleted; all operations are undoable.</p><div class="error-text"></div>`,{confirm:'Edit definition',onConfirm:()=>startBlockEditor(w,w.modal.querySelector('#block-name').value)});
    const guarded=action=>{try{action();}catch(e){w.modal.querySelector('.error-text').textContent=e.message;}};
    w.modal.querySelector('#manager-create').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#manager-name').value.trim();w.edit('Create block '+name,()=>createBlockDefinition(w.doc,name));startBlockEditor(w,name);});
    w.modal.querySelector('#manager-insert').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#block-name').value;w.edit('Insert block '+name,()=>{const e=entity('INSERT',{block:name,x:w.camera.x,y:w.camera.y,sx:1,sy:1,layer:w.currentLayer,layout:w.doc.activeLayout});syncInsertAttributes(e,w.doc);w.doc.entities.push(e);w.selection=new Set([e.id]);});w.closeModal();});
    w.modal.querySelector('#manager-delete').onclick=()=>guarded(()=>{const name=w.modal.querySelector('#block-name').value;w.edit('Delete unused block',()=>deleteBlockDefinition(w.doc,name));blockManager(w);});
}
const constraintTypes=['horizontal','vertical','length','radius','diameter','angle','angle-between','coincident','concentric','parallel','perpendicular','collinear','equal','distance','distance-x','distance-y','point-on-line','point-on-circle','midpoint','tangent','symmetric','fixed','fixed-point'];
const unaryTypes=new Set(['horizontal','vertical','length','radius','diameter','angle','fixed','fixed-point']);
const numericTypes=new Set(['length','radius','diameter','angle','angle-between','distance','distance-x','distance-y']);
function constraintAuthor(w){
    const selected=[...w.selection].map(id=>w.doc.entities.find(e=>e.id===id)).filter(Boolean);if(!selected.length)throw new Error('Select sketch geometry first');
    const options=e=>['a','b','c','p'].filter(k=>e?.[k]).concat((e?.points||[]).map((_,i)=>`points.${i}`)).map(k=>`<option>${k}</option>`).join('');
    w.openModal('Constrain sketch',`<p>${selected.length} objects in selection order. Dimensions are driving unless marked Reference. Angular expressions use degrees.</p><label class="field">Constraint<select id="constraint-type">${constraintTypes.map(t=>`<option>${t}</option>`).join('')}</select></label><div class="author-grid"><label class="field">First point<select id="constraint-point-a">${options(selected[0])}</select></label><label class="field">Second point<select id="constraint-point-b">${options(selected[1])}</select></label></div><div class="author-grid"><label class="field">First polyline segment (0-based)<input id="constraint-segment-a" value="0"></label><label class="field">Second polyline segment<input id="constraint-segment-b" value="0"></label></div><label class="field">Value or parameter expression<input id="constraint-value" value="100"></label><label class="field">Name (optional)<input id="constraint-name" placeholder="d1"></label><label><input id="constraint-reference" type="checkbox"> Reference measurement (does not constrain geometry)</label><div class="error-text"></div>`,{confirm:'Apply constraint',onConfirm:()=>{
        const type=w.modal.querySelector('#constraint-type').value,reference=w.modal.querySelector('#constraint-reference').checked,name=w.modal.querySelector('#constraint-name').value.trim(),value=w.modal.querySelector('#constraint-value').value;
        if(name&&(!/^[A-Za-z_]\w*$/.test(name)||reservedParameterNames().includes(name)||w.doc.constraints.some(c=>c.name===name)||Object.hasOwn(w.doc.parameters,name)))throw new Error('Constraint name must be unique and not shadow parameters');
        if(reference&&!numericTypes.has(type))throw new Error('Reference mode requires a measurable dimensional constraint');
        const count=unaryTypes.has(type)?1:type==='symmetric'?3:2;if(!unaryTypes.has(type)&&selected.length!==count)throw new Error(`This constraint requires ${count} objects`);
        const pa=w.modal.querySelector('#constraint-point-a').value,pb=w.modal.querySelector('#constraint-point-b').value,segmentA=Number(w.modal.querySelector('#constraint-segment-a').value),segmentB=Number(w.modal.querySelector('#constraint-segment-b').value);
        w.edit('Add '+type+' constraint',()=>{
            const groups=unaryTypes.has(type)?selected.map(e=>[e]):[selected];
            for(const [index,es]of groups.entries())w.doc.constraints.push({id:uid('constraint'),type,entities:es.map(e=>e.id),...(name?{name:groups.length>1?`${name}_${index+1}`:name}:{}),...(numericTypes.has(type)?{value}:{}),reference,segmentA,segmentB,pointA:pa||undefined,pointB:pb||undefined,...(type==='fixed'?{target:clone(es[0])}:{}),...(type==='fixed-point'?{target:clone(es[0][pa]||es[0].points?.[Number(pa.slice(7))])}:{})});
            w.solveConstraints();w.showConstraintAnnotations=true;
        });w.closeModal();w.toast('Constraint applied');
    }});
    const a=w.modal.querySelector('#constraint-point-a');if([...a.options].some(o=>o.value==='b'))a.value='b';
}
function parameterManager(w){
    const descriptors=describeParameters(w.doc.parameters);
    const row=(name,expression,value)=>`<div class="param-row"><input class="param-name" aria-label="Parameter name" value="${E(name)}"><input class="param-expression" aria-label="Expression for ${E(name)}" value="${E(typeof expression==='object'?expression.expression:expression)}"><output class="param-result">${number(value)}</output><button class="remove-param" aria-label="Remove parameter">×</button></div>`;
    w.openModal('Parameters & solved calculations',`<p>Dependency-aware expressions. Functions include sqrt, hypot, sin, cos, atan2, min/max, clamp, rad and deg. Trigonometry uses radians; dimensional angle constraints use degrees.</p><div class="param-head"><span>Name</span><span>Expression</span><span>Calculated</span></div><div id="parameter-rows">${descriptors.map(p=>row(p.name,p.expression,p.value)).join('')}</div><button class="btn" id="add-parameter">Add parameter</button><div class="error-text" role="status"></div><h3>Constraint measurements</h3><div class="calculation-table">${constraintAnnotations(w.doc.entities,w.doc.constraints,w.doc.parameters).map(a=>`<div><b>${E(a.text)}</b><small>${a.reference?'Reference only':`Expression: ${E(a.expression??'geometric')}`}</small></div>`).join('')||'No constrained measurements.'}</div>`,{wide:true,confirm:'Apply parameters',onConfirm:()=>{
        const values=read();resolveParameters(values);w.edit('Apply parametric calculations',()=>{w.doc.parameters=values;for(const e of w.doc.entities)w.evaluateParametric(e);if(w.doc.blockEditing?.dynamic)for(const p of w.doc.blockEditing.dynamic.parameters){if(!Object.hasOwn(values,p.name))throw new Error('Block parameter must be edited through Parameters & actions');if(p.expression!==undefined)p.expression=values[p.name];else if(typeof p.default==='number')p.default=evaluateExpression(values[p.name],values);}
            w.solveConstraints();w.reroute();});w.closeModal();
    }});
    function read(){const next={};for(const r of w.modal.querySelectorAll('.param-row')){const name=r.querySelector('.param-name').value.trim();if(!/^[A-Za-z_]\w*$/.test(name)||reservedParameterNames().includes(name)||Object.hasOwn(next,name))throw new Error('Invalid, reserved or duplicate parameter: '+name);next[name]=r.querySelector('.param-expression').value;}return next;}
    w.modal.querySelector('#add-parameter').onclick=()=>w.modal.querySelector('#parameter-rows').insertAdjacentHTML('beforeend',row('size'+w.modal.querySelectorAll('.param-row').length,'100',100));
    w.modal.addEventListener('click',event=>event.target.closest('.remove-param')?.closest('.param-row')?.remove());
    w.modal.addEventListener('input',()=>{try{const values=resolveParameters(read());for(const r of w.modal.querySelectorAll('.param-row'))r.querySelector('output').textContent=number(values[r.querySelector('.param-name').value.trim()]);w.modal.querySelector('.error-text').textContent='';}catch(error){w.modal.querySelector('.error-text').textContent=error.message;}});
}
function solverReport(w){
    const report=w.solver.analyze(w.doc.entities,w.constraintsForSolve(),w.doc.parameters);w.lastSolve=report;
    const measured=new Map(report.annotations.map(a=>[a.id,a]));
    w.openModal('Parametric solve diagnostics',`<div class="solve-summary"><strong>${E(report.status)}</strong><p>${report.degreesOfFreedom} free scalar variables · rank ${report.rank} / ${report.variables}<br>${report.equations} equations in ${report.components.length} connected components · ${report.redundantEquations} dependent equations<br>Residual ${number(report.residual)}</p></div><p class="muted-note">Rank describes the supported planar variables at this configuration; it is not a proof of global uniqueness. Highlighted residuals are implicated constraints, not a minimal conflicting set.</p><div class="solver-list">${w.doc.constraints.map(c=>{const d=report.constraints.find(x=>x.id===c.id),a=measured.get(c.id);return `<section data-constraint-row="${E(c.id)}"><strong>${E(c.name||c.type)}</strong><span>${E(a?.text||c.type)}</span><small>${c.suppressed?'Suppressed':c.reference?'Reference':d?.satisfied?d.redundant?'Satisfied · dependent equation':'Satisfied':`Residual ${number(d?.residual)}`}</small><div><button class="btn" data-constraint-operation="edit" data-id="${E(c.id)}">Edit</button><button class="btn" data-constraint-operation="suppress" data-id="${E(c.id)}">${c.suppressed?'Enable':'Suppress'}</button><button class="btn" data-constraint-operation="remove" data-id="${E(c.id)}">Remove</button></div></section>`;}).join('')}</div>${B('solver-run','Solve now')}${B('constraint-display','Show / hide annotations')}${B('calculated-text','Calculated annotation')}`,{wide:true});
    w.modal.addEventListener('click',event=>{const t=event.target.closest('[data-constraint-operation]');if(!t)return;const c=w.doc.constraints.find(c=>c.id===t.dataset.id);if(!c)return;
        try{if(t.dataset.constraintOperation==='edit'){w.ask('Edit constraint',[{name:'name',label:'Name',value:c.name||''},{name:'value',label:'Expression (dimensional constraints)',value:c.value??''},{name:'reference',label:'Reference only · true / false',value:String(!!c.reference)}],v=>w.edit('Edit constraint',()=>{if(v.reference==='true'&&!numericTypes.has(c.type))throw new Error('Only dimensional constraints can be reference measurements');c.name=v.name;if(numericTypes.has(c.type))c.value=v.value;c.reference=v.reference==='true';}));return;}
            w.edit('Edit constraint set',()=>{if(t.dataset.constraintOperation==='remove')w.doc.constraints=w.doc.constraints.filter(x=>x!==c);else c.suppressed=!c.suppressed;});solverReport(w);
        }catch(e){w.toast(e.message,true);}
    });
}
function refreshCalculations(w){
    const annotations=constraintAnnotations(w.doc.entities,w.doc.constraints||[],w.doc.parameters||{});w.constraintLabels=annotations;
    evaluateCalculations(w.doc.entities,w.doc.constraints||[],w.doc.parameters||{});
}
function calculatedText(w){w.ask('Calculated annotation',[{name:'expression',label:'Expression · user parameters and named measured constraints',value:Object.keys(w.doc.parameters)[0]||'100'},{name:'prefix',label:'Prefix',value:'Size = '},{name:'suffix',label:'Suffix',value:' '+w.doc.units},{name:'precision',label:'Decimal precision',value:3}],v=>w.edit('Create calculated annotation',()=>{const e=entity('TEXT',{p:{x:w.camera.x,y:w.camera.y},height:12,layer:'Annotations',text:'',layout:w.doc.activeLayout,calculation:{version:1,expression:v.expression,prefix:v.prefix,suffix:v.suffix,precision:Number(v.precision)}});w.doc.entities.push(e);w.selection=new Set([e.id]);refreshCalculations(w);}));}
function drawParametricOverlay(w,ctx,cam){
    if(w.showConstraintAnnotations){const seen=new Map();ctx.save();ctx.font='11px ui-monospace,monospace';ctx.textBaseline='middle';
        for(const a of w.constraintLabels||[]){if(!a.visible||!a.entityIds.some(id=>w.doc.entities.some(e=>e.id===id&&(e.layout||'Model')===(w.doc.activeLayout||'Model'))))continue;const p=cam.screen(a.position),key=a.entityIds[0],offset=seen.get(key)||0;seen.set(key,offset+1);const x=p.x+12,y=p.y-18-offset*20;if(x<24||y<24||x>cam.width-24||y>cam.height-24)continue;const width=ctx.measureText(a.text).width+12;ctx.fillStyle=a.reference?'#f0f3fb':'#e4f3ed';ctx.strokeStyle='#65a48b';ctx.lineWidth=1;ctx.fillRect(x,y-9,width,18);ctx.strokeRect(x,y-9,width,18);ctx.fillStyle='#265547';ctx.fillText(a.text,x+6,y);}
        ctx.restore();
    }
    if(w.doc.blockEditing){ctx.save();const base=cam.screen(w.doc.blockEditing.base);ctx.strokeStyle='#9252b8';ctx.beginPath();ctx.moveTo(base.x-10,base.y);ctx.lineTo(base.x+10,base.y);ctx.moveTo(base.x,base.y-10);ctx.lineTo(base.x,base.y+10);ctx.stroke();ctx.font='11px sans-serif';
        for(const port of w.doc.blockEditing.ports){const p=cam.screen(port);ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fillStyle='#f9f3ff';ctx.fill();ctx.stroke();ctx.fillStyle='#674280';ctx.fillText(port.name,p.x+9,p.y-7);}ctx.restore();
    }
}
function parametricDemo(w){w.edit('Create constrained bracket',()=>{
    const base={x:w.camera.x,y:w.camera.y},a=entity('LINE',{a:base,b:{x:base.x+120,y:base.y},layer:'0'}),b=entity('LINE',{a:{x:base.x+120,y:base.y},b:{x:base.x+120,y:base.y+70},layer:'0'}),hole=entity('CIRCLE',{c:{x:base.x+60,y:base.y+35},r:12,layer:'0'});
    w.doc.entities.push(a,b,hole);Object.assign(w.doc.parameters,{bracketWidth:120,bracketHeight:70,holeDiameter:'bracketHeight/3'});
    const cs=[{type:'fixed-point',entities:[a.id],pointA:'a',target:base},{type:'horizontal',entities:[a.id]},{type:'length',entities:[a.id],value:'bracketWidth',name:'widthMeasured'},{type:'coincident',entities:[a.id,b.id]},{type:'vertical',entities:[b.id]},{type:'length',entities:[b.id],value:'bracketHeight'},{type:'diameter',entities:[hole.id],value:'holeDiameter'},{type:'length',entities:[a.id],reference:true,name:'spanReference'}];
    w.doc.constraints.push(...cs.map(c=>({id:uid('constraint'),...c})));w.selection=new Set([a.id,b.id,hole.id]);w.showConstraintAnnotations=true;
});w.closeModal();w.renderer.fit();}
function parametricAction(w,action){
    if(w.blockSession&&['new','open','export','save-project','rename','library-guide'].includes(action))throw new Error('Save or close the block editor before changing or exporting the drawing');
    if(action==='block-edit'){const e=w.selected()[0];if(!e||e.type!=='INSERT'||isLocked(e,w.doc))throw new Error('Select an unlocked block insert');startBlockEditor(w,e.block);return true;}
    if(action==='blocks'){blockManager(w);return true;}
    if(action==='block-save'||action==='block-save-close'){finishBlockEditor(w,true,action==='block-save');return true;}
    if(action==='block-close'){w.openModal('Discard block edits?','<p>The drawing and its inserts keep the last saved definition.</p>',{confirm:'Discard edits',onConfirm:()=>{w.closeModal();finishBlockEditor(w,false);}});return true;}
    if(action==='block-test'){testBlock(w);return true;}if(action==='block-test-close'){endBlockTest(w);return true;}
    if(action==='block-settings'){settings(w);return true;}if(action==='block-port'){addPort(w);return true;}if(action==='block-attribute'){addAttribute(w);return true;}if(action==='block-author'){blockAuthor(w);return true;}
    if(action==='block-save-as'){w.ask('Save block as',[{name:'name',label:'New block name',value:w.blockSession.name+'_copy'}],v=>finishBlockEditor(w,true,false,v.name));return true;}
    if(action==='block-sync-attributes'){const e=w.selected()[0];if(e?.type!=='INSERT')throw new Error('Select a block insert');w.edit('Synchronize block attributes',()=>{const report=updateBlockDefinition(w.doc,e.block,w.doc.blocks[e.block]);w.reroute(new Set(report.inserts));});return true;}
    if(action==='block-copy'||action==='block-rename'){const e=w.selected()[0];if(e?.type!=='INSERT')throw new Error('Select a block insert');w.ask(action==='block-copy'?'Make insert unique':'Rename shared block',[{name:'name',label:'New definition name',value:e.block+'_copy'}],v=>w.edit('Change block identity',()=>{if(action==='block-copy'){duplicateBlockDefinition(w.doc,e.block,v.name);w.doc.entities.find(x=>x.id===e.id).block=v.name;}else renameBlockDefinition(w.doc,e.block,v.name);}));return true;}
    if(action==='auto-constrain'){const selected=w.selected();if(!selected.length)throw new Error('Select sketch geometry first');w.edit('Auto constrain sketch',()=>{w.doc.constraints.push(...inferSketchConstraints(selected,w.doc.constraints));w.showConstraintAnnotations=true;});return true;}
    if(action==='constraint'){constraintAuthor(w);return true;}if(action==='parameters'){parameterManager(w);return true;}if(action==='solver-report'){solverReport(w);return true;}
    if(action==='solver-run'){w.edit('Solve parametric sketch',()=>w.solveConstraints());solverReport(w);return true;}
    if(action==='constraint-display'){w.showConstraintAnnotations=!w.showConstraintAnnotations;refreshCalculations(w);w.renderer.invalidate();return true;}
    if(action==='calculation-bake'){const e=w.selected()[0];if(!e?.calculation)throw new Error('Select calculated text');w.edit('Convert calculation to static text',()=>{delete e.calculation;});return true;}
    if(action==='calculated-text'){calculatedText(w);return true;}if(action==='parametric-demo'){parametricDemo(w);return true;}
    return false;
}

return {startBlockEditor,finishBlockEditor,renderParametricInspector,constraintAuthor,parameterManager,refreshCalculations,drawParametricOverlay,parametricAction};
})();
// packages/workbench/src/cad-editing.js
__modules["packages/workbench/src/cad-editing.js"]=(()=>{
const {entity, clone, editDimension, dimensionPicture, setDynamicParameters, dynamicValues, evaluateDynamicBlock, entityGeometry, isLocked, uid} = __modules["packages/model/src/index.js"];
const {bounds} = __modules["packages/geometry/src/index.js"];
const {escapeHTML:E} = __modules["packages/workbench/src/icons.js"];
const button=(action,text)=>`<button class="btn" data-action="${action}">${text}</button>`;
const names=['Rotated','Aligned','Two-line angular','Diameter','Radius','Three-point angular','Ordinate'];
const input=(key,label,value,kind='dim')=>`<label class="field"><span>${E(label)}</span><input data-${kind}="${E(key)}" aria-label="${E(label)}" value="${E(value)}" autocomplete="off" inputmode="${key==='text'?'text':'decimal'}"></label>`;
function renderCadEditing(w,e,host) {
    const section=document.createElement('section');section.className='inspector-section cad-editing';
    if(e.type==='DIMENSION'){
        if(e.dimension?.version!==1){section.innerHTML=`<h3>Native dimension</h3><p>${E(names[(e.dimtype??33)&15]||'Unknown')} · original graphics retained.</p>${button('dimension-manage','Enable dimension editing')}<p class="muted-note">Opt in to decimal-style regeneration. The original graphics remain unchanged until you confirm.</p>`;}
        else {
            const p=dimensionPicture(e,w.doc),s=p.style;
            section.innerHTML=`<h3>${E(names[(e.dimtype??33)&15])} dimension</h3><div class="fields">${input('text','Dimension text',e.text??'<>')}${input('dimtxt','Dimension text height',s.dimtxt)}${input('dimasz','Arrow size',s.dimasz)}${input('dimdec','Decimal precision',s.dimdec)}${input('dimgap','Text gap',s.dimgap)}${input('dimlfac','Measurement factor',s.dimlfac)}${[0,1].includes((e.dimtype??33)&15)?input('offset','Dimension offset',e.offset??dimensionOffset(e)):''}${(e.dimtype&15)===0?input('dimensionAngle','Dimension angle',e.dimensionAngle||0):''}</div>${button('dimension-reset-text','Reset text position')}${e.dimension.references?button('dimension-drive','Drive source by expression'):''}<p class="muted-note">Drag witness points, the dimension line, or the text grip. “&lt;&gt;” inserts the measurement; one space suppresses text. ${e.dimension.references?'Source points are associated; editing a witness grip detaches that point.':''}</p>`;
        }
    } else if(e.type==='INSERT'){
        const block=w.doc.blocks[e.block];if(!block)return;
        section.innerHTML='<h3>Parameterized block</h3>';
        if(block.dynamic){
            const values=dynamicValues(block,e.dynamicParameters||{});
            section.innerHTML+=`<div class="fields">${block.dynamic.parameters.map(p=>{
                const label=E(p.label||p.name),v=values[p.name];
                if(p.type==='boolean'||p.type==='enum')return `<label class="field"><span>${label}</span><select data-dynamic="${E(p.name)}" aria-label="${label}">${(p.type==='boolean'?[false,true]:p.values).map(x=>`<option value="${E(JSON.stringify(x))}" ${v===x?'selected':''}>${E(String(x))}</option>`).join('')}</select></label>`;
                return p.expression!==undefined?`<label class="field"><span>${label} · calculated</span><output>${E(v)}</output><small>${E(p.expression)}</small></label>`:input(p.name,p.label||p.name,v,'dynamic');
            }).join('')}</div>${button('dynamic-reset','Reset parameters')}`;
        }
        if(e.attributes?.length)section.innerHTML+=`<h3>Attribute values</h3><div class="fields">${e.attributes.map(a=>`<label class="field"><span>${E(a.attributeTag||a.tag)}</span>${a.calculation?`<output>${E(a.text)}</output>`:`<input data-attribute="${E(a.id)}" value="${E(a.text||'')}">`}</label>`).join('')}</div>`;
        section.innerHTML+=button('dynamic-author',block.dynamic?'Edit behavior definition':'Add parameterized behavior')+'<p class="muted-note">Conduit actions export evaluated native DXF geometry. Proprietary Autodesk action graphs are not executed.</p>';
    } else if(e.type==='LINE'||e.type==='CIRCLE'||e.type==='ARC'){
        section.innerHTML='<h3>Dimension this object</h3>'+button('dimension-source',e.type==='LINE'?'Add associated dimension':'Add radius dimension');
    } else return;
    const card=host.querySelector('.object-card');
    if(card)card.after(section);else host.prepend(section);
}
function dimensionOffset(e){const a=e.a,b=e.b,u=(e.dimtype&15)===0?{x:Math.cos((e.dimensionAngle||0)*Math.PI/180),y:Math.sin((e.dimensionAngle||0)*Math.PI/180)}:{x:(b.x-a.x)/Math.hypot(b.x-a.x,b.y-a.y),y:(b.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y)};return -(e.definitionPoint.x-a.x)*u.y+(e.definitionPoint.y-a.y)*u.x;}
function editable(w){const e=w.selected()[0];if(!e||w.selection.size!==1||isLocked(e,w.doc))throw new Error('Select one unlocked object');return e;}
function changeCadEditing(w,t) {
    if(!t.dataset.dim&&!t.dataset.dynamic&&!t.dataset.attribute)return false;
    const e=editable(w);
    w.edit('Edit CAD parameters',()=>{
        if(t.dataset.attribute){const a=e.attributes?.find(a=>a.id===t.dataset.attribute);if(!a||a.calculation)throw new Error('Attribute is missing or calculated');a.text=t.value;e.dirty=true;}
        else if(t.dataset.dim){const key=t.dataset.dim,value=key==='text'?t.value:w.eval(t.value);editDimension(e,w.doc,['text','offset','dimensionAngle'].includes(key)?{[key]:value}:{style:{[key]:value}});}
        else {
            const p=w.doc.blocks[e.block].dynamic.parameters.find(p=>p.name===t.dataset.dynamic);
            if(p.expression!==undefined)throw new Error('Calculated block parameters are read-only');
            const value=['enum','boolean'].includes(p.type)?JSON.parse(t.value):w.eval(t.value);
            setDynamicParameters(e,w.doc,{[p.name]:value});w.reroute(new Set([e.id]));
        }
    });return true;
}
function cadEditingAction(w,action) {
    if(!['dimension-manage','dimension-reset-text','dimension-source','dimension-drive','dynamic-author','dynamic-reset','dynamic-demo'].includes(action))return false;
    if(action==='dynamic-demo'){
        w.edit('Insert parameterized duct',()=>{
            const name='CC_DYNAMIC_DUCT_'+uid('block'),base={x:0,y:0};
            const block={name,base,ports:[{name:'in',x:0,y:0,dx:-1,dy:0},{name:'out',x:100,y:0,dx:1,dy:0}],entities:[entity('LWPOLYLINE',{points:[{x:0,y:-20},{x:100,y:-20},{x:100,y:20},{x:0,y:20}],closed:true}),entity('LINE',{a:{x:0,y:0},b:{x:100,y:0},linetype:'CENTER'})]};
            block.dynamic={version:1,parameters:[{name:'Length',type:'distance',default:100,min:20,max:1000,grip:{base:{x:0,y:35},direction:{x:1,y:0}}},{name:'Centerline',type:'enum',default:'Shown',values:['Shown','Hidden']}],actions:[{type:'stretch',parameter:'Length',box:{minX:50,minY:-100,maxX:1100,maxY:100},direction:{x:1,y:0}},{type:'visibility',parameter:'Centerline',entities:[block.entities[1].id],states:{Shown:[block.entities[1].id],Hidden:[]}}]};
            w.doc.blocks[name]=block;const e=entity('INSERT',{block:name,x:w.camera.x,y:w.camera.y,layer:w.currentLayer,layout:w.doc.activeLayout,sx:1,sy:1});w.doc.entities.push(e);w.selection=new Set([e.id]);
        });w.closeModal();w.setTool('select');return true;
    }
    const e=editable(w);
    if(action==='dimension-drive'){
        const references=e.dimension?.references,source=w.doc.entities.find(x=>x.id===Object.values(references||{})[0]?.entityId);
        if(!source||!['LINE','CIRCLE','ARC'].includes(source.type))throw new Error('An associated line or radius dimension is required');
        const type=source.type==='LINE'?'length':'radius',value=type==='length'?Math.hypot(source.b.x-source.a.x,source.b.y-source.a.y):source.r;
        w.ask('Drive dimension',[{name:'value',label:'Driving expression or named parameter',value:String(value)}],v=>w.edit('Add driving dimensional constraint',()=>{const existing=w.doc.constraints.find(c=>c.dimensionId===e.id);if(existing)existing.value=v.value;else w.doc.constraints.push({id:uid('constraint'),type,entities:[source.id],value:v.value,dimensionId:e.id});w.solveConstraints();w.showConstraintAnnotations=true;}));
    } else if(action==='dimension-manage'){
        w.openModal('Enable native dimension editing','<p>This replaces the imported picture with Conduit’s planar decimal dimension evaluator. Original DXF bytes remain available. Custom arrows, tolerance layouts, annotative contexts and proprietary associations are not evaluated. This change is undoable.</p><div class="error-text"></div>',{confirm:'Enable editing',onConfirm:()=>{w.edit('Enable dimension regeneration',()=>editDimension(e,w.doc));w.closeModal();}});
    } else if(action==='dimension-reset-text')w.edit('Reset dimension text',()=>editDimension(e,w.doc,{manualText:false}));
    else if(action==='dimension-source'){
        w.edit('Dimension selected object',()=>{
            let d;
            if(e.type==='LINE')d=entity('DIMENSION',{a:clone(e.a),b:clone(e.b),offset:30,dimension:{version:1,references:{a:{entityId:e.id,point:'a'},b:{entityId:e.id,point:'b'}}}});
            else {const a=e.type==='ARC'?e.start:0;d=entity('DIMENSION',{dimtype:36,definitionPoint:clone(e.c),defpoint4:{x:e.c.x+e.r*Math.cos(a),y:e.c.y+e.r*Math.sin(a)},leaderLength:15,dimension:{version:1,references:{definitionPoint:{entityId:e.id,point:'c'},defpoint4:{entityId:e.id,point:'circle',angle:a}}}});}
            d.layer='Annotations';d.layout=e.layout||'Model';editDimension(d,w.doc);w.doc.entities.push(d);w.selection=new Set([d.id]);
        });
    } else if(action==='dynamic-reset')w.edit('Reset block parameters',()=>{const block=w.doc.blocks[e.block];setDynamicParameters(e,w.doc,Object.fromEntries(block.dynamic.parameters.map(p=>[p.name,p.default])));w.reroute(new Set([e.id]));});
    else if(action==='dynamic-author'){
        const source=w.doc.blocks[e.block];if(!source)throw new Error('Missing block');
        const d=source.dynamic||{version:1,parameters:[{name:'Size',type:'distance',default:100,min:10,max:1000}],actions:[{type:'scale',parameter:'Size',base:source.base||{x:0,y:0}}]};
        w.ask('Define parameterized behavior',[{name:'definition',label:'Version 1 action schema · move, stretch, rotate, scale, flip, visibility, array, lookup. Editing creates a private master for this instance.',value:JSON.stringify(d,null,2),multiline:true}],v=>{
            if(v.definition.length>12000)throw new Error('Behavior definition exceeds the 12,000-character authoring limit');
            const spec=JSON.parse(v.definition),name=source.name+'_DYN_'+uid('block'),block={...clone(source),name,dynamic:spec};
            for(let i=0;i<block.entities.length;i++)block.entities[i].id??=`child-${i}`;
            evaluateDynamicBlock(block,{});
            w.edit('Author block behavior',()=>{w.doc.blocks[name]=block;e.block=name;delete e.dynamicSource;e.dynamicParameters={};e.dirty=true;w.reroute(new Set([e.id]));});
        });
    }
    return true;
}

return {renderCadEditing,changeCadEditing,cadEditingAction};
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
/** Exit endpoint envelopes along the named terminal normal, then keep both bodies
 * in the visibility graph. Dropping them lets a route re-enter its own equipment.
 */
function routePorts(from, to, obstacles = [], options = {}) {
    const lead = options.lead ?? 20, clearance = options.clearance ?? 14;
    if (!Number.isFinite(lead) || lead < 0 || !Number.isFinite(clearance) || clearance < 0) throw new RangeError('Invalid routing lead or clearance');
    const escape = port => {
        const direction = normalize({ x: port.dx || 0, y: port.dy || 0 });
        let length = lead;
        const own = obstacles.find(o => port.entityId && o.id === port.entityId);
        if (own && contains(inflate(own, clearance), port)) {
            const box = inflate(own, clearance), exits = [];
            for (const axis of ['x', 'y']) {
                const v = direction[axis];
                if (Math.abs(v) > 1e-9) exits.push(((axis === 'x' ? (v > 0 ? box.maxX : box.minX) : (v > 0 ? box.maxY : box.minY)) - port[axis]) / v);
            }
            if (exits.length) length = Math.max(length, Math.min(...exits) + .01);
        }
        return add(port, mul(direction, length));
    };
    const a = escape(from), b = escape(to);
    const r = options.waypoints?.length ? routeVia(a, b, options.waypoints, obstacles, options) : routeOrthogonal(a, b, obstacles, options);
    const crossed = [[from, a], [to, b]].some(([port, exit]) => obstacles.some(o => o.id !== port.entityId && segmentIntersectsBox(port, exit, inflate(o, clearance))));
    return { ...r, ...(crossed ? { status: 'blocked', reason: 'A terminal escape crosses another obstacle' } : {}), points: simplifyOrthogonal([from, ...r.points, to]) };
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
// packages/symbols/src/primitives.js
__modules["packages/symbols/src/primitives.js"]=(()=>{
/** CAD-native construction primitives. Coordinates are Y-up, in drawing units. */
const {line, polyline, circle, rect, text, entity} = __modules["packages/model/src/index.js"];
const pt = (x, y) => ({ x, y });
const L = (a, b, c, d, props = {}) => line(pt(a, b), pt(c, d), props);
const P = (points, closed = false, props = {}) => polyline(points.map(v => Array.isArray(v) ? pt(...v) : v), closed, props);
const C = (x, y, r, props = {}) => circle(pt(x, y), r, props);
const R = (x, y, w, h) => rect(x, y, w, h);
const T = (x, y, value, height = 12) => text(pt(x, y), value, height, { align: 'center' });
const A = (x, y, r, start, end) => entity('ARC', { c: pt(x, y), r, start, end });
function E(x, y, rx, ry, start = 0, end = Math.PI * 2) {
    if (!(rx > 0 && ry > 0)) throw new RangeError('Ellipse radii must be positive');
    // DXF requires the major axis and 0 < minor/major <= 1. Swap the basis,
    // not merely the radii: subtract pi/2 so partial-arc endpoints are unchanged.
    if (ry > rx) {
        const full = Math.abs(end - start) >= Math.PI * 2 - 1e-9;
        start = full ? 0 : (start - Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        end = full ? Math.PI * 2 : (end - Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        return entity('ELLIPSE', { c: pt(x, y), major: pt(0, ry), ratio: rx / ry, start, end });
    }
    return entity('ELLIPSE', { c: pt(x, y), major: pt(rx, 0), ratio: ry / rx, start, end });
}
const B = (points) => entity('SPLINE', { degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: points.map(v => pt(...v)), weights: [1, 1, 1, 1] });
const port = (name, x, y, dx, dy, medium, role) => ({ name, x, y, dx, dy, ...(medium ? { medium } : {}), ...(role ? { role } : {}) });
const H = () => [port('in', -45, 0, -1, 0), port('out', 45, 0, 1, 0)];
const V = (y = 45) => [port('top', 0, y, 0, 1), port('bottom', 0, -y, 0, -1)];
const F = () => [...H(), ...V()];
const leads = (radius = 25) => [L(-45, 0, -radius, 0), L(radius, 0, 45, 0)];
const diamond = (w = 28, h = 28) => P([[-w, 0], [0, h], [w, 0], [0, -h]], true);
function triangle(points, filled = false) {
    return filled ? entity('SOLID', { points: points.map(v => pt(...v)) }) : P(points, true);
}
function arrow(x1, y1, x2, y2, size = 7, filled = false) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1e-9) throw new Error('An arrow needs a nonzero direction');
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, x = x2 - ux * size, y = y2 - uy * size;
    return [L(x1, y1, x2, y2), triangle([[x2, y2], [x - uy * size * .45, y + ux * size * .45], [x + uy * size * .45, y - ux * size * .45]], filled)];
}
function spring(x, y, length = 30, height = 6, vertical = false) {
    const values = [[0, 0], [length * .1, 0]];
    for (let i = 1; i < 7; i++) values.push([length * (.1 + i * .11), i % 2 ? height : -height]);
    values.push([length * .9, 0], [length, 0]);
    return P(values.map(([a, b]) => vertical ? [x + b, y + a] : [x + a, y + b]));
}
function capsule(x, y, w, h) {
    const r = h / 2, left = x + r, right = x + w - r;
    return [L(left, y, right, y), A(right, y + r, r, -Math.PI / 2, Math.PI / 2), L(right, y + h, left, y + h), A(left, y + r, r, Math.PI / 2, Math.PI * 1.5)];
}
function vessel(w = 54, h = 100) {
    const r = w / 2, y = h / 2 - r;
    return [L(-r, -y, -r, y), A(0, y, r, 0, Math.PI), L(r, y, r, -y), A(0, -y, r, Math.PI, Math.PI * 2)];
}
function functionalBlock(label, width = 64, height = 44) {
    return [R(-width / 2, -height / 2, width, height), ...leads(width / 2), T(0, -4, label, 11)];
}

return {pt,L,P,C,R,T,A,E,B,port,H,V,F,leads,diamond,triangle,arrow,spring,capsule,vessel,functionalBlock};
})();
// packages/symbols/src/conventions.js
__modules["packages/symbols/src/conventions.js"]=(()=>{
/** References identify a symbol family, not dimensional certification of a master. */
const REFERENCES = {
    'ISO-10628-2': { title: 'ISO 10628-2:2012 — Process diagram graphical symbols', url: 'https://www.iso.org/standard/51841.html', scope: 'Chemical and petrochemical process diagrams; excludes electrotechnical symbols.' },
    'ISO-1219-1': { title: 'ISO 1219-1:2012 — Fluid-power graphical symbols', url: 'https://www.iso.org/standard/60184.html', scope: 'Hydraulic and pneumatic circuit symbols.' },
    'ISO-5807': { title: 'ISO 5807:1985 — Information-processing flowcharts', url: 'https://www.iso.org/standard/11955.html', scope: 'Data, program and system flowchart notation.' },
    'IEC-60617': { title: 'IEC 60617 — Electrotechnical diagram symbols', url: 'https://webstore.iec.ch/en/publication/2723', scope: 'Electrical diagrams; IEC rectangular and explicitly labeled alternative forms remain distinct.' },
    'ISA-5.1': { title: 'ANSI/ISA-5.1 — Instrumentation identification and symbols', url: 'https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa5', scope: 'Instrument functions and location conventions; no normative atlas is redistributed.' },
    'NFPC-FLUID': { title: 'NFPC / Webtec public fluid-power symbol guide', url: 'https://files.webtec.com/1219-1_2012_NFPC_Symbols.pdf', scope: 'Public visual reference for fluid-power function, actuator and port topology.' },
    'PROJECT': { title: 'Explicit project convention', url: '', scope: 'Functional equipment/topology schematic, not a normative ISO/IEC symbol or a safety sign.' }
};
const CATEGORIES = [
    { id: 'P&ID', name: 'P&ID', layer: 'Equipment', medium: 'process', refs: ['ISO-10628-2'], description: 'Process equipment, piping and valve bodies' },
    { id: 'Electrical', name: 'Electrical', layer: 'Electrical', medium: 'electrical', refs: ['IEC-60617'], description: 'Circuit components and power distribution' },
    { id: 'Flow', name: 'Flowcharts', layer: 'Process', medium: 'logical', refs: ['ISO-5807'], description: 'Information and process-flow notation' },
    { id: 'Instrumentation', name: 'Instrumentation', layer: 'Instruments', medium: 'signal', refs: ['ISA-5.1'], description: 'Measurement, control and location variants' },
    { id: 'Hydraulics', name: 'Hydraulics', layer: 'Hydraulics', medium: 'hydraulic', refs: ['ISO-1219-1', 'NFPC-FLUID'], description: 'Liquid-power components, valve states and actuators' },
    { id: 'Pneumatics', name: 'Pneumatics', layer: 'Pneumatics', medium: 'pneumatic', refs: ['ISO-1219-1', 'NFPC-FLUID'], description: 'Compressed-air preparation and motion control' },
    { id: 'HVAC', name: 'HVAC', layer: 'HVAC', medium: 'air', refs: ['PROJECT'], description: 'Air and hydronic functional schematics' },
    { id: 'Water', name: 'Water & plumbing', layer: 'Water', medium: 'water', refs: ['PROJECT'], description: 'Water treatment and building-water equipment' },
    { id: 'Automation', name: 'Automation', layer: 'Automation', medium: 'signal', refs: ['PROJECT'], description: 'Industrial control and I/O functional blocks' },
    { id: 'Fire', name: 'Fire & safety', layer: 'Fire', medium: 'alarm', refs: ['PROJECT'], description: 'Fire-alarm topology; not ISO 7010 signage' },
    { id: 'Network', name: 'Networks', layer: 'Network', medium: 'data', refs: ['PROJECT'], description: 'Vendor-neutral network and telecom topology' }
];
function categoryDefinition(id) {
    return CATEGORIES.find(category => category.id === id);
}

return {REFERENCES,CATEGORIES,categoryDefinition};
})();
// packages/symbols/src/catalog.js
__modules["packages/symbols/src/catalog.js"]=(()=>{
const {clone, createDocument, entityGeometry} = __modules["packages/model/src/index.js"];
const {bounds} = __modules["packages/geometry/src/index.js"];
const {L, P, C, R, T, A, E, B, port, H, V, F, leads, diamond, triangle, arrow, spring, capsule, vessel, functionalBlock} = __modules["packages/symbols/src/primitives.js"];
const {categoryDefinition} = __modules["packages/symbols/src/conventions.js"];
const PI = Math.PI;
const sense = () => [port('sense', 0, -45, 0, -1, 'signal')];
const fourFlow = (w = 55, h = 35) => [port('in', 0, h, 0, 1), port('out', 0, -h, 0, -1), port('left', -w, 0, -1, 0), port('right', w, 0, 1, 0)];
const valve = () => [...leads(), P([[-25, -18], [0, 0], [-25, 18]], true), P([[25, -18], [0, 0], [25, 18]], true)];
const instrument = (code, location = 'field') => [C(0, 0, 26), ...(location === 'panel' ? [L(-26, 0, 26, 0)] : location === 'rear' ? [L(-26, 0, 26, 0, { dash: [4, 3] })] : []), T(0, location === 'field' ? -5 : 7, code, 12), L(0, -26, 0, -45)];
const strokeSpring = () => spring(0, 23, 24, 6, true);
const tubeLeads = (r = 26) => [...leads(r), L(0, r, 0, 45), L(0, -r, 0, -45)];

/** Upgrade only the catalogue. installSymbols deliberately never replaces saved masters. */
function expandCatalog(legacy) {
    const symbols = legacy;
    const revisions = new Map();
    const change = (id, geometry, ports, reason, metadata = {}) => {
        const s = symbols.find(s => s.id === id);
        if (!s) throw new Error(`Unknown legacy symbol ${id}`);
        if (geometry) s.entities = geometry;
        if (ports) s.ports = ports;
        Object.assign(s.symbol, metadata);
        revisions.set(id, reason);
    };
    const add = (id, name, category, geometry, ports = H(), group = 'Components', metadata = {}) => {
        if (symbols.some(s => s.id === id)) throw new Error(`Duplicate symbol ${id}`);
        const s = { id, name, category, block: `CC_${id.toUpperCase().replaceAll('-', '_')}`, entities: geometry, ports, base: { x: 0, y: 0 }, symbol: { name, category, group, ...metadata } };
        symbols.push(s);
        revisions.set(id, 'New independently constructed CAD master with explicit terminal topology.');
        return s;
    };

    // All legacy IDs and named terminals remain stable. Geometry is corrected, not silently migrated.
    change('gate-valve', valve(), null, 'Two separate non-self-intersecting triangles with exact common apex.');
    change('ball-valve', [...valve(), C(0, 0, 11)], null, 'Valve body plus ball element; distinguish from butterfly disc.');
    change('globe-valve', [...valve(), C(0, 0, 7, { fill: 'BYBLOCK' })], null, 'Filled globe element distinguishes it from the ball valve.');
    change('butterfly-valve', [...leads(23), C(0, 0, 23), L(-16.263455967, -16.263455967, 16.263455967, 16.263455967), C(0, 0, 3)], null, 'Disc ends meet the circular body; separate disc and pivot.');
    change('check-valve', [L(-45, 0, -24, 0), L(24, 0, 45, 0), L(-24, -20, -24, 20), L(-24, 20, 24, -16), C(-24, 20, 3), L(0, 2, 0, 18)], [...H(), port('top', 0, 18, 0, 1, 'signal', 'legacy auxiliary takeoff')], 'Hinged flap/seat, not an electrical diode. Legacy takeoff retained and identified.');
    change('control-valve', [...valve(), L(0, 0, 0, 30), L(-20, 30, 20, 30), E(0, 30, 20, 14, 0, PI), L(0, 44, 0, 50)], [...H(), port('signal', 0, 50, 0, 1, 'signal')], 'Native elliptical diaphragm cap and a connected signal terminal.');
    change('solenoid-valve', [...valve(), L(0, 0, 0, 30), R(-12, 30, 24, 24), L(-12, 30, 12, 54)], null, 'Solenoid actuator square with diagonal, not an ambiguous text-only actuator.');
    change('relief-valve', [...valve(), L(0, 0, 0, 23), strokeSpring(), L(-14, 47, 14, 47)], null, 'Spring is attached to the valve stem and cap.');
    change('tank', [L(-35, -45, -35, 35), L(35, -45, 35, 35), L(-35, -45, 35, -45), E(0, 35, 35, 10), L(-45, 0, -35, 0), L(35, 0, 45, 0), L(0, 45, 0, 75), L(0, -45, 0, -88)], null, 'Flat-bottom storage tank is distinct from a domed pressure vessel.');
    change('vessel', [...vessel(), ...leads(27), L(0, 50, 0, 65), L(-15, -45.45, -15, -65), L(15, -45.45, 15, -65)], null, 'Native domed-end vessel rather than a plain rectangular box.');
    change('mixer', [...vessel(64, 110), ...leads(32), L(0, 55, 0, 65), R(-12, 65, 24, 18), L(0, 65, 0, -25), L(-24, -15, 24, -25)], [...H(), port('top', 0, 83, 0, 1, 'mechanical'), port('bottom', 0, -55, 0, -1)], 'Domed process vessel and impeller; motor port moved to its actual exposed terminal.');
    change('transformer', [...leads(32), C(-14, 0, 18), C(14, 0, 18)], null, 'Single-line transformer form uses intersecting winding circles, not circles mixed with a two-winding core schematic.', { representation: 'single-line', aliases: ['single line transformer', 'power transformer'] });
    change('relay', [...leads(), R(-25, -18, 50, 36)], null, 'Plain coil rectangle; remove diagonal that implied a different actuator.');
    change('resistor', null, null, 'Zigzag alternative explicitly separated from the IEC rectangular form.', { convention: 'ANSI/IEEE-style zigzag alternative', standardRefs: ['PROJECT'], representation: 'zigzag alternative' });
    symbols.find(s => s.id === 'resistor').name = 'Resistor · zigzag alternative';
    symbols.find(s => s.id === 'resistor-iec').name = 'Resistor · IEC rectangle';
    change('capacitor-polarized', [L(-45, 0, -7, 0), L(0, 0, 45, 0), L(-7, -25, -7, 25), A(52, 0, 52, PI - .46, PI + .46), L(-28, 20, -16, 20), L(-22, 14, -22, 26)], null, 'Native curved negative plate, explicit positive marking and connected leads.', { representation: 'curved-plate alternative', standardRefs: ['PROJECT'] });
    change('inductor', [L(-45, 0, -30, 0), L(30, 0, 45, 0), ...[-22.5, -7.5, 7.5, 22.5].map(x => A(x, 0, 7.5, 0, PI))], null, 'Coil turns are analytic arcs rather than pre-tessellated polylines.');
    change('document', [L(-55, -24, -55, 35), L(-55, 35, 55, 35), L(55, 35, 55, -24), B([[-55, -24], [-20, -55], [20, 7], [55, -24]]), T(0, -5, 'Document', 14)], fourFlow(), 'Native cubic document wave replaces sharp zigzag bottom.');
    symbols.find(s => s.id === 'document').ports.find(p => p.name === 'out').y = -24;
    change('database', [L(-45, -25, -45, 25), L(45, -25, 45, 25), E(0, 25, 45, 15), E(0, -25, 45, 15, PI, 2 * PI), T(0, -5, 'Database', 13)], fourFlow(45, 40), 'Native elliptical storage cylinder; terminals coincide with silhouette extrema.');
    change('terminator', [...capsule(-55, -30, 110, 60), T(0, -5, 'Start / end', 13)], null, 'Analytic semicircles preserve the capsule at arbitrary drawing scale.');
    change('delay', [L(-50, -35, 5, -35), A(5, 0, 35, -PI / 2, PI / 2), L(5, 35, -50, 35), L(-50, 35, -50, -35), T(-5, -5, 'Delay', 14)], null, 'Delay D-form uses a native semicircle.');
    change('pressure-panel', instrument('PI', 'panel'), sense(), 'Accessible panel location uses a solid horizontal divider.');
    change('pressure-rear', instrument('PI', 'rear'), sense(), 'Inaccessible location divider remains dashed in the catalogue preview and CAD.');

    // P&ID: functional equipment and valves, never electrical or safety-sign notation.
    const process = (id, name, geometry, ports = H(), group = 'Equipment', meta = {}) => add(id, name, 'P&ID', geometry, ports, group, meta);
    process('needle-valve', 'Needle valve', [...valve(), L(-16, 32, 8, -12), P([[2, -1], [8, -12], [9, 1]])], H(), 'Valves & actuators');
    process('diaphragm-valve', 'Diaphragm valve', [...leads(), P([[-25, -15], [-25, 12], [25, 12], [25, -15]]), E(0, 12, 25, 18, PI, 2 * PI), L(0, 12, 0, 35), L(-12, 35, 12, 35)], H(), 'Valves & actuators');
    process('plug-valve', 'Plug valve', [...valve(), R(-5, -10, 10, 20)], H(), 'Valves & actuators');
    process('knife-gate-valve', 'Knife gate valve', [...valve(), L(0, -23, 0, 36), R(-10, 36, 20, 8)], H(), 'Valves & actuators');
    process('motor-valve', 'Motor-operated valve', [...valve(), L(0, 0, 0, 33), C(0, 45, 12), T(0, 41, 'M', 11)], H(), 'Valves & actuators');
    process('rupture-disc', 'Rupture disc', [...leads(8), L(-8, -23, -8, 23), L(8, -23, 8, 23), E(-10, 0, 10, 21, -PI / 2, PI / 2)], H(), 'Fittings & connections');
    process('orifice-plate', 'Orifice plate', [L(-45, 0, 45, 0), L(0, -23, 0, -5), L(0, 5, 0, 23)], H(), 'Fittings & connections');
    process('spectacle-blind', 'Spectacle blind', [L(-45, 0, -12, 0), L(12, 0, 45, 0), C(0, 0, 12), C(0, 28, 12), L(0, 12, 0, 16)], H(), 'Fittings & connections');
    process('expansion-joint', 'Expansion joint', [...leads(), P([[-25, 0], [-20, 15], [-10, -15], [0, 15], [10, -15], [20, 15], [25, 0]])], H(), 'Fittings & connections');
    process('static-mixer', 'Static mixer', [...leads(30), R(-30, -18, 60, 36), ...[-20, 0, 20].map(x => L(x - 8, -15, x + 8, 15))]);
    process('plate-exchanger', 'Plate heat exchanger', [R(-30, -35, 60, 70), ...leads(30), L(0, 35, 0, 45), L(0, -35, 0, -45), ...[-18, -6, 6, 18].map(x => L(x - 7, -27, x + 7, 27))], F());
    process('column', 'Trayed separation column', [...vessel(48, 120), ...leads(24), L(0, 60, 0, 75), L(0, -60, 0, -75), ...[-24, -8, 8, 24].map(y => L(-24, y, 24, y))], [...H(), ...V(75)]);
    process('packed-column', 'Packed column', [...vessel(48, 120), ...leads(24), L(0, 60, 0, 75), L(0, -60, 0, -75), R(-22, -27, 44, 54), ...[-18, 0, 18].flatMap(y => [L(-22, y - 9, 22, y + 9), L(-22, y + 9, 22, y - 9)])], [...H(), ...V(75)]);
    process('cyclone', 'Cyclone separator', [R(-27, 0, 54, 40), P([[-27, 0], [0, -45], [27, 0]]), L(-45, 0, -27, 0), L(27, 0, 45, 0), L(0, 40, 0, 60), L(0, -45, 0, -60)], [...H(), ...V(60)]);
    process('steam-trap', 'Steam trap · functional', [...leads(), R(-25, -20, 50, 40), T(0, -4, 'ST', 13)], H(), 'Valves & actuators', { standardRefs: ['PROJECT'] });
    process('sight-glass', 'Sight glass', [...leads(), R(-25, -13, 50, 26), L(-18, -13, -18, 13), L(18, -13, 18, 13)], H(), 'Fittings & connections');
    process('sampling-point', 'Sampling point', [L(-45, 0, 45, 0), L(0, 0, 0, -32), P([[-8, -17], [8, -17], [0, -25]], true), P([[-8, -33], [8, -33], [0, -25]], true), L(0, -33, 0, -45)], [...H(), port('sample', 0, -45, 0, -1)], 'Fittings & connections');

    // Electrical: explicit normal states, polarity, emitter arrows and winding terminals.
    const electrical = (id, name, geometry, ports = H(), group = 'Components', meta = {}) => add(id, name, 'Electrical', geometry, ports, group, meta);
    electrical('variable-resistor', 'Variable resistor · IEC', [...leads(), R(-25, -11, 50, 22), ...arrow(-22, -25, 25, 27)], H(), 'Passive components');
    electrical('thermistor', 'Thermistor', [...leads(), R(-25, -11, 50, 22), P([[-22, -23], [-9, -23], [24, 24]]), T(-24, 25, 'ϑ', 10)], H(), 'Passive components');
    electrical('photoresistor', 'Photoresistor', [...leads(), R(-25, -11, 50, 22), ...arrow(-8, 40, 4, 21), ...arrow(9, 42, 21, 23)], H(), 'Passive components');
    electrical('zener-diode', 'Zener diode', [L(-45, 0, -22, 0), triangle([[-22, -22], [22, 0], [-22, 22]]), L(22, 0, 45, 0), P([[15, 24], [22, 24], [22, -24], [29, -24]])], H(), 'Semiconductors');
    electrical('photodiode', 'Photodiode', [L(-45, 0, -22, 0), triangle([[-22, -22], [22, 0], [-22, 22]]), L(22, -24, 22, 24), L(22, 0, 45, 0), ...arrow(0, 49, 14, 29), ...arrow(17, 49, 31, 29)], H(), 'Semiconductors');
    const bjt = (pnp) => [L(-45, 0, -14, 0), L(-14, -24, -14, 24), L(-14, 12, 22, 32), L(22, 32, 22, 45), L(-14, -12, 22, -32), L(22, -32, 22, -45), ...(pnp ? arrow(14, -27.55, -4, -17.55, 7, true) : arrow(-4, -17.55, 14, -27.55, 7, true))];
    const bjtPorts = () => [port('base', -45, 0, -1, 0), port('collector', 22, 45, 0, 1), port('emitter', 22, -45, 0, -1)];
    electrical('transistor-npn', 'BJT · NPN', bjt(false), bjtPorts(), 'Semiconductors');
    electrical('transistor-pnp', 'BJT · PNP', bjt(true), bjtPorts(), 'Semiconductors');
    electrical('transformer-windings', 'Transformer · two windings', [L(-45, 25, -22, 25), L(-45, -25, -22, -25), L(22, 25, 45, 25), L(22, -25, 45, -25), ...[-18.75, -6.25, 6.25, 18.75].flatMap(y => [A(-22, y, 6.25, -PI / 2, PI / 2), A(22, y, 6.25, PI / 2, PI * 1.5)]), L(-5, -30, -5, 30), L(5, -30, 5, 30)], [port('primary-1', -45, 25, -1, 0), port('primary-2', -45, -25, -1, 0), port('secondary-1', 45, 25, 1, 0), port('secondary-2', 45, -25, 1, 0)], 'Power & protection');
    electrical('circuit-breaker', 'Circuit breaker · single-line', [L(-45, 0, -18, 0), L(18, 0, 45, 0), C(-18, 0, 2), C(18, 0, 2), L(-18, 0, 13, 20), P([[-7, -8], [-7, -17], [8, -17], [8, -8]])], H(), 'Power & protection');
    electrical('disconnect', 'Disconnector', [L(-45, 0, -20, 0), L(20, 0, 45, 0), C(-20, 0, 2), L(-20, 0, 15, 24), L(20, -6, 20, 6)], H(), 'Power & protection');
    electrical('voltmeter', 'Voltmeter', [...leads(26), C(0, 0, 26), T(0, -7, 'V', 20)], H(), 'Meters');
    electrical('ammeter', 'Ammeter', [...leads(26), C(0, 0, 26), T(0, -7, 'A', 20)], H(), 'Meters');
    electrical('ac-source', 'AC voltage source', [...leads(26), C(0, 0, 26), B([[-17, 0], [-10, 30], [10, -30], [17, 0]])], H(), 'Sources');
    electrical('dc-source', 'DC voltage source', [...leads(26), C(0, 0, 26), L(-15, -5, -15, 5), L(-20, 0, -10, 0), L(10, 0, 20, 0)], H(), 'Sources');
    electrical('junction-dot', 'Connected wire junction', [L(-45, 0, 45, 0), L(0, -45, 0, 45), C(0, 0, 3.5, { fill: 'BYBLOCK' })], F(), 'Connections', { connectivity: 'All terminals connected' });
    electrical('wire-crossing', 'Wire crossing · no connection', [L(-45, 0, -7, 0), A(0, 0, 7, 0, PI), L(7, 0, 45, 0), L(0, -45, 0, -9), L(0, 9, 0, 45)], F(), 'Connections', { connectivity: 'in/out and top/bottom remain separate circuits' });
    electrical('inverter', 'DC / AC inverter', [R(-30, -25, 60, 50), ...leads(30), L(-30, -25, 30, 25), T(-14, 10, '=', 14), T(14, -18, '~', 18)], H(), 'Power & protection');
    electrical('pv-module', 'Photovoltaic module', [...leads(30), R(-30, -20, 60, 40), L(-10, -20, -10, 20), L(10, -20, 10, 20), L(-30, 0, 30, 0), ...arrow(-22, 46, -8, 28), ...arrow(-4, 46, 10, 28)], H(), 'Sources', { standardRefs: ['PROJECT'] });
    electrical('three-phase-motor', 'Motor · three-phase', [...tubeLeads(29), C(0, 0, 29), T(0, 0, 'M', 19), T(0, -17, '3~', 11)], F(), 'Power & protection');
    electrical('cell', 'Cell', [L(-45, 0, -6, 0), L(6, 0, 45, 0), L(-6, -24, -6, 24), L(6, -12, 6, 12)], H(), 'Sources');

    // Flowchart silhouettes: no internal control symbols are confused with industrial equipment.
    const flow = (id, name, geometry, ports = fourFlow(), meta = {}) => add(id, name, 'Flow', geometry, ports, 'Information flow', meta);
    flow('manual-operation', 'Manual operation', [P([[-55, 35], [55, 35], [35, -35], [-35, -35]], true), T(0, -5, 'Manual', 14)], fourFlow(45));
    flow('offpage-flow', 'Off-page flow reference', [P([[-40, 35], [40, 35], [40, -10], [0, -40], [-40, -10]], true), T(0, -1, 'A', 15)], [port('in', 0, 35, 0, 1), port('out', 0, -40, 0, -1)]);
    flow('internal-storage', 'Internal storage', [R(-55, -35, 110, 70), L(-40, -35, -40, 35), L(-55, 22, 55, 22), T(5, -7, 'Storage', 13)]);
    flow('display', 'Display', [P([[-40, -30], [30, -30]]), A(30, 0, 30, -PI / 2, PI / 2), P([[30, 30], [-40, 30], [-60, 0], [-40, -30]]), T(0, -5, 'Display', 13)], [port('in', 0, 30, 0, 1), port('out', 0, -30, 0, -1), port('left', -60, 0, -1, 0), port('right', 60, 0, 1, 0)]);
    flow('stored-data', 'Stored data', [L(-38, -35, 48, -35), E(48, 0, 12, 35, PI / 2, PI * 1.5), L(48, 35, -38, 35), E(-38, 0, 12, 35, PI / 2, PI * 1.5), T(0, -5, 'Stored data', 12)], fourFlow(0));
    symbols.at(-1).ports = [port('in', 0, 35, 0, 1), port('out', 0, -35, 0, -1), port('left', -50, 0, -1, 0), port('right', 36, 0, 1, 0)];
    flow('merge', 'Merge', [triangle([[-52, 35], [52, 35], [0, -35]]), T(0, 5, 'Merge', 12)], [port('in', 0, 35, 0, 1), port('left', -26, 0, -1, 0), port('right', 26, 0, 1, 0), port('out', 0, -35, 0, -1)], { standardRefs: ['PROJECT'] });
    flow('extract', 'Extract', [triangle([[-52, -35], [52, -35], [0, 35]]), T(0, -19, 'Extract', 12)], [port('in', 0, 35, 0, 1), port('out', 0, -35, 0, -1), port('left', -26, 0, -1, 0), port('right', 26, 0, 1, 0)], { standardRefs: ['PROJECT'] });
    flow('collate', 'Collate', [triangle([[-45, 35], [45, 35], [0, 0]]), triangle([[0, 0], [-45, -35], [45, -35]])], [port('in', 0, 35, 0, 1), port('out', 0, -35, 0, -1)], { standardRefs: ['PROJECT'] });
    flow('sort', 'Sort', [diamond(55, 40), L(-55, 0, 55, 0), T(0, 11, 'Sort', 12)], fourFlow(55, 40), { standardRefs: ['PROJECT'] });
    flow('parallel', 'Parallel processing', [L(-55, -10, 55, -10), L(-55, 10, 55, 10)], [port('in', 0, 10, 0, 1), port('out', 0, -10, 0, -1)], { standardRefs: ['PROJECT'] });

    // Instrument letters describe function; location variants have independent geometry.
    for (const [id, name, code] of [
        ['pressure-transmitter', 'Pressure transmitter', 'PT'], ['differential-pressure', 'Differential pressure transmitter', 'PDT'],
        ['temperature-indicator', 'Temperature indicator', 'TI'], ['flow-indicator', 'Flow indicator', 'FI'],
        ['level-indicator', 'Level indicator', 'LI'], ['pressure-switch', 'Pressure switch', 'PS'], ['level-switch', 'Level switch', 'LS'],
        ['temperature-switch', 'Temperature switch', 'TS'], ['analyser', 'Analytical transmitter', 'AT'],
        ['flow-controller', 'Flow indicating controller', 'FIC'], ['pressure-controller', 'Pressure indicating controller', 'PIC'],
        ['temperature-controller', 'Temperature indicating controller', 'TIC'], ['level-controller', 'Level indicating controller', 'LIC']
    ]) add(id, name, 'Instrumentation', instrument(code), sense(), code.endsWith('IC') ? 'Control functions' : 'Field instruments', { functionCode: code, instrumentLocation: 'field', aliases: [code] });
    add('flow-controller-panel', 'Flow controller · accessible panel', 'Instrumentation', instrument('FIC', 'panel'), sense(), 'Location variants', { functionCode: 'FIC', instrumentLocation: 'primary accessible panel' });
    add('flow-controller-rear', 'Flow controller · inaccessible panel', 'Instrumentation', instrument('FIC', 'rear'), sense(), 'Location variants', { functionCode: 'FIC', instrumentLocation: 'normally inaccessible' });
    add('ip-converter', 'Current / pressure converter', 'Instrumentation', [R(-26, -24, 52, 48), ...leads(26), L(-26, -24, 26, 24), T(-13, 8, 'I', 14), T(13, -17, 'P', 14)], [port('in', -45, 0, -1, 0, 'signal'), port('out', 45, 0, 1, 0, 'pneumatic')], 'Control functions', { standardRefs: ['PROJECT'], aliases: ['I/P', 'electropneumatic'] });
    add('thermowell', 'Thermowell', 'Instrumentation', [L(0, 45, 0, -23), L(-13, 23, 13, 23), L(-7, 23, -7, -23), A(0, -23, 7, PI, 2 * PI), L(7, -23, 7, 23)], [port('sense', 0, 45, 0, 1)], 'Field instruments', { standardRefs: ['PROJECT'] });

    // Fluid-power symbols: solid triangles mean liquid; open triangles mean gas.
    const fluidMachine = (motor, air, variable = false) => [C(0, 0, 26), ...leads(26), triangle(motor ? [[-24, -8], [-24, 8], [-9, 0]] : [[10, -8], [10, 8], [24, 0]], !air), ...(variable ? arrow(-29, -32, 31, 32, 8) : [])];
    const fluidFilter = () => [diamond(), ...leads(28), L(0, -28, 0, 28, { dash: [4, 3] })];
    const throttle = (variable) => [L(-45, 0, 45, 0), E(-8, 0, 7, 14, -PI / 2, PI / 2), E(8, 0, 7, 14, PI / 2, PI * 1.5), ...(variable ? arrow(-20, -27, 23, 27) : [])];
    const fluidCheck = () => [L(-45, 0, -12, 0), L(12, 0, 45, 0), C(0, 0, 10), P([[-12, -15], [0, 0], [-12, 15]])];
    const cylinder = (single, cushioned = false) => [R(-34, -22, 68, 44), L(-8, -22, -8, 22), L(-8, -5, 49, -5), L(49, -5, 49, 5), L(49, 5, -8, 5), L(-23, -22, -23, -45), ...(single ? [spring(0, 0, 28, 8)] : [L(23, -22, 23, -45)]), ...(cushioned ? [L(-27, -22, -27, 22), L(27, -22, 27, -7), L(27, 7, 27, 22)] : [])];
    const cylinderPorts = single => [port('A', -23, -45, 0, -1), ...(!single ? [port('B', 23, -45, 0, -1)] : [])];
    const blockEnd = (x, y, vertical) => vertical ? L(x - 5, y, x + 5, y) : L(x, y - 5, x, y + 5);
    function directional(three, closed) {
        const g = [R(-48, -22, 48, 44), R(0, -22, 48, 44), R(-68, -18, 20, 20), L(-68, -18, -48, 2), spring(48, 0, 26, 7)];
        // Right-hand square is the spring-rest state; external ports only there.
        g.push(L(12, 22, 12, 45), L(12, -22, 12, -45));
        if (three) g.push(L(36, -22, 36, -45));
        g.push(...arrow(-36, -16, -36, 16));
        if (three) g.push(L(-12, -22, -12, -10), blockEnd(-12, -10, true));
        if (closed) {
            g.push(L(12, -22, 12, -12), blockEnd(12, -12, true));
            if (three) g.push(...arrow(12, 17, 36, -17));
            else g.push(L(12, 22, 12, 12), blockEnd(12, 12, true));
        } else {
            g.push(...arrow(12, -16, 12, 16));
            if (three) g.push(L(36, -22, 36, -12), blockEnd(36, -12, true));
            // In the alternate state P is blocked and A exhausts (3/2), or both stop (2/2).
        }
        return g;
    }
    function spool43(tandem) {
        const g = [R(-66, -22, 44, 44), R(-22, -22, 44, 44), R(22, -22, 44, 44), spring(-88, 0, 22, 6), spring(66, 0, 22, 6)];
        for (const x of [-11, 11]) { g.push(L(x, 22, x, 45), L(x, -22, x, -45), L(x, 22, x, 10), blockEnd(x, 10, true)); }
        if (tandem) g.push(P([[-11, -22], [-11, -5], [11, -5], [11, -22]]));
        else for (const x of [-11, 11]) g.push(L(x, -22, x, -10), blockEnd(x, -10, true));
        g.push(...arrow(-55, -16, -33, 16), ...arrow(-55, 16, -33, -16), ...arrow(33, -16, 33, 16), ...arrow(55, 16, 55, -16));
        return g;
    }
    for (const [cat, prefix, air] of [['Hydraulics', 'hyd', false], ['Pneumatics', 'pneu', true]]) {
        const put = (suffix, name, g, ports = H(), group = 'Components', metadata = {}) => add(`${prefix}-${suffix}`, name, cat, g, ports, group, metadata);
        put(air ? 'compressor' : 'pump', air ? 'Air compressor' : 'Fixed-displacement pump', fluidMachine(false, air), H(), 'Sources & drives', { energy: air ? 'gas/open triangle' : 'liquid/filled triangle' });
        put('motor', air ? 'Air motor' : 'Hydraulic motor', fluidMachine(true, air), H(), 'Sources & drives', { energy: air ? 'gas/open triangle' : 'liquid/filled triangle' });
        if (!air) put('variable-pump', 'Variable-displacement pump', fluidMachine(false, false, true), H(), 'Sources & drives');
        put('filter', air ? 'Air filter' : 'Hydraulic filter', fluidFilter(), H(), 'Conditioning');
        put('throttle', 'Fixed flow restriction', throttle(false), H(), 'Flow & pressure');
        put('flow-control', 'Adjustable flow control', throttle(true), H(), 'Flow & pressure');
        put('check', 'Non-return valve', fluidCheck(), H(), 'Flow & pressure');
        put('gauge', 'Pressure gauge', [C(0, 0, 24), L(0, -24, 0, -45), ...arrow(8, -8, -12, 13, 6, true)], [port('sense', 0, -45, 0, -1)], 'Measurement');
        put('cylinder', 'Double-acting cylinder', cylinder(false), cylinderPorts(false), 'Actuators');
        put('cylinder-spring', 'Single-acting spring-return cylinder', cylinder(true), cylinderPorts(true), 'Actuators');
        put('cylinder-cushioned', 'Double-acting cushioned cylinder', cylinder(false, true), cylinderPorts(false), 'Actuators');
        put('valve-22-nc', '2/2 valve · normally closed', directional(false, true), [port('A', 12, 45, 0, 1), port('P', 12, -45, 0, -1)], 'Directional valves', { positions: 2, workingPorts: 2, normalState: 'closed' });
        put('valve-32', '3/2 valve · spring-rest exhaust', directional(true, true), [port('A', 12, 45, 0, 1), port('P', 12, -45, 0, -1), port('R', 36, -45, 0, -1)], 'Directional valves', { positions: 2, workingPorts: 3, normalState: 'P blocked; A to R' });
        put('shuttle', 'Shuttle valve', [R(-25, -20, 50, 40), ...leads(), C(8, 0, 8), P([[-20, -12], [-8, 0], [-20, 12]]), L(0, 20, 0, 45)], [...H(), port('A', 0, 45, 0, 1)], 'Flow & pressure');
        put('plug', 'Plugged port', [L(0, -45, 0, 0), L(-12, 0, 12, 0)], [port('terminal', 0, -45, 0, -1)], 'Connections');
    }
    add('hyd-valve-43', '4/3 valve · closed centre', 'Hydraulics', spool43(false), [port('A', -11, 45, 0, 1), port('B', 11, 45, 0, 1), port('P', -11, -45, 0, -1), port('T', 11, -45, 0, -1)], 'Directional valves', { positions: 3, workingPorts: 4, normalState: 'all ports closed' });
    add('hyd-valve-43-tandem', '4/3 valve · tandem centre', 'Hydraulics', spool43(true), [port('A', -11, 45, 0, 1), port('B', 11, 45, 0, 1), port('P', -11, -45, 0, -1), port('T', 11, -45, 0, -1)], 'Directional valves', { positions: 3, workingPorts: 4, normalState: 'P to T; A/B blocked' });
    add('hyd-reservoir', 'Vented hydraulic reservoir', 'Hydraulics', [P([[-30, 20], [-30, -22], [30, -22], [30, 20]]), L(-11, 45, -11, -8), L(11, 45, 11, -8), L(-25, 0, 25, 0)], [port('suction', -11, 45, 0, 1), port('return', 11, 45, 0, 1)], 'Sources & drives');
    add('hyd-accumulator', 'Bladder accumulator', 'Hydraulics', [...vessel(42, 90), L(0, -45, 0, -60), E(0, 3, 21, 12, PI, 2 * PI), triangle([[-6, 17], [6, 17], [0, 7]])], [port('fluid', 0, -60, 0, -1)], 'Sources & drives');
    add('hyd-relief', 'Pressure relief valve', 'Hydraulics', [R(-22, -22, 44, 44), ...leads(22), ...arrow(-16, 0, 16, 0, 7, true), spring(0, 22, 26, 6, true), P([[-34, 0], [-34, -34], [0, -34], [0, -22]], false, { dash: [4, 3] })], H(), 'Flow & pressure');
    add('pneu-dryer', 'Air dryer', 'Pneumatics', [diamond(), ...leads(28), L(-9, -19, -9, 19), L(9, -19, 9, 19)], H(), 'Conditioning');
    add('pneu-lubricator', 'Air lubricator', 'Pneumatics', [diamond(), ...leads(28), P([[0, 13], [-6, 0], [0, -7], [6, 0]], true)], H(), 'Conditioning');
    add('pneu-regulator', 'Pressure regulator', 'Pneumatics', [R(-22, -22, 44, 44), ...leads(22), ...arrow(-16, 0, 16, 0), spring(0, 22, 25, 6, true), ...arrow(-15, 28, 15, 50)], H(), 'Conditioning');
    add('pneu-exhaust', 'Exhaust to atmosphere', 'Pneumatics', [L(0, 45, 0, 6), triangle([[-10, 6], [10, 6], [0, -12]])], [port('exhaust', 0, 45, 0, 1)], 'Connections');
    add('pneu-silencer', 'Exhaust silencer', 'Pneumatics', [L(0, 45, 0, 18), R(-16, -18, 32, 36), ...[-10, 0, 10].map(x => L(x, -14, x, 14, { dash: [2, 3] }))], [port('exhaust', 0, 45, 0, 1)], 'Connections');

    // The following categories are openly labelled project-convention functional drawings.
    const hvac = (id, name, g, ports = H(), medium = 'air') => add(`hvac-${id}`, name, 'HVAC', g, ports.map(p => ({ ...p, medium })), 'Air & hydronic systems');
    hvac('fan', 'Duct fan', [R(-32, -30, 64, 60), ...leads(32), C(0, 0, 24), ...arrow(-16, 0, 16, 0)]);
    hvac('filter', 'Duct filter', [R(-30, -25, 60, 50), ...leads(30), L(-22, -25, 22, 25, { dash: [4, 3] })]);
    hvac('damper', 'Manual duct damper', [R(-30, -25, 60, 50), ...leads(30), L(-24, -18, 24, 18), L(0, 0, 0, 37), L(-8, 37, 8, 37)]);
    hvac('motor-damper', 'Motorized duct damper', [R(-30, -25, 60, 50), ...leads(30), L(-24, -18, 24, 18), L(0, 25, 0, 36), C(0, 46, 10), T(0, 42, 'M', 10)]);
    hvac('fire-damper', 'Fire damper · schematic', [R(-30, -25, 60, 50), ...leads(30), L(-24, -18, 24, 18), T(0, 34, 'FD', 11)]);
    hvac('heating-coil', 'Air heating coil', [R(-30, -25, 60, 50), ...leads(30), ...[-18, -6, 6, 18].map(x => L(x, -23, x, 23)), T(0, 33, '+', 16)]);
    hvac('cooling-coil', 'Air cooling coil', [R(-30, -25, 60, 50), ...leads(30), ...[-18, -6, 6, 18].map(x => L(x, -23, x, 23)), T(0, 33, '−', 16)]);
    hvac('silencer', 'Duct attenuator', [R(-30, -25, 60, 50), ...leads(30), R(-25, 10, 50, 8), R(-25, -18, 50, 8)]);
    hvac('diffuser', 'Supply diffuser · schematic', [R(-26, -26, 52, 52), R(-15, -15, 30, 30), L(-26, -26, 26, 26), L(-26, 26, 26, -26), ...leads(26)]);
    hvac('return-grille', 'Return grille · schematic', [R(-26, -26, 52, 52), ...leads(26), ...[-18, -9, 0, 9, 18].map(y => L(-26, y, 26, y))]);
    hvac('boiler', 'Boiler · functional', [...functionalBlock('BOILER'), L(0, 22, 0, 45)], [...H(), port('flue', 0, 45, 0, 1)], 'water');
    hvac('chiller', 'Chiller · functional', functionalBlock('CHILLER'), H(), 'water');
    hvac('radiator', 'Hydronic radiator', [R(-30, -20, 60, 40), ...leads(30), ...[-20, -10, 0, 10, 20].map(x => L(x, -20, x, 20))], H(), 'water');
    hvac('expansion-vessel', 'Expansion vessel', [...vessel(44, 70), L(-22, 0, 22, 0), L(0, -35, 0, -45)], [port('water', 0, -45, 0, -1)], 'water');
    const water = (id, name, g, ports = H()) => add(`water-${id}`, name, 'Water', g, ports, 'Treatment & distribution');
    water('meter', 'Water meter', [...leads(26), C(0, 0, 26), T(0, -5, 'WM', 13)]);
    water('backflow', 'Double-check backflow preventer', [R(-32, -22, 64, 44), ...leads(32), ...[-25, 3].flatMap(x => [L(x, -12, x, 12), L(x, 12, x + 20, -9), C(x, 12, 2)])]);
    water('heater', 'Storage water heater', [...vessel(54, 90), ...leads(27), T(0, -5, 'WH', 13)]);
    water('softener', 'Water softener', [...vessel(54, 90), ...leads(27), R(-21, -20, 42, 40), T(0, -5, 'IX', 13)]);
    water('ro', 'Reverse-osmosis membrane', [R(-32, -22, 64, 44), ...leads(32), L(-7, -22, -7, 22), L(7, -22, 7, 22), L(0, -22, 0, -45)], [...H(), port('reject', 0, -45, 0, -1)]);
    water('uv', 'UV disinfection', [R(-32, -22, 64, 44), ...leads(32), L(-22, 10, 22, 10), T(0, -12, 'UV', 13)]);
    water('screen', 'Coarse screen', [R(-25, -30, 50, 60), ...leads(), ...[-18, -9, 0, 9, 18].map(x => L(x, -30, x, 30))]);
    water('dosing', 'Chemical dosing pump', [...leads(26), C(0, 0, 26), P([[-15, -14], [15, -14], [15, 14], [-15, 14]], true), L(0, 14, 0, 26)]);
    water('drain', 'Floor drain · schematic', [R(-25, -25, 50, 50), L(-25, -25, 25, 25), L(-25, 25, 25, -25), L(0, -25, 0, -45)], [port('waste', 0, -45, 0, -1)]);
    water('tap', 'Water draw-off tap', [P([[-45, 0], [8, 0], [8, -20], [30, -20]]), L(-8, 0, -8, 20), L(-20, 20, 4, 20)], [port('supply', -45, 0, -1, 0), port('outlet', 30, -20, 1, 0)]);
    water('sump', 'Sump / collection pit', [P([[-32, 28], [-32, -30], [32, -30], [32, 28]]), L(-45, 0, -32, 0), L(32, 0, 45, 0), L(-28, -6, 28, -6)]);
    water('air-release', 'Automatic air-release valve', [R(-18, -25, 36, 50), C(0, -8, 10), L(0, -25, 0, -45), P([[0, 25], [0, 38], [22, 38]])], [port('water', 0, -45, 0, -1), port('vent', 22, 38, 1, 0)]);

    const logic = (id, name, label, category, group) => add(id, name, category, functionalBlock(label), H(), group, { representation: 'functional block' });
    for (const [id, name, label] of [['plc', 'Programmable logic controller', 'PLC'], ['di', 'Digital input module', 'DI'], ['do', 'Digital output module', 'DO'], ['ai', 'Analog input module', 'AI'], ['ao', 'Analog output module', 'AO'], ['vfd', 'Variable-frequency drive', 'VFD'], ['safety-relay', 'Safety relay · functional', 'SAFE'], ['pid-block', 'PID control function', 'PID'], ['gateway', 'Industrial protocol gateway', 'GW']]) logic(`auto-${id}`, name, label, 'Automation', 'Control & I/O');
    add('auto-hmi', 'Operator HMI', 'Automation', [R(-32, -24, 64, 48), R(-25, -14, 50, 31), C(0, -19, 2), ...leads(32), T(0, -2, 'HMI', 12)], H(), 'Control & I/O');
    add('auto-proximity', 'Inductive proximity sensor', 'Automation', [R(-27, -18, 54, 36), ...leads(27), L(-18, -8, -18, 8), ...[-8, 1, 10].map(x => A(x, 0, 7, -PI / 2, PI / 2))], H(), 'Sensors');
    add('auto-photoeye', 'Photoelectric sensor', 'Automation', [R(-27, -18, 54, 36), ...leads(27), ...arrow(-17, -9, 0, 9), ...arrow(0, -9, 17, 9)], H(), 'Sensors');
    for (const [id, name, label] of [['panel', 'Fire-alarm control panel', 'FACP'], ['smoke', 'Smoke detector', 'SD'], ['heat', 'Heat detector', 'HD'], ['call', 'Manual call point', 'MCP'], ['sounder', 'Alarm sounder', 'SND'], ['strobe', 'Alarm strobe', 'STR'], ['monitor', 'Monitor module', 'MON'], ['interface', 'Fire-control interface', 'IF']]) {
        const round = ['smoke', 'heat', 'sounder'].includes(id);
        add(`fire-${id}`, name, 'Fire', round ? [...leads(26), C(0, 0, 26), T(0, -4, label, 11)] : functionalBlock(label), H(), 'Alarm system topology', { representation: 'project functional symbol', safetySign: false });
    }
    for (const [id, name, label] of [['router', 'Router', 'RTR'], ['switch', 'Network switch', 'SW'], ['firewall', 'Firewall', 'FW'], ['server', 'Server', 'SRV'], ['workstation', 'Workstation', 'PC'], ['ap', 'Wireless access point', 'AP'], ['patch', 'Patch panel', 'PATCH'], ['phone', 'IP telephone', 'TEL'], ['camera', 'IP camera', 'CAM'], ['cloud', 'External network', 'WAN']]) {
        let g = functionalBlock(label);
        if (id === 'server') g = [R(-27, -32, 54, 64), ...leads(27), ...[-20, 0, 20].flatMap(y => [R(-21, y - 7, 42, 14), C(12, y, 2)])];
        if (id === 'firewall') g = [R(-30, -24, 60, 48), ...leads(30), L(-30, -8, 30, -8), L(-30, 8, 30, 8), L(0, -24, 0, -8), L(-15, -8, -15, 8), L(15, -8, 15, 8), L(0, 8, 0, 24)];
        if (id === 'ap') g.push(A(0, 23, 10, 0, PI), A(0, 23, 18, 0, PI));
        add(`net-${id}`, name, 'Network', g, [...H(), port('branch', 0, -40, 0, -1)], 'Network topology', { representation: 'vendor-neutral functional symbol' });
        symbols.at(-1).entities.push(L(0, id === 'server' ? -32 : id === 'firewall' ? -24 : -22, 0, -40));
    }

    // A common review record is attached after corrections and expansion, with deterministic child IDs.
    for (const s of symbols) {
        const category = categoryDefinition(s.category);
        if (s.category === 'P&ID' && (s.id.startsWith('pressure-') || ['temperature', 'flow-transmitter', 'level-transmitter'].includes(s.id))) {
            s.symbol.standardRefs = ['ISA-5.1']; s.symbol.group = 'Field & panel instruments';
            s.ports = s.ports.map(p => ({ ...p, medium: 'signal' }));
        }
        const refs = s.symbol.standardRefs || category.refs;
        s.symbol = { ...s.symbol, name: s.name, category: s.category, geometryRevision: 3, standardRefs: refs,
            convention: s.symbol.convention || (refs.includes('PROJECT') ? 'Explicit project drafting convention' : refs.join(' / ') + ' family'),
            conformity: 'Original master; not standards-certified', normativeEntry: null,
            review: { level: 'geometry-and-convention', dimensionalConformance: 'not-verified', note: revisions.get(s.id) || 'Reviewed: silhouette, terminal positions, normal state and distinct function retained.' },
            group: s.symbol.group || (s.category === 'P&ID' ? s.id.includes('valve') ? 'Valves & actuators' : 'Equipment & instruments' : 'Components'),
            aliases: [...new Set([...(s.symbol.aliases || []), s.id.replaceAll('-', ' ')])],
            defaultLayer: category.layer
        };
        // Clear stale revision-2 generic wording; a reference is not a claim of normative equivalence.
        if (/drafting conventions|Flowchart conventions/.test(s.symbol.convention) && s.id !== 'resistor') s.symbol.convention = refs.includes('PROJECT') ? 'Explicit project drafting convention' : refs.join(' / ') + ' family';
        s.ports = s.ports.map(p => ({ ...p, medium: p.medium || category.medium, role: p.role || 'connection' }));
        s.entities = clone(s.entities);
        s.entities.forEach((e, i) => { e.id = `master-${s.id}-${i}`; e.linetype = 'CONTINUOUS';
            e.color ??= 'BYBLOCK'; });
        const doc = createDocument();
        const pts = s.entities.flatMap(e => entityGeometry(e, doc, { tolerance: .03 }).paths.flatMap(p => p.points));
        const bb = bounds(pts);
        s.symbol.labelOffset = Math.max(48, Math.ceil(-bb.minY + 22));
        s.symbol.extents = bb;
    }
    return symbols;
}

return {expandCatalog};
})();
// packages/symbols/src/templates.js
__modules["packages/symbols/src/templates.js"]=(()=>{
const {createDocument, line, text, polyline, ports, entityBounds, entityGeometry} = __modules["packages/model/src/index.js"];
const {routePorts} = __modules["packages/routing/src/index.js"];
const {bounds} = __modules["packages/geometry/src/index.js"];
const node = (id, symbol, x, y, tag, options = {}) => ({ id, symbol, x, y, tag, ...options });
const link = (from, to, style, label = '', waypoints = []) => ({ from, to, style, label, waypoints });
const row = (items, y = 350) => items.map(([symbol, tag], i) => node(`n${i}`, symbol, 130 + i * 190, y, tag));
const chain = (count, style) => Array.from({ length: count - 1 }, (_, i) => link(`n${i}.out`, `n${i + 1}.in`, style));
const definitions = [];
function profile(id, name, industry, drawingType, categories, standardRefs, description, nodes = [], connections = [], defaultLineStyle = 'process') {
    const value = { id, name, industry, drawingType, categories, standardRefs, description, nodes, connections, defaultLineStyle };
    definitions.push(value);
    return value;
}
profile('pid', 'Process water skid', 'Process engineering', 'Piping & instrumentation', ['P&ID', 'Instrumentation'], ['ISO-10628-2', 'ISA-5.1'], 'Existing editable process-water P&ID example.');
profile('electrical', 'Motor control circuit', 'Electrical engineering', 'Electrical schematic', ['Electrical'], ['IEC-60617'], 'Existing component and wire example.', [], [], 'electrical');
profile('flow', 'Commissioning workflow', 'Manufacturing & quality', 'Flowchart', ['Flow'], ['ISO-5807'], 'Existing inspection, decision and rework workflow.', [], [], 'workflow');
profile('water-treatment', 'Water treatment train', 'Water & wastewater', 'Treatment process flow', ['Water', 'P&ID'], ['ISO-10628-2', 'PROJECT'], 'Screening, pressure, membrane separation and disinfection with a reject outlet.',
    [...row([['water-screen', 'SC-101'], ['pump', 'P-101'], ['water-ro', 'RO-101'], ['water-uv', 'UV-101'], ['water-meter', 'WM-101']]), node('waste', 'water-sump', 510, 160, 'REJECT')],
    [...chain(5, 'water'), link('n2.reject', 'waste.in', 'wastewater', 'CONCENTRATE')], 'water');
profile('chemical-batch', 'Batch reactor and heat transfer', 'Chemical & petrochemical', 'Piping & instrumentation', ['P&ID', 'Instrumentation'], ['ISO-10628-2', 'ISA-5.1'], 'Agitated vessel, control valve, circulation pump and exchanger. Process values require engineering.',
    [node('feed', 'gate-valve', 130, 360, 'HV-101'), node('reactor', 'mixer', 360, 360, 'R-101'), node('cv', 'control-valve', 600, 360, 'TCV-101'), node('hx', 'plate-exchanger', 860, 360, 'E-101'), node('pump', 'pump', 600, 160, 'P-101'), node('tt', 'temperature-controller', 600, 490, 'TIC-101')],
    [link('feed.out', 'reactor.in', 'process'), link('reactor.out', 'cv.in', 'process'), link('cv.out', 'hx.in', 'process'), link('hx.out', 'pump.in', 'process'), link('pump.out', 'reactor.bottom', 'process'), link('tt.sense', 'cv.signal', 'signal')]);
profile('oil-gas', 'Separation and metering', 'Oil & gas', 'Process flow diagram', ['P&ID', 'Instrumentation'], ['ISO-10628-2'], 'Separator, metering and outlet isolation with a liquid draw-off.',
    [node('feed', 'gate-valve', 130, 350, 'XV-101'), node('sep', 'vessel', 370, 350, 'V-101'), node('meter', 'orifice-plate', 620, 350, 'FE-101'), node('out', 'control-valve', 860, 350, 'PCV-101'), node('drain', 'ball-valve', 370, 150, 'LV-101'), node('pt', 'pressure-transmitter', 620, 490, 'PT-101')],
    [link('feed.out', 'sep.in', 'process'), link('sep.out', 'meter.in', 'process'), link('meter.out', 'out.in', 'process'), link('sep.bottom', 'drain.in', 'drain'), link('pt.sense', 'out.signal', 'signal')]);
profile('food-beverage', 'Product transfer and heating', 'Food & beverage', 'Process flow diagram', ['P&ID', 'Water'], ['ISO-10628-2', 'PROJECT'], 'Storage, pumping, heat exchange and sample point; hygienic design is not inferred from the symbol.',
    row([['tank', 'TK-101'], ['pump', 'P-101'], ['plate-exchanger', 'HX-101'], ['sampling-point', 'SP-101'], ['diaphragm-valve', 'DV-101']]), chain(5, 'process'));
profile('pharmaceutical', 'Purified water treatment', 'Pharmaceutical & biotech', 'Utility process schematic', ['Water', 'P&ID'], ['ISO-10628-2', 'PROJECT'], 'Ion exchange, membrane separation and UV equipment; not a validated pharmaceutical system.',
    row([['water-softener', 'IX-101'], ['pump', 'P-101'], ['water-ro', 'RO-101'], ['water-uv', 'UV-101'], ['water-meter', 'WM-101']]), chain(5, 'water'), 'water');
profile('power-single-line', 'Power distribution single-line', 'Power & energy', 'Single-line diagram', ['Electrical'], ['IEC-60617'], 'Source, breaker, transformer, measurement and load with explicit single-line symbols.',
    row([['generator', 'G1'], ['circuit-breaker', 'Q1'], ['transformer', 'T1'], ['ammeter', 'A1'], ['three-phase-motor', 'M1']]), chain(5, 'power'), 'power');
profile('solar', 'Solar power conversion', 'Renewable energy', 'Power conversion schematic', ['Electrical'], ['IEC-60617', 'PROJECT'], 'Photovoltaic generation, DC isolation, inverter and AC protection.',
    row([['pv-module', 'PV1'], ['disconnect', 'QS1'], ['inverter', 'INV1'], ['circuit-breaker', 'QF1'], ['ac-source', 'GRID']]),
    [link('n0.out', 'n1.in', 'electrical', 'DC'), link('n1.out', 'n2.in', 'electrical', 'DC'), link('n2.out', 'n3.in', 'power', 'AC'), link('n3.out', 'n4.in', 'power', 'AC')], 'power');
profile('hvac-air', 'Air handling system', 'Building services', 'Air-system schematic', ['HVAC'], ['PROJECT'], 'Filter, heating and cooling coils, fan and controlled air outlet.',
    row([['hvac-filter', 'F-101'], ['hvac-heating-coil', 'HC-101'], ['hvac-cooling-coil', 'CC-101'], ['hvac-fan', 'SF-101'], ['hvac-motor-damper', 'MD-101']]), chain(5, 'air'), 'air');
profile('hvac-hydronic', 'Hydronic heating circuit', 'Building services', 'Hydronic schematic', ['HVAC', 'P&ID'], ['PROJECT'], 'Boiler circulation, radiator, isolation and expansion connection.',
    [node('boiler', 'hvac-boiler', 150, 350, 'B-101'), node('pump', 'pump', 390, 350, 'P-101'), node('valve', 'control-valve', 630, 350, 'CV-101'), node('load', 'hvac-radiator', 870, 350, 'RAD-101'), node('exp', 'hvac-expansion-vessel', 390, 480, 'EV-101')],
    [link('boiler.out', 'pump.in', 'water'), link('pump.out', 'valve.in', 'water'), link('valve.out', 'load.in', 'water'), link('load.out', 'boiler.in', 'return', '', [{ x: 1020, y: 130 }, { x: 60, y: 130 }]), link('pump.top', 'exp.water', 'water')], 'water');
profile('hydraulic-actuator', 'Hydraulic actuator circuit', 'Industrial machinery', 'Fluid-power circuit', ['Hydraulics'], ['ISO-1219-1'], 'Pump, relief valve, reservoir and closed-centre directional valve driving a double-acting cylinder.',
    [node('tank', 'hyd-reservoir', 150, 140, 'TK-1'), node('pump', 'hyd-pump', 150, 350, 'P-1'), node('spool', 'hyd-valve-43', 570, 280, 'V-1'), node('cyl', 'hyd-cylinder', 570, 470, 'A-1'), node('relief', 'hyd-relief', 330, 160, 'RV-1')],
    [link('tank.suction', 'pump.in', 'hydraulic'), link('pump.out', 'spool.P', 'hydraulic'), link('spool.A', 'cyl.A', 'hydraulic'), link('spool.B', 'cyl.B', 'hydraulic'), link('spool.T', 'tank.return', 'hyd-return', '', [{ x: 760, y: 90 }, { x: 210, y: 90 }]), link('pump.out', 'relief.in', 'hydraulic'), link('relief.out', 'tank.return', 'hyd-return')], 'hydraulic');
profile('pneumatic-clamp', 'Pneumatic spring-return actuator', 'Industrial machinery', 'Pneumatic circuit', ['Pneumatics'], ['ISO-1219-1'], 'Air preparation, 3/2 valve with spring-rest exhaust, cylinder and exhaust silencer.',
    [node('source', 'pneu-compressor', 120, 300, 'AIR'), node('filter', 'pneu-filter', 310, 300, 'F1'), node('reg', 'pneu-regulator', 500, 300, 'PR1'), node('spool', 'pneu-valve-32', 760, 280, 'V1'), node('cyl', 'pneu-cylinder-spring', 760, 470, 'A1'), node('silencer', 'pneu-silencer', 930, 130, 'EXH')],
    [link('source.out', 'filter.in', 'air-power'), link('filter.out', 'reg.in', 'air-power'), link('reg.out', 'spool.P', 'air-power'), link('spool.A', 'cyl.A', 'air-power'), link('spool.R', 'silencer.exhaust', 'air-power')], 'air-power');
profile('instrument-loop', 'Flow-control loop', 'Process automation', 'Instrument functional loop', ['Instrumentation', 'P&ID'], ['ISA-5.1', 'PROJECT'], 'Field transmitter, controller, current-to-pressure converter and valve actuator.',
    [node('ft', 'flow-transmitter', 150, 420, 'FT-101'), node('fic', 'flow-controller-panel', 390, 420, 'FIC-101'), node('ip', 'ip-converter', 630, 300, 'FY-101'), node('cv', 'control-valve', 880, 300, 'FCV-101')],
    [link('ft.sense', 'fic.sense', 'signal', '4–20 mA', [{ x: 150, y: 300 }, { x: 390, y: 300 }]), link('fic.sense', 'ip.in', 'signal'), link('ip.out', 'cv.signal', 'pneumatic', 'AIR')], 'signal');
profile('automation-io', 'Automation I/O architecture', 'Process automation', 'Control architecture', ['Automation', 'Electrical', 'Network'], ['PROJECT'], 'Sensor, I/O, PLC and drive function chain; signal topology, not a power wiring diagram.',
    [...row([['auto-proximity', 'B1'], ['auto-di', 'DI1'], ['auto-plc', 'PLC1'], ['auto-ao', 'AO1'], ['auto-vfd', 'VFD1']]), node('hmi', 'auto-hmi', 510, 490, 'HMI1')],
    [...chain(5, 'signal'), link('hmi.in', 'n2.in', 'data')], 'signal');
profile('fire-alarm', 'Fire-alarm topology', 'Fire protection', 'Alarm-system topology', ['Fire'], ['PROJECT'], 'Panel, detection, call point and alarm devices. Functional diagram, not fire signage or compliance design.',
    row([['fire-panel', 'FACP1'], ['fire-smoke', 'SD1'], ['fire-heat', 'HD1'], ['fire-call', 'MCP1'], ['fire-sounder', 'SND1']]), chain(5, 'alarm'), 'alarm');
profile('network', 'Industrial network topology', 'IT & telecom', 'Network topology', ['Network', 'Automation'], ['PROJECT'], 'WAN, perimeter firewall, switch and server with a wireless branch.',
    [...row([['net-cloud', 'WAN'], ['net-router', 'R1'], ['net-firewall', 'FW1'], ['net-switch', 'SW1'], ['net-server', 'SRV1']]), node('ap', 'net-ap', 700, 140, 'AP1')],
    [...chain(5, 'data'), link('n3.branch', 'ap.in', 'data', 'LAN')], 'data');
profile('plumbing', 'Building-water supply', 'Building services', 'Water distribution schematic', ['Water', 'P&ID'], ['PROJECT'], 'Metering, backflow protection, isolation, heater and draw-off point.',
    [...row([['water-meter', 'WM1'], ['water-backflow', 'BFP1'], ['gate-valve', 'HV1'], ['water-heater', 'WH1']]), node('tap', 'water-tap', 890, 350, 'TAP1')],
    [...chain(4, 'water'), link('n3.out', 'tap.supply', 'hot-water')], 'water');
profile('quality-workflow', 'Manufacturing release workflow', 'Manufacturing & quality', 'Information flowchart', ['Flow'], ['ISO-5807'], 'Preparation, controlled operation, inspection decision and record storage.',
    [node('prep', 'preparation', 140, 390, 'SETUP'), node('manual', 'manual-operation', 370, 390, 'OPERATE'), node('dec', 'decision', 620, 390, 'PASS?'), node('store', 'internal-storage', 880, 390, 'RECORD'), node('reject', 'document', 620, 170, 'NCR')],
    [link('prep.right', 'manual.left', 'workflow'), link('manual.right', 'dec.no', 'workflow'), link('dec.yes', 'store.left', 'workflow', 'YES'), link('dec.out', 'reject.in', 'workflow', 'NO')], 'workflow');
const DRAWING_TYPES = definitions;

/** Build actual CAD entities and attached, obstacle-routed connectors, not a thumbnail mockup. */
function buildTemplate(id, installSymbols, insertSymbol, styles) {
    const definition = DRAWING_TYPES.find(d => d.id === id);
    if (!definition?.nodes.length) throw new Error(`Unknown industry drawing type: ${id}`);
    const doc = installSymbols(createDocument(definition.name));
    doc.metadata = { ...doc.metadata, description: definition.description, industry: definition.industry, drawingType: definition.drawingType, templateId: id, standardRefs: [...definition.standardRefs], geometryRevision: 3, approval: 'Concept schematic; engineering approval required' };
    const nodes = new Map();
    for (const n of definition.nodes) {
        const e = insertSymbol(doc, n.symbol, n.x, n.y, { tag: n.tag, ...(n.rotation ? { rotation: n.rotation } : {}) });
        doc.entities.push(e); nodes.set(n.id, e);
    }
    const obstacles = [...nodes.values()].map(e => ({ ...bounds(entityGeometry(e, doc, { tolerance: .1 }).paths.flatMap(p => p.points)), id: e.id }));
    const terminal = address => {
        const separator = address.indexOf('.'), id = address.slice(0, separator), name = address.slice(separator + 1), e = nodes.get(id);
        const p = e && ports(e, doc).find(p => p.name === name);
        if (!p) throw new Error(`Template ${definition.id} has no terminal ${address}`);
        return { ...p, entityId: e.id };
    };
    for (const c of definition.connections) {
        const a = terminal(c.from), b = terminal(c.to), style = styles.find(s => s.id === c.style);
        if (!style) throw new Error(`Unknown line style ${c.style}`);
        const routing = routePorts(a, b, obstacles, { clearance: 8, lead: 18, waypoints: c.waypoints });
        if (routing.status !== 'routed') throw new Error(`Template ${id} has a blocked connection: ${c.from} to ${c.to}`);
        doc.entities.push(polyline(routing.points, false, { layer: style.layer, color: style.color, width: style.width, dash: [...style.dash], label: c.label, connector: { from: { entityId: a.entityId, port: a.name }, to: { entityId: b.entityId, port: b.name }, style: style.id, arrow: style.arrow, waypoints: c.waypoints.map(p => ({ ...p })), status: routing.status } }));
    }
    const annotation = (x, y, value, height = 12) => text({ x, y }, value, height, { layer: 'Annotations' });
    doc.entities.push(annotation(40, 620, definition.name, 27), annotation(40, 584, `${definition.industry}  /  ${definition.drawingType}`, 13), line({ x: 40, y: 562 }, { x: 1120, y: 562 }, { layer: 'Annotations' }), annotation(40, 42, 'CONCEPT SCHEMATIC — NOT FOR CONSTRUCTION', 11), annotation(650, 42, `${id.toUpperCase()}  |  REV 03  |  mm`, 11));
    return doc;
}

return {DRAWING_TYPES,buildTemplate};
})();
// packages/symbols/src/validation.js
__modules["packages/symbols/src/validation.js"]=(()=>{
const {createDocument, entityGeometry} = __modules["packages/model/src/index.js"];
const {bounds, validBounds, distanceToSegment, distance} = __modules["packages/geometry/src/index.js"];
/** Structural/geometry audit, deliberately separate from normative dimensional approval. */
function inspectSymbol(master, tolerance = .15) {
    const errors = [], warnings = [], doc = createDocument(), paths = [], primitives = {};
    if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('Invalid audit tolerance');
    if (!master.id || !master.block) errors.push('Missing symbol identity');
    const seen = new Set();
    for (const e of master.entities || []) {
        primitives[e.type] = (primitives[e.type] || 0) + 1;
        if (seen.has(e.id)) errors.push(`Duplicate child identity ${e.id}`);
        seen.add(e.id);
        if (e.type === 'LINE' && distance(e.a, e.b) < 1e-8) errors.push(`Zero-length line ${e.id}`);
        try {
            const g = entityGeometry(e, doc, { tolerance: .02 });
            paths.push(...g.paths);
            if (!g.paths.length && !g.texts.length) errors.push(`Empty primitive ${e.id}`);
        } catch (error) { errors.push(`${e.id}: ${error.message}`); }
    }
    const points = paths.flatMap(p => p.points), box = bounds(points);
    if (!validBounds(box) || !points.length) errors.push('No finite drawable extent');
    if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push('Non-finite geometry');
    const names = new Set(), terminalDistances = {};
    for (const port of master.ports || []) {
        if (!port.name || names.has(port.name)) errors.push('Missing or duplicate terminal name');
        names.add(port.name);
        if (![port.x, port.y, port.dx, port.dy].every(Number.isFinite)) errors.push(`Invalid terminal ${port.name}`);
        if (Math.abs(Math.hypot(port.dx, port.dy) - 1) > 1e-6) errors.push(`Terminal ${port.name} direction is not unit length`);
        let nearest = Infinity;
        for (const p of paths) {
            for (let i = 1; i < p.points.length; i++) nearest = Math.min(nearest, distanceToSegment(port, p.points[i - 1], p.points[i]));
            if (p.closed) nearest = Math.min(nearest, distanceToSegment(port, p.points.at(-1), p.points[0]));
        }
        terminalDistances[port.name] = nearest;
        if (nearest > tolerance) errors.push(`Detached terminal ${port.name}: ${nearest.toFixed(6)} units`);
        if (!port.medium) errors.push(`Unspecified terminal medium ${port.name}`);
    }
    if (!master.symbol?.standardRefs?.length) errors.push('Missing convention provenance');
    if (master.symbol?.normativeEntry == null) warnings.push('Normative dimensions / entry not independently verified');
    return { id: master.id, category: master.category, geometryRevision: master.symbol?.geometryRevision, primitives, bounds: box, terminals: terminalDistances, errors, warnings };
}
function inspectCatalog(symbols) {
    const ids = new Set(), names = new Set();
    return symbols.map(s => {
        const result = inspectSymbol(s), key = s.block.toUpperCase();
        if (ids.has(s.id)) result.errors.push('Duplicate catalogue identity');
        if (names.has(key)) result.errors.push('Duplicate DXF block name');
        ids.add(s.id); names.add(key);
        return result;
    });
}

return {inspectSymbol,inspectCatalog};
})();
// packages/symbols/src/index.js
__modules["packages/symbols/src/index.js"]=(()=>{
const {expandCatalog} = __modules["packages/symbols/src/catalog.js"];
const {CATEGORIES:categoryList, REFERENCES:referenceList, categoryDefinition} = __modules["packages/symbols/src/conventions.js"];
const {DRAWING_TYPES:drawingTypes, buildTemplate} = __modules["packages/symbols/src/templates.js"];
const {inspectSymbol, inspectCatalog} = __modules["packages/symbols/src/validation.js"];
const {line, polyline, circle, rect, text, entity, uid, clone, createDocument, ports, entityBounds} = __modules["packages/model/src/index.js"];
const {arcPoints, TAU} = __modules["packages/geometry/src/index.js"];
const p = (x, y) => ({ x, y }), L = (x1, y1, x2, y2) => line(p(x1, y1), p(x2, y2)), P = (points, closed = false) => polyline(points.map(([x, y]) => p(x, y)), closed), C = (x, y, r) => circle(p(x, y), r), R = (x, y, w, h) => rect(x, y, w, h), T = (x, y, s, h = 15) => text(p(x, y), s, h, { align: 'center' });
const horizontal = [{ name: 'in', x: -45, y: 0, dx: -1, dy: 0 }, { name: 'out', x: 45, y: 0, dx: 1, dy: 0 }];
const four = [...horizontal, { name: 'top', x: 0, y: 45, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -45, dx: 0, dy: -1 }];
const lead = [L(-45, 0, -25, 0), L(25, 0, 45, 0)];
const valve = [...lead, P([[-25,-18],[0,0],[-25,18]],true), P([[25,-18],[0,0],[25,18]],true)];
const symbols = [];
function def(id, name, category, geometry, ports = horizontal, extra = {}) { const symbol = { id, name, category, block: `CC_${id.toUpperCase().replace(/-/g, '_')}`, entities: geometry, ports, base: p(0, 0), symbol: { name, category, labelOffset: 57, geometryRevision: 2, convention: category === 'Electrical' ? 'IEC/ANSI functional drafting conventions' : category === 'P&ID' ? 'Process and instrumentation drafting conventions' : 'Flowchart conventions', conformity: 'Original master; not standards-certified', ...extra } }; symbols.push(symbol); return symbol; }
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
// Explicit terminal geometry: every port terminates on a contour or a lead.
const roundLeads = (radius, vertical = false) => [L(-45,0,-radius,0),L(radius,0,45,0),...(vertical ? [L(0,radius,0,45),L(0,-radius,0,-45)] : [])];
const revise = (id, geometry, newPorts) => { const s=symbols.find(s=>s.id===id); if(geometry)s.entities=geometry; if(newPorts)s.ports=newPorts; };
revise('ball-valve',[...roundLeads(21),C(0,0,21),L(-15,-15,15,15)]);
revise('butterfly-valve',[...roundLeads(23),C(0,0,23),L(-16,-16,16,16),C(0,0,3)]);
revise('check-valve',[L(-45,0,-24,0),L(24,0,45,0),L(-24,-20,-24,20),L(-24,20,24,-16),C(-24,20,3),L(0,2,0,18)]);
for(const [id,radius,vertical] of [['pump',27,true],['gear-pump',28,true],['compressor',29,true],['fan',29,false],['heat-exchanger',33,false],['motor',29,true],['generator',29,true],['lamp',24,false]]) {
    const master=symbols.find(s=>s.id===id); master.entities=[...roundLeads(radius,vertical),...master.entities.slice(2)];
}
revise('filter',[...lead,R(-25,-28,50,56),L(-25,-28,25,28),L(-25,28,25,-28),L(0,28,0,45),L(0,-28,0,-45)]);
const diodeBody=[L(-45,0,-22,0),P([[-22,-22],[22,0],[-22,22]],true),L(22,-24,22,24),L(22,0,45,0)];
revise('diode',diodeBody);
revise('led',[...diodeBody,L(4,27,24,47),P([[15,45],[24,47],[22,38]]),L(18,22,38,42),P([[29,40],[38,42],[36,33]])]);
revise('offpage',[P([[-40,-17],[24,-17],[44,0],[24,17],[-40,17]],true),L(-45,0,-40,0),L(44,0,45,0),T(-4,-5,'PW',13)]);
const cardinal = (top,bottom,left,right) => [{name:'in',x:0,y:top,dx:0,dy:1},{name:'out',x:0,y:bottom,dx:0,dy:-1},{name:'left',x:left,y:0,dx:-1,dy:0},{name:'right',x:right,y:0,dx:1,dy:0}];
revise('data',null,cardinal(35,-35,-53.5,53.5));
revise('document',null,cardinal(35,-25,-55,55));
revise('database',null,cardinal(40,-40,-45,45));
revise('manual',null,cardinal(32,-35,-55,55));
revise('preparation',null,cardinal(35,-35,-60,60));
revise('delay',null,cardinal(35,-35,-50,40));
revise('note',null,[{name:'left',x:-45,y:0,dx:-1,dy:0},{name:'top',x:0,y:35,dx:0,dy:1},{name:'bottom',x:0,y:-35,dx:0,dy:-1}]);
// Original function/location variants; exact normative symbol identifiers are intentionally not asserted.
const sensePort=[{name:'sense',x:0,y:-45,dx:0,dy:-1}];
def('pressure-panel','Pressure indicator · panel','P&ID',[C(0,0,26),L(-26,0,26,0),T(0,7,'PI',12),L(0,-26,0,-45)],sensePort,{instrumentLocation:'primary accessible panel'});
def('pressure-rear','Pressure indicator · rear panel','P&ID',[C(0,0,26),line(p(-26,0),p(26,0),{dash:[4,3]}),T(0,7,'PI',12),L(0,-26,0,-45)],sensePort,{instrumentLocation:'normally inaccessible'});
def('capacitor-polarized','Capacitor · polarized','Electrical',[L(-45,0,-7,0),L(0,0,45,0),L(-7,-25,-7,25),P(arcPoints(p(52,0),52,Math.PI-.46,Math.PI+.46,.1).map(p=>[p.x,p.y])),L(-28,20,-16,20),L(-22,14,-22,26)]);
def('signal-ground','Signal reference','Electrical',[L(0,40,0,10),P([[-24,10],[24,10],[0,-22]],true)],[{name:'terminal',x:0,y:40,dx:0,dy:1}]);
def('chassis','Chassis connection','Electrical',[L(0,40,0,8),L(-24,8,24,8),L(-24,8,-35,-8),L(0,8,-11,-8),L(24,8,13,-8)],[{name:'terminal',x:0,y:40,dx:0,dy:1}]);
def('contact-no','Contact · normally open','Electrical',[L(-45,0,-8,0),L(8,0,45,0),L(-8,-23,-8,23),L(8,-23,8,23)]);
def('contact-nc','Contact · normally closed','Electrical',[L(-45,0,-8,0),L(8,0,45,0),L(-8,-23,-8,23),L(8,-23,8,23),L(-19,-28,19,28)]);
def('potentiometer','Potentiometer','Electrical',[...lead,R(-25,-11,50,22),L(0,45,0,12),P([[-6,22],[0,12],[6,22]])],[...horizontal,{name:'wiper',x:0,y:45,dx:0,dy:1}]);
expandCatalog(symbols);
const SYMBOLS = symbols;
const CATEGORIES = categoryList;
const STANDARD_REFERENCES = referenceList;
const DRAWING_TYPES = drawingTypes;
function auditSymbols() { return inspectCatalog(SYMBOLS); }
function auditSymbol(master, tolerance) { return inspectSymbol(master, tolerance); }
function searchSymbols(query = '', { category, standard, limit = Infinity } = {}) {
    if (!(limit >= 0)) throw new RangeError('Invalid search limit');
    const tokens = String(query).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    return SYMBOLS.filter(s => (!category || category === 'All' || s.category === category) && (!standard || s.symbol.standardRefs.includes(standard)) && tokens.every(token => [s.name, s.id, s.category, s.symbol.group, ...s.symbol.aliases, ...s.symbol.standardRefs].join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(token))).slice(0, limit);
}
function symbolUpdates(doc) {
    return SYMBOLS.filter(s => doc.blocks[s.block] && (doc.blocks[s.block].symbol?.geometryRevision || 0) < s.symbol.geometryRevision);
}
/** Explicit replacement only; callers should wrap this in their document history transaction. */
function updateSymbolDefinitions(doc, ids) {
    const chosen = [...new Set(ids)].map(id => {
        const s = SYMBOLS.find(s => s.id === id);
        if (!s) throw new Error(`Unknown symbol: ${id}`);
        const old = doc.blocks[s.block];
        const ports = new Set(s.ports.map(p => p.name));
        for (const p of old?.ports || []) if (!ports.has(p.name)) throw new Error(`Cannot remove saved terminal ${id}.${p.name}`);
        return s;
    });
    for (const s of chosen) doc.blocks[s.block] = clone({ name: s.block, base: s.base, entities: s.entities, ports: s.ports, symbol: s.symbol });
    return chosen.map(s => s.id);
}
const LINE_STYLES = [
    { id: 'process', name: 'Process pipe', layer: 'Process', color: '#147c77', width: 2, dash: [], arrow: 'end' },
    { id: 'signal', name: 'Instrument signal', layer: 'Instruments', color: '#aa7c4b', width: 1.5, dash: [6, 4], arrow: 'none' },
    { id: 'electrical', name: 'Electrical wire', layer: 'Electrical', color: '#6979b4', width: 1.5, dash: [], arrow: 'none' },
    { id: 'data', name: 'Data / communication', layer: 'Electrical', color: '#8876a7', width: 1.5, dash: [10, 3, 2, 3], arrow: 'end' },
    { id: 'pneumatic', name: 'Pneumatic signal · project dash convention', layer: 'Instruments', color: '#a38560', width: 1.5, dash: [10, 3, 2, 3, 2, 3], arrow: 'none' },
    { id: 'hydraulic', name: 'Hydraulic working line', layer: 'Hydraulics', color: '#557d99', width: 2.8, dash: [], arrow: 'none' },
    { id: 'drain', name: 'Drain / utility', layer: 'Process', color: '#75898d', width: 1.5, dash: [12, 5], arrow: 'end' },
    { id: 'center', name: 'Centerline', layer: 'Annotations', color: '#8e9298', width: 1, dash: [16, 3, 2, 3], arrow: 'none' },
    { id: 'hidden', name: 'Hidden edge', layer: '0', color: '#8e9298', width: 1.2, dash: [4, 3], arrow: 'none' },
    { id: 'boundary', name: 'Equipment boundary', layer: 'Annotations', color: '#9bacb3', width: 1, dash: [8, 4], arrow: 'none' },
    { id: 'workflow', name: 'Workflow sequence', layer: 'Process', color: '#147c77', width: 1.8, dash: [], arrow: 'end' },
    { id: 'water', name: 'Water supply · project', layer: 'Water', color: '#257cab', width: 2, dash: [], arrow: 'end' },
    { id: 'hot-water', name: 'Hot water · project', layer: 'Water', color: '#b65440', width: 2, dash: [], arrow: 'end' },
    { id: 'wastewater', name: 'Wastewater · project', layer: 'Water', color: '#836848', width: 2, dash: [12, 4], arrow: 'end' },
    { id: 'return', name: 'Hydronic return · project', layer: 'HVAC', color: '#547889', width: 1.8, dash: [12, 4], arrow: 'end' },
    { id: 'air', name: 'Air duct centreline · schematic', layer: 'HVAC', color: '#528c80', width: 2.5, dash: [], arrow: 'end' },
    { id: 'air-power', name: 'Pneumatic working line', layer: 'Pneumatics', color: '#528c80', width: 1.8, dash: [], arrow: 'none' },
    { id: 'hyd-return', name: 'Hydraulic return line', layer: 'Hydraulics', color: '#587b9b', width: 1.8, dash: [], arrow: 'none' },
    { id: 'pilot', name: 'Fluid-power pilot line', layer: 'Hydraulics', color: '#7b8898', width: 1.2, dash: [4, 3], arrow: 'none' },
    { id: 'power', name: 'Power single-line', layer: 'Electrical', color: '#6979b4', width: 2.4, dash: [], arrow: 'none' },
    { id: 'alarm', name: 'Fire-alarm loop · project', layer: 'Fire', color: '#bd6455', width: 1.6, dash: [], arrow: 'none' }

];
function installSymbols(doc) {
    for (const category of CATEGORIES) {
        if (!doc.layers.some(layer => layer.name === category.layer)) doc.layers.push({ name: category.layer, color: '#355463', visible: true, locked: false });
    }
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
    const layer = s.symbol?.defaultLayer || categoryDefinition(s.category)?.layer || 'Equipment';
    if (!doc.layers.some(l => l.name === layer)) doc.layers.push({ name: layer, color: '#355463', visible: true, locked: false });
    return entity('INSERT', { block: s.block || s.name, x, y, sx: 1, sy: 1, rotation: 0, layer, tag: options.tag ?? '', ...options });
}
/** Editable CAD starters; the three original drawing IDs remain backward compatible. */
function createDemo(kind = 'pid') {
    if (!['pid', 'electrical', 'flow'].includes(kind)) return buildTemplate(kind, installSymbols, insertSymbol, LINE_STYLES);
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
    note(40, 576, kind === 'pid' ? 'PW-101   ·   PIPING & INSTRUMENTATION   ·   REV 03' : kind === 'flow' ? 'QA-204   ·   PROCESS FLOW   ·   REV 03' : 'EL-301   ·   ELECTRICAL SCHEMATIC   ·   REV 03', 12);
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
function createDrawing(type = 'pid') { return createDemo(type); }


return {SYMBOLS,CATEGORIES,STANDARD_REFERENCES,DRAWING_TYPES,auditSymbols,auditSymbol,searchSymbols,symbolUpdates,updateSymbolDefinitions,LINE_STYLES,installSymbols,insertSymbol,createDemo,createDrawing};
})();
// packages/dxf/src/codec.js
__modules["packages/dxf/src/codec.js"]=(()=>{
/** Lossless tag values and bounded ASCII/binary transport. DXF R13+ uses
 * two-byte group codes; R12 uses one-byte codes with a 255 escape. */
const SIGNATURE = 'AutoCAD Binary DXF\r\n\x1a\0';
const between = (c, a, b) => c >= a && c <= b;
function groupType(c) {
    if (!Number.isInteger(c) || c < 0 || c > 1071) throw new Error(`Invalid DXF group code ${c}`);
    if (between(c, 310, 319) || c === 1004) return 'binary';
    if (between(c, 10, 59) || between(c, 110, 149) || between(c, 210, 239) || between(c, 460, 469) || between(c, 1010, 1059)) return 'double';
    if (between(c, 60, 79) || between(c, 170, 179) || between(c, 270, 289) || between(c, 370, 389) || between(c, 400, 409) || between(c, 1060, 1070)) return 'int16';
    if (between(c, 90, 99) || between(c, 420, 429) || between(c, 440, 459) || c === 1071) return 'int32';
    if (between(c, 160, 169)) return 'int64';
    if (between(c, 290, 299)) return 'byte';
    return 'string';
}
function checkedValue(c, value) {
    const type = groupType(c);
    if (type === 'string') { const s=String(value); if (/[\r\n\0]/.test(s)) throw new Error(`Control character in DXF group ${c}`); return s; }
    if (type === 'binary') { const s=String(value).trim(); if (!/^(?:[\da-f]{2}){0,127}$/i.test(s)) throw new Error(`Invalid binary chunk in group ${c}`); return s; }
    const s=String(value).trim();
    if (!s || !(type !== 'int64' ? /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/ : /^[-+]?\d+$/).test(s)) throw new Error(`Invalid ${type} in group ${c}`);
    if (type === 'int64') { const n=BigInt(s); if(n<-(1n<<63n)||n>=(1n<<63n))throw new Error(`Int64 overflow in group ${c}`);return s; }
    const n=Number(s); if(!Number.isFinite(n))throw new Error(`Non-finite DXF value in group ${c}`);
    if (type!=='double') { const lo=type==='byte'?0:type==='int16'?-32768:-2147483648, hi=type==='byte'?1:type==='int16'?32767:2147483647;
        if(!Number.isInteger(n)||n<lo||n>hi)throw new Error(`DXF ${type} overflow in group ${c}`); }
    return n;
}
function limitOptions(options) {
    const n=options.maxPairs??8000000;
    if(!Number.isSafeInteger(n)||n<1||n>8000000)throw new Error('Invalid DXF maxPairs limit');
    return n;
}
function readAsciiTags(source, options={}) {
    if(typeof source!=='string'||source.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB text limit');
    const max=limitOptions(options), lines=source.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/), pairs=[];
    while(lines.length&&lines.at(-1)==='')lines.pop();
    if(lines.length%2)throw new Error('Truncated DXF group/value pair');
    let eof=false;
    for(let i=0;i<lines.length;i+=2) {
        if(pairs.length>=max)throw new Error('DXF group-code safety limit exceeded');
        if(!/^\s*\d+\s*$/.test(lines[i]))throw new Error(`Invalid DXF group code at line ${i+1}`);
        const c=Number(lines[i]), value=checkedValue(c,lines[i+1]);
        if(eof) { if(c!==999)throw new Error('Data after DXF EOF marker'); else {pairs.push([c,value]);continue;} }
        pairs.push([c,value]); if(c===0&&String(value).trim()==='EOF')eof=true;
    }
    if(!eof)throw new Error('DXF EOF marker missing (file may be truncated)');
    return pairs;
}
function decodeCodePage(page='ANSI_1252') {
    const p=String(page).toUpperCase().replace(/^ANSI_/, '');
    const names={'874':'windows-874','932':'shift_jis','936':'gbk','949':'euc-kr','950':'big5','1361':'euc-kr','UTF-8':'utf-8','UTF8':'utf-8'};
    return names[p] || (/^125[0-8]$/.test(p)?'windows-'+p:/^DOS(?:_|)(\d+)$/.test(p)?'ibm'+p.match(/\d+/)[0]:'windows-1252');
}
function readBinaryTags(input, options={}) {
    const u=input instanceof Uint8Array?input:new Uint8Array(input);
    if(u.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB limit');
    if(u.length<24 || SIGNATURE.split('').some((s,i)=>u[i]!==s.charCodeAt(0)))throw new Error('Invalid binary DXF signature');
    const v=new DataView(u.buffer,u.byteOffset,u.byteLength), max=limitOptions(options), result=[];
    // Structural SECTION/999 tag at the beginning disambiguates the code width.
    const r12=options.r12??(u[23]!==0); let pos=22,eof=false;
    const need=n=>{if(pos+n>u.length)throw new Error('Truncated binary DXF');};
    const strings=[];
    while(pos<u.length) {
        if(result.length>=max)throw new Error('DXF group-code safety limit exceeded');
        need(r12?1:2);let c;
        if(r12) {c=u[pos++];if(c===255){need(2);c=v.getUint16(pos,true);pos+=2;}}else {c=v.getUint16(pos,true);pos+=2;}
        const t=groupType(c);let value;
        if(t==='string') {const start=pos;while(pos<u.length&&u[pos])pos++;need(1);value=new TextDecoder('windows-1252').decode(u.subarray(start,pos));strings.push([result.length,start,pos]);pos++;}
        else if(t==='binary'){need(1);const n=u[pos++];need(n);value=Array.from(u.subarray(pos,pos+n),b=>b.toString(16).padStart(2,'0')).join('');pos+=n;}
        else if(t==='double'){need(8);value=v.getFloat64(pos,true);pos+=8;}
        else if(t==='int16'){need(2);value=v.getInt16(pos,true);pos+=2;}
        else if(t==='int32'){need(4);value=v.getInt32(pos,true);pos+=4;}
        else if(t==='int64'){need(8);value=v.getBigInt64(pos,true).toString();pos+=8;}
        else {need(1);value=u[pos++];}
        checkedValue(c,value);result.push([c,value]);
        if(c===0&&value==='EOF'){eof=true;break;}
    }
    if(!eof)throw new Error('Binary DXF EOF marker missing');
    if(pos!==u.length)throw new Error('Data after binary DXF EOF marker');
    // Decode *after* scanning the header, including strings preceding $DWGCODEPAGE.
    let key='',ver='AC1009',page='ANSI_1252';
    for(const [c,x] of result){if(c===9)key=x;else if(key==='$ACADVER'&&c===1)ver=x;else if(key==='$DWGCODEPAGE'&&c===3)page=x;}
    const decoder=new TextDecoder(options.encoding || (ver>='AC1021'?'utf-8':decodeCodePage(page)),{fatal:true});
    for(const [i,a,b] of strings)result[i][1]=decoder.decode(u.subarray(a,b));
    return result;
}
function writeAsciiTags(pairs,{version='AC1024'}={}) {
    return pairs.map(([c,v])=>{let s=String(checkedValue(c,v));if(version<'AC1021')s=s.replace(/[\u0080-\uffff]/g,x=>'\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));return `${c}\r\n${s}\r\n`;}).join('');
}
function writeBinaryTags(pairs,{version='AC1024',r12=version<='AC1009'}={}) {
    const bytes=[],encoder=new TextEncoder();let size=22;
    for(const [c,v] of pairs) {
        if(c===999)continue; // Binary DXF does not carry ASCII comments.
        const value=checkedValue(c,v),t=groupType(c),codeSize=r12?(c<255?1:3):2;
        let payload;
        if(t==='string') {let s=String(value);if(version<'AC1021')s=s.replace(/[\u0080-\uffff]/g,x=>'\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));payload=encoder.encode(s+'\0');}
        else if(t==='binary'){const s=String(value);payload=new Uint8Array(1+s.length/2);payload[0]=s.length/2;for(let i=0;i<s.length;i+=2)payload[1+i/2]=parseInt(s.slice(i,i+2),16);}
        else {payload=new Uint8Array(t==='double'||t==='int64'?8:t==='int32'?4:t==='int16'?2:1);const d=new DataView(payload.buffer);if(t==='double')d.setFloat64(0,value,true);else if(t==='int64')d.setBigInt64(0,BigInt(value),true);else if(t==='int32')d.setInt32(0,value,true);else if(t==='int16')d.setInt16(0,value,true);else payload[0]=value;}
        size+=codeSize+payload.length;if(size>128*1024*1024)throw new Error('Binary DXF output exceeds safety limit');bytes.push([c,codeSize,payload]);
    }
    const out=new Uint8Array(size),view=new DataView(out.buffer);out.set(encoder.encode(SIGNATURE));let i=22;
    for(const [c,n,p] of bytes){if(n===1)out[i++]=c;else {if(n===3)out[i++]=255;view.setUint16(i,c,true);i+=2;}out.set(p,i);i+=p.length;}return out;
}
function splitSections(pairs) {
    const sections=Object.create(null);let name=null,ended=false;
    for(let i=0;i<pairs.length;i++) {const [c,v]=pairs[i];
        if(c===0&&v==='SECTION'){if(name!==null||pairs[i+1]?.[0]!==2)throw new Error('Malformed DXF SECTION nesting');name=String(pairs[++i][1]).trim();if(Object.hasOwn(sections,name))throw new Error('Duplicate DXF section '+name);sections[name]=[];}
        else if(c===0&&v==='ENDSEC'){if(name===null)throw new Error('Unmatched DXF ENDSEC');name=null;}
        else if(c===0&&v==='EOF'){if(name!==null)throw new Error('Unclosed DXF section '+name);ended=true;break;}
        else if(name!==null)sections[name].push(pairs[i]);else if(c!==999)throw new Error('DXF tag outside section');
    }
    if(!ended)throw new Error('DXF EOF marker missing');return sections;
}
function splitRecords(pairs) {
    const result=[];let r=[];for(const p of pairs){if(p[0]===0&&r.length){result.push(r);r=[];}r.push(p);}if(r.length)result.push(r);return result;
}

/** Semantic string decoding; raw transport tags remain unchanged for preservation. */
function decodeTextEscapes(value) {
    return typeof value === 'string' ? value.replace(/\\U\+([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))) : value;
}

return {groupType,checkedValue,readAsciiTags,decodeCodePage,readBinaryTags,writeAsciiTags,writeBinaryTags,splitSections,splitRecords,decodeTextEscapes};
})();
// packages/dxf/src/interop.js
__modules["packages/dxf/src/interop.js"]=(()=>{
const {splitRecords, decodeTextEscapes} = __modules["packages/dxf/src/codec.js"];
const get = (r,c,d=undefined) => decodeTextEscapes(r.find(p=>p[0]===c)?.[1] ?? d);
const all = (r,c) => r.filter(p=>p[0]===c).map(p=>p[1]);
const point = (r,c=10) => ({x:+get(r,c,0),y:+get(r,c+10,0),z:+get(r,c+20,0)});
const has = (r,c) => r.some(p=>p[0]===c);
const key = v => String(v ?? '').toUpperCase();
function subclassTags(raw,name) {
    const i=raw.findIndex(p=>p[0]===100 && p[1]===name);
    if(i<0) return [];
    let end=i+1;
    while(end<raw.length && raw[end][0]!==100 && raw[end][0]<1000) end++;
    return raw.slice(i+1,end);
}
/** Reactor/extension and XDATA fields do not share the entity field namespace. */
function graphicalTags(raw) {
    const result=[]; let depth=0;
    for(const [c,v] of raw) {
        if(c>=1000) break;
        if(c===102) {
            if(String(v).startsWith('{')) depth++;
            else if(v==='}') { if(!depth) throw new Error('Unmatched extension-data closing brace'); depth--; }
            else if(!depth) result.push([c,v]);
        } else if(!depth) result.push([c,v]);
    }
    if(depth) throw new Error('Unclosed extension-data group');
    return result;
}
const DIMSTYLE_FIELDS = {dimscale:40,dimasz:41,dimexo:42,dimdli:43,dimexe:44,dimrnd:45,dimdle:46,dimtp:47,dimtm:48,dimtxt:140,dimcen:141,dimtsz:142,dimaltf:143,dimlfac:144,dimtvp:145,dimtfac:146,dimgap:147,dimpost:3,dimapost:4,dimtad:77,dimzin:78,dimdec:271,dimtdec:272,dimaltu:273,dimlunit:277,dimdsep:278,dimclrd:176,dimclre:177,dimclrt:178};
const DIM_POINTS = {definitionPoint:10,textMidpoint:11,dimensionInsert:12,a:13,b:14,defpoint4:15,defpoint5:16};
const DIM_SCALARS = {dimensionAngle:50,obliqueAngle:52,textRotation:53,horizontalDirection:51,leaderLength:40,measurement:42,attachment:71,dimensionVersion:280};
const points = (r,c=10) => {
    const result=[]; let p;
    for(const [code,v] of r) {
        if(code===c) { p={x:+v,y:0,z:0}; result.push(p); }
        else if(p && code===c+10) p.y=+v;
        else if(p && code===c+20) p.z=+v;
    }
    return result;
};
const count = n => {
    if(!Number.isSafeInteger(n) || n<0 || n>1000000) throw new Error('Invalid DXF collection count');
    return n;
};
function readSpline(r) {
    return {degree:+get(r,71,3),splineFlags:+get(r,70,0),knots:all(r,40).map(Number),weights:all(r,41).map(Number),controlPoints:points(r),fitPoints:points(r,11)};
}
function readInteropEntity(e,r) {
    if(e.type==='DIMENSION') {
        e.dimtype=+get(r,70,0); e.dimstyle=get(r,3,'STANDARD');
        for(const [k,c] of Object.entries(DIM_POINTS)) if(has(r,c)) e[k]=point(r,c);
        for(const [k,c] of Object.entries(DIM_SCALARS)) if(has(r,c)) e[k]=+get(r,c);
    } else if(e.type==='VIEWPORT') {
        const sub=subclassTags(r,'AcDbViewport'), v=sub.length?sub:r;
        Object.assign(e,{c:point(v),viewportWidth:+get(v,40,1),viewportHeight:+get(v,41,1),viewHeight:+get(v,45,1),viewportId:+get(v,69,2),viewportStatus:+get(v,68,1),viewCenter:point(v,12),viewTarget:point(v,17),viewDirection:has(v,16)?point(v,16):{x:0,y:0,z:1},viewTwist:+get(v,51,0),viewportFlags:+get(v,90,0),frozenLayerHandles:all(v,331).map(String),clipHandle:get(v,340)});
        if(e.viewportWidth<0 || e.viewportHeight<0 || e.viewHeight<=0) throw new Error('Invalid VIEWPORT dimensions');
    } else if(e.type==='MESH') {
        const v=subclassTags(r,'AcDbSubDMesh'); let i=0;
        const read=c=>{if(v[i]?.[0]!==c) throw new Error(`Malformed MESH: expected group ${c}`);return v[i++][1];};
        e.meshVersion=+read(71); e.blendCrease=+read(72); e.subdivision=+read(91);
        const n=count(+read(92)); e.points=[];
        for(let k=0;k<n;k++) e.points.push({x:+read(10),y:+read(20),z:+read(30)});
        const size=count(+read(93)); let used=0; e.faces=[];
        const index=()=>{const x=+read(90);if(!Number.isSafeInteger(x)||x<0||x>=n) throw new Error('Invalid MESH vertex index');return x;};
        while(used<size) {
            const length=count(+read(90)); used++;
            if(length<3 || used+length>size) throw new Error('Invalid MESH face size');
            const face=[];for(let k=0;k<length;k++) face.push(index());
            used+=length; e.faces.push(face);
        }
        const ne=count(+read(94)); e.edges=[];
        for(let k=0;k<ne;k++) e.edges.push([index(),index()]);
        const nc=count(+read(95)); e.creases=[];
        for(let k=0;k<nc;k++) e.creases.push(+read(140));
        if(nc!==ne) throw new Error('MESH crease/edge count mismatch');
        e.meshOverrides=v.slice(i);
    } else if(e.type==='HELIX') {
        e.helixSpline=readSpline(subclassTags(r,'AcDbSpline'));
        const v=subclassTags(r,'AcDbHelix');
        Object.assign(e,{helixMajor:+get(v,90,29),helixMinor:+get(v,91,63),axisBase:point(v),startPoint:point(v,11),axis:point(v,12),radius:+get(v,40,1),turns:+get(v,41,1),turnHeight:+get(v,42,1),handedness:!!get(v,290,1),helixConstraint:+get(v,280,1)});
    } else if(e.type==='WIPEOUT') {
        const v=subclassTags(r,'AcDbWipeout');
        Object.assign(e,{p:point(v),uPixel:point(v,11),vPixel:point(v,12),imageSize:point(v,13),boundary:points(v,14),boundaryType:+get(v,71,2),imageFlags:+get(v,70,7),clipping:!!get(v,280,1)});
        if(e.boundary.length!==count(+get(v,91,e.boundary.length))) throw new Error('WIPEOUT boundary count mismatch');
        if(e.boundaryType===1 && e.boundary.length!==2) throw new Error('WIPEOUT rectangle requires two corners');
        if(e.boundaryType===2 && e.boundary.length<3) throw new Error('WIPEOUT polygon requires at least three points');
    }
}
function writeInteropEntity(e,pair,pp) {
    if(e.type==='DIMENSION') {
        const type=(e.dimtype??33)&15;
        if(type>6) throw new Error(`Unsupported DIMENSION subtype ${type}`);
        pair(100,'AcDbDimension');pair(2,e.block);pp(10,e.definitionPoint || e.a);pp(11,e.textMidpoint || e.definitionPoint || e.a);
        pair(70,(e.dimtype??33)|32);pair(1,e.text??'<>');pair(3,e.dimstyle||'STANDARD');
        for(const [k,c] of Object.entries(DIM_SCALARS)) if(e[k]!==undefined && ![50,52,40].includes(c)) pair(c,e[k]);
        if(e.dimensionInsert)pp(12,e.dimensionInsert);
        const names=['AcDbAlignedDimension','AcDbAlignedDimension','AcDb2LineAngularDimension','AcDbDiametricDimension','AcDbRadialDimension','AcDb3PointAngularDimension','AcDbOrdinateDimension'];
        pair(100,names[type]);
        if([0,1,2,5,6].includes(type)) {if(e.a)pp(13,e.a);if(e.b)pp(14,e.b);}
        if([2,3,4,5].includes(type)&&e.defpoint4)pp(15,e.defpoint4);
        if(type===2&&e.defpoint5)pp(16,e.defpoint5);
        if([0,1].includes(type)&&e.obliqueAngle!==undefined)pair(52,e.obliqueAngle);
        if(type===0){pair(50,e.dimensionAngle||0);pair(100,'AcDbRotatedDimension');}
        if([3,4].includes(type))pair(40,e.leaderLength||0);
    } else if(e.type==='VIEWPORT') {
        pair(100,'AcDbViewport');pp(10,e.c);pair(40,e.viewportWidth);pair(41,e.viewportHeight);pair(68,e.viewportStatus??1);pair(69,e.viewportId??2);
        pair(12,e.viewCenter?.x||0);pair(22,e.viewCenter?.y||0);pp(16,e.viewDirection||{x:0,y:0,z:1});pp(17,e.viewTarget);
        pair(45,e.viewHeight);pair(51,e.viewTwist||0);pair(90,e.viewportFlags||0);
        for(const h of e.frozenLayerHandles||[])pair(331,h);
        if(e.clipHandle)pair(340,e.clipHandle);
        pair(281,0);
    } else if(e.type==='MESH') {
        pair(100,'AcDbSubDMesh');pair(71,e.meshVersion??2);pair(72,e.blendCrease??0);pair(91,e.subdivision??0);pair(92,count(e.points.length));
        for(const p of e.points)pp(10,p);
        pair(93,(e.faces||[]).reduce((n,f)=>n+1+f.length,0));
        const index=x=>{if(!Number.isSafeInteger(x)||x<0||x>=e.points.length)throw new Error('Invalid MESH vertex index');pair(90,x);};
        for(const f of e.faces||[]){if(f.length<3)throw new Error('Invalid MESH face');pair(90,count(f.length));for(const x of f)index(x);}
        pair(94,count(e.edges?.length||0));for(const edge of e.edges||[]){if(edge.length!==2)throw new Error('Invalid MESH edge');for(const x of edge)index(x);}
        const creases=e.creases||new Array(e.edges?.length||0).fill(0);
        if(creases.length!==(e.edges?.length||0))throw new Error('MESH crease/edge count mismatch');
        pair(95,count(creases.length));for(const c of creases)pair(140,c);
        for(const [c,v] of e.meshOverrides||[[90,0]])pair(c,v);
    } else if(e.type==='HELIX') {
        const s=e.helixSpline||{};pair(100,'AcDbSpline');pair(70,s.splineFlags||0);pair(71,s.degree||3);
        pair(72,s.knots?.length||0);pair(73,s.controlPoints?.length||0);pair(74,s.fitPoints?.length||0);
        for(const v of s.knots||[])pair(40,v);for(const v of s.weights||[])pair(41,v);
        for(const p of s.controlPoints||[])pp(10,p);for(const p of s.fitPoints||[])pp(11,p);
        pair(100,'AcDbHelix');pair(90,e.helixMajor??29);pair(91,e.helixMinor??63);pp(10,e.axisBase);pp(11,e.startPoint);pp(12,e.axis||{x:0,y:0,z:1});
        pair(40,e.radius);pair(41,e.turns);pair(42,e.turnHeight);pair(290,e.handedness===false?0:1);pair(280,e.helixConstraint??1);
    } else if(e.type==='WIPEOUT') {
        pair(100,'AcDbWipeout');pair(90,0);pp(10,e.p);pp(11,e.uPixel);pp(12,e.vPixel);pair(13,e.imageSize?.x||1);pair(23,e.imageSize?.y||1);
        pair(70,e.imageFlags??7);pair(280,e.clipping===false?0:1);pair(281,50);pair(282,50);pair(283,0);pair(71,e.boundaryType??2);pair(91,e.boundary.length);
        for(const p of e.boundary){pair(14,p.x);pair(24,p.y);}
    } else return false;
    return true;
}
function readDocumentInterop(doc,sections) {
    const tableRecords=splitRecords(sections.TABLES||[]), objects=splitRecords(sections.OBJECTS||[]);
    doc.dimstyles=Object.create(null);doc.layoutSettings=Object.create(null);
    const blockNames=new Map(), layerNames=new Map(), layoutByOwner=new Map();
    for(const r of tableRecords) {
        const type=get(r,0), handle=key(get(r,type==='DIMSTYLE'?105:5));
        if(type==='BLOCK_RECORD')blockNames.set(handle,get(r,2));
        if(type==='LAYER')layerNames.set(handle,get(r,2));
        if(type==='DIMSTYLE') {
            const s={};for(const [k,c] of Object.entries(DIMSTYLE_FIELDS))if(has(r,c))s[k]=get(r,c);
            doc.dimstyles[get(r,2,'STANDARD')]=s;
        }
    }
    for(const raw of objects) {
        if(get(raw,0)!=='LAYOUT')continue;
        const l=subclassTags(raw,'AcDbLayout'),p=subclassTags(raw,'AcDbPlotSettings'),name=get(l,1,'Layout1');
        doc.layoutSettings[name]={tabOrder:+get(l,71,0),paperWidth:+get(p,44,420),paperHeight:+get(p,45,297),paperUnits:+get(p,72,1),rotation:+get(p,73,0)};
        layoutByOwner.set(key(get(l,330)),name);
    }
    // Inactive paper layouts are stored inside special BLOCKs, not ENTITIES.
    for(const [owner,name] of layoutByOwner) {
        const blockName=blockNames.get(owner), b=doc.blocks[blockName];
        if(b && /^\*(Model|Paper)_Space/i.test(blockName)) {
            for(const e of b.entities||[]){e.layout=name;doc.entities.push(e);}
            delete doc.blocks[blockName];
        }
    }
    for(const [name,b] of Object.entries(doc.blocks))if(/^\*(Model|Paper)_Space(?:\d+)?$/i.test(name)) {
        const layout=/Model/i.test(name)?'Model':'Layout1';
        for(const e of b.entities||[]){e.layout=layout;doc.entities.push(e);}delete doc.blocks[name];
    }
    for(const e of doc.entities) {
        const owner=get(graphicalTags(e._dxf?.raw||[]),330);
        if(layoutByOwner.has(key(owner)))e.layout=layoutByOwner.get(key(owner));
        if(e.type==='VIEWPORT') {
            e.frozenLayers=(e.frozenLayerHandles||[]).map(h=>layerNames.get(key(h))).filter(Boolean);
            const d=e.viewDirection;
            if((e.viewportFlags&7)||Math.abs(d?.x||0)>1e-9||Math.abs(d?.y||0)>1e-9||(d?.z??1)<=0)doc.importDiagnostics.push({severity:'warning',type:'VIEWPORT',message:'Perspective, tilted and depth-clipped viewport contents are not rendered; native fields remain available.'});
        }
    }
    doc.layouts=[...new Set(['Model',...Object.keys(doc.layoutSettings),...doc.entities.map(e=>e.layout||'Model')])].sort((a,b)=>a==='Model'?-1:b==='Model'?1:(doc.layoutSettings[a]?.tabOrder||0)-(doc.layoutSettings[b]?.tabOrder||0));
    let variable='';for(const [c,v]of sections.HEADER||[]){if(c===9)variable=v;else if(variable==='$INSUNITS'&&c===70)doc.insunits=v;}
    // Application metadata is an XRECORD, so binary DXF need not depend on 999 comments.
    const root=objects.find(r=>get(r,0)==='DICTIONARY' && key(get(graphicalTags(r),330,'0'))==='0');
    const entry=root?.findIndex(p=>p[0]===3&&p[1]==='CONDUITCAD_METADATA');
    if(entry>=0) {
        const h=root[entry+1]?.[1],rec=objects.find(r=>key(get(r,5))===key(h)&&get(r,0)==='XRECORD');
        if(rec)try{const value=JSON.parse(all(subclassTags(rec,'AcDbXrecord'),1).join(''));for(const k of ['parameters','constraints','metadata'])if(value[k]!==undefined)doc[k]=value[k];}catch{doc.importDiagnostics.push({severity:'warning',message:'Invalid Conduit XRECORD metadata.'});}
    }
}

/** ACAD/DSTYLE data uses dimvar IDs followed by correctly typed XDATA values. */
function readDimensionOverrides(raw) {
    const names=new Map(Object.entries(DIMSTYLE_FIELDS).map(([k,c])=>[c,k]));
    const result={};let app='',active=false;
    for(let i=0;i<raw.length;i++) {
        const [c,v]=raw[i];
        if(c===1001){app=v;active=false;}
        if(app!=='ACAD')continue;
        if(c===1000&&v==='DSTYLE'&&raw[i+1]?.[0]===1002&&raw[i+1][1]==='{'){active=true;i++;continue;}
        if(active&&c===1002&&v==='}'){active=false;continue;}
        if(active&&c===1070&&raw[i+1]) {
            const [type,value]=raw[++i],name=names.get(v);
            if(name&&type===(v===3||v===4?1000:v>=40&&v<=48||v>=140&&v<=148?1040:1070))result[name]=value;
        }
    }
    return result;
}
function writeDimensionOverrides(style,pair) {
    const entries=Object.entries(style||{}).filter(([k])=>DIMSTYLE_FIELDS[k]!==undefined);
    if(!entries.length)return;
    pair(1001,'ACAD');pair(1000,'DSTYLE');pair(1002,'{');
    for(const [name,value]of entries) {
        const code=DIMSTYLE_FIELDS[name],type=code===3||code===4?1000:code>=40&&code<=48||code>=140&&code<=148?1040:1070;
        if(type!==1000&&(!Number.isFinite(value)||type===1070&&!Number.isInteger(value)))throw new Error('Invalid dimension override '+name);
        pair(1070,code);pair(type,value);
    }
    pair(1002,'}');
}

return {subclassTags,graphicalTags,DIMSTYLE_FIELDS,readInteropEntity,writeInteropEntity,readDocumentInterop,readDimensionOverrides,writeDimensionOverrides};
})();
// packages/dxf/src/structure.js
__modules["packages/dxf/src/structure.js"]=(()=>{
const {splitSections, splitRecords, writeAsciiTags} = __modules["packages/dxf/src/codec.js"];
const {DIMSTYLE_FIELDS} = __modules["packages/dxf/src/interop.js"];
const get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;
const set=(r,c,v)=>{const i=r.findIndex(p=>p[0]===c);if(i<0)r.push([c,v]);else r[i]=[c,v];};
const handle=r=>String(get(r,get(r,0)==='DIMSTYLE'?105:5,'')).toUpperCase();
/** Normalize table ownership and the layout database, never guessing foreign handles. */
function completeDXFStructure(pairs,doc,version,{includeMetadata=true}={}) {
    const sections=splitSections(pairs), tables=splitRecords(sections.TABLES||[]), entities=splitRecords(sections.ENTITIES||[]),blocks=splitRecords(sections.BLOCKS||[]);
    let seed=0x100n;
    for(const r of [...tables,...entities,...blocks])if(/^[\dA-F]+$/.test(handle(r)))seed=seed>BigInt('0x'+handle(r))?seed:BigInt('0x'+handle(r))+1n;
    const next=()=>{const h=seed.toString(16).toUpperCase();seed++;return h;};
    const tableMap=new Map();let current=null;
    for(const r of tables) {
        if(get(r,0)==='TABLE') {current={header:r,records:[]};tableMap.set(get(r,2),current);}
        else if(get(r,0)==='ENDTAB')current=null;
        else if(current)current.records.push(r);
    }
    function ensureTable(name) {
        if(!tableMap.has(name))tableMap.set(name,{header:[[0,'TABLE'],[2,name],[5,next()],[330,'0'],[100,'AcDbSymbolTable'],[70,0]],records:[]});
        return tableMap.get(name);
    }
    const styleTable=ensureTable('STYLE'),styles=new Map(styleTable.records.map(r=>[get(r,2),handle(r)]));
    for(const name of ['VPORT','VIEW','UCS','DIMSTYLE','APPID'])ensureTable(name);
    const dim=ensureTable('DIMSTYLE');
    set(dim.header,100,'AcDbSymbolTable');dim.header.push([100,'AcDbDimStyleTable'],[71,0]);
    for(const [name,style]of Object.entries({STANDARD:{},...doc.dimstyles})) {
        const r=[[0,'DIMSTYLE'],[105,next()],[330,handle(dim.header)],[100,'AcDbSymbolTableRecord'],[100,'AcDbDimStyleTableRecord'],[2,name],[70,0]];
        for(const [k,c]of Object.entries(DIMSTYLE_FIELDS))if(style[k]!==undefined)r.push([c,style[k]]);
        if(styles.get('STANDARD'))r.push([340,styles.get('STANDARD')]);
        dim.records.push(r);
    }
    const app=ensureTable('APPID');
    if(!app.records.some(r=>get(r,2)==='ACAD'))app.records.push([[0,'APPID'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbRegAppTableRecord'],[2,'ACAD'],[70,0]]);
    const layouts=[...new Set(['Model',...(doc.layouts||[]),...doc.entities.map(e=>e.layout||'Model')])];
    if(layouts.length===1)layouts.push('Layout1');
    const br=ensureTable('BLOCK_RECORD'), brMap=new Map(br.records.map(r=>[get(r,2),r]));
    const definitions=new Map();let block;
    for(const r of blocks) {
        if(get(r,0)==='BLOCK'){block={begin:r,entities:[],end:null};definitions.set(get(r,2),block);}
        else if(get(r,0)==='ENDBLK'){if(block)block.end=r;block=null;}
        else if(block)block.entities.push(r);
    }
    const layoutBlocks=new Map();let paper=0;
    for(const name of layouts) {
        const blockName=name==='Model'?'*Model_Space':paper++===0?'*Paper_Space':`*Paper_Space${paper-1}`;
        let record=brMap.get(blockName);
        if(!record){record=[[0,'BLOCK_RECORD'],[5,next()],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,blockName],[70,0],[280,1],[281,0]];br.records.push(record);brMap.set(blockName,record);}
        if(!definitions.has(blockName))definitions.set(blockName,{begin:[[0,'BLOCK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockBegin'],[2,blockName],[70,0],[10,0],[20,0],[30,0],[3,blockName],[1,'']],entities:[],end:[[0,'ENDBLK'],[5,next()],[330,handle(record)],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockEnd']]});
        layoutBlocks.set(name,record);
    }
    // Only top-level records get layout owners; ATTRIB/VERTEX/SEQEND keep entity owners.
    let lastLayout='Model';
    const activePaper=layouts.find(l=>l!=='Model'), modelEntities=[];
    for(const r of entities) {
        const type=get(r,0),child=['VERTEX','ATTRIB','SEQEND'].includes(type);
        const name=child?lastLayout:get(r,410,get(r,67,0)?activePaper:'Model');
        if(!child){lastLayout=name;set(r,330,handle(layoutBlocks.get(name)||layoutBlocks.get('Model')));}
        if(name!=='Model'&&name!==activePaper)definitions.get(get(layoutBlocks.get(name),2)).entities.push(r);
        else modelEntities.push(r);
    }
    const root=next(),layoutDictionary=next(),groupDictionary=next();
    const rootRecord=[[0,'DICTIONARY'],[5,root],[330,'0'],[100,'AcDbDictionary'],[281,1],[3,'ACAD_LAYOUT'],[350,layoutDictionary],[3,'ACAD_GROUP'],[350,groupDictionary]];
    const layoutRecord=[[0,'DICTIONARY'],[5,layoutDictionary],[330,root],[100,'AcDbDictionary'],[281,1]],objects=[rootRecord,layoutRecord,[[0,'DICTIONARY'],[5,groupDictionary],[330,root],[100,'AcDbDictionary'],[281,1]]];
    for(let i=0;i<layouts.length;i++) {
        const name=layouts[i],h=next(),record=layoutBlocks.get(name),s=doc.layoutSettings?.[name]||{},w=s.paperWidth??420,height=s.paperHeight??297;
        layoutRecord.push([3,name],[350,h]);set(record,340,h);
        objects.push([[0,'LAYOUT'],[5,h],[330,layoutDictionary],[100,'AcDbPlotSettings'],[1,''],[2,''],[4,''],[6,''],[40,0],[41,0],[42,0],[43,0],[44,w],[45,height],[46,0],[47,0],[48,0],[49,0],[140,0],[141,0],[142,1],[143,1],[70,0],[72,s.paperUnits??1],[73,s.rotation??0],[74,5],[7,''],[75,16],[76,0],[77,0],[78,300],[147,1],[148,0],[149,0],[100,'AcDbLayout'],[1,name],[70,1],[71,i],[10,0],[20,0],[11,w],[21,height],[12,0],[22,0],[32,0],[14,0],[24,0],[34,0],[15,w],[25,height],[35,0],[146,0],[13,0],[23,0],[33,0],[16,1],[26,0],[36,0],[17,0],[27,1],[37,0],[76,0],[330,handle(record)]]);
    }
    if(includeMetadata) {
        const h=next(),value=JSON.stringify({parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata}).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
        rootRecord.push([3,'CONDUITCAD_METADATA'],[350,h]);
        const r=[[0,'XRECORD'],[5,h],[330,root],[100,'AcDbXrecord'],[280,1]];
        for(let i=0;i<value.length;i+=200)r.push([1,value.slice(i,i+200)]);objects.push(r);
    }
    for(const t of tableMap.values()) {
        set(t.header,70,t.records.length);
        const h=handle(t.header);for(const r of t.records)set(r,330,h);
    }
    const header=sections.HEADER||[];
    const headerSet=(name,c,value)=>{const i=header.findIndex(p=>p[0]===9&&p[1]===name);if(i<0)header.push([9,name],[c,value]);else header[i+1]=[c,value];};
    headerSet('$HANDSEED',5,seed.toString(16).toUpperCase());headerSet('$DWGCODEPAGE',3,'ANSI_1252');headerSet('$CLAYER',8,'0');headerSet('$TILEMODE',70,1);
    const out=[];
    const section=(name,content)=>{out.push([0,'SECTION'],[2,name]);for(const p of content)out.push(p);out.push([0,'ENDSEC']);};
    section('HEADER',header);
    section('TABLES',[...tableMap.values()].flatMap(t=>[...t.header,...t.records.flat(),[0,'ENDTAB']]));
    section('BLOCKS',[...definitions.values()].flatMap(b=>[...b.begin,...b.entities.flat(),...(b.end||[])]));
    section('ENTITIES',modelEntities.flat());section('OBJECTS',objects.flat());out.push([0,'EOF']);
    return writeAsciiTags(out,{version});
}

return {completeDXFStructure};
})();
// packages/dxf/src/preservation.js
__modules["packages/dxf/src/preservation.js"]=(()=>{
const {splitSections, splitRecords, writeAsciiTags} = __modules["packages/dxf/src/codec.js"];
const {graphicalTags} = __modules["packages/dxf/src/interop.js"];
const copy = v => JSON.parse(JSON.stringify(v));
const key = h => String(h??'').toUpperCase();
const get=(r,c,d)=>r.find(p=>p[0]===c)?.[1]??d;
const stable = value => {
    if(Array.isArray(value))return value.map(stable);
    if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));
    return value;
};
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const cleanEntity=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['_dxf','dirty'].includes(k)));
const state=doc=>({units:doc.units,insunits:doc.insunits,parameters:doc.parameters,constraints:doc.constraints,metadata:doc.metadata,layers:doc.layers,blocks:doc.blocks,linetypes:doc.linetypes,linetypeScale:doc.linetypeScale,signedLinetypes:doc.signedLinetypes,textStyles:doc.textStyles,dimstyles:doc.dimstyles,layouts:doc.layouts,layoutSettings:doc.layoutSettings,rawSections:doc.rawSections,source:doc.source});
/** Capture an immutable-by-convention, serializable source database and semantic baseline.
 * The original input remains a separate exact-byte export path. */
function capturePreservation(doc,pairs) {
    if(!pairs)throw new Error('Source tags required for DXF preservation');
    doc._dxfPreservation={pairs:copy(pairs),state:copy(state(doc)),entities:doc.entities.map(e=>({id:e.id,handle:e._dxf?.handle,raw:copy(e._dxf?.raw||[]),value:copy(cleanEntity(e))}))};
}
function inspectDXFGraph(doc) {
    const source=doc._dxfPreservation?.pairs;
    if(!source)return {nodes:[],diagnostics:[]};
    const nodes=[],diagnostics=[],handles=new Set();
    for(const [section,pairs]of Object.entries(splitSections(source)))for(const tags of splitRecords(pairs)) {
        const type=get(tags,0);if(!type)continue;
        const identity=get(tags,type==='DIMSTYLE'?105:5);if(!identity)continue;
        const h=key(identity);
        if(!/^[0-9A-F]{1,16}$/.test(h))diagnostics.push({severity:'error',message:`Invalid handle ${h}`});
        if(handles.has(h))diagnostics.push({severity:'error',message:`Duplicate handle ${h}`});handles.add(h);
        const references=[];
        for(let i=0;i<tags.length;i++) {
            const [code,v]=tags[i];
            if((code>=320&&code<=369)||(code>=390&&code<=399)||code===480||code===481||code===1005)if(key(v)!=='0')references.push({code,target:key(v),index:i});
        }
        nodes.push({handle:h,type,section,references,tags:copy(tags)});
    }
    for(const node of nodes)for(const r of node.references)if(!handles.has(r.target))diagnostics.push({severity:'warning',code:r.code,message:`${node.handle} references missing handle ${r.target}`});
    return {nodes,diagnostics};
}
const EDITS = {
    LINE:{a:10,b:11},CIRCLE:{c:10,r:40},ARC:{c:10,r:40,start:50,end:51},
    POINT:{p:10},TEXT:{p:10,alignPoint:11,text:1,height:40,rotation:50,widthFactor:41,oblique:51},
    MTEXT:{p:10,height:40,mtextWidth:41}
};
/** Safe edits are deliberately a whitelist. Unknown dependency semantics never get guessed. */
function writePreservedDXF(doc,{version=doc.importVersion}={}) {
    const saved=doc._dxfPreservation;
    if(!saved)throw new Error('This document has no preserved DXF source');
    if(version!==doc.importVersion)throw new Error('Record-preserving export requires the original DXF version');
    if(!same(state(doc),saved.state))throw new Error('Record-preserving export cannot merge changed tables, blocks, metadata, layouts or source sections');
    if(doc.entities.length!==saved.entities.length)throw new Error('Record-preserving export rejects added or deleted entities');
    const graph=inspectDXFGraph(doc);
    if(graph.diagnostics.some(d=>d.severity==='error'))throw new Error('Source object graph contains invalid or duplicate handles');
    const incoming=new Set(graph.nodes.flatMap(n=>n.references.map(r=>r.target)));
    const replacements=new Map();
    for(let i=0;i<doc.entities.length;i++) {
        const e=doc.entities[i],before=saved.entities[i],after=cleanEntity(e);
        if(e.id!==before.id||key(e._dxf?.handle)!==key(before.handle)||!same(e._dxf?.raw||[],before.raw))throw new Error('Record-preserving export rejects changed entity order, identity or raw records');
        if(same(after,before.value))continue;
        if(!before.handle || incoming.has(key(before.handle)))throw new Error('Entity has incoming references; dependency-sensitive edits require a native evaluator');
        if(before.raw.some(([c])=>c===102||c>=1000))throw new Error('Extended entity semantics make this edit unsafe to merge');
        const fields=EDITS[e.type];if(!fields)throw new Error(`Record-preserving edits are not implemented for ${e.type}`);
        const changed=[...new Set([...Object.keys(after),...Object.keys(before.value)])].filter(k=>!same(after[k],before.value[k]));
        if(changed.some(k=>!(k in fields)))throw new Error(`Unmapped record-preserving edit: ${changed.filter(k=>!(k in fields)).join(', ')}`);
        const raw=copy(before.raw), scope=graphicalTags(raw);
        const set=(code,v)=>{const positions=[];for(let j=0;j<raw.length;j++)if(raw[j][0]===code)positions.push(j);if(positions.length>1)throw new Error(`Ambiguous source field ${code}`);if(positions.length)raw[positions[0]]=[code,v];else {const last=raw.findIndex(p=>p[0]>=1000);raw.splice(last<0?raw.length:last,0,[code,v]);}};
        for(const name of changed) {
            const c=fields[name],value=after[name];
            if(value===undefined)throw new Error('Removing a native field is not a safe preserving edit');
            if(typeof value==='object') {
                if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(value.z??0))throw new Error('Invalid preserved point');
                set(c,value.x);set(c+10,value.y);if(scope.some(p=>p[0]===c+20)||(value.z??0)!==0)set(c+20,value.z??0);
            } else {if(['r','height','widthFactor'].includes(name)&&!(value>0))throw new Error('Invalid preserved size');set(c,['start','end'].includes(name)?value*180/Math.PI:value);}
        }
        replacements.set(key(before.handle),raw);
    }
    const records=splitRecords(saved.pairs);
    const result=records.flatMap(r=>replacements.get(key(get(r,5)))||r);
    return writeAsciiTags(result,{version});
}

return {capturePreservation,inspectDXFGraph,writePreservedDXF};
})();
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
// packages/dxf/src/index.js
__modules["packages/dxf/src/index.js"]=(()=>{
const {dimensionPicture, evaluateDynamicBlock} = __modules["packages/model/src/index.js"];
const {readAsciiTags, readBinaryTags, writeBinaryTags, splitSections, decodeCodePage, decodeTextEscapes} = __modules["packages/dxf/src/codec.js"];
const {readInteropEntity, writeInteropEntity, readDocumentInterop, graphicalTags, readDimensionOverrides, writeDimensionOverrides} = __modules["packages/dxf/src/interop.js"];
const {completeDXFStructure} = __modules["packages/dxf/src/structure.js"];
const {capturePreservation, writePreservedDXF, inspectDXFGraph} = __modules["packages/dxf/src/preservation.js"];
const {readEntityFidelity, writeHatchData} = __modules["packages/dxf/src/fidelity.js"];
const {createDocument, entity, uid, cleanText, clone, entityGeometry} = __modules["packages/model/src/index.js"];
const {TAU, arcPoints} = __modules["packages/geometry/src/index.js"];
// Default ACI modelspace palette, verified against ezdxf 1.4.4.
// ACI 7 follows this application's light canvas. Palette data attribution: THIRD_PARTY_NOTICES.md.
const ACI_PALETTE = [0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504, 12632256, 16711680, 16744319, 10813440, 10834514, 8323072, 8339263, 4980736, 4990502, 2490368, 2495251, 16727808, 16752511, 10823936, 10839890, 8331008, 8343359, 4985600, 4992806, 2492672, 2496275, 16744192, 16760703, 10834432, 10845266, 8339200, 8347455, 4990464, 4995366, 2495232, 2497555, 16760576, 16768895, 10845184, 10850642, 8347392, 8351551, 4995328, 4997670, 2497536, 2498835, 16776960, 16777087, 10855680, 10855762, 8355584, 8355647, 5000192, 5000230, 2500096, 2500115, 12582656, 14679935, 8168704, 9545042, 6258432, 7307071, 3755008, 4344870, 1844736, 2172435, 8388352, 12582783, 5416192, 8168786, 4161280, 6258495, 2509824, 3755046, 1254912, 1844755, 4194048, 10485631, 2729216, 6792530, 2064128, 5209919, 1264640, 3099686, 599552, 1517075, 65280, 8388479, 42240, 5416274, 32512, 4161343, 19456, 2509862, 9728, 1254931, 65343, 8388511, 42281, 5416295, 32543, 4161359, 19475, 2509871, 9737, 1267735, 65407, 8388543, 42322, 5416316, 32575, 4161375, 19494, 2509881, 9747, 1267740, 65471, 8388575, 42364, 5416337, 32607, 4161391, 19513, 2509890, 9756, 1267800, 65535, 8388607, 42405, 5416357, 32639, 4161407, 19532, 2509900, 9766, 1267800, 49151, 8380415, 31909, 5411237, 24447, 4157311, 14668, 2507390, 7206, 1267800, 32767, 8372223, 21157, 5405861, 16255, 4153215, 9804, 2505086, 4902, 1252440, 16383, 8364031, 10661, 5400485, 8063, 4149119, 4940, 2502526, 2342, 1251160, 255, 8355839, 165, 5395109, 127, 4145023, 76, 2500222, 38, 1250136, 4129023, 10452991, 2687141, 6771365, 2031743, 5193599, 1245260, 3090046, 589862, 1512280, 8323327, 12550143, 5374117, 8147621, 4128895, 6242175, 2490444, 3745406, 1245222, 1839960, 12517631, 14647295, 8126629, 9523877, 6226047, 7290751, 3735628, 4335180, 1835046, 5772120, 16711935, 16744447, 10813605, 10834597, 8323199, 8339327, 4980812, 4990540, 2490406, 5772120, 16711871, 16744415, 10813564, 10834577, 8323167, 8339311, 4980793, 4990530, 2490396, 5772120, 16711807, 16744383, 10813522, 10834556, 8323135, 8339295, 4980774, 4990521, 2490387, 5772060, 16711743, 16744351, 10813481, 10834535, 8323103, 8339279, 4980755, 4990511, 2490377, 5772055, 0, 6645093, 6710886, 10066329, 13421772, 16777215];
function aciColor(index) {
    index = Math.abs(Math.trunc(index));
    if (index === 7)
        return '#000000';
    return '#' + (ACI_PALETTE[index] ?? 0).toString(16).padStart(6, '0');
}
function parseAsciiPairs(source, options = {}) { return readAsciiTags(source, options); }
function parseBinaryPairs(input, options = {}) { return readBinaryTags(input, options); }
function inspectObjectGraph(doc) { return inspectDXFGraph(doc); }
function writeDXFBinary(doc, options = {}) {
    const version=options.version || (options.mode==='preserve' ? doc.importVersion : 'AC1024');
    return writeBinaryTags(readAsciiTags(writeDXF(doc,{...options,version})),{version});
}
const get = (r, c, d = undefined) => decodeTextEscapes(r.find(x => x[0] === c)?.[1] ?? d);
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
function parseEntity(original, diagnostics, options = {}) {
    const raw = graphicalTags(original);
    const type = String(get(raw, 0, 'UNKNOWN')).trim(), e = { id: get(raw, 5) ? 'dxf-' + get(raw, 5) : uid(), type, layer: String(get(raw, 8, '0')).trim(), layout: get(raw, 410, get(raw, 67, 0) ? 'Layout1' : 'Model'), _dxf: { raw: original, handle: get(raw, 5) }, dirty: false };
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
    if (get(raw, 60, 0) || aci < 0)
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
            e.text = type === 'MTEXT' ? decodeTextEscapes(all(raw, 3).join('') + (raw.find(p=>p[0]===1)?.[1] ?? '')) : get(raw, 1, '');
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
                e.attributeFlags = Number(get(raw, 70, 0));e.constant=!!(e.attributeFlags&2);
                if(type==='ATTDEF')e.prompt=get(raw,3,'');
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
        case 'SEQEND':
        case 'VIEWPORT':
        case 'WIPEOUT':
        case 'MESH':
        case 'HELIX': break;
        default:
            e.unsupported = true;
            diagnostics.push({ severity: 'warning', type, message: `${type}: retained in original source; no editable display implementation.` });
    }
    readInteropEntity(e, raw);
    if(type==='DIMENSION')e.dimstyleOverrides=readDimensionOverrides(original);
    const meta = metadata(original);
    if (typeof meta.id === 'string' && meta.id.length <= 160)
        e.id = meta.id;
    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource', 'calculation'])
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
                enc = ver && Number(ver.slice(2)) >= 1021 ? 'utf-8' : decodeCodePage('ANSI_' + (cp || '1252'));
            }
            rawText = new TextDecoder(enc, {fatal:true}).decode(bytes);
            source = {format:'ascii',base64:base64(bytes),encoding:enc};
        }
        else
            rawText = String(input);
        pairs = parseAsciiPairs(rawText, options);
        source = bytes ? source : { format: 'ascii', text: rawText };
    }
    const doc = createDocument(options.name || 'Imported DXF');
    doc.blocks = Object.create(null); doc.layers = []; doc.textStyles = Object.create(null); doc.linetypes = Object.assign(Object.create(null), { CONTINUOUS: [] }); doc.signedLinetypes = true;
    doc.source = source;
    doc.rawSections = Object.create(null);
    doc.importDiagnostics = [];
    const sections = splitSections(pairs);
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
            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], flags: +get(raw,70,0), ports: metadata(raw).ports || [], symbol: metadata(raw).symbol, dynamic: metadata(raw).dynamic, parameters: metadata(raw).parameters, constraints: metadata(raw).constraints, revision: metadata(raw).revision, dynamicInstance: metadata(raw).dynamicInstance, dimensionPicture: metadata(raw).dimensionPicture };
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
        if (!doc.layers.some(l => l.name.toUpperCase() === e.layer.toUpperCase()))
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
    readDocumentInterop(doc,sections);
    const unsupported = doc.entities.filter(e => e.unsupported).length;
    doc.importDiagnostics.unshift({ severity: 'info', message: `${doc.entities.length} model/layout entities, ${Object.keys(doc.blocks).length} blocks, ${doc.layers.length} layers; ${unsupported} unsupported entities.` });
    for (const [name, p] of Object.entries(sections))
        if (!['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'].includes(name))
            doc.rawSections[name] = p;
    doc.importDiagnostics.push({ severity: 'info', message: 'Original input remains available unchanged. Edited DXF export normalizes supported planar entities; normalized export rebuilds represented objects. Record-preserving export retains foreign graphs but rejects unsafe edits.' });
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {
        if(e.type==='INSERT' && e.dynamicSource && doc.blocks[e.dynamicSource]?.dynamic)e.block=e.dynamicSource;
    }
    capturePreservation(doc,pairs);
    return doc;
}
/** Remove only unreachable app-generated evaluation pictures in normalized copies. */
function pruneGeneratedPictures(document) {
    const blocks={...document.blocks},candidates=new Set(Object.entries(blocks).filter(([name,b])=>b.dynamicInstance||b.dimensionPicture).map(([name])=>name));
    const keep=new Set(),queue=[];
    const visit=e=>{if(e.type==='INSERT'||e.type==='DIMENSION'&&e.dimension?.version!==1){if(e.block&&!keep.has(e.block)){keep.add(e.block);queue.push(e.block);}}};
    document.entities.forEach(visit);
    for(const [name,b]of Object.entries(blocks))if(!candidates.has(name))(b.entities||[]).forEach(visit);
    for(let i=0;i<queue.length;i++)(blocks[queue[i]]?.entities||[]).forEach(visit);
    for(const name of candidates)if(!keep.has(name))delete blocks[name];
    return {...document,blocks};
}
function prepareDynamicBlocks(document) {
    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()},cache=new Map();let serial=0;
    const bake=(e,stack=[])=>{
        if(e.type!=='INSERT')return e;
        const master=doc.blocks[e.block];if(!master)return e;
        if(stack.includes(e.block))throw new Error('Cyclic dynamic block nesting');
        if(stack.length>24)throw new Error('Dynamic block nesting limit exceeded');
        if(!master.dynamic)return e;
        const key=JSON.stringify([e.block,e.dynamicParameters||{}]);let name=cache.get(key);
        if(!name){
            const evaluated=evaluateDynamicBlock(master,e.dynamicParameters||{});
            do{name='*UCC'+(++serial);}while(doc.blocks[name]);
            cache.set(key,name);
            doc.blocks[name]={...evaluated,name,entities:evaluated.entities.filter(c=>!c.hidden).map(c=>bake(c,[...stack,e.block])),dynamicInstance:{master:e.block,values:evaluated.dynamicValues}};
        }
        return {...e,block:name,dynamicSource:e.block};
    };
    doc.entities=doc.entities.map(e=>bake(e));
    // Static parents may contain dynamic references. Retain each original master for metadata-aware editors.
    for(const [name,b]of Object.entries(document.blocks))if(!b.dynamic)doc.blocks[name]={...b,entities:(b.entities||[]).map(e=>bake(e))};
    return doc;
}
function prepareNativeDimensions(document) {
    const doc={...document,blocks:{...document.blocks},entities:document.entities.slice()};let serial=0;
    const prepare=e=>{
        if(e.type!=='DIMENSION'||(e.block&&doc.blocks[e.block]&&e.dimension?.version!==1))return e;
        const picture=dimensionPicture(e,doc);
        let name;do{name='*DCC'+(++serial);}while(doc.blocks[name]);
        doc.blocks[name]={name,base:{x:0,y:0},entities:picture.entities,dimensionPicture:{version:1,ownerId:e.id}};
        return {...e,block:name,dimtype:(e.dimtype??33)|32,definitionPoint:picture.definitionPoint,textMidpoint:picture.textMidpoint,measurement:picture.measurement,dimstyleOverrides:picture.style};
    };
    doc.entities=doc.entities.map(prepare);for(const [name,b]of Object.entries(document.blocks))doc.blocks[name]={...b,entities:(b.entities||[]).map(prepare)};
    return doc;
}
function asciiJson(data) { return JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')); }
/** Normalized AC1024 / R2010 ASCII DXF. The project format preserves full app semantics. */
function writeDXF(doc, options = {}) {
    const { version = options.mode==='preserve' ? doc.importVersion || 'AC1024' : 'AC1024', includeMetadata = true, mode = 'normalized', strict = false } = options;
    if(mode === 'preserve')return writePreservedDXF(doc,{version});
    if(mode !== 'normalized')throw new Error('Unknown DXF export mode');
    if(strict && exportReport(doc).warnings.length)throw new Error(exportReport(doc).warnings.join(' '));
    doc = prepareNativeDimensions(prepareDynamicBlocks(pruneGeneratedPictures(doc)));
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) {
        if(e.type==='MESH' && version<'AC1024')throw new Error('MESH requires DXF R2010 or newer');
        if(e.type==='HELIX' && version<'AC1021')throw new Error('HELIX requires DXF R2007 or newer');
        if(e.gradient && version<'AC1018')throw new Error('Gradient HATCH requires DXF R2004 or newer');
    }
    if (!['AC1015', 'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032'].includes(version))
        throw new Error('Supported export versions: R2000–R2018');
    const out = [];
    // Normalized output allocates new handles; never convert a 64-bit source
    // handle to Number (incrementing a rounded value can otherwise loop forever).
    let handle = 0x100;
    const next = () => (handle++).toString(16).toUpperCase();
    const nativeHandles=new WeakMap(), sourceHandles=new Map(), layerHandles=new Map();
    for(const e of [...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])]) { const h=next(); nativeHandles.set(e,h);if(e._dxf?.handle)sourceHandles.set(String(e._dxf.handle).toUpperCase(),h); }
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
        // Leave room for group/app overhead within the native 16 KiB XDATA limit.
        if(s.length>15000)throw new Error('Conduit metadata exceeds the safe DXF XDATA budget; save the native project or export without metadata.');
        for (let i = 0; i < s.length; i += 200)
            pair(1000, s.slice(i, i + 200));
    };
    const section = name => { pair(0, 'SECTION'); pair(2, name); };
    const end = () => pair(0, 'ENDSEC');
    section('HEADER');
    pair(9, '$ACADVER');
    pair(1, version);
    pair(9, '$INSUNITS');
    const knownUnits = { 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };
    const unitCode = doc.insunits !== undefined && (knownUnits[doc.insunits] || 'unitless') === doc.units ? doc.insunits : ({ unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 })[doc.units] ?? 4;
    pair(70, unitCode);
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
        const layerHandle=next();layerHandles.set(l.name,layerHandle);pair(5, layerHandle);
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
    const textStyles = { ...doc.textStyles };
    if(!Object.keys(textStyles).some(n=>n.toUpperCase()==='STANDARD'))textStyles.STANDARD={font:'txt',widthFactor:1};
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
    const blockRecords = Object.create(null);
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
        const emittedHandle = nativeHandles.get(e) || next(); pair(5, emittedHandle);
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
        const type = e.type === 'POLYLINE' && !(e.flags & (8|16|64)) ? 'LWPOLYLINE' : e.type;
        const entityHandle = header(e, type, owner);
        const native=e.type==='VIEWPORT'?{...e,clipHandle:e.clipHandle?sourceHandles.get(String(e.clipHandle).toUpperCase()):undefined,frozenLayerHandles:(e.frozenLayers||[]).map(n=>layerHandles.get(n)).filter(Boolean)}:e;
        if(e.type==='VIEWPORT'&&e.clipHandle&&!native.clipHandle)throw new Error('Cannot export unresolved viewport clipping boundary');
        if (!writeInteropEntity(native, pair, pp)) switch (type) {
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
                pair(70, ((e.splineFlags || 0) & ~5) | (e.closed ? 1 : 0) | (e.weights?.length ? 4 : 0));
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
                    pair(2, e.attributeTag || e.tag || 'TAG');
                    if (type === 'ATTDEF')
                        pair(3, e.prompt ?? 'Equipment tag');
                    pair(70, ((e.attributeFlags ?? e.flags ?? 0)&~3) | (e.invisible?1:0) | (e.constant||((e.attributeFlags ?? e.flags ?? 0)&2)?2:0)); pair(74, e.valign || 0);
                }
                break;
            case 'MTEXT': {
                pair(100, 'AcDbMText'); pp(10, e.p); pair(40, e.height || 12); pair(41, e.mtextWidth || 0);
                pair(71, e.attachment || (e.align === 'center' ? 2 : e.align === 'right' ? 3 : 1)); pair(7, e.styleName || 'STANDARD');
                const value = String(e.text || '').replace(/\r?\n/g, '\\P');
                const chunks=[];let chunk='',size=0;const encoder=new TextEncoder();
                for(const char of value){const bytes=Number(version.slice(2))<1021?char.split('').reduce((n,c)=>n+(c.charCodeAt(0)>127?7:1),0):encoder.encode(char).length;if(size+bytes>250){chunks.push(chunk);chunk='';size=0;}chunk+=char;size+=bytes;}
                chunks.push(chunk);chunks.forEach((v,i)=>pair(i===chunks.length-1?1:3,v));
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
        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource', 'calculation'])
            if (e[k] !== undefined)
                m[k] = e[k];
        if(e.type==='DIMENSION')writeDimensionOverrides(e.dimstyleOverrides,pair);
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
                emit(a, entityHandle);
            if (e.tag) {
                const block = doc.blocks[e.block], offset = block?.symbol?.labelOffset || 55;
                emit({ type: 'ATTRIB', p: { x: e.x, y: e.y - Math.abs((e.sy ?? 1) * offset) }, text: e.tag, height: e.tagHeight || 12, align: 'center', attributeTag: 'TAG', layer: e.layer }, entityHandle);
            }
            pair(0, 'SEQEND');
            pair(5, next());
            pair(330, entityHandle);
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
        pair(70, name.startsWith('*') ? 1 : 0);
        pp(10, b.base);
        pair(3, name);
        pair(1, '');
        meta({ ports: b.ports || [], symbol: b.symbol, dynamic: b.dynamic, parameters: b.parameters, constraints: b.constraints, revision: b.revision, dynamicInstance: b.dynamicInstance, dimensionPicture: b.dimensionPicture });
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
    return completeDXFStructure(readAsciiTags(out.join('\r\n')+'\r\n'), doc, version, {includeMetadata});
}
function exportReport(doc) {
    const entities=[...doc.entities,...Object.values(doc.blocks).flatMap(b=>b.entities||[])],unsupported=entities.filter(e=>e.unsupported);
    return {format:'ASCII or binary DXF R2000–R2018',unsupported:unsupported.map(e=>({id:e.id,type:e.type})),warnings:[
        ...(unsupported.length?[`${unsupported.length} unsupported entities omitted from normalized export (including block contents). Use record-preserving or original DXF export.`]:[]),
        ...(entities.some(e=>e.type==='HATCH'&&e.associative)?['Hatch associations are detached in normalized export.']:[]),
        ...(entities.some(e=>e._dxf?.raw?.some(p=>p[0]===1001&&p[1]!=='CONDUITCAD'))?['Foreign application XDATA is retained only by record-preserving export.']:[]),
        ...(Object.keys(doc.rawSections||{}).length?['Foreign OBJECTS/CLASSES sections are rebuilt, not merged, in normalized export. Record-preserving mode retains original graphs and refuses unsafe changes.']:[])
    ],originalAvailable:!!doc.source,preservationAvailable:!!doc._dxfPreservation};
}

return {aciColor,parseAsciiPairs,parseBinaryPairs,inspectObjectGraph,writeDXFBinary,parseDXF,writeDXF,exportReport};
})();
// packages/renderer/src/index.js
__modules["packages/renderer/src/index.js"]=(()=>{
const {bounds, union, emptyBounds, intersects, distance, validBounds, center, clamp} = __modules["packages/geometry/src/index.js"];
const {entityGeometry, entityBounds, isVisible, documentBounds, textLayout} = __modules["packages/model/src/index.js"];
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
function segmentCount(path) { if (path.stroke === false || path.points.length < 2) return 0; return path.points.length - 1 + (path.closed && distance(path.points[0], path.points.at(-1)) > 1e-7 ? 1 : 0); }
function writeStrokeData(data, paths, origin, offset = 0) {
    let k = offset * 16;
    for (const p of paths) {
        const rgba = colorRGBA(p.color, p.opacity), pts = p.points;
        let phase = p.dashPhase || 0;
        const n = segmentCount(p);
        for (let i = 0; i < n; i++) {
            const a = pts[i], z = pts[(i + 1) % pts.length];
            data.set([a.x - origin.x, a.y - origin.y, z.x - origin.x, z.y - origin.y, ...rgba, p.width || 1.5, p.dash?.[0] || 0, p.dash?.[1] || 0, phase, p.dash?.[2] || 0, p.dash?.[3] || 0, p.dash?.[4] || 0, p.dash?.[5] || 0], k);
            k += 16;
            phase += distance(a, z);
        }
    }
}
function buildScene(doc, { tolerance = .25, origin = null, view = null } = {}) {
    const paths = [], texts = [], items = [], diagnostics = [], spans = new Map(), entities = new Map();
    let b = emptyBounds(), count = 0, hasInfinite = false;
    const started = performance.now();
    for (const e of doc.entities) {
        if (!isVisible(e, doc))
            continue;
        const g = entityGeometry(e, doc, { tolerance, view }), span = { pathStart: paths.length, pathCount: g.paths.length, textStart: texts.length, textCount: g.texts.length, offset: count, count: 0, itemIndex: -1 };
        diagnostics.push(...(g.warnings || []));
        hasInfinite ||= !!g.hasInfinite;
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
            items.push({ ...(g.paths.some(p=>p.infinite)?union(bb,bounds(g.paths.flatMap(p=>p.points))):bb), id: e.id, entity: e });
            b = union(b, bb);
        }
        spans.set(e.id, span);
        entities.set(e.id, e);
    }
    origin = origin || (validBounds(b) ? center(b) : { x: 0, y: 0 });
    const data = new Float32Array(count * 16);
    writeStrokeData(data, paths, origin);
    return { paths, texts, items, diagnostics, hasInfinite, spans, entities, index: new SpatialIndex(items), bounds: b, origin, data, count, buildMs: performance.now() - started };
}
/** Patch equal-topology edits in place. A null result requests a full rebuild. */
function updateSceneEntities(scene, doc, ids, { tolerance = .25 } = {}) {
    if(scene.hasInfinite)return null;
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
 let b=(s.ab.zw-view.camera)*vec2f(view.scale,-view.scale)+view.viewport*.5;let delta=b-a;let len=max(length(delta),0.0001);let dir=select(vec2f(1,0),delta/len,len>0.0001);let normal=vec2f(-dir.y,dir.x);
 let halfWidth=max(s.style.x*.5,.5);let pad=halfWidth+1.0;
 let corners=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(1,1),vec2f(0,-1),vec2f(1,1),vec2f(0,1));let corner=corners[vertex];let local=vec2f(mix(-pad,len+pad,corner.x),corner.y*pad);let pixel=a+dir*local.x+normal*local.y;
 var o:Out;o.position=vec4f(pixel/view.viewport*vec2f(2,-2)+vec2f(-1,1),0,1);o.local=local;o.metrics=vec2f(len,halfWidth);o.color=s.color;o.style=s.style;o.dash=s.dash;return o;
}
@fragment fn fs(o:Out)->@location(0) vec4f {
 let outside=length(vec2f(max(max(-o.local.x,o.local.x-o.metrics.x),0.0),o.local.y))-o.metrics.y;
 let alpha=1.0-smoothstep(-.55,.55,outside);
 if(o.style.y+o.style.z+o.dash.x+o.dash.y+o.dash.z+o.dash.w>0.0){let pattern=array<f32,6>(o.style.y,o.style.z,o.dash.x,o.dash.y,o.dash.z,o.dash.w);let cycle=o.style.y+o.style.z+o.dash.x+o.dash.y+o.dash.z+o.dash.w;var d=(max(o.local.x,0.0)/view.scale+o.style.w)%cycle;for(var i=0u;i<6u;i++){if(d<pattern[i]){if(i%2u==1u){discard;}break;}d-=pattern[i];}}
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
        if (camera.clipInset > 0) { const x = Math.min(this.canvas.width - 1, Math.ceil(camera.clipInset * ratio)), y = Math.min(this.canvas.height - 1, Math.ceil(camera.clipInset * ratio)); pass.setScissorRect(x, y, this.canvas.width - x, this.canvas.height - y); }
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
void main(){vec2 a=(ab.xy-camera)*vec2(scale,-scale)+viewport*.5,b=(ab.zw-camera)*vec2(scale,-scale)+viewport*.5;vec2 delta=b-a;float len=max(length(delta),.0001);vec2 dir=len>.0001?delta/len:vec2(1,0),n=vec2(-dir.y,dir.x);float halfWidth=max(style.x*.5,.5),pad=halfWidth+1.;vec2 corners[6]=vec2[6](vec2(0,-1),vec2(1,-1),vec2(1,1),vec2(0,-1),vec2(1,1),vec2(0,1));vec2 corner=corners[gl_VertexID];local=vec2(mix(-pad,len+pad,corner.x),corner.y*pad);vec2 pixel=a+dir*local.x+n*local.y;gl_Position=vec4(pixel/viewport*vec2(2,-2)+vec2(-1,1),0,1);metrics=vec2(len,halfWidth);col=color;sty=style;dsh=dash;}`;
const GLSL_FRAGMENT = `#version 300 es
precision highp float;in vec2 local;flat in vec2 metrics;flat in vec4 col;flat in vec4 sty;flat in vec4 dsh;uniform float scale;out vec4 frag;
void main(){float outside=length(vec2(max(max(-local.x,local.x-metrics.x),0.),local.y))-metrics.y;float alpha=1.-smoothstep(-.55,.55,outside);if(sty.y+sty.z+dsh.x+dsh.y+dsh.z+dsh.w>0.){float pattern[6]=float[6](sty.y,sty.z,dsh.x,dsh.y,dsh.z,dsh.w);float cycle=sty.y+sty.z+dsh.x+dsh.y+dsh.z+dsh.w;float pos=mod(max(local.x,0.)/scale+sty.w,cycle);for(int i=0;i<6;i++){if(pos<pattern[i]){if(i%2==1)discard;break;}pos-=pattern[i];}}frag=vec4(col.rgb,col.a*alpha);}`;
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
function drawPathUnclipped(ctx, path, camera, override = {}) {
    const points = path.points;
    if (path.stroke === false && !override.color) return;
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
    ctx.setLineDash((override.dash || path.dash || []).map(v => Math.max(0, v * camera.scale)));
    ctx.lineDashOffset = -(path.dashPhase || 0) * camera.scale;
    ctx.globalAlpha = path.opacity ?? 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
}
function drawFillUnclipped(ctx, path, camera) {
    if (!path.fill) return;
    ctx.save(); ctx.beginPath();
    for (const contour of path.contours || [path.points]) {
        contour.forEach((p, i) => { const q = camera.screen(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
    }
    let fill=path.fill;
    if(path.gradient?.kind==='linear') {
        const g=path.gradient,[a,b,c,d,x,y]=g.frame,z=camera.scale,p=camera.screen({x,y});
        ctx.transform(a*z,-b*z,c*z,-d*z,p.x,p.y);
        fill=ctx.createLinearGradient(g.start.x,g.start.y,g.end.x,g.end.y);
        fill.addColorStop(0,g.colors[0]);fill.addColorStop(1,g.colors[1]);
    }
    ctx.fillStyle = fill; ctx.globalAlpha = path.opacity ?? 1; ctx.fill(path.fillRule || 'evenodd'); ctx.restore();
}
function cadFont(name) {
    const clean = String(name || '').replace(/["'\\;{}]/g, '').replace(/\.(ttf|otf)$/i, '');
    return !clean || /\.shx$|^(txt|standard)$/i.test(clean) ? 'ui-sans-serif, system-ui, sans-serif' : `"${clean}", ui-sans-serif, system-ui, sans-serif`;
}
function drawTextUnclipped(ctx, t, camera) {
    const s = camera.screen(t.p), h = t.nominalHeight || t.height;
    if (!(h > 0) || !Number.isFinite(h)) return;
    ctx.save(); ctx.translate(s.x, s.y);
    if (t.frame) { const [a, b, c, d] = t.frame, z = camera.scale; ctx.transform(a * z, -b * z, -c * z, d * z, 0, 0); }
    else { ctx.rotate(-(t.rotation || 0) * Math.PI / 180); ctx.scale((t.widthFactor || 1) * camera.scale, camera.scale); }
    const setFont = (height, style) => ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${height}px ${cadFont(style.font || t.font)}`;
    const layout = textLayout(t, (text, height, style) => { setFont(height, style); return ctx.measureText(text).width; });
    ctx.globalAlpha = t.opacity ?? 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (t.backgroundFill) {
        const pad = Math.max(0, (t.backgroundScale || 1.5) - 1) * h;
        ctx.fillStyle = (t.backgroundFill & 2) ? '#fbfcfb' : t.backgroundColor || '#ffffff';
        ctx.fillRect(layout.minX - pad, layout.minY - pad, layout.width + 2 * pad, layout.height + 2 * pad);
    }
    for (const line of layout.lines) for (const run of line.runs) {
        ctx.save(); ctx.translate(run.x, run.y); ctx.scale(run.width ? run.width / Math.max(1e-12, (setFont(run.height, run), ctx.measureText(run.text).width)) : 1, 1);
        if (run.oblique) ctx.transform(1, 0, -Math.tan(run.oblique * Math.PI / 180), 1, 0, 0);
        ctx.fillStyle = run.color || t.color || '#344755'; ctx.fillText(run.text, 0, 0);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(.25, run.height / 18);
        for (const [enabled, y] of [[run.underline, run.height * .12], [run.overline, -run.height * .85], [run.strike, -run.height * .35]]) if (enabled) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.measureText(run.text).width, y); ctx.stroke();
        }
        ctx.restore();
    }
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
        this.rulers = true; this.camera.clipInset = 22;
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
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
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
    containsPoint(p) { const inset = this.rulers ? 22 : 0; return p.x >= inset && p.y >= inset && p.x < this.camera.width && p.y < this.camera.height; }
    render() {
        if (!this.doc || !this.engine || this.disposed)
            return;
        this.camera.clipInset = this.rulers ? 22 : 0;
        const clip = `inset(${this.camera.clipInset}px 0px 0px ${this.camera.clipInset}px)`;
        this.canvas.style.clipPath = clip; this.overlay.style.clipPath = clip;
        const viewKey = [this.camera.x, this.camera.y, this.camera.scale, this.camera.width, this.camera.height].join(':');
        if (this.scene?.hasInfinite && this.viewKey !== viewKey) this.sceneDirty = true;
        this.viewKey = viewKey;
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
            this.scene = buildScene(this.doc, { tolerance: clamp(.22 / (this.camera.scale * this.dpr), .00001, 3), view: this.camera.viewport });
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
        // Hardware strokes have six dash slots. Preserve long patterns and zero-length ink dots through the ordered fidelity compositor.
        const ordered = this.scene.paths.some(p => p.fill || p.clips?.length || p.dash?.length > 6 || p.dash?.some((v, i) => i % 2 === 0 && v === 0)) || this.scene.texts.some(t => t.backgroundFill || t.clips?.length);
        this.orderedComposite = ordered;
        this.canvas.style.visibility = ordered ? 'hidden' : 'visible';
        this.stats.compositor = ordered ? 'Canvas 2D fidelity composite' : this.engine.name;
        this.drawBackground();
        try {
            if (!ordered) this.engine.draw(this.camera, this.dpr);
        }
        catch (e) {
            this.recover(e.message, this.engine.name);
            return;
        }
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.camera.width, this.camera.height);
        ctx.save(); ctx.beginPath(); ctx.rect(this.camera.clipInset, this.camera.clipInset, this.camera.width, this.camera.height); ctx.clip();
        const view = this.camera.viewport;
        if (ordered) {
            const visible = new Set(this.scene.index.search(view).map(item=>item.id));
            for (const [id, span] of this.scene.spans) {
                if (!visible.has(id) && !['RAY','XLINE'].includes(this.scene.entities.get(id)?.type)) continue;
                for (let i=span.pathStart; i<span.pathStart+span.pathCount; i++) { const p=this.scene.paths[i]; drawFill(ctx,p,this.camera); drawPath(ctx,p,this.camera); }
                for (let i=span.textStart; i<span.textStart+span.textCount; i++) drawText(ctx,this.scene.texts[i],this.camera);
            }
        } else for (const t of this.scene.texts) {
            const layout = textLayout(t), pad = Math.max(layout.width, layout.height) * Math.max(1, ...(t.frame || [1]).map(Math.abs));
            if (t.p.x + pad >= view.minX && t.p.x - pad <= view.maxX && t.p.y + pad >= view.minY && t.p.y - pad <= view.maxY) drawText(ctx, t, this.camera);
        }
        this.drawOverlay?.(ctx, this.camera);
        ctx.restore();
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
        c.save(); c.beginPath(); c.rect(cam.clipInset || 0, cam.clipInset || 0, cam.width, cam.height); c.clip();
        for (const p of this.scene.paths) if (!this.orderedComposite && p.fill && intersects(bounds(p.contours ? p.contours.flat() : p.points), cam.viewport)) drawFill(c, p, cam);
        c.restore();
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

function drawPath(ctx, path, camera, override = {}) {
    withEntityClip(ctx,path,camera,()=>drawPathUnclipped(ctx,path,camera,override));
}

function drawFill(ctx, path, camera) {
    withEntityClip(ctx,path,camera,()=>drawFillUnclipped(ctx,path,camera));
}

function drawText(ctx, t, camera) {
    withEntityClip(ctx,t,camera,()=>drawTextUnclipped(ctx,t,camera));
}

function withEntityClip(ctx,geometry,camera,draw) {
    if(!geometry.clips?.length){draw();return;}
    ctx.save();
    try {
        for(const polygon of geometry.clips){ctx.beginPath();polygon.forEach((p,i)=>{const q=camera.screen(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.clip();}
        draw();
    } finally {ctx.restore();}
}

return {Camera,colorRGBA,buildScene,updateSceneEntities,CULL_SHADER,LINE_SHADER,CadRenderer,drawPath,drawFill,drawText};
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
const {documentBounds, textLayout} = __modules["packages/model/src/index.js"];
const {buildScene, Camera, drawPath, drawText, drawFill} = __modules["packages/renderer/src/index.js"];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function writeSVG(doc, { padding = 24, background = '#ffffff' } = {}) {
    const scene = buildScene(doc, { tolerance: .08 }), b = documentBounds(doc), x = b.minX - padding, y = b.minY - padding, w = b.maxX - b.minX + padding * 2, h = b.maxY - b.minY + padding * 2, parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${-y - h} ${w} ${h}"><title>${esc(doc.name)}</title><rect x="${x}" y="${-y - h}" width="${w}" height="${h}" fill="${esc(background)}"/>`];
    let serial=0;
    const beginClip=geometry=>{
        for(const polygon of geometry.clips||[]){const id='cc-clip-'+(++serial),d=polygon.map((p,i)=>`${i?'L':'M'}${p.x} ${-p.y}`).join(' ')+' Z';parts.push(`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">`);}
    };
    const endClip=geometry=>{for(const _ of geometry.clips||[])parts.push('</g>');};
    for (const span of scene.spans.values()) {
        for (const p of scene.paths.slice(span.pathStart, span.pathStart + span.pathCount)) {
            beginClip(p);
            let fill=p.fill?esc(p.fill):'none';
            if(p.gradient?.kind==='linear') {
                const g=p.gradient,[a,b,c,d,x,y]=g.frame,id='cc-gradient-'+(++serial);
                parts.push(`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${g.start.x}" y1="${g.start.y}" x2="${g.end.x}" y2="${g.end.y}" gradientTransform="matrix(${a} ${-b} ${c} ${-d} ${x} ${-y})"><stop offset="0" stop-color="${g.colors[0]}"/><stop offset="1" stop-color="${g.colors[1]}"/></linearGradient></defs>`);
                fill=`url(#${id})`;
            }
            const d = (p.contours || [p.points]).map(points => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(6)} ${(-p.y).toFixed(6)}`).join(' ') + (p.closed || p.contours ? ' Z' : '')).join(' ');
            parts.push(`<path d="${d}" fill="${fill}" fill-rule="evenodd" opacity="${p.opacity ?? 1}" stroke="${p.stroke === false ? 'none' : esc(p.color)}" stroke-width="${p.width || 1.5}" stroke-linecap="round" stroke-linejoin="round" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`);
            endClip(p);
        }
        for (const t of scene.texts.slice(span.textStart, span.textStart + span.textCount)) {
            beginClip(t);
            const angle = (t.rotation || 0) * Math.PI / 180;
            const [a,b,c,d] = t.frame || [Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle)];
            const layout = textLayout(t);
            parts.push(`<g transform="matrix(${a} ${-b} ${-c} ${d} ${t.p.x} ${-t.p.y})" opacity="${t.opacity ?? 1}">`);
            if (t.backgroundFill) {
                const pad = Math.max(0,(t.backgroundScale || 1.5)-1)*(t.nominalHeight || t.height);
                parts.push(`<rect x="${layout.minX-pad}" y="${layout.minY-pad}" width="${layout.width+2*pad}" height="${layout.height+2*pad}" fill="${esc(t.backgroundColor || '#ffffff')}"/>`);
            }
            for (const line of layout.lines) for (const run of line.runs) {
                const font = /\.shx$|^txt$/i.test(run.font || t.font || '') ? 'sans-serif' : run.font || t.font || 'sans-serif';
                parts.push(`<text x="${run.x}" y="${run.y}" font-family="${esc(font)}" font-size="${run.height}" fill="${esc(run.color || t.color)}" font-weight="${run.bold ? 'bold' : 'normal'}" font-style="${run.italic ? 'italic' : 'normal'}" textLength="${run.width}" lengthAdjust="spacingAndGlyphs" xml:space="preserve" text-decoration="${[run.underline ? 'underline' : '',run.overline ? 'overline' : '',run.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}">${esc(run.text)}</text>`);
            }
            parts.push('</g>');
            endClip(t);
        }
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
    for (const span of scene.spans.values()) {
        for (const p of scene.paths.slice(span.pathStart, span.pathStart + span.pathCount)) { drawFill(ctx,p,camera); drawPath(ctx,p,camera); }
        for (const t of scene.texts.slice(span.textStart,span.textStart+span.textCount)) drawText(ctx,t,camera);
    }
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
// packages/workbench/src/index.js
__modules["packages/workbench/src/index.js"]=(()=>{
const {DRAWING_TOOLS, drawingTool} = __modules["packages/drawing/src/index.js"];
const {beginDrawing, acceptDrawingPoint, drawingPointerUp, drawingPreview, updateDrawingControls, finishDrawing, drawingToolSections, bindDrawingSearch, drawingAction, drawingCommand, nativeGrips, changeNativeGrip, renderDrawingInspector, nativePropertyChange} = __modules["packages/workbench/src/drawing-workbench.js"];
const {parametricAction, renderParametricInspector, refreshCalculations, drawParametricOverlay, startBlockEditor, finishBlockEditor, parameterManager, constraintAuthor} = __modules["packages/workbench/src/parametric-workbench.js"];
const {renderCadEditing, changeCadEditing, cadEditingAction} = __modules["packages/workbench/src/cad-editing.js"];
const {editDimension, dimensionGrips, regenerateDimensions, setDynamicParameters, dynamicParameterGrips, dynamicGripValue} = __modules["packages/model/src/index.js"];
const {bounds, inflate, contains, distance, distanceToSegment, lerp, union, emptyBounds, center, validBounds, snapCandidates, lineIntersection, offsetPolyline, filletLines, matrix, compose, TAU, clamp} = __modules["packages/geometry/src/index.js"];
const {createDocument, validateDocument, entity, line, polyline, rect, circle, text, clone, uid, entityBounds, entityGeometry, documentBounds, layerFor, isVisible, isLocked, ports, moveEntity, transformEntity, explodeEntity, detachReferences} = __modules["packages/model/src/index.js"];
const {History} = __modules["packages/history/src/index.js"];
const {ConstraintSolver, evaluateExpression, resolveParameters} = __modules["packages/constraints/src/index.js"];
const {routeOrthogonal, routePorts, routeVia, graphFromDocument} = __modules["packages/routing/src/index.js"];
const {SYMBOLS, LINE_STYLES, CATEGORIES, STANDARD_REFERENCES, DRAWING_TYPES, searchSymbols, symbolUpdates, updateSymbolDefinitions, installSymbols, insertSymbol, createDemo} = __modules["packages/symbols/src/index.js"];
const {parseDXF, writeDXF, writeDXFBinary, inspectObjectGraph, exportReport} = __modules["packages/dxf/src/index.js"];
const {CadRenderer, Camera, drawPath, drawText} = __modules["packages/renderer/src/index.js"];
const {PointerController} = __modules["packages/input/src/index.js"];
const {ProjectStore, downloadFile} = __modules["packages/storage/src/index.js"];
const {writeSVG, renderPNG, writeBOM} = __modules["packages/exchange/src/index.js"];
const {icon, escapeHTML} = __modules["packages/workbench/src/icons.js"];
const E = escapeHTML;
const TOOL_INFO = { ...Object.fromEntries(DRAWING_TOOLS.map(t => [t.id, [t.label, t.steps[0]]])), select: ['Select', 'Tap an object to select · drag to move'], pan: ['Pan', 'Drag the drawing · pinch to zoom'], line: ['Line', 'Tap two endpoints, or drag to draw a line'], polyline: ['Polyline', 'Tap vertices · Finish to complete the path'], rect: ['Rectangle', 'Tap opposite corners, or drag a rectangle'], circle: ['Circle', 'Tap the center, then set the radius'], connect: ['Connect', 'Tap a port, then a destination · routes avoid equipment'], text: ['Text', 'Tap the drawing to place editable text'], dimension: ['Dimension', 'Pick two points for an aligned dimension'], insert: ['Place symbol', 'Tap to place · Escape cancels'] };
const btn = (action, label, ic, cls = '', title = label) => `<button type="button" data-action="${action}" class="${cls}" title="${E(title)}" aria-label="${E(label)}">${ic ? icon(ic) : ''}<span>${E(label)}</span></button>`;
const iconButton = (action, ic, label, cls = '') => `<button type="button" data-action="${action}" class="icon-btn ${cls}" title="${E(label)}" aria-label="${E(label)}">${icon(ic)}</button>`;
const filledContains = (p, contours) => { let inside=false; for (const poly of contours) for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;} return inside; };
const format = n => Number.isFinite(n) ? Number(n.toFixed(3)).toString() : '0';
function symbolSVG(block, doc, extra = '') {
    if (!block)
        return icon('symbols');
    const preview = { id: 'preview', type: 'INSERT', block: block.name || block.block, x: 0, y: 0, sx: 1, sy: 1, layer: 'Equipment' };
    const g = entityGeometry(preview, doc, { tolerance: .03 }), pts = g.paths.flatMap(p => p.points), b = union(bounds(pts), entityBounds(preview, doc));
    if (!validBounds(b))
        return icon('symbols');
    const pad = 8, view = `${b.minX - pad} ${-b.maxY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
    return `<svg viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${g.paths.map(p => `<path d="${p.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${-p.y}`).join(' ')}${p.closed ? 'Z' : ''}" fill="${p.fill ? 'currentColor' : 'none'}" fill-rule="evenodd" stroke="${p.stroke === false ? 'none' : 'currentColor'}" stroke-width="1.7" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${g.texts.map(t => `<text x="${t.p.x}" y="${-t.p.y}" fill="currentColor" font-size="${t.height}" font-family="system-ui" text-anchor="${t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start'}">${E(t.text)}</text>`).join('')}</svg>`;
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
        this.history = new History({ capture: () => this.doc, restore: d => { this.doc = d; this.selection = new Set([...this.selection].filter(id => d.entities.some(e => e.id === id))); refreshCalculations(this); this.lastSolve=null; this.renderer.setDocument(d); this.updateUI(); }, onChange: () => { this.updateHistory(); this.store.schedule(this.doc); this.root.dispatchEvent(new CustomEvent('conduit:change', { detail: { document: this.doc } })); } });
        this.input = new PointerController(this.$('.viewport'), { down: p => this.pointerDown(p), move: p => {try{this.pointerMove(p);}catch(error){this.cancelGesture();this.toast(error.message,true);}}, up: p => this.pointerUp(p), hover: p => this.pointerHover(p), cancel: () => this.cancelGesture(), gesture: ({ previous, current, scale, dx, dy }) => { this.camera.zoom(scale, { x: previous.x, y: previous.y }); this.camera.pan(dx, dy); this.renderer.invalidate(); }, wheel: p => {
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
                    this.doc = validateDocument(saved.document);
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
 <main class="workspace"><aside class="library" aria-label="Symbol library"><div class="panel-heading"><h2>Symbol library <small class="library-count"></small></h2>${iconButton('toggle-library', 'close', 'Close library', 'mobile-only')}</div><p class="panel-subtitle">Drag a symbol. Make a connection.</p><div class="searchbox">${icon('search')}<input id="symbol-search" type="search" placeholder="Find a symbol…" aria-label="Search symbols" autocomplete="off"></div><div class="category-tabs"><select id="symbol-category" aria-label="Symbol category"><option value="All">All categories</option>${CATEGORIES.map(c => `<option value="${E(c.id)}" ${c.id === this.category ? 'selected' : ''}>${E(c.name)} · ${SYMBOLS.filter(s => s.category === c.id).length}</option>`).join('')}<option value="Custom">Custom / imported blocks</option></select></div><div class="library-summary" role="status" aria-live="polite"></div><div class="library-scroll"></div><div class="library-footer">${btn('library-guide', 'Conventions & library updates', 'help')}</div></aside>
 <section class="canvas-area" aria-label="Drawing canvas"><div class="viewport" tabindex="0" role="application" aria-label="CAD drawing. Use toolbar tools, touch gestures, or keyboard shortcuts."></div><div class="canvas-head"><div class="undo-group">${iconButton('undo', 'undo', 'Undo · Ctrl/⌘ Z')}${iconButton('redo', 'redo', 'Redo · Ctrl/⌘ Shift Z')}</div><div class="render-badge"><span class="dot"></span><span class="backend-name">Initializing</span><span class="stats-text quiet"> · retained renderer</span></div></div><div class="view-label">MODEL SPACE / TOP</div><div class="axis"><svg viewBox="0 0 38 38"><path d="M8 29V5m0 24h24M5 8l3-3 3 3m18 18 3 3-3 3" fill="none" stroke="#9aafa0" stroke-width="1.2"/><text x="2" y="4" font-size="6" fill="#94aa99">Y</text><text x="33" y="33" font-size="6" fill="#94aa99">X</text></svg><span class="unit-label">mm</span></div><div class="zoom-controls">${iconButton('zoom-out', 'minus', 'Zoom out')}<span class="zoom-value">100%</span>${iconButton('zoom-in', 'plus', 'Zoom in')}<span class="separator"></span>${iconButton('fit', 'fit', 'Fit drawing · F')}</div><div class="tool-hint"></div><div class="drawing-session-controls hide" role="toolbar" aria-label="Active drawing command">${btn('draw-exact-point', 'Point…', 'ruler')}${btn('draw-back', 'Back', 'undo')}${btn('draw-close', 'Close', 'polyline')}${btn('draw-options', 'Options', 'properties')}${btn('draw-cancel', 'Cancel', 'close')}</div><button class="finish-button hide" data-action="finish">${icon('check')} Finish path</button><nav class="tool-dock" aria-label="Drawing tools">
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
            if (this.tool === 'polyline' || this.drawingSession?.canFinish)
                this.finishPath();
            else if (this.tool === 'select' && this.selection.size === 1) {
                const e = this.selected()[0];
                if (['TEXT', 'MTEXT'].includes(e.type))
                    this.editText(e);
                else if(e.type==='INSERT'&&!this.blockSession)startBlockEditor(this,e.block);
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
                this.store.save(this.blockSession?.parentDocument || this.doc).catch(() => { });
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
            if (this.suppressLibraryClick === target.dataset.symbol && performance.now() < this.suppressLibraryClickUntil) {
                this.suppressLibraryClick = null;
                return;
            }
            this.suppressLibraryClick = null;
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
            try { await this.newDocument(target.dataset.demo); } catch (error) { this.toast(error.message, true); }
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
        if(drawingAction(this,action))return;
        if(parametricAction(this,action))return;
        if(cadEditingAction(this,action))return;
        switch (action) {
            case 'library-guide':
                this.libraryGuide();
                break;
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
        const layout = this.doc.activeLayout || 'Model';
        this.$('.view-label').textContent = layout === 'Model' ? 'MODEL SPACE / TOP' : `PAPER SPACE / ${layout}`;
        const badge = this.$('.backend-name');
        if (badge) badge.textContent = this.renderer.orderedComposite ? 'Canvas 2D · fidelity' : stats.backend;
        this.$('.render-badge')?.setAttribute('title', `${stats.compositor || stats.backend}. Stroke engine: ${stats.backend}. ${this.rendererMessage || ''}`);
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
    beginBlockEdit(name) { return startBlockEditor(this,name); }
    saveBlockEdit(close=false) { return finishBlockEditor(this,true,!close); }
    cancelBlockEdit() { return finishBlockEditor(this,false); }
    selected() { return this.doc.entities.filter(e => this.selection.has(e.id)); }
    eval(source) { return evaluateExpression(source, this.doc.parameters); }
    touch(changed = null) {
        refreshCalculations(this);
        if(changed){changed=new Set(changed);for(const c of this.doc.constraints||[])if(!c.suppressed)for(const id of c.entities||[c.entityId])if(id)changed.add(id);for(const e of this.doc.entities)if(e.calculation)changed.add(e.id);}
        const regenerated=regenerateDimensions(this.doc);
        if(changed&&regenerated.length)changed=new Set([...changed,...regenerated]);
        this.doc.version = (this.doc.version || 0) + 1;
        if (changed)
            this.renderer.updateEntities(new Set([...changed, ...(this.lastRoutedIds || [])]));
        else
            this.renderer.setDocument(this.doc);
        this.updateStatus();
    }
    edit(label, action) { this.history.run(label, () => { action(); this.solveConstraints(); this.touch(); }); this.updateUI(); }
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
        beginDrawing(this,tool);
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
        updateDrawingControls(this);
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
        this.$('#symbol-category').value = this.category;
        this.root.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b.dataset.category === this.category));
        const query = this.librarySearch.trim();
        let items = this.category === 'Custom' ? Object.values(this.doc.blocks).filter(b => !SYMBOLS.some(s => s.block === b.name)).map(b => ({ id: b.name, name: b.symbol?.name || b.name, block: b.name, category: 'Custom', symbol: b.symbol })) : searchSymbols(query, { category: query ? undefined : this.category });
        if (query && this.category === 'Custom') items = items.filter(s => (s.name + ' ' + s.id).toLowerCase().includes(query.toLowerCase()));
        this.$('.library-summary').textContent = `${items.length} matching symbols${query && this.category !== 'Custom' ? ' · all categories' : ''}`;
        const groups = {};
        for (const s of items) {
            const group = query || this.category === 'All' ? (CATEGORIES.find(c => c.id === s.category)?.name || s.category) : s.symbol?.group || (this.category === 'Custom' ? 'Your DXF blocks' : 'Components');
            (groups[group] ??= []).push(s);
        }
        this.$('.library-scroll').innerHTML = Object.entries(groups).map(([name, items]) => `<section class="library-group"><div class="section-label">${E(name)}<span>${items.length}</span></div><div class="symbol-grid">${items.map(s => `<button class="symbol-card ${this.pendingSymbol === s.id && this.tool === 'insert' ? 'selected' : ''}" data-symbol="${E(s.id)}" title="Place ${E(s.name)}" aria-label="Place ${E(s.name)}">${this.librarySymbolPreview(s)}<span>${E(s.name)}</span><small class="symbol-convention">${E(s.symbol?.standardRefs?.filter(r => r !== 'NFPC-FLUID').join(' / ') || 'Custom')}</small><span class="symbol-drag-handle" title="Drag symbol onto drawing" aria-hidden="true">⠿</span></button>`).join('')}</div></section>`).join('') || `<div class="list-empty">${icon('symbols')}<br>${this.category === 'Custom' ? 'Select geometry and use Make symbol, or open a DXF with blocks.' : 'No matching symbols.'}</div>`;
    }
    librarySymbolPreview(symbol) {
        const existing = this.doc.blocks[symbol.block];
        if (existing) return symbolSVG(existing, this.doc);
        const block = { name: symbol.block, base: symbol.base, entities: symbol.entities, ports: symbol.ports, symbol: symbol.symbol };
        return symbolSVG(block, { ...this.doc, blocks: { ...this.doc.blocks, [symbol.block]: block } });
    }
    libraryGuide() {
        const updates = symbolUpdates(this.doc).filter(s => this.doc.entities.some(e => e.type === 'INSERT' && e.block === s.block));
        this.openModal('Symbol conventions & library updates', `<p><strong>${SYMBOLS.length} masters · ${CATEGORIES.length} categories · geometry revision 3.</strong> Native CAD geometry, named terminals, documented normal states and explicit reference families.</p><div class="hint-box">Reference families do not certify normative dimensions. ISO process/fluid-power, IEC electrical and ISA instrument notation are kept separate. Building services, automation, fire-alarm and network blocks are project conventions, not ISO safety signs.</div><div class="convention-list">${CATEGORIES.map(c => `<section><strong>${E(c.name)}</strong><p>${E(c.description)}</p><small>${E(c.refs.join(' / '))}</small></section>`).join('')}</div><details><summary>Primary reference catalogue</summary>${Object.entries(STANDARD_REFERENCES).map(([id, r]) => `<p><strong>${E(id)}</strong> — ${E(r.title)}<br><small>${E(r.scope)}</small></p>`).join('')}</details><div class="hint-box">${updates.length ? `${updates.length} used saved definitions have an older geometry revision. Applying updates replaces those definitions, keeps instance IDs/transforms and named terminals, and reroutes connections in one undoable edit. Custom changes to those definitions will be replaced.` : 'No used saved definitions need a revision update.'} Existing drawings are never migrated automatically.</div>`, { wide: true, ...(updates.length ? { confirm: 'Update used definitions', onConfirm: () => {
            this.edit('Update symbol library definitions', () => { updateSymbolDefinitions(this.doc, updates.map(s => s.id)); this.reroute(); });
            this.closeModal(); this.toast('Library updated; Undo restores previous definitions and routes.');
        } } : {}) });
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
        const prefix = SYMBOLS.find(s => s.id === id)?.symbol?.functionCode || (id.includes('valve') ? 'HV' : id.includes('pump') ? 'P' : id === 'heat-exchanger' ? 'E' : id === 'pressure-indicator' ? 'PI' : id === 'flow-transmitter' ? 'FT' : id === 'temperature' ? 'TT' : id.includes('tank') ? 'TK' : id === 'motor' ? 'M' : id === 'resistor' ? 'R' : id === 'capacitor' ? 'C' : 'S');
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
            if (this.isMobile()) document.activeElement?.blur?.();
            try { this.$('.viewport').setPointerCapture(event.pointerId); } catch {}
            card.style.touchAction = 'none';
            this.pendingSymbol = id;
            this.previewSymbol = this.symbolAt(id, this.camera.x, this.camera.y, false);
            if (this.isMobile())
                this.closePanels();
        };
        if (type === 'touch' && event.target.closest('.symbol-drag-handle')) { event.preventDefault(); begin(); }
        else if (type === 'touch') return;
        const move = e => {
            if (e.pointerId !== event.pointerId) return;
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
            if (e.pointerId !== event.pointerId) return;
            clearTimeout(timer);
            abort.abort();
            try { if (this.$('.viewport').hasPointerCapture(e.pointerId)) this.$('.viewport').releasePointerCapture(e.pointerId); } catch {}
            card.style.touchAction = 'pan-y';
            if (dragging) {
                this.suppressLibraryClick = id;
                this.suppressLibraryClickUntil = performance.now() + 300;
                this.previewSymbol = null;
                const r = this.$('.viewport').getBoundingClientRect();
                if (this.renderer.containsPoint({x:e.clientX-r.left,y:e.clientY-r.top})) {
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
    renderInspector() { this.renderBaseInspector(); renderParametricInspector(this,this.$('.inspector-content')); }
    renderBaseInspector() {
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
        if (['TEXT','MTEXT','ATTDEF','ATTRIB'].includes(e.type))
            fields += (e.calculation?this.field('calculationExpression','Calculated expression',e.calculation.expression,true)+this.field('calculationPrecision','Calculation precision',e.calculation.precision??3)+this.field('calculationPrefix','Calculation prefix',e.calculation.prefix||'',true)+this.field('calculationSuffix','Calculation suffix',e.calculation.suffix||'',true):this.field('text', 'Text', e.text, true)) + this.field('height', 'Text height', format(e.height)) + this.field('rotation', 'Rotation', format(e.rotation || 0));
        if(['ATTDEF','ATTRIB'].includes(e.type))fields+=this.field('attributeTag','Attribute tag',e.attributeTag||e.tag||'',true)+this.field('prompt','Attribute prompt',e.prompt||'',true)+this.field('attributeFlags','Attribute flags · 1 hidden / 2 constant / 4 verify / 8 preset',e.attributeFlags||0,true);
        host.innerHTML = `<div class="object-card"><div class="object-preview">${block ? symbolSVG(block, this.doc) : icon(e.connector ? 'connect' : e.type === 'LINE' ? 'line' : e.type === 'CIRCLE' ? 'circle' : 'rect')}</div><div class="object-meta"><strong>${E(e.tag || block?.symbol?.name || e.type)}</strong><small>${E(e.type)}${e.connector ? ' · ROUTED CONNECTION' : e.type === 'INSERT' ? ' · BLOCK REFERENCE' : ' · CAD ENTITY'}</small></div></div><div class="inspector-section"><h3>Identity</h3><div class="fields">${e.type === 'INSERT' ? this.field('tag', 'Equipment tag', e.tag || '', true) : ''}${e.connector ? this.field('label', 'Line label', e.label || '', true) : ''}<label class="field full">Layer<select data-prop="layer">${this.doc.layers.map(l => `<option ${l.name === e.layer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></label></div></div><div class="inspector-section"><h3>Geometry ${isLocked(e, this.doc) ? '· locked' : ''}</h3><div class="fields">${fields}</div></div>${e.connector ? `<div class="inspector-section"><h3>Connection</h3><div class="property-list"><div class="property-row"><span>Routing</span><b>${E(e.connector.status || 'routed')}</b></div><div class="property-row"><span>Start</span><b>${E(e.connector.from?.port || 'Free endpoint')}</b></div><div class="property-row"><span>End</span><b>${E(e.connector.to?.port || 'Free endpoint')}</b></div></div><div style="margin-top:12px">${btn('reroute', 'Reroute', 'connect', 'btn')}</div></div>` : ''}<div class="inspector-section"><h3>Actions</h3><div class="operation-grid">${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate 90°', 'rotate')}${btn('offset', 'Offset', 'offset')}${btn('constraint', 'Constrain', 'param')}${e.type === 'INSERT' ? btn('explode', 'Explode', 'symbols') : btn('make-symbol', 'Make symbol', 'symbols')}${btn('delete', 'Delete', 'trash')}</div></div>${this.constraintsHTML(selected)}<p class="muted-note">Numeric fields accept expressions such as <code>valveSize / 2</code>. Named parameters are managed in Parameters.</p>`;
        if (block?.symbol) {
            const section = document.createElement('section'); section.className = 'inspector-section symbol-provenance';
            section.innerHTML = `<h3>Symbol convention</h3><p>${E(block.symbol.standardRefs?.join(' / ') || block.symbol.convention || 'Custom block')}</p><p class="muted-note">Saved geometry revision ${E(block.symbol.geometryRevision || 'custom')} · ${E(block.symbol.review?.dimensionalConformance || 'not-verified')} dimensions</p>${btn('library-guide', 'Conventions & updates', 'help', 'btn')}`;
            host.append(section);
        }
        renderCadEditing(this,e,host);
        renderDrawingInspector(this,e,host);
        host.scrollTop = scroll;
    }
    constraintsHTML(selected) { const ids = new Set(selected.map(e => e.id)), cs = this.doc.constraints.filter(c => (c.entities || [c.entityId]).some(id => ids.has(id))); return cs.length ? `<div class="inspector-section"><h3>Sketch constraints</h3>${cs.map(c => `<div class="constraint-item">${icon('param')}<span>${E(c.type)}${c.value !== undefined ? ' = ' + E(c.value) : ''}</span><button data-constraint-delete="${E(c.id)}" title="Remove constraint">${icon('close')}</button></div>`).join('')}</div>` : ''; }
    onChange(event) {
        const t = event.target;
        try {
            if(nativePropertyChange(this,t))return;
            if(changeCadEditing(this,t))return;
            if(t.id==='dxf-mode'){this.modal.querySelector('#dxf-version').disabled=t.value==='preserve';this.modal.querySelector('#dxf-strict').disabled=t.value==='preserve';return;}
            if (t.id === 'symbol-category') {
                this.category = t.value; this.librarySearch = ''; this.$('#symbol-search').value = '';
                this.renderLibrary(); this.$('.library-scroll').scrollTop = 0; return;
            }
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
        if(key.startsWith('calculation')){if(!e.calculation)throw new Error('No calculated text');const fields={calculationExpression:'expression',calculationPrecision:'precision',calculationPrefix:'prefix',calculationSuffix:'suffix'};if(!fields[key])throw new Error('Unknown calculated text field');e.calculation[fields[key]]=key==='calculationPrecision'?Number(source):source;e.dirty=true;return;}
        if (['tag', 'text', 'label', 'layer', 'attributeTag', 'prompt'].includes(key)) {
            e[key] = source;if(key==='attributeTag')e.tag=source;
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
        else if(key==='attributeFlags'){if(!Number.isInteger(v)||v<0||v>15)throw new Error('Attribute flags must be an integer 0–15');e.attributeFlags=v;e.constant=!!(v&2);e.invisible=!!(v&1);}
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
    constraintsForSolve() {const referenced=new Set(this.doc.constraints.filter(c=>!c.suppressed&&!c.reference).flatMap(c=>c.entities||[c.entityId]));return [...this.doc.constraints,...this.doc.entities.filter(e=>!e.locked&&referenced.has(e.id)&&isLocked(e,this.doc)).map(e=>({id:'layer-lock-'+e.id,type:'fixed',entityId:e.id,target:clone(e),visible:false}))];}
    solveConstraints() {
        if (!this.doc.constraints.length) { this.lastSolve=null; return; }
        const result = this.solver.solve(this.doc.entities, this.constraintsForSolve(), this.doc.parameters);
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
            const g = entityGeometry(e, this.doc, { tolerance: .5 / this.camera.scale, view:this.camera.viewport });
            let d = Infinity;
            for (const path of g.paths) {
                if(path.clips?.some(polygon=>!filledContains(p,[polygon])))continue;
                for (const contour of path.contours || [path.points]) {
                    for (let i=1;i<contour.length;i++) d=Math.min(d,distanceToSegment(p,contour[i-1],contour[i]));
                    if (path.closed && contour.length>1) d=Math.min(d,distanceToSegment(p,contour.at(-1),contour[0]));
                }
                if (path.fill && filledContains(p,path.contours || [path.points])) d=0;
            }
            if (['INSERT', 'TEXT', 'MTEXT'].includes(e.type) && contains(item, p))
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
        return routePorts({ ...start.p, entityId: start.ref?.entityId }, { ...end.p, entityId: end.ref?.entityId }, obstacles, { clearance: 12, lead: 22, waypoints });
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
            const route = routePorts({ ...a.p, entityId: a.ref?.entityId }, { ...b.p, entityId: b.ref?.entityId }, obstacles, { clearance: 12, lead: 22, waypoints: c.waypoints });
            e.points = route.points;
            c.status = route.status;
            e.dirty = true;
            this.lastRoutedIds.add(e.id);
        }
    }
    grips(e) {
        // OCS points cannot be exposed as WCS grips. Projected body dragging is handled by moveEntity.
        const n = e.extrusion;
        if (n && ['CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'TEXT', 'INSERT', 'HATCH', 'SOLID', 'TRACE'].includes(e.type) && (Math.abs(n.x || 0) > 1e-12 || Math.abs(n.y || 0) > 1e-12 || Math.abs((n.z ?? 1) - 1) > 1e-12)) return [];
        const additional=nativeGrips(e);if(additional!==null)return additional;
        if(e.type==='DIMENSION')return e.dimension?.version===1?dimensionGrips(e,this.doc):e.block?[]:[{...e.a,key:'a'},{...e.b,key:'b'}];
        if (e.type === 'LINE' || e.type === 'DIMENSION')
            return [{ ...e.a, key: 'a' }, { ...e.b, key: 'b' }];
        if (e.type === 'CIRCLE' || e.type === 'ARC')
            return [{ ...e.c, key: 'c' }, { x: e.c.x + e.r, y: e.c.y, key: 'radius' }];
        if (e.type === 'INSERT') {
            const custom=dynamicParameterGrips(e,this.doc);if(custom.length)return custom;
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
        if (this.modal || !this.renderer.containsPoint(p))
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
        if(this.drawingSession){this.cursor=q;this.drag={kind:'native-draw',start:q};this.preview=drawingPreview(this,q,q);this.renderer.invalidate();return;}
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
            this.solveConstraints();
            this.reroute(this.selection);
            this.touch(this.selection);
            return;
        }
        if (drag.kind === 'grip') {
            const i = this.doc.entities.findIndex(e => e.id === drag.id), e = clone(drag.original), g = drag.grip, q = this.snapPoint(raw, this.selection);
            if(changeNativeGrip(e,g,q)) {}
            else if(g.key.startsWith('dyn:')) {const name=g.key.slice(4);setDynamicParameters(e,this.doc,{[name]:dynamicGripValue(e,this.doc,name,q)});}
            else if(g.key.startsWith('dim:')) {editDimension(e,this.doc,{[g.key.slice(4)]:q});}
            else if (g.key === 'radius') {
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
                    e.points[g.index] = { ...e.points[g.index], ...q };
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
                e[g.key] = { ...e[g.key], ...q };
            this.doc.entities[i] = e;
            e.dirty = true;
            this.cursor = q;
            this.solveConstraints();
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
        else if (drag.kind === 'native-draw')
            this.preview = drawingPreview(this,drag.start,this.cursor);
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
            if (drag.kind === 'native-draw') {
                const end=this.snapPoint(raw,new Set(),this.draft.at(-1)||drag.start);
                drawingPointerUp(this,drag,end,moved);return;
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
        if(this.drawingSession)return drawingPreview(this,a,b);
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
        if (added.type === 'DIMENSION') {added.layer='Annotations';editDimension(added,this.doc);}
        this.edit('Draw ' + TOOL_INFO[this.tool][0], () => { this.doc.entities.push(added); this.selection = new Set([added.id]); });
        this.updateSelection();
    }
    finishPath() {
        if(finishDrawing(this))return;
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
        drawParametricOverlay(this,ctx,cam);
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
            const g = entityGeometry(this.preview, this.doc, { tolerance: .25 / cam.scale, view:cam.viewport });
            ctx.globalAlpha = .8;
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#239b80', width: 1.8 });
            for (const t of g.texts)
                drawText(ctx, t, cam);
            ctx.globalAlpha = 1;
        }
        if (this.previewSymbol) {
            const g = entityGeometry(this.previewSymbol, this.doc, { tolerance: .25 / cam.scale, view:cam.viewport });
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
    constraintDialog() { return constraintAuthor(this); }
    parametersDialog() { return parameterManager(this); }
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
    moreDialog(shapesOnly = false) { const drawing = [['tool-line', 'Line', 'line'], ['tool-polyline', 'Polyline', 'polyline'], ['tool-rect', 'Rectangle', 'rect'], ['tool-circle', 'Circle', 'circle'], ['tool-text', 'Text', 'text'], ['tool-dimension', 'Dimension', 'dimension'], ['tool-pan', 'Pan', 'pan'], ['precision', 'Exact values', 'ruler']]; const editing = [['blocks','Block editor','symbols'],['solver-report','Solve status','param'],['parametric-demo','Constrained bracket','param'],['calculated-text','Calculation label','text'],['dynamic-demo','Parametric duct','symbols'],['duplicate', 'Duplicate', 'copy'], ['rotate-angle', 'Rotate', 'rotate'], ['offset', 'Offset', 'offset'], ['trim', 'Trim', 'trim'], ['extend', 'Extend', 'extend'], ['fillet', 'Fillet', 'fillet'], ['constraint', 'Constraints', 'param'], ['make-symbol', 'Make symbol', 'symbols'], ['explode', 'Explode', 'symbols'], ['parameters', 'Parameters', 'param'], ['multi-select', 'Multi-select', 'select'], ['select-all', 'Select all', 'select'], ['delete', 'Delete', 'trash'], ['command', 'Command', 'command'], ['help', 'Help', 'help']]; this.openModal(shapesOnly ? 'Draw a shape' : 'Drawing & editing tools', `<div class="section-label">DRAW</div><div class="operation-grid">${drawing.map(([a, l, i]) => btn(a, l, i)).join('')}</div>${drawingToolSections(this)}${shapesOnly ? '' : `<div class="section-label" style="margin-top:22px">EDIT & ORGANIZE</div><div class="operation-grid">${editing.map(([a, l, i]) => btn(a, l, i)).join('')}</div>`}`, { wide: !shapesOnly }); bindDrawingSearch(this); }
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
        backdrop.addEventListener('change', e => this.onChange(e));
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
    newDialog() {
        this.openModal('Create a drawing', `<p>Your current drawing is saved before switching. These are editable concept schematics, not engineered or construction-approved designs.</p><label class="field">Find an industry or drawing type<input id="template-search" type="search" placeholder="Water, hydraulic, single-line, HVAC…" autocomplete="off"></label><div class="template-count" role="status" aria-live="polite">${DRAWING_TYPES.length} drawing starters</div><div class="export-grid template-grid"><button class="export-option" data-demo="blank">${icon('new')}<span><strong>Blank drawing</strong><small>Empty model with all symbol libraries.</small></span></button>${DRAWING_TYPES.map(t => `<button class="export-option template-card" data-demo="${E(t.id)}" data-search="${E([t.name, t.industry, t.drawingType, ...t.categories, ...t.standardRefs, t.description].join(' ').toLowerCase())}"><span class="template-content"><small class="template-industry">${E(t.industry)}</small><strong>${E(t.name)}</strong><small>${E(t.drawingType)}</small><span class="template-preview">${t.nodes.slice(0, 3).map(n => this.librarySymbolPreview(SYMBOLS.find(s => s.id === n.symbol))).join('') || icon('graph')}</span><small>${E(t.description)}</small></span></button>`).join('')}</div>`, { wide: true });
        const input = this.modal.querySelector('#template-search');
        input.addEventListener('input', () => {
            const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            let count = 0;
            this.modal.querySelectorAll('[data-search]').forEach(card => { const show = words.every(word => card.dataset.search.includes(word)); card.hidden = !show; if (show) count++; });
            this.modal.querySelector('.template-count').textContent = `${count} matching drawing starters`;
        });
    }
    async newDocument(kind) {
        if(this.blockSession)throw new Error('Close the block editor before creating another drawing');
        if (this.switchingDocument) return;
        this.switchingDocument = true;
        try {
            const next = kind === 'blank' ? installSymbols(createDocument()) : createDemo(kind);
            try { await this.store.save(this.doc, uid('project')); }
            catch { this.toast('Previous project could not be saved. Export it before starting a new drawing.', true); return; }
            const profile = DRAWING_TYPES.find(p => p.id === kind);
            this.closeModal(); this.closePanels(); this.cancelGesture();
            this.doc = next; this.selection.clear(); this.history.clear();
            this.category = profile?.categories[0] || 'P&ID'; this.lineStyle = profile?.defaultLineStyle || 'process';
            this.currentLayer = LINE_STYLES.find(s => s.id === this.lineStyle)?.layer || 'Process';
            this.librarySearch = ''; this.$('#symbol-search').value = '';
            this.renderer.setDocument(this.doc); this.setTool('select'); this.updateUI(); this.renderer.fit(); this.store.schedule(this.doc);
        } finally { this.switchingDocument = false; }
    }
    basename() { return (this.doc.name || 'drawing').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'); }
    exportDialog() { const report = exportReport(this.doc); this.openModal('Export your drawing', `<p>Choose an editable CAD file, a full project, or a presentation format. Files are generated locally.</p><label class="field">DXF target version<select id="dxf-version"><option value="AC1015">AutoCAD 2000 · AC1015</option><option value="AC1018">AutoCAD 2004 · AC1018</option><option value="AC1021">AutoCAD 2007 · AC1021</option><option value="AC1024" selected>AutoCAD 2010 · AC1024</option><option value="AC1027">AutoCAD 2013 · AC1027</option><option value="AC1032">AutoCAD 2018 · AC1032</option></select></label><label class="field">DXF export mode<select id="dxf-mode"><option value="normalized">Normalized editable DXF</option><option value="preserve" ${report.preservationAvailable ? '' : 'disabled'}>Preserve source records · guarded edits</option></select></label><label class="dxf-strict-option"><input id="dxf-strict" type="checkbox"><span>Reject known normalized data loss</span></label><p class="muted-note">Preserving mode keeps the source version and foreign records. Structural edits and dependent geometry are rejected, never silently merged.</p><div class="export-grid"><button class="export-option" data-export="dxf">${icon('line')}<span><strong>DXF drawing</strong><small>ASCII DXF with native dimensions, layouts, meshes and blocks.</small></span></button><button class="export-option" data-export="dxf-binary">${icon('line')}<span><strong>Binary DXF</strong><small>Compact typed DXF, same version and preservation choices.</small></span></button>${report.preservationAvailable ? `<button class="export-option" data-export="dxf-graph">${icon('graph')}<span><strong>DXF object graph</strong><small>Source handles, references and diagnostics as JSON.</small></span></button>` : ''}<button class="export-option" data-export="project">${icon('save')}<span><strong>Conduit project</strong><small>Full document, ports, constraints, parameters and original input.</small></span></button><button class="export-option" data-export="svg">${icon('screen')}<span><strong>SVG vector</strong><small>Scalable engineering artwork and text.</small></span></button><button class="export-option" data-export="png">${icon('rect')}<span><strong>PNG image</strong><small>Full drawing, 2400 pixels wide.</small></span></button><button class="export-option" data-export="bom">${icon('layers')}<span><strong>Equipment schedule</strong><small>CSV: block, tag, layer, position and rotation.</small></span></button><button class="export-option" data-export="graph">${icon('graph')}<span><strong>Connection graph</strong><small>JSON: nodes, ports, edges and adjacency.</small></span></button>${report.originalAvailable ? `<button class="export-option" data-export="original">${icon('folder')}<span><strong>Original DXF</strong><small>Exact imported source, without your edits. Preserves unsupported records.</small></span></button>` : ''}</div>${report.warnings.length ? `<div class="hint-box"><strong>Normalized DXF export limitations</strong><br>${report.warnings.map(E).join('<br>')}</div>` : ''}<p class="muted-note">Conduit metadata is application-specific. Other CAD tools will not automatically solve Conduit constraints or reroute connections. Keep the project file as your editable master.</p>`, { wide: true }); }
    async doExport(format) {
        if(this.blockSession)throw new Error('Save or close the block editor before exporting');
        const name = this.basename(), version = this.modal?.querySelector('#dxf-version')?.value || 'AC1024';
        if (format === 'project')
            downloadFile(name + '.conduit.json', JSON.stringify(this.doc, null, 2), 'application/json');
        else if (format === 'dxf' || format === 'dxf-binary') {
            const report = exportReport(this.doc),mode=this.modal?.querySelector('#dxf-mode')?.value || 'normalized';
            const strict=this.modal?.querySelector('#dxf-strict')?.checked || false;
            const options={version:mode==='preserve'?this.doc.importVersion:version,mode,strict};
            const data=format==='dxf-binary'?writeDXFBinary(this.doc,options):writeDXF(this.doc,options);
            downloadFile(name + (format==='dxf-binary'?'-binary':'') + '.dxf',data,'application/dxf');
            if (report.warnings.length && mode!=='preserve')
                this.toast('DXF exported with the limitations shown in Export. Keep a project copy.', true);
            else
                this.toast('DXF drawing exported');
        }
        else if(format==='dxf-graph')downloadFile(name+'-dxf-graph.json',JSON.stringify(inspectObjectGraph(this.doc),null,2),'application/json');
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
        if(this.blockSession)throw new Error('Close the block editor before opening another drawing');
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
            this.doc = doc;
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
    commandDialog() { this.openModal('Command palette', `<div class="command-input">${icon('code')}<input id="cad-command" placeholder="LINE 0,0 100,50" autocomplete="off" spellcheck="false" aria-label="CAD command"></div><div class="error-text"></div><p class="muted-note">Enter executes. Commands use drawing units and comma-separated point coordinates.</p><table class="keyboard-table"><tr><td>Line with exact endpoints</td><td>LINE 0,0 100,50</td></tr><tr><td>New point-driven tools</td><td>ARC / ELLIPSE / SPLINE / HATCH / MTEXT</td></tr><tr><td>Exact native 3-point arc</td><td>ARC 0,0 50,50 100,0</td></tr><tr><td>Next absolute / relative point</td><td>NEXT 10,20 / NEXT @50&lt;30</td></tr><tr><td>Complete path</td><td>FINISH / CLOSE</td></tr><tr><td>Circle with center and radius</td><td>CIRCLE 0,0 25</td></tr><tr><td>Rectangle · x, y, width, height</td><td>RECT 0 0 120 80</td></tr><tr><td>Move selected objects</td><td>MOVE 10 -20</td></tr><tr><td>Transforms and editing</td><td>ROTATE 45 / OFFSET 10</td></tr><tr><td>Named parameter</td><td>PARAM size=100</td></tr><tr><td>History and view</td><td>UNDO / REDO / FIT</td></tr></table>`, { confirm: 'Run command', onConfirm: () => { this.executeCommand(this.modal.querySelector('#cad-command').value); this.closeModal(); } }); }
    executeCommand(source) {
        const s = source.trim(), split = s.indexOf(' '), cmd = (split < 0 ? s : s.slice(0, split)).toUpperCase(), rest = split < 0 ? '' : s.slice(split + 1).trim(), args = rest.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        if(cmd==='BEDIT'){startBlockEditor(this,rest||this.selected()[0]?.block);return;}
        if(cmd==='BSAVE'){finishBlockEditor(this,true,true);return;}
        if(cmd==='BCLOSE'){finishBlockEditor(this,rest.toLowerCase()!=='discard');return;}
        if(cmd==='BTEST'||cmd==='BTESTBLOCK'){this.action('block-test');return;}
        if(cmd==='ATTSYNC'){this.action('block-sync-attributes');return;}
        if(cmd==='BSAVEAS'){this.action('block-save-as');return;}
        if(cmd==='PARAMETERS'){parameterManager(this);return;}
        if(cmd==='SOLVE'){this.edit('Solve constraints',()=>this.solveConstraints());return;}
        if(drawingCommand(this,cmd,rest))return;
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
                        if(this.blockSession){finishBlockEditor(this,true,true);return;}
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
                    if(this.drawingSession)this.drawingSession.undo();else this.draft.pop();
                    this.preview=null;
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
            const key = e.key.toLowerCase(), tools = { v: 'select', h: 'pan', l: 'line', p: 'polyline', r: 'rect', c: 'circle', k: 'connect', t: 'text', d: 'dimension', a:'arc', e:'ellipse', b:'spline' };
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
    helpDialog() { const stats = this.renderer.stats; this.openModal('Conduit CAD · 0.6.0', `<p><strong>Touch-first drafting and diagramming, built on native DXF entities.</strong> All drawing, import, routing, rendering and saving run on your device.</p><div class="about-stats"><div><b>${SYMBOLS.length}</b><small>SYMBOL MASTERS</small></div><div><b>14</b><small>ES MODULE PACKAGES</small></div><div><b>${E(stats.compositor || stats.backend)}</b><small>ACTIVE COMPOSITOR</small></div></div><div class="section-label">TOUCH & PEN</div><p>Tap a tool, then tap points or drag to draw. Drag a selected object to move it. Use two fingers to pan and zoom without drawing. Drag the grab handle of a library symbol onto the canvas; a simple tap on its card arms placement. Hold the canvas for object actions. Drag a visible port to connect. A magnifier appears during touch editing.</p><div class="section-label">KEYBOARD</div><table class="keyboard-table">${[['Select / Pan', 'V / H or Space'], ['Line / Polyline / Rectangle', 'L / P / R'], ['Circle / Text / Dimension', 'C / T / D'], ['Arc / Ellipse / Spline', 'A / E / B'], ['Connect / Fit', 'K / F'], ['Grid / Snap / Ortho', 'G / S / O'], ['Add to selection', 'Shift-click'], ['Undo / Redo', 'Ctrl/⌘ Z / Shift Z'], ['Duplicate / Copy / Paste', 'Ctrl/⌘ D / C / V'], ['Open / Save project', 'Ctrl/⌘ O / S'], ['Command palette', 'Ctrl/⌘ K'], ['Complete polyline / Cancel', 'Enter / Escape']].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><div class="section-label" style="margin-top:20px">COMPATIBILITY BOUNDARY</div><p>This release is a planar CAD and diagram editor, not full AutoCAD or Visio parity. It imports common ASCII/binary DXF entities and preserves the original input. Normalized export is not a lossless rewrite of every DXF feature. DWG, solid modeling, ACIS solids, proprietary Autodesk dynamic-action evaluation, XREF resolution, associative hatch editing, tilted/perspective paper viewports and block XCLIP, complete SHX/MTEXT font fidelity and standards certification remain outside this release. Native hatch edges, island holes, line patterns, OCS projection and mesh wireframes are supported. Shared block editing, constraint-based and action-based Conduit blocks, analytic planar solving and calculated annotations are supported. Unshifted two-color LINEAR gradients render natively; other gradient distributions retain their data with a diagnosed flat preview.</p><div class="section-label">RENDERER DIAGNOSTICS</div><p>${stats.segments.toLocaleString()} compiled segments · ${stats.buildMs.toFixed(2)} ms scene build · ${stats.frameMs.toFixed(2)} ms last CPU frame submission. These are CPU wall times, not GPU timestamps.</p><p class="muted-note">${E(this.rendererMessage || 'No backend initialization warnings.')}<br>Use HTTPS or localhost for the WebGPU path. Fallbacks are selected automatically when initialization or device recovery fails.</p>`, { wide: true }); }
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
