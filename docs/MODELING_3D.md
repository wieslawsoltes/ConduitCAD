# Native 3D modeling and editable examples — 0.8.0

ConduitCAD combines the existing 2D drawing workspace with a separate Z-up 3D
scene and a regenerating mesh-feature history. Both use the same DXF-native
entities, document tabs, undo transactions, local project files and recovery.
This is a faceted modeling implementation, **not full AutoCAD/Fusion parity**.

## Start and switch modes

Choose **New → a 3D starter**, **More → 3D example drawings**, or the **3D** mode
button in an existing Model-space drawing. The 3D **Create** menu contains the
modeling and spatial editing operations. **2D Draw** returns directly to the
existing planar tools. Each document retains independent planar and spatial
cameras; entering 3D does not rotate or replace the 2D editor's camera.

One finger / left-button drag orbits; two fingers pan and pinch zoom. The View
form can choose one-finger pan, orthographic/perspective projection, standard
views, shaded/edge/wireframe display, and body/face/vertex selection. The displayed
CPU frame time is not a GPU timing or a hardware performance qualification.

Tap geometry to select. The body list and timeline also select consumed or hidden
inputs for editing. Multi-select preserves selection order for subtract and sweep.
Drag an X/Y/Z axis handle to preview a mesh translation; release commits one
transform feature, cancel or a pinch discards it. F fits the selection. Enter
opens feature editing. Standard 2D tool shortcuts explicitly return to 2D.

## Feature history

Six primitives: box, cylinder, cone/frustum, sphere, torus and wedge.
Profile operations: extrusion with signed distance and linear top scale change,
revolve, loft and transported-frame sweep.
Modify: translation/rotation/nonuniform scale and connected planar-face press/pull.
Combine: closed-mesh union, subtraction and intersection.
Pattern: linear XYZ pattern, circular Z-axis pattern and plane reflection.

Every numeric field accepts named parameter expressions from **Parameters**.
Creating and editing evaluate a dependency graph into a temporary result set.
Only a successful complete evaluation replaces the document entities. Editing a
parent rebuilds descendants while preserving output IDs. Invalid input, missing
references, cycles and enabled descendants of suppressed inputs fail without
partial mutation. The shared workbench history restores source, result and
selection together. There is no external solver or cloud conversion service.

**Preview without saving** draws a transient result outside the document and
restores the previous camera on cancel. The desktop operation form is a narrow
side dialog; mobile uses a bounded partial-height form with a retained footer.
The preview is explicit rather than recomputing expensive Booleans per keystroke.

Suppressing a leaf restores its input bodies. Removing a feature with dependents
is guarded; the headless API offers explicit cascade deletion. Detach/Bake retains
a static native mesh and hides the detached feature's input stock. Direct vertex
editing explicitly detaches that body's feature and triangulates its faces before
deformation. Copy/paste and ordinary Duplicate bake mesh geometry deliberately;
they do not copy a dangling dependency graph into another document.

## Native geometry and exact edits

The scene supports indexed MESH faces, 3DFACE triangles/quads, polygon meshes,
polyface mesh indices and invisible edges, spatial POLYLINE, LINE, CIRCLE, ARC,
ELLIPSE, rational SPLINE, HELIX, POINT, basic LEADER paths, and nested INSERT/MINSERT
transforms. The arbitrary-axis algorithm handles tilted OCS planes; Z and nested
nonuniform scales are not discarded. Nonplanar 3DFACE quads render as two triangles.

Exact vertex/control-point editing operates in WCS, converting native OCS points
at the model boundary. A single LWPOLYLINE vertex cannot leave its common OCS plane;
that edit is rejected rather than silently flattening it. Native 3DFACE triangles
retain their duplicate fourth corner. Spline edits preserve degree/knots/weights
and clear stale fit data. Attributed INSERT relocation is guarded because full
3D attribute-frame regeneration is not implemented.

**Planar profile** creates native circles or closed polylines in XY, XZ or YZ OCS
planes. **3D polyline** accepts expression-based WCS XYZ rows. The planar solver
can still constrain supported 2D source sketches; it is not a spatial B-rep solver.
Revolve currently interprets a profile's X as radius and Y as Z height around the
world Z axis. It is not arbitrary-axis surface-of-revolution authoring. Loft
resamples closed loops by perimeter; sweep uses parallel-transport section frames.
Guide rails, spline-exact surfaces, holes in one profile, twist optimization,
self-intersection certification and exact offsets/fillets/chamfers are absent.

## Rendering and analysis

`@conduitcad/renderer3d` uses retained batches and scene-relative Float32 uploads.
WebGPU has depth attachments and four-sample MSAA; WebGL2 has depth testing and
native antialiasing. A bounded software Z-buffer presents pixels through Canvas
when GPU contexts are unavailable. Camera-only changes do not reupload geometry.
Fallback status is visible; fallback execution is never reported as a GPU pass.

A sharp-edge pass suppresses coplanar triangulation seams. CPU picking chooses the
nearest triangle and supports vertex selection and section-plane rejection. A
section plane clips display without modifying native entities; optional native
LINE intersection output is undoable. This is not a capped solid split operation.
Surface area, oriented-volume integrals, volume centroid, boundary edges and
non-manifold/orientation edges are available under **Inspect**. Closed edge
incidence does not prove a mesh has no self-intersections. Overlapping patterned
bodies are measured individually, not automatically unioned.

Text is a simplified screen-facing annotation preview in 3D. HATCH fills and
unsupported spatial entities retain their records and produce diagnostics, not
invented geometry. 2D retains the existing richer text/hatch/line-style renderer.
Perspective/tilted paper viewports, XCLIP, curved ACIS bodies and all DWG semantics
are not implemented by this scene. Legacy smoothed polygon meshes show their
control surface; MESH subdivision is not evaluated. Infinite lines have a finite
3D preview range with diagnostics. Transparency, detailed line patterns and full
font/style fidelity in 3D are not equivalent to 2D yet.

## Exchange contract

ASCII/binary DXF exports contain actual native MESH entities with XYZ vertices and
indexed faces. Modeled meshes have subdivision level zero. Consumed construction
stock uses native hidden flags so other CAD readers see the result rather than
every intermediate stock body. Conduit metadata retains feature IDs, parameter
expressions, dependency IDs and the user's original visibility state. Reimport
restores editable Conduit history. Disabling metadata exports static results;
other applications do not receive executable Fusion or Autodesk action graphs.

OBJ and ASCII STL export the selected mesh's evaluated coordinates. None of these
paths masquerades as an ACIS `3DSOLID`: native SAT/SAB authoring, exact curved B-rep
booleans, assembly joints, CAM, simulation and full Autodesk interoperability are
not included. The existing record-preserving DXF path remains guarded.

## Examples (all editable)

| Drawing | Industry | Main operations |
| --- | --- | --- |
| Mounting bracket | Mechanical design | Union, through-hole cut, linear pattern |
| Four-bolt flange | Piping/equipment | Revolve, circular bolt pattern, cut |
| Process vessel | Process engineering | Revolve, support pattern, nozzle transform |
| Rectangular-to-round transition | HVAC | Two-profile loft |
| Spatial conduit sweep | Electrical installation | Native 3D path, transported profile |
| Parametric fixture grid | Manufacturing | Nested patterns and named expressions |
| Stepped shaft | Rotating machinery | Closed radius/height profile, revolve |
| Ventilated enclosure | Automation | Cavity subtraction, ventilation pattern |
| Pipe manifold concept | Water/utilities | Hollow pipes, spatial transforms, branch array |
| Modeling playground | Learning | Six primitive features and 2D reference outline |

Every starter has deterministic identities and generated `.conduit.json`, ASCII
`.dxf` and `-binary.dxf` files under `samples/3d`. Run `npm run samples:3d` to rebuild.
These are editable concept models, not construction-approved engineering designs.

## Public modules and budgets

`@conduitcad/geometry3d`: Float64 vectors/matrices, OCS frames, triangulation,
primitive/profile meshes, bounded BSP Booleans, mass properties, sections and rays.
`@conduitcad/modeling`: native-curve conversion, atomic WCS controls, transactions,
dependency regeneration, examples, OBJ and STL.
`@conduitcad/renderer3d`: headless scene/camera/picking plus browser backends.
All three ship JavaScript source, explicit TypeScript contracts and MIT licensing.

Mesh APIs default to 200,000 vertices/faces; modeling history is bounded to 256
features, cached in a 48-entry / ~16 MB LRU. Booleans accept at most 8,192 triangles
per input with recursion/split/conforming-work budgets. These are deliberate
failure boundaries, not claims of AutoCAD kernel robustness. Normalized BSP
coordinates reduce scale sensitivity but use finite tolerances. Face vertex IDs
are stable for a given mesh topology, not a universal persistent B-rep naming
system; changes that reorder upstream topology may invalidate face-index intent.
The software fallback limits output to 1.2 million pixels and is not the
high-throughput GPU path. Very large Booleans currently execute synchronously.

## Validation

`tests/modeling3d.test.mjs` covers mass/topology, arbitrary axes, XYZ curves,
regeneration/rollback, native ASCII/binary round trips, depth picking and software
Z-buffer order independence. `tests/browser_modeling3d.py` exercises actual forms,
axis dragging, preview/cancel, undo, 2D/3D tabs, mobile sheets, touch navigation and
real downloads on localhost. `tests/audit_modeling3d.py` independently reopens all
20 DXF files using ezdxf and checks coordinates, indices, topology and volume.
`tests/browser_modeling_backends.py` records actual backend/adapter selection,
pixel comparison and context/device recovery on available software GPU adapters.
Physical iOS/Android, OS keyboards, native AutoCAD/Fusion and hardware-performance
acceptance are separate, unperformed qualifications unless explicitly reported.

Primary format references: Autodesk DXF Reference, MESH, 3DFACE, 3DSOLID and
Arbitrary Axis Algorithm. Product-reference inspiration: Autodesk Fusion timeline
and feature editing. The implementation is original and does not copy either
product's proprietary kernel.
