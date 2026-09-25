/** CAD-native construction primitives. Coordinates are Y-up, in drawing units. */
import { line, polyline, circle, rect, text, entity } from '@conduitcad/model';
export const pt = (x, y) => ({ x, y });
export const L = (a, b, c, d, props = {}) => line(pt(a, b), pt(c, d), props);
export const P = (points, closed = false, props = {}) => polyline(points.map(v => Array.isArray(v) ? pt(...v) : v), closed, props);
export const C = (x, y, r, props = {}) => circle(pt(x, y), r, props);
export const R = (x, y, w, h) => rect(x, y, w, h);
export const T = (x, y, value, height = 12) => text(pt(x, y), value, height, { align: 'center' });
export const A = (x, y, r, start, end) => entity('ARC', { c: pt(x, y), r, start, end });
export function E(x, y, rx, ry, start = 0, end = Math.PI * 2) {
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
export const B = (points) => entity('SPLINE', { degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: points.map(v => pt(...v)), weights: [1, 1, 1, 1] });
export const port = (name, x, y, dx, dy, medium, role) => ({ name, x, y, dx, dy, ...(medium ? { medium } : {}), ...(role ? { role } : {}) });
export const H = () => [port('in', -45, 0, -1, 0), port('out', 45, 0, 1, 0)];
export const V = (y = 45) => [port('top', 0, y, 0, 1), port('bottom', 0, -y, 0, -1)];
export const F = () => [...H(), ...V()];
export const leads = (radius = 25) => [L(-45, 0, -radius, 0), L(radius, 0, 45, 0)];
export const diamond = (w = 28, h = 28) => P([[-w, 0], [0, h], [w, 0], [0, -h]], true);
export function triangle(points, filled = false) {
    return filled ? entity('SOLID', { points: points.map(v => pt(...v)) }) : P(points, true);
}
export function arrow(x1, y1, x2, y2, size = 7, filled = false) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1e-9) throw new Error('An arrow needs a nonzero direction');
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d, x = x2 - ux * size, y = y2 - uy * size;
    return [L(x1, y1, x2, y2), triangle([[x2, y2], [x - uy * size * .45, y + ux * size * .45], [x + uy * size * .45, y - ux * size * .45]], filled)];
}
export function spring(x, y, length = 30, height = 6, vertical = false) {
    const values = [[0, 0], [length * .1, 0]];
    for (let i = 1; i < 7; i++) values.push([length * (.1 + i * .11), i % 2 ? height : -height]);
    values.push([length * .9, 0], [length, 0]);
    return P(values.map(([a, b]) => vertical ? [x + b, y + a] : [x + a, y + b]));
}
export function capsule(x, y, w, h) {
    const r = h / 2, left = x + r, right = x + w - r;
    return [L(left, y, right, y), A(right, y + r, r, -Math.PI / 2, Math.PI / 2), L(right, y + h, left, y + h), A(left, y + r, r, Math.PI / 2, Math.PI * 1.5)];
}
export function vessel(w = 54, h = 100) {
    const r = w / 2, y = h / 2 - r;
    return [L(-r, -y, -r, y), A(0, y, r, 0, Math.PI), L(r, y, r, -y), A(0, -y, r, Math.PI, Math.PI * 2)];
}
export function functionalBlock(label, width = 64, height = 44) {
    return [R(-width / 2, -height / 2, width, height), ...leads(width / 2), T(0, -4, label, 11)];
}
