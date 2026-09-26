import { V3 } from '@conduitcad/geometry3d';
import { createDocument, entity, polyline, circle, text } from '@conduitcad/model';
import { addFeature, regenerateFeatures } from './features.js';
export const EXAMPLES_3D = [
    { id: 'bracket', name: 'Mounting bracket', industry: 'Mechanical design', description: 'L-shaped bracket with a patterned through-hole cut. Edit Width, Thickness and HoleRadius.', operations: ['box', 'union', 'cylinder', 'linear-pattern', 'subtract'] },
    { id: 'flange', name: 'Four-bolt flange', industry: 'Piping & equipment', description: 'Revolved annular hub with a circular bolt-hole pattern and native mesh Boolean cut.', operations: ['revolve', 'cylinder', 'circular-pattern', 'subtract'] },
    { id: 'vessel', name: 'Process vessel', industry: 'Process engineering', description: 'Revolved vessel, support legs and nozzle bodies. A concept model, not a pressure-vessel design.', operations: ['revolve', 'cylinder', 'linear-pattern'] },
    { id: 'transition', name: 'Rectangular-to-round transition', industry: 'HVAC', description: 'Two editable native profiles drive a resampled faceted loft. Inspect source profiles in 2D.', operations: ['loft'] },
    { id: 'conduit', name: 'Spatial conduit sweep', industry: 'Electrical installation', description: 'Circular profile swept along a native 3D polyline using transported frames.', operations: ['sweep'] },
    { id: 'fixture', name: 'Parametric fixture grid', industry: 'Manufacturing', description: 'Two nested linear patterns build a fixture array over a parameter-driven base plate.', operations: ['box', 'cylinder', 'linear-pattern'] },
    { id: 'shaft', name: 'Stepped shaft', industry: 'Rotating machinery', description: 'A closed radius/height sketch creates a turned profile. Change the revolve angle for inspection.', operations: ['revolve'] },
    { id: 'enclosure', name: 'Ventilated enclosure', industry: 'Automation & controls', description: 'Hollow enclosure built by subtractive operations with a patterned side ventilation cut.', operations: ['box', 'subtract', 'linear-pattern'] },
    { id: 'manifold', name: 'Pipe manifold concept', industry: 'Water & utilities', description: 'Hollow pipe and branch meshes with exact spatial transforms; separate bodies remain independently editable.', operations: ['cylinder', 'subtract', 'transform', 'linear-pattern'] },
    { id: 'primitives', name: '3D modeling playground', industry: 'Learning', description: 'Six editable primitive features plus a 2D reference outline. Try face selection, XYZ edits and section analysis.', operations: ['box', 'cylinder', 'cone', 'sphere', 'torus', 'wedge'] }
];
export function create3DExample(id) {
    const spec = EXAMPLES_3D.find(s => s.id === id);
    if (!spec)
        throw new Error('Unknown 3D drawing example');
    const d = createDocument(spec.name);
    d.parameters = { grid: '10' };
    d.metadata = { description: spec.description, modeling: { version: 1, preferredMode: '3d', example: id, notes: 'Editable faceted concept model. Not certified or construction-approved.' } };
    const feature = (kind, parameters = {}, inputs = [], name, color) => addFeature(d, kind, parameters, inputs.map(e => typeof e === 'string' ? e : e.id), { name, color });
    const profile = (name, points, closed = true, spatial = false) => { const e = spatial ? entity('POLYLINE', { points, closed, flags: 8 }) : polyline(points, closed); e.label = name; e.layer = 'Annotations'; d.entities.push(e); return e; };
    const round = (name, r, p = V3()) => { const e = circle(p, r, { layer: 'Annotations', label: name }); d.entities.push(e); return e; };
    if (id === 'bracket') {
        Object.assign(d.parameters, { Width: '100', Depth: '65', Thickness: '8', Rise: '65', HoleRadius: '6' });
        const foot = feature('box', { width: 'Width', depth: 'Depth', height: 'Thickness' }, [], 'Foot plate');
        const back = feature('box', { width: 'Width', depth: 'Thickness', height: 'Rise', y: 'Depth-Thickness' }, [], 'Upright');
        const blank = feature('union', {}, [foot, back], 'Bracket blank');
        const tool = feature('cylinder', { radius: 'HoleRadius', height: 'Thickness+2', segments: 24, x: 'Width/4', y: 'Depth/2', z: -1 }, [], 'Through-hole tool');
        const holes = feature('linear-pattern', { count: 2, dx: 'Width/2' }, [tool], 'Two holes');
        feature('subtract', {}, [blank, holes], 'Finished bracket', '#527f9e');
    }
    else if (id === 'flange') {
        const p = profile('Hub radius / height sketch', [V3(12, 0), V3(45, 0), V3(45, 12), V3(23, 12), V3(23, 38), V3(12, 38)]);
        const hub = feature('revolve', { angle: 360, segments: 40 }, [p], 'Annular hub');
        const tool = feature('cylinder', { radius: 4, height: 16, segments: 16, x: 33, z: -2 }, [], 'Bolt drill');
        const pattern = feature('circular-pattern', { count: 4 }, [tool], 'Bolt circle');
        feature('subtract', {}, [hub, pattern], 'Flanged hub', '#658890');
    }
    else if (id === 'vessel') {
        d.parameters.NozzleHeight = '100';
        const p = profile('Vessel silhouette', [V3(0, 25), V3(23, 25), V3(42, 45), V3(42, 155), V3(22, 178), V3(12, 178), V3(12, 195), V3(0, 195)]);
        feature('revolve', { segments: 48 }, [p], 'Vessel body', '#8aa5ad');
        const leg = feature('cylinder', { radius: 5, height: 40, x: -23, y: -23, segments: 16 }, [], 'Support leg', '#74889b');
        const row = feature('linear-pattern', { count: 2, dx: 46 }, [leg], 'Leg row');
        feature('linear-pattern', { count: 2, dx: 0, dy: 46 }, [row], 'Four supports');
        const nozzle = feature('cylinder', { radius: 9, height: 40, segments: 24 }, [], 'Nozzle');
        feature('transform', { ry: 90, dx: 35, dz: 'NozzleHeight' }, [nozzle], 'Side nozzle', '#d49852');
    }
    else if (id === 'transition') {
        const a = profile('Rectangular inlet', [V3(-65, -45), V3(65, -45), V3(65, 45), V3(-65, 45)]), b = round('Round outlet', 35, V3(25, 15, 115));
        feature('loft', { samples: 48 }, [a, b], 'Transition duct', '#729a9d');
    }
    else if (id === 'conduit') {
        const a = round('Conduit section', 7), path = profile('3D route', [V3(0, 0, 0), V3(0, 0, 35), V3(20, 0, 60), V3(50, 15, 85), V3(100, 40, 85), V3(150, 40, 85)], false, true);
        feature('sweep', {}, [a, path], 'Routed conduit', '#c99149');
    }
    else if (id === 'fixture') {
        Object.assign(d.parameters, { PitchX: '45', PitchY: '40', Rows: '3', Columns: '4', PinHeight: '25' });
        feature('box', { width: 'PitchX*(Columns-1)+40', depth: 'PitchY*(Rows-1)+40', height: 10 }, [], 'Fixture base', '#65868e');
        const pin = feature('cylinder', { radius: 7, height: 'PinHeight', x: 20, y: 20, z: 10, segments: 20 }, [], 'Locating pin', '#d99f52'), row = feature('linear-pattern', { count: 'Columns', dx: 'PitchX' }, [pin], 'Column pattern');
        feature('linear-pattern', { count: 'Rows', dx: 0, dy: 'PitchY' }, [row], 'Row pattern', '#d99f52');
    }
    else if (id === 'shaft') {
        const p = profile('Turned outline', [V3(0, 0), V3(14, 0), V3(14, 25), V3(22, 25), V3(22, 45), V3(17, 45), V3(17, 105), V3(11, 105), V3(11, 145), V3(0, 145)]);
        feature('revolve', { segments: 56 }, [p], 'Stepped shaft', '#6e94a8');
    }
    else if (id === 'enclosure') {
        Object.assign(d.parameters, { Width: '120', Depth: '90', Height: '55', Wall: '4' });
        const outer = feature('box', { width: 'Width', depth: 'Depth', height: 'Height' }, [], 'Outer stock'), inner = feature('box', { width: 'Width-2*Wall', depth: 'Depth-2*Wall', height: 'Height', x: 'Wall', y: 'Wall', z: 'Wall' }, [], 'Cavity tool'), shell = feature('subtract', {}, [outer, inner], 'Open enclosure');
        const slot = feature('box', { width: 7, depth: 'Wall+2', height: 20, x: 15, y: -1, z: 20 }, [], 'Vent tool'), vents = feature('linear-pattern', { count: 7, dx: 14 }, [slot], 'Vent pattern');
        feature('subtract', {}, [shell, vents], 'Ventilated enclosure', '#73988e');
    }
    else if (id === 'manifold') {
        const outer = feature('cylinder', { radius: 15, height: 160, segments: 32 }, [], 'Main pipe outer'), inner = feature('cylinder', { radius: 11, height: 162, z: -1, segments: 32 }, [], 'Main pipe bore'), pipe = feature('subtract', {}, [outer, inner], 'Hollow main pipe');
        feature('transform', { ry: 90, dz: 35 }, [pipe], 'Horizontal header', '#6e969f');
        const a = feature('cylinder', { radius: 10, height: 70, x: 25, z: 35, segments: 24 }, [], 'Branch outer'), b = feature('cylinder', { radius: 7, height: 72, x: 25, z: 34, segments: 24 }, [], 'Branch bore'), branch = feature('subtract', {}, [a, b], 'Hollow branch');
        feature('linear-pattern', { count: 3, dx: 55 }, [branch], 'Branch array', '#d19b53');
    }
    else {
        feature('box', { width: 60, depth: 45, height: 40 }, [], 'Box', '#568991');
        feature('cylinder', { radius: 25, height: 60, x: 115 }, [], 'Cylinder', '#b08b58');
        feature('cone', { radius: 28, height: 70, x: 210 }, [], 'Cone', '#71998b');
        feature('sphere', { radius: 28, x: 30, y: 110, z: 30 }, [], 'Sphere', '#8792b0');
        feature('torus', { major: 30, minor: 9, x: 120, y: 110, z: 15 }, [], 'Torus', '#5c98a2');
        feature('wedge', { width: 60, depth: 40, height: 45, x: 190, y: 95 }, [], 'Wedge', '#b68d6b');
        profile('2D reference boundary', [V3(-15, -40), V3(250, -40), V3(250, 160), V3(-15, 160)]);
    }
    regenerateFeatures(d);
    // Stable fixture IDs make native DXF + JSON sample generation reproducible.
    const ids = new Map(d.entities.map((e, i) => [e.id, `3d-${id}-${String(i + 1).padStart(3, '0')}`]));
    for (const e of d.entities) {
        e.id = ids.get(e.id);
        if (e.feature3d)
            e.feature3d.inputs = e.feature3d.inputs.map(id => ids.get(id));
    }
    return d;
}
