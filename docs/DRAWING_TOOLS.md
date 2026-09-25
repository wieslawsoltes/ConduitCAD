# Native drawing tools — 0.6.0

## Tool catalogue

Open **More** on desktop or **Shapes** on a phone. The searchable catalogue adds
28 workflows to the existing Line, Polyline, Rectangle, Circle, Text, Connect,
and aligned measurement tools. They create editable native entities, including
inside an isolated shared-block editor. There are 15 distinct native entity types
across the new workflows, not 28 new DXF entity definitions.

| Family | Workflows | Stored entities |
|---|---|---|
| Curves | Three-point arc; center/start/end arc; three-point circle; diameter circle; full ellipse; elliptical arc; through-point spline; four-control Bézier | ARC, CIRCLE, ELLIPSE, SPLINE |
| Shapes and fills | Inscribed/circumscribed regular polygon; donut/disc; filled triangle/quad; planar face; polygon hatch; wipeout | LWPOLYLINE, SOLID, 3DFACE, HATCH, WIPEOUT |
| Construction | Point; ray; infinite line | POINT, RAY, XLINE |
| Annotation | Box-width multiline text; multi-vertex leader | MTEXT, LEADER |
| Dimensions | Aligned with picked offset; horizontal; vertical; radius; diameter; three-point angular; two-line angular; X ordinate; Y ordinate | DIMENSION and generated native graphics blocks |

## Picking, previews and exact coordinates

The active command shows the next required point and a live native preview once
there is enough information; earlier stages show a construction guide. Pick with
a mouse, touch or pen. Diameter circle, polygon, ray, xline and text box also
support a two-point press-drag gesture. Other commands use staged picks.

**Back** or Backspace removes the latest draft point. **Finish** or Enter completes
an open variable-length path. **Close** closes a polyline or through-point spline;
a hatch/wipeout closes its boundary on Finish. SOLID/3DFACE can finish after three
or four corners. Escape/Cancel discards the draft. Successful placement re-arms the
same native command for repeated drawing. Invalid completion keeps earlier picks,
allowing correction instead of dropping the command. Two-finger gestures never
commit an entity or a drawing point.

**Point…** supplies the next exact point:

```text
120,80           absolute Cartesian point
@25,-10          relative Cartesian displacement
@50<30           relative polar length and angle in degrees
@beamWidth/2,0   parameter expression in an exact-point field
```

Options persist per tool during the workbench session. Polygon chooses 3–512 sides
and vertex/side-midpoint construction. Hatch chooses solid, lines or cross, line
spacing and angle. MTEXT provides multiline content and text height before picking
a reference-width box. The box supplies width and top-left attachment; it does not
clip the text to a rectangle or promise an exact text-height box.

Commands share the same native factories. Examples:

```text
ARC 0,0 50,50 100,0
ARCCENTER 0,0 50,0 0,50
CIRCLE3P 0,0 50,50 100,0
CIRCLE2P 0,0 100,0
ELLIPSE 0,0 80,0 0,40
SPLINE 0,0 30,50 90,-10 140,20
BEZIER 0,0 30,80 70,-50 100,0
POLYGON 6 0,0 50,0
RAY 0,0 100,20
XLINE 0,0 1,0
DIMHORIZONTAL 0,0 100,40 0,80
```

An alias without coordinates arms its interactive tool. `NEXT x,y` feeds the
active native session; `FINISH` and `CLOSE` use the same staged completion paths.
Space-separated command point tokens cannot contain spaces inside expressions;
use the exact-point dialog for spaced expressions. Keyboard A/E/B choose
three-point Arc, Ellipse and through-point Spline. Existing shortcuts remain.

## Native editing

Arc endpoint grips and degree fields edit native angles; center/radius editing is
retained. Ellipse grips edit center, major vector and minor radius, while its
inspector exposes major X/Y, minor/major ratio and parameter interval. The creator
canonicalizes a longer second semi-axis into the major axis and adjusts arc
parameters. The minor grip instead rejects a ratio above one to avoid unexpectedly
swapping an existing parameter frame.

Spline control grips and the exact-control table retain degree, knots and weights;
stale fit points are cleared after control editing. The table supports 2048 controls
and 512 other vertices. The overlay shows at most 512 control grips to bound drawing
work. Closed endpoint controls stay coincident when one seam endpoint is edited;
that does not promise preservation of every other geometric constraint or C1 join.

The exact table also edits polylines, leaders, SOLID and planar face corners,
including LWPOLYLINE bulges. New SOLID/face corners are picked in perimeter order;
DXF wire ordering is handled by the exporter. Imported triangular fourth-corner
duplicates follow the edited third corner. Numeric changes run through document
history and solve/regeneration hooks, and failed edits roll back.

Rays/xlines have origin and direction grips plus an angle field. Construction
strokes are clipped to the viewport and indexed over their visible segments,
including nested block references; their artificial far endpoints no longer
inflate fit bounds. Camera changes rebuild scenes containing infinite strokes.
This is correctness-first recompilation, not constant-time million-line panning.

MTEXT has a multiline content editor, width and attachment controls. Closed
non-associative polygon hatches expose boundary grips. **Hatch selected boundaries**
copies selected circles, full ellipses and closed planar polylines into a native
hatch without flattening curve edges or bulges. Multiple contours use even-odd
islands. They are non-associative snapshots; later source edits do not update them.

Snapping now includes ellipse endpoints/quadrants, actual spline endpoints, point
nodes, construction origins and additional polyline/face/leader vertices. A bulged
polyline's midpoint lies on its circular arc rather than on the chord. Unsupported
projected OCS coordinates are not advertised as correct world-space snaps.

## Reusable package and native interchange

`@conduitcad/drawing` owns descriptors, conditioned construction algorithms,
validation, factories, `DrawingSession` and point parsing. It has no DOM dependency.
The workbench owns coordinate transforms, snapping, history, solver integration,
render invalidation, fields, pointer gestures and file export.

All new tools create XY geometry at Z=0. Coordinates and derived radii are finite
and bounded to 1e12. Paths have at most 512 picked points; a through-point spline
can have up to 1537 native controls. Simple polygon boundaries reject crossings,
overlapping edges, repeated adjacent corners and zero area. Circle construction
uses translation/scale conditioning and rejects near-collinear triples. Arc end
picks are directional for center/start/end construction; the radius comes from
center-to-start distance.

Through-point SPLINE uses piecewise cubic Hermite interpolation encoded as a
clamped B-spline with triple internal knots and matched first derivatives. It is
C1, not a claim of AutoCAD's FIT or periodic C2 interpolation. Bézier controls are
stored as one cubic SPLINE span. LEADER is unassociated and has no MLEADER content
or editable leader-text association. Planar 3DFACE is not B-rep solid modeling.
Donuts are closed two-bulge constant-width polylines, not raster rings.

Dimensions reuse the documented 0.5 evaluator and native export contract. Picked
free points do not become implicit source associations; use **Add associated
dimension** on a selected source to create an association. Custom dimension/font
and arbitrary 3D semantics remain governed by DXF_COMPATIBILITY.md.

The gallery `samples/drawing-tools.dxf` / `.conduit.json` is rebuilt by
`node scripts/drawing-tool-samples.mjs`; layers and native structures can be
inspected independently. Rendering continues to use the retained GPU stroke path
or ordered Canvas fidelity compositor, not a new hardware-equivalence guarantee.

## Primary references

- ELLIPSE field contract: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-107CB04F-AD4D-4D2F-8EC9-AC90888063AB.htm
- SOLID field contract: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-E0C5F04E-D0C5-48F5-AC09-32733E8848F2.htm

See VALIDATION.md and the separate ezdxf native-field audit. Independent readback
validates these fixtures, not every vendor implementation or full DXF conformance.
