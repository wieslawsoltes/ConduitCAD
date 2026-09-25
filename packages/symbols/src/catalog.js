import { clone, createDocument, entityGeometry } from '@conduitcad/model';
import { bounds } from '@conduitcad/geometry';
import { L, P, C, R, T, A, E, B, port, H, V, F, leads, diamond, triangle, arrow, spring, capsule, vessel, functionalBlock } from './primitives.js';
import { categoryDefinition } from './conventions.js';

const PI = Math.PI;
const sense = () => [port('sense', 0, -45, 0, -1, 'signal')];
const fourFlow = (w = 55, h = 35) => [port('in', 0, h, 0, 1), port('out', 0, -h, 0, -1), port('left', -w, 0, -1, 0), port('right', w, 0, 1, 0)];
const valve = () => [...leads(), P([[-25, -18], [0, 0], [-25, 18]], true), P([[25, -18], [0, 0], [25, 18]], true)];
const instrument = (code, location = 'field') => [C(0, 0, 26), ...(location === 'panel' ? [L(-26, 0, 26, 0)] : location === 'rear' ? [L(-26, 0, 26, 0, { dash: [4, 3] })] : []), T(0, location === 'field' ? -5 : 7, code, 12), L(0, -26, 0, -45)];
const strokeSpring = () => spring(0, 23, 24, 6, true);
const tubeLeads = (r = 26) => [...leads(r), L(0, r, 0, 45), L(0, -r, 0, -45)];

/** Upgrade only the catalogue. installSymbols deliberately never replaces saved masters. */
export function expandCatalog(legacy) {
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
