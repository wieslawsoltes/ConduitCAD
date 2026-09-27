# @conduitcad/manipulation3d

DOM-independent, double-precision manipulation and isolated preview transactions for
ConduitCAD's native 3D feature engine. Version 0.11.0. MIT licensed. No DOM, GPU,
network, pointer capture, storage, or animation-frame dependencies are required by
this package. The host supplies a compatible Z-up camera and transaction boundary.

## Isolated, expression-preserving feature editing

```js
import { createDocument } from '@conduitcad/model';
import { History } from '@conduitcad/history';
import { VisualEditSession } from '@conduitcad/manipulation3d';

let document = createDocument();
document.parameters.Width = '120';
const history = new History({
  capture: () => document,
  restore: restored => { document = restored; }
});
const session = new VisualEditSession(document, 'box');
session.set('width', 'Width');
session.set('depth', 70);
session.set('height', 45);
const beforeDrag = session.snapshot();
const original = session.parameters.width;
const originalValue = session.value('width');

// Each pointer sample uses the same gesture-start expression/value, not the
// previous sample. A 15-unit move retains the dependency on Width.
session.dragValue('width', 15, original, originalValue, 1);
session.checkpoint(beforeDrag);
const preview = session.evaluate(); // independent CadDocument, cached by revision
console.assert(document.entities.length === 0);

// Draw preview rather than document. Explicit acceptance is the ONLY live edit.
history.run('Create box', () => session.commit(document));
session.cancel(); // release baseline/preview references after acceptance
history.undo();
```

The returned preview is a read-only-by-contract view. Do not mutate session
`parameters`, `inputs`, `base`, or `preview` directly in a consumer: use `set`,
`setInput`, `restore`, `undo` and `redo` so the revision cache is invalidated.
`commit()` validates source object identity and a full document signature, then
copies evaluated entities. It does not open a history transaction, save a drawing,
or close the session. Those lifecycle decisions belong to the host.

An existing feature is edited using `new VisualEditSession(doc, kind, {id})`.
Selection inputs use `{inputs: [entityId, ...], hit: {id, face, point}}` or
`setInput(index, entityId, hit)`. Incompatible, duplicate, self-referential or locked
inputs are rejected; a failed preview cannot commit a previous successful shape.

## Projected gestures

`beginAxisDrag3` / `updateAxisDrag3`, `beginPlaneDrag3` / `updatePlaneDrag3`, and
`beginAngleDrag3` / `updateAngleDrag3` convert screen coordinates into signed world
movement or unwrapped degrees. Gesture start freezes the projection frame. The
camera implements `Projection3`: position, orthographic height, perspective state,
45-degree vertical field of view, ray/project methods and an orthonormal Z-up basis,
as used by `@conduitcad/renderer3d`'s `Camera3D`.

Axis gestures use a ray/axis constraint; an end-on axis has an explicit stable
screen-vertical fallback. Plane/ring gestures reject edge-on or behind-eye
intersections rather than inventing extreme coordinates. Ring angles unwrap across
multiple revolutions. For two-finger takeover or pointer cancellation, restore the
gesture-start snapshot and discard its partial movement before navigating.

`visualHandles3(session, camera, mode)` describes world-space anchors for primitive
sizes, translations, Euler rotation rings, scale, face-local placement, hole and
profile dimensions, extrusion extents, face offset, vertex coordinates, mirror
planes and pattern pitch/angle. Its descriptors are data, not DOM nodes.

`layoutHandles3` packs projected 44-pixel handles and dimension labels. Labels cannot
cover any handle or another label; labels are omitted when space is insufficient.
A host must retain exact values elsewhere, such as the workbench's dimension ribbon.

## Scope

`VISUAL_TOOLS` includes the 19 existing modeling operations and native ground/face
profiles and vertex editing: 22 tools. Not every parameter is naturally draggable;
segmentation, operation choices, source order, arbitrary axes and pivot coordinates
remain exact fields/chips in a non-modal options region. Loft supports up to 32
sections. Gesture-local undo has a 64-snapshot budget.

The host coalesces preview work with requestAnimationFrame; this package evaluates
synchronously. Each accepted new revision clones the source document and regenerates
its affected feature graph. This is not a GPU modeling kernel, worker pool or
constant-time editor for arbitrarily large drawings. Source-signature validation is
also O(document size). Bounds and limitations of the underlying faceted mesh engine
continue to apply. Native profiles are snapshots rather than associative face sketches;
feature vertex editing explicitly detaches history. This is not an ACIS/3DSOLID or
proprietary Autodesk feature-graph implementation.
