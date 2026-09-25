# @conduitcad/drawing

Native DXF-compatible CAD drawing factories and pointer-independent staged sessions.
No DOM, renderer, storage or network dependency. The host owns snapping, coordinate
conversion, history, insertion, solver integration and preview rendering.

```js
import { DrawingSession, parseDrawingPoint } from '@conduitcad/drawing';
import { createDocument, entityGeometry } from '@conduitcad/model';

const document = createDocument('Arc example');
const session = new DrawingSession('arc');
session.add({ x: 0, y: 0 });
session.add({ x: 50, y: 50 });
const arc = session.add(parseDrawingPoint('@50,-50', session.points.at(-1)));
// Only the completed native entity is committed; preview creation never mutates it.
document.entities.push(arc);
const geometry = entityGeometry(arc, document);
```

`DRAWING_TOOLS` describes the 28 workflows, point prompts, finish/close semantics and
available options. `createDrawingEntity` builds the same native results headlessly.
`hatchFromEntities` copies circle, ellipse and closed planar-polyline boundaries,
retaining native arc/ellipse/bulge data and even-odd island semantics.

Angles supplied as options or polar point text are degrees; entity geometric angles
are radians. Numeric dimension fields follow the model's own DXF contract. All
new geometry lies in XY at Z=0. Point coordinates and derived radii are finite and
bounded to 1e12; paths have at most 512 picked points. Invalid completion throws
without consuming the final session point, so a UI can show an error and retry.

The through-point spline is a C1 piecewise cubic interpolation, not an implementation
of Autodesk's FIT algorithm. Leaders are native unassociated LEADER entities, not
MLEADERs. Hatches are snapshots, not associative boundary evaluators. Planar 3DFACE
creation is not solid modeling. See the workspace `docs/DRAWING_TOOLS.md` for the
workbench controls, numerical limits, regression coverage and interchange scope.
