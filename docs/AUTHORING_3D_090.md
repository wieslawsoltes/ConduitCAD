# Face-based 3D authoring — 0.9.0

This update extends ConduitCAD's faceted feature engine and shared desktop/touch
workbench. It is not a replacement for an exact curved B-rep kernel, and does not
claim full Autodesk Fusion or AutoCAD interoperability.

## Face-first workflow

Create a box or open a 3D starter, select **Face** in the canvas toolbar, and tap a
planar mesh face. Context commands appear in the existing bottom command strip:
**Sketch on face**, **Hole**, **Press/Pull**, and **Look at face**. Body and Vertex
selection are explicit modes; Face/Vertex selection do not display body-translation
handles. Orbit/Pan, Multi and Clear are directly reachable without opening View.

Sketch on face creates a native `LWPOLYLINE` rectangle or `CIRCLE` in the selected
face's OCS plane. Width/height/radius, local U/V position, and normal offset accept
design parameter expressions. These profiles are **snapshots**, not associated
face sketches: editing their support later does not move their plane. Their native
geometry can be edited in the existing 2D/3D control editors and extruded using
profile-normal direction. No opaque mesh-only substitute for the profile is used.

Look at face centers the orthographic camera and aligns it to the face normal.
Each drawing still retains its separate 2D camera. **2D Draw** returns to the
unchanged planar tools; switching modes does not project spatial geometry into XY.

## Extrusion extents and operations

- One side: signed distance, including reversed direction.
- Symmetric: positive **total** length split equally about the offset start plane.
- Two sides: independent positive side-one and side-two distances.
- Start offset: signed translation of the start plane along the chosen direction.
- Direction: profile normal or an explicit XYZ vector. New UI operations default
  to profile normal; existing headless/serialized features retain their legacy
  custom/world-Z default unless `useNormal` is explicitly set.
- Operation: New Body, Join, Cut, or Intersect. The last three require a target mesh
  and become a single two-input feature. Source profiles and target stock are
  consumed through the existing history/visibility model, not destructively erased.

The existing taper value is a linear top-scale change, **not a draft angle**.
Two-sided extrusion currently has one continuous taper over the complete span.
To Object/Next, independent side tapers, hole-bearing profiles and exact analytic
surface output are not implemented. Unsupported combinations and empty/no-op cuts
are rejected; the document is not partially modified.

## Hole feature

Choose Simple, Counterbore, or Countersink and Through all or Distance. U/V offsets
are measured from the arithmetic face center using its first-edge axis and the
orthogonal tangent. Diameter, blind depth, recess diameter/depth and included
countersink angle accept design parameter expressions. Only relevant controls are
shown; the confirmation footer remains reachable on phones.

The cutter is a single closed revolved polygonal surface aligned inward along the
picked face normal. Through-all spans the target's inward projected bounds. Blind
holes have flat bottoms. No drill-tip angle, modeled/cosmetic threads, standards
fastener table or multi-hole placement authoring is claimed. Large diameters may
legitimately break out of the stock, but the center must lie within the picked face.

The target must be a closed outward native mesh. Recess dimensions and angles,
planarity, center incidence, segment counts and resource limits are validated
before regeneration. Clipping uses translated face-local coordinates to reduce
cancellation at large world origins. Output is a real native `MESH`, not `3DSOLID`.

### Associations and topology

A new hole stores the selected face's vertex incidence, face index, vertex count
and face count. Dimension-only edits of compatible stock recompute the local frame
and update descendants. Detectable changes of face incidence or mesh cardinality
fail before mutation. **Reattach to the current face topology** explicitly accepts
a new current face, while changing the face or input through the form also rebinds.

This is a conservative incidence guard, **not persistent B-rep naming**. Changes
that retain counts and index ordering while changing semantic face identity cannot
be universally detected. Profile snapshots are not made associative by this guard.
Conduit history and attachments round-trip in application metadata in ASCII/binary
DXF. Other CAD applications receive evaluated native geometry; they do not receive
an executable Autodesk feature/action graph. Baked exchange remains available.

## Preview, timeline and mobile behavior

Preview and Apply call the same evaluator. Preview is transient. Editing any field
clears the stale result and restores the pre-preview camera, so an old preview is
not mistaken for current input. Failed previews also clear stale geometry. Body
modifications preserve the current camera; standalone creation may refit.

The timeline updates only when its contents or selection change. Unchanged syncs
preserve focused DOM controls and horizontal scroll. Arrow/Home/End move keyboard
focus without evaluating or selecting a body; Enter activates it, and double-click
opens feature editing. All edits participate in shared undo and atomic downstream
regeneration. An active-document identity check rejects stale operation forms.

The contextual strip reuses the bottom dock instead of covering the canvas with a
third row. Phones no longer reserve empty space for the hidden fixed 2D dock. That
space and dock return when entering 2D. The existing keyboard-aware modal shell,
scrolling body and retained confirmation footer are reused, with 44-pixel touch
controls. Touch opening does not automatically summon the software keyboard.
Two-finger navigation remains non-editing. A pointer movement threshold prevents
minor hand jitter from initiating orbit before a tap is committed.

## Kernel and package changes

`@conduitcad/modeling` exports `faceFrame3`, `faceCoordinates3`, `facePoint3`,
`profileOnFace3`, `extrudeExtent3`, `combineExtrusion3`, `holeTool3` and `drillHole3`
with explicit TypeScript contracts. `MODELING_TOOLS` exposes numeric choice
options and optional two-input extrusion. UI adapters live separately in
`packages/workbench/src/authoring-workbench.js`; the geometric APIs are DOM-free.

The BSP conforming pass now assigns each split vertex to at most one nearest
incident polygon edge. It excludes vertices already belonging to the face and
uses a tighter normalized incidence tolerance than half-space classification.
This fixes duplicate-corner insertion encountered in side-face drilling. Existing
Boolean triangle/split/work budgets remain enforced. Operations are still bounded
floating-point faceted Booleans, not arbitrary exact solid-kernel guarantees.

## Example drawings

**New / 3D examples** adds Hole design workshop, Extrusion extents study and
Face-mounted boss. The library now has thirteen starters, each with native project,
ASCII DXF and binary DXF files under `samples/3d`. `npm run samples:3d` reproduces all
39 files. The audit derives expected names from the generated manifest instead of
hard-coding the previous twenty DXF files. These are editable concept models, not
construction-approved designs.

## Validation and reproduction

Run `node scripts/bootstrap.mjs`, `npm test`, `npm run build`, and
`tsc -p tests/tsconfig.json`. The new `tests/modeling3d-authoring.test.mjs` checks
independent faceted-volume formulas, all six support-face directions, transformed
and large-coordinate geometry, regeneration/rollback, topology guards, native OCS
profiles and ASCII/binary history round trips. The inherited tests remain enabled.

`tests/browser_authoring3d.py` exercises actual face picks, dialogs, preview
invalidation, Apply, upstream edits, undo/redo, timeline focus, 2D mode return and
native browser touch events at 320×568, 390×844, 844×390 and 820×1180. CI uses
`CONDUIT_TEST_ORIGIN=localhost`. The optional opaque-origin local adapter explicitly
emulates storage; it is not evidence of native IndexedDB or crash durability.
`tests/audit_modeling3d.py` independently reopens all 26 example DXFs using ezdxf.
The existing backend suite separately tests Canvas, WebGL2 and WebGPU fixture
rendering on an available adapter, recording fallback and software-device status.

Physical phones/tablets, OS keyboards/IME, arbitrary screen readers, native
AutoCAD/Fusion acceptance and hardware performance remain separate qualifications.

Primary workflow references:
- Autodesk Fusion, Extrude reference:
  https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-REF-EXTRUDE.htm
- Autodesk Fusion, Holes and threads:
  https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-HOLE-THREAD.htm

The implementation is original; no proprietary kernel or assets are included.
