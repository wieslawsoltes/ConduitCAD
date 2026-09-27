import { V3, add3, sub3, mul3, unit3, bounds3, faceNormal, rotation3, multiply4, transform3 } from '@conduitcad/geometry3d';
import { curvePoints3, faceFrame3, facePoint3 } from '@conduitcad/modeling';
import { perpendicularAxes3, unitsPerPixel3 } from './gestures.js';
const AXES = [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)];
const COLORS = ['#b84336', '#26835d', '#377bc2'];
const center = points => { const b = bounds3(points); return mul3(add3(b.min, b.max), .5); };
/** Geometry-anchored dimensions and manipulators; the host handles hit targets, focus, and rendering. */
export function visualHandles3(session, camera, mode = 'dimensions') {
    if (session.closed) return [];
    let p; try { p = session.values(); } catch { return []; }
    const src = session.base.entities.find(e => e.id === session.inputs[0]), k = session.kind, out = [];
    const origin = V3(p.x || 0, p.y || 0, p.z || 0);
    const field = name => session.tool.fields.find(f => f.name === name)?.label || name.toUpperCase();
    const axis = (name, start, direction, length, { factor = 1, color = '#087f72', unit = 'length', label = field(name) } = {}) => {
        if (!Object.hasOwn(p, name)) return;
        direction = unit3(direction);
        out.push({ id: name, kind: 'axis', field: name, label, origin: start, axis: direction, point: add3(start, mul3(direction, length)), factor, color, unit, value: p[name] });
    };
    const plane = (id, start, u, v, names, label) => out.push({ id, kind: 'plane', fields: names, label, origin: start, point: start, u, v, color: '#087f72', unit: 'length' });
    const angle = (name, start, normal, radius) => {
        const { u, v } = perpendicularAxes3(normal), a = p[name] * Math.PI / 180;
        out.push({ id: name, kind: 'angle', field: name, label: field(name), origin: start, axis: normal, u, v, radius, point: add3(start, add3(mul3(u, radius * Math.cos(a)), mul3(v, radius * Math.sin(a)))), color: COLORS[['rx', 'ry', 'rz'].indexOf(name)] || '#8e59a2', unit: 'angle', value: p[name] });
    };
    const move = (start, fields) => {
        const length = Math.max(1e-6, unitsPerPixel3(camera, start) * 76);
        AXES.forEach((a, i) => axis(fields[i], start, a, length, { color: COLORS[i] }));
        plane('position', start, AXES[0], AXES[1], fields.slice(0, 2), 'Move on XY plane');
    };
    if (k === 'vertex') { move(origin, ['x', 'y', 'z']); return out; }
    if (!session.tool.inputs) {
        if (mode === 'move') { move(origin, ['x', 'y', 'z']); return out; }
        if (k === 'sketch-profile') {
            const u=p.plane===2?AXES[1]:AXES[0],v=p.plane===0?AXES[1]:AXES[2];
            if(p.shape)axis('radius',origin,u,p.radius);
            else {axis('width',origin,u,p.width/2,{factor:2});axis('height',origin,v,p.height/2,{factor:2,color:COLORS[2]});}
        } else if (k === 'box' || k === 'wedge') {
            axis('width', add3(origin, V3(0, p.depth / 2, p.height / 2)), AXES[0], p.width, { color: COLORS[0] });
            axis('depth', add3(origin, V3(p.width / 2, 0, p.height / 2)), AXES[1], p.depth, { color: COLORS[1] });
            axis('height', add3(origin, V3(p.width / 2, p.depth / 2, 0)), AXES[2], p.height, { color: COLORS[2] });
        } else if (['cylinder', 'cone', 'sphere'].includes(k)) {
            axis('radius', origin, AXES[0], p.radius, { color: COLORS[0] });
            if (k !== 'sphere') axis('height', origin, AXES[2], p.height, { color: COLORS[2] });
            if (k === 'cone') axis('topRadius', add3(origin, V3(0, 0, p.height)), AXES[0], p.topRadius);
        } else if (k === 'torus') {
            axis('major', origin, AXES[0], p.major);
            axis('minor', add3(origin, V3(p.major, 0, 0)), AXES[2], p.minor, { color: COLORS[2] });
        }
        return out;
    }
    if (!src) return [];
    if (k === 'extrude') {
        const points = curvePoints3(src, { closed: true }).points, c = center(points);
        const normal = p.useNormal ? unit3(src.extrusion || faceNormal(points, points.map((_, i) => i))) : unit3(V3(p.nx, p.ny, p.nz));
        const start = add3(c, mul3(normal, p.startOffset));
        axis('height', start, normal, p.extent === 1 ? p.height / 2 : p.height, { factor: p.extent === 1 ? 2 : 1 });
        if (p.extent === 2) axis('distance2', start, mul3(normal, -1), p.distance2, { color: '#377bc2' });
        axis('startOffset', c, normal, p.startOffset, { color: '#8e59a2' });
    } else if (['hole', 'face-profile', 'offset-face'].includes(k)) {
        const f = faceFrame3(src, p.face), c = facePoint3(f, p.u || 0, p.v || 0, p.offset || 0);
        if (k === 'offset-face') axis('distance', f.origin, f.normal, p.distance);
        else {
            plane('face-position', c, f.u, f.v, ['u', 'v'], 'Position on face');
            if (k === 'hole') {
                axis('diameter', c, f.u, p.diameter / 2, { factor: 2 });
                if (!p.through) axis('depth', c, mul3(f.normal, -1), p.depth, { color: COLORS[2] });
                if (p.holeType) axis('counterDiameter', c, f.v, p.counterDiameter / 2, { factor: 2, color: '#8e59a2' });
                if (p.holeType === 1) axis('counterDepth', add3(c, mul3(f.v, p.counterDiameter / 2)), mul3(f.normal, -1), p.counterDepth, { color: COLORS[2] });
            } else {
                if (p.shape) axis('radius', c, f.u, p.radius);
                else { axis('width', c, f.u, p.width / 2, { factor: 2 }); axis('height', c, f.v, p.height / 2, { factor: 2, color: COLORS[1] }); }
                axis('offset', f.origin, f.normal, p.offset, { color: COLORS[2] });
            }
        }
    } else if (k === 'transform') {
        const pivot = V3(p.px || 0, p.py || 0, p.pz || 0), c = add3(pivot, V3(p.dx, p.dy, p.dz));
        const length = Math.max(1e-6, unitsPerPixel3(camera, c) * 76);
        if (mode === 'rotate') {
            const z = rotation3(AXES[2], p.rz * Math.PI / 180), yz = multiply4(z, rotation3(AXES[1], p.ry * Math.PI / 180));
            [transform3(AXES[0], yz), transform3(AXES[1], z), AXES[2]].forEach((a, i) => angle(['rx', 'ry', 'rz'][i], c, a, length * (1 + i * .12)));
        } else if (mode === 'scale') {
            const b = bounds3(src.points), lengths = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map(v => Math.max(v / 2, length / 3));
            const rotation=multiply4(multiply4(rotation3(AXES[2],p.rz*Math.PI/180),rotation3(AXES[1],p.ry*Math.PI/180)),rotation3(AXES[0],p.rx*Math.PI/180));
            AXES.forEach((a, i) => axis(['sx', 'sy', 'sz'][i], c, transform3(a,rotation), lengths[i] * p[['sx', 'sy', 'sz'][i]], { factor: 1 / lengths[i], color: COLORS[i], unit: 'scale' }));
        } else move(c, ['dx', 'dy', 'dz']);
    } else if (k === 'linear-pattern') {
        const c = center(src.points); AXES.forEach((a, i) => axis(['dx', 'dy', 'dz'][i], c, a, p[['dx', 'dy', 'dz'][i]], { color: COLORS[i] }));
    } else if (k === 'revolve' || k === 'circular-pattern') {
        const c = V3(p.cx || 0, p.cy || 0, 0); angle('angle', c, AXES[2], Math.max(unitsPerPixel3(camera, c) * 88, 1e-6));
    } else if (k === 'mirror') axis('offset', V3(), AXES[p.axis] || AXES[0], p.offset);
    return out;
}
