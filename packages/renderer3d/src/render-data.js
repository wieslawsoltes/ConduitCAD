import { V3, add3, sub3, mul3, dot3, cross3, unit3, length3, lerp3, ocs3, transform3 } from '@conduitcad/geometry3d';
import { color3, normalizeMaterial, visualStyle } from './visual-styles.js';

/** Even-odd scan conversion of planar cut segments. Holes remain holes, without a fan cap. */
export function sectionGeometry(scene, section, { maxSegments = 12000, maxTriangles = 100000 } = {}) {
    if (!section) return { triangles: [], lines: [], diagnostics: [] };
    const n = unit3(section.normal), offset = section.offset / length3(section.normal), m = ocs3(n), u = transform3(V3(1, 0, 0), m), v = transform3(V3(0, 1, 0), m);
    const origin = add3(scene.origin, mul3(n, offset - dot3(scene.origin, n))), extent = Math.max(1e-6, ...['x', 'y', 'z'].map(k => scene.bounds.empty ? 1 : scene.bounds.max[k] - scene.bounds.min[k])), eps = extent * 1e-9;
    const groups = new Map(), triangles = [], lines = [], diagnostics = [];
    let count = 0;
    for (const t of scene.triangles) {
        const d = t.vertices.map(p => dot3(sub3(p, origin), n));
        const on = d.map(x => Math.abs(x) <= eps);
        // A cut through an existing tessellation ring belongs to its retained side.
        // Counting both incident triangles doubles the contour; skipping both loses caps.
        if (on.every(Boolean)) continue;
        if (on.filter(Boolean).length !== 2 && (Math.min(...d) >= -eps || Math.max(...d) <= eps)) continue;
        if (on.filter(Boolean).length === 2 && Math.min(...d) >= -eps) continue;
        const points = [];
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            if (Math.abs(d[i]) <= eps) points.push(t.vertices[i]);
            else if (!on[j] && d[i] * d[j] < 0) points.push(lerp3(t.vertices[i], t.vertices[j], d[i] / (d[i] - d[j])));
        }
        if (points.length !== 2 || length3(sub3(points[0], points[1])) <= eps) continue;
        if (++count > maxSegments) { diagnostics.push({ message: 'Section cap segment budget exceeded; cut remains uncapped.' }); return { triangles: [], lines: [], diagnostics }; }
        const a = { x: dot3(sub3(points[0], origin), u), y: dot3(sub3(points[0], origin), v) }, b = { x: dot3(sub3(points[1], origin), u), y: dot3(sub3(points[1], origin), v) };
        const key = t.item ?? t.id;
        if (!groups.has(key)) groups.set(key, { id: t.id, segments: [], t });
        groups.get(key).segments.push({ a, b });
        lines.push({ a: points[0], b: points[1], id: t.id, color: '#9f6738', edge: false, cap: true });
    }
    const world = (x, y) => add3(origin, add3(mul3(u, x), mul3(v, y)));
    for (const { segments, t, id } of groups.values()) {
        const degrees = new Map();
        for (const e of segments) for (const p of [e.a, e.b]) { const key = Math.round(p.x / eps) + ':' + Math.round(p.y / eps); degrees.set(key, (degrees.get(key) || 0) + 1); }
        if ([...degrees.values()].some(d => d !== 2)) { diagnostics.push({ id, message: 'Open or non-manifold section: cut edges displayed; cap omitted.' }); continue; }
        const ys = [...new Set(segments.flatMap(e => [e.a.y, e.b.y]))].sort((a, b) => a - b);
        const xs = (e, y) => e.a.x + (e.b.x - e.a.x) * ((y - e.a.y) / (e.b.y - e.a.y));
        for (let i = 1; i < ys.length; i++) {
            const lo = ys[i - 1], hi = ys[i]; if (hi - lo < eps) continue;
            const mid = (lo + hi) / 2, active = segments.filter(e => Math.min(e.a.y, e.b.y) < mid && Math.max(e.a.y, e.b.y) > mid).sort((a, b) => xs(a, mid) - xs(b, mid));
            if (active.length % 2) continue;
            for (let j = 0; j < active.length; j += 2) {
                const a = active[j], b = active[j + 1], p = [world(xs(a, lo), lo), world(xs(b, lo), lo), world(xs(b, hi), hi), world(xs(a, hi), hi)];
                for (const f of [[0, 1, 2], [0, 2, 3]]) {
                    if (length3(cross3(sub3(p[f[1]], p[f[0]]), sub3(p[f[2]], p[f[0]]))) < eps * eps) continue;
                    triangles.push({ ...t, id, vertices: f.map(k => p[k]), normal: n, normals: [n, n, n], cap: true, face: -1 });
                    if (triangles.length > maxTriangles) return { triangles: [], lines, diagnostics: [{ message: 'Section cap triangle budget exceeded.' }] };
                }
            }
        }
    }
    return { triangles, lines, diagnostics };
}
/** Prepare smooth shading per indexed vertex, without welding coincident independent bodies. */
export function prepareRenderScene(scene, settings, section = null) {
    const cosine = Math.cos(settings.creaseAngle * Math.PI / 180), adjacency = new Map();
    for (const t of scene.triangles) {
        const area = length3(cross3(sub3(t.vertices[1], t.vertices[0]), sub3(t.vertices[2], t.vertices[0])));
        for (const i of t.indices) { const key = `${t.item ?? t.id}:${i}`; if (!adjacency.has(key)) adjacency.set(key, []); adjacency.get(key).push({ n: t.normal, area }); }
    }
    const triangles = scene.triangles.map(t => ({ ...t, normals: t.indices.map(i => {
        let sum = V3(); for (const a of adjacency.get(`${t.item ?? t.id}:${i}`) || []) if (dot3(a.n, t.normal) >= cosine) sum = add3(sum, mul3(a.n, a.area));
        return length3(sum) > 1e-20 ? unit3(sum) : t.normal;
    }) }));
    const caps = settings.sectionCaps ? sectionGeometry(scene, section) : { triangles: [], lines: [], diagnostics: [] };
    triangles.push(...caps.triangles);
    const lines = [...scene.lines, ...caps.lines];
    const size = Math.max(scene.bounds.empty ? 100 : Math.max(scene.bounds.max.x - scene.bounds.min.x, scene.bounds.max.y - scene.bounds.min.y) * 1.4, 100), step = 10 ** Math.floor(Math.log10(size / 12)), extent = Math.min(25, Math.ceil(size / step)), o = scene.origin;
    for (let i = -extent; i <= extent; i++) {
        lines.push({ a: V3(o.x + i * step, o.y - extent * step, 0), b: V3(o.x + i * step, o.y + extent * step, 0), color: '#c4d1d1', grid: true });
        lines.push({ a: V3(o.x - extent * step, o.y + i * step, 0), b: V3(o.x + extent * step, o.y + i * step, 0), color: '#c4d1d1', grid: true });
    }
    const groundZ = scene.bounds.empty ? 0 : scene.bounds.min.z - Math.max(size * .0001, 1e-6), n = V3(0, 0, 1), corners = [V3(o.x-size*3,o.y-size*3,groundZ), V3(o.x+size*3,o.y-size*3,groundZ), V3(o.x+size*3,o.y+size*3,groundZ), V3(o.x-size*3,o.y+size*3,groundZ)];
    for (const f of [[0,1,2],[0,2,3]]) triangles.push({ id: '', vertices: f.map(i => corners[i]), normal: n, normals: [n,n,n], color: settings.groundColor, ground: true, material: normalizeMaterial({roughness: .8}, settings.groundColor) });
    return { ...scene, triangles, lines, diagnostics: [...scene.diagnostics, ...caps.diagnostics], groundZ, step };
}
export function surfaceAlpha(t, settings) { const a = t.material?.opacity ?? 1; return t.ground || t.cap ? 1 : settings.style === 'xray' ? Math.min(a, settings.xrayOpacity) : a; }
export function lineFlags(line) { return line.grid ? 3 : line.cap ? 2 : line.edge ? 1 : 0; }
export function edgeVisible(line, camera, settings) {
    if (line.grid) return settings.grid;
    if (!line.edge) return true;
    const mode = visualStyle(settings.style); if (!mode.visible && !mode.hidden) return false;
    if (settings.edgeDetail === 'all' || settings.style === 'wireframe') return true;
    if (line.coplanar) return false;
    if (!mode.smooth || !line.adjacent || line.adjacent.length !== 2) return true;
    const [a, b] = line.adjacent, view = camera.perspective ? sub3(camera.basis().eye, line.a) : camera.basis().back, silhouette = dot3(a, view) * dot3(b, view) <= 0;
    return silhouette || dot3(a, b) < Math.cos(settings.creaseAngle * Math.PI / 180);
}
export function packRenderData(scene, selection = new Set(), selectedFace = null) {
    // position3, smoothNormal3, flatNormal3, baseColor3, material4 (metal/rough/alpha/emission), flags1
    const surface = new Float32Array(scene.triangles.length * 3 * 17), edges = new Float32Array(scene.lines.length * 21), o = scene.origin;
    let at = 0;
    for (const t of scene.triangles) {
        const selected = selection.has(t.id) && (!selectedFace || (selectedFace.id === t.id && selectedFace.face === t.face));
        const mat = t.material || normalizeMaterial({}, t.color), col = color3(selected ? '#f0b359' : mat.color || t.color);
        for (let i = 0; i < 3; i++) { const p = sub3(t.vertices[i], o), n = t.normals?.[i] || t.normal, flat = t.normal; surface.set([p.x,p.y,p.z,n.x,n.y,n.z,flat.x,flat.y,flat.z,...col,mat.metallic,mat.roughness,mat.opacity,mat.emission,t.ground?2:t.cap?1:0],at);at+=17; }
    }
    at = 0;
    for (let i=0;i<scene.lines.length;i++) { const l=scene.lines[i],a=sub3(l.a,o),b=sub3(l.b,o),n=l.adjacent?.[0]||V3(),n2=l.adjacent?.[1]||n,col=color3(selection.has(l.id)?'#db861e':l.color);
        edges.set([a.x,a.y,a.z,b.x,b.y,b.z,n.x,n.y,n.z,n2.x,n2.y,n2.z,...col,selection.has(l.id)?1:(l.opacity??1),lineFlags(l),l.coplanar?1:0,l.adjacent?.length||0,selection.has(l.id)?1:0,(i*0.61803398875)%1],at);at+=21;
    }
    return [surface, edges];
}
