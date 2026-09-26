import { V3, add3, sub3, mul3, dot3, cross3, unit3, bounds3, multiply4 } from '@conduitcad/geometry3d';
/** Z-up orbit camera. Projection math stays in Float64 until a relative GPU upload. */
export class OrbitCamera {
    constructor(state = {}) { this.target = V3(); this.yaw = -Math.PI / 4; this.pitch = .6; this.distance = 300; this.height = 220; this.perspective = false; this.width = 1; this.pixelHeight = 1; Object.assign(this, state); }
    basis() { const cp = Math.cos(this.pitch), back = V3(cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), Math.sin(this.pitch)), right = V3(-Math.sin(this.yaw), Math.cos(this.yaw), 0), up = unit3(cross3(back, right)); return { back, right, up, forward: mul3(back, -1), eye: add3(this.target, mul3(back, this.distance)) }; }
    resize(width, height) { this.width = Math.max(1, width); this.pixelHeight = Math.max(1, height); }
    project(p) { const { eye, right, up, forward } = this.basis(), v = sub3(p, eye), depth = dot3(v, forward), scale = this.perspective ? this.pixelHeight / (2 * Math.tan(Math.PI / 8) * depth) : this.pixelHeight / this.height; return { x: this.width / 2 + dot3(v, right) * scale, y: this.pixelHeight / 2 - dot3(v, up) * scale, depth, visible: depth > this.near() && depth < this.far() }; }
    near() { return Math.max(1e-6, this.distance * .0001); }
    far() { return Math.max(this.distance * 100, this.height * 100); }
    ray(x, y) { const b = this.basis(), u = (x - this.width / 2) * this.height / this.pixelHeight, v = (this.pixelHeight / 2 - y) * this.height / this.pixelHeight; if (!this.perspective)
        return { origin: add3(b.eye, add3(mul3(b.right, u), mul3(b.up, v))), direction: b.forward }; const k = 2 * Math.tan(Math.PI / 8) / this.pixelHeight; return { origin: b.eye, direction: unit3(add3(b.forward, add3(mul3(b.right, (x - this.width / 2) * k), mul3(b.up, (this.pixelHeight / 2 - y) * k)))) }; }
    matrix(origin = V3()) {
        const b = this.basis(), eye = sub3(b.eye, origin), r = b.right, u = b.up, z = b.back;
        const view = [r.x, u.x, z.x, 0, r.y, u.y, z.y, 0, r.z, u.z, z.z, 0, -dot3(r, eye), -dot3(u, eye), -dot3(z, eye), 1], n = this.near(), f = this.far(), aspect = this.width / this.pixelHeight;
        let projection;
        if (this.perspective) {
            const a = 1 / Math.tan(Math.PI / 8);
            projection = [a / aspect, 0, 0, 0, 0, a, 0, 0, 0, 0, -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0];
        }
        else
            projection = [2 / (this.height * aspect), 0, 0, 0, 0, 2 / this.height, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1];
        return multiply4(projection, view);
    }
    orbit(dx, dy) { this.yaw -= dx * .008; this.pitch = Math.max(-Math.PI / 2 + 1e-5, Math.min(Math.PI / 2 - 1e-5, this.pitch + dy * .008)); }
    pan(dx, dy) { const b = this.basis(), scale = (this.perspective ? 2 * this.distance * Math.tan(Math.PI / 8) : this.height) / this.pixelHeight; this.target = add3(this.target, add3(mul3(b.right, -dx * scale), mul3(b.up, dy * scale))); }
    zoom(factor) { if (!Number.isFinite(factor) || factor <= 0)
        return; this.height = Math.max(1e-5, Math.min(1e12, this.height / factor)); this.distance = Math.max(1e-5, Math.min(1e12, this.distance / factor)); }
    fit(points) { const b = bounds3(points); if (b.empty) {
        this.target = V3();
        this.height = 220;
        this.distance = 300;
        return;
    } this.target = mul3(add3(b.min, b.max), .5); const basis = this.basis(); let rx = 0, ry = 0, rz = 0; for (const p of points) {
        const v = sub3(p, this.target);
        rx = Math.max(rx, Math.abs(dot3(v, basis.right)));
        ry = Math.max(ry, Math.abs(dot3(v, basis.up)));
        rz = Math.max(rz, Math.abs(dot3(v, basis.back)));
    } this.height = Math.max(1, 2.6 * ry, 2.6 * rx * this.pixelHeight / this.width); this.distance = this.height / (2 * Math.tan(Math.PI / 8)) + rz + 1; }
    view(name) { const presets = { iso: [-Math.PI / 4, .6], top: [-Math.PI / 2, Math.PI / 2 - 1e-6], bottom: [-Math.PI / 2, -Math.PI / 2 + 1e-6], front: [-Math.PI / 2, 0], back: [Math.PI / 2, 0], right: [0, 0], left: [Math.PI, 0] }; if (!presets[name])
        throw new Error('Unknown camera preset'); [this.yaw, this.pitch] = presets[name]; }
    snapshot() { return { target: { ...this.target }, yaw: this.yaw, pitch: this.pitch, distance: this.distance, height: this.height, perspective: this.perspective }; }
}
