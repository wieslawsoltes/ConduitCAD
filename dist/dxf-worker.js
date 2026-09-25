'use strict';
(()=>{
const __modules=Object.create(null);
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
// packages/model/src/dynamic.js
__modules["packages/model/src/dynamic.js"]=(()=>{
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
    if(!d||d.version!==1||!Array.isArray(d.parameters)||!Array.isArray(d.actions))throw new Error('Expected Conduit dynamic-block schema version 1');
    if(d.parameters.length>64||d.actions.length>256||!Array.isArray(block.entities)||block.entities.length>10000)throw new Error('Dynamic block complexity limit exceeded');
    const names=new Set(),ids=new Set();
    for(const p of d.parameters){if(!/^[A-Za-z][\w-]{0,63}$/.test(p.name)||forbidden.has(p.name)||names.has(p.name))throw new Error('Invalid or duplicate parameter name');names.add(p.name);valueOf(p,p.default);
        if(p.grip){for(const key of ['base','direction'])if(p.grip[key]){finite(p.grip[key].x,'grip '+key);finite(p.grip[key].y,'grip '+key);}
            if(p.grip.direction&&Math.hypot(p.grip.direction.x,p.grip.direction.y)<1e-9)throw new Error('Grip direction must be nonzero');
            if(p.grip.radius!==undefined&&finite(p.grip.radius,'grip radius')<=0)throw new Error('Grip radius must be positive');}
    }
    for(const e of block.entities){if(!e.id||ids.has(e.id))throw new Error('Dynamic geometry needs unique entity IDs');ids.add(e.id);}
    const portNames=new Set();for(const port of block.ports||[]){if(!port.name||portNames.has(port.name))throw new Error('Dynamic ports need unique names');portNames.add(port.name);for(const k of ['x','y','dx','dy'])finite(port[k],'port '+k);}
    const types=new Set(['move','stretch','rotate','scale','flip','visibility','array','lookup']);
    for(const a of d.actions){
        if(!types.has(a.type)||!names.has(a.parameter))throw new Error('Unknown dynamic action or parameter');
        if(a.entities && (!Array.isArray(a.entities)||a.entities.some(id=>!ids.has(id))))throw new Error('Dynamic action references missing geometry');
        if(a.ports && (!Array.isArray(a.ports)||a.ports.some(n=>!(block.ports||[]).some(p=>p.name===n))))throw new Error('Dynamic action references missing port');
        for(const k of ['base','direction','step'])if(a[k]){finite(a[k].x,k);finite(a[k].y,k);}
        const parameter= d.parameters.find(p=>p.name===a.parameter);
        if(['move','stretch','rotate','scale','array'].includes(a.type)&&!['number','distance','angle','integer'].includes(parameter.type))throw new Error('Geometric action requires a numeric parameter');
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
    const definitions=new Map(block.dynamic.parameters.map(p=>[p.name,p])),values=Object.create(null),writers=new Map();
    for(const key of Object.keys(input))if(!definitions.has(key))throw new Error(`Unknown dynamic parameter: ${key}`);
    for(const p of definitions.values())values[p.name]=valueOf(p,own(input,p.name)?input[p.name]:p.default);
    const lookups=block.dynamic.actions.filter(a=>a.type==='lookup');
    for(const a of lookups){
        if(!a.rows||typeof a.rows!=='object')throw new Error('Lookup action requires rows');
        for(const row of Object.values(a.rows))for(const key of Object.keys(row)) {
            if(!definitions.has(key)||key===a.parameter||writers.has(key)&&writers.get(key)!==a)throw new Error('Invalid or ambiguous lookup dependency');
            writers.set(key,a);valueOf(definitions.get(key),row[key]);
        }
    }
    const visited=new Set(),active=new Set();
    const run=a=>{
        if(visited.has(a))return;if(active.has(a))throw new Error('Dynamic lookup cycle');active.add(a);
        if(writers.has(a.parameter))run(writers.get(a.parameter));
        const key=String(values[a.parameter]);if(!own(a.rows,key))throw new Error('No lookup row for selected value');
        for(const [k,v]of Object.entries(a.rows[key]))values[k]=valueOf(definitions.get(k),v);
        active.delete(a);visited.add(a);
    };
    lookups.forEach(run);return values;
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
        if(a.type==='array'){
            if(!Number.isInteger(value)||value<1||value>256)throw new Error('Array count must be 1–256');
            const originals=result.entities.filter(selected);if(result.entities.length+originals.length*(value-1)>maxEntities)throw new Error('Dynamic array entity budget exceeded');
            const step=a.step||{x:10,y:0};
            for(let i=1;i<value;i++)for(const e of originals){const c=clone(e);c.id=`${e.id}:array:${i}`;transformEntity(c,matrix({x:step.x*i,y:step.y*i}));result.entities.push(c);}
            continue; // Named terminals describe the original cell; no implicit port duplication.
        }
        let m;
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
            if (e.dimension?.version === 1) {
                try {
                    const picture = buildDimensionPicture(e,doc);
                    for (const child of picture.entities) {
                        const g=entityGeometry(child,doc,{...options,matrix:m,depth:depth+1,parentStyle:style,parentLayer:layerFor(e,doc)});
                        paths.push(...g.paths.map(p=>({...p,entityId:e.id})));texts.push(...g.texts.map(t=>({...t,entityId:e.id})));
                    }
                } catch(error) { warnings.push({entityId:e.id,message:error.message}); }
                break;
            }
            if (e.block && doc.blocks[e.block]) {
                const g = entityGeometry({ ...e, type: 'INSERT', x: e.dimensionInsert?.x || 0, y: e.dimensionInsert?.y || 0, z: e.dimensionInsert?.z || 0 }, doc, { ...options, depth: depth + 1 });
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
    if(e.type==='VIEWPORT')return e.viewportId===1?emptyBounds():bounds(viewportRectangle(e));
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
    e.dynamicParameters={...evaluated.dynamicValues};e.dirty=true;return evaluated;
}
const dynamicCache=new WeakMap();
function effectiveBlock(e,doc) {
    const block=doc.blocks[e.block];if(!block?.dynamic)return block;
    const signature=JSON.stringify([block.entities,block.ports,block.dynamic,block.base]);
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

return {textLayout,objectCoordinateTransform,uid,clone,createDocument,validateDocument,entity,line,polyline,circle,text,rect,layerFor,isVisible,isLocked,cleanText,resolveStyle,entityGeometry,entityBounds,documentBounds,ports,moveEntity,transformEntity,explodeEntity,detachReferences,dimensionPicture,editDimension,dimensionGrips,regenerateDimensions,validateDynamicBlock,dynamicValues,evaluateDynamicBlock,setDynamicParameters,dynamicParameterGrips,dynamicGripValue};
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
    for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'ports', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource'])
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
            block = { name: get(raw, 2, ''), base: pt(raw), entities: [], flags: +get(raw,70,0), ports: metadata(raw).ports || [], symbol: metadata(raw).symbol, dynamic: metadata(raw).dynamic, dynamicInstance: metadata(raw).dynamicInstance, dimensionPicture: metadata(raw).dimensionPicture };
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
        for (const k of ['connector', 'tag', 'label', 'dash', 'width', 'parametric', 'fill', 'locked', 'dimension', 'dynamicParameters', 'dynamicSource'])
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
        meta({ ports: b.ports || [], symbol: b.symbol, dynamic: b.dynamic, dynamicInstance: b.dynamicInstance, dimensionPicture: b.dimensionPicture });
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
