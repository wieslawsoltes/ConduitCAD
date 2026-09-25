import { inflate, contains, segmentIntersectsBox, simplifyOrthogonal, distance, normalize, add, mul, bounds, intersects } from '@conduitcad/geometry';
import { SpatialIndex } from '@conduitcad/spatial';
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
export function routeOrthogonal(start, end, obstacles = [], options = {}) {
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
export function routePorts(from, to, obstacles = [], options = {}) {
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
export function routeVia(start, end, waypoints, obstacles = [], options = {}) {
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
export function graphFromDocument(doc) {
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
