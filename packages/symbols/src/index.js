import { line, polyline, circle, rect, text, entity, uid, clone, createDocument, ports, entityBounds } from '@conduitcad/model';
import { arcPoints, TAU } from '@conduitcad/geometry';
const p = (x, y) => ({ x, y }), L = (x1, y1, x2, y2) => line(p(x1, y1), p(x2, y2)), P = (points, closed = false) => polyline(points.map(([x, y]) => p(x, y)), closed), C = (x, y, r) => circle(p(x, y), r), R = (x, y, w, h) => rect(x, y, w, h), T = (x, y, s, h = 15) => text(p(x, y), s, h, { align: 'center' });
const horizontal = [{ name: 'in', x: -45, y: 0, dx: -1, dy: 0 }, { name: 'out', x: 45, y: 0, dx: 1, dy: 0 }];
const four = [...horizontal, { name: 'top', x: 0, y: 45, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -45, dx: 0, dy: -1 }];
const lead = [L(-45, 0, -25, 0), L(25, 0, 45, 0)];
const valve = [...lead, P([[-25,-18],[0,0],[-25,18]],true), P([[25,-18],[0,0],[25,18]],true)];
const symbols = [];
function def(id, name, category, geometry, ports = horizontal, extra = {}) { const symbol = { id, name, category, block: `CC_${id.toUpperCase().replace(/-/g, '_')}`, entities: geometry, ports, base: p(0, 0), symbol: { name, category, labelOffset: 57, geometryRevision: 2, convention: category === 'Electrical' ? 'IEC/ANSI functional drafting conventions' : category === 'P&ID' ? 'Process and instrumentation drafting conventions' : 'Flowchart conventions', conformity: 'Original master; not standards-certified', ...extra } }; symbols.push(symbol); return symbol; }
def('gate-valve', 'Gate valve', 'P&ID', valve);
def('ball-valve', 'Ball valve', 'P&ID', [...lead, C(0, 0, 21), L(-15, -15, 15, 15)]);
def('globe-valve', 'Globe valve', 'P&ID', [...valve, C(0, 0, 7)]);
def('butterfly-valve', 'Butterfly valve', 'P&ID', [...lead, C(0, 0, 23), L(-16, -16, 16, 16), C(0, 0, 3)]);
def('check-valve', 'Check valve', 'P&ID', [...lead, P([[-22, -18], [18, 0], [-22, 18]], true), L(21, -22, 21, 22)]);
def('control-valve', 'Control valve', 'P&ID', [...valve, L(0, 0, 0, 35), P([[-22, 35], [-18, 44], [0, 50], [18, 44], [22, 35]], true)], [...horizontal, { name: 'signal', x: 0, y: 50, dx: 0, dy: 1 }]);
def('solenoid-valve', 'Solenoid valve', 'P&ID', [...valve, L(0, 0, 0, 35), R(-12, 35, 24, 20), T(0, 38, 'S', 13)]);
def('relief-valve', 'Relief valve', 'P&ID', [...valve, L(0, 0, 0, 22), P([[0, 22], [-9, 26], [9, 31], [-9, 36], [9, 41], [0, 45]]), L(-15, 48, 15, 48)]);
def('three-way-valve', 'Three-way valve', 'P&ID', [...valve, P([[-18, -25], [18, -25], [0, 0]], true), L(0, -25, 0, -45)], [...horizontal, { name: 'branch', x: 0, y: -45, dx: 0, dy: -1 }]);
def('pump', 'Centrifugal pump', 'P&ID', [...lead, C(0, 0, 27), P([[-15, -18], [23, 0], [-15, 18]], true), L(-22, -31, 22, -31)], four);
def('gear-pump', 'Gear pump', 'P&ID', [...lead, C(0, 0, 28), C(-9, 0, 11), C(9, 0, 11)], four);
def('compressor', 'Compressor', 'P&ID', [...lead, C(0, 0, 29), P([[-17, -20], [18, -10], [18, 10], [-17, 20]], true)], four);
def('fan', 'Fan / blower', 'P&ID', [...lead, C(0, 0, 29), C(0, 0, 6), P([[0, 6], [-16, 19], [-25, 5], [0, 0]]), P([[5, -3], [23, 9], [18, -17], [0, 0]]), P([[-4, -4], [-8, -24], [12, -22], [0, 0]])]);
def('strainer', 'Y strainer', 'P&ID', [...lead, R(-22, -15, 44, 30), L(-17, -12, 17, 12), P([[-8, -15], [5, -37], [18, -30], [12, -15]])]);
def('filter', 'Inline filter', 'P&ID', [...lead, R(-25, -28, 50, 56), L(-25, -28, 25, 28), L(-25, 28, 25, -28)], four);
def('heat-exchanger', 'Heat exchanger', 'P&ID', [...lead, C(0, 0, 33), P([[-32, 0], [-17, 15], [-5, -15], [8, 15], [21, -15], [33, 0]]), L(0, 33, 0, 45), L(0, -33, 0, -45)], four);
def('tank', 'Storage tank', 'P&ID', [L(-35, -43, -35, 40), L(35, -43, 35, 40), P(arcPoints(p(0, 40), 35, 0, Math.PI, .3).map(a => [a.x, a.y])), P(arcPoints(p(0, -43), 35, Math.PI, TAU, .3).map(a => [a.x, a.y])), L(-45, 0, -35, 0), L(35, 0, 45, 0), L(0, -78, 0, -88)], [...horizontal, { name: 'top', x: 0, y: 75, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -88, dx: 0, dy: -1 }], { labelOffset: 112 });
def('vessel', 'Pressure vessel', 'P&ID', [R(-27, -50, 54, 100), L(-15, -50, -15, -65), L(15, -50, 15, -65), L(-45, 0, -27, 0), L(27, 0, 45, 0), L(0, 50, 0, 65)], [...horizontal, { name: 'top', x: 0, y: 65, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -50, dx: 0, dy: -1 }], { labelOffset: 83 });
def('mixer', 'Agitated vessel', 'P&ID', [R(-32, -45, 64, 90), L(0, 45, 0, 65), R(-12, 65, 24, 18), L(0, 45, 0, -22), L(-23, -12, 23, -28), L(-45, 0, -32, 0), L(32, 0, 45, 0)], four, { labelOffset: 66 });
def('pressure-indicator', 'Pressure indicator', 'P&ID', [C(0, 0, 26), T(0, -5, 'PI'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('flow-transmitter', 'Flow transmitter', 'P&ID', [C(0, 0, 26), T(0, -5, 'FT'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('temperature', 'Temperature sensor', 'P&ID', [C(0, 0, 26), T(0, -5, 'TT'), L(0, -26, 0, -45)], [{ name: 'sense', x: 0, y: -45, dx: 0, dy: -1 }], { labelOffset: 65 });
def('level-transmitter', 'Level transmitter', 'P&ID', [C(0, 0, 26), T(0, -5, 'LT'), L(-26, 0, -45, 0)], [{ name: 'sense', x: -45, y: 0, dx: -1, dy: 0 }]);
def('reducer', 'Concentric reducer', 'P&ID', [L(-45, 0, -28, 0), P([[-28, -20], [25, -10], [25, 10], [-28, 20]], true), L(25, 0, 45, 0)]);
def('flange', 'Flanged joint', 'P&ID', [L(-45, 0, -5, 0), L(5, 0, 45, 0), L(-5, -23, -5, 23), L(5, -23, 5, 23)]);
def('offpage', 'Off-page connector', 'P&ID', [P([[-40, -17], [24, -17], [44, 0], [24, 17], [-40, 17]], true), T(-4, -5, 'PW', 13)]);
// Original electrical drafting masters; names describe function, not standards certification.
def('resistor', 'Resistor', 'Electrical', [...lead, P([[-25, 0], [-19, 12], [-10, -12], [0, 12], [10, -12], [19, 12], [25, 0]])]);
def('resistor-iec', 'Resistor · rectangular', 'Electrical', [...lead, R(-25, -11, 50, 22)]);
def('capacitor', 'Capacitor', 'Electrical', [L(-45, 0, -6, 0), L(6, 0, 45, 0), L(-6, -25, -6, 25), L(6, -25, 6, 25)]);
def('inductor', 'Inductor', 'Electrical', [L(-45, 0, -30, 0), L(30, 0, 45, 0), ...[-22.5, -7.5, 7.5, 22.5].map(x => P(arcPoints(p(x, 0), 7.5, Math.PI, 0, .2, true).map(p => [p.x, p.y])))]);
def('diode', 'Diode', 'Electrical', [...lead, P([[-22, -22], [20, 0], [-22, 22]], true), L(22, -24, 22, 24)]);
def('led', 'LED', 'Electrical', [...lead, P([[-22, -22], [20, 0], [-22, 22]], true), L(22, -24, 22, 24), P([[4, 27], [21, 44], [14, 42]]), P([[18, 22], [35, 39], [28, 37]])]);
def('switch', 'Switch · normally open', 'Electrical', [L(-45, 0, -23, 0), L(23, 0, 45, 0), C(-22, 0, 3), C(22, 0, 3), L(-20, 2, 19, 26)]);
def('switch-nc', 'Switch · normally closed', 'Electrical', [L(-45, 0, -23, 0), L(23, 0, 45, 0), C(-22, 0, 3), C(22, 0, 3), L(-20, 2, 21, 2), L(0, 2, 0, 23)]);
def('fuse', 'Fuse', 'Electrical', [L(-45, 0, 45, 0), R(-24, -10, 48, 20)]);
def('relay', 'Relay coil', 'Electrical', [...lead, R(-25, -22, 50, 44), L(-20, -18, 20, 18)]);
def('motor', 'Motor', 'Electrical', [...lead, C(0, 0, 29), T(0, -7, 'M', 22)], four);
def('generator', 'Generator', 'Electrical', [...lead, C(0, 0, 29), T(0, -7, 'G', 22)], four);
def('transformer', 'Transformer', 'Electrical', [L(-45, 0, -27, 0), L(27, 0, 45, 0), C(-14, 0, 18), C(14, 0, 18), L(-3, -28, -3, 28), L(3, -28, 3, 28)]);
def('ground', 'Protective earth', 'Electrical', [L(0, 40, 0, 5), L(-26, 5, 26, 5), L(-17, -5, 17, -5), L(-8, -15, 8, -15)], [{ name: 'terminal', x: 0, y: 40, dx: 0, dy: 1 }]);
def('battery', 'Battery', 'Electrical', [L(-45, 0, -18, 0), L(18, 0, 45, 0), L(-18, -24, -18, 24), L(-6, -12, -6, 12), L(6, -24, 6, 24), L(18, -12, 18, 12)]);
def('terminal', 'Terminal block', 'Electrical', [L(-45, 0, 45, 0), C(0, 0, 12), R(-25, -25, 50, 50)]);
def('op-amp', 'Operational amplifier', 'Electrical', [P([[-30, -35], [35, 0], [-30, 35]], true), L(-45, 18, -30, 18), L(-45, -18, -30, -18), L(35, 0, 45, 0), T(-20, 13, '+', 12), T(-20, -23, '−', 12)], [{ name: 'positive', x: -45, y: 18, dx: -1, dy: 0 }, { name: 'negative', x: -45, y: -18, dx: -1, dy: 0 }, { name: 'out', x: 45, y: 0, dx: 1, dy: 0 }]);
def('lamp', 'Indicator lamp', 'Electrical', [...lead, C(0, 0, 24), L(-17, -17, 17, 17), L(-17, 17, 17, -17)]);
const flowPorts = [{ name: 'in', x: 0, y: 35, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -35, dx: 0, dy: -1 }, { name: 'left', x: -55, y: 0, dx: -1, dy: 0 }, { name: 'right', x: 55, y: 0, dx: 1, dy: 0 }];
def('process', 'Process', 'Flow', [R(-55, -35, 110, 70), T(0, -5, 'Process', 14)], flowPorts, { labelOffset: 55 });
def('decision', 'Decision', 'Flow', [P([[0, 42], [60, 0], [0, -42], [-60, 0]], true), T(0, -5, 'Decision', 13)], [{ name: 'in', x: 0, y: 42, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -42, dx: 0, dy: -1 }, { name: 'yes', x: 60, y: 0, dx: 1, dy: 0 }, { name: 'no', x: -60, y: 0, dx: -1, dy: 0 }]);
def('terminator', 'Start / end', 'Flow', [P([...arcPoints(p(-25, 0), 30, Math.PI / 2, 3 * Math.PI / 2, .3), ...arcPoints(p(25, 0), 30, -Math.PI / 2, Math.PI / 2, .3)].map(p => [p.x, p.y]), true), T(0, -5, 'Start / end', 13)], [{ name: 'in', x: 0, y: 30, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -30, dx: 0, dy: -1 }]);
def('data', 'Data / input', 'Flow', [P([[-42, -35], [65, -35], [42, 35], [-65, 35]], true), T(0, -5, 'Data', 14)], flowPorts);
def('document', 'Document', 'Flow', [P([[-55, 35], [55, 35], [55, -24], [30, -36], [0, -25], [-30, -34], [-55, -24]], true), T(0, -5, 'Document', 14)], flowPorts);
def('database', 'Database', 'Flow', [L(-45, -25, -45, 25), L(45, -25, 45, 25), entity('ELLIPSE', { c: p(0, 25), major: p(45, 0), ratio: 1 / 3 }), P(Array.from({ length: 31 }, (_, i) => { const t = Math.PI + Math.PI * i / 30; return [45 * Math.cos(t), -25 + 15 * Math.sin(t)]; })), T(0, -5, 'Database', 13)], flowPorts);
def('subprocess', 'Subprocess', 'Flow', [R(-55, -35, 110, 70), L(-43, -35, -43, 35), L(43, -35, 43, 35), T(0, -5, 'Subprocess', 12)], flowPorts);
def('manual', 'Manual input', 'Flow', [P([[-55, -35], [55, -35], [55, 42], [-55, 22]], true), T(0, -5, 'Input', 14)], flowPorts);
def('preparation', 'Preparation', 'Flow', [P([[-40, -35], [40, -35], [60, 0], [40, 35], [-40, 35], [-60, 0]], true), T(0, -5, 'Prepare', 14)], flowPorts);
def('delay', 'Delay', 'Flow', [P([[-50, -35], [5, -35], ...Array.from({ length: 31 }, (_, i) => { const t = -Math.PI / 2 + Math.PI * i / 30; return [5 + 35 * Math.cos(t), 35 * Math.sin(t)]; }), [-50, 35]], true), T(-5, -5, 'Delay', 14)], flowPorts);
def('junction', 'Junction', 'Flow', [C(0, 0, 16)], [{ name: 'in', x: 0, y: 16, dx: 0, dy: 1 }, { name: 'out', x: 0, y: -16, dx: 0, dy: -1 }, { name: 'left', x: -16, y: 0, dx: -1, dy: 0 }, { name: 'right', x: 16, y: 0, dx: 1, dy: 0 }]);
def('note', 'Annotation', 'Flow', [P([[45, 35], [-45, 35], [-45, -35], [45, -35]]), T(0, -5, 'Note', 14)], flowPorts);
// Explicit terminal geometry: every port terminates on a contour or a lead.
const roundLeads = (radius, vertical = false) => [L(-45,0,-radius,0),L(radius,0,45,0),...(vertical ? [L(0,radius,0,45),L(0,-radius,0,-45)] : [])];
const revise = (id, geometry, newPorts) => { const s=symbols.find(s=>s.id===id); if(geometry)s.entities=geometry; if(newPorts)s.ports=newPorts; };
revise('ball-valve',[...roundLeads(21),C(0,0,21),L(-15,-15,15,15)]);
revise('butterfly-valve',[...roundLeads(23),C(0,0,23),L(-16,-16,16,16),C(0,0,3)]);
revise('check-valve',[L(-45,0,-24,0),L(24,0,45,0),L(-24,-20,-24,20),L(-24,20,24,-16),C(-24,20,3),L(0,2,0,18)]);
for(const [id,radius,vertical] of [['pump',27,true],['gear-pump',28,true],['compressor',29,true],['fan',29,false],['heat-exchanger',33,false],['motor',29,true],['generator',29,true],['lamp',24,false]]) {
    const master=symbols.find(s=>s.id===id); master.entities=[...roundLeads(radius,vertical),...master.entities.slice(2)];
}
revise('filter',[...lead,R(-25,-28,50,56),L(-25,-28,25,28),L(-25,28,25,-28),L(0,28,0,45),L(0,-28,0,-45)]);
const diodeBody=[L(-45,0,-22,0),P([[-22,-22],[22,0],[-22,22]],true),L(22,-24,22,24),L(22,0,45,0)];
revise('diode',diodeBody);
revise('led',[...diodeBody,L(4,27,24,47),P([[15,45],[24,47],[22,38]]),L(18,22,38,42),P([[29,40],[38,42],[36,33]])]);
revise('offpage',[P([[-40,-17],[24,-17],[44,0],[24,17],[-40,17]],true),L(-45,0,-40,0),L(44,0,45,0),T(-4,-5,'PW',13)]);
const cardinal = (top,bottom,left,right) => [{name:'in',x:0,y:top,dx:0,dy:1},{name:'out',x:0,y:bottom,dx:0,dy:-1},{name:'left',x:left,y:0,dx:-1,dy:0},{name:'right',x:right,y:0,dx:1,dy:0}];
revise('data',null,cardinal(35,-35,-53.5,53.5));
revise('document',null,cardinal(35,-25,-55,55));
revise('database',null,cardinal(40,-40,-45,45));
revise('manual',null,cardinal(32,-35,-55,55));
revise('preparation',null,cardinal(35,-35,-60,60));
revise('delay',null,cardinal(35,-35,-50,40));
revise('note',null,[{name:'left',x:-45,y:0,dx:-1,dy:0},{name:'top',x:0,y:35,dx:0,dy:1},{name:'bottom',x:0,y:-35,dx:0,dy:-1}]);
// Original function/location variants; exact normative symbol identifiers are intentionally not asserted.
const sensePort=[{name:'sense',x:0,y:-45,dx:0,dy:-1}];
def('pressure-panel','Pressure indicator · panel','P&ID',[C(0,0,26),L(-26,0,26,0),T(0,7,'PI',12),L(0,-26,0,-45)],sensePort,{instrumentLocation:'primary accessible panel'});
def('pressure-rear','Pressure indicator · rear panel','P&ID',[C(0,0,26),line(p(-26,0),p(26,0),{dash:[4,3]}),T(0,7,'PI',12),L(0,-26,0,-45)],sensePort,{instrumentLocation:'normally inaccessible'});
def('capacitor-polarized','Capacitor · polarized','Electrical',[L(-45,0,-7,0),L(0,0,45,0),L(-7,-25,-7,25),P(arcPoints(p(52,0),52,Math.PI-.46,Math.PI+.46,.1).map(p=>[p.x,p.y])),L(-28,20,-16,20),L(-22,14,-22,26)]);
def('signal-ground','Signal reference','Electrical',[L(0,40,0,10),P([[-24,10],[24,10],[0,-22]],true)],[{name:'terminal',x:0,y:40,dx:0,dy:1}]);
def('chassis','Chassis connection','Electrical',[L(0,40,0,8),L(-24,8,24,8),L(-24,8,-35,-8),L(0,8,-11,-8),L(24,8,13,-8)],[{name:'terminal',x:0,y:40,dx:0,dy:1}]);
def('contact-no','Contact · normally open','Electrical',[L(-45,0,-8,0),L(8,0,45,0),L(-8,-23,-8,23),L(8,-23,8,23)]);
def('contact-nc','Contact · normally closed','Electrical',[L(-45,0,-8,0),L(8,0,45,0),L(-8,-23,-8,23),L(8,-23,8,23),L(-19,-28,19,28)]);
def('potentiometer','Potentiometer','Electrical',[...lead,R(-25,-11,50,22),L(0,45,0,12),P([[-6,22],[0,12],[6,22]])],[...horizontal,{name:'wiper',x:0,y:45,dx:0,dy:1}]);
export const SYMBOLS = symbols;
export const LINE_STYLES = [
    { id: 'process', name: 'Process pipe', layer: 'Process', color: '#147c77', width: 2, dash: [], arrow: 'end' },
    { id: 'signal', name: 'Instrument signal', layer: 'Instruments', color: '#aa7c4b', width: 1.5, dash: [6, 4], arrow: 'none' },
    { id: 'electrical', name: 'Electrical wire', layer: 'Electrical', color: '#6979b4', width: 1.5, dash: [], arrow: 'none' },
    { id: 'data', name: 'Data / communication', layer: 'Electrical', color: '#8876a7', width: 1.5, dash: [10, 3, 2, 3], arrow: 'end' },
    { id: 'pneumatic', name: 'Pneumatic signal', layer: 'Instruments', color: '#a38560', width: 1.5, dash: [10, 3, 2, 3, 2, 3], arrow: 'none' },
    { id: 'hydraulic', name: 'Hydraulic line', layer: 'Process', color: '#557d99', width: 2.8, dash: [], arrow: 'end' },
    { id: 'drain', name: 'Drain / utility', layer: 'Process', color: '#75898d', width: 1.5, dash: [12, 5], arrow: 'end' },
    { id: 'center', name: 'Centerline', layer: 'Annotations', color: '#8e9298', width: 1, dash: [16, 3, 2, 3], arrow: 'none' },
    { id: 'hidden', name: 'Hidden edge', layer: '0', color: '#8e9298', width: 1.2, dash: [4, 3], arrow: 'none' },
    { id: 'boundary', name: 'Equipment boundary', layer: 'Annotations', color: '#9bacb3', width: 1, dash: [8, 4], arrow: 'none' }
];
export function installSymbols(doc) {
    for (const s of SYMBOLS)
        if (!doc.blocks[s.block])
            doc.blocks[s.block] = clone({ name: s.block, base: s.base, entities: s.entities, ports: s.ports, symbol: s.symbol });
    return doc;
}
export function insertSymbol(doc, id, x, y, options = {}) {
    const s = SYMBOLS.find(s => s.id === id) || Object.values(doc.blocks).find(b => b.name === id && b.symbol);
    if (!s)
        throw new Error(`Unknown symbol: ${id}`);
    if (s.block && !doc.blocks[s.block])
        doc.blocks[s.block] = clone({ name: s.block, base: s.base, entities: s.entities, ports: s.ports, symbol: s.symbol });
    return entity('INSERT', { block: s.block || s.name, x, y, sx: 1, sy: 1, rotation: 0, layer: s.category === 'Electrical' ? 'Electrical' : s.category === 'Flow' ? 'Process' : 'Equipment', tag: options.tag ?? '', ...options });
}
/** Three genuinely editable demonstration projects; no background image or mock canvas. */
export function createDemo(kind = 'pid') {
    const doc = installSymbols(createDocument(kind === 'electrical' ? 'Motor control circuit' : kind === 'flow' ? 'Commissioning workflow' : 'Process water skid'));
    const E = doc.entities;
    const put = (id, x, y, tag, extra = {}) => { const e = insertSymbol(doc, id, x, y, { tag, ...extra }); E.push(e); return e; };
    const wire = (a, ap, b, bp, label = '', style = 'process', way = []) => {
        const aa = ports(a, doc).find(p => p.name === ap), bb = ports(b, doc).find(p => p.name === bp);
        if (!aa || !bb)
            throw new Error(`Demo port missing ${ap}/${bp}`);
        const s = LINE_STYLES.find(s => s.id === style);
        const pts = way.length ? [aa, ...way, bb] : [aa, { x: bb.x, y: aa.y }, bb];
        const e = polyline(pts, false, { layer: s.layer, color: s.color, width: s.width, dash: s.dash, label, connector: { from: { entityId: a.id, port: ap }, to: { entityId: b.id, port: bp }, style, arrow: s.arrow, waypoints: way, status: 'routed' } });
        E.push(e);
        return e;
    };
    const note = (x, y, t, h = 12, color = '#849298') => E.push(text(p(x, y), t, h, { layer: 'Annotations', color }));
    note(40, 650, 'CONDUIT / ENGINEERING WORKSPACE', 12, '#6d9693');
    note(40, 606, doc.name, 30, '#304c58');
    note(40, 576, kind === 'pid' ? 'PW-101   ·   PIPING & INSTRUMENTATION   ·   REV 01' : kind === 'flow' ? 'QA-204   ·   PROCESS FLOW   ·   REV 01' : 'EL-301   ·   ELECTRICAL SCHEMATIC   ·   REV 01', 12);
    E.push(line(p(40, 553), p(1100, 553), { layer: 'Annotations', color: '#ccd7db', width: 1 }));
    if (kind === 'pid') {
        note(40, 520, '01  /  INTAKE', 11);
        note(415, 520, '02  /  PRESSURIZATION', 11);
        note(795, 520, '03  /  CONDITIONING', 11);
        const inlet = put('offpage', 85, 330, 'SUPPLY'), v1 = put('gate-valve', 210, 330, 'HV-101'), str = put('strainer', 340, 330, 'ST-101'), pump = put('pump', 485, 330, 'P-101'), check = put('check-valve', 625, 330, 'NRV-101'), v2 = put('ball-valve', 755, 330, 'HV-102'), hx = put('heat-exchanger', 905, 330, 'E-101'), out = put('offpage', 1055, 330, 'RETURN');
        const seq = [inlet, v1, str, pump, check, v2, hx, out];
        for (let i = 1; i < seq.length; i++)
            wire(seq[i - 1], 'out', seq[i], 'in', i === 1 ? 'DN 50' : i === 5 ? 'PW-101' : '');
        const pi = put('pressure-indicator', 625, 455, 'PI-101', { tagHeight: 11 });
        wire(check, 'top', pi, 'sense', '', 'signal'); // Add explicit auxiliary check-valve port below.
        const ctrl = put('control-valve', 755, 170, 'FCV-101');
        wire(pump, 'bottom', ctrl, 'in', 'BYPASS', 'process', [p(485, 170), p(710, 170)]);
        wire(ctrl, 'out', hx, 'bottom', '', 'process', [p(905, 170)]);
        const ft = put('flow-transmitter', 905, 455, 'FT-101', { tagHeight: 11 });
        wire(hx, 'top', ft, 'sense', '', 'signal');
        const controller = put('process', 1060, 170, 'FIC-101', { sx: .75, sy: .75, layer: 'Instruments' });
        wire(ft, 'sense', controller, 'in', '', 'signal', [p(985, 410), p(985, 225), p(1060, 225)]);
        wire(controller, 'left', ctrl, 'signal', '', 'signal', [p(985, 170), p(985, 235), p(755, 235)]);
        note(47, 225, 'DESIGN BASIS', 10);
        note(47, 202, 'Flow       12.5 m³/h', 12, '#6a7e86');
        note(47, 181, 'Pressure   6 bar', 12, '#6a7e86');
        note(47, 160, 'Material   SS 316L', 12, '#6a7e86');
    }
    else if (kind === 'electrical') {
        const bat = put('battery', 130, 350, '24 VDC'), fuse = put('fuse', 310, 350, 'F1'), sw = put('switch', 490, 350, 'S1'), relay = put('relay', 700, 350, 'K1'), motor = put('motor', 930, 350, 'M1');
        const seq = [bat, fuse, sw, relay, motor];
        for (let i = 1; i < seq.length; i++)
            wire(seq[i - 1], 'out', seq[i], 'in', 'L+', 'electrical');
        const ground = put('ground', 930, 160, 'PE');
        wire(motor, 'bottom', ground, 'terminal', '', 'electrical');
        const lamp = put('lamp', 700, 200, 'H1');
        wire(sw, 'out', lamp, 'in', '', 'electrical', [p(560, 350), p(560, 200)]);
        wire(lamp, 'out', motor, 'bottom', '', 'electrical', [p(930, 200)]);
        note(80, 470, 'CONTROL POWER', 12);
        note(650, 470, 'OUTPUTS & INDICATION', 12);
    }
    else {
        const start = put('terminator', 160, 440, 'START'), proc = put('process', 400, 440, 'INSPECT'), dec = put('decision', 650, 440, 'PASS?'), end = put('terminator', 965, 440, 'APPROVE'), fix = put('process', 650, 245, 'REWORK'), db = put('database', 965, 245, 'RECORD');
        wire(start, 'out', proc, 'in', '', 'process', [p(160, 365), p(400, 365), p(400, 475)]);
        wire(proc, 'right', dec, 'no');
        wire(dec, 'yes', end, 'in', 'YES', 'process', [p(965, 440), p(965, 500)]);
        wire(dec, 'out', fix, 'in', 'NO');
        wire(fix, 'left', proc, 'out', '', 'process', [p(400, 245)]);
        wire(end, 'out', db, 'in');
        note(70, 165, 'Every shape is a DXF block. Connectors stay attached when equipment moves.', 14);
    }
    E.push(line(p(40, 92), p(1100, 92), { layer: 'Annotations', color: '#ccd7db', width: 1 }));
    note(40, 60, 'SCHEMATIC · NOT FOR CONSTRUCTION', 10);
    note(720, 60, 'UNITS: mm     |     MODEL SPACE     |     1 OF 1', 10);
    doc.metadata.description = 'Editable demonstration drawing. Symbols are illustrative, not standards-certified.';
    return doc;
}
// Instrument takeoff points remain explicit, inspectable block ports.
SYMBOLS.find(s => s.id === 'check-valve').ports = [...horizontal, { name: 'top', x: 0, y: 18, dx: 0, dy: 1 }];
