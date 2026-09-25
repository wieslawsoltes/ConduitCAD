## 0.5.0 authoring addition

Shared block editing preserves native BLOCK/INSERT structure. Native attributes
retain tags, prompts, flags and affine placement; constants are not duplicated.
Constraint-based variants and calculated annotations are exported as evaluated
native geometry/text, with Conduit metadata for editable reimport. This does not
emit proprietary Autodesk action graphs or native dimensional constraint networks.
See [Parametric authoring](PARAMETRIC_AUTHORING.md) for precise editing contracts.

# DXF compatibility boundary — 0.4.0

Recognizing a record, rendering its geometry and losslessly exporting all its
semantics are different claims. This release is an expanded planar CAD editor,
not a complete AutoCAD implementation or universal edited-DXF round-trip engine.

## Input, coordinates and output

ASCII DXF, modern binary DXF and the R12 binary byte-code variant are recognized.
Input bytes and selected legacy code pages are handled by the existing readers;
`parseDXF(input, {encoding})` can override decoding. Original bytes are retained
separately. Binary text decoding resolves the entire header before decoding payload strings.
Supported WHATWG encodings include the Windows code pages and common East Asian
encodings; unavailable encodings fail rather than pretending successful fidelity.
ASCII and binary int64 values remain exact decimal strings. Scalar overflows,
non-finite coordinates, truncated pairs, invalid chunks and malformed sections fail.

`writeDXF` emits ASCII and `writeDXFBinary` emits binary R2000–R2018.
The default mode is normalized; `mode: "preserve"` uses the source version.
MESH requires R2010, HELIX R2007, and gradient hatch tags R2004 or later;
unsupported downgrades fail. `strict: true` rejects known normalized data loss. Supported
entity data remains native rather than being replaced by rendering tessellation.
Finite doubles use JavaScript's round-trippable decimal serialization. Export
version selection is not a claim of complete version-specific feature coverage.

Autodesk's arbitrary-axis OCS basis is evaluated and projected to document XY.
Non-default normals, negative-Z extrusion and elevation are applied for supported
OCS entity families. ELLIPSE and 3D POLYLINE retain their WCS distinctions. This
is a planar projection, not a 3D camera, solid modeler or complete UCS editor.
Native Z data in supported records is retained during normalized exchange.

## Supported entity behavior

| Construct | Display/edit behavior | Normalized output |
|---|---|---|
| LINE | WCS endpoints, planar move and grips; preserved Z | Native LINE |
| LWPOLYLINE / 2D POLYLINE | Closure, bulges, elevation, variable start/end widths and tapered ribbons | Native LWPOLYLINE with known widths/bulges |
| 3D POLYLINE | Projected closed/open wireframe | POLYLINE/VERTEX/SEQEND, native Z |
| Polyface / polygon mesh | Indexed faces/grid wireframe, hidden face-edge indices, closed mesh directions | Native flags, dimensions, indices and vertices |
| CIRCLE / ARC | Adaptive OCS-aware projected curves | Native curves |
| ELLIPSE | WCS major axis and normal-derived minor axis | Native known ELLIPSE fields |
| SPLINE | Rational control/knot evaluation and bounded adaptive subdivision | Native known spline data; not all fit-only semantics |
| HATCH, solid | Polyline/bulge or line/arc/ellipse/rational-spline edges, clockwise/CCW paths; normal/outer/ignore island styles | Native HATCH boundaries and style |
| HATCH, pattern | Signed dash/dot scanlines clipped against island topology with explicit density limits | Native pattern-line records, scale and angle metadata |
| HATCH, gradient | Unshifted two-explicit-color LINEAR gradients; other distributions use a warned flat preview | Native gradient tags retained |
| TEXT | Second alignment point, fit/aligned, baseline/vertical placement, style width/oblique, generation flags, affine placement | Native known alignment and style data |
| MTEXT | Nine attachments, measured wrapping, paragraphs, selected scoped formatting, browser fonts, background masks | Native text chunks, wrap width, direction, spacing, background data |
| ATTRIB / ATTDEF | Tags and visibility; known text placement | Native attribute data |
| BLOCK / INSERT | Nested native instances plus Conduit declarative parameter/action evaluation, visibility and port updates | Native blocks/inserts/attributes |
| SOLID / TRACE / 3DFACE | Correct corner order, projected fill/edges; 3DFACE hidden edges | Native known corners and visibility bits |
| LEADER | Polyline and first-point arrow preview | Native vertices and known flags, not full dimension-style/annotation association |
| RAY / XLINE | Bounded to current view rather than arbitrary huge endpoints | Native infinite-line records |
| POINT | Cross marker | Native POINT |
| DIMENSION | Types 0–6; opt-in planar decimal regeneration, inspector and grips, authored line/radius point associations | Native DIMENSION, regenerated BLOCK, ACAD/DSTYLE overrides and app-specific associations; no generic vendor evaluator |
| VIEWPORT | Top-view orthographic target/center/twist and scale; rectangular and supported closed curve/polygon clipping, frozen layers | Native viewport and remapped clipping/frozen-layer handles |
| WIPEOUT | Ordered background masks from normalized image boundaries | Native WIPEOUT, not an external raster image |
| MESH | Indexed wireframe; native Z, faces, edges, crease data and subdivision level retained | Native MESH; subdivision surfaces are not evaluated |
| HELIX | Spline-based display with analytic data retained | Native AcDbSpline and AcDbHelix records; no arbitrary 3D solid generation |
| STYLE / LAYER / LTYPE | Browser font fallback, ACI/true color, visibility/locks, lineweights, inherited and signed dash patterns, opacity | Supported table and entity properties; not SHX/text pattern elements |
| Layouts | Native names/tab order, inactive paper entities recovered from special blocks, layout switching | Root/layout dictionaries, owner chains, model/paper block records and supported paper size/unit/rotation settings |
| Unknown entities / OBJECTS | Source records and handle graph inspectable; unsupported geometry not invented | Normalized output may omit; preserving mode retains source records subject to safe-edit restrictions |

## Text, patterns and compositing

Wire DXF angle groups default to degrees. The reader also accepts an explicit
`mtextRotationUnit: 'radians'` override for a known producer using the APP/API
convention. MTEXT output uses its WCS direction vector to avoid that ambiguity.
Reference width (41) is not treated as horizontal text scaling. Background true
color (421) is kept distinct from entity foreground true color (420).

Browser fonts and partial formatting are not a full AutoCAD SHX/TTF/Bigfont
engine. Vertical flow, columns, exact rich fractions, all paragraph controls,
font-resource resolution and exact metrics are incomplete. These limitations
are diagnosed where recognized. No proprietary font files are distributed.

The retained stroke engine is WebGPU, WebGL2 or Canvas according to availability.
For filled/masked/long-dash/dotted scenes, an ordered Canvas 2D compositor avoids
putting every fill below every line or truncating long dash arrays. It preserves
entity sequence, even-odd holes and opacity. This is a correctness-first fallback,
not a claim of all-GPU fills or support for arbitrary SORTENTSTABLE/nested draw
ordering. The UI reports the actual compositor separately from the stroke engine.

Hatch work is bounded (line/segment/subdivision/count ceilings). A diagnostic
reports truncated previews. Invalid counts fail before unbounded allocation.
Variable-width polyline ribbons do not implement every AutoCAD join/endcap rule.

## Editing and clipping boundaries

Body dragging converts planar deltas back into supported non-degenerate OCS
planes. Incorrect raw-OCS grips are not shown for non-default extrusion. Edge-on
planes, unsupported native hatch reflections and nonuniform/sheared curve edits
reject before mutation instead of silently damaging coordinates. Full OCS/UCS
grip editing remains an extension point.

The drawing viewport, selection overlays and ruler exclusion use real Canvas
clipping and device-pixel GPU scissor bounds. This fixes application-canvas
clipping. Paper-space VIEWPORT clipping and WIPEOUT masks are now implemented
for the supported 2D cases. IMAGE resources and block XCLIP remain unsupported.
Perspective, tilted and depth-clipped viewports show a diagnosed frame only.
Existing native dimensions retain their original pictures until **Enable dimension editing**
is confirmed. The planar decimal evaluator then enables witness, dimension-line and
text grips with transactional regeneration. Unsupported OCS/3D/oblique frames are
refused; custom arrow shapes, tolerance layouts and annotative contexts are not
reproduced by adoption. See CAD_EDITING.md for precise scope. Clipped-viewport translation and explosion are rejected until their boundary
can be updated atomically. Translation of supported native geometry is distinct from associative regeneration.

Curve explosion is a tessellating edit, not a lossless decomposition of rich
text or every hatch association. Keep the native project before destructive
conversion. New symbol definitions do not overwrite existing project masters.

## Preservation and application metadata

Three explicit contracts are exposed in the export dialog and API:

1. **Normalized** rebuilds supported entities, native dimensions, tables, layout
   objects and ownership. Unsupported fields and objects may be omitted. The
   report identifies known losses; strict mode refuses them. Handles are remapped,
   and supported viewport clip/frozen-layer references are updated. Unsupported
   hatch associations and unsupported foreign application XDATA are detached rather than
   left as dangling cross-document references.
2. **Record-preserving** reads the original source tags and retains all original
   sections/records, ownership, classes, XDATA, binary chunks, field order and
   opaque values. ASCII/binary re-encoding is possible. This preserves unknown
   data without executing its semantics, and is not a universal merge engine.
3. **Original file** returns exact imported bytes without applying any edits.

Record preservation requires the baseline captured by this importer. It rejects
version conversion, inserted/deleted/reordered entities, changed tables, blocks,
layouts, metadata or object sections. Explicit scalar/point patchers cover LINE,
CIRCLE, ARC, POINT and selected TEXT fields, using existing unambiguous groups.
Referenced objects, reactors, extension data and foreign/application XDATA block
geometry edits, because their evaluators would otherwise become stale. Missing
native groups, unknown edits and duplicate handles fail before producing output.
A loaded Conduit project retains its baseline. Existing older project files must
reimport their original DXF to acquire one. Viewing, panning and library previews
do not alter the baseline; editing or placing symbols deliberately may.

`inspectObjectGraph(doc)` reports original database nodes, raw records, pointer
codes, duplicate handles and unresolved links. HEADER HANDSEED is not treated
as an object. The generic graph does not evaluate SORTENTSTABLE, dynamic-block
parameters, constraints, ACIS data, image definitions or arbitrary vendor classes.

Application XDATA stores Conduit IDs/ports/connectors. Document metadata is also
written to a named dictionary XRECORD, so binary export (which omits ASCII comment
records) retains parameters, constraints and application metadata. Other CAD
systems are not expected to execute Conduit constraint/routing intelligence.

## Remaining semantic families

Not implemented in this release: DWG; ACIS/SAT/SAB/B-rep solids and surface kernels;
universal Autodesk dynamic-block and associative evaluators (the Conduit schema
and authored dimension point associations are supported); external XREF/IMAGE/underlay
resource resolution; full MTEXT/SHX/TTF/Bigfont parity; MLINE and all MLEADER/TABLE
variants; complete plot settings/3D/perspective viewports; XCLIP; and arbitrary
nested draw-order semantics. Only unshifted two-explicit-color LINEAR gradients are rendered; other gradient
metadata is preserved with a warned flat preview. Unknown records may be retained or inspected without having a drawing
or editing implementation. No claim of universal DXF or AutoCAD parity is made.

See REFERENCES.md and the separate ezdxf-authored fixtures, native field audits,
actual browser import/download checks and pixel clipping tests.
