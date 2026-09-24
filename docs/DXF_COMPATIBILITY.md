# DXF compatibility boundary — 0.2.0

Recognizing a record, rendering its geometry and losslessly exporting all its
semantics are different claims. This release is an expanded planar CAD editor,
not a complete AutoCAD implementation or universal edited-DXF round-trip engine.

## Input, coordinates and output

ASCII DXF, modern binary DXF and the R12 binary byte-code variant are recognized.
Input bytes and selected legacy code pages are handled by the existing readers;
`parseDXF(input, {encoding})` can override decoding. Original bytes are retained
separately. Binary legacy text decoding is less comprehensive than ASCII
code-page handling. ASCII int64 values are retained as decimal strings.

`writeDXF` emits normalized ASCII R2000/R2004/R2007/R2010/R2013/R2018. Supported
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
| HATCH, gradient | Flat-color preview with warning, not a gradient shader | Native gradient tags retained |
| TEXT | Second alignment point, fit/aligned, baseline/vertical placement, style width/oblique, generation flags, affine placement | Native known alignment and style data |
| MTEXT | Nine attachments, measured wrapping, paragraphs, selected scoped formatting, browser fonts, background masks | Native text chunks, wrap width, direction, spacing, background data |
| ATTRIB / ATTDEF | Tags and visibility; known text placement | Native attribute data |
| BLOCK / INSERT | Nested reusable instances, base point, scales, rotation, bounded arrays and ports | Native blocks/inserts/attributes |
| SOLID / TRACE / 3DFACE | Correct corner order, projected fill/edges; 3DFACE hidden edges | Native known corners and visibility bits |
| LEADER | Polyline and first-point arrow preview | Native vertices and known flags, not full dimension-style/annotation association |
| RAY / XLINE | Bounded to current view rather than arbitrary huge endpoints | Native infinite-line records |
| POINT | Cross marker | Native POINT |
| DIMENSION | Imported anonymous block display; authored aligned visible dimensions | Known imported form or authored line/text geometry, not associative regeneration |
| STYLE / LAYER / LTYPE | Browser font fallback, ACI/true color, visibility/locks, lineweights, inherited and signed dash patterns, opacity | Supported table and entity properties; not SHX/text pattern elements |
| Layouts | Basic active-layout filtering | Limited paper-space flags, not complete plot/layout objects |
| Unknown entities / OBJECTS | Source records retained and diagnostics produced, unsupported geometry not synthesized | Unsupported data can be omitted |

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
clipping; it does **not** implement DXF XCLIP, IMAGE/WIPEOUT clipping objects or
complete paper-space viewport clipping.

Curve explosion is a tessellating edit, not a lossless decomposition of rich
text or every hatch association. Keep the native project before destructive
conversion. New symbol definitions do not overwrite existing project masters.

## Preservation and application metadata

Save the Conduit project for the complete editable application state. Original
DXF export returns the exact imported input **without edits**. Edited normalized
DXF writes only represented tables/entities; arbitrary object ownership graphs,
reactors, opaque groups and external resource definitions are not merged back.
Hatch associations and source handles are deliberately detached on normalized
export to avoid dangling cross-document references.

Application XDATA stores Conduit IDs, ports, constraints and connectors. Other
CAD systems need not execute or retain this application-specific intelligence.
Full DWG, ACIS/B-rep solids, dynamic blocks, external references, raster/underlay
resolution, associative dimensions, complete fonts and paper-space plotting
remain outside this release. See REFERENCES.md and the independent test corpus.
