# @conduitcad/model

DXF-native editable document model. Version **0.5.0**, native ESM JavaScript, MIT license.

JSON-safe CAD entities, native BLOCK/INSERT definitions, layers, ports, tags, geometry expansion and transformations.

## Use

Install this package and its sibling dependencies from the supplied npm archives,
or run `node scripts/bootstrap.mjs` in the complete workspace. The package name is
prepared for npm distribution; this release does not claim a registry publication.

```js
import { uid, clone, createDocument } from '@conduitcad/model';
```

`src/index.js` contains the implementation and `src/index.d.ts` the TypeScript
API declarations. Browser-facing components require a browser DOM; the geometry,
model, history, routing, constraints, symbol, DXF and scene compilation engines
can also be used in Node.js. There are no external runtime dependencies beyond
the following sibling packages.

**Dependencies:** `@conduitcad/geometry`, `@conduitcad/constraints`.

## Public exports

`uid`, `clone`, `createDocument`, `validateDocument`, `entity`, `line`, `polyline`, `circle`, `text`, `rect`, `layerFor`, `isVisible`, `isLocked`, `cleanText`, `resolveStyle`, `entityGeometry`, `entityBounds`, `documentBounds`, `ports`, `moveEntity`, `transformEntity`, `explodeEntity`, `detachReferences`.

## Documentation and validation

The full source workspace contains `docs/API.md` with integration examples,
`docs/ARCHITECTURE.md`, `docs/DXF_COMPATIBILITY.md`, and `docs/VALIDATION.md`.
Tests and raw validation reports are included there. These are original reusable
2D engineering components, not a claim of complete AutoCAD/Visio compatibility.

## 0.4.0 editing APIs

Planar native dimension pictures, atomic dimension edits and authored point
associations; bounded declarative parameter-action evaluation, instance variants,
parameter grips and named-port updates. Public TypeScript definitions describe
all eight action types. See `docs/CAD_EDITING.md` in the source repository for
native interoperability, unsupported geometry and host history integration.

Version 0.5 adds `beginBlockEdit`, `editedBlockDefinition`, `prepareBlockUpdate`, `updateBlockDefinition`, `inspectBlockReferences`, `createBlockDefinition`, `deleteBlockDefinition`, `duplicateBlockDefinition`, `renameBlockDefinition` and `syncInsertAttributes`. The workbench supplies undo/routing/render integration; headless hosts own those policies.
