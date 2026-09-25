# Editable drawing starters

**New** opens a searchable industry/type chooser, including the original three
examples, seventeen new industry starters and a separate blank drawing. Each
starter contains native blocks, linework, annotations and named-port connectors.
The selected profile also sets the initial symbol category and connection style.
The current document is saved before switching; a save failure keeps it open.

| ID | Industry / drawing |
|---|---|
| `pid` | Process engineering — existing process-water P&ID |
| `electrical` | Electrical engineering — existing motor-control schematic |
| `flow` | Manufacturing — existing commissioning flowchart |
| `water-treatment` | Water/wastewater — filtration, pumping, membranes, UV and reject outlet |
| `chemical-batch` | Chemical/petrochemical — agitated vessel, valve, pump and exchanger |
| `oil-gas` | Oil/gas — separation, metering, isolation and draw-off |
| `food-beverage` | Food/beverage — product transfer, heating and sampling |
| `pharmaceutical` | Pharmaceutical/biotech — purified-water utility train |
| `power-single-line` | Power/energy — generation, protection, transformation and load |
| `solar` | Renewables — photovoltaic generation, DC isolation and inverter |
| `hvac-air` | Building services — air handling and conditioning |
| `hvac-hydronic` | Building services — boiler, circulation, radiator and expansion |
| `hydraulic-actuator` | Machinery — pump, relief, tank, 4/3 valve and cylinder |
| `pneumatic-clamp` | Machinery — air preparation, 3/2 valve and spring-return cylinder |
| `instrument-loop` | Process automation — transmitter, controller, I/P and valve |
| `automation-io` | Automation — sensor, I/O, PLC, HMI and drive topology |
| `fire-alarm` | Fire protection — panel, detectors and alarm topology |
| `network` | IT/telecom — router, firewall, switch, server and access point |
| `plumbing` | Building services — metering, backflow, isolation and hot water |
| `quality-workflow` | Manufacturing — preparation, operation, inspection and records |

Regenerate DXF/project files with `node scripts/catalog-artifacts.mjs`. Original
samples remain in `samples/`; new examples are in `samples/industry/`. The
sample writer omits unused library blocks to avoid inflating every example with
the entire catalogue. The live workbench can still browse/place any missing master.

These are **concept schematics, not construction-approved designs**. Equipment
function, valve state, line style and terminal medium metadata assist authoring;
they do not perform engineering sizing, electrical protection coordination,
process safety, hygienic validation, fire-alarm compliance or network simulation.
Crossing routes are not automatically electrical/fluid junctions. Review the
project's topology and identification conventions before issuing drawings.
