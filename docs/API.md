# Package API examples

All examples assume the workspace was bootstrapped or all npm package archives
were installed. JavaScript modules are native ESM. The source in each package is
the implementation contract; `src/index.d.ts` provides declarations, including
permissive fields for entity-specific DXF data.

## Full application

```js
import {mountWorkbench} from '@conduitcad/workbench';
import '@conduitcad/workbench/styles.css';
import {createDocument} from '@conduitcad/model';
import {installSymbols} from '@conduitcad/symbols';

const app = mountWorkbench(document.getElementById('app'), {
  document: installSymbols(createDocument('My drawing')),
  backend: 'auto' // auto | webgpu | webgl2 | canvas
});
await app.ready;
app.root.addEventListener('conduit:change', event => {
  console.log(event.detail.document.version);
});
app.executeCommand('LINE 0,0 100,50');
// app.dispose() releases browser resources and subscriptions.
```

The workbench CSS is application-wide, not Shadow DOM isolated. Its keyboard
handling and dialogs expect a single workbench instance. Embed a complete
workbench in an iframe, or use lower-level packages in an existing application.
Do not mount two instances into one document and assume isolation.

## Kernel and model

```js
import {lineIntersection, offsetPolyline} from '@conduitcad/geometry';
import {createDocument, line, circle, moveEntity} from '@conduitcad/model';

const d = createDocument('Geometry');
const e = line({x:0,y:0}, {x:100,y:0}, {layer:'Process'});
d.entities.push(e, circle({x:50,y:50}, 20));
moveEntity(e, 10, 20);
const intersection = lineIntersection(
  e.a, e.b, {x:50,y:-100}, {x:50,y:100});
const offset = offsetPolyline([e.a,e.b], 10);
```

Model coordinates are Y-up. `matrix({rotation})`, text/insert rotations and the
UI use degrees. Arc start/end parameters and trigonometric geometry use radians.
Entities and documents are mutable, JSON-safe records. There is no implicit
observation layer: callers must notify the renderer after mutations.

## Reusable renderer

```js
import {CadRenderer, Camera} from '@conduitcad/renderer';
const host = document.getElementById('canvas-host');
host.style.position = 'relative';
host.style.width = '100%';
host.style.height = '600px';

const renderer = new CadRenderer(host, {camera:new Camera(), backend:'auto'});
renderer.setDocument(d);
await renderer.ready;
renderer.fit();

moveEntity(e, 5, 0);
renderer.updateEntities([e.id]); // equal topology is patched; otherwise rebuilt
// Use renderer.setDocument(d) for global layer/style/block changes.
// Call renderer.invalidate() after changing the camera only.
```

`buildScene(d)` and `updateSceneEntities(scene,d,ids)` work without a DOM. The
latter returns updated `{offset,count}` segment ranges, or null when a full
rebuild is required. It validates all requested topology before mutating buffers.
Do not call it on a different document without first rebuilding the scene.

## Native symbols and named ports

```js
import {entity, rect, ports} from '@conduitcad/model';

d.blocks.CUSTOM_PROCESS = {
  name:'CUSTOM_PROCESS', base:{x:0,y:0},
  entities:[rect(-40,-25,80,50)],
  ports:[
    {name:'in',x:-40,y:0,dx:-1,dy:0},
    {name:'out',x:40,y:0,dx:1,dy:0}
  ],
  symbol:{name:'Custom process',category:'Custom',labelOffset:45}
};
const instance = entity('INSERT', {
  block:'CUSTOM_PROCESS',x:300,y:100,sx:1,sy:1,rotation:0,tag:'PKG-01'
});
d.entities.push(instance);
console.log(ports(instance,d)); // transformed world-space ports
```

The library factory `installSymbols` clones definitions into each document;
editing a block in one document does not mutate another document or the library
master. `insertSymbol` returns a native INSERT; it does not append it for you.

## Routing with explicit failure handling

```js
import {polyline, ports} from '@conduitcad/model';
import {routePorts} from '@conduitcad/routing';

// a and b are INSERT entities already in d.
const from = ports(a,d).find(p=>p.name==='out');
const to = ports(b,d).find(p=>p.name==='in');
if (!from || !to) throw new Error('Required port is missing');
const route = routePorts(from,to,obstacleBounds,{clearance:12,lead:22});
if (route.status !== 'routed') {
  console.warn(route.reason || 'Route is blocked');
}
const wire = polyline(route.points,false,{
  layer:'Process',
  connector:{
    from:{entityId:a.id,port:from.name},
    to:{entityId:b.id,port:to.name},
    style:'process',arrow:'end',waypoints:[],status:route.status
  }
});
d.entities.push(wire);
```

Obstacle records have `{minX,minY,maxX,maxY,id?}`. `routePorts` excludes the
endpoint equipment IDs from the obstacle list. Routes are planar; a rotated
port can have a nonorthogonal lead before the orthogonal body of the route.
A blocked fallback path must be presented as blocked by the consuming UI.

## Parameters, constraints and transactions

```js
import {ConstraintSolver, evaluateExpression} from '@conduitcad/constraints';
import {History} from '@conduitcad/history';
let documentModel = d;
const history = new History({
  capture:()=>documentModel,
  restore:restored=>{documentModel=restored;}
});
const solver = new ConstraintSolver();

documentModel.parameters.span = '80';
documentModel.constraints.push(
  {type:'horizontal',entityId:e.id},
  {type:'length',entityId:e.id,value:'span*2'}
);
history.run('Solve sketch',()=>{
  const result=solver.solve(documentModel.entities,
    documentModel.constraints,documentModel.parameters);
  if (!result.converged) throw new Error('Sketch did not converge');
});
console.log(evaluateExpression('span/2',documentModel.parameters));
```

History actions are **synchronous**. Do file I/O or asynchronous preparation
before entering `run`. `restore` replaces the document; consumers must rebind
references and invalidate render caches. Native workbench field expressions are
stored in entity `parametric` metadata and applied by the workbench in addition
to explicit sketch constraints.

## DXF and original-file preservation

```js
import {parseDXF, writeDXF, exportReport} from '@conduitcad/dxf';
const parsed = parseDXF(await file.arrayBuffer(), {name:file.name});
console.table(parsed.importDiagnostics);
const report = exportReport(parsed);
console.warn(report.warnings);
const editedDXF = writeDXF(parsed,{version:'AC1024',includeMetadata:true});
```

`parseDXF` accepts a string, Uint8Array or ArrayBuffer. Supported ASCII output
versions are AC1015, AC1018, AC1021, AC1024, AC1027 and AC1032. Encoding can be
explicitly supplied for legacy inputs. Byte input stores an exact base64 source
copy; string input stores the supplied decoded string.

Binary output is not implemented. Keep `source` and `rawSections` when retaining
the native project, but do not treat these as a promise that normalized output
will merge arbitrary opaque records with edits.

## Storage and exchanges

`ProjectStore.save/load/list` operate locally in the browser. The autosave key
is `autosave`; the workbench archives a snapshot before switching documents.
The current UI automatically restores only the latest autosave; archive listing
is available through the storage API, not a full recent-files browser.

`writeSVG` and `writeBOM` work without a DOM. `renderPNG` returns a browser Blob.
`graphFromDocument` returns nodes, directed edges and adjacency. Text and SVG
markup are escaped. CSV is a data export, not a database synchronization engine;
review externally sourced tag values before opening them in spreadsheet tools.

## Revision-3 engineering libraries and industry starters

```js
import {
  SYMBOLS, CATEGORIES, STANDARD_REFERENCES, DRAWING_TYPES,
  searchSymbols, createDrawing, auditSymbols, symbolUpdates, updateSymbolDefinitions
} from '@conduitcad/symbols';

const hydraulic = createDrawing('hydraulic-actuator');
const valves = searchSymbols('valve', {category: 'Hydraulics', standard: 'ISO-1219-1'});
const issues = auditSymbols().flatMap(result => result.errors);
// Convention references are not dimensional or engineering approval.
console.log(CATEGORIES.length, SYMBOLS.length, DRAWING_TYPES.length); // 11, 223, 20
console.log(STANDARD_REFERENCES['ISO-1219-1'].scope, valves.length, issues.length);

// Explicit saved-project migration, never invoked automatically by installSymbols.
const updates = symbolUpdates(documentModel);
history.run('Update selected symbol definitions', () => {
  updateSymbolDefinitions(documentModel, updates.map(master => master.id));
  // Invoke the host's connection rerouting and renderer invalidation here.
});
```

Search uses case/accent-normalized multiword matching across names, IDs, groups,
aliases and reference families. Search limits/categories/references are optional.
Symbol metadata is serialized through the existing Conduit DXF XDATA convention;
foreign CAD applications see normal blocks/primitives, not a proprietary stencil.

`routePorts` now accepts `waypoints` in its options. It creates terminal-normal
escape stubs, keeps endpoint bodies as obstacles, and rejects colliding escape
stubs. This prevents a return route from passing back through a directional-valve
body. `routeVia` remains the free-point waypoint router; it does not infer ports.
