# Conduit CAD

**Touch-first, DXF-native 2D/3D CAD and diagramming — 0.13.0.**

A local-first HTML/JavaScript application with native CAD entities, engineering
symbols, routed connectors, shared blocks, parametric sketches and a faceted 3D
feature engine. Desktop and mobile use the same document/history model, independent
2D/3D cameras, and 21 reusable ES-module packages. No third-party runtime packages,
CDN assets, accounts or document uploads are required.

[Open the application](https://wieslawsoltes.github.io/ConduitCAD/) ·
[Release notes](RELEASE_NOTES.md) · [Current validation](docs/VALIDATION_LIVE_0130.md)

## New: live design parameters and spatial paths

**Parameters** now keeps the drawing interactive while expressions regenerate the
complete 2D/3D design. Edit expressions, scrub calculated values, inspect dependencies,
filter/add/remove rows and Apply once. Geometry, constraints, calculated annotations,
dimensions, connectors and 3D feature history update in an isolated preview. The
responsive panel can collapse for inspection without losing Apply/Cancel.

**3D → Create → Spatial path** constructs native WCS POLYLINE geometry directly on
XY/XZ/YZ, view or picked-face planes. Drag XYZ handles, enter coordinate expressions,
insert midpoints, remove vertices, close paths and reverse direction. Draft undo/redo
retains the selected physical vertex. Parameter-driven paths regenerate their Conduit
sweeps; camera-only redraws reuse immutable evaluated coordinates instead of reparsing
all path expressions.

**Parametric path workshop** opens an independent editable route, swept body, plate,
planar footprint, circle profile and calculated caption. Change Span, Rise, TubeRadius
or PlateThickness through the live panel, or select the route and edit it on canvas.
Native project, ASCII DXF and binary DXF copies are in `samples/live/`.

![Live design parameters](artifacts/live-canvas-parameters-desktop.png)

[Live workflows and reusable APIs](docs/LIVE_PARAMETERS_PATHS_0130.md) ·
[Mobile path editing](artifacts/live-canvas-path-phone.png) ·
[Earlier published visual editing](docs/PUBLICATION_VISUAL_0120.md)

## Run

Open `dist/ConduitCAD.html` for the single-file application, or serve `dist/`.
Attachment previews may not execute JavaScript. For development, use Node.js 22+:

```sh
node scripts/bootstrap.mjs
npm test
npm run build
npm run dev
```

The development address is `http://localhost:4173`. Bootstrap links local workspace
packages without contacting npm. Use HTTPS for the mobile GPU-capable path; ordinary
LAN HTTP is not secure-origin WebGPU validation. The UI reports the actual renderer
and any fallback reason.

`?renderer=canvas|webgl2|webgpu` selects a 2D backend; use the `renderer3d` parameter
for 3D. `?fresh=1` skips workspace restoration without deleting saved data, and
`?no-sw=1` skips service-worker registration. The standalone does not register one.

## Editing workflows

**Draw and connect.** Open Symbols, choose a master and tap to place. Dedicated grab
handles support drag-and-drop without fighting library scrolling. Connect equipment
ports with routed lines that follow connected geometry. More / Shapes provides native
curves, splines, fills, construction lines, text, leaders and dimension variants.
Exact point entry accepts Cartesian/polar coordinates and parameter expressions.

**Edit on canvas.** Select supported geometry and choose Edit on canvas, or double-click.
Native handles and inline dimensions edit planar curves, weighted splines, text,
dimensions, block placement and dynamic instance values. Move/copy, rotate, scale,
offset and two-line fillet have detached previews. Apply commits one history transaction;
Cancel discards it. Shared-block editing uses an isolated draft and updates its inserts
when saved. Specialist constraint/schema and file-management forms remain available.

**Model in 3D.** Create/Edit uses the manipulator and dimension ribbon by default.
Options stays non-modal; Advanced form remains explicit. Create primitives, extrusions,
revolves, lofts, sweeps, booleans and patterns. Face selection exposes Sketch on face,
Hole, Press/Pull and Look at face. Holes include simple, counterbore and countersink;
extrusions include one-sided, symmetric/two-sided extents, start offset and
New Body/Join/Cut/Intersect. Feature history supports upstream regeneration.

**Inspect without blocking the model.** Drag section-plane offsets, pick measurements,
enter exact XYZ coordinates or preview material changes. Native guide/section lines
are explicit snapshots, not fabricated associative dimensions or solid splits.
Two-finger takeover rolls back an unfinished handle drag before navigating.
Returning to 2D restores the established planar editor and its separate camera.

**Keep drawings independent.** New/Open appends documents. Tabs preserve undo history,
cameras, selection, display settings, original DXF records and unfinished block drafts.
The document manager provides rename, reorder, duplicate, close/save and recently
closed recovery. Export operates on the active document. Browser recovery is not a
substitute for exported external backups.

## Rendering and interface

Sixteen 3D display styles use separate surface, depth, visible/hidden-edge, transparency
and presentation passes. Realistic shading adds GGX metal/roughness materials,
procedural studio lighting, optional shadows and ambient occlusion. Section caps fill
supported closed contours without editing native geometry. Display settings are
independent per document; PNG capture uses the active 3D renderer.

The UI uses 180 original SVG glyphs with Adaptive, Icons and labels, and Compact icons
modes. Accessible command names remain on the real controls. Document names, numeric
values, property labels and critical confirmations stay readable. Find the searchable
Icon guide through More / Shapes, 3D Create, 3D View or Help.

[Rendering contracts](docs/RENDERING_3D.md) · [Iconography](docs/ICONOGRAPHY.md) ·
[Offline icon atlas](docs/icon-atlas.html) · [Mobile UI](docs/MOBILE_UI.md)

## Engineering libraries and DXF

The catalogue contains 223 editable masters in eleven categories, plus 21 connection
styles: P&ID, electrical, flowcharts, instrumentation, hydraulics, pneumatics, HVAC,
water/plumbing, automation, fire-alarm topology and networks. Masters record reference
families and review notes; this is **not blanket ISO/IEC/ISA certification**. Terminal
compatibility is checked before replacing definitions already used in a drawing.
Twenty schematic starters and thirteen 3D starters are available, alongside the
material, visual drafting and live-path workshops.

Native project export preserves Conduit editing metadata. Normalized DXF rebuilds
supported entities/tables/layouts. Record-preserving export retains original records
and applies guarded safe edits. Original-file download returns unchanged imported
bytes. Native DIMENSION graphics, MESH, HELIX, WIPEOUT, OCS/XYZ geometry, hatch
boundaries and paper layouts have documented support. SVG/PNG and application-specific
exports remain available. Consult the compatibility matrix for production exchanges.

This is **not full AutoCAD/Fusion/Visio or universal DXF parity**. The 3D kernel is
faceted, not curved ACIS/B-rep, and does not author native `3DSOLID`. Proprietary
Autodesk action/association graphs are not evaluated. Face/view workplanes are
snapshots, not fully associative supports. Font/Bigfont fidelity, external references
and complete paper plotting remain bounded. Other readers receive evaluated native
path vertices, not executable Autodesk parameter graphs.

## Reusable packages

| Package | Responsibility |
|---|---|
| `@conduitcad/manipulation2d` | Native planar sessions, live parameters, exact fields and handles |
| `@conduitcad/manipulation3d` | Spatial feature/path sessions, world gestures and handle layouts |
| `@conduitcad/icons` | Original SVG registry and immutable discovery data |
| `@conduitcad/geometry` | Planar double-precision geometry and curve evaluation |
| `@conduitcad/geometry3d` | Spatial vectors, transforms and curve geometry |
| `@conduitcad/spatial` | Packed BVH and incremental indexing |
| `@conduitcad/drawing` | Native construction factories and point sessions |
| `@conduitcad/model` | Documents, entities, blocks and portable geometry |
| `@conduitcad/modeling` | Faceted features, topology, booleans and regeneration |
| `@conduitcad/history` | Atomic transactions and bounded undo/redo |
| `@conduitcad/constraints` | Expressions and component-partitioned planar solving |
| `@conduitcad/routing` | Port-aware orthogonal routing and graphs |
| `@conduitcad/symbols` | Engineering masters, connection styles and starters |
| `@conduitcad/dxf` | Typed ASCII/binary readers, writers and preservation |
| `@conduitcad/renderer` | Retained 2D scene, camera and rendering backends |
| `@conduitcad/renderer3d` | Depth-aware rendering, picking and navigation |
| `@conduitcad/input` | Mouse, pen, touch and wheel arbitration |
| `@conduitcad/workspace` | Independent sessions and recovery coordination |
| `@conduitcad/storage` | Browser recovery and downloads |
| `@conduitcad/exchange` | SVG, PNG and application exchanges |
| `@conduitcad/workbench` | Responsive shell, visual tools, inspectors and dialogs |

```sh
npm run pack:packages
node scripts/verify-packages.mjs
npm run samples:live
npm run icons
```

Archives in `artifacts/npm/` are prepared and tested, **not published to npm**.
`@conduitcad` is an implementation namespace, not an assertion of registry ownership.
Rename it to a controlled scope before registry publication. Unpublished interdependent
archives can be installed together with `npm install /path/to/artifacts/npm/*.tgz`.
Public TypeScript declarations accompany the packages; DXF extension data remains
permissively typed where documented. Manipulation sessions are DOM-independent;
the host supplies history, input arbitration and preview presentation.

## Validation and performance scope

The 0.13.0 qualification has 893 passing Node tests, strict TypeScript contracts,
clean offline integration of all 21 packages and a 113-assertion live workspace suite
executed on Canvas, WebGL2 and WebGPU. Inherited editing, mobile, document recovery,
rendering and independent DXF audits remain permanent gates. See the
[current validation record](docs/VALIDATION_LIVE_0130.md) for exact runs and scope.
The normal Pages pipeline validates before deployment and checks live resource hashes.

GPU execution uses Google SwiftShader in CI, not physical graphics hardware. Emulated
touch/keyboard tests do not certify physical iOS/Android, native screen readers or OS
keyboard behavior. Native IndexedDB/Web Locks recovery has separate tests; historical
memory-adapter runs are not reclassified as native-origin or durability evidence.
Earlier validation documents preserve their original execution scope.

Camera changes reproject controls without reparsing unchanged spatial path expressions.
There is no icon font, remote icon loading, MutationObserver or unrelated per-frame DOM
scan. Geometry and topology changes still incur their required uploads. Preview
regeneration clones and solves documents synchronously: no million-entity interactive
solving, hardware frame rate or universal pixel-equivalence guarantee is implied.

## Documentation and license

[DXF compatibility](docs/DXF_COMPATIBILITY.md) · [Drawing tools](docs/DRAWING_TOOLS.md) ·
[Parametric authoring](docs/PARAMETRIC_AUTHORING.md) ·
[Visual 2D editing](docs/VISUAL_EDITING_2D_3D_0120.md) · [Visual 3D editing](docs/VISUAL_EDITING_3D.md) ·
[Live parameters and paths](docs/LIVE_PARAMETERS_PATHS_0130.md) ·
[3D modeling](docs/MODELING_3D.md) · [Face authoring](docs/AUTHORING_3D_090.md) ·
[Symbols](docs/SYMBOLS.md) · [Multi-document workflows](docs/MULTI_DOCUMENT.md) ·
[API examples](docs/API.md)

`apps/studio` is the entry point; `packages` contains reusable components; `scripts`
contains build/sample tooling; `tests` contains validation; `samples` contains drawings;
`dist` contains the prebuilt application. MIT licensed; see `LICENSE` and
`THIRD_PARTY_NOTICES.md`. Drawings are processed locally without telemetry or document
uploads. Always retain exported project backups.
