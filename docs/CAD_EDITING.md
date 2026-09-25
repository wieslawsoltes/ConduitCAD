# Native CAD editing — 0.4.0

## Editor workflows

Select a LINE and choose **Add associated dimension** in Properties. Select a
CIRCLE/ARC and choose **Add radius dimension**. The original aligned dimension
drawing tool also creates managed dimensions. Edit dimension text (`<>` means
measurement), text height, decimal precision, arrow size, text gap, measurement
factor, signed offset and rotated-dimension angle in Properties. Drag witness,
dimension-line and text grips; **Reset text position** restores automatic text.
A single-space text override suppresses its picture label.

Imported dimension pictures are not silently replaced. **Enable dimension
editing** presents a confirmation describing the evaluator boundary. It regenerates
native planar types 0 rotated, 1 aligned, 2 two-line angular, 3 diameter, 4 radius,
5 three-point angular and 6 ordinate. Only a supported successful adoption removes
the old picture reference. XY at Z=0, default OCS, decimal labels, filled arrowheads
and the implemented extension-line layout are supported. Arbitrary custom arrows,
tolerances, dual units, oblique frames, rotated UCS and annotative contexts are
not reproduced. Unsupported planes are refused, not projected into editable data.

Managed line/radius dimensions reference explicit source points, not opaque
Autodesk reactors. Every source edit resolves references and prepares all affected
dimensions before updating any of them. Workbench history wraps the whole operation:
a failed downstream evaluation rolls back the source and pictures together. Moving
a witness grip detaches that witness only; moving the whole dimension detaches its
source references. Source deletion detaches references and freezes the last result.

## Parameterized blocks

**More → Parametric duct** places a working variable-length example. Its Properties
provide Length, Centerline visibility and reset. The length grip updates the same
parameter used by the inspector, evaluated geometry and connector ports. Numeric
values and closed enumerated sets are validated before mutation.

An INSERT's Properties offer **Add parameterized behavior** / **Edit behavior
definition**. The JSON editor creates a private master for the selected instance,
never modifies all uses of a shared catalogue block. This is developer-oriented
schema authoring, not a completed graphical AutoCAD Block Editor. The schema and
headless APIs are reusable without Workbench.

Schema `version:1` supports six parameter types (number, distance, angle, integer,
Boolean, enum) and eight actions (move, stretch, rotate, scale, flip, array,
visibility, lookup). Numeric parameters support ranges and discrete values.
Linear/angle parameters may expose local-coordinate grips. Lookup dependencies
are topologically ordered and reject cycles or conflicting writers.

Actions run in declaration order from pristine master entities, so changes never
compound on a previous evaluation. Stretch uses a crossing rectangle, transforms
selected LINE/polyline/spline points and associated ports, and refuses partial
bulge/mesh edits. Scale is positive/uniform. Flip supports geometry with correct
native reflection; unsupported text, nested INSERT, ellipse and hatch mirrors
are rejected. Array adds translated copies within a fixed budget; terminals
identify the original cell, not implicitly duplicated ports. Visibility combines
with an entity's existing hidden flag. Port directions follow affine transforms.
Up to 64 parameter definitions, 256 actions, 10,000 normal evaluated entities and
256 array copies are supported. Variant caches are bounded to 64 entries per master.

## Interchange contracts

Normalized ASCII/binary DXF writes managed dimensions as native DIMENSION records
and generated anonymous BLOCK pictures. Implemented dimension style overrides are
native `ACAD`/`DSTYLE` XDATA, even when app metadata is disabled. Conduit point
associations are additional app metadata and are not native Autodesk DIMASSOC
reactor graphs. Other CAD tools can display/edit the native dimension without
executing Conduit's source-reference evaluation.

Parameterized INSERTs export *evaluated* anonymous native blocks. The original
master/schema and parameter values are included as app metadata by default, so
Conduit can recover editable behavior. Other CAD tools see native static geometry,
not an executable Autodesk dynamic block. `includeMetadata:false` intentionally
bakes the behavior. Record-preserving mode still refuses structural/behavior edits;
use normalized output after intentional editing or retain the original file bytes.

Repeated exports prune only unreachable app-generated pictures. A static INSERT
referring to an earlier generated variant keeps that variant. Custom/foreign
blocks are not discarded merely because they are unused. Metadata larger than
the conservative native XDATA budget is refused; save the project or bake without
metadata instead. No font files or proprietary action evaluators are redistributed.

## Gradient rendering

Unshifted (`461=0`) LINEAR HATCH gradients with two explicit RGB stops render with
native angle, block/OCS/viewport affine placement and even-odd islands. Canvas is
the ordered fill compositor; SVG gets an actual affine linearGradient and PNG uses
the same fill routine. Rotation updates native gradient angle in radians. Other
gradient distributions keep their tags and an explicit flat-preview diagnostic.
Gradient explosion is rejected rather than stripping the native fill semantics.
This release does not claim gradient GPU shaders or hardware pixel equivalence.
