# 0.9.1 — Coherent CAD iconography

- Add a reusable, DOM-free `@conduitcad/icons` package with 180 original inline SVG glyphs. No icon fonts, CDN, sprite IDs or third-party assets.
- Use semantic glyphs for every native drawing/modeling tool, 3D selection/view commands, editable feature history, body lists, block/constraint actions, parameter fields, document controls and export formats. Replace Unicode stand-ins in 3D example cards and document state indicators.
- Add Adaptive / Icons and labels / Compact icons preferences and a searchable icon guide. Maintain text for operation forms, destructive actions, catalogues and inspector fields.
- Add keyboard/fine-pointer tooltips with Escape dismissal, hover retention, preserved external descriptions, visual-viewport clamping and disposal cleanup. Do not hijack touch long-press or suppress editing gestures.
- Keep rendered command identity and timeline focus during unchanged synchronization. Icon changes do not alter geometry, solver, DXF, undo or persistent document content.
- Add Node semantic/asset safety checks, browser layout/naming/interaction regressions and an offline full-family atlas.

# 0.9.0 — Face-based authoring and simpler desktop/touch 3D workflows

- Simple, counterbore and countersink holes; blind/through-all depth; local U/V
  placement on planar mesh faces; expression-driven dimensions and atomic regeneration.
- Face-incidence guards reject detectable topology changes; explicit reattachment
  and upstream dimensional edits are supported, without claiming persistent B-rep naming.
- One-side, symmetric total-distance and independent two-side extrusion, offset
  starts, profile-normal/custom direction, and New Body/Join/Cut/Intersect operations.
- Native OCS rectangle/circle profile snapshots on picked faces and Look at Face.
- Contextual commands, direct Body/Face/Vertex selection and Orbit/Pan controls,
  stale-preview invalidation, camera-preserving body edits and stable keyboard timeline.
- Phones regain canvas space previously reserved for the hidden 2D dock; the dock
  returns unchanged on switching to planar drawing. Forms show relevant fields only.
- Repair BSP conforming-edge insertion: assign a split vertex to its nearest incident
  edge only; use edge-incidence tolerance rather than half-space classification tolerance.
- Three new example drawings: hole workshop, extrusion extents study and face-mounted
  boss. All thirteen starters export native projects plus ASCII and binary DXFs.
- New headless/public APIs and independent-volume, OCS, rollback, round-trip and
  actual-browser regressions. All eighteen package contracts are version 0.9.0.

The kernel remains faceted and bounded. Hole drill tips/threads, To Object extents,
arbitrary persistent face naming, associative face-sketch support, curved ACIS and
full Autodesk feature graphs are not implemented. See `docs/AUTHORING_3D_090.md`.

# 0.8.0 — 3D mesh modeling and editable industry drawings

- Separate Z-up 3D workspace alongside the retained planar editor; independent
  per-document cameras, shared undo, responsive tools, mode switching and recovery.
- Native XYZ/OCS curves, polygon/mesh faces, nested inserts, depth picking and exact
  WCS editing with guarded planar and attributed-INSERT boundaries.
- Eighteen regenerating feature operations, downstream dependency evaluation,
  transactional rejection, preview/cancel, suppression, bake and axis move handles.
- WebGPU/WebGL2 depth rendering with software Z-buffer fallback, coplanar seam
  suppression, section clipping, native section lines and mesh measurements.
- Ten editable mechanical, process, HVAC, electrical, manufacturing and automation
  examples; native ASCII/binary DXF with construction-stock visibility and
  Conduit feature metadata, plus selected-mesh OBJ/STL.
- Three reusable packages bring the workspace to eighteen modules, version 0.8.0.
- Adds independent DXF audits, spatial geometry/history tests and actual browser
  form/touch/backend tests. The source is reconstructed from verified 0.7.1; no
  missing earlier 3D checkpoint is presented as recovered code.

This is not full AutoCAD/Fusion parity. No ACIS/SAT/SAB 3DSOLID authoring, curved
B-rep kernel, complete 3D constraints, assembly/CAM/simulation, or universal
proprietary feature-graph interpretation is claimed. See `docs/MODELING_3D.md`.

# 0.7.1 — Adaptive mobile tools, dialogs and document tabs

- Shared touch policy extends to coarse-pointer portrait tablets and split-screen hosts.
- Restyled document tabs, reliable active-tab reveal, nonintrusive save-state updates, accessible names, and document-manager rename/rightward reordering.
- Every dialog uses viewport-bound scroll regions, an inert background, trapped/restored focus, keyboard-aware footer placement and serialized confirmation.
- Search covers quick, native and editing tools; mobile command strips preserve exact input, next-point guidance and Finish without redundant zoom overlays.
- Expandable sheets follow measured document/block chrome; inspector tabs expose selected state; dense tables scroll and parameter forms use readable stacked cards.
- Added mobile viewport unit tests and comprehensive browser coverage; permanent Pages CI gates include workspace recovery and mobile tests. Removed the obsolete source-checkpoint importer.
- Fixed an existing browser recovery test race: reopening waits for its asynchronous IndexedDB operation before checking the active document.

See `docs/MOBILE_UI.md` for interaction contracts and physical-device validation limits.

# Conduit CAD 0.7.0 — multiple drawings and mobile workspace

- Independent document tabs retain document/history/selection/camera/layout,
  snapping/layer/library state, accepted drawing commands and isolated block drafts.
- Single active renderer; native multi-file input/drop is ordered and failure-safe.
  Cross-document paste remaps colliding block names and preserves existing masters.
- Document switcher provides search, duplicate, reorder, close, reopen saved closed
  drawings and Save all. Save-and-close waits for successful device checkpoints.
- Serialized revision-aware checkpoints atomically write open records and manifest
  to IndexedDB; single-value localStorage fallback, legacy autosave migration,
  per-window namespaces, guarded Web Locks ownership and non-destructive recovery.
- Mobile 44px scrollable tabs, expandable inert-hidden sheets, compact landscape
  controls/rail, safe-area handling and VisualViewport-driven keyboard layout.
- New DOM-free @conduitcad/workspace; all fifteen package archives versioned 0.7.0.

Validation: 450 Node tests (35 new); 55 new browser workspace/mobile checks locally,
plus six native IndexedDB/multi-window checks when run on localhost. The 246 inherited integrated
browser checks remain. Browser execution is Canvas 2D and emulated touch. Local
recovery tests use real fallback serialization over test memory Web Storage; CI
runs the production app on localhost with native IndexedDB. No physical-device
keyboard, storage durability or hardware GPU qualification is implied.

Recovery does not persist undo/redo or clipboard; a Test Block recovers its master
draft rather than scratch history. No cloud sync, concurrent collaborative editing,
workspace file container or universal foreign-DXF-object cloning is added.
See docs/MULTI_DOCUMENT.md and docs/VALIDATION.md.

---

# Conduit CAD 0.6.0 — expanded native drawing tools

- 28 new drawing workflows across 15 native DXF entity families, in a searchable
  desktop/mobile tool catalogue and the same isolated graphical block editor.
- Three-point/center arcs, additional circles, ellipses/elliptical arcs, C1
  through-point cubic splines, Bézier controls, polygons, donuts/discs, SOLID,
  planar 3DFACE, native hatches/masks, construction geometry, MTEXT and leaders.
- Aligned/axis/radius/diameter/angular/ordinate construction with explicit point
  prompts and the existing native managed-dimension regeneration/export engine.
- Reusable `@conduitcad/drawing` factories and staged sessions; live previews,
  Finish/Close/Back, exact Cartesian/polar expression input, safe retry and repeat.
- Native arc/ellipse/spline/direction/hatch grips; exact vertex/control tables;
  multiline content, ellipse parameters and polyline width inspectors; undo/redo.
- Native curve-boundary hatch snapshots with even-odd islands and user-defined
  line/cross patterns. Correct bulge midpoints, ellipse and curve endpoint snaps.
- Viewport-clipped infinite construction geometry now remains pickable away from
  its origin, including nested references, without distorting finite fit bounds.
- All fourteen reusable packages versioned 0.6.0 with typed public contracts.

Executed validation: 415 Node tests (83 new), 246 integrated browser checks
(83 new), 148 independent drawing-tool DXF field checks across ASCII/binary,
all prior native interop/editing/parametric/symbol/fidelity audits, TypeScript
consumers and clean offline integration of fourteen npm archives. See VALIDATION.md.

The new tools author XY geometry at Z=0. Splines are C1 Hermite-derived native
B-splines, not Autodesk FIT/C2 parity. LEADER is not MLEADER. Hatch snapshots are
not associative; faces are not B-rep solids. Existing annotation/font and DXF
boundaries remain. Browser tests use Canvas and emulated touch, not physical-GPU
qualification. See docs/DRAWING_TOOLS.md for precise behavior and limits.

---

# Conduit CAD 0.5.0 — shared block editor and parametric authoring

- Isolated graphical native block canvas with save/save-close/discard/test,
  save-as, base/port editing, attribute definitions and native nested placement.
- Atomic shared-definition commits update direct and transitive nested inserts,
  retained per-instance parameters/values, routed connectors and dimension pictures.
  Cycles, stale sessions, invalid variants and removed connected ports are refused.
- Block manager creates/inserts/edits/deletes unused definitions; unique copies,
  shared renames and explicit attribute synchronization are undoable.
- Native ATTDEF/ATTRIB tag/prompt/flags round-trips, constant-attribute rendering,
  per-instance editing and affine attribute frames for reflected/nonuniform inserts.
- Constraint-based schema v2, derived parameter expressions, polar/polar-array
  actions, graphical parameter/action forms, solved ports, dimensions and text.
- Analytic forward derivatives, scaled connected components, damped pivoted QR,
  local rank/DOF/redundancy/residual reports, locked-geometry protection and atomic
  failure. Supports 23 relation types on the documented planar parameterization.
- Named driving-dimension dependencies, reference measurements, explicit auto
  constraints, driving dimension UI, live authoring labels and calculated native TEXT.
- All 13 packages, typed public APIs, DXF metadata and regression pipelines updated.

Executed: 332 Node tests; 163 integrated browser checks (125 existing + 38 new);
60 new independent native-field checks across four ASCII/binary editable/baked
files, plus prior native dimension/interop/fidelity/symbol audits. No audit repairs.
Canvas 2D and emulated-mobile testing; no physical GPU qualification is implied.

This is not full AutoCAD parity: proprietary action/association graphs are not
executed; advanced visibility/lookup/crossing definitions still use schema fields;
3D/arbitrary curve solving, complete annotation/font styles and comparative solver
robustness remain outside this release. See docs/PARAMETRIC_AUTHORING.md.

---

# Conduit CAD 0.4.0 — dimensions, parameterized blocks and gradient rendering

- Pure planar decimal dimension regeneration for native subtypes 0–6. Generated
  LINE/ARC/SOLID/TEXT pictures remain native anonymous DXF BLOCKs. Existing foreign
  pictures are preserved until the user explicitly opts in to regeneration.
- Undoable text/precision/size/arrow/gap/offset edits, witness/line/text grips,
  reset text placement, and source-point associations for lines and radii.
  Regeneration prepares every associated update before applying any of them.
- Native ACAD/DSTYLE override read/write and stable app metadata in ASCII/binary
  round-trips. Referenced source changes update managed dimensions; deleting a
  source detaches its references. Unsafe planes, invalid numbers and shears fail.
- Conduit dynamic schema v1: numeric, distance, angle, integer, Boolean and enum
  parameters; move, stretch, rotate, scale, flip, array, visibility and topological
  lookup actions. Crossings/partial arcs and unsupported mirrors are rejected.
- Pristine per-instance evaluation with bounded variant caching, named-port
  updates, route refresh, parameter/visibility inspector, linear/angle grips,
  private-master JSON authoring and a working parameterized duct example.
- Normalized DXF exports evaluated native anonymous blocks; app metadata recovers
  editable masters on reimport. No proprietary Autodesk action-graph execution is
  claimed. Unreachable generated pictures are pruned without deleting statically
  referenced variants. Oversized XDATA is refused instead of silently corrupting DXF.
- Unshifted two-explicit-color LINEAR HATCH gradients render in Canvas and SVG/PNG
  with affine block transforms, clipping and islands. Other distributions retain
  their native tags and explicit flat-preview warnings. Native rotation updates
  the gradient angle; no gradient shader/GPU-equivalence claim is added.
- All thirteen packages are 0.4.0. Typed public APIs, tests, browser downloads,
  independent native-field validation, sources and reproduced artifacts included.

Validation: 249 Node tests, 125 integrated browser checks (101 existing + 24 new),
66 new independent native dimension/variant audit checks, existing 110 interop
checks and symbol/fidelity audits. Browser execution uses Canvas 2D, with a
standalone test-memory store locally and localhost delivery in CI. No physical
GPU, production-storage durability or universal AutoCAD certification is implied.

---

# Conduit CAD 0.3.0 — native DXF interoperability

- Shared bounded ASCII/binary tag codec: explicit scalar types, exact decimal
  int64s, finite/integer/count guards, binary chunk validation, R12 code widths,
  second-pass legacy text decoding, Unicode-safe MTEXT chunks and binary output.
- Native DIMENSION types 0–6 and type flags, definition points, dimension styles
  and graphics blocks. Authored aligned dimensions export as native DIMENSION
  records plus generated anonymous pictures, without flattening the entity.
- Required tables, ownership chains, root/layout dictionaries, multiple paper
  block records, inactive-layout entity recovery, viewport reference remapping,
  frozen layers, and a valid HANDSEED. Normalized handle allocation never rounds
  64-bit source handles to unsafe JavaScript numbers.
- Orthographic top-view paper viewports, DCS target/center/twist transforms,
  rectangular and supported closed polygon/curve clipping in Canvas/SVG/PNG.
  Clipped-away paths are not picked; layout extents do not include hidden model
  contents. Perspective/tilted/depth-clipped views are diagnosed, not fabricated.
- Native MESH topology and Z, HELIX analytic fields and spline representation,
  and WIPEOUT masks with normalized-image boundary conversion. This is wireframe
  mesh/helix display, not solid modeling or subdivision surface evaluation.
- Source-record-preserving mode retains arbitrary unknown records, classes,
  handles, dictionaries, extension data, binary chunks and XDATA. It allows only
  explicitly mapped unreferenced coordinate/scalar edits and rejects unsupported
  structural or dependency-sensitive changes. Original-byte export remains separate.
- File opening/recovery and cancelled library previews no longer install unused
  symbol definitions. Native dimension block grips are withheld to prevent stale
  anonymous pictures. Real binary downloads and mobile export controls are tested.
- All 13 reusable packages, declarations, tests and generated deliverables updated.

Validation: 206 Node tests; 101 integrated browser checks (76 existing + 25 new),
110 independent native-interchange audit checks plus the existing fidelity and
symbol/sample audits. New browser checks use real File/Blob workers and saved
binary downloads, with Canvas 2D pixel tests. They are not physical-device GPU
benchmarks or an AutoCAD certification. See docs/VALIDATION.md for reproduction.

This release does not claim every DXF feature: full fonts/Bigfont, dynamic-block
or associative evaluation, ACIS solids, external references/images/underlays,
all complex entities, XCLIP and complete 3D plotting semantics remain incomplete.
Gradient tags remain native; gradient preview is still flat-color. Unknown
semantics can be retained in preserving mode without being edited or rendered.

---

# Conduit CAD 0.2.1 — engineering symbol libraries

223 original masters in eleven categories, up from 64 in three; 21 connection
styles and 20 editable industry starters. All thirteen packages are versioned
0.2.1. The original symbol IDs, block names and named terminals remain available.

The catalogue uses explicit ISO 10628-2, ISO 1219-1, IEC 60617, ISA-5.1 and ISO
5807 reference families where relevant. Other forms are labeled project
conventions. This is a geometry/convention review, **not normative dimensional
certification or engineering approval**. See docs/SYMBOLS.md and the generated
per-master ledger/visual atlas for scope and audit details.

Native curves, valve geometry, electrical alternatives, liquid/gas triangles,
actuator states, instrument location lines, valid ellipse axes, inherited fills,
preview text bounds and endpoint-body routing were corrected. The workbench adds
category/family search, a searchable industry chooser and explicit undoable saved
master updates; browsing or installing never silently replaces user definitions.

Validation: 164 Node tests, 76 integrated browser checks (Canvas 2D), strict
TypeScript contracts, clean offline package integration and independent ezdxf
audits of 223 masters and twenty starters. New tests distinguish automated
geometry checks from standards approval. This release adds no claim of new font,
dynamic-block, ACIS/3D-solid or physical-device GPU functionality.

---

# Conduit CAD 0.2.0 — DXF fidelity and touch editing

This release expands the native interchange/model/rendering pipeline, rather
than flattening imported CAD into an image. All 13 reusable modules are versioned
0.2.0; generated app/package artifacts are rebuilt from source.

## DXF and rendering

Native solid/pattern HATCH paths with bulge, line, clockwise/counterclockwise arc,
ellipse and rational spline edges; normal/outer/ignore islands; bounded pattern
scan conversion; retained native gradient tags with a diagnosed flat preview.
Variable-width bulged ribbons, 3D polyline/polyface/polygon-mesh wireframes,
hidden 3DFACE edges, LEADER, viewport-bounded RAY/XLINE and OCS projection.

Improved TEXT alignment/fit/second points/style/oblique data and MTEXT attachment,
wrap, scoped formatting, affine placement and masks. Correct foreground/background
ACI/true-color separation, alpha semantics, signed linetypes, global/entity
scales, lineweights and double-precision decimal export. Native export is tested
against a separate 37-entity ezdxf-authored fixture, not only self-roundtrips.

Canvas/SVG/PNG carry compound holes and opacity. Ordered fidelity compositing
prevents later fills being placed behind earlier lines. GPU strokes remain the
fast path for compatible scenes; filled/masked/long-dash/dotted scenes select
Canvas 2D explicitly rather than silently sacrificing order or dash content.

## Touch, clipping and symbols

Real drawing/overlay clipping excludes rulers, and ruler input cannot start an
edit. Dedicated 44px symbol grab handles reserve touch gestures before capture,
while cards remain scrollable and tap-to-place. Portrait/landscape spacing,
focus, overflow and safe-area behavior are refined. Non-default OCS raw grips
are withheld rather than shown at incorrect positions; body dragging is projected.

64 original masters now have connected leads and terminal-geometry checks.
Revised valve/check-valve, instrumentation, diode/ground/contact and flow geometry
plus eight additional variants improve convention clarity. New project examples
use geometry revision 2; saved user masters are not silently overwritten.
These are original, non-certified symbols, not a claim of IEC/ISA/ISO compliance.

## Validation and remaining boundaries

124 unit tests; 29 established browser workflows plus 14 new pixel/import/touch
checks; strict TypeScript consumer compilation; independent normalized-fixture
and sample audits with zero errors/repairs. Actual browser execution is Canvas 2D.
Hardware WebGPU/WebGL2, real-device storage/PWA durability and complete CAD-system
interoperability are not certified. Full fonts, XCLIP/layout clipping, associative
regeneration, dynamic blocks, object graphs and 3D solid modeling remain open.

See docs/DXF_COMPATIBILITY.md, docs/SYMBOLS.md and docs/VALIDATION.md for exact scope.

---

# Conduit CAD 0.1.0

Initial working touch-first 2D CAD and engineering-diagram editor, built from
13 native JavaScript packages. The source and generated standalone application
are supplied under MIT, with third-party notices for the ACI palette.

## Delivered

- Mobile portrait bottom sheets, landscape tool rail, desktop workbench, shared
  pointer gestures, pinch-pan, precision magnifier, snapping and numeric editing.
- Native CAD entities and symbol blocks, 56 illustrative engineering masters,
  10 line styles, obstacle-aware connectors, tags and editable sample drawings.
- Planar geometry, parameters, a bounded sketch solver, undo/redo, layer controls,
  QA checks, DXF/project/SVG/PNG/CSV/graph exchanges and local persistence code.
- ASCII/binary DXF input, normalized ASCII R2000–R2018 output, original-file
  preservation, XDATA metadata and an explicit compatibility matrix.
- Retained batched strokes, WebGPU compute culling and indirect drawing code,
  WebGL2 instancing, Canvas fallback and same-topology incremental scene updates.
- Offline build tools, modular source files, TypeScript declarations,
  complete npm tarballs, examples, technical documentation and test reports.

## Validation

86 Node tests, 29 integrated browser checks, strict TypeScript consumer validation,
13-package offline install/import integration, and three independently audited
DXF samples with zero reported errors or repairs. Synthetic CPU performance
measurements are included; they are not GPU/FPS/mobile benchmarks.

## Explicit limits

This release is not full AutoCAD or Visio parity and does not implement every DXF
entity, object graph, layout or 3D feature. Normalized edited DXF output can omit
unsupported data. Original-file export is distinct from edited export. Symbols
are illustrative rather than standards-certified. The sketch solver is bounded
and the geometry kernel is planar.

The delivery browser exercised Canvas 2D; GPU drivers/shaders and device loss
were not executed on real hardware. Browser storage durability, installable PWA
behavior, actual download flows and real-phone/pen acceptance remain open tests.

Read `docs/DXF_COMPATIBILITY.md`, `docs/VALIDATION.md` and `docs/ROADMAP.md` before
using this release for production drawing exchange.
