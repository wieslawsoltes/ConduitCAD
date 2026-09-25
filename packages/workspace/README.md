# @conduitcad/workspace

DOM-free document sessions, ordered tabs, revision-aware serialized checkpoints,
and collision-safe clipboard block merging. Version **0.7.0**, native ESM, MIT.
No external runtime dependencies.

```js
import { DocumentWorkspace } from '@conduitcad/workspace';
import { ProjectStore } from '@conduitcad/storage';

const store = new ProjectStore({ database: 'my-cad-editor' });
const workspace = new DocumentWorkspace({
  store,
  key: 'my-window',
  capture: session => ({ document: session.document, state: { camera: session.context.camera } })
});
const first = workspace.add({ name: 'First drawing', entities: [] });
workspace.add({ name: 'Second drawing', entities: [] });
workspace.activate(first.id);
first.document.entities.push({ type: 'POINT', x: 10, y: 20 });
workspace.markChanged(first.id);
await workspace.saveAll();
workspace.remove(first.id); // Dirty sessions require a save or explicit discard.
workspace.dispose();
store.dispose();
```

The host owns histories, renderers, context activation, import/export and user
confirmation. Context is opaque in memory; only the explicit capture result is
serialized. `beforeSave` synchronizes the active host context when a queued save
actually executes. JSON snapshots are immutable across the asynchronous write.
The store must implement atomic `saveWorkspace(records, manifest, key)`. Failed
saves leave sessions open/dirty; changes made during a write remain dirty.

Default capacity is 32 sessions (configurable 1–128), with 650ms debounce. The
queue serializes writes and takes the next snapshot only after the previous write
settles. Closed drawings are not deleted by this class. The bundled browser store
retains closed recovery copies; the host decides when to reopen them.

`mergeClipboardBlocks(destination, source, entities)` clones the entities and
reachable definitions, resolves case-insensitive block-name collisions with new
names, rewrites nested references, and rejects cyclic or ambiguous block graphs.
It never changes either input. It is not a cross-document arbitrary-DXF-database
cloner: callers still allocate entity IDs and handle layers, dependencies and
application-specific graph semantics.

TypeScript declarations are in `src/index.d.ts`. The full application integration,
recovery contract and tests are documented in `docs/MULTI_DOCUMENT.md` in the
source workspace. Saving on the device is not a downloaded backup or cloud sync.
