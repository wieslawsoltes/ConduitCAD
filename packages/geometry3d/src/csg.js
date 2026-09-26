/** Bounded BSP polygon clipping, normalized by the caller. Not an exact B-rep kernel. */
const EPS = 1e-7;
const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]), mul = (a, s) => a.map(x => x * s), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function polygon(vertices) { for (let i = 1; i + 1 < vertices.length; i++) {
    const v = cross(sub(vertices[i], vertices[0]), sub(vertices[i + 1], vertices[0])), length = Math.hypot(...v);
    if (length > 1e-12) {
        const n = mul(v, 1 / length);
        return { vertices, plane: { n, w: dot(n, vertices[0]) } };
    }
} return null; }
function split(plane, p, front, back, coplanarFront, coplanarBack, budget) {
    const ds = p.vertices.map(v => dot(plane.n, v) - plane.w), types = ds.map(d => d > EPS ? 1 : d < -EPS ? 2 : 0), type = types.reduce((a, b) => a | b, 0);
    if (type === 0) {
        (dot(plane.n, p.plane.n) > 0 ? coplanarFront : coplanarBack).push(p);
        return;
    }
    if (type === 1) {
        front.push(p);
        return;
    }
    if (type === 2) {
        back.push(p);
        return;
    }
    if (--budget.remaining < 0)
        throw new Error('Boolean polygon budget exceeded');
    const a = [], b = [];
    for (let i = 0; i < p.vertices.length; i++) {
        const j = (i + 1) % p.vertices.length, vi = p.vertices[i], vj = p.vertices[j];
        if (types[i] !== 2)
            a.push(vi);
        if (types[i] !== 1)
            b.push(vi);
        if ((types[i] | types[j]) === 3) {
            const v = add(vi, mul(sub(vj, vi), ds[i] / (ds[i] - ds[j])));
            a.push(v);
            b.push(v);
        }
    }
    const pa = polygon(a), pb = polygon(b);
    if (pa)
        front.push(pa);
    if (pb)
        back.push(pb);
}
class Node {
    constructor(polygons = [], budget, depth = 0) { this.plane = null; this.polygons = []; this.front = null; this.back = null; this.budget = budget; this.depth = depth; this.build(polygons); }
    build(polygons) { if (!polygons.length)
        return; if (this.depth > 192)
        throw new Error('Boolean BSP depth budget exceeded'); this.plane ||= polygons[Math.floor(polygons.length / 2)].plane; const a = [], b = []; for (const p of polygons)
        split(this.plane, p, a, b, this.polygons, this.polygons, this.budget); if (a.length) {
        this.front ||= new Node([], this.budget, this.depth + 1);
        this.front.build(a);
    } if (b.length) {
        this.back ||= new Node([], this.budget, this.depth + 1);
        this.back.build(b);
    } }
    all() { return [...this.polygons, ...(this.front?.all() || []), ...(this.back?.all() || [])]; }
    invert() { for (const p of this.polygons) {
        p.vertices = p.vertices.slice().reverse();
        p.plane = { n: mul(p.plane.n, -1), w: -p.plane.w };
    } if (this.plane)
        this.plane = { n: mul(this.plane.n, -1), w: -this.plane.w }; this.front?.invert(); this.back?.invert(); [this.front, this.back] = [this.back, this.front]; }
    clip(polygons) { if (!this.plane)
        return polygons; let a = [], b = []; for (const p of polygons)
        split(this.plane, p, a, b, a, b, this.budget); if (this.front)
        a = this.front.clip(a); b = this.back ? this.back.clip(b) : []; return a.concat(b); }
    clipTo(other) { this.polygons = other.clip(this.polygons); this.front?.clipTo(other); this.back?.clipTo(other); }
}
export function booleanPolygons(left, right, operation) {
    if (!['union', 'subtract', 'intersect'].includes(operation))
        throw new Error('Unknown boolean operation');
    if (!left.length || !right.length)
        return operation === 'union' ? left.concat(right) : operation === 'subtract' ? left : [];
    const budget = { remaining: 80000 }, a = new Node(left.map(polygon).filter(Boolean), budget), b = new Node(right.map(polygon).filter(Boolean), budget);
    if (operation === 'union') {
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.all());
    }
    if (operation === 'subtract') {
        a.invert();
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.all());
        a.invert();
    }
    if (operation === 'intersect') {
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.build(b.all());
        a.invert();
    }
    return a.all().map(p => p.vertices);
}
