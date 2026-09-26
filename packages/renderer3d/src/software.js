import { dot3, sub3, lerp3 } from '@conduitcad/geometry3d';
/** Bounded software Z-buffer fallback. Canvas presents pixels; no painter sorting is used. */
export function rasterizeScene(scene, camera, { width, height, style = 'shaded-edges', section = null, selection = new Set(), selectedFace = null, shade, rgb }) {
    const pixels = new Uint8ClampedArray(width * height * 4), depth = new Float64Array(width * height);
    depth.fill(Infinity);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 240;
        pixels[i + 1] = 245;
        pixels[i + 2] = 245;
        pixels[i + 3] = 255;
    }
    const sx = width / camera.width, sy = height / camera.pixelHeight, near = camera.near(), far = camera.far();
    const project = p => { const q = camera.project(p); return { x: q.x * sx, y: q.y * sy, z: q.depth }; };
    const clip = (vertices, n, w) => { const next = []; for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length], da = dot3(a, n) - w, db = dot3(b, n) - w;
        if (da <= 0)
            next.push(a);
        if (da * db < 0)
            next.push(lerp3(a, b, da / (da - db)));
    } return next; };
    const basis = camera.basis(), plane = dot3(basis.eye, basis.forward);
    const clipped = vertices => { let out = vertices; if (section)
        out = clip(out, section.normal, section.offset); out = clip(out, { x: -basis.forward.x, y: -basis.forward.y, z: -basis.forward.z }, -plane - near); return clip(out, basis.forward, plane + far); };
    const write = (x, y, z, color) => { if (x < 0 || y < 0 || x >= width || y >= height || !Number.isFinite(z))
        return; const i = y * width + x; if (z > depth[i] + Math.max(1e-8, Math.abs(z) * 1e-8))
        return; depth[i] = z; const k = i * 4; pixels[k] = color[0] * 255; pixels[k + 1] = color[1] * 255; pixels[k + 2] = color[2] * 255; };
    function triangle(a, b, c, color) {
        const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (!Number.isFinite(area) || Math.abs(area) < 1e-10)
            return;
        const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x))), y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
        const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
                const px = x + .5 - a.x, py = y + .5 - a.y, v = (px * cy - py * cx) / area, w = (bx * py - by * px) / area, u = 1 - v - w;
                if (u < -1e-8 || v < -1e-8 || w < -1e-8)
                    continue;
                const z = camera.perspective ? 1 / (u / a.z + v / b.z + w / c.z) : u * a.z + v * b.z + w * c.z;
                write(x, y, z, color);
            }
    }
    if (style !== 'wireframe')
        for (const t of scene.triangles) {
            const p = clipped(t.vertices).map(project), color = shade(t, selection.has(t.id) && (!selectedFace || selectedFace.face === t.face));
            for (let i = 1; i + 1 < p.length; i++)
                triangle(p[0], p[i], p[i + 1], color);
        }
    for (const line of scene.lines) {
        if (line.edge && (style === 'shaded' || (style === 'shaded-edges' && line.coplanar)))
            continue;
        let a = line.a, b = line.b;
        const planes = [{ n: { x: -basis.forward.x, y: -basis.forward.y, z: -basis.forward.z }, w: -plane - near }, { n: basis.forward, w: plane + far }, ...(section ? [{ n: section.normal, w: section.offset }] : [])];
        let reject = false;
        for (const { n, w } of planes) {
            const da = dot3(a, n) - w, db = dot3(b, n) - w;
            if (da > 0 && db > 0) {
                reject = true;
                break;
            }
            if (da * db < 0) {
                const p = lerp3(a, b, da / (da - db));
                if (da > 0)
                    a = p;
                else
                    b = p;
            }
        }
        if (reject)
            continue;
        const p = project(a), q = project(b), dx = q.x - p.x, dy = q.y - p.y;
        let lo = 0, hi = 1;
        for (const [v, d, max] of [[p.x, dx, width - 1], [p.y, dy, height - 1]]) {
            if (Math.abs(d) < 1e-12) {
                if (v < 0 || v > max)
                    reject = true;
            }
            else {
                const t0 = -v / d, t1 = (max - v) / d;
                lo = Math.max(lo, Math.min(t0, t1));
                hi = Math.min(hi, Math.max(t0, t1));
            }
        }
        if (reject || lo > hi)
            continue;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * (hi - lo))), color = rgb(selection.has(line.id) ? '#db861e' : line.edge ? '#344d58' : line.color);
        for (let i = 0; i <= steps; i++) {
            const t = lo + (hi - lo) * i / steps, z = camera.perspective ? 1 / ((1 - t) / p.z + t / q.z) : (1 - t) * p.z + t * q.z, bias = Math.max(1e-6, camera.height * .0003);
            write(Math.round(p.x + dx * t), Math.round(p.y + dy * t), z - bias, color);
        }
    }
    return { pixels, depth, width, height };
}
