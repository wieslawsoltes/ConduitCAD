# On-canvas 3D editing — 0.11.0

## Start with the geometry, not a modal form

The default 3D Create command opens a searchable, non-modal tool palette. Choosing a
tool replaces the general model dock with a compact visual-edit ribbon. The canvas
remains navigable and interactive. A transient shape is shown immediately when inputs
are complete; colored handles and tappable dimensions track its world geometry.

- **Create a primitive:** 3D → Create → Box, cylinder, cone, sphere, torus or wedge.
  Drag a size handle, tap a dimension for an expression, or use Position to move the
  primitive. The Place chip picks an XY placement; Z remains an exact/axis control.
- **Make a sketch:** Planar sketch profile creates a native rectangle/circle on XY,
  XZ or YZ. Size and origin are editable before Apply. Select it and choose Extrude.
- **Extrude:** pick a profile, drag height along its actual OCS normal, and select
  one-side, symmetric total length or two-side extents. A two-side operation exposes
  opposite handles; symmetric height handles change the total extent, not half-length.
  New Body, Join, Cut and Intersect and target picking are available in-place.
- **Work from a face:** select Face, tap a planar mesh face, then Hole, Sketch on
  face or Press/Pull. Hole U/V placement has a planar drag handle; diameter, depth and
  recess dimensions have axial handles. Simple, counterbore and countersink choices
  expose only their relevant fields. Pick a different support directly from the model.
- **Move/rotate/scale:** select a body and choose Move/rotate. World translation axes,
  XY planar movement, oriented Euler rotation rings and rotated scale axes share one
  draft. A new transform defaults to the stock center; exact pivot coordinates remain
  in Options. Existing transforms without pivot values retain the legacy origin pivot.
- **Edit a vertex:** select Vertex and a native control point, then Edit vertex.
  Feature-generated geometry requires an explicit Detach and edit choice. The live
  feature graph is untouched until Apply; downstream features regenerate together.
- **Edit an existing feature:** select Edit on canvas, double-click an editable
  feature, or activate the feature timeline. The same handles and exact fields apply.
  An unchanged existing feature closes without adding an undo entry.

All 22 palette entries have non-modal parameter editing and on-model source picking.
Boolean tools pick operands; sweeps pick profile/path; lofts expose ordered section
chips with add/remove controls, up to 32 sections. A control without a useful geometric
handle stays an exact field, dropdown or source chip rather than becoming a misleading
free-drag operation. The legacy advanced authoring form is still explicitly available.

## Interaction contract

| Action | Result |
|---|---|
| Drag a colored arrow/plane/ring | Update the isolated preview, never the live drawing |
| Tap a dimension/ribbon value | Open a small exact value/expression entry without a modal backdrop |
| Set / Enter in exact entry | Validate and update the preview |
| Apply / Enter from the canvas | Validate the current revision and commit one history transaction |
| Cancel | Discard draft geometry; restore pre-edit selection and automatically framed camera |
| Undo draft / Redo draft, Ctrl/Cmd+Z/Y | Restore a prior draft without changing drawing history |
| Escape | Close exact entry first, then Options, then cancel the active draft |
| Two fingers during a handle gesture | Revert the incomplete handle drag before pan/pinch navigation |
| Resize/orientation change during drag | Cancel that incomplete gesture; retain the operation |

Length snap defaults to one drawing unit, with a configurable increment. Shift uses a
tenth increment; Alt disables snap. Angles use 15 degrees (Shift: 1 degree), scale
uses 0.1 (Shift: 0.01). Touch can toggle snap and enter exact expressions without
hardware modifier keys. Keyboard-focusable scalar handles accept arrow increments;
Enter opens their dimension field. Plane movement has accessible exact components in
the ribbon. Names are preserved alongside decorative SVGs; no color-only identity is
required to read a dimension.

A parameter such as `Width / 2` dragged by ten units becomes `(Width / 2) + 10`,
retaining its dependency. Each pointer sample uses the initial expression/value;
expressions do not nest once per movement event. Setting a numeric value deliberately
replaces the expression. Unsupported expressions remain in the correction UI and
cannot cause Apply to silently accept the older valid preview.

## Desktop and touch layout

The canvas overlay is scoped to 3D. Desktop keeps a bottom dimension ribbon and an
optional non-modal side Options region. Phones and short landscape layouts use the
same controls with horizontal scrolling, 44-pixel hit targets and 16-pixel fields.
Apply and Cancel are outside the scrolling utility strip and remain visible even with
Icons and labels selected. Low-priority dimension badges may be hidden on small views;
all values remain available in the ribbon.

Projected handle packing separates 44-pixel hit regions and places dimension badges
away from every handle. A displaced handle has a leader back to its actual geometric
anchor; dragging is still relative to that anchor. Projection-visible points outside
the usable rectangle are clamped into reach. A tiny viewport may hide a handle rather
than allowing it to spill onto other controls.

An empty drawing's new primitive/profile is initially fitted to the unobscured canvas.
Editing existing bodies does not auto-fit on every preview. Fit preview is explicit.
The inline exact editor tracks the reduced visual viewport; keyboard-sized views
reduce other chrome rather than covering the confirmation controls. Closing inline
entry returns focus to the canvas. Browser emulation does not establish actual iOS or
Android keyboard behavior.

The existing icon-label preference is honored. Options/palette are named, non-modal
regions, not focus-trapping dialogs. The rest of the application remains operable.
Changing document, leaving 3D, closing a modal, or making an unrelated history edit
cancels the visual draft. Unapplied visual drafts are not persisted across contexts.

## Transaction and rendering architecture

`@conduitcad/manipulation3d` is the twentieth reusable package. It contains tool
metadata, `VisualEditSession`, camera-based gestures, geometric handle descriptors and
screen packing. It imports no DOM, renderer or browser storage. Public declarations
are checked by a strict TypeScript consumer. `VisualEditing3D` in the workbench owns
HTML, shared pointer arbitration, lifecycle cleanup and preview scheduling.

The state transition is:

```text
begin → isolated source snapshot → draft parameter/input edits
      → [coalesced evaluation → validated preview | correctable error]
      → Apply → unchanged-source check → one host history transaction → close
      → Cancel/context change → release draft, restore live scene → close
```

Source identity, version and a full serialized signature prevent overwriting a changed
drawing. Each preview revision is evaluated from the pristine source snapshot using
the existing feature evaluator. Stable temporary result identity avoids per-frame
entity churn. An unchanged revision reuses its evaluated document; invalid edits clear
old geometry. Apply evaluates the same revision, not a second approximate construction
path. The preview API is read-only by contract: consumers must not mutate its internals.

Preview requests are coalesced to one synchronous evaluation per animation frame.
Camera-only motion updates projected controls without regenerating geometry. Geometry
changes upload a new preview scene, as required by the current retained renderer.
All sixteen 0.10 display styles remain selectable and render the same preview data.
The handle overlay is separate from native geometry and exported files.

## Projection mathematics and limits

Axis movement constrains the pointer ray against a fixed world axis. Near-parallel
view/axis configurations have a stable screen-vertical fallback scaled at the anchor.
Planar movement intersects a frozen camera ray with an orthonormal U/V support plane.
Angular movement uses signed `atan2` coordinates and unwraps across ±180 degrees to
support more than one turn. Behind-eye and edge-on plane/ring solutions are rejected;
orbit to see the plane rather than accepting numerical explosions. Frozen projection
state prevents camera changes within a gesture from changing the measurement scale.

The current projection adapter follows Camera3D: Z-up basis, orthographic or the
existing fixed 45-degree perspective vertical field of view. Custom camera adapters
must follow that contract. World calculations use JavaScript double precision. Length,
angle and scale handles use explicit conversion factors; diameter is twice radius and
symmetric extrusion is twice its dragged half-extent.

Transform pivot support is implemented in the shared feature evaluator as
`T(pivot) · transform · T(-pivot)`. Default zero values reproduce existing files;
new visual transforms choose stock center. Rotation/scale handles follow the same
Euler ordering as the evaluator. This does not add component assembly joints or a
new geometric constraint system.

## DXF and 2D preservation

Results remain native DXF MESH, CIRCLE, LWPOLYLINE and existing spatial entity types,
with Conduit feature metadata where enabled. No fake native 3DSOLID is emitted.
Profiles on faces and fixed planes are snapshots, not a complete associative sketch
editor. Direct feature-vertex editing explicitly bakes the source feature. Existing
safe export, source graph, lock, numeric and topology restrictions continue to apply.

The 2D renderer, drawing tools, geometry kernel, camera and multi-document histories
retain their existing path. Shared history receives only accepted edits. The original
advanced form APIs remain callable; hosts can explicitly set
`modelingInteraction: 'dialog'` for that interaction style. The default is visual.

## Remaining boundaries

Material, display-style, section/measurement and other specialist inspectors are not
all converted to manipulators. Their existing dialogs/panels remain available. This
release replaces the primary geometry-authoring forms; it does not claim every dialog
has disappeared or full Fusion interaction parity.

Preview cloning and feature regeneration remain CPU/synchronous and bounded by the
existing faceted kernel. Large meshes may stall a frame; request coalescing is not
worker cancellation or a physical-mobile performance guarantee. There is no new
ACIS/B-rep kernel, native Autodesk feature-graph evaluator, arbitrary persistent face
naming, curved fillet/shell engine, mesh sculpting brush or dimensioned 3D assembly
solver. The 0.10 WebGPU display graph remains subject to native-origin execution
validation; local Canvas and WebGL2 evidence is not a WebGPU pass.
