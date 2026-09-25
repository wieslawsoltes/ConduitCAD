# Engineering symbol library — geometry revision 3

ConduitCAD **0.2.1** contains **223 original editable masters**, **21 line styles**
and **20 editable drawing starters**. The original 64 IDs, DXF block names and
named-terminal contracts remain available. Saved or imported blocks are never
silently replaced by the new catalogue.

| Category | Masters | Convention / reference family |
|---|---:|---|
| P&ID | 45 | ISO 10628-2 process equipment; ISA-5.1 for the legacy instrument bubbles |
| Electrical | 44 | IEC 60617 family; zigzag resistor and curved-plate alternatives explicitly labeled |
| Flowcharts | 22 | ISO 5807 family; additional workflow forms explicitly marked PROJECT |
| Instrumentation | 17 | ISA-5.1 measurement/function and location conventions |
| Hydraulics | 20 | ISO 1219-1 family; public NFPC/Webtec visual guide |
| Pneumatics | 19 | ISO 1219-1 family; public NFPC/Webtec visual guide |
| HVAC | 14 | Project-convention air/hydronic functional schematics |
| Water & plumbing | 12 | Project-convention equipment and distribution schematics |
| Automation | 12 | Functional control and I/O topology, not terminal-level wiring |
| Fire & safety | 8 | Fire-alarm system topology, **not ISO 7010 signage** |
| Networks | 10 | Vendor-neutral network topology |

## What was reviewed and corrected

The review covers all original masters and each new master. `SYMBOL_REVIEW.md`
records every ID, category, terminal count, reference family and review note.
`symbol-atlas.html` is a self-contained visual atlas generated from the actual CAD
primitives; it is not a separate hand-drawn marketing illustration.

Valve bodies use separate triangle halves, with distinguishable ball, globe,
butterfly, hinged check and actuator details. Tanks, vessels, coil turns, cylinder
ends and storage ellipses use native ARC/ELLIPSE geometry. The document-wave and
AC-source curves use native cubic SPLINEs. Tall ellipses swap their axis basis and
parameter origin to satisfy DXF's minor/major ratio contract without changing
partial-arc endpoints. Explicit terminal leads remain attached to the silhouette.

Single-line transformers are separate from four-terminal winding schematics;
NPN/PNP emitter arrows and photodiode/LED light directions are distinct. Liquid
power uses filled energy triangles, gas power uses open triangles; pump/compressor
triangles point outward and motor triangles inward. Directional-valve squares
show working states and the external ports are attached to the spring-rest or
centre state. Double-acting, spring-return and cushioned cylinders are distinct.

Accessible instrument location dividers are solid; inaccessible dividers stay
dashed in both CAD and library previews. Ordinary symbol-body strokes remain
continuous even on a dashed signal layer. Child geometry uses BYBLOCK colour;
filled elements inherit instance colour rather than passing the literal string
`BYBLOCK` to the SVG/Canvas fill. Wire-crossing geometry includes a deliberate
non-connection gap. Heating/cooling and fire-damper marks above the body are
included in thumbnail bounds. Preview curves are tessellated at 0.03 drawing
units rather than the visibly faceted older 0.4-unit tolerance.

## Standards scope: provenance is not certification

ISO 10628-2 addresses chemical/petrochemical process diagrams and excludes
production electrotechnical symbols. ISO 1219-1 addresses fluid-power notation;
IEC 60617 is the electrical symbol database; ISA-5.1 addresses instrumentation;
ISO 5807 addresses information-processing flowcharts. Their scopes must not be
merged into a blanket “ISO compliant” label.

Every master records `standardRefs`, `geometryRevision`, `conformity`, `review`,
`normativeEntry`, group, aliases and default layer. Every named port records its
medium and role. The reviewed geometry follows the documented family conventions,
but this release does **not** assert an exact normative database entry, licensed
atlas reproduction, dimensional certification, national-code compliance or
engineering fitness. `normativeEntry` remains null and
`review.dimensionalConformance` is `not-verified`. No proprietary standard atlas,
font or commercial symbol artwork is redistributed.

Building-service, water, automation, fire-alarm and network blocks are openly
marked PROJECT. Fire-alarm function codes are not safety signs. All supplied
starters are labeled **NOT FOR CONSTRUCTION**. Project engineers must approve
symbol variants, identification, units, line types, sizing and actual connectivity
before issuing a production drawing. Ports and routes are editable graph data,
not a hydraulic/electrical simulation or a safety-system compliance calculation.

## Safe existing-project migration

`installSymbols(doc)` installs missing definitions/layers only. Merely browsing
an imported document renders missing previews in an ephemeral preview document;
it does not inject all 223 blocks into the user's file. Inserting one missing
master installs only that master.

Use **Conventions & library updates** in the library (or selected-symbol
properties) to explicitly update older *used* catalogue definitions. The dialog
warns that custom edits to those definitions will be replaced. The operation
validates all requested IDs and terminal names before mutation, keeps instance
IDs/transforms, reroutes connections and is undoable as one history transaction.
The headless equivalent is `symbolUpdates` plus `updateSymbolDefinitions`; a
host application supplies its history transaction. Custom additional terminals
cause migration to fail rather than silently dropping a connection.

## Primary references

- ISO 10628-2:2012: https://www.iso.org/standard/51841.html
- ISO 1219-1:2012: https://www.iso.org/standard/60184.html
- ISO 5807:1985: https://www.iso.org/standard/11955.html
- IEC 60617 database: https://webstore.iec.ch/en/publication/2723
- ISA5 committee and publication family: https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa5
- Public NFPC/Webtec fluid-power symbol guide: https://files.webtec.com/1219-1_2012_NFPC_Symbols.pdf
