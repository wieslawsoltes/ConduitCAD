# Live parameters and spatial paths — 0.13.0

## Live design parameters

Choose **Parameters** in either 2D or 3D. The non-modal panel keeps the drawing
interactive while evaluating expressions and regenerating dependent geometry.
Edit a name/expression or scrub the calculated-value control horizontally. Arrow
keys adjust a focused value; Shift gives fine steps. Scrubbing adds a delta to the
original expression rather than replacing a dependency with a numeric constant.
The dependency list explains referenced names. Search filters the rows; Add and
Remove stage schema changes. Renaming does not silently rewrite other expressions:
unresolved references must be repaired before Apply.

Preview uses a detached drawing with native parametric entities, constraint solving,
calculated annotations, 3D feature regeneration, dimension pictures and connector
routing. The same panel operates in an isolated shared-block draft. A change that
would alter locked dependent geometry fails instead of bypassing the lock. Parameter
object annotations and unchanged scalar representations are retained.

**Apply** commits one document-history transaction. **Undo draft / Redo draft** only
change this operation; **Cancel** restores the accepted drawing. Cyclic, unresolved,
invalid or oversized expressions remove the stale preview and cannot apply an older
valid result. Source identity and complete document signatures guard concurrent edits.
A document/mode change or conflicting command discards the unaccepted operation.
On phones the panel becomes a bounded sheet with a scrolling body and fixed footer.
**Preview model** collapses secondary controls without closing the operation.

## Spatial path editing

Choose **3D → Create → Spatial path**, or select an ordinary spatial POLYLINE and
choose **Edit on canvas**. Tap the viewport to append points on the active workplane;
the dashed workplane guide is transient, not drawing geometry. Empty-space dragging
continues camera navigation. Choose XY, XZ, YZ, View or a picked planar face in
**Plane / exact point**. The offset is measured along that plane's normal. View and
face planes are snapshots, not associative support-plane features.

The selected vertex exposes X/Y/Z handles and exact coordinate fields. Drag a vertex
in the current workplane, or constrain the gesture to a world axis. Tap an axis
handle for exact entry; arrow keys nudge a focused handle. Coordinates accept named
parameter expressions. A drag starts from the gesture's original expression, so
`Rise` dragged by 15 units becomes `(Rise) + 15` without repeated nesting.

**Add exact point** appends WCS coordinates. **Insert midpoint** inserts component-wise
expressions halfway to the following vertex. **Remove vertex** and **Close path**
preview topology changes. **Reverse direction** reverses traversal while keeping the
selected physical vertex selected. Closed paths retain their first vertex; native
vertex metadata and expressions travel with their vertex. This has its own draft
undo and regenerates dependent sweeps on Apply. The selector reaches every vertex; the viewport presents
at most 24 nearby vertex handles plus the three axes, keeping touch hit targets
bounded. The original vertex metadata is retained for unaffected vertices across
insertions/removals and draft undo. A two-finger takeover or resize rolls back an
unfinished handle gesture before camera navigation continues.

Apply creates or replaces one native POLYLINE, regenerates dependent features such
as sweeps and commits one undoable transaction. Cancel changes no geometry. Direct
native vertex edits outside the path session replace only that vertex's coordinate
expressions with explicit numeric XYZ, leaving the remaining dependencies intact.

## DXF and boundaries

Output is an ordinary DXF 3D POLYLINE with flag 8 and optional closed bit 1. Native
vertices contain evaluated double-precision WCS coordinates. Conduit metadata stores
coordinate expressions; it round-trips through the existing ASCII/binary writer and
reader. Other CAD readers receive the evaluated native path; no proprietary Autodesk
feature graph is authored. The source path remains a dependency of a Conduit sweep.
Parameter-driven path updates are prepared before feature evaluation and are not
published when a downstream feature fails.

The editor rejects fitted/spline-fit polylines, polygon/polyface meshes, bulged paths,
feature-owned output and non-Model layouts. It accepts at most 2,048 path vertices,
4,096 characters per coordinate expression and absolute coordinates up to 1e12.
Open paths need two points; closed paths need three, with distinct adjacent vertices
and no duplicate closing point. Self-crossing paths are not prohibited, but operations
that consume them may reject invalid resulting geometry.

The parameter panel accepts at most 1,024 rows and 4,096 characters per expression.
Names cannot collide with reserved evaluator names or named constraints. Preview
work is coalesced to animation frames and camera movement only reprojects controls;
overlay coordinate evaluation is revision-cached (including errors), so repeated
camera-only redraws do not reparse path expressions. The reusable `points()` result
is deeply frozen and must be edited through session methods, not mutated. Feature
regeneration is still synchronous and clones the drawing. This is not a guarantee
of million-entity interactive solving. Fully associative face sketches, arbitrary
persistent topology naming, exact curved B-rep/ACIS and every specialist dialog are
outside this update.

## Reusable APIs

```js
import { ParameterEditSession } from '@conduitcad/manipulation2d';
import { SpatialPathSession } from '@conduitcad/manipulation3d';
import { regenerateFeatures } from '@conduitcad/modeling';

// The host supplies its full 2D/constraint/dimension/routing regeneration pipeline.
const parameters = new ParameterEditSession(document, { process: regenerateDesign });
const rise = parameters.rows.find(row => row.name === 'Rise');
parameters.set(rise.id, { expression: '80' });
const parameterPreview = parameters.evaluate(); // Original document is untouched.
history.run('Design parameters', () => parameters.commit(document));
parameters.cancel(); // Releases the preview and source references.

const path = new SpatialPathSession(document, { layer: '0' });
path.insert(0, { x: 0, y: 0, z: 0 });
path.insert(1, { x: 0, y: 0, z: 'Rise' });
path.insert(2, { x: 100, y: 0, z: 'Rise' });
const pathPreview = path.evaluate();
history.run('Spatial path', () => path.commit(document));
path.cancel();

// Re-evaluates persisted path coordinates before dependent feature evaluation.
document.parameters.Rise = 90;
regenerateFeatures(document);
```

Both sessions are DOM-independent. The host owns history, pointer routing and preview
presentation. Public declarations are included in the existing packages; the workspace
still has 21 packages. The archives are tested for offline installation, not implicitly
published to the public npm registry.

## Editable workshop

**3D → Create → Parametric path workshop** opens a separate native drawing with an
expression-driven spatial route, a swept body, a parameterized plate, a planar
footprint, a native circle profile and a caption. Change Span, Rise, TubeRadius or
PlateThickness through the live panel. Select the route and edit its vertices; the
sweep follows the source path after Apply. Native, ASCII DXF and binary DXF copies
are generated by `npm run samples:live` under `samples/live/`.

## Tests

`npm run test:live` exercises isolated state, dependencies, native vertex metadata,
atomic regeneration, locks, signatures, expression limits and DXF round-trips.
`tests/browser_live_workspace.py` exercises actual mouse/touch/keyboard input,
non-modal UI, parameter scrubbing, XYZ dragging, topology controls and downloaded
DXFs. Select a requested backend with `LIVE_TEST_BACKEND=canvas|webgl2|webgpu`;
the suite rejects fallback substitution. Use `CONDUIT_TEST_ORIGIN=localhost` in CI.
The opaque-origin local mode explicitly uses a memory storage adapter and is not a
native storage test. `tests/audit_live_workspace.py` independently audits the generated
and browser-downloaded native DXF files using ezdxf. Software GPU and emulated touch
results do not establish physical-device performance or operating-system keyboard,
screen-reader or native Autodesk acceptance.
