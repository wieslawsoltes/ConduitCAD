/** References identify a symbol family, not dimensional certification of a master. */
export const REFERENCES = {
    'ISO-10628-2': { title: 'ISO 10628-2:2012 — Process diagram graphical symbols', url: 'https://www.iso.org/standard/51841.html', scope: 'Chemical and petrochemical process diagrams; excludes electrotechnical symbols.' },
    'ISO-1219-1': { title: 'ISO 1219-1:2012 — Fluid-power graphical symbols', url: 'https://www.iso.org/standard/60184.html', scope: 'Hydraulic and pneumatic circuit symbols.' },
    'ISO-5807': { title: 'ISO 5807:1985 — Information-processing flowcharts', url: 'https://www.iso.org/standard/11955.html', scope: 'Data, program and system flowchart notation.' },
    'IEC-60617': { title: 'IEC 60617 — Electrotechnical diagram symbols', url: 'https://webstore.iec.ch/en/publication/2723', scope: 'Electrical diagrams; IEC rectangular and explicitly labeled alternative forms remain distinct.' },
    'ISA-5.1': { title: 'ANSI/ISA-5.1 — Instrumentation identification and symbols', url: 'https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa5', scope: 'Instrument functions and location conventions; no normative atlas is redistributed.' },
    'NFPC-FLUID': { title: 'NFPC / Webtec public fluid-power symbol guide', url: 'https://files.webtec.com/1219-1_2012_NFPC_Symbols.pdf', scope: 'Public visual reference for fluid-power function, actuator and port topology.' },
    'PROJECT': { title: 'Explicit project convention', url: '', scope: 'Functional equipment/topology schematic, not a normative ISO/IEC symbol or a safety sign.' }
};
export const CATEGORIES = [
    { id: 'P&ID', name: 'P&ID', layer: 'Equipment', medium: 'process', refs: ['ISO-10628-2'], description: 'Process equipment, piping and valve bodies' },
    { id: 'Electrical', name: 'Electrical', layer: 'Electrical', medium: 'electrical', refs: ['IEC-60617'], description: 'Circuit components and power distribution' },
    { id: 'Flow', name: 'Flowcharts', layer: 'Process', medium: 'logical', refs: ['ISO-5807'], description: 'Information and process-flow notation' },
    { id: 'Instrumentation', name: 'Instrumentation', layer: 'Instruments', medium: 'signal', refs: ['ISA-5.1'], description: 'Measurement, control and location variants' },
    { id: 'Hydraulics', name: 'Hydraulics', layer: 'Hydraulics', medium: 'hydraulic', refs: ['ISO-1219-1', 'NFPC-FLUID'], description: 'Liquid-power components, valve states and actuators' },
    { id: 'Pneumatics', name: 'Pneumatics', layer: 'Pneumatics', medium: 'pneumatic', refs: ['ISO-1219-1', 'NFPC-FLUID'], description: 'Compressed-air preparation and motion control' },
    { id: 'HVAC', name: 'HVAC', layer: 'HVAC', medium: 'air', refs: ['PROJECT'], description: 'Air and hydronic functional schematics' },
    { id: 'Water', name: 'Water & plumbing', layer: 'Water', medium: 'water', refs: ['PROJECT'], description: 'Water treatment and building-water equipment' },
    { id: 'Automation', name: 'Automation', layer: 'Automation', medium: 'signal', refs: ['PROJECT'], description: 'Industrial control and I/O functional blocks' },
    { id: 'Fire', name: 'Fire & safety', layer: 'Fire', medium: 'alarm', refs: ['PROJECT'], description: 'Fire-alarm topology; not ISO 7010 signage' },
    { id: 'Network', name: 'Networks', layer: 'Network', medium: 'data', refs: ['PROJECT'], description: 'Vendor-neutral network and telecom topology' }
];
export function categoryDefinition(id) {
    return CATEGORIES.find(category => category.id === id);
}
