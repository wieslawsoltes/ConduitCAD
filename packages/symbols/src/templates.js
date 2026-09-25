import { createDocument, line, text, polyline, ports, entityBounds, entityGeometry } from '@conduitcad/model';
import { routePorts } from '@conduitcad/routing';
import { bounds } from '@conduitcad/geometry';
const node = (id, symbol, x, y, tag, options = {}) => ({ id, symbol, x, y, tag, ...options });
const link = (from, to, style, label = '', waypoints = []) => ({ from, to, style, label, waypoints });
const row = (items, y = 350) => items.map(([symbol, tag], i) => node(`n${i}`, symbol, 130 + i * 190, y, tag));
const chain = (count, style) => Array.from({ length: count - 1 }, (_, i) => link(`n${i}.out`, `n${i + 1}.in`, style));
const definitions = [];
function profile(id, name, industry, drawingType, categories, standardRefs, description, nodes = [], connections = [], defaultLineStyle = 'process') {
    const value = { id, name, industry, drawingType, categories, standardRefs, description, nodes, connections, defaultLineStyle };
    definitions.push(value);
    return value;
}
profile('pid', 'Process water skid', 'Process engineering', 'Piping & instrumentation', ['P&ID', 'Instrumentation'], ['ISO-10628-2', 'ISA-5.1'], 'Existing editable process-water P&ID example.');
profile('electrical', 'Motor control circuit', 'Electrical engineering', 'Electrical schematic', ['Electrical'], ['IEC-60617'], 'Existing component and wire example.', [], [], 'electrical');
profile('flow', 'Commissioning workflow', 'Manufacturing & quality', 'Flowchart', ['Flow'], ['ISO-5807'], 'Existing inspection, decision and rework workflow.', [], [], 'workflow');
profile('water-treatment', 'Water treatment train', 'Water & wastewater', 'Treatment process flow', ['Water', 'P&ID'], ['ISO-10628-2', 'PROJECT'], 'Screening, pressure, membrane separation and disinfection with a reject outlet.',
    [...row([['water-screen', 'SC-101'], ['pump', 'P-101'], ['water-ro', 'RO-101'], ['water-uv', 'UV-101'], ['water-meter', 'WM-101']]), node('waste', 'water-sump', 510, 160, 'REJECT')],
    [...chain(5, 'water'), link('n2.reject', 'waste.in', 'wastewater', 'CONCENTRATE')], 'water');
profile('chemical-batch', 'Batch reactor and heat transfer', 'Chemical & petrochemical', 'Piping & instrumentation', ['P&ID', 'Instrumentation'], ['ISO-10628-2', 'ISA-5.1'], 'Agitated vessel, control valve, circulation pump and exchanger. Process values require engineering.',
    [node('feed', 'gate-valve', 130, 360, 'HV-101'), node('reactor', 'mixer', 360, 360, 'R-101'), node('cv', 'control-valve', 600, 360, 'TCV-101'), node('hx', 'plate-exchanger', 860, 360, 'E-101'), node('pump', 'pump', 600, 160, 'P-101'), node('tt', 'temperature-controller', 600, 490, 'TIC-101')],
    [link('feed.out', 'reactor.in', 'process'), link('reactor.out', 'cv.in', 'process'), link('cv.out', 'hx.in', 'process'), link('hx.out', 'pump.in', 'process'), link('pump.out', 'reactor.bottom', 'process'), link('tt.sense', 'cv.signal', 'signal')]);
profile('oil-gas', 'Separation and metering', 'Oil & gas', 'Process flow diagram', ['P&ID', 'Instrumentation'], ['ISO-10628-2'], 'Separator, metering and outlet isolation with a liquid draw-off.',
    [node('feed', 'gate-valve', 130, 350, 'XV-101'), node('sep', 'vessel', 370, 350, 'V-101'), node('meter', 'orifice-plate', 620, 350, 'FE-101'), node('out', 'control-valve', 860, 350, 'PCV-101'), node('drain', 'ball-valve', 370, 150, 'LV-101'), node('pt', 'pressure-transmitter', 620, 490, 'PT-101')],
    [link('feed.out', 'sep.in', 'process'), link('sep.out', 'meter.in', 'process'), link('meter.out', 'out.in', 'process'), link('sep.bottom', 'drain.in', 'drain'), link('pt.sense', 'out.signal', 'signal')]);
profile('food-beverage', 'Product transfer and heating', 'Food & beverage', 'Process flow diagram', ['P&ID', 'Water'], ['ISO-10628-2', 'PROJECT'], 'Storage, pumping, heat exchange and sample point; hygienic design is not inferred from the symbol.',
    row([['tank', 'TK-101'], ['pump', 'P-101'], ['plate-exchanger', 'HX-101'], ['sampling-point', 'SP-101'], ['diaphragm-valve', 'DV-101']]), chain(5, 'process'));
profile('pharmaceutical', 'Purified water treatment', 'Pharmaceutical & biotech', 'Utility process schematic', ['Water', 'P&ID'], ['ISO-10628-2', 'PROJECT'], 'Ion exchange, membrane separation and UV equipment; not a validated pharmaceutical system.',
    row([['water-softener', 'IX-101'], ['pump', 'P-101'], ['water-ro', 'RO-101'], ['water-uv', 'UV-101'], ['water-meter', 'WM-101']]), chain(5, 'water'), 'water');
profile('power-single-line', 'Power distribution single-line', 'Power & energy', 'Single-line diagram', ['Electrical'], ['IEC-60617'], 'Source, breaker, transformer, measurement and load with explicit single-line symbols.',
    row([['generator', 'G1'], ['circuit-breaker', 'Q1'], ['transformer', 'T1'], ['ammeter', 'A1'], ['three-phase-motor', 'M1']]), chain(5, 'power'), 'power');
profile('solar', 'Solar power conversion', 'Renewable energy', 'Power conversion schematic', ['Electrical'], ['IEC-60617', 'PROJECT'], 'Photovoltaic generation, DC isolation, inverter and AC protection.',
    row([['pv-module', 'PV1'], ['disconnect', 'QS1'], ['inverter', 'INV1'], ['circuit-breaker', 'QF1'], ['ac-source', 'GRID']]),
    [link('n0.out', 'n1.in', 'electrical', 'DC'), link('n1.out', 'n2.in', 'electrical', 'DC'), link('n2.out', 'n3.in', 'power', 'AC'), link('n3.out', 'n4.in', 'power', 'AC')], 'power');
profile('hvac-air', 'Air handling system', 'Building services', 'Air-system schematic', ['HVAC'], ['PROJECT'], 'Filter, heating and cooling coils, fan and controlled air outlet.',
    row([['hvac-filter', 'F-101'], ['hvac-heating-coil', 'HC-101'], ['hvac-cooling-coil', 'CC-101'], ['hvac-fan', 'SF-101'], ['hvac-motor-damper', 'MD-101']]), chain(5, 'air'), 'air');
profile('hvac-hydronic', 'Hydronic heating circuit', 'Building services', 'Hydronic schematic', ['HVAC', 'P&ID'], ['PROJECT'], 'Boiler circulation, radiator, isolation and expansion connection.',
    [node('boiler', 'hvac-boiler', 150, 350, 'B-101'), node('pump', 'pump', 390, 350, 'P-101'), node('valve', 'control-valve', 630, 350, 'CV-101'), node('load', 'hvac-radiator', 870, 350, 'RAD-101'), node('exp', 'hvac-expansion-vessel', 390, 480, 'EV-101')],
    [link('boiler.out', 'pump.in', 'water'), link('pump.out', 'valve.in', 'water'), link('valve.out', 'load.in', 'water'), link('load.out', 'boiler.in', 'return', '', [{ x: 1020, y: 130 }, { x: 60, y: 130 }]), link('pump.top', 'exp.water', 'water')], 'water');
profile('hydraulic-actuator', 'Hydraulic actuator circuit', 'Industrial machinery', 'Fluid-power circuit', ['Hydraulics'], ['ISO-1219-1'], 'Pump, relief valve, reservoir and closed-centre directional valve driving a double-acting cylinder.',
    [node('tank', 'hyd-reservoir', 150, 140, 'TK-1'), node('pump', 'hyd-pump', 150, 350, 'P-1'), node('spool', 'hyd-valve-43', 570, 280, 'V-1'), node('cyl', 'hyd-cylinder', 570, 470, 'A-1'), node('relief', 'hyd-relief', 330, 160, 'RV-1')],
    [link('tank.suction', 'pump.in', 'hydraulic'), link('pump.out', 'spool.P', 'hydraulic'), link('spool.A', 'cyl.A', 'hydraulic'), link('spool.B', 'cyl.B', 'hydraulic'), link('spool.T', 'tank.return', 'hyd-return', '', [{ x: 760, y: 90 }, { x: 210, y: 90 }]), link('pump.out', 'relief.in', 'hydraulic'), link('relief.out', 'tank.return', 'hyd-return')], 'hydraulic');
profile('pneumatic-clamp', 'Pneumatic spring-return actuator', 'Industrial machinery', 'Pneumatic circuit', ['Pneumatics'], ['ISO-1219-1'], 'Air preparation, 3/2 valve with spring-rest exhaust, cylinder and exhaust silencer.',
    [node('source', 'pneu-compressor', 120, 300, 'AIR'), node('filter', 'pneu-filter', 310, 300, 'F1'), node('reg', 'pneu-regulator', 500, 300, 'PR1'), node('spool', 'pneu-valve-32', 760, 280, 'V1'), node('cyl', 'pneu-cylinder-spring', 760, 470, 'A1'), node('silencer', 'pneu-silencer', 930, 130, 'EXH')],
    [link('source.out', 'filter.in', 'air-power'), link('filter.out', 'reg.in', 'air-power'), link('reg.out', 'spool.P', 'air-power'), link('spool.A', 'cyl.A', 'air-power'), link('spool.R', 'silencer.exhaust', 'air-power')], 'air-power');
profile('instrument-loop', 'Flow-control loop', 'Process automation', 'Instrument functional loop', ['Instrumentation', 'P&ID'], ['ISA-5.1', 'PROJECT'], 'Field transmitter, controller, current-to-pressure converter and valve actuator.',
    [node('ft', 'flow-transmitter', 150, 420, 'FT-101'), node('fic', 'flow-controller-panel', 390, 420, 'FIC-101'), node('ip', 'ip-converter', 630, 300, 'FY-101'), node('cv', 'control-valve', 880, 300, 'FCV-101')],
    [link('ft.sense', 'fic.sense', 'signal', '4–20 mA', [{ x: 150, y: 300 }, { x: 390, y: 300 }]), link('fic.sense', 'ip.in', 'signal'), link('ip.out', 'cv.signal', 'pneumatic', 'AIR')], 'signal');
profile('automation-io', 'Automation I/O architecture', 'Process automation', 'Control architecture', ['Automation', 'Electrical', 'Network'], ['PROJECT'], 'Sensor, I/O, PLC and drive function chain; signal topology, not a power wiring diagram.',
    [...row([['auto-proximity', 'B1'], ['auto-di', 'DI1'], ['auto-plc', 'PLC1'], ['auto-ao', 'AO1'], ['auto-vfd', 'VFD1']]), node('hmi', 'auto-hmi', 510, 490, 'HMI1')],
    [...chain(5, 'signal'), link('hmi.in', 'n2.in', 'data')], 'signal');
profile('fire-alarm', 'Fire-alarm topology', 'Fire protection', 'Alarm-system topology', ['Fire'], ['PROJECT'], 'Panel, detection, call point and alarm devices. Functional diagram, not fire signage or compliance design.',
    row([['fire-panel', 'FACP1'], ['fire-smoke', 'SD1'], ['fire-heat', 'HD1'], ['fire-call', 'MCP1'], ['fire-sounder', 'SND1']]), chain(5, 'alarm'), 'alarm');
profile('network', 'Industrial network topology', 'IT & telecom', 'Network topology', ['Network', 'Automation'], ['PROJECT'], 'WAN, perimeter firewall, switch and server with a wireless branch.',
    [...row([['net-cloud', 'WAN'], ['net-router', 'R1'], ['net-firewall', 'FW1'], ['net-switch', 'SW1'], ['net-server', 'SRV1']]), node('ap', 'net-ap', 700, 140, 'AP1')],
    [...chain(5, 'data'), link('n3.branch', 'ap.in', 'data', 'LAN')], 'data');
profile('plumbing', 'Building-water supply', 'Building services', 'Water distribution schematic', ['Water', 'P&ID'], ['PROJECT'], 'Metering, backflow protection, isolation, heater and draw-off point.',
    [...row([['water-meter', 'WM1'], ['water-backflow', 'BFP1'], ['gate-valve', 'HV1'], ['water-heater', 'WH1']]), node('tap', 'water-tap', 890, 350, 'TAP1')],
    [...chain(4, 'water'), link('n3.out', 'tap.supply', 'hot-water')], 'water');
profile('quality-workflow', 'Manufacturing release workflow', 'Manufacturing & quality', 'Information flowchart', ['Flow'], ['ISO-5807'], 'Preparation, controlled operation, inspection decision and record storage.',
    [node('prep', 'preparation', 140, 390, 'SETUP'), node('manual', 'manual-operation', 370, 390, 'OPERATE'), node('dec', 'decision', 620, 390, 'PASS?'), node('store', 'internal-storage', 880, 390, 'RECORD'), node('reject', 'document', 620, 170, 'NCR')],
    [link('prep.right', 'manual.left', 'workflow'), link('manual.right', 'dec.no', 'workflow'), link('dec.yes', 'store.left', 'workflow', 'YES'), link('dec.out', 'reject.in', 'workflow', 'NO')], 'workflow');
export const DRAWING_TYPES = definitions;

/** Build actual CAD entities and attached, obstacle-routed connectors, not a thumbnail mockup. */
export function buildTemplate(id, installSymbols, insertSymbol, styles) {
    const definition = DRAWING_TYPES.find(d => d.id === id);
    if (!definition?.nodes.length) throw new Error(`Unknown industry drawing type: ${id}`);
    const doc = installSymbols(createDocument(definition.name));
    doc.metadata = { ...doc.metadata, description: definition.description, industry: definition.industry, drawingType: definition.drawingType, templateId: id, standardRefs: [...definition.standardRefs], geometryRevision: 3, approval: 'Concept schematic; engineering approval required' };
    const nodes = new Map();
    for (const n of definition.nodes) {
        const e = insertSymbol(doc, n.symbol, n.x, n.y, { tag: n.tag, ...(n.rotation ? { rotation: n.rotation } : {}) });
        doc.entities.push(e); nodes.set(n.id, e);
    }
    const obstacles = [...nodes.values()].map(e => ({ ...bounds(entityGeometry(e, doc, { tolerance: .1 }).paths.flatMap(p => p.points)), id: e.id }));
    const terminal = address => {
        const separator = address.indexOf('.'), id = address.slice(0, separator), name = address.slice(separator + 1), e = nodes.get(id);
        const p = e && ports(e, doc).find(p => p.name === name);
        if (!p) throw new Error(`Template ${definition.id} has no terminal ${address}`);
        return { ...p, entityId: e.id };
    };
    for (const c of definition.connections) {
        const a = terminal(c.from), b = terminal(c.to), style = styles.find(s => s.id === c.style);
        if (!style) throw new Error(`Unknown line style ${c.style}`);
        const routing = routePorts(a, b, obstacles, { clearance: 8, lead: 18, waypoints: c.waypoints });
        if (routing.status !== 'routed') throw new Error(`Template ${id} has a blocked connection: ${c.from} to ${c.to}`);
        doc.entities.push(polyline(routing.points, false, { layer: style.layer, color: style.color, width: style.width, dash: [...style.dash], label: c.label, connector: { from: { entityId: a.entityId, port: a.name }, to: { entityId: b.entityId, port: b.name }, style: style.id, arrow: style.arrow, waypoints: c.waypoints.map(p => ({ ...p })), status: routing.status } }));
    }
    const annotation = (x, y, value, height = 12) => text({ x, y }, value, height, { layer: 'Annotations' });
    doc.entities.push(annotation(40, 620, definition.name, 27), annotation(40, 584, `${definition.industry}  /  ${definition.drawingType}`, 13), line({ x: 40, y: 562 }, { x: 1120, y: 562 }, { layer: 'Annotations' }), annotation(40, 42, 'CONCEPT SCHEMATIC — NOT FOR CONSTRUCTION', 11), annotation(650, 42, `${id.toUpperCase()}  |  REV 03  |  mm`, 11));
    return doc;
}
