# Original symbol library — geometry revision 2

Version 0.2.0 contains 64 original editable masters: 28 P&ID, 24 electrical and
12 flow-diagram symbols, plus 10 connection styles. Each master is native CAD
geometry in a block definition, with named ports, category and convention metadata.

## Corrections

Gate valves use two clean triangular body halves rather than one self-crossing
polygon. Check valves use a hinged flap and seat, not a diode-like electrical
mark. Pump, compressor, fan, exchanger, motor, generator, lamp and related
terminals now connect to their drawn bodies. Diode cathodes, LED indicators,
capacitor plates, signal/chassis/earth grounds and NO/NC contacts are distinct.
Flow-master ports lie on the actual outline, including sloped, curved and
nonrectangular boundaries. Legacy port names remain stable for connectors.

New masters include front-panel and rear/inaccessible instrument indicators,
polarized capacitor, signal and chassis grounds, normally-open/closed contacts
and a potentiometer. Instrument location lines are explicit geometry. All 64
masters are checked for finite geometry and port-to-geometry distance within
0.15 drawing units. This verifies connectivity, not standards certification.

## Conventions and certification

The library uses common process/instrumentation, electrotechnical and flowchart
conventions. ISA-5.1 covers instrumentation identification/symbol families; IEC
60617 is the authoritative electrotechnical graphical-symbol database. These
references identify relevant families, not a claim that this original library
reproduces every normative entry, dimension, variant or national convention.

Each master explicitly records `conformity: 'Original master; not standards-certified'`.
No restricted standards atlas or proprietary font/symbol artwork is redistributed.
A project's responsible engineer must approve the selected convention, line
weights, sizes, identification and application-specific variants before issuing
production drawings. A symbol's familiar appearance alone is not certification.

Imported or already-saved project blocks are not silently replaced with revised
masters. New drawings and the regenerated examples use revision 2. Preserve old
projects and migrate library definitions deliberately when continuity matters.

Primary references:
- ISA5 committee: https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa5
- IEC 60617 database: https://webstore.iec.ch/en/publication/2723
- IEC graphical material guidance: https://www.iec.ch/standards-development/graphics-figures
