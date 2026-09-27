# On-canvas drafting and spatial inspection — 0.12.0

## Try it

In 2D choose **More / Shapes → Visual drafting workshop** to open an independent,
native document containing a parameterized plate and circle, constrained line,
associated dimension, dynamic block, arc, ellipse, weighted spline and MTEXT.
Select an entity and choose **Edit on canvas**, or double-click native geometry.
Double-clicking an INSERT retains the shared block editor. Editing native TEXT/MTEXT
opens the inline editor; the quick Text tool places a new text draft the same way.

Handles manipulate geometry in drawing coordinates. Tap a dimension chip to type
an exact value or expression; text is editable in place through the same preview.
**All values** is a searchable non-modal native-control panel, not an obscuring modal.
Its first 80 matching fields are rendered at once; refine search for long paths.
Opening a late control also brings its handle into the virtualized handle window.
**Apply** commits one history transaction. **Cancel** restores the accepted document.
**Undo draft / Redo draft** are independent from the drawing's undo history.

For 3D, **Inspect**, **Section**, and **Appearance on canvas** now open non-modal
controls. The previous 0.11 primitive/feature manipulators and all 16 display modes
remain available. Switch **2D Draw** to return to the independent planar camera.

## Native 2D editing

The reusable `@conduitcad/manipulation2d` package exposes validated fields and
world-space handles for 21 native entity families: LINE, CIRCLE, ARC, ELLIPSE,
LWPOLYLINE, POLYLINE, SPLINE, POINT, RAY, XLINE, TEXT, MTEXT, ATTDEF, ATTRIB, LEADER,
SOLID, TRACE, planar 3DFACE, polygon HATCH, managed DIMENSION and INSERT.

Lines have endpoint and length controls; arcs expose endpoints/radius; ellipses
expose principal axes. Rectangles retain orientation and parametric width/height.
Splines edit actual controls without dropping degree, knots or rational weights;
stale fit points are cleared. Closed endpoint duplicates and triangular fourth
corners remain synchronized. Polylines retain bulges, width and native topology.
Straight polygon hatches validate the edited boundary and preserve separate islands.
Existing edge-path or associative hatches require their specialized editor instead.

Managed dimensions retain native DIMENSION entities and regenerate pictures.
Witness, text, line offset, arrow/text sizing, precision and measurement-factor
fields are available. An offset edit retains source references; moving a witness
explicitly detaches that witness. Existing length/radius driving constraints are
edited rather than fought by an unrelated raw-geometry edit. Other active driving
constraint values are exposed in All values; their equations and conflicts use the
existing solver. This is not a replacement dimension or constraint solver.

INSERT controls expose placement, rotation, independent nonzero planar scales,
Conduit dynamic parameters, native numeric parameter grips, enum/Boolean choices
and editable ATTRIB text. Derived values stay read-only. The shared block editor
runs the same workflow in its own isolated document; saving its definition retains
the existing automatic insert regeneration contract.

**Move/copy, rotate/copy, uniform scale/copy, offset and two-line fillet** now use
previews and handles. Copies receive stable distinct IDs and copied attribute IDs;
shared definitions remain shared. Independent sketch constraints are not duplicated
by geometric copying. Positive uniform scale is supported; no arbitrary deformation
or blanket mirror operation is implied. Offset supports straight planar polylines,
lines, circles and arcs, not arbitrary offset splines/bulges. Fillet creates a native
ARC and tangent line ends and rejects a radius that exceeds the selected segments.

## Exact input and safety

Length, radius and parametric rectangle dimensions retain supported expression
aliases; existing driving constraint expressions remain live. Dragging a named
expression adds an offset relative to the gesture-start snapshot rather than
replacing it with a number or nesting another expression on every pointer event.
Other exact coordinates and angles evaluate expressions once; they do not create a
new general association mechanism. Conduit block parameters use the existing dynamic
schema semantics rather than proprietary Autodesk action-graph semantics.

Preview documents are separate objects. The host evaluates constraints, calculations,
3D dependencies, native dimensions and connected routes against the clone. Neither
geometry previews nor appearance/section previews create intermediate history entries.
Only the current successfully evaluated revision can Apply. Invalid geometry clears
its preview. Invalid/oversized inline input cannot silently commit an earlier value.

Commit guards both source identity and its complete captured JSON signature, including
unversioned external changes. Document switches, conflicting source edits, entering
another mode and opening unrelated dialogs cancel the relevant draft. Export does
not silently export unaccepted planar geometry. Unchanged geometry applies are no-ops.
A separate draft history retains up to 60 entries.

The creation catalogue, drawing-tool options and exact next-point input are now
non-modal. Existing staged 2D drawing commands keep their established placement
semantics. Invalid polygon/hatch/MTEXT options block placement until corrected or
explicitly discarded by closing the options panel. Exact points use the existing
Cartesian, relative and polar syntax, including parameter expressions.

## Spatial inspection on the model

### Section

A finite plane guide and a 44-pixel arrow handle move an arbitrary normalized plane
using `normal · position = offset`. Choose X/Y/Z, the current camera plane, a picked
polygon face, or Flip. Offset expressions preview clipping immediately. The viewport
remains available for orbit/zoom. Drag uses the inherited 3D axis-projection math;
Shift provides fine steps and Alt disables snapping on a keyboard.

Existing renderer caps and hatching are display effects. **Create section lines**
intersects selected compiled world-space mesh geometry and adds native LINE snapshots
on an unlocked visible output layer. It preserves original bodies; it does not split
ACIS solids or create associative section objects. Output is bounded at 100,000
segments and respects nested block transforms in the compiled scene. Apply keeps the
view; Cancel restores the exact previous section. Navigation saves only accepted
section/display state while an inspection draft is open.

### Measure

Pick two visible surface points, optionally snapping to native control vertices.
The overlay reports Euclidean WCS distance, signed ΔX/ΔY/ΔZ, XY distance and signed
inclination. Exact XYZ entry and replacement of either endpoint remain available.
Choosing Point 2 before the first pick cannot invent a first point. Selected mesh
area, closed-mesh volume and boundary-edge counts are shown separately. A zero-length
pair is measurable but cannot create a misleading zero-length guide.

**Create guide line** adds one native spatial LINE in one history transaction.
Measurements/guide lines are snapshots, not associative constraints or fabricated
3D DIMENSION entities. Faceted mesh volume is not a self-intersection certificate.

### Appearance

Nine presets, RGB color, metallic/roughness/opacity/emission sliders and exact-entry
fields preview on isolated selected entities. Optional realistic shading makes the
result inspectable without touching the geometry. Apply commits one undoable native
color/opacity and Conduit appearance-metadata edit; Cancel restores accepted state.
Mixed selections compare every selected original material before deciding whether
Apply is a no-op. Invalid coefficients remove the draft preview.

Coefficient expressions are evaluated values, not persistent constraints. Transparent
polymer uses the existing weighted transparency, not physical refraction. Layer
assignment and other specialist properties retain their existing advanced inspector.

## Responsive interaction

The planar confirmation controls remain outside horizontally scrolling utility/value
lists. Handles are 44 CSS pixels with distinct geometry anchors and dimension labels.
Inline entry uses 16-pixel text, bounded panels and the measured visible viewport.
Mobile inspection panels collapse with **Preview model** while Apply/Cancel remain
reachable. Tool browsing focuses a heading rather than opening the software keyboard.

Two-finger takeover rolls back the current unfinished handle drag and then navigates;
releasing the remaining finger cannot place or apply geometry. Resize cancels a
partial drag while retaining the overall editing session. Handles support keyboard
nudges; Escape dismisses inline value/options before abandoning the whole operation.
Camera changes only reproject existing handles and labels.

No MutationObserver or icon font was introduced. The existing icon registry is reused.
The handles and measurements are viewport controls, not additional exported entities.

## Packages and contracts

Twenty-one ESM packages are version 0.12.0. The new manipulation2d package has no DOM
dependency. Public functions include `PlanarEditSession`, `fields2`, `editFields2`,
`handles2`, `dragHandle2`, `planarEditable` and `expressionDelta2`. The existing
manipulation3d package adds `measurePoints3` and `sectionFrame3`. Declarations and an
empty-cache consumer test cover these functions and native DXF round trips.

`WorkbenchOptions.drawingInteraction = 'dialog'` explicitly retains the old advanced
2D form integration; default is visual. Existing modelingInteraction = 'dialog' also
retains its former 3D forms. Historical tests that explicitly inspect those forms
select compatibility mode; the new suite tests the unmodified default visual UI.

## Deliberate boundaries

Planar editing is XY at Z=0 with default OCS. Spatial/elevated entities, mesh polylines,
locked geometry, 3D-feature-owned or consumed sources, unadopted dimensions, and
unsupported hatch associations are rejected,
not flattened. Up to 2,048 native controls or selected entities are supported; only
128 handles are projected at a time. Sessions clone and validate whole documents.
Preview work is animation-frame coalesced but geometric evaluation is synchronous:
this is not a million-entity sparse transaction or a physical-mobile frame-rate claim.

Full constraint creation, rich calculated-annotation authoring, shared-block schema
editing, topology tables, specialist layer/display preferences, export and file
management retain appropriate existing forms. This continuation replaces the common
geometry/inspection paths, not every application dialog. Arbitrary B-rep editing,
full font fidelity, universally persistent face references and Autodesk-native
feature graphs are outside this implementation. The unexecuted WebGPU rendering
work from 0.10/0.11 still needs the included native-origin publishing gate.
