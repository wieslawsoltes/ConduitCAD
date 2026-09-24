# DXF compatibility boundary — 0.1.0

There are three distinct claims: recognizing records, editing/rendering their
geometry, and exporting them without information loss. They are not equivalent.
This release implements a useful planar subset, not every DXF feature.

## Input and output

Input recognizes ASCII DXF group-code streams, modern binary DXF, and the R12
binary byte-code variant. Modern Unicode and selected legacy code pages are
decoded. An explicit encoding override is available for other browser-supported
encodings. Binary string decoding is more limited than ASCII version/code-page
handling. ASCII int64 group values are retained as decimal strings.

Normalized output is ASCII DXF R2000, R2004, R2007, R2010, R2013 or R2018. It
regenerates supported tables, blocks and entities, with application XDATA where
enabled. These versions are output encodings, not an assertion of complete
version-specific feature coverage or AutoCAD interoperability certification.

| Construct | Editable/display behavior | Normalized export |
|---|---|---|
| LINE | Planar endpoints, grips, snapping | Native LINE |
| LWPOLYLINE / 2D POLYLINE | Vertices, closure and bulge-arc display | Native LWPOLYLINE; known widths/bulges only |
| CIRCLE / ARC | Adaptive curve display; circle creation/radius editing | Native curve records |
| ELLIPSE | Major-axis and ratio-based curve display | Native ELLIPSE known fields |
| SPLINE | Rational control-point/knot evaluation and adaptive display | Native SPLINE known fields; not full fit-point semantics |
| TEXT / MTEXT | Browser-font text; partial formatting / paragraphs | Known text fields; not exact font/layout fidelity |
| ATTRIB / ATTDEF | Attribute/tag support; invisible attributes hidden | Native known attribute fields |
| BLOCK / INSERT | Named reusable definitions, insertion/rotation/scales, nested occurrences, bounded arrays | Native BLOCK / INSERT with associated attributes |
| POINT | Small cross marker | Native POINT |
| SOLID / TRACE / 3DFACE | Planar boundary and limited fill projection | Native known corner data |
| HATCH | Recognized boundary loops, partial solid preview | Boundary polylines, with explicit loss warning |
| DIMENSION | Imported anonymous block display; authored aligned visible dimensions | Known imported dimension form or visible line/text geometry |
| Layers | Names, visibility, locks, colors, simple linetype inheritance | LAYER table known fields |
| Linetypes | Common dash patterns | Simple LTYPE patterns; complex SHX/text patterns incomplete |
| Layouts | Entity layout name and basic active-layout filtering | Limited paper-space flags; no complete layout/viewports/plot objects |
| Unknown / unsupported entities | Original records retained, warning issued; not displayed as supported geometry | Omitted, with warning |
| OBJECTS and opaque sections | Retained in native project/original source | Not regenerated or merged into edited export |

Imported non-default extrusion/OCS is diagnosed; it is not fully transformed
into a planar view. Z coordinates in known records are not a 3D modeling or
camera implementation. Entity-specific groups not explicitly represented by the
model can be dropped during normalized export, even for a recognized type.

## Native drawing semantics

Symbols authored by the app are actual DXF block geometry with INSERT instances.
Tags are emitted as ATTRIB records, not only drawn as HTML labels. Connectors
are editable native polylines. Registered `CONDUITCAD` XDATA stores stable IDs,
port references and application fields; block metadata contains named ports.
Header comments store selected parameter/constraint metadata.

Conduit-to-Conduit export/import tests check ID stability, connector references,
ports and duplicate-tag prevention. Another CAD system may preserve, discard,
or ignore application metadata; it will not automatically implement Conduit's
solver or connector routing. Application metadata is not a standardized Visio,
Plant 3D, EPLAN or intelligent P&ID exchange format.

## Original source versus edited output

For byte input the native project retains the exact input bytes as base64. For
string input it retains the supplied decoded string. **Original DXF** downloads
that source, with no edits applied. It preserves unknown records because it is
the original file, not because unknown objects have been decoded and rewritten.

**Edited DXF** generates a new drawing from supported model fields. It is not
safe to describe this as lossless for arbitrary files. Store the `.conduit.json`
project and the original DXF alongside any normalized exchange copy.

## Boundaries still requiring implementation

Full nonplanar OCS/UCS; 3D solids/B-rep/ACIS and surfaces; general meshes/polyface
semantics; arbitrary entity transforms; DWG; XREF resolution and external asset
management; dynamic blocks and evaluation graphs; proxy objects/custom classes;
full OBJECTS/dictionaries/reactors/ownership reconstruction; image/PDF/DGN
underlays; complete hatch islands/patterns; variable polyline-width joins;
full linetype scaling and complex linetypes; font/style/SHX fidelity and complex
MTEXT; associative dimensions and comprehensive dimstyle handling; layout
viewports, clipping, plotting/page setups and drawing-order/transparency parity.

## Tests and external validation

The included tests cover ASCII and binary readers, old polylines, common curve
records, Unicode, source byte preservation, unsupported records, export warnings,
version headers, native blocks/tags/IDs/ports and large-coordinate compilation.

`tests/audit_dxf.py` independently opens and audits the three generated examples
with ezdxf 1.4.4. The delivered result is zero audit errors and zero repairs.
Generated examples are not a representative industrial interoperability corpus.
No claim is made that these files were opened and visually compared in AutoCAD,
Visio, BricsCAD, DraftSight, EPLAN or a plant-engineering package.

Before production acceptance, expand to independently authored files with
measured reference geometry, randomized/fuzz input, version/encoding coverage,
per-entity round-trip contracts and visual comparisons on real target CAD tools.
