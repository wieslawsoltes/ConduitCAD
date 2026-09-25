# Architecture and rendering contract

## Native construction sessions

`drawing` provides the 28 tool descriptors, native construction factories and
`DrawingSession` without DOM or renderer dependencies. `workbench` shares those
factories between pointer picks, previews, coordinate commands and block authoring.
A draft never mutates the model; a completed entity enters history, solving and
render invalidation through the existing edit transaction. Invalid completion
leaves prior picks available for correction. See DRAWING_TOOLS.md.

## Ownership and boundaries

`model` owns a JSON-serializable DXF-oriented document. Geometry is expressed as
native entity records, not SVG elements. `INSERT` records reference named block
definitions; block ports are local coordinates transformed through insertion,
rotation and scale. Connectors are `LWPOLYLINE` entities whose extra `connector`
field references stable entity IDs and named ports. A connector's geometry is
usable without interpreting its application metadata.

The kernel, document, expressions, routing, spatial index, DXF parser and history
have no DOM dependency. `renderer` exports a DOM-independent scene compiler and a
browser canvas host. `input`, `storage`, PNG export and `workbench` use browser
APIs. Package imports have no external runtime dependency; the DXF package
contains a small attributed numeric ACI palette.

The workbench is a full-page application shell with application-wide CSS,
modals and keyboard handling. It is not yet a fully CSS-isolated, multi-instance
control. Use the lower-level packages to integrate with another UI framework,
or isolate the complete workbench in an iframe. There is no React requirement,
WebView dependency, server-side renderer or cloud service.

## Editing pipeline

1. `PointerController` normalizes mouse, touch and pen events. It captures the
   active pointer and cancels a one-finger edit when a second pointer starts a
   pinch gesture. The workbench resolves coordinates through the camera.
2. A BVH query finds nearby entities. Fine hit testing operates on geometric
   paths, with enlarged screen-space targets for touch. Snap candidates include
   endpoints, midpoints, centers, quadrants, ports and nearby line intersections.
3. A synchronous history transaction captures the JSON document before an edit.
   Dragging updates selected entity geometry and relevant connector routes.
4. The small-sketch solver runs at edit commit. Conflicts or failed convergence
   restore the pre-edit state rather than accepting an invalid solution.
5. The renderer is invalidated and the autosave is debounced. The host receives
   a `conduit:change` event with the current document.

Undo uses bounded full snapshots, not a journal of entity deltas. This is simple
and robust for small drawings but has whole-document memory/latency costs. The
current limit is 80 entries and a serialized-string budget target; one oversized
transaction is retained. Renderer caches and GPU resources are not serialized.

## Geometry and precision

The document and all geometric calculations use JavaScript numbers (Float64).
Affine transforms follow a right-handed, Y-up model. The camera converts to
screen Y-down coordinates and zooms around a stable world-space anchor.

The kernel implements projections, line intersections, polygon containment,
arc/bulge tessellation, rational de Boor evaluation, bounded-miter polyline
offsets and two-line tangent fillets. Curves are tessellated adaptively with a
screen-derived world tolerance; block scale is accounted for in curve tolerance.
There are explicit subdivision ceilings. Bounds and text metrics are partly
approximate, rather than exact analytic bounds for all entity types.

This is **not** a robust exact-predicate topology library, general polygon
Boolean engine, 3D B-rep kernel, solid modeler, complete UCS/OCS system or feature
history CAD modeler. The editing UI is oriented to rigid/uniform transforms;
not every primitive supports arbitrary nonuniform transforms or reflection.

## Rendering

### Scene representation

`buildScene(document)` expands supported entities into portable paths and text,
a spatial index, per-entity spans and a contiguous stroke array. Coordinates
are rebased around the scene origin before Float32 upload, retaining more useful
precision than sending large absolute world coordinates directly to the GPU.
The original document remains Float64 and is never replaced by tessellation.

Each stroke segment occupies 64 bytes: endpoints, RGBA color, CSS stroke width,
dash lengths and cumulative path phase. Up to six dash components are represented
in the GPU paths. Tessellation and native block occurrence expansion occur on
the CPU; this release does not use persistent GPU block instancing.

### WebGPU

Geometry is uploaded into persistent storage buffers, split by device limits
and a 200,000-segment batch ceiling. Each frame uploads only camera uniforms
and resets indirect draw counts. A 64-thread compute kernel checks viewport
intersection and appends visible segment indices using an atomic counter.
Instanced quad strokes use those compacted indices through indirect draws.
Fragment shaders implement round-cap stroke distance coverage and dash phases.

The engine checks compilation diagnostics, installs device-loss / uncaptured-error
handlers and switches to a fallback backend on failure. Replacing the canvas
avoids trying to acquire incompatible context types on one canvas element.
Hardware execution of this path was **not available in the delivery container**.

GPU buffer upload ranges use an `ArrayBuffer` and byte offsets explicitly.
WebGPU's `writeBuffer` offsets are element-based for TypedArray sources but
byte-based for ArrayBuffer sources. This distinction is covered by the selected
implementation; see the normative reference in `REFERENCES.md`.

### Incremental edits

`updateSceneEntities` patches equal-topology edits without reallocating the
stroke array or changing unrelated entity spans. The workbench uses this for
move/grip previews and their rerouted connectors. WebGPU writes only overlapping
buffer ranges; WebGL2 uses `bufferSubData`. The BVH uses an update overlay and
periodically rebuilds when the overlay becomes large.

When path/text/segment cardinality changes, an entity is added or removed, a
layer/global style changes, a new document is assigned, or curve LOD changes,
the renderer can rebuild the complete scene. The partial-update lookup still
scans the document, and whole-document commit/history costs remain. This is not
an out-of-core or million-entity editing performance guarantee.

### Fallbacks and compositing

WebGL2 uses instanced triangle strokes without the compute-culling pass.
Canvas 2D provides the final fallback. Text, grid, selection UI and solid-fill
backgrounds use Canvas 2D even when strokes use WebGPU. Scenes requiring fills, background masks, long dash arrays or zero-length ink
dots use the ordered Canvas 2D fidelity compositor. Entity sequence, compound
island holes and opacity are preserved instead of putting every fill below all
strokes. Arbitrary SORTENTSTABLE and nested block draw ordering remain incomplete.
Text uses browser fonts, not the original DXF SHX/TTF font machinery.

Rendering is demand-driven through requestAnimationFrame, not an idle loop.
Displayed frame duration is CPU elapsed time through drawing/submission. No GPU
timestamp query or inferred FPS metric is presented as a measured GPU time.

## Parameters and routing

Expressions are parsed with a dedicated arithmetic grammar: no `eval`, dynamic
function generation, property access or executable user code. Named dependencies
and cycles are handled explicitly. The solver uses finite-difference Jacobians
and damped least squares, with a 180-scalar-variable cap and convergence report.
It does not perform a complete symbolic rank / degrees-of-freedom analysis.

Routing uses fast orthogonal candidates followed by directional-state A* on an
obstacle-derived coordinate grid. Cost includes path length and bends. Obstacles
are inflated by clearance, with a spatial index for intersection queries.
Endpoints have explicit leads; user waypoints split routing into sections.
Routing-budget exhaustion and collisions produce `blocked`, not a false success.
Global route crossing minimization, shared trunks, line jumps and full port
capacity/type rules remain to be added.

## Build and deployment

`scripts/build.mjs` is an offline bundler for the project's named ESM imports and
exports. It rejects syntax outside its supported bundling subset. It is not a
general npm/TypeScript/Rollup replacement. The package source remains normal ESM
and can be consumed with standard tools.

The build emits a static site, an embedded DXF import worker, an optional
service worker and a single HTML file. The worker prevents parsing from blocking
the interactive UI, but the complete file and parsed result are still retained
in memory. Imports have a 128 MiB input ceiling, group-code/recursion limits and
an application worker timeout. These limits are safeguards, not a security audit.


## 0.2.0 native fidelity stages

The DXF helper retains hatch boundary types, pattern lines and coordinate-system
properties. Model tessellation projects native OCS values without replacing the
source entity. Compound paths carry contours and fill rules; text carries an
affine frame and layout metadata. SVG/PNG share this portable geometry and text
layout. Meshes remain indexed native entities and display as planar wireframes.

The canvas clip is a first-class drawing boundary: grid/rulers, geometry,
selection and pointer acceptance share the same ruler exclusion. GPU scissor
coordinates use device pixels; Canvas clips and pointer coordinates use CSS
pixels. Infinite entities are clipped to the current view and rebuild when the
view changes. Camera-only movement still retains ordinary finite stroke scenes.

Hatch scan conversion is bounded, returns density-limit diagnostics, and computes
holes by even-odd topology. Flat gradient preview is deliberate; native gradient
data remains available for exchange. Signed linetypes preserve leading gaps and
dots. Ordered compositing prioritizes fidelity over claiming all-GPU execution.
