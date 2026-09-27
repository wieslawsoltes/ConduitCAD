# @conduitcad/manipulation2d

DOM-free native planar CAD edit sessions, exact fields and screen-independent grips.
The package is ESM, includes strict TypeScript declarations, and has no external runtime dependencies.

```js
import { createDocument, circle } from '@conduitcad/model';
import { PlanarEditSession, handles2, dragHandle2 } from '@conduitcad/manipulation2d';
const document = createDocument('Part');
document.parameters.Diameter = 80;
const shape = circle({x:0,y:0},40);
document.entities.push(shape);
const edit = new PlanarEditSession(document,[shape.id]);
edit.set('radius','Diameter/2');
const preview = edit.evaluate(); // document is unchanged
const before = edit.snapshot();
const radius = handles2(edit,2).find(h=>h.id==='radius');
dragHandle2(edit,radius,{x:10,y:0},before,{step:1});
edit.checkpoint(before);
edit.evaluate();
edit.commit(document); // radius expression is (Diameter/2) + 10
edit.cancel();          // release source/preview references
```

The host supplies document undo, snapping and optional `process(preview, changedIds)`
for constraint solving, calculated annotations, feature/dimension regeneration and
routing. The callback receives an isolated document and a read-only set of affected IDs.
Return only after all dependent updates validate; throw to reject a preview. Neither
the package nor its callback should publish partial results into the source document.
The workbench integration evaluates actual native geometry and commits one history transaction.

Operations: geometry, move/copy, rotate/copy, positive uniform scale/copy,
straight-polyline/line/circle/arc offset, and two-line fillet. Copy operations retain
shared block definitions and remap copied ATTRIB identities. Separate sketch constraints
are not duplicated as part of copying geometry. The original selection stays intact.

Supported planar native entities: LINE, CIRCLE, ARC, ELLIPSE, LWPOLYLINE,
POLYLINE, SPLINE, POINT, RAY, XLINE, TEXT, MTEXT, ATTDEF, ATTRIB, LEADER,
SOLID, TRACE, 3DFACE, polygon HATCH, managed DIMENSION and INSERT.
Eligibility is deliberately guarded: non-default OCS, nonzero elevation,
spatial features, mesh polylines, locked geometry, unmanaged dimensions and
associative/edge-path hatches require their appropriate existing editors.

Expressions persist for supported parametric length, radius and rectangle fields,
existing driving constraints and Conduit dynamic parameters. Other exact coordinates
are evaluated values, not a newly invented universal association system.
All fields are finite and bounded; native controls are limited to 2,048 per entity.
The source is protected by identity and a full JSON signature at commit. Sessions
clone the complete document: this is not a sparse million-entity transaction engine.
